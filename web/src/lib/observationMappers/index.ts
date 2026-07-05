/**
 * observationMappers — per-tool QuestionnaireResponse → Observation logic.
 *
 * Each tool's mapping lives in its own file (one screener / clinician form
 * per file). This index re-exports the shared types and the public
 * `mapResponseToObservations` dispatch function.
 *
 * Dispatch is primarily by `QuestionnaireResponse.questionnaire` canonical URL
 * (the FHIR R4 conformance field — see
 * https://hl7.org/fhir/R4/questionnaireresponse-definitions.html#QuestionnaireResponse.questionnaire).
 * Version-tolerant via `stripCanonicalVersion` so submissions tagged with
 * `…|1.1.0-pilot` and bare URLs both resolve to the same mapper.
 *
 * When the canonical doesn't match (a QR authored by a foreign EHR), a
 * three-tier fallback recognizes the instrument from its data (LOINC item
 * codes; optionally an answer-shape heuristic) and normalizes it into SPiER
 * shape so the same per-tool mapper runs — see ./fallbackDispatch.
 *
 * ⚠️ DEMO ONLY — No data is persisted to a server.
 *
 * See ../../docs/repo-audit.md §4 for the per-tool split rationale.
 */

export type { RiskAlert, MapperResult, DispatchProvenance } from './shared'
export { RISK_LEVEL_ORDER, highestRiskLevel } from './shared'
export { INSTRUMENT_SIGNATURES, recognizeInstrument, normalizeToSpierQr } from './fallbackDispatch'
export type { InstrumentSignature, RecognitionResult } from './fallbackDispatch'

import type { MapperResult } from './shared'
import type { QuestionnaireResponseResource } from '../../types/fhir'
import { stripCanonicalVersion } from '../../data/catalog'
import { recognizeInstrument, normalizeToSpierQr } from './fallbackDispatch'
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
const MAPPER_BY_QUESTIONNAIRE_URL: Record<string, (qr: QuestionnaireResponseResource) => MapperResult | null> = {
  [`${SPIER_Q}/PHQ-9`]: mapPHQ9,
  [`${SPIER_Q}/ASQ-Screening-Tool`]: mapASQ,
  [`${SPIER_Q}/SBQ-R`]: mapSBQR,
  [`${SPIER_Q}/C-SSRS-Screener`]: mapCSSRSScreener,
  [`${SPIER_Q}/C-SSRS-Full-Lifetime-Recent`]: mapCSSRSFull,
  [`${SPIER_Q}/CAMS-SSF5-SectionA`]: mapCAMSSectionA,
  [`${SPIER_Q}/CAMS-SSF5-SectionB`]: mapCAMSSectionB,
}

export interface DispatchOptions {
  /**
   * Allow Tier-3 (answer-shape heuristic) recognition. Default `false`: a
   * shape-only match returns `null` rather than fabricating a risk tier from
   * a QR we can't confidently identify. Callers that want the heuristic
   * (e.g. an exploratory tool) opt in explicitly.
   */
  allowHeuristic?: boolean
}

/**
 * Dispatch a QuestionnaireResponse to the matching per-tool mapper.
 *
 * Tier 1 — the canonical `questionnaire` URL matches a SPiER Questionnaire
 * (highest confidence). Returns null for canonicals SPiER has no mapper for
 * (Stanley-Brown / CAMS Stabilization / CAMS Therapeutic produce CarePlans via
 * lib/carePlanMappers, not Observations).
 *
 * Tier 2/3 — the canonical didn't match, so `recognizeInstrument` identifies
 * the instrument from LOINC item codes (Tier 2, `confidence: 'code'`) or an
 * answer-shape heuristic (Tier 3, `confidence: 'shape'`, opt-in via
 * `allowHeuristic`). The foreign QR is normalized to SPiER shape and run
 * through the same mapper; the result carries a `dispatch` provenance marker
 * so callers can surface that the mapping was inferred, not canonical-matched.
 *
 * Returns null when no tier fires (no canonical + unrecognized shape).
 */
export function mapResponseToObservations(
  qr: QuestionnaireResponseResource,
  opts: DispatchOptions = {},
): MapperResult | null {
  const canonical: string | undefined = qr?.questionnaire
  if (canonical) {
    const direct = MAPPER_BY_QUESTIONNAIRE_URL[stripCanonicalVersion(canonical)]
    if (direct) return direct(qr)
  }

  const recognized = recognizeInstrument(qr)
  if (!recognized) return null
  if (recognized.confidence === 'shape' && !opts.allowHeuristic) return null

  const mapper = MAPPER_BY_QUESTIONNAIRE_URL[recognized.signature.spierCanonical]
  if (!mapper) return null

  const result = mapper(
    normalizeToSpierQr(qr, recognized.signature, recognized.confidence === 'shape'),
  )
  if (!result) return null
  return {
    ...result,
    dispatch: {
      via: recognized.confidence,
      recognizedCanonical: recognized.signature.spierCanonical,
      submittedCanonical: canonical,
    },
  }
}
