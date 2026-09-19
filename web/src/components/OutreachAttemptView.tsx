import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildOutreachAttempt,
  deriveAppointmentTracking,
  displayFor,
  outreachAttempts,
  outreachOutcome,
  outreachPrompt,
  outreachSafetyConcern,
  unreachedStreak,
  OUTREACH_CHANNELS,
  OUTREACH_OUTCOMES,
  OUTREACH_PROMPTS,
} from '@spier/core/lib/followUp'
import { WorkflowForm, WorkflowField, WorkflowHint, RecordedList } from './WorkflowForm'
import { nowLocalIso, toIsoOrNow } from '../lib/dates'
import { Button } from '@spier/ui/Button'

/**
 * TL-033 (routine follow-up outreach) + TL-035 (missed-appointment / no-show
 * follow-up) — Stage 6.
 *
 * One recorder for both tools because they are the SAME artifact: a no-show
 * follow-up *is* an outreach attempt, and the only difference is what prompted
 * it, which the `outreach-prompt` extension records.
 *
 * Two design points are visible in the form:
 *  - **Outcome is required.** `Communication.status` says a message was sent,
 *    never whether anyone answered, so the outcome rides as a 1..1 extension.
 *    An attempt with no recorded outcome is not useful data.
 *  - **"Safety concern identified" is its own axis**, not an outcome code. A
 *    concern can surface on a successfully reached call, and "unable to reach"
 *    can itself be the concern — folding them together would lose information.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server and no contact is made.
 */

export function OutreachAttemptView() {
  const { addArtifact, activePatientId, communications, appointments } = usePatient()

  const attempts = useMemo(() => outreachAttempts(communications), [communications])
  const streak = useMemo(() => unreachedStreak(communications), [communications])
  const tracking = useMemo(() => deriveAppointmentTracking(appointments), [appointments])

  const [channel, setChannel] = useState(OUTREACH_CHANNELS[0].code)
  const [sent, setSent] = useState(nowLocalIso())
  const [outcome, setOutcome] = useState(OUTREACH_OUTCOMES[0].code)
  // Default the prompt to the no-show case when the last visit was missed —
  // that is the situation the clinician is most likely acting on.
  const [prompt, setPrompt] = useState(
    tracking.awaitingNoShowFollowUp ? 'no-show' : OUTREACH_PROMPTS[0].code,
  )
  const [safetyConcern, setSafetyConcern] = useState(false)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const sentIso = useMemo(() => {
    return toIsoOrNow(sent)
  }, [sent])

  const draft = useMemo(
    () =>
      buildOutreachAttempt({
        id: 'outreach-preview',
        patientId: activePatientId,
        sent: sentIso,
        channel,
        outcome,
        prompt,
        safetyConcern,
        note: note.trim() || undefined,
      }),
    [activePatientId, sentIso, channel, outcome, prompt, safetyConcern, note],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(
      buildOutreachAttempt({
        id: `outreach-${makeId()}`,
        patientId: activePatientId,
        sent: sentIso,
        channel,
        outcome,
        prompt,
        safetyConcern,
        note: note.trim() || undefined,
      }),
    )
    setNotice('Outreach attempt recorded.')
    setNote('')
    setSafetyConcern(false)
  }

  return (
    <WorkflowForm
      title="Follow-Up Outreach / Contact Attempt"
      lede={
        <>
          Logs a contact attempt under <strong>Track Follow-Up</strong> — routine outreach or
          following up a visit the patient missed. The <em>prompt</em> says which, and the{' '}
          <em>outcome</em> says whether you actually reached them.
        </>
      }
      fhirNote={
        <>
          Writes a <strong>Communication</strong>. The outcome rides as a <strong>1..1</strong>{' '}
          extension rather than in <code>status</code>, which only ever says a message was sent —
          an attempt with no recorded outcome is not useful data. <code>outreach-prompt</code>{' '}
          distinguishes routine outreach from no-show follow-up, and the safety concern is its own
          axis rather than an outcome code, because a concern can surface on a call that reached
          the patient.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Communication (outreach attempt)"
      notice={notice}
      recorded={
        <>
          {attempts.length > 0 && (
            <RecordedList title="Outreach attempts on this chart">
              {attempts.map((attempt, idx) => {
                const when = (attempt as { sent?: string }).sent
                const attemptPrompt = outreachPrompt(attempt)
                return (
                  <li key={attempt.id ?? idx}>
                    {when ? when.slice(0, 16).replace('T', ' ') : 'undated'} ·{' '}
                    {displayFor(OUTREACH_OUTCOMES, outreachOutcome(attempt) ?? '')}
                    {attemptPrompt ? ` · ${displayFor(OUTREACH_PROMPTS, attemptPrompt)}` : ''}
                    {outreachSafetyConcern(attempt) ? ' · SAFETY CONCERN' : ''}
                  </li>
                )
              })}
            </RecordedList>
          )}
        </>
      }
    >
      {tracking.awaitingNoShowFollowUp && (
        <WorkflowHint>
          The patient&rsquo;s most recent appointment was a <strong>no-show</strong> — the prompt
          below is pre-set accordingly.
        </WorkflowHint>
      )}

      {streak >= 2 && (
        <WorkflowHint>
          <strong>{streak} consecutive attempts</strong> without reaching the patient. That is the{' '}
          <em>failed contact sequence</em> escalation trigger —{' '}
          <Link to="/patient/workflow/safety-tasks">escalate this case</Link> so it lands in the
          same work queue as registry escalations.
        </WorkflowHint>
      )}

      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Contact method">
          <select
            className="workflow-input"
            value={channel}
            onChange={e => setChannel(e.target.value)}
          >
            {OUTREACH_CHANNELS.map(c => (
              <option key={c.code} value={c.code}>{c.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Attempted at">
          <input
            type="datetime-local"
            className="workflow-input"
            value={sent}
            onChange={e => setSent(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="What prompted this attempt?">
          <select
            className="workflow-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          >
            {OUTREACH_PROMPTS.map(p => (
              <option key={p.code} value={p.code}>{p.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Outcome">
          <select
            className="workflow-input"
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
          >
            {OUTREACH_OUTCOMES.map(o => (
              <option key={o.code} value={o.code}>{o.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField
          label={
            <>
              <input type="checkbox" checked={safetyConcern} onChange={e => setSafetyConcern(e.target.checked)} />{' '}
              A new safety concern was identified
            </>
          }
        />

        <WorkflowField label="Notes" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={3}
            placeholder="What was said, what was arranged, what to try next."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">Record attempt</Button>
      </form>

    </WorkflowForm>
  )
}
