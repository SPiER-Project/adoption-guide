import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildSafetyReferral,
  isReferralOpen,
  referralPerformer,
  setReferralStatus,
  REFERRAL_REASONS,
  REFERRAL_STATUSES,
} from '@spier/core/lib/handoffs'
import { displayFor } from '@spier/core/lib/codedOption'
import type { ServiceRequestResource } from '@spier/core/types/fhir'
import { WorkflowForm, WorkflowField, RecordedList } from './WorkflowForm'
import { isoDay } from '../lib/dates'
import { Button } from '@spier/ui/Button'

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
    <WorkflowForm
      title="Referral / Next Provider Handoff"
      lede={
        <>
          Sends a referral and keeps it on the chart under{' '}
          <strong>Coordinate Handoffs</strong> — open until someone marks it completed or revoked,
          so a referral nobody picked up does not sit there reading as done.
        </>
      }
      fhirNote={
        <>
          Writes a <strong>ServiceRequest</strong> on the <strong>SPiERSafetyReferral</strong>{' '}
          profile. <code>status</code> models <code>draft → active → completed | revoked</code>{' '}
          natively, which is what the readiness checklist scores and what a{' '}
          <strong>Communication</strong> — which only records that something was sent — cannot
          express at all. Advancing a referral upserts the same id rather than filing a second
          resource.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR ServiceRequest"
      notice={notice}
      recorded={
        <>
          {serviceRequests.length > 0 && (
            <RecordedList title={
                <>
                  Referrals on this chart
                              {openReferrals.length > 0 ? ` — ${openReferrals.length} open` : ''}
                </>
              }>
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
                    {referral.authoredOn ? ` · sent ${isoDay(referral.authoredOn)}` : ''}
                    {' · '}
                    {displayFor(REFERRAL_STATUSES, referral.status ?? 'draft')}
                    {open && (
                      <>
                        {' '}
                        <Button size="sm" onClick={() => advance(referral, 'completed')}>
                          Mark completed
                        </Button>{' '}
                        <Button size="sm" onClick={() => advance(referral, 'revoked')}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </li>
                )
              })}
            </RecordedList>
          )}
        </>
      }
    >
      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Reason for referral">
          <select
            className="workflow-input"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            {REFERRAL_REASONS.map(r => (
              <option key={r.code} value={r.code}>{r.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Receiving provider / team">
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. Riverside Behavioral Health"
            value={performer}
            onChange={e => setPerformer(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="What is being requested" optional="optional">
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. Referral to outpatient behavioral health"
            value={serviceText}
            onChange={e => setServiceText(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Status">
          <select
            className="workflow-input"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            {REFERRAL_STATUSES.map(s => (
              <option key={s.code} value={s.code}>{s.display}</option>
            ))}
          </select>
        </WorkflowField>

        <WorkflowField label="Notes" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={3}
            placeholder="Warm-handoff detail, accepting clinician, how contact was confirmed."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">Record referral</Button>
      </form>

    </WorkflowForm>
  )
}
