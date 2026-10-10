/**
 * The chart's error banner: a read or a save against the EHR that failed, in a
 * clinician's words.
 *
 * ⚠️ **It words the failure's `kind` and never prints its `detail`.** Until
 * 2026-10-07 the care pathway and *What's on file* rendered `dataSourceError`
 * verbatim, and that string was whatever core threw — "Writeback failed — no
 * resource was created. QuestionnaireResponse: Failed to create
 * QuestionnaireResponse — HTTP 422: …", or fhirclient's status line with the
 * server's OperationOutcome appended. `check:jargon` reads this app's string
 * literals and could not see it, because the message is assembled at runtime in
 * core. `DataSourceErrorNotice.test.tsx` renders this from core's real errors.
 *
 * ⚠️ **The detail is not behind `useInspect()` here, on purpose.** Inspection is
 * never on in this app, so a gated branch would be dead code — the scorecard's
 * first attempt at the same fix made exactly that mistake
 * (`WritebackScorecard.tsx`). The detail stays on the context value.
 */
import type { DataSourceFailure, DataSourceFailureKind } from '@spier/core/lib/dataSource/failure'
import { Notice } from '@spier/ui/Notice'

/** One entry per kind; `Record` makes a new kind a compile error until worded. */
const COPY: Record<DataSourceFailureKind, { title: string; body: string }> = {
  'nothing-saved': {
    title: 'Not saved to the EHR.',
    body: 'Nothing from the form you just completed reached this patient’s chart. Try saving it again.',
  },
  'save-failed': {
    title: 'Not saved to the EHR.',
    body: 'What you just recorded may not all be on this patient’s chart. Check the chart before relying on it, then try again.',
  },
  'not-loaded': {
    title: 'Could not load this chart from the EHR.',
    body: 'What is shown here may be incomplete or out of date. Reload the page to try again.',
  },
  'not-authorized': {
    title: 'The EHR refused access.',
    body: 'This app is not allowed to read or save this patient’s records. Open it again from the patient’s chart in the EHR; if that does not help, its access has to be granted at your site.',
  },
  'no-patient': {
    title: 'No patient is open.',
    body: 'The app was opened without a patient. Open it from a patient’s chart in the EHR.',
  },
}

export function DataSourceErrorNotice({ error }: { error: DataSourceFailure | null }) {
  if (!error) return null
  const { title, body } = COPY[error.kind]
  return (
    <Notice tone="danger" title={title}>
      {body}
    </Notice>
  )
}
