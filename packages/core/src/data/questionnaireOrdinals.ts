/**
 * The SDC `weight()` join — an answer's ordinal score, and its inverse.
 *
 * Ordinal weights (the per-answer scores summed into a total, e.g. PHQ-9) live
 * on the *Questionnaire* `answerOption.extension[ordinalValue]`, NOT on the
 * QuestionnaireResponse `answer.valueCoding`. `@formbox/renderer` does not copy
 * that extension onto the captured answer, so a mapper reading the response
 * answer alone sees no ordinal. The standards-correct way to score is to join
 * the selected answer's code back to the Questionnaire `answerOption` — which is
 * exactly what the SDC `weight()` FHIRPath function does. This module is the
 * TypeScript reference implementation of that join.
 *
 * ## Why this is not in `./questionnaires.ts`, where it used to live
 *
 * These two functions need three fields per option — code, ordinal, and the
 * coding to rebuild — and nothing else. Reaching them through
 * `QUESTIONNAIRE_BY_URL` meant the observation mappers imported all **18 whole
 * Questionnaires**, and the mappers are reachable from the registry and the
 * measure engine, which are eager. The result was 166.8 KB of form JSON in the
 * entry chunk of *both* build surfaces — including the clinical one an EHR
 * frames — paid by every visitor whether or not they ever opened a form.
 *
 * So the join reads a derived table instead
 * (`questionnaire-ordinals.generated.ts`, emitted by `scripts/copy-fhir.mjs`
 * from the same Questionnaires), and `./questionnaires.ts` keeps the whole
 * resources for the one caller that renders them — which is lazy.
 * `docs/plans/tool-bundling-audit-2026-09-19.md` §5.1 has the measurement.
 *
 * ⚠️ **Do not import `./questionnaires.ts` from here, or from a mapper.** That
 * single import is the whole regression: it is not a type error, it is not a
 * test failure, and the only symptom is 166.8 KB reappearing in the entry chunk.
 * `npm run check:eager-forms` fails if it comes back.
 */
import { QUESTIONNAIRE_ORDINALS } from '@spier/fhir-artifacts/generated/questionnaire-ordinals.generated'
import { stripCanonicalVersion } from './catalog'

type WeightedOption = {
  readonly code: string
  readonly ordinal: number
  readonly system?: string
  readonly display?: string
}

const TABLE = QUESTIONNAIRE_ORDINALS as unknown as Record<
  string,
  Record<string, readonly WeightedOption[] | undefined> | undefined
>

function optionsFor(questionnaireUrl: string | undefined, linkId: string): readonly WeightedOption[] {
  if (!questionnaireUrl) return []
  return TABLE[stripCanonicalVersion(questionnaireUrl)]?.[linkId] ?? []
}

/**
 * Resolve the ordinal weight of a selected answer by looking up its code in the
 * source Questionnaire's `answerOption` (the SDC `weight()` join). Returns
 * undefined when the questionnaire, item, or option isn't found — an item whose
 * options carry no `ordinalValue` is absent from the table, so it answers
 * undefined rather than 0. A caller summing a score must keep treating those as
 * "no contribution" rather than "zero score"; both mappers do (`?? 0` at the
 * sum site, not here).
 */
export function ordinalForAnswer(
  questionnaireUrl: string | undefined,
  linkId: string,
  code: string | undefined,
): number | undefined {
  if (!code) return undefined
  return optionsFor(questionnaireUrl, linkId).find(o => o.code === code)?.ordinal
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
  const match = optionsFor(questionnaireUrl, linkId).find(o => o.ordinal === ordinal)
  if (!match) return undefined
  return { system: match.system, code: match.code, display: match.display }
}
