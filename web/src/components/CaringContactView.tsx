import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildCaringContact,
  caringContactOptedOut,
  caringContacts,
  displayFor,
  hasOptedOutOfCaringContacts,
  OUTREACH_CHANNELS,
} from '@spier/core/lib/followUp'
import { WorkflowForm, WorkflowField, WorkflowHint, RecordedList } from './WorkflowForm'
import { nowLocalIso, toIsoOrNow, isoDay } from '../lib/dates'
import { Button } from '@spier/ui/Button'

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

export function CaringContactView() {
  const { addArtifact, activePatientId, communications } = usePatient()

  const contacts = useMemo(() => caringContacts(communications), [communications])
  const alreadyOptedOut = useMemo(
    () => hasOptedOutOfCaringContacts(communications),
    [communications],
  )

  const [channel, setChannel] = useState(OUTREACH_CHANNELS[1].code) // Letter / card
  const [sent, setSent] = useState(nowLocalIso())
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [optOut, setOptOut] = useState(false)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const sentIso = useMemo(() => {
    return toIsoOrNow(sent)
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
    <WorkflowForm
      title="Log a Caring Contact"
      lede={
        <>
          Logs a caring contact under <strong>Track Follow-Up</strong>. A caring contact asks
          nothing of the patient, so there is no reached-or-not outcome to record — the one thing
          that changes what happens next is whether they have asked to stop.
        </>
      }
      fhirNote={
        <>
          Writes a <strong>Communication</strong> on the <strong>SPiERCaringContact</strong>{' '}
          profile. The adherence measure matches its numerator on that profile, and the{' '}
          <code>caring-contact-opt-out</code> extension is what its{' '}
          <code>denominator-exclusion</code> reads — which is why this is not the generic recorder
          (#211).
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Communication (caring contact)"
      notice={notice}
      recorded={
        <>
          {contacts.length > 0 && (
            <RecordedList title="Caring contacts on this chart">
              {contacts.map((contact, idx) => {
                const c = contact as { id?: string; sent?: string; medium?: { coding?: { code?: string }[] }[] }
                const code = c.medium?.[0]?.coding?.[0]?.code ?? ''
                return (
                  <li key={c.id ?? idx}>
                    {c.sent ? isoDay(c.sent) : 'undated'} ·{' '}
                    {displayFor(OUTREACH_CHANNELS, code)}
                    {caringContactOptedOut(contact) ? ' · OPTED OUT' : ''}
                  </li>
                )
              })}
            </RecordedList>
          )}
        </>
      }
    >
      {alreadyOptedOut && (
        <WorkflowHint>
          This patient has <strong>opted out</strong> of the caring-contact series. Stopping is the
          correct action — the adherence report leaves them out rather than counting the contacts
          you did not send against you.
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

        <WorkflowField label="Sent at">
          <input
            type="datetime-local"
            className="workflow-input"
            value={sent}
            onChange={e => setSent(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Message" optional="what the patient receives">
          <textarea
            className="workflow-input workflow-textarea"
            rows={3}
            placeholder={DEFAULT_MESSAGE}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField
          label={
            <>
              <input type="checkbox" checked={optOut} onChange={e => setOptOut(e.target.checked)} />{' '}
              The patient has opted out of the caring-contact series
            </>
          }
          help={
            <>
              Stops the series, and records on the chart that the patient asked for it — so
              honoring the request cannot later read as a run of missed contacts.
            </>
          }
        />

        <WorkflowField label="Internal note" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={2}
            placeholder="Not sent to the patient — e.g. how the opt-out was communicated."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">Record caring contact</Button>
      </form>

    </WorkflowForm>
  )
}
