/**
 * Questionnaire registry — canonical URL → Questionnaire JSON, plus helpers to
 * resolve an answer's ordinal weight from the Questionnaire's `answerOption`.
 *
 * Why this exists: ordinal weights (the per-answer scores summed into a total,
 * e.g. PHQ-9) live on the *Questionnaire* `answerOption.extension[ordinalValue]`,
 * NOT on the QuestionnaireResponse `answer.valueCoding`. The renderer
 * (@formbox/renderer) does not copy that extension onto the captured answer, so
 * a mapper reading the response answer alone sees no ordinal. The standards-
 * correct way to score is to join the selected answer's code back to the
 * Questionnaire answerOption — which is exactly what the SDC `weight()` FHIRPath
 * function does. This module is the TypeScript reference implementation of that
 * join, used by the per-instrument observation mappers.
 */
import { stripCanonicalVersion } from './catalog'
import type { QuestionnaireResource } from '../types/fhir'

// This module is the single owner of the hand-authored Questionnaire JSON
// imports from FHIR-Resources/. Both the form renderer (App.tsx routes) and the
// ordinal-scoring join below consume the resources through the named exports
// here, so the raw JSON paths live in exactly one place.
import asq from '../../../FHIR-Resources/ASQ/asq-questionnaire.json'
import bssa from '../../../FHIR-Resources/BSSA/bssa-questionnaire.json'
import pss3 from '../../../FHIR-Resources/PSS-3/pss3-questionnaire.json'
import safet from '../../../FHIR-Resources/SAFE-T/safet-questionnaire.json'
import phq9 from '../../../FHIR-Resources/PHQ-9/phq9-questionnaire.json'
import sbqr from '../../../FHIR-Resources/SBQ-R/sbqr-questionnaire.json'
import cssrsScreenerJson from '../../../FHIR-Resources/C-SSRS/cssrs-screener.json'
import cssrsSinceLastContactJson from '../../../FHIR-Resources/C-SSRS/cssrs-since-last-contact.json'
import cssrsFullJson from '../../../FHIR-Resources/C-SSRS/cssrs-full-lifetime-recent.json'
import camsSectionAJson from '../../../FHIR-Resources/CAMS/cams-ssf5-section-a.json'
import camsSectionBJson from '../../../FHIR-Resources/CAMS/cams-ssf5-section-b.json'
import camsOutcomeDispositionJson from '../../../FHIR-Resources/CAMS/cams-ssf5-outcome-disposition.json'
import camsStabilizationPlanJson from '../../../FHIR-Resources/CAMS/cams-stabilization-plan.json'
import camsTherapeuticWorksheetJson from '../../../FHIR-Resources/CAMS/cams-therapeutic-worksheet.json'
import crpJson from '../../../FHIR-Resources/CRP/crp-questionnaire.json'

const ORDINAL_VALUE_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue'

/** Named Questionnaire resources — the canonical, typed registry entries. */
export const asqQuestionnaire = asq as unknown as QuestionnaireResource
export const bssaQuestionnaire = bssa as unknown as QuestionnaireResource
export const pss3Questionnaire = pss3 as unknown as QuestionnaireResource
export const safetQuestionnaire = safet as unknown as QuestionnaireResource
export const phq9Questionnaire = phq9 as unknown as QuestionnaireResource
export const sbqrQuestionnaire = sbqr as unknown as QuestionnaireResource
export const cssrsScreener = cssrsScreenerJson as unknown as QuestionnaireResource
export const cssrsSinceLastContact = cssrsSinceLastContactJson as unknown as QuestionnaireResource
export const cssrsFull = cssrsFullJson as unknown as QuestionnaireResource
export const camsSectionA = camsSectionAJson as unknown as QuestionnaireResource
export const camsSectionB = camsSectionBJson as unknown as QuestionnaireResource
export const camsOutcomeDisposition = camsOutcomeDispositionJson as unknown as QuestionnaireResource
export const camsStabilizationPlan = camsStabilizationPlanJson as unknown as QuestionnaireResource
export const camsTherapeuticWorksheet = camsTherapeuticWorksheetJson as unknown as QuestionnaireResource
export const crpQuestionnaire = crpJson as unknown as QuestionnaireResource

const ALL_QUESTIONNAIRES: QuestionnaireResource[] = [
  asqQuestionnaire,
  bssaQuestionnaire,
  pss3Questionnaire,
  safetQuestionnaire,
  phq9Questionnaire,
  sbqrQuestionnaire,
  cssrsScreener,
  cssrsSinceLastContact,
  cssrsFull,
  camsSectionA,
  camsSectionB,
  camsOutcomeDisposition,
  camsStabilizationPlan,
  camsTherapeuticWorksheet,
  crpQuestionnaire,
]

/** Canonical (version-stripped) Questionnaire URL → Questionnaire resource. */
export const QUESTIONNAIRE_BY_URL: Record<string, unknown> = Object.fromEntries(
  ALL_QUESTIONNAIRES.filter(q => q?.url).map(q => [stripCanonicalVersion(q.url!), q]),
)

/** Depth-first search for an item by linkId (items can nest). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findQItem(items: any[] | undefined, linkId: string): any | undefined {
  for (const it of items ?? []) {
    if (it.linkId === linkId) return it
    const nested = findQItem(it.item, linkId)
    if (nested) return nested
  }
  return undefined
}

/**
 * Resolve the ordinal weight of a selected answer by looking up its code in the
 * source Questionnaire's `answerOption` (the SDC `weight()` join). Returns
 * undefined when the questionnaire, item, option, or ordinalValue isn't found.
 */
export function ordinalForAnswer(
  questionnaireUrl: string | undefined,
  linkId: string,
  code: string | undefined,
): number | undefined {
  if (!questionnaireUrl || !code) return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = QUESTIONNAIRE_BY_URL[stripCanonicalVersion(questionnaireUrl)] as any
  if (!q) return undefined
  const item = findQItem(q.item, linkId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const option = (item?.answerOption ?? []).find((o: any) => o.valueCoding?.code === code)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ext = (option?.extension ?? []).find((e: any) => e.url === ORDINAL_VALUE_URL)
  return ext?.valueDecimal
}

/**
 * Inverse of `ordinalForAnswer`: given an ordinal weight, return the SPiER
 * Questionnaire `answerOption.valueCoding` that carries it. Used by the
 * code-based fallback dispatcher (../lib/observationMappers/fallbackDispatch.ts)
 * to synthesize a SPiER-recognizable answer coding when a foreign QR captured a
 * bare integer (0–3) instead of a coded answer — so the unchanged mapper's
 * `ordinalForAnswer` join still resolves. Returns undefined when the
 * questionnaire, item, or a matching ordinalValue isn't found.
 */
export function answerCodingForOrdinal(
  questionnaireUrl: string | undefined,
  linkId: string,
  ordinal: number,
): { system?: string; code?: string; display?: string } | undefined {
  if (!questionnaireUrl) return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = QUESTIONNAIRE_BY_URL[stripCanonicalVersion(questionnaireUrl)] as any
  if (!q) return undefined
  const item = findQItem(q.item, linkId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const option = (item?.answerOption ?? []).find((o: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o.extension ?? []).some((e: any) => e.url === ORDINAL_VALUE_URL && e.valueDecimal === ordinal),
  )
  return option?.valueCoding
}
