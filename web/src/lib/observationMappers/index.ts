/**
 * observationMappers — per-tool QuestionnaireResponse → Observation logic.
 *
 * Each tool's mapping lives in its own file (one screener / clinician form
 * per file). This index re-exports the shared types and the public
 * `mapResponseToObservations` dispatch function.
 *
 * ⚠️ DEMO ONLY — No data is persisted to a server.
 *
 * See ../../docs/repo-audit.md §4 for the split rationale.
 */

export type { RiskAlert, MapperResult } from './shared'

import type { MapperResult } from './shared'
import { mapPHQ9 } from './phq9'
import { mapASQ } from './asq'
import { mapSBQR } from './sbqr'
import { mapCSSRSScreener } from './cssrsScreener'
import { mapCSSRSFull } from './cssrsFull'
import { mapCAMSSectionA } from './camsSectionA'
import { mapCAMSSectionB } from './camsSectionB'

// Re-export individual mappers for tests / direct invocation
export { mapPHQ9, mapASQ, mapSBQR, mapCSSRSScreener, mapCSSRSFull, mapCAMSSectionA, mapCAMSSectionB }

/**
 * Dispatch a QuestionnaireResponse to the right tool mapper by its
 * `questionnaireName` (the value stored on StoredResponse).
 *
 * Returns null for unrecognized names. Today this lookup is name-based;
 * Move 6d.6 will replace it with a canonical-URL lookup driven by the
 * FHIR-shaped catalog so the bespoke name map can be removed.
 */
export function mapResponseToObservations(questionnaireName: string, response: any): MapperResult | null {
  switch (questionnaireName) {
    case 'PHQ-9':
      return mapPHQ9(response)
    case 'ASQ Screening':
      return mapASQ(response)
    case 'SBQ-R':
      return mapSBQR(response)
    case 'C-SSRS Screener':
      return mapCSSRSScreener(response)
    case 'C-SSRS Full':
      return mapCSSRSFull(response)
    case 'CAMS SSF-5: Section A':
      return mapCAMSSectionA(response)
    case 'CAMS SSF-5: Section B':
      return mapCAMSSectionB(response)
    default:
      return null
  }
}
