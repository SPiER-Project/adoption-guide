import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { TOOLS, stageById } from '../data/catalog'
import { PATHWAY_STAGE_SYSTEM } from '../lib/patientPathway'
import type { AppointmentResource, CommunicationResource, FhirResource } from '../types/fhir'
import '../css/WorkflowActionView.css'

/**
 * Records a non-Questionnaire workflow step as a stage-tagged FHIR resource.
 *
 * This is the entry-surface counterpart to QuestionnaireView for the workflow
 * tools at stages 5-7 whose artifacts aren't Questionnaire-shaped (issue #52).
 * The emitted resource is tagged with `meta.tag` against the SPiER pathway-stage
 * CodeSystem so the generalized `stageForArtifact` dispatch groups it under the
 * right stage and advances the pathway — see lib/patientPathway.ts.
 *
 * The form and emitted resource are driven by the tool's `workflowType`:
 *  - 'communication' → Communication (caring contacts, referral/transition outreach)
 *  - 'appointment'   → Appointment (follow-up scheduling + missed-appointment tracking)
 */

// HL7 v3 ParticipationMode codes for how a contact was made.
const CHANNELS = [
  { code: 'PHONE', display: 'Telephone call' },
  { code: 'WRITTEN', display: 'Letter / card' },
  { code: 'SMSWRIT', display: 'Text message' },
  { code: 'EMAILWRIT', display: 'Email' },
] as const
const PARTICIPATION_MODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode'

// FHIR R4 Appointment.status subset relevant to follow-up tracking.
const APPOINTMENT_STATUSES = [
  { code: 'booked', display: 'Booked' },
  { code: 'arrived', display: 'Arrived' },
  { code: 'fulfilled', display: 'Fulfilled (attended)' },
  { code: 'cancelled', display: 'Cancelled' },
  { code: 'noshow', display: 'No-show (missed)' },
] as const

interface WorkflowActionViewProps {
  /** Catalog Tool id this recorder logs for (e.g. 'TL-010'). */
  toolId: string
  /** Optional page-title override; defaults to the tool name. */
  title?: string
  /**
   * Lower-case noun for the thing being recorded ('caring contact', 'referral',
   * 'appointment', …). Drives the default summary, placeholder copy, and success
   * message. Defaults to 'contact'.
   */
  actionNoun?: string
  /** Optional override for the Summary field placeholder. */
  summaryPlaceholder?: string
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function todayIso(): string {
  // Build the date in the browser's local timezone. toISOString() is UTC, which
  // would default to tomorrow's date for users behind UTC in the evening.
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** crypto.randomUUID() is secure-context only; fall back for plain-HTTP/test envs. */
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function WorkflowActionView({
  toolId,
  title,
  actionNoun = 'contact',
  summaryPlaceholder,
}: WorkflowActionViewProps) {
  const tool = useMemo(() => TOOLS.find(t => t.id === toolId), [toolId])
  const { addArtifact, activePatientId } = usePatient()

  const stageId = tool?.stageId ?? 'track-follow-up'
  const stage = stageById(stageId)
  const heading = title ?? tool?.name ?? 'Workflow step'
  const isAppointment = tool?.workflowType === 'appointment'
  const resourceType = isAppointment ? 'Appointment' : 'Communication'

  // 'channel' doubles as Appointment.status when isAppointment.
  const [channel, setChannel] = useState<string>(
    isAppointment ? APPOINTMENT_STATUSES[0].code : CHANNELS[0].code,
  )
  const [date, setDate] = useState<string>(todayIso())
  const [summary, setSummary] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)

  // Live preview of the FHIR resource that will be written.
  const draft = useMemo<FhirResource>(() => {
    const subjectRef = `Patient/${activePatientId ?? 'unknown'}`
    const tag = [{ system: PATHWAY_STAGE_SYSTEM, code: stageId, display: stage?.title }]
    const description = summary.trim() || capitalize(actionNoun)

    if (isAppointment) {
      const resource: AppointmentResource = {
        resourceType: 'Appointment',
        status: channel,
        meta: { tag },
        description,
        start: `${date}T12:00:00Z`,
        participant: [{ actor: { reference: subjectRef }, status: 'accepted' }],
      }
      if (note.trim()) resource.comment = note.trim()
      return resource
    }

    const channelMeta = CHANNELS.find(c => c.code === channel) ?? CHANNELS[0]
    const resource: CommunicationResource = {
      resourceType: 'Communication',
      status: 'completed',
      meta: { tag },
      category: [{ text: tool?.shortName ?? tool?.name ?? 'Workflow contact' }],
      reasonCode: [{ text: description }],
      medium: [{ coding: [{ system: PARTICIPATION_MODE_SYSTEM, code: channelMeta.code, display: channelMeta.display }] }],
      subject: { reference: subjectRef },
      sent: `${date}T12:00:00Z`,
    }
    if (note.trim()) resource.payload = [{ contentString: note.trim() }]
    return resource
  }, [isAppointment, channel, date, summary, note, stageId, stage, tool, activePatientId, actionNoun])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const idPrefix = isAppointment ? 'appointment' : 'communication'
    addArtifact({ ...draft, id: `${idPrefix}-${makeId()}` })
    setSubmitted(true)
    setTimeout(() => {
      document.querySelector('.workflow-success-notice')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  return (
    <div className="form-wrapper">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/patient/chart">← Patient chart</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{heading}</span>
      </nav>

      <div className="form-card">
        <header className="workflow-form-header">
          <h2 className="workflow-form-title">{heading}</h2>
          <p className="workflow-form-subtitle">
            Records {isAppointment ? 'an' : 'a'} <strong>{resourceType}</strong> tagged to the{' '}
            <strong>{stage?.title ?? stageId}</strong> pathway stage. {tool?.purpose}
          </p>
        </header>

        {activePatientId === null && (
          <p className="workflow-form-hint">
            No patient selected — this will be recorded in the scratch chart. Pick a patient from the
            Population view to attach it to a specific record.
          </p>
        )}

        <form className="workflow-form" onSubmit={handleSubmit}>
          <label className="workflow-field">
            <span className="workflow-field-label">{isAppointment ? 'Status' : 'Contact method'}</span>
            <select
              className="workflow-input"
              value={channel}
              onChange={e => setChannel(e.target.value)}
            >
              {(isAppointment ? APPOINTMENT_STATUSES : CHANNELS).map(o => (
                <option key={o.code} value={o.code}>{o.display}</option>
              ))}
            </select>
          </label>

          <label className="workflow-field">
            <span className="workflow-field-label">Date</span>
            <input
              type="date"
              className="workflow-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>

          <label className="workflow-field">
            <span className="workflow-field-label">Summary</span>
            <input
              type="text"
              className="workflow-input"
              placeholder={summaryPlaceholder ?? `e.g. ${capitalize(actionNoun)} — brief summary`}
              value={summary}
              onChange={e => setSummary(e.target.value)}
            />
          </label>

          <label className="workflow-field">
            <span className="workflow-field-label">Notes <span className="workflow-field-optional">(optional)</span></span>
            <textarea
              className="workflow-input workflow-textarea"
              rows={3}
              placeholder={`Brief free-text note about the ${actionNoun}.`}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>

          <button type="submit" className="workflow-submit-btn">Record {actionNoun}</button>
        </form>

        {submitted && (
          <div className="workflow-success-notice">
            {capitalize(actionNoun)} recorded to the patient chart under <strong>{stage?.title ?? stageId}</strong>.{' '}
            <Link to="/patient/chart#activity">View in chart</Link>
          </div>
        )}
      </div>

      <aside className="debug-sidebar">
        <FhirJsonViewer data={draft} title={`Live FHIR ${resourceType}`} defaultOpen />
      </aside>
    </div>
  )
}
