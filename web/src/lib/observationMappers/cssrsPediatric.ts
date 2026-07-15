import { mapCSSRSScreenerCore } from './cssrsScreener'
import type { MapperResult, QuestionnaireResponseResource } from './shared'

/**
 * C-SSRS Pediatric / Adolescent screener (TL-027) — same validated 6-item set,
 * LOINC coding, conditional logic, and three-tier risk stratification as the
 * adult/recent screener, targeted at pediatric/adolescent settings. Delegates to
 * the shared screener core; only the tool label differs. Emits the shared
 * SPiERCSSRSRiskLevel-shaped risk Observation.
 */
export function mapCSSRSPediatric(response: QuestionnaireResponseResource): MapperResult {
  return mapCSSRSScreenerCore(response, 'C-SSRS Pediatric')
}
