import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildSharingConsent,
  consentDecision,
  consentRecipient,
  currentSharingConsent,
  CONSENT_DECISIONS,
} from '@spier/core/lib/handoffs'
import { displayFor } from '@spier/core/lib/codedOption'
import { WorkflowForm, WorkflowField, WorkflowHint, RecordedList } from './WorkflowForm'
import { todayLocalIso, isoDay } from '../lib/dates'
import { Button } from '@spier/ui/Button'

/**
 * TL-032 — information-sharing consent / sharing status (Stage 5).
 *
 * Modelled with native Consent structures rather than SPiER-local codes, so any
 * consent engine can compute what to send or withhold at a handoff:
 * `provision.type` permit/deny is the decision, `provision.actor` the recipient,
 * `provision.period` the expiry.
 *
 * Note what the form does NOT have: a "patient declined" status. Declining is a
 * **deny provision**, not a separate state — and the nested deny below expresses
 * the harder real case, "share with the clinic, but not with this named support
 * person".
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server. This records a consent
 * decision; it does not enforce it.
 */

function oneYearOut(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SharingConsentView() {
  const { addArtifact, activePatientId, consents } = usePatient()

  const [decision, setDecision] = useState(CONSENT_DECISIONS[0].code)
  const [recipient, setRecipient] = useState('')
  const [date, setDate] = useState(todayLocalIso())
  const [expiry, setExpiry] = useState(oneYearOut())
  const [deniedActor, setDeniedActor] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const current = useMemo(() => currentSharingConsent(consents), [consents])

  const draft = useMemo(
    () =>
      buildSharingConsent({
        id: 'consent-preview',
        patientId: activePatientId,
        dateTime: `${date}T12:00:00Z`,
        decision,
        recipient,
        expiry: expiry || undefined,
        deniedActor: deniedActor.trim() || undefined,
      }),
    [activePatientId, date, decision, recipient, expiry, deniedActor],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(
      buildSharingConsent({
        id: `consent-${makeId()}`,
        patientId: activePatientId,
        dateTime: `${date}T12:00:00Z`,
        decision,
        recipient,
        expiry: expiry || undefined,
        deniedActor: deniedActor.trim() || undefined,
      }),
    )
    setNotice('Information-sharing consent recorded.')
  }

  return (
    <WorkflowForm
      title="Consent / Information-Sharing Status"
      lede={
        <>
          Records what the patient has agreed may be shared, under{' '}
          <strong>Coordinate Handoffs</strong>. Declining is recorded as a decision about a named
          recipient rather than a blanket flag, which is what lets a handoff work out what it may
          carry instead of guessing.
        </>
      }
      fhirNote={
        <>
          Writes a <strong>Consent</strong> with native structures rather than SPiER-local codes,
          so any consent engine can compute a handoff: <code>provision.type</code> permit/deny is
          the decision, <code>provision.actor</code> the recipient, <code>provision.period</code>{' '}
          the expiry. There is deliberately no &ldquo;patient declined&rdquo; status — declining is
          a deny provision, and the nested one expresses the harder real case, &ldquo;share with
          the clinic, but not with this named support person&rdquo;.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Consent"
      notice={notice}
      recorded={
        <>
          {consents.length > 1 && (
            <RecordedList title="Consent history">
              {consents.map((c, idx) => {
                const consent = c as { id?: string; dateTime?: string }
                return (
                  <li key={consent.id ?? idx}>
                    {consent.dateTime ? isoDay(consent.dateTime) : 'undated'} ·{' '}
                    {displayFor(CONSENT_DECISIONS, consentDecision(c) ?? 'permit')}
                    {consentRecipient(c) ? ` · ${consentRecipient(c)}` : ''}
                  </li>
                )
              })}
            </RecordedList>
          )}
        </>
      }
    >
      {current && (() => {
        const { dateTime } = current as { dateTime?: string }
        return (
          <WorkflowHint>
            <strong>Current consent:</strong>{' '}
            {consentDecision(current) === 'deny' ? 'sharing declined' : 'sharing permitted'}
            {consentRecipient(current) ? ` · recipient: ${consentRecipient(current)}` : ''}
            {dateTime ? ` · recorded ${isoDay(dateTime)}` : ''}
            . Recording a new decision supersedes it.
          </WorkflowHint>
        )
      })()}

      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Decision">
          <select
            className="workflow-input"
            value={decision}
            onChange={e => setDecision(e.target.value)}
          >
            {CONSENT_DECISIONS.map(d => (
              <option key={d.code} value={d.code}>{d.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Recipient (provider, team, or support person)">
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. Riverside Behavioral Health"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Date recorded">
          <input
            type="date"
            className="workflow-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Expires" optional="optional">
          <input
            type="date"
            className="workflow-input"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Specifically excluded person" optional="optional — someone the patient does not want told">
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. a named support person the patient does not want informed"
            value={deniedActor}
            onChange={e => setDeniedActor(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">Record consent</Button>
      </form>

    </WorkflowForm>
  )
}
