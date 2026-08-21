import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '@spier/core/lib/id'
import {
  buildSharingConsent,
  consentDecision,
  consentRecipient,
  currentSharingConsent,
  displayFor,
  CONSENT_DECISIONS,
} from '@spier/core/lib/handoffs'
import '../css/WorkflowActionView.css'

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

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function oneYearOut(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SharingConsentView() {
  const { addArtifact, activePatientId, consents } = usePatient()

  const [decision, setDecision] = useState(CONSENT_DECISIONS[0].code)
  const [recipient, setRecipient] = useState('')
  const [date, setDate] = useState(todayIso())
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
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Consent / Information-Sharing Status"
        lede={
          <>
            Records a <strong>Consent</strong> tagged to the{' '}
            <strong>Coordinate Handoffs</strong> stage. A patient declining is a{' '}
            <em>deny provision</em> rather than a separate status, so the EHR can compute what may be
            sent at a handoff instead of guessing.
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

          {current && (
            <p className="workflow-form-hint">
              <strong>Current consent:</strong>{' '}
              {consentDecision(current) === 'deny' ? 'sharing declined' : 'sharing permitted'}
              {consentRecipient(current) ? ` · recipient: ${consentRecipient(current)}` : ''}
              {(current as { dateTime?: string }).dateTime
                ? ` · recorded ${(current as { dateTime?: string }).dateTime!.slice(0, 10)}`
                : ''}
              . Recording a new decision supersedes it.
            </p>
          )}

          <form className="workflow-form" onSubmit={handleSubmit}>
            <label className="workflow-field">
              <span className="workflow-field-label">Decision</span>
              <select
                className="workflow-input"
                value={decision}
                onChange={e => setDecision(e.target.value)}
              >
                {CONSENT_DECISIONS.map(d => (
                  <option key={d.code} value={d.code}>{d.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Recipient (provider, team, or support person)</span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. Riverside Behavioral Health"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Date recorded</span>
              <input
                type="date"
                className="workflow-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Expires <span className="workflow-field-optional">(optional)</span>
              </span>
              <input
                type="date"
                className="workflow-input"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Specifically excluded person{' '}
                <span className="workflow-field-optional">(optional — a nested deny provision)</span>
              </span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. a named support person the patient does not want informed"
                value={deniedActor}
                onChange={e => setDeniedActor(e.target.value)}
              />
            </label>

            <button type="submit" className="workflow-submit-btn">Record consent</button>
          </form>

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
            </div>
          )}

          {consents.length > 1 && (
            <>
              <h3 className="workflow-form-title">Consent history</h3>
              <ul>
                {consents.map((c, idx) => {
                  const consent = c as { id?: string; dateTime?: string }
                  return (
                    <li key={consent.id ?? idx}>
                      {consent.dateTime ? consent.dateTime.slice(0, 10) : 'undated'} ·{' '}
                      {displayFor(CONSENT_DECISIONS, consentDecision(c) ?? 'permit')}
                      {consentRecipient(c) ? ` · ${consentRecipient(c)}` : ''}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <CodeDrawer>
          <FhirJsonViewer data={draft} title="Live FHIR Consent" defaultOpen />
        </CodeDrawer>
      </div>
    </div>
  )
}
