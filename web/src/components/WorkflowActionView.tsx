import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { TOOLS, stageById } from '@spier/core/data/catalog'
import { PATHWAY_STAGE_SYSTEM } from '@spier/core/lib/patientPathway'
import { makeId } from '@spier/core/lib/id'
import type { CommunicationResource } from '@spier/core/types/fhir'
import { WorkflowForm, WorkflowField } from './WorkflowForm'
import { todayLocalIso } from '../lib/dates'
import { Button } from './Button'

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
  /**
   * Lower-case noun for the thing being recorded ('caring contact', 'referral',
   * …). Drives the default summary, placeholder copy, and success message.
   * Defaults to 'contact'.
   */
  actionNoun?: string
  /** Optional override for the Summary field placeholder. */
  summaryPlaceholder?: string
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
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

  const [channel, setChannel] = useState<string>(CHANNELS[0].code)
  const [date, setDate] = useState<string>(todayLocalIso())
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
      reasonCode: [{ text: summary.trim() || capitalize(actionNoun) }],
      medium: [{ coding: [{ system: PARTICIPATION_MODE_SYSTEM, code: channelMeta.code, display: channelMeta.display }] }],
      subject: { reference: `Patient/${activePatientId ?? 'unknown'}` },
      sent: `${date}T12:00:00Z`,
    }
    if (note.trim()) resource.payload = [{ contentString: note.trim() }]
    return resource
  }, [channel, date, summary, note, stageId, stage, tool, activePatientId, actionNoun])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact({ ...draft, id: `communication-${makeId()}` })
    setSubmitted(true)
  }

  return (
    <WorkflowForm
      title={heading}
      lede={
        <>
          Logs this step on the patient&rsquo;s chart under{' '}
          <strong>{stage?.title ?? stageId}</strong>. {tool?.purpose}
        </>
      }
      fhirNote={
        <>
          Writes a <strong>Communication</strong> tagged against the SPiER pathway-stage
          CodeSystem with <code>{stageId}</code>, so <code>stageForArtifact</code> groups it under
          that stage and the pathway advances. The contact method is an HL7 v3 ParticipationMode
          code on <code>medium</code>.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Communication"
      notice={submitted ? <>{capitalize(actionNoun)} recorded to the patient chart under <strong>{stage?.title ?? stageId}</strong>.</> : undefined}
    >
      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Contact method">
          <select
            className="workflow-input"
            value={channel}
            onChange={e => setChannel(e.target.value)}
          >
            {CHANNELS.map(c => (
              <option key={c.code} value={c.code}>{c.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Date of contact">
          <input
            type="date"
            className="workflow-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Summary">
          <input
            type="text"
            className="workflow-input"
            placeholder={summaryPlaceholder ?? `e.g. ${capitalize(actionNoun)} — brief summary`}
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Notes" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={3}
            placeholder={`Brief free-text note about the ${actionNoun}.`}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">Record {actionNoun}</Button>
      </form>
    </WorkflowForm>
  )
}
