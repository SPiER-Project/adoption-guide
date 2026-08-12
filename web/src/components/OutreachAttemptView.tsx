import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '../lib/id'
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
} from '../lib/followUp'
import '../css/WorkflowActionView.css'

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

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function OutreachAttemptView() {
  const { addArtifact, activePatientId, communications, appointments } = usePatient()

  const attempts = useMemo(() => outreachAttempts(communications), [communications])
  const streak = useMemo(() => unreachedStreak(communications), [communications])
  const tracking = useMemo(() => deriveAppointmentTracking(appointments), [appointments])

  const [channel, setChannel] = useState(OUTREACH_CHANNELS[0].code)
  const [sent, setSent] = useState(nowLocal())
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
    const ms = new Date(sent).getTime()
    return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString()
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
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Follow-Up Outreach / Contact Attempt"
        lede={
          <>
            Records a <strong>Communication</strong> tagged to the{' '}
            <strong>Track Follow-Up</strong> stage. One shape serves routine outreach and no-show
            follow-up; the <em>prompt</em> says which, and the <em>outcome</em> says whether anyone
            was actually reached.
          </>
        }
      />

      <div className="form-wrapper">
        <div className="form-card">
          {activePatientId === null && (
            <p className="workflow-form-hint">
              No patient selected — this will be recorded in the scratch chart. Pick a patient from the
              Population view to attach it to a specific record.
            </p>
          )}

          {tracking.awaitingNoShowFollowUp && (
            <p className="workflow-form-hint">
              The patient&rsquo;s most recent appointment was a <strong>no-show</strong> — the prompt
              below is pre-set accordingly.
            </p>
          )}

          {streak >= 2 && (
            <p className="workflow-form-hint">
              <strong>{streak} consecutive attempts</strong> without reaching the patient. That is the{' '}
              <em>failed contact sequence</em> escalation trigger —{' '}
              <Link to="/patient/workflow/safety-tasks">escalate this case</Link> so it lands in the
              same work queue as registry escalations.
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
                {OUTREACH_CHANNELS.map(c => (
                  <option key={c.code} value={c.code}>{c.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Attempted at</span>
              <input
                type="datetime-local"
                className="workflow-input"
                value={sent}
                onChange={e => setSent(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">What prompted this attempt?</span>
              <select
                className="workflow-input"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              >
                {OUTREACH_PROMPTS.map(p => (
                  <option key={p.code} value={p.code}>{p.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Outcome</span>
              <select
                className="workflow-input"
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
              >
                {OUTREACH_OUTCOMES.map(o => (
                  <option key={o.code} value={o.code}>{o.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                <input
                  type="checkbox"
                  checked={safetyConcern}
                  onChange={e => setSafetyConcern(e.target.checked)}
                />{' '}
                A new safety concern was identified
              </span>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Notes <span className="workflow-field-optional">(optional)</span>
              </span>
              <textarea
                className="workflow-input workflow-textarea"
                rows={3}
                placeholder="What was said, what was arranged, what to try next."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            <button type="submit" className="workflow-submit-btn">Record attempt</button>
          </form>

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
            </div>
          )}

          {attempts.length > 0 && (
            <>
              <h3 className="workflow-form-title">Outreach attempts on this chart</h3>
              <ul>
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
              </ul>
            </>
          )}
        </div>

        <aside className="debug-sidebar">
          <FhirJsonViewer data={draft} title="Live FHIR Communication (outreach attempt)" defaultOpen />
        </aside>
      </div>
    </div>
  )
}
