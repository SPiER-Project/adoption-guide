import { makeObservation, interpretationOf, walkItems, getBooleanAnswer, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

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

/**
 * The C-SSRS 6-item screener, the Pediatric screener and the "Since Last Visit /
 * Since Last Contact" version share an identical item set (q1–q6, q6-recent),
 * conditional logic, and three-tier risk stratification. They differ in the
 * administration reference period, which is exactly what LOINC's item codes
 * encode — so the item coding is a parameter rather than shared: the interval
 * version passes SPiER-local codes because LOINC publishes nothing for a
 * "since last contact" window (see ig/input/fsh/cssrs.fsh, issue #220).
 *
 * The derived risk-level Observation is timeframe-agnostic and identical across
 * all three, so it stays in the core.
 */
export function mapCSSRSScreenerCore(
  response: QuestionnaireResponseResource,
  toolLabel: string,
  itemCodes: CSSRSItemCoding[] = CSSRS_SCREENER_ITEM_CODES,
): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // Extract ideation items
  const q1 = getBooleanAnswer(walkItems(items, 'q1'))
  const q2 = getBooleanAnswer(walkItems(items, 'q2'))
  const q3 = getBooleanAnswer(walkItems(items, 'q3'))
  const q4 = getBooleanAnswer(walkItems(items, 'q4'))
  const q5 = getBooleanAnswer(walkItems(items, 'q5'))
  const q6 = getBooleanAnswer(walkItems(items, 'q6'))
  const q6Recent = getBooleanAnswer(walkItems(items, 'q6-recent'))

  // Determine risk level from highest positive
  let riskCode = 'none'
  let riskDisplay = 'No risk identified'
  let highestIdeation = 0

  if (q5) { riskCode = 'high'; riskDisplay = 'High Risk — specific plan with intent'; highestIdeation = 5 }
  else if (q4) { riskCode = 'moderate'; riskDisplay = 'Moderate Risk — ideation with some intent'; highestIdeation = 4 }
  else if (q3) { riskCode = 'moderate'; riskDisplay = 'Moderate Risk — ideation with method'; highestIdeation = 3 }
  else if (q2) { riskCode = 'low'; riskDisplay = 'Low Risk — active suicidal thoughts'; highestIdeation = 2 }
  else if (q1) { riskCode = 'low'; riskDisplay = 'Low Risk — wish to be dead'; highestIdeation = 1 }

  // Q6 (behavior) overrides to high if positive
  if (q6) {
    riskCode = 'high'
    riskDisplay = q6Recent
      ? 'High Risk — suicidal behavior within past 3 months'
      : 'High Risk — lifetime suicidal behavior'
  }

  // Individual item observations, coded for this administration's reference period.
  for (const { linkId, system, code, display } of itemCodes) {
    const val = getBooleanAnswer(walkItems(items, linkId))
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
        coding: [{ system: 'http://spier.org/CodeSystem/cssrs-risk-level', code: riskCode, display: riskDisplay }],
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
      note: `${toolLabel}: Highest ideation level ${highestIdeation}/5. Behavior: ${q6 ? 'Yes' : 'No'}${q6Recent ? ' (within 3 months)' : ''}.`,
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

/** C-SSRS Screener (Recent) — the Identify Possible Risk 6-item screen. */
export function mapCSSRSScreener(response: QuestionnaireResponseResource): MapperResult {
  return mapCSSRSScreenerCore(response, 'C-SSRS Screener')
}
