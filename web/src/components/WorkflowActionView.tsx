import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { TOOLS, stageById } from '../data/catalog'
import { PATHWAY_STAGE_SYSTEM } from '../lib/patientPathway'
import type { CommunicationResource } from '../types/fhir'
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
 * Currently handles `workflowType: 'communication'` (caring contacts, referral
 * outreach). Other workflow types (appointment, measure) can extend the same
 * shape in follow-up work.
 */

// HL7 v3 ParticipationMode codes for how the contact was made.
const CHANNELS = [
  { code: 'PHONE', display: 'Telephone call' },
  { code: 'WRITTEN', display: 'Letter / card' },
  { code: 'SMSWRIT', display: 'Text message' },
  { code: 'EMAILWRIT', display: 'Email' },
] as const
const PARTICIPATION_MODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode'

interface WorkflowActionViewProps {
  /** Catalog Tool id this recorder logs for (e.g. 'TL-010'). */
  toolId: string
  /** Optional page-title override; defaults to the tool name. */
  title?: string
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

export function WorkflowActionView({ toolId, title }: WorkflowActionViewProps) {
  const tool = useMemo(() => TOOLS.find(t => t.id === toolId), [toolId])
  const { addArtifact, activePatientId } = usePatient()

  const stageId = tool?.stageId ?? 'track-follow-up'
  const stage = stageById(stageId)
  const heading = title ?? tool?.name ?? 'Workflow step'

  const [channel, setChannel] = useState<string>(CHANNELS[0].code)
  const [date, setDate] = useState<string>(todayIso())
  const [summary, setSummary] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)

  // Live preview of the FHIR Communication that will be written.
  const draft = useMemo<CommunicationResource>(() => {
    const channelMeta = CHANNELS.find(c => c.code === channel) ?? CHANNELS[0]
    const resource: CommunicationResource = {
      resourceType: 'Communication',
      status: 'completed',
      meta: {
        tag: [{ system: PATHWAY_STAGE_SYSTEM, code: stageId, display: stage?.title }],
      },
      category: [{ text: tool?.shortName ?? tool?.name ?? 'Workflow contact' }],
      reasonCode: [{ text: summary || 'Caring contact' }],
      medium: [{ coding: [{ system: PARTICIPATION_MODE_SYSTEM, code: channelMeta.code, display: channelMeta.display }] }],
      subject: { reference: `Patient/${activePatientId ?? 'unknown'}` },
      sent: `${date}T12:00:00Z`,
    }
    if (note.trim()) resource.payload = [{ contentString: note.trim() }]
    return resource
  }, [channel, date, summary, note, stageId, stage, tool, activePatientId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact({ ...draft, id: `communication-${makeId()}` })
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
            Records a <strong>Communication</strong> tagged to the{' '}
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
            <span className="workflow-field-label">Contact method</span>
            <select
              className="workflow-input"
              value={channel}
              onChange={e => setChannel(e.target.value)}
            >
              {CHANNELS.map(c => (
                <option key={c.code} value={c.code}>{c.display}</option>
              ))}
            </select>
          </label>

          <label className="workflow-field">
            <span className="workflow-field-label">Date of contact</span>
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
              placeholder="e.g. 7-day caring contact: check-in call"
              value={summary}
              onChange={e => setSummary(e.target.value)}
            />
          </label>

          <label className="workflow-field">
            <span className="workflow-field-label">Notes <span className="workflow-field-optional">(optional)</span></span>
            <textarea
              className="workflow-input workflow-textarea"
              rows={3}
              placeholder="Brief free-text note about the contact."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>

          <button type="submit" className="workflow-submit-btn">Record contact</button>
        </form>

        {submitted && (
          <div className="workflow-success-notice">
            Caring contact recorded to the patient chart under <strong>{stage?.title ?? stageId}</strong>.{' '}
            <Link to="/patient/chart#activity">View in chart</Link>
          </div>
        )}
      </div>

      <aside className="debug-sidebar">
        <FhirJsonViewer data={draft} title="Live FHIR Communication" defaultOpen />
      </aside>
    </div>
  )
}
