/**
 * Build a QuestionnaireResponse **the way SPiER's own form builds one** — by
 * reading the answer shape off the real Questionnaire JSON rather than by
 * hand-writing it.
 *
 * ── Why this is in `lib/` and not in a test fixture ──────────
 *
 * It started life as `observationMappers/__fixtures__/nativeQr.ts`, the #327
 * fix: every C-SSRS mapper read `answer.valueBoolean` while not one SPiER
 * Questionnaire declares a `boolean` item — each yes/no question is
 * `type: choice` bound to SNOMED Yes (373066001) / No (373067005). Six mapper
 * test files had certified those mappers working, because each hand-built
 * `valueBoolean` items: the suite proved the mappers correct against input the
 * app never produces.
 *
 * The Care Pathway page's C-SSRS simulator (Phase 3 of
 * docs/plans/suicide-safer-care-pathway.md) needs exactly the same thing at
 * RUNTIME: it feeds a synthetic response through the shipped
 * `mapCSSRSScreener` so the page can never state a tier the app would not
 * derive. Hand-writing the answer shape there would have re-created #327 in the
 * one place whose whole claim is zero drift — so the derivation moved here and
 * the fixture now delegates to it. One derivation, two callers.
 *
 * Everything — item nesting, the `value[x]` choice, the Yes/No codings — comes
 * from the Questionnaire. Anything that cannot be derived **throws**, loudly,
 * rather than producing an answer the form does not offer.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import type {
  QuestionnaireResource,
  QuestionnaireResponseAnswer,
  QuestionnaireResponseItem,
  QuestionnaireResponseResource,
} from '../types/fhir'

/* eslint-disable @typescript-eslint/no-explicit-any -- raw Questionnaire JSON */
type QItem = any

/** The value supplied for one linkId; coerced per the item's declared type. */
export type NativeAnswer = boolean | number | string | { code: string }

/** SNOMED's Yes/No pair — the only codes SPiER binds for a yes/no question. */
export const SNOMED_YES = '373066001'
export const SNOMED_NO = '373067005'

/** The chain of items from the Questionnaire root down to `linkId`, inclusive. */
function pathTo(items: QItem[] | undefined, linkId: string): QItem[] | undefined {
  for (const item of items ?? []) {
    if (item.linkId === linkId) return [item]
    const nested = pathTo(item.item, linkId)
    if (nested) return [item, ...nested]
  }
  return undefined
}

/**
 * The `answer.value[x]` for `value`, chosen by the item's **declared** type.
 *
 * A `choice` item answered with a boolean resolves to that item's own Yes/No
 * `answerOption` coding — which is the whole point: if a form stopped offering
 * the SNOMED pair, every caller that answers it yes/no fails here rather than
 * quietly building an answer the form does not offer.
 */
function answerFor(item: QItem, value: NativeAnswer): QuestionnaireResponseAnswer {
  const type = item.type as string
  const options: QItem[] = item.answerOption ?? []

  if (type === 'choice' || type === 'open-choice') {
    const code = typeof value === 'boolean'
      ? (value ? SNOMED_YES : SNOMED_NO)
      : typeof value === 'object'
      ? value.code
      : String(value)
    const option = options.find((o: QItem) => o.valueCoding?.code === code)
    if (!option) {
      throw new Error(
        `nativeQr: item ${item.linkId} offers no answerOption with code ${code} ` +
        `(has ${options.map((o: QItem) => o.valueCoding?.code ?? '<non-coded>').join(', ') || 'none'})`,
      )
    }
    return { valueCoding: { ...option.valueCoding } }
  }

  if (type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`nativeQr: item ${item.linkId} is boolean; got ${typeof value}`)
    return { valueBoolean: value }
  }
  if (type === 'integer') {
    if (typeof value !== 'number') throw new Error(`nativeQr: item ${item.linkId} is integer; got ${typeof value}`)
    return { valueInteger: value }
  }
  if (type === 'string' || type === 'text') {
    if (typeof value !== 'string') throw new Error(`nativeQr: item ${item.linkId} is ${type}; got ${typeof value}`)
    return { valueString: value }
  }
  throw new Error(`nativeQr: item ${item.linkId} has unsupported type ${type}`)
}

/**
 * A QuestionnaireResponse answering `answers` against `questionnaire`, nested
 * under the same group chain that Questionnaire declares.
 *
 * ```ts
 * buildNativeQuestionnaireResponse(cssrsScreener, { q1: true, q5: true })
 * // → item[ideation-section][q1] = { valueCoding: SNOMED 373066001 "Yes" }
 * ```
 *
 * Throws on an unknown linkId — a renamed item in the Questionnaire fails the
 * caller that reads it instead of silently answering nothing.
 */
export function buildNativeQuestionnaireResponse(
  questionnaire: QuestionnaireResource,
  answers: Record<string, NativeAnswer>,
): QuestionnaireResponseResource {
  const q = questionnaire as unknown as QItem
  if (!q || q.resourceType !== 'Questionnaire') {
    throw new Error('nativeQr: not a Questionnaire resource')
  }
  const root: QuestionnaireResponseItem[] = []

  for (const [linkId, value] of Object.entries(answers)) {
    const path = pathTo(q.item, linkId)
    if (!path) throw new Error(`nativeQr: ${q.url ?? '<no url>'} declares no item ${linkId}`)

    // Walk (and extend) the response tree along the Questionnaire's group chain.
    let siblings = root
    for (const qItem of path.slice(0, -1)) {
      let group = siblings.find(i => i.linkId === qItem.linkId)
      if (!group) {
        group = { linkId: qItem.linkId, item: [] }
        siblings.push(group)
      }
      group.item ??= []
      siblings = group.item
    }
    siblings.push({ linkId, answer: [answerFor(path[path.length - 1], value)] })
  }

  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: q.url,
    item: root,
  } as QuestionnaireResponseResource
}
