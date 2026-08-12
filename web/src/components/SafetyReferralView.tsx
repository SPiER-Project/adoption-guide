import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '../lib/id'
import {
  buildSafetyReferral,
  displayFor,
  isReferralOpen,
  referralPerformer,
  setReferralStatus,
  REFERRAL_REASONS,
  REFERRAL_STATUSES,
} from '../lib/handoffs'
import type { ServiceRequestResource } from '../types/fhir'
import '../css/WorkflowActionView.css'

/**
 * TL-017 — referral / next-provider handoff (Stage 5).
 *
 * This recorder replaces the generic Communication one that used to serve this
 * route. The SSC scores TL-017 on whether the EHR can track a referral past
 * "sent" through to **accepted or completed** — `ServiceRequest.status` models
 * `draft → active → completed | revoked` natively, and a Communication, which
 * only records that something was sent, cannot answer that question at all.
 *
 * So the status control below isn't decoration: advancing a referral in place
 * (same id, upserted by the store) IS the capability being demonstrated.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server.
 */

function nowIso(): string {
  return new Date().toISOString()
}

export function SafetyReferralView() {
  const { addArtifact, activePatientId, serviceRequests } = usePatient()

  const [reason, setReason] = useState(REFERRAL_REASONS[0].code)
  const [performer, setPerformer] = useState('')
  const [serviceText, setServiceText] = useState('')
  // A new referral starts `active`: in this demo the act of recording it IS
  // sending it. `draft` stays available for a referral being prepared.
  const [status, setStatus] = useState('active')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const openReferrals = useMemo(() => serviceRequests.filter(isReferralOpen), [serviceRequests])

  const draft = useMemo(
    () =>
      buildSafetyReferral({
        id: 'referral-preview',
        patientId: activePatientId,
        status,
        reason,
        performer,
        authoredOn: nowIso(),
        serviceText,
        note: note.trim() || undefined,
      }),
    [activePatientId, status, reason, performer, serviceText, note],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(
      buildSafetyReferral({
        id: `referral-${makeId()}`,
        patientId: activePatientId,
        status,
        reason,
        performer,
        authoredOn: nowIso(),
        serviceText,
        note: note.trim() || undefined,
      }),
    )
    setNotice('Referral recorded.')
    setNote('')
  }

  function advance(referral: ServiceRequestResource, next: string) {
    // Same id ⇒ the store upserts, so the referral moves through its lifecycle
    // instead of leaving a stale "sent" copy behind it.
    addArtifact(setReferralStatus(referral, next))
    setNotice(`Referral marked ${displayFor(REFERRAL_STATUSES, next).toLowerCase()}.`)
  }

  return (
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Referral / Next Provider Handoff"
        lede={
          <>
            Records a <strong>ServiceRequest</strong> tagged to the{' '}
            <strong>Coordinate Handoffs</strong> stage — trackable past <em>sent</em> through to
            accepted and completed, which is what the readiness checklist scores and what a
            Communication cannot express.
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

          <form className="workflow-form" onSubmit={handleSubmit}>
            <label className="workflow-field">
              <span className="workflow-field-label">Reason for referral</span>
              <select
                className="workflow-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
              >
                {REFERRAL_REASONS.map(r => (
                  <option key={r.code} value={r.code}>{r.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Receiving provider / team</span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. Riverside Behavioral Health"
                value={performer}
                onChange={e => setPerformer(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                What is being requested{' '}
                <span className="workflow-field-optional">(optional)</span>
              </span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. Referral to outpatient behavioral health"
                value={serviceText}
                onChange={e => setServiceText(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Status</span>
              <select
                className="workflow-input"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {REFERRAL_STATUSES.map(s => (
                  <option key={s.code} value={s.code}>{s.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Notes <span className="workflow-field-optional">(optional)</span>
              </span>
              <textarea
                className="workflow-input workflow-textarea"
                rows={3}
                placeholder="Warm-handoff detail, accepting clinician, how contact was confirmed."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            <button type="submit" className="workflow-submit-btn">Record referral</button>
          </form>

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
            </div>
          )}

          {serviceRequests.length > 0 && (
            <>
              <h3 className="workflow-form-title">
                Referrals on this chart
                {openReferrals.length > 0 ? ` — ${openReferrals.length} open` : ''}
              </h3>
              <ul>
                {serviceRequests.map((raw, idx) => {
                  const referral = raw as ServiceRequestResource & {
                    status?: string
                    authoredOn?: string
                    code?: { text?: string }
                  }
                  const open = isReferralOpen(referral)
                  return (
                    <li key={referral.id ?? idx}>
                      {referral.code?.text ?? 'Suicide-safety referral'}
                      {referralPerformer(referral) ? ` → ${referralPerformer(referral)}` : ''}
                      {referral.authoredOn ? ` · sent ${referral.authoredOn.slice(0, 10)}` : ''}
                      {' · '}
                      {displayFor(REFERRAL_STATUSES, referral.status ?? 'draft')}
                      {open && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="workflow-submit-btn"
                            onClick={() => advance(referral, 'completed')}
                          >
                            Mark completed
                          </button>{' '}
                          <button
                            type="button"
                            className="workflow-submit-btn"
                            onClick={() => advance(referral, 'revoked')}
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <aside className="debug-sidebar">
          <FhirJsonViewer data={draft} title="Live FHIR ServiceRequest" defaultOpen />
        </aside>
      </div>
    </div>
  )
}
