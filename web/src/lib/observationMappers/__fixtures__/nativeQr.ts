/**
 * Build a QuestionnaireResponse **the way SPiER's own form builds one** — by
 * reading the answer shape off the real Questionnaire JSON rather than by
 * hand-writing it in the test.
 *
 * ── Why this exists ──────────────────────────────────────────
 *
 * Issue #327: every C-SSRS mapper read `answer.valueBoolean`, and not one SPiER
 * Questionnaire declares a `boolean` item — each yes/no question is `type:
 * choice` bound to SNOMED Yes (373066001) / No (373067005). So a screener filled
 * in through the app derived `tier: none` no matter what was endorsed. Six
 * mapper test files had certified those mappers as working, because each one
 * hand-built `valueBoolean` items: the suite proved the mappers correct against
 * input the app never produces.
 *
 * A test fixture that asserts the shape of the app's data has to *derive* that
 * shape from the artifact that defines it. Everything here — item nesting,
 * `value[x]` choice, the Yes/No codings — comes from the Questionnaire, so a
 * response built by this helper is structurally the same thing the renderer
 * captures. Anything it cannot derive throws, loudly, in the test that asked
 * for it.
 *
 * TEST-ONLY: nothing in `src/` outside `*.test.ts` imports this.
 */
import { QUESTIONNAIRE_BY_URL } from '../../../data/questionnaires'
import type {
  QuestionnaireResponseAnswer,
  QuestionnaireResponseItem,
  QuestionnaireResponseResource,
} from '../../../types/fhir'

/* eslint-disable @typescript-eslint/no-explicit-any -- raw Questionnaire JSON */
type QItem = any

/** The value a test supplies for one linkId; coerced per the item's declared type. */
export type NativeAnswer = boolean | number | string | { code: string }

/** SNOMED's Yes/No pair — the only codes SPiER binds for a yes/no question. */
const SNOMED_YES = '373066001'
const SNOMED_NO = '373067005'

function questionnaireFor(url: string): QItem {
  const q = QUESTIONNAIRE_BY_URL[url] as QItem
  if (!q) throw new Error(`nativeQr: no Questionnaire registered for ${url}`)
  return q
}

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
 * the SNOMED pair, every test that answers it yes/no fails here rather than
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
 * A QuestionnaireResponse for `questionnaireUrl` answering `answers`, nested
 * under the same group chain the Questionnaire declares.
 *
 * ```ts
 * nativeQr(CSSRS_SCREENER, { q1: true, q5: true, q6: false })
 * // → item[ideation-section][q1] = { valueCoding: SNOMED 373066001 "Yes" }
 * ```
 *
 * Throws on an unknown linkId — a renamed item in the Questionnaire fails the
 * test that reads it instead of silently answering nothing.
 */
export function nativeQr(
  questionnaireUrl: string,
  answers: Record<string, NativeAnswer>,
): QuestionnaireResponseResource {
  const q = questionnaireFor(questionnaireUrl)
  const root: QuestionnaireResponseItem[] = []

  for (const [linkId, value] of Object.entries(answers)) {
    const path = pathTo(q.item, linkId)
    if (!path) throw new Error(`nativeQr: ${questionnaireUrl} declares no item ${linkId}`)

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
    questionnaire: questionnaireUrl,
    item: root,
  } as QuestionnaireResponseResource
}

/**
 * The same answers as flat `valueBoolean` items — the shape `fallbackDispatch`
 * normalizes a foreign QR into (#230).
 *
 * Kept so each mapper test can prove **both** shapes still read. It is a
 * deliberate second-class citizen: `nativeQr` is what the app produces, and the
 * risk-ladder cases are asserted against that one.
 */
export function booleanQr(
  questionnaireUrl: string,
  answers: Record<string, boolean>,
): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: questionnaireUrl,
    item: Object.entries(answers).map(([linkId, valueBoolean]) => ({ linkId, answer: [{ valueBoolean }] })),
  } as QuestionnaireResponseResource
}
