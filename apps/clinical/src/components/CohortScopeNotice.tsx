import { Link } from 'react-router-dom'
import { Notice } from '@spier/ui/Notice'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import type { RegistryScope } from '../hooks/useRegistrySlices'

/**
 * What a session that cannot serve a caseload says instead of rendering one.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * A chart launch is bound to one patient, so the caseload and the measures had
 * a scope notice each saying so — and then rendered the whole screen anyway.
 * Measured on a live chart launch (clinical-app audit §8.7): the caseload said
 * *"Showing the patient in context only"* above **zero** rows, every tile read
 * zero, and the alerts panel said, in bold, *"No measure group reports a
 * failure for any patient in this period. That is a real result, not an empty
 * state"* — for a patient whose chart owed an assessment. The measures page was
 * LONGER in that session than in a working one: 937 words against 503, because
 * eight measures with an empty denominator each render a paragraph explaining
 * why, and none of those paragraphs is about the actual reason.
 *
 * ⚠️ **So the rule is: do not render a cohort screen for a session with no
 * cohort.** One line saying which session this is, one way on. A census of
 * one is not a census, and a zero is not a result.
 */
export function CohortScopeNotice({ scope }: { scope: RegistryScope }) {
  const { patientDisplay } = usePatient()

  if (scope === 'no-source') {
    return (
      <Notice tone="warning">
        <strong>No records to read.</strong> This window was not opened from an EHR, so
        there is no panel of patients to show. Open SPiER from your EHR.
      </Notice>
    )
  }

  return (
    <Notice tone="warning">
      <strong>This session is one patient&rsquo;s chart.</strong> It can read{' '}
      {patientDisplay?.fullName ?? 'the patient it was opened for'} and nobody else, and this
      page is about the whole panel. Open SPiER from your worklist rather than from a chart to
      see it.{' '}
      <Link to="/patient/record">Open this patient&rsquo;s chart &rarr;</Link>
    </Notice>
  )
}
