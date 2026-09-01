import { mapCSSRSScreenerCore, type CSSRSItemCoding } from './cssrsScreener'
import type { MapperResult, QuestionnaireResponseResource } from './shared'

/** SPiER-local CodeSystem — see ig/input/fsh/cssrs.fsh (CSSRSIntervalItemCodes). */
const INTERVAL_ITEM_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/cssrs-interval-item'

/**
 * Per-item codes for the interval-scoped administration.
 *
 * LOINC codes every C-SSRS item per *timeframe* — Lifetime, 1 month for ideation,
 * 3 months for behaviour — and publishes nothing for "since the patient's last
 * visit or contact", which is precisely this administration's reference period.
 * This mapper previously reused the screener's 1-month LOINC codes, which resolve
 * and so drew no complaint from any gate, but asserted a past-month window the
 * instrument does not claim. Issue #220.
 *
 * Displays match the CodeSystem's exactly, which the default `-tx n/a` validator
 * gate does enforce for SPiER-local systems.
 */
const INTERVAL_ITEM_CODES: CSSRSItemCoding[] = [
  { linkId: 'q1', system: INTERVAL_ITEM_SYSTEM, code: 'wish-to-be-dead', display: 'Wish to be dead (since last contact)' },
  { linkId: 'q2', system: INTERVAL_ITEM_SYSTEM, code: 'non-specific-active-thoughts', display: 'Non-specific active suicidal thoughts (since last contact)' },
  { linkId: 'q3', system: INTERVAL_ITEM_SYSTEM, code: 'active-ideation-any-methods', display: 'Active suicidal ideation with any methods, without intent to act (since last contact)' },
  { linkId: 'q4', system: INTERVAL_ITEM_SYSTEM, code: 'active-ideation-some-intent', display: 'Active suicidal ideation with some intent to act, without specific plan (since last contact)' },
  { linkId: 'q5', system: INTERVAL_ITEM_SYSTEM, code: 'active-ideation-plan-and-intent', display: 'Active suicidal ideation with specific plan and intent (since last contact)' },
  { linkId: 'q6', system: INTERVAL_ITEM_SYSTEM, code: 'suicidal-behavior', display: 'Suicidal behavior (since last contact)' },
]

/**
 * C-SSRS Since Last Visit / Since Last Contact (TL-019) — a repeat assessment
 * scoped to the interval since the patient's prior contact. It shares the
 * screener's item set, conditional logic, and three-tier risk stratification, so
 * it delegates to the shared screener core; the item coding, the tool label and
 * the behavior item's recency semantics differ. Emits the shared
 * SPiERCSSRSRiskLevel-shaped risk Observation, which is timeframe-agnostic and
 * therefore identical across C-SSRS variants.
 *
 * ⚠️ **`behaviorRecency: 'interval'` is load-bearing.** The published triage
 * ladder gates the high tier for behavior on the past 3 months (see
 * `cssrsScreener.ts` and docs/reference/suicide-safer-care-pathway-spec.md §1b),
 * and the Screener and Pediatric forms establish that with a nested `q6-recent`
 * item. **This form has no such item** — its q6 reads "Have you done anything…"
 * against an explicit "since the patient's last visit or contact (not lifetime)"
 * instruction, so behavior reported here is recent by construction. Reading an
 * absent `q6-recent` would score every interval behavior report `moderate`,
 * silently downgrading the one variant whose whole purpose is interval
 * surveillance.
 */
export function mapCSSRSSinceLastContact(response: QuestionnaireResponseResource): MapperResult {
  return mapCSSRSScreenerCore(response, 'C-SSRS Since Last Visit', INTERVAL_ITEM_CODES, 'interval')
}
