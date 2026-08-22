/**
 * A repeating pair group, built in BOTH shapes a QuestionnaireResponse can use.
 *
 * ⚠️ This exists because each mapper test used to define its own `pairGroup`
 * that built only the `answer.item` shape — and that is what let #418/#419 live.
 * The Questionnaires declare these groups as `type: group, repeats: true`, so a
 * conforming filler (and `@formbox/renderer`, verified in a browser) emits
 * repeated `item` entries with the fields nested under each. The HL7 validator
 * REJECTS the `answer.item` form: "Items of type question should not have
 * answers".
 *
 * Reading only `answer.item` produced a well-formed CarePlan with every contact
 * section reading "No … provided." — structurally perfect, clinically empty.
 * The mappers accept both shapes now, so the tests must exercise both; a helper
 * that can only build the readable one is indistinguishable from a mapper that
 * works.
 */
import type { QuestionnaireResponseItem } from '@spier/core/types/fhir'

export type PairShape = 'conformant' | 'legacy'

/** Both shapes, for `describe.each`-style parameterisation over a mapper. */
export const PAIR_SHAPES: readonly PairShape[] = ['conformant', 'legacy'] as const

/**
 * `conformant` — one repeated `item` per occurrence, fields nested under it.
 *   This is what the Questionnaire declares and what the app emits.
 * `legacy` — a single item whose `answer[]` entries each carry the fields.
 *   Non-conformant, still accepted so existing consumers keep working.
 *
 * An empty field is omitted rather than written as an empty string, matching
 * what a filler does with a question left blank.
 */
export function pairGroup(
  shape: PairShape,
  groupLinkId: string,
  fieldA: string,
  fieldB: string,
  pairs: Array<[string, string]>,
): QuestionnaireResponseItem[] {
  const fields = ([a, b]: [string, string]): QuestionnaireResponseItem[] => {
    const item: QuestionnaireResponseItem[] = []
    if (a) item.push({ linkId: fieldA, answer: [{ valueString: a }] })
    if (b) item.push({ linkId: fieldB, answer: [{ valueString: b }] })
    return item
  }

  if (shape === 'conformant') {
    return pairs.map(pair => ({ linkId: groupLinkId, item: fields(pair) }))
  }
  return [{ linkId: groupLinkId, answer: pairs.map(pair => ({ item: fields(pair) })) }]
}
