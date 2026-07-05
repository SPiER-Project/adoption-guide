/**
 * Shared helpers and types for per-tool observation mappers.
 *
 * Each per-tool mapper (./phq9.ts, ./asq.ts, …) imports from this file
 * to walk QuestionnaireResponse items, build Observation resources, and
 * report a uniform MapperResult shape.
 *
 * ⚠️ DEMO ONLY — No data is persisted to a server.
 */

import type {
  CodeableConcept,
  Coding,
  ObservationResource,
  QuestionnaireResponseItem,
} from '../../types/fhir'

// Re-export the FHIR resource shapes the per-tool mappers need, so they can
// import everything from './shared'.
export type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '../../types/fhir'

export interface RiskAlert {
  tool: string
  level: 'none' | 'low' | 'moderate' | 'high' | 'acute'
  summary: string
  detail: string
  suggestedAction?: {
    label: string
    path: string
  }
}

/**
 * How the dispatcher matched a QuestionnaireResponse to its mapper. Set by
 * `mapResponseToObservations` (index.ts), not by the per-tool mappers.
 *  - `canonical` — the QR's `questionnaire` URL matched a SPiER canonical
 *    (highest confidence; today's behavior).
 *  - `code` — the canonical didn't match but the instrument was recognized
 *    from standardized item codes (LOINC), then normalized to SPiER shape.
 *  - `shape` — recognized only by answer-shape heuristic (lowest confidence;
 *    opt-in via `allowHeuristic`).
 */
export interface DispatchProvenance {
  via: 'canonical' | 'code' | 'shape'
  /** The SPiER canonical the QR was recognized as (set for `code`/`shape`). */
  recognizedCanonical?: string
  /** The QR's own (non-matching) canonical, if any (set for `code`/`shape`). */
  submittedCanonical?: string
}

export interface MapperResult {
  observations: ObservationResource[]
  riskAlert: RiskAlert
  /**
   * Present only on results returned via the fallback dispatcher. When `via`
   * is `code`/`shape`, callers stamp derived Observations + surface the
   * inferred-mapping caveat so a clinician knows the instrument was recognized
   * from data, not a matching canonical URL. See deriveFromResponse.ts.
   */
  dispatch?: DispatchProvenance
}

/**
 * Severity ordering shared by every UI that ranks risk levels: lower number =
 * more severe. Single source of truth for what was previously a duplicated
 * `RISK_ORDER`-style map in PatientChart.tsx and PopulationView.tsx.
 */
export const RISK_LEVEL_ORDER: Record<RiskAlert['level'], number> = {
  acute: 0,
  high: 1,
  moderate: 2,
  low: 3,
  none: 4,
}

/** Most severe level across a set of risk alerts; 'none' when the set is empty. */
export function highestRiskLevel(alerts: RiskAlert[]): RiskAlert['level'] {
  if (alerts.length === 0) return 'none'
  return alerts.reduce((worst, a) =>
    RISK_LEVEL_ORDER[a.level] < RISK_LEVEL_ORDER[worst.level] ? a : worst,
  ).level
}

/**
 * Find a QuestionnaireResponse item by linkId, recursing into nested
 * item arrays and answer.item nodes (used by repeating-group structures).
 */
export function walkItems(
  items: QuestionnaireResponseItem[],
  linkId: string,
): QuestionnaireResponseItem | undefined {
  for (const item of items) {
    if (item.linkId === linkId) return item
    if (item.item) {
      const found = walkItems(item.item, linkId)
      if (found) return found
    }
    if (item.answer) {
      for (const ans of item.answer) {
        if (ans.item) {
          const found = walkItems(ans.item, linkId)
          if (found) return found
        }
      }
    }
  }
  return undefined
}

// Ordinal/weight resolution moved to ../../data/questionnaires (ordinalForAnswer):
// the score lives on the Questionnaire answerOption, not the response answer, so
// it must be resolved by joining the selected code back to the Questionnaire
// (SDC weight() semantics) — not read off the captured answer.

export function getCodingAnswer(item: QuestionnaireResponseItem | undefined): Coding | undefined {
  return item?.answer?.[0]?.valueCoding
}

export function getBooleanAnswer(item: QuestionnaireResponseItem | undefined): boolean | undefined {
  return item?.answer?.[0]?.valueBoolean
}

/**
 * SNOMED Yes/No coding → boolean. Used by ASQ where answers are SNOMED-
 * coded Yes (373066001) / No (373067005).
 */
export function getYesNoBoolean(item: QuestionnaireResponseItem | undefined): boolean | undefined {
  const coding = getCodingAnswer(item)
  if (!coding) return undefined
  if (coding.system === 'http://snomed.info/sct') {
    if (coding.code === '373066001') return true
    if (coding.code === '373067005') return false
  }
  return undefined
}

/**
 * Build a survey-category Observation with the supplied code and value.
 * Centralizes status/category/subject/effectiveDateTime/note defaults so
 * every per-tool mapper emits Observations in a uniform shape.
 */
export function makeObservation(params: {
  id: string
  code: { system: string; code: string; display: string }
  value: unknown
  valueType: 'integer' | 'codeable' | 'boolean' | 'string'
  interpretation?: { system: string; code: string; display: string }
  note?: string
  questionnaireName: string
}): ObservationResource {
  const obs: ObservationResource = {
    resourceType: 'Observation',
    id: params.id,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          },
        ],
      },
    ],
    code: {
      coding: [params.code],
      text: params.code.display,
    },
    subject: { reference: 'Patient/demo-patient' },
    effectiveDateTime: new Date().toISOString(),
    note: params.note
      ? [{ text: params.note }]
      : [{ text: `DEMO ONLY — Generated from ${params.questionnaireName} QuestionnaireResponse. No data persisted to server.` }],
  }

  if (params.valueType === 'integer') {
    obs.valueInteger = params.value as number
  } else if (params.valueType === 'codeable') {
    obs.valueCodeableConcept = params.value as CodeableConcept
  } else if (params.valueType === 'boolean') {
    obs.valueBoolean = params.value as boolean
  } else if (params.valueType === 'string') {
    obs.valueString = params.value as string
  }

  if (params.interpretation) {
    obs.interpretation = [
      {
        coding: [params.interpretation],
      },
    ]
  }

  return obs
}
