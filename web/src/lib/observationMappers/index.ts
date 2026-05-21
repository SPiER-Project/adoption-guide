/**
 * observationMappers — per-tool QuestionnaireResponse → Observation logic.
 *
 * Each tool's mapping lives in its own file (one screener / clinician form
 * per file). This index re-exports the shared types and the public
 * `mapResponseToObservations` dispatch function.
 *
 * Dispatch is by `QuestionnaireResponse.questionnaire` canonical URL (the
 * FHIR R4 conformance field — see
 * https://hl7.org/fhir/R4/questionnaireresponse-definitions.html#QuestionnaireResponse.questionnaire).
 * Version-tolerant via `stripCanonicalVersion` so submissions tagged with
 * `…|1.1.0-pilot` and bare URLs both resolve to the same mapper.
 *
 * ⚠️ DEMO ONLY — No data is persisted to a server.
 *
 * See ../../docs/repo-audit.md §4 for the per-tool split rationale.
 */

export type { RiskAlert, MapperResult } from './shared'

import type { MapperResult } from './shared'
import { stripCanonicalVersion } from '../../data/catalog'
import { mapPHQ9 } from './phq9'
import { mapASQ } from './asq'
import { mapSBQR } from './sbqr'
import { mapCSSRSScreener } from './cssrsScreener'
import { mapCSSRSFull } from './cssrsFull'
import { mapCAMSSectionA } from './camsSectionA'
import { mapCAMSSectionB } from './camsSectionB'

// Re-export individual mappers for tests / direct invocation
export { mapPHQ9, mapASQ, mapSBQR, mapCSSRSScreener, mapCSSRSFull, mapCAMSSectionA, mapCAMSSectionB }

const SPIER_Q = 'http://spier.org/Questionnaire'

// Canonical Questionnaire URL → per-tool mapper. URLs match the
// `valueCanonical` in each ActivityDefinition's sdc-questionnaire extension
// (ig/input/fsh/<tool>.fsh). When adding a new mapper, mirror the entry
// against the AD's canonical so a versioned QR still dispatches correctly.
const MAPPER_BY_QUESTIONNAIRE_URL: Record<string, (qr: any) => MapperResult | null> = {
  [`${SPIER_Q}/PHQ-9`]: mapPHQ9,
  [`${SPIER_Q}/ASQ-Screening-Tool`]: mapASQ,
  [`${SPIER_Q}/SBQ-R`]: mapSBQR,
  [`${SPIER_Q}/C-SSRS-Screener`]: mapCSSRSScreener,
  [`${SPIER_Q}/C-SSRS-Full-Lifetime-Recent`]: mapCSSRSFull,
  [`${SPIER_Q}/CAMS-SSF5-SectionA`]: mapCAMSSectionA,
  [`${SPIER_Q}/CAMS-SSF5-SectionB`]: mapCAMSSectionB,
}

/**
 * Dispatch a QuestionnaireResponse to the matching per-tool mapper based on
 * its canonical `questionnaire` URL. Returns null for QRs without a
 * canonical reference or for canonicals SPiER doesn't have a mapper for
 * (the latter includes Stanley-Brown / CAMS Stabilization / CAMS Therapeutic
 * which produce CarePlans via lib/carePlanMappers, not Observations).
 *
 * `qr` is typed `any` to match the rest of the codebase's FHIR-resource
 * convention — the dispatcher reads `qr.questionnaire`, but the full
 * resource (incl. `item[]`) gets passed through to the per-tool mapper.
 */
export function mapResponseToObservations(qr: any): MapperResult | null {
  const canonical: string | undefined = qr?.questionnaire
  if (!canonical) return null
  const mapper = MAPPER_BY_QUESTIONNAIRE_URL[stripCanonicalVersion(canonical)]
  return mapper ? mapper(qr) : null
}
