import { makeObservation, interpretationOf, walkItems, getYesNoBoolean, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource, CSSRS_RISK_LEVEL_SYSTEM, cssrsRiskLevelDisplay } from './shared'

/** The code that identifies one C-SSRS item in an extracted Observation. */
export interface CSSRSItemCoding {
  linkId: string
  system: string
  code: string
  display: string
}

/**
 * Per-item codes for the past-month screener administrations (Screener and
 * Pediatric). LOINC's C-SSRS item codes are timeframe-specific, and these are the
 * 1-month ideation variants plus the Lifetime preparatory-acts code for the
 * composite behaviour question — which is what those two forms actually ask.
 *
 * These displays land in Observation.code.coding[0].display, so they are LOINC's
 * own strings verbatim, not friendly paraphrases. The abbreviated labels used here
 * previously ("Suicidal behavior (ever)" for 93267-3, etc.) were the same class of
 * silent drift as issue #220: runtime-only, so no gate ever saw them. Every pair
 * was confirmed via $validate-code against LOINC 2.82.
 */
export const CSSRS_SCREENER_ITEM_CODES: CSSRSItemCoding[] = [
  { linkId: 'q1', system: 'http://loinc.org', code: '93246-7', display: 'Wish to be dead 1 month' },
  { linkId: 'q2', system: 'http://loinc.org', code: '93247-5', display: 'Non-specific active suicidal thoughts 1 month' },
  { linkId: 'q3', system: 'http://loinc.org', code: '93248-3', display: 'Active suicidal ideation with any methods (not plan) without intent to act 1 month' },
  { linkId: 'q4', system: 'http://loinc.org', code: '93249-1', display: 'Active suicidal ideation with some intent to act, without specific plan 1 month' },
  { linkId: 'q5', system: 'http://loinc.org', code: '93250-9', display: 'Active suicidal ideation with specific plan and intent 1 month' },
  { linkId: 'q6', system: 'http://loinc.org', code: '93267-3', display: 'Preparatory acts or suicidal behavior Lifetime' },
]

/** Ordinal rank of the derived tiers, so two contributions can be compared. */
const TIER_RANK = { none: 0, low: 1, moderate: 2, high: 3 } as const
type CSSRSTier = keyof typeof TIER_RANK

/**
 * How an administration establishes that a positive behavior item (q6) is
 * *recent* — which the published triage ladder gates the high tier on.
 *
 * - `'q6-recent-item'` — the form asks "Was this within the past three months?"
 *   as a nested item under q6 (Screener, Pediatric). No answer, or "No", means
 *   the behavior is lifetime-only.
 * - `'interval'` — the whole administration is scoped to the period since the
 *   patient's last visit or contact, so the form asks no recency question and
 *   any behavior reported is within that interval **by construction** (Since
 *   Last Visit). Reading an absent `q6-recent` there would silently downgrade
 *   every interval behavior report to `moderate`, which is why this is a
 *   parameter rather than "q6Recent === true" everywhere.
 */
export type CSSRSBehaviorRecency = 'q6-recent-item' | 'interval'

/**
 * The C-SSRS 6-item screener, the Pediatric screener and the "Since Last Visit /
 * Since Last Contact" version share an identical ideation item set (q1–q6),
 * conditional logic, and three-tier risk stratification. They differ in the
 * administration reference period, which is exactly what LOINC's item codes
 * encode — so the item coding is a parameter rather than shared: the interval
 * version passes SPiER-local codes because LOINC publishes nothing for a
 * "since last contact" window (see ig/input/fsh/cssrs.fsh, issue #220). The
 * behavior item's recency is a parameter for the same reason: only the two
 * lifetime-framed forms carry a `q6-recent` item.
 *
 * The derived risk-level Observation is timeframe-agnostic and identical across
 * all three, so it stays in the core.
 */
export function mapCSSRSScreenerCore(
  response: QuestionnaireResponseResource,
  toolLabel: string,
  itemCodes: CSSRSItemCoding[] = CSSRS_SCREENER_ITEM_CODES,
  behaviorRecency: CSSRSBehaviorRecency = 'q6-recent-item',
): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // Extract ideation items
  const q1 = getYesNoBoolean(walkItems(items, 'q1'))
  const q2 = getYesNoBoolean(walkItems(items, 'q2'))
  const q3 = getYesNoBoolean(walkItems(items, 'q3'))
  const q4 = getYesNoBoolean(walkItems(items, 'q4'))
  const q5 = getYesNoBoolean(walkItems(items, 'q5'))
  const q6 = getYesNoBoolean(walkItems(items, 'q6'))
  const q6Recent = getYesNoBoolean(walkItems(items, 'q6-recent'))

  // ── Risk tier: the published C-SSRS Screener with Triage Points ──────────
  //
  // Verified against two sources that agree item-for-item — the CMS-hosted 2008
  // "Screen Version — Recent" PDF and the Columbia Lighthouse Project's 2026
  // "Screen with Triage Points for Primary Care", the latter with an explicit
  // response-protocol table under the colour bands. The full record is
  // docs/reference/suicide-safer-care-pathway-spec.md §"Published-instrument
  // verification (Phase 1b)"; this is Phase 1c of docs/plans/suicide-safer-care-pathway.md.
  //
  //   q1 / q2                        → low       (yellow)
  //   q3                             → moderate  (orange)
  //   q4 / q5                        → high      (red)
  //   q6 behavior, past 3 months     → high      (red)
  //   q6 behavior, lifetime-only     → moderate  (orange)
  //
  // Two of those corrected shipped behavior: q4 derived `moderate`, and q6
  // derived `high` regardless of recency. Clinical review of the change is
  // **retrospective, not blocking** — decision recorded 2026-09-01: these tools
  // are not in production, and the published instrument is the authority
  // (pathway plan, decision 3).
  //
  // ⚠️ The source pathway diagram puts q6-lifetime-only in a *separate*
  // "Historical" tier ranked below low. That tier is deliberately NOT
  // implemented: neither published source defines a fourth level, and both
  // score that response pattern `moderate` — the same tier as a lone q3 (spec
  // doc, §1b "One place the diagram itself is not fully supported"). Whether
  // SPiER should carry historical risk as an *orthogonal flag* is open clinical
  // question 2 in the plan; if it is adopted it layers on beside this tier
  // rather than re-ranking it.
  //
  // ⚠️ Behavior sets a FLOOR, not an override. The override this replaced was
  // safe only while every positive q6 meant `high`; with lifetime-only q6 at
  // `moderate`, an override would *downgrade* a q5-endorsed screen. Take the
  // more severe of the two contributions.

  let ideationTier: CSSRSTier = 'none'
  let riskDisplay = 'No risk identified'
  let highestIdeation = 0

  if (q5) { ideationTier = 'high'; riskDisplay = 'High Risk — specific plan with intent'; highestIdeation = 5 }
  else if (q4) { ideationTier = 'high'; riskDisplay = 'High Risk — ideation with some intent'; highestIdeation = 4 }
  else if (q3) { ideationTier = 'moderate'; riskDisplay = 'Moderate Risk — ideation with method'; highestIdeation = 3 }
  else if (q2) { ideationTier = 'low'; riskDisplay = 'Low Risk — active suicidal thoughts'; highestIdeation = 2 }
  else if (q1) { ideationTier = 'low'; riskDisplay = 'Low Risk — wish to be dead'; highestIdeation = 1 }

  const behaviorIsRecent = behaviorRecency === 'interval' ? q6 === true : q6Recent === true
  let behaviorTier: CSSRSTier = 'none'
  let behaviorDisplay: string | undefined
  if (q6) {
    behaviorTier = behaviorIsRecent ? 'high' : 'moderate'
    behaviorDisplay = behaviorRecency === 'interval'
      ? 'High Risk — suicidal behavior since last contact'
      : behaviorIsRecent
      ? 'High Risk — suicidal behavior within past 3 months'
      : 'Moderate Risk — lifetime-only suicidal behavior'
  }

  const riskCode: CSSRSTier =
    TIER_RANK[behaviorTier] > TIER_RANK[ideationTier] ? behaviorTier : ideationTier
  // On a tie the behavior narrative wins, which is what the old override did and
  // is the more clinically salient half of an equal-tier pair.
  if (behaviorDisplay && TIER_RANK[behaviorTier] >= TIER_RANK[ideationTier]) {
    riskDisplay = behaviorDisplay
  }

  const behaviorNote = !q6
    ? 'No'
    : behaviorRecency === 'interval'
    ? 'Yes (since last contact)'
    : behaviorIsRecent
    ? 'Yes (within 3 months)'
    : 'Yes (lifetime only, not within 3 months)'

  // Individual item observations, coded for this administration's reference period.
  for (const { linkId, system, code, display } of itemCodes) {
    const val = getYesNoBoolean(walkItems(items, linkId))
    if (val !== undefined) {
      observations.push(
        makeObservation({
          id: `cssrs-${linkId}-${Date.now()}`,
          code: { system, code, display },
          value: val,
          valueType: 'boolean',
          questionnaireName: toolLabel,
        }),
      )
    }
  }

  // Risk level observation
  observations.push(
    makeObservation({
      id: `cssrs-risk-level-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: {
        // display = the CodeSystem's display; the narrative goes in `text`.
        coding: [
          {
            system: CSSRS_RISK_LEVEL_SYSTEM,
            code: riskCode,
            display: cssrsRiskLevelDisplay(riskCode),
          },
        ],
        text: riskDisplay,
      },
      valueType: 'codeable',
      interpretation: riskCode === 'high'
        ? interpretationOf('H', riskDisplay)
        : riskCode === 'moderate'
        ? interpretationOf('A', riskDisplay)
        : riskCode === 'low'
        ? interpretationOf('L', riskDisplay)
        : interpretationOf('N', 'No risk identified'),
      note: `${toolLabel}: Highest ideation level ${highestIdeation}/5. Behavior: ${behaviorNote}.`,
      questionnaireName: toolLabel,
    }),
  )

  const riskAlert: RiskAlert = riskCode === 'high'
    ? {
        tool: toolLabel,
        level: 'high',
        summary: `C-SSRS: HIGH Risk`,
        detail: riskDisplay + '. Immediate safety planning and possible emergency psychiatric evaluation indicated.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'moderate'
    ? {
        tool: toolLabel,
        level: 'moderate',
        summary: `C-SSRS: MODERATE Risk`,
        detail: riskDisplay + '. Safety planning recommended. Consider full C-SSRS assessment.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'low'
    ? {
        tool: toolLabel,
        level: 'low',
        summary: `C-SSRS: LOW Risk`,
        detail: riskDisplay + '. Outpatient referral with warm handoff. Provide crisis resources (988).',
      }
    : {
        tool: toolLabel,
        level: 'none',
        summary: 'C-SSRS: No risk identified',
        detail: 'All C-SSRS screener items negative. No suicidal ideation or behavior endorsed.',
      }

  return { observations, riskAlert }
}

/** C-SSRS Screener with Triage Points — the Clarify Risk step's demonstrated
 *  realization (it derives the tier the pathway branches on), and a 6-item
 *  screen where a site leads with it. */
export function mapCSSRSScreener(response: QuestionnaireResponseResource): MapperResult {
  return mapCSSRSScreenerCore(response, 'C-SSRS Screener')
}
