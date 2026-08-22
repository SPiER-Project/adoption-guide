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
import { suicideRiskCategory } from '../conceptDomain'

/** The C-SSRS risk-level system, and its CANONICAL displays. */
export const CSSRS_RISK_LEVEL_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/cssrs-risk-level'

/**
 * `Coding.display` on a SPiER-local system must match the CodeSystem — the
 * validator checks it, and #302's gate caught both C-SSRS mappers putting a
 * narrative label ("No risk identified", "High Risk — specific plan with intent")
 * here instead. That is the #220 mistake in a different place: a human sentence
 * where a coded display belongs.
 *
 * The narrative is not lost — it belongs in `CodeableConcept.text`, which is
 * exactly the element for a human-readable rendering.
 */
export const CSSRS_RISK_LEVEL_DISPLAY: Record<string, string> = {
  none: 'None',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}

/** Canonical display for a C-SSRS risk-level code, falling back to the code. */
export function cssrsRiskLevelDisplay(code: string): string {
  return CSSRS_RISK_LEVEL_DISPLAY[code] ?? code
}

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

/**
 * A yes/no answer → boolean, accepting either shape SPiER can receive:
 *   1. a SNOMED Yes (373066001) / No (373067005) coding — what **every** SPiER
 *      Questionnaire declares, because not one of them declares a `boolean`
 *      item: each yes/no question is `type: choice` bound to that pair;
 *   2. `valueBoolean` — what `fallbackDispatch` normalizes a foreign QR to, and
 *      what a genuinely boolean-typed item would carry.
 *
 * ⚠️ **This is the only yes/no reader, and that is the fix for #327.** There
 * used to be a second one, `getBooleanAnswer`, that read `valueBoolean` alone.
 * The C-SSRS family and CAMS Section B used it, so a screener filled in through
 * SPiER's own form — coded answers, exactly as its Questionnaire declares —
 * read `undefined` for every item, and the risk ladders treat `undefined` as
 * "not endorsed": q5 Yes ("specific plan and intent") derived `tier: none`,
 * "No risk identified". Nothing was flagged, because the mappers' own tests
 * built `valueBoolean` responses and so certified the mappers against input the
 * app never produces.
 *
 * Do not reintroduce a raw `valueBoolean` reader. If a SPiER Questionnaire ever
 * does declare a `boolean` item, this helper already reads it; a second helper
 * only recreates the fork that made the bug possible.
 * `npm run check:readers` now checks each read against the item's declared
 * `type`, so the mismatch is a build error rather than a silent wrong tier.
 */
export function getYesNoBoolean(item: QuestionnaireResponseItem | undefined): boolean | undefined {
  const direct = item?.answer?.[0]?.valueBoolean
  if (typeof direct === 'boolean') return direct
  const coding = getCodingAnswer(item)
  if (!coding) return undefined
  if (coding.system === 'http://snomed.info/sct') {
    if (coding.code === '373066001') return true
    if (coding.code === '373067005') return false
  }
  return undefined
}

/**
 * The five HL7 v3-ObservationInterpretation codes SPiER emits, each paired with
 * the display HL7 publishes for it.
 *
 * ── Why this table exists ────────────────────────────────────
 *
 * Until #236 every mapper wrote its own instrument-specific phrase into
 * `Coding.display` — `H "Moderate depression (score 12/27)"`, `N "Negative
 * screen"`, `A "Positive — suicide risk screening indicated"` — across ~33
 * sites. A `display` the publishing authority does not allow is the #220 defect
 * exactly, and it was invisible for the same reason: no gate read TypeScript for
 * anything but LOINC and SNOMED. The phrase itself is worth keeping, so it moved
 * one level up to `CodeableConcept.text`, which is the element FHIR provides for
 * "what a human should read here" and which every SPiER view already prefers
 * (`code?.text || code?.coding?.[0]?.display` in PatientChart, QuestionnaireView
 * and registry). Rendered labels are unchanged; only the wire format is fixed.
 *
 * ── Why the system URL is repeated five times ────────────────
 *
 * `web/scripts/check-codings.mjs` reads these literals statically: it needs
 * `system`, `code` and `display` as sibling *string literals* in one object, so
 * hoisting the URL into a shared const would take this table right back out of
 * the gate's view. Five repetitions buy the only automated proof that these
 * displays are still what HL7 publishes. Verified against tx.fhir.org $lookup,
 * August 2026.
 */
const INTERPRETATIONS = {
  HH: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'HH', display: 'Critical high' },
  H: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: 'High' },
  L: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'L', display: 'Low' },
  N: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Normal' },
  A: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' },
} as const

export type InterpretationCode = keyof typeof INTERPRETATIONS

/** A coding plus the human-readable phrase that belongs in the enclosing `.text`. */
export interface CodedText {
  system: string
  code: string
  display: string
  text?: string
}

/**
 * Interpretation coding for `code`, carrying `summary` as the sibling
 * `CodeableConcept.text`.
 *
 * Pass the instrument's own wording as `summary` — "Moderate depression (score
 * 12/27)", "Negative screen". It is what the UI shows; `display` stays HL7's.
 */
export function interpretationOf(code: InterpretationCode, summary: string): CodedText {
  return { ...INTERPRETATIONS[code], text: summary }
}

/**
 * Build a survey-category Observation with the supplied code and value.
 * Centralizes status/category/subject/effectiveDateTime/note defaults so
 * every per-tool mapper emits Observations in a uniform shape.
 *
 * `code.text` / `interpretation.text` default to the coding's `display`. Set
 * them when the phrase a clinician should read differs from what the code system
 * publishes — the display must stay the authority's either way.
 */
export function makeObservation(params: {
  id: string
  code: CodedText
  value: unknown
  valueType: 'integer' | 'codeable' | 'boolean' | 'string'
  interpretation?: CodedText
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
      // #271 made this slice REQUIRED on every Observation profile; #302's gate
      // found that the runtime had never emitted it.
      suicideRiskCategory(),
    ],
    // `text` is destructured off rather than spread through: it belongs to the
    // CodeableConcept, and a stray `text` inside a Coding is not a legal element.
    code: {
      coding: [{ system: params.code.system, code: params.code.code, display: params.code.display }],
      text: params.code.text ?? params.code.display,
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
    const { system, code, display, text } = params.interpretation
    obs.interpretation = [
      {
        coding: [{ system, code, display }],
        text: text ?? display,
      },
    ]
  }

  return obs
}
