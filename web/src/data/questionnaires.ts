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

// Same source JSONs the form renderer loads (see App.tsx). Importing them here
// too is free — the bundler dedupes.
import asq from '../../../FHIR-Resources/ASQ/asq-questionnaire.json'
import phq9 from '../../../FHIR-Resources/PHQ-9/phq9-questionnaire.json'
import sbqr from '../../../FHIR-Resources/SBQ-R/sbqr-questionnaire.json'
import cssrsScreener from '../../../FHIR-Resources/C-SSRS/cssrs-screener.json'
import cssrsFull from '../../../FHIR-Resources/C-SSRS/cssrs-full-lifetime-recent.json'
import camsSectionA from '../../../FHIR-Resources/CAMS/cams-ssf5-section-a.json'
import camsSectionB from '../../../FHIR-Resources/CAMS/cams-ssf5-section-b.json'
import camsStabilizationPlan from '../../../FHIR-Resources/CAMS/cams-stabilization-plan.json'
import camsTherapeuticWorksheet from '../../../FHIR-Resources/CAMS/cams-therapeutic-worksheet.json'

const ORDINAL_VALUE_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue'

const ALL_QUESTIONNAIRES = [
  asq,
  phq9,
  sbqr,
  cssrsScreener,
  cssrsFull,
  camsSectionA,
  camsSectionB,
  camsStabilizationPlan,
  camsTherapeuticWorksheet,
] as unknown as QuestionnaireResource[]

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
