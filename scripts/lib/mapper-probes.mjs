/**
 * Synthetic QuestionnaireResponses for RUNNING the observation mappers inside a
 * gate, so the gate compares against what a mapper EMITS rather than against a
 * hand copy of it or a scan of its source.
 *
 * Shared by `check:extract` (does every declared extraction come out of the
 * mapper?) and `check:crosswalk` (does every disposition a ConceptMap translates
 * come out of some mapper, and only real ones?). Both load core through
 * lib/load-core.mjs and pass its `nativeQuestionnaireResponse` module in, so the
 * responses are shaped the way SPiER's own form shapes them — a yes/no `choice`
 * item answered with its SNOMED Yes/No coding, never a `valueBoolean` the form
 * does not produce (#327).
 *
 * ⚠️ The probe set is per-item, not combinatorial: three anchors — every item at its
 * FIRST value, every item at its LAST value, and every item ENDORSED (SNOMED Yes
 * where the item offers it, otherwise its last value) — and each single item
 * varied over every value it offers against each anchor. That reaches every
 * disposition every SPiER mapper emits today. A disposition reachable only
 * through a combination of two non-extreme answers would not be reached — and
 * `check:crosswalk` then FAILS (coverage) rather than passing, which is the
 * direction this is built to fail in.
 */

/** Every item, depth-first. */
export function* itemsOf(items) {
  for (const item of items ?? []) {
    yield item
    yield* itemsOf(item.item)
  }
}

const ANSWERABLE = new Set(['choice', 'open-choice', 'integer', 'boolean', 'string', 'text'])

/** The values a probe may give an item, in the item's declared order. */
function valuesFor(item) {
  if (item.type === 'integer') return [0, 1, 2, 3, 4, 5]
  if (item.type === 'boolean') return [false, true]
  if (item.type === 'string' || item.type === 'text') return ['probe']
  return (item.answerOption ?? []).map((o) => o.valueCoding?.code).filter(Boolean).map((code) => ({ code }))
}

/** Every answerable leaf at its ENDORSED value — Yes where offered, else the last. */
export function endorseAll(questionnaire, native) {
  const answers = {}
  for (const item of itemsOf(questionnaire.item)) {
    if (!ANSWERABLE.has(item.type)) continue
    const values = valuesFor(item)
    if (values.length === 0) continue
    const yes = values.find((v) => typeof v === 'object' && v.code === native.SNOMED_YES)
    answers[item.linkId] = yes ?? values[values.length - 1]
  }
  return answers
}

/** The three anchors, and each item varied over its values against each anchor. */
export function probeAnswerSets(questionnaire, native) {
  const leaves = [...itemsOf(questionnaire.item)].filter((i) => ANSWERABLE.has(i.type) && valuesFor(i).length)
  const first = Object.fromEntries(leaves.map((i) => [i.linkId, valuesFor(i)[0]]))
  const last = Object.fromEntries(leaves.map((i) => [i.linkId, valuesFor(i).at(-1)]))
  const endorsed = endorseAll(questionnaire, native)
  const anchors = [first, last, endorsed]
  const sets = [...anchors]
  for (const item of leaves) {
    for (const value of valuesFor(item)) {
      for (const anchor of anchors) sets.push({ ...anchor, [item.linkId]: value })
    }
  }
  return sets
}

/** A response to `questionnaire` answering `answers`, with the fields a mapper stamps from. */
export function respond(native, questionnaire, answers) {
  const qr = native.buildNativeQuestionnaireResponse(questionnaire, answers)
  return Object.assign(qr, {
    id: 'gate-probe',
    subject: { reference: 'Patient/gate-probe' },
    authored: '2026-01-01T00:00:00Z',
  })
}

/** Every `{system, code}` anywhere in a value. */
export function* codingsIn(node) {
  if (Array.isArray(node)) {
    for (const n of node) yield* codingsIn(n)
    return
  }
  if (!node || typeof node !== 'object') return
  if (typeof node.system === 'string' && typeof node.code === 'string') yield node
  for (const value of Object.values(node)) yield* codingsIn(value)
}
