import { useMemo, useState } from 'react'
import { toggleCode } from '../lib/toggleCode'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildSafetyHandoff,
  handoffContentCodes,
  safetyHandoffs,
  HANDOFF_CHANNELS,
  HANDOFF_CONTENT_ITEMS,
} from '@spier/core/lib/handoffs'
import { WorkflowForm, WorkflowField, WorkflowHint, RecordedList } from './WorkflowForm'
import { nowLocalIso, toIsoOrNow, isoDay } from '../lib/dates'
import { Button } from '@spier/ui/Button'

/**
 * TL-009 — the suicide-safety handoff / transition checkpoint (Stage 5).
 *
 * This replaces the generic `WorkflowActionView`, and the reason is the same
 * one that took `caring-contact` off it (#211) — with one extra turn of the
 * screw. The generic recorder emitted an untyped Communication with no
 * `meta.profile` and a `category` carrying text and no coding, so its output
 * satisfied neither `SPiERSafetyHandoff` nor the `category:suicideRisk` slice.
 *
 * ⚠️ **What made this one worse than a missing numerator.** The handoff is one
 * of the two resources that supply `transitionDates` — the INDEX EVENT for
 * every post-transition measure (`measure-and-share.fsh` says so in those
 * words). The other is the TL-030 discharge packet, which *does* claim its
 * profile. So the measure family never went to zero: it stayed computable for
 * any patient who also had a packet, and silently skipped every patient whose
 * transition was recorded here. Three demo scenarios carry a hand-authored
 * handoff with the profile on it, so the dashboard looked healthy the whole
 * time. Half-blind is harder to see than blind.
 *
 * So the checklist below is the point of this view, not decoration. The SSC's
 * Stage-5 question is "what suicide-safety context travelled with the patient",
 * and the shared TL-009/TL-030 content vocabulary is what turns that from prose
 * into a query — it is the same vocabulary the discharge packet uses, so the
 * two tools' answers are comparable.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server and no message is sent.
 */

/** The SSC's expected minimum for a transfer of care. */
const DEFAULT_CONTENT = [
  'current-risk-status',
  'safety-plan-status',
  'follow-up-plan',
  'next-provider',
]

export function SafetyHandoffView() {
  const { addArtifact, activePatientId, communications } = usePatient()

  const handoffs = useMemo(() => safetyHandoffs(communications), [communications])

  const [channel, setChannel] = useState(HANDOFF_CHANNELS[0].code)
  const [sent, setSent] = useState(nowLocalIso())
  const [recipient, setRecipient] = useState('')
  const [contentCodes, setContentCodes] = useState<string[]>(DEFAULT_CONTENT)
  const [summary, setSummary] = useState('')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const params = useMemo(
    () => ({
      patientId: activePatientId,
      sent: toIsoOrNow(sent),
      channel,
      contentCodes,
      recipient: recipient.trim() || undefined,
      summary: summary.trim() || undefined,
      note: note.trim() || undefined,
    }),
    [activePatientId, sent, channel, contentCodes, recipient, summary, note],
  )

  const draft = useMemo(
    () => buildSafetyHandoff({ id: 'safety-handoff-preview', ...params }),
    [params],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(buildSafetyHandoff({ id: `safety-handoff-${makeId()}`, ...params }))
    setNotice('Handoff recorded. It is now the index transition for the follow-up measures.')
    setNote('')
  }

  return (
    <WorkflowForm
      title="Record a Suicide-Safety Handoff"
      lede={
        <>
          Records the transfer of care under <strong>Coordinate Handoffs</strong> — who the
          patient was handed to, when, and what safety context went with them. This is the
          moment the <em>follow-up clock</em> starts, so what you tick here is what anyone
          reviewing the care later can see actually travelled.
        </>
      }
      fhirNote={
        <>
          Writes a <strong>Communication</strong> on the <strong>SPiERSafetyHandoff</strong>{' '}
          profile, with each checklist item as a repeating{' '}
          <code>handoff-content-item</code> extension — the same vocabulary the discharge
          packet uses, so the two tools&rsquo; answers are comparable. This profile and{' '}
          <strong>SPiERDischargeSafetyPacket</strong> are the two resources{' '}
          <code>transitionDates</code> counts, which makes it the index event for every
          post-transition measure. Until 2026-09-17 the route rendered the generic recorder,
          which stamped no profile, so the measure counted none of it. The receiving team is a{' '}
          <code>Reference.display</code> with no <code>reference</code>: the demo holds no
          Organization to point at, and asserting one would be a dangling reference rather than
          a missing optional.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Communication (safety handoff)"
      notice={notice}
      recorded={
        handoffs.length > 0 ? (
          <RecordedList title="Handoffs on this chart">
            {handoffs.map((handoff, idx) => {
              const h = handoff as { id?: string; sent?: string; recipient?: { display?: string }[] }
              const codes = handoffContentCodes(handoff)
              return (
                <li key={h.id ?? idx}>
                  {h.sent ? isoDay(h.sent) : 'undated'}
                  {h.recipient?.[0]?.display ? ` · to ${h.recipient[0].display}` : ''} ·{' '}
                  {codes.length} item{codes.length === 1 ? '' : 's'}
                </li>
              )
            })}
          </RecordedList>
        ) : undefined
      }
    >
      {contentCodes.length === 0 && (
        <WorkflowHint>
          A handoff carrying <strong>no</strong> recorded content is still a valid
          transition and still starts the follow-up clock — but nothing downstream can
          show what the receiving team was told. Record at least the current risk status.
        </WorkflowHint>
      )}

      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="How the handoff was made">
          <select
            className="workflow-input"
            value={channel}
            onChange={e => setChannel(e.target.value)}
          >
            {HANDOFF_CHANNELS.map(c => (
              <option key={c.code} value={c.code}>{c.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Handed off at">
          <input
            type="datetime-local"
            className="workflow-input"
            value={sent}
            onChange={e => setSent(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField
          label="Receiving provider or team"
          optional="optional"
          help="Recorded by name. This demo holds no directory to look a team up in, so the name is stored as you type it."
        >
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. Riverside BH — accepting clinician confirmed"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
          />
        </WorkflowField>

        <fieldset className="workflow-field">
          <legend className="workflow-field-label">
            What travelled with the patient?{' '}
            <span className="workflow-field-optional">(several may apply)</span>
          </legend>
          {HANDOFF_CONTENT_ITEMS.map(item => (
            <label key={item.code}>
              <input
                type="checkbox"
                checked={contentCodes.includes(item.code)}
                onChange={() => setContentCodes(prev => toggleCode(prev, item.code))}
              />{' '}
              {item.display}
            </label>
          ))}
        </fieldset>

        <WorkflowField label="Summary" optional="optional">
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. Pre-discharge transfer of care — accepting provider confirmed"
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Internal note" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={2}
            placeholder="Not part of the handoff itself — e.g. who confirmed the receiving clinician."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">
          Record handoff
          {contentCodes.length > 0
            ? ` (${contentCodes.length} item${contentCodes.length === 1 ? '' : 's'})`
            : ''}
        </Button>
      </form>
    </WorkflowForm>
  )
}
