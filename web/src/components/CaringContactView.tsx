import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '../lib/id'
import {
  buildCaringContact,
  caringContactOptedOut,
  caringContacts,
  displayFor,
  hasOptedOutOfCaringContacts,
  OUTREACH_CHANNELS,
} from '../lib/followUp'
import '../css/WorkflowActionView.css'

/**
 * TL-010 — caring contacts (Stage 6).
 *
 * This replaces the generic `WorkflowActionView` recorder, which emitted an
 * untyped `Communication` with neither the `SPiERCaringContact` profile nor the
 * opt-out extension. Two consequences, both measured:
 *
 *  - `SPiERCaringContactAdherence` matches its numerator on the profile, so
 *    contacts recorded by the generic form were invisible to it.
 *  - Nothing anywhere wrote `caring-contact-opt-out`, so the measure's
 *    `denominator-exclusion` could never fire (issue #211). That is a
 *    correctness problem, not a coverage one: an adherence measure whose
 *    opt-out exclusion is unreachable scores a site *down* for honoring a
 *    patient's request to stop being contacted.
 *
 * So the opt-out checkbox below is the point of this view. A caring contact
 * asks nothing of the patient and has no reached/unreached outcome — the only
 * things worth recording are that it went, by what method, what it said, and
 * whether the patient wants the series to stop.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server and no message is sent.
 */

const DEFAULT_MESSAGE = 'Thinking of you and hoping things are going well. No reply needed.'

function nowLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CaringContactView() {
  const { addArtifact, activePatientId, communications } = usePatient()

  const contacts = useMemo(() => caringContacts(communications), [communications])
  const alreadyOptedOut = useMemo(
    () => hasOptedOutOfCaringContacts(communications),
    [communications],
  )

  const [channel, setChannel] = useState(OUTREACH_CHANNELS[1].code) // Letter / card
  const [sent, setSent] = useState(nowLocal())
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [optOut, setOptOut] = useState(false)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const sentIso = useMemo(() => {
    const t = new Date(sent).getTime()
    return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString()
  }, [sent])

  const params = useMemo(
    () => ({
      patientId: activePatientId,
      sent: sentIso,
      channel,
      message: message.trim() || undefined,
      optOut,
      note: note.trim() || undefined,
    }),
    [activePatientId, sentIso, channel, message, optOut, note],
  )

  const draft = useMemo(
    () => buildCaringContact({ id: 'caring-contact-preview', ...params }),
    [params],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(buildCaringContact({ id: `caring-contact-${makeId()}`, ...params }))
    setNotice(
      optOut
        ? 'Caring contact recorded, and the patient is now opted out of the series.'
        : 'Caring contact recorded.',
    )
    setNote('')
  }

  return (
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Log a Caring Contact"
        lede={
          <>
            Records a <strong>Communication</strong> on the{' '}
            <strong>SPiER Caring Contact</strong> profile, tagged to the{' '}
            <strong>Track Follow-Up</strong> stage. A caring contact asks nothing of the patient, so
            it has no reached/unreached outcome — what it carries instead is the{' '}
            <em>opt-out</em>, which is what stops the schedule.
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

          {alreadyOptedOut && (
            <p className="workflow-form-hint">
              This patient has <strong>opted out</strong> of the caring-contact series. Stopping is the
              correct action — the Stage-8 adherence measure excludes them from its denominator rather
              than scoring the missing contacts as a failure.
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
              <span className="workflow-field-label">Sent at</span>
              <input
                type="datetime-local"
                className="workflow-input"
                value={sent}
                onChange={e => setSent(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Message <span className="workflow-field-optional">(what the patient receives)</span>
              </span>
              <textarea
                className="workflow-input workflow-textarea"
                rows={3}
                placeholder={DEFAULT_MESSAGE}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                <input
                  type="checkbox"
                  checked={optOut}
                  onChange={e => setOptOut(e.target.checked)}
                />{' '}
                The patient has opted out of the caring-contact series
              </span>
              <span className="workflow-field-help">
                Stamps the <code>caring-contact-opt-out</code> extension. This is what excludes the
                patient from the adherence measure&rsquo;s denominator, so honoring the request cannot
                read as a missed contact.
              </span>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Internal note <span className="workflow-field-optional">(optional)</span>
              </span>
              <textarea
                className="workflow-input workflow-textarea"
                rows={2}
                placeholder="Not sent to the patient — e.g. how the opt-out was communicated."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            <button type="submit" className="workflow-submit-btn">Record caring contact</button>
          </form>

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
            </div>
          )}

          {contacts.length > 0 && (
            <>
              <h3 className="workflow-form-title">Caring contacts on this chart</h3>
              <ul>
                {contacts.map((contact, idx) => {
                  const c = contact as { id?: string; sent?: string; medium?: { coding?: { code?: string }[] }[] }
                  const code = c.medium?.[0]?.coding?.[0]?.code ?? ''
                  return (
                    <li key={c.id ?? idx}>
                      {c.sent ? c.sent.slice(0, 10) : 'undated'} ·{' '}
                      {displayFor(OUTREACH_CHANNELS, code)}
                      {caringContactOptedOut(contact) ? ' · OPTED OUT' : ''}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <aside className="debug-sidebar">
          <FhirJsonViewer data={draft} title="Live FHIR Communication (caring contact)" defaultOpen />
        </aside>
      </div>
    </div>
  )
}
