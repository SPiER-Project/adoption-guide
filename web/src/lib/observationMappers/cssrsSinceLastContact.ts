import { mapCSSRSScreenerCore } from './cssrsScreener'
import type { MapperResult, QuestionnaireResponseResource } from './shared'

/**
 * C-SSRS Since Last Visit / Since Last Contact (TL-019) — a repeat assessment
 * scoped to the interval since the patient's prior contact. It shares the
 * screener's item set, LOINC coding, conditional logic, and three-tier risk
 * stratification, so it delegates to the shared screener core; only the tool
 * label differs. Emits the shared SPiERCSSRSRiskLevel-shaped risk Observation.
 */
export function mapCSSRSSinceLastContact(response: QuestionnaireResponseResource): MapperResult {
  return mapCSSRSScreenerCore(response, 'C-SSRS Since Last Visit')
}
