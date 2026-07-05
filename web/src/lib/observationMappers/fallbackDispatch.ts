/**
 * fallbackDispatch — recognize a QuestionnaireResponse's instrument from its
 * DATA when its `questionnaire` canonical doesn't match a SPiER Questionnaire,
 * then normalize it into SPiER shape so the *unchanged* per-tool mapper runs.
 *
 * Why this exists: the mappers (phq9.ts, …) extract answers by SPiER linkId
 * (`walkItems(items, 'q1')`) and resolve ordinal weights by joining the answer
 * code back to the *bundled SPiER* Questionnaire (`ordinalForAnswer`). A QR
 * authored by a foreign EHR carries its own canonical, its own linkIds, and
 * possibly bare-integer answers — none of which the mappers understand. Rather
 * than duplicate mapper logic per foreign shape, we recognize the instrument
 * from standardized item codes, then rewrite the QR into SPiER shape (linkIds
 * `q1..q9` + SPiER answer codings) that the existing mapper consumes verbatim.
 *
 * Three tiers, tried in order by `mapResponseToObservations` (index.ts):
 *   Tier 1 — canonical URL (handled in index.ts; highest confidence).
 *   Tier 2 — item-code recognition (`confidence: 'code'`). Matches standardized
 *            LOINC per-item codes carried on `QuestionnaireResponse.item[].code`
 *            or on a contained Questionnaire's `item.code`.
 *   Tier 3 — answer-shape heuristic (`confidence: 'shape'`). Crude "N ordinal
 *            items in range [lo,hi]" match; low confidence, opt-in only.
 *
 * ⚠️ The LOINC item codes below are hand-duplicated from the SPiER Questionnaire
 * JSON (FHIR-Resources/<tool>/*.json) — a third home for values that already
 * live there and in the mappers. `web/scripts/check-fallback-signatures.mjs`
 * guards against drift (see CLAUDE.md "Drift-prone hand-duplicated values").
 */
import { answerCodingForOrdinal, ordinalForAnswer } from '../../data/questionnaires'
import type {
  Coding,
  QuestionnaireResource,
  QuestionnaireResponseAnswer,
  QuestionnaireResponseItem,
  QuestionnaireResponseResource,
} from '../../types/fhir'

const SPIER_Q = 'http://spier.org/Questionnaire'

/** One standardized item code → the SPiER linkId it corresponds to. */
interface ItemCodeMapping {
  system: string
  code: string
  linkId: string
}

export interface InstrumentSignature {
  /** SPiER canonical — must be a key in MAPPER_BY_QUESTIONNAIRE_URL (index.ts). */
  spierCanonical: string
  /** Standardized (LOINC) per-item codes → SPiER linkIds. Tier-2 recognition. */
  itemCodes: ItemCodeMapping[]
  /** Minimum item-code matches to accept a Tier-2 recognition. */
  minCodeMatches: number
  /** Optional Tier-3 answer-shape heuristic. */
  shape?: { itemCount: number; ordinalRange: [number, number] }
}

/**
 * Supported instruments. Phase 1 ships PHQ-9 only: it has real published LOINC
 * per-item codes (44250-9…44262-4, panel 44249-1) so Tier-2 recognition is
 * reliable. Instruments without per-item LOINC (e.g. ASQ — SPiER-local codes
 * only) are Tier-3-only and deferred to Phase 2.
 *
 * NOTE for the drift check parser (check-fallback-signatures.mjs): keep each
 * itemCodes entry on one line with `code` before `linkId`.
 */
export const INSTRUMENT_SIGNATURES: InstrumentSignature[] = [
  {
    spierCanonical: `${SPIER_Q}/PHQ-9`,
    itemCodes: [
      { system: 'http://loinc.org', code: '44250-9', linkId: 'q1' },
      { system: 'http://loinc.org', code: '44255-8', linkId: 'q2' },
      { system: 'http://loinc.org', code: '44259-0', linkId: 'q3' },
      { system: 'http://loinc.org', code: '44254-1', linkId: 'q4' },
      { system: 'http://loinc.org', code: '44251-7', linkId: 'q5' },
      { system: 'http://loinc.org', code: '44258-2', linkId: 'q6' },
      { system: 'http://loinc.org', code: '44252-5', linkId: 'q7' },
      { system: 'http://loinc.org', code: '44253-3', linkId: 'q8' },
      { system: 'http://loinc.org', code: '44260-8', linkId: 'q9' },
    ],
    // Require a strong majority so a stray shared LOINC code can't misfire.
    minCodeMatches: 5,
    shape: { itemCount: 9, ordinalRange: [0, 3] },
  },
]

export interface RecognitionResult {
  signature: InstrumentSignature
  confidence: 'code' | 'shape'
}

/** Depth-first walk over QuestionnaireResponse items (nested + answer.item). */
function* walkResponseItems(
  items: QuestionnaireResponseItem[] | undefined,
): Generator<QuestionnaireResponseItem> {
  for (const item of items ?? []) {
    yield item
    yield* walkResponseItems(item.item)
    for (const ans of item.answer ?? []) {
      yield* walkResponseItems(ans.item)
    }
  }
}

/** Depth-first walk over Questionnaire items (nested). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function* walkQuestionnaireItems(items: any[] | undefined): Generator<any> {
  for (const item of items ?? []) {
    yield item
    yield* walkQuestionnaireItems(item.item)
  }
}

/**
 * Build a map of standardized item code → the answer-bearing QR item that
 * carries it. Reads codes from two places:
 *   1. `QuestionnaireResponse.item[].code` (foreign QRs that annotate items).
 *   2. a contained Questionnaire's `item.code`, joined to the QR item by linkId.
 * First writer wins so an earlier item isn't clobbered by a duplicate code.
 */
function itemsByCode(qr: QuestionnaireResponseResource): Map<string, QuestionnaireResponseItem> {
  // linkId → codes, from a contained Questionnaire (if any).
  const codesByLinkId = new Map<string, string[]>()
  const containedRaw = (qr as Record<string, unknown>).contained
  const contained = Array.isArray(containedRaw) ? (containedRaw as QuestionnaireResource[]) : []
  for (const res of contained) {
    if (res?.resourceType !== 'Questionnaire') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of walkQuestionnaireItems((res as any).item)) {
      const codes = (it.code as Coding[] | undefined)?.map((c) => c.code).filter((c): c is string => !!c)
      if (it.linkId && codes?.length) codesByLinkId.set(it.linkId, codes)
    }
  }

  const byCode = new Map<string, QuestionnaireResponseItem>()
  for (const item of walkResponseItems(qr?.item)) {
    const codes: string[] = []
    for (const c of item.code ?? []) if (c.code) codes.push(c.code)
    if (item.linkId) for (const c of codesByLinkId.get(item.linkId) ?? []) codes.push(c)
    for (const code of codes) if (!byCode.has(code)) byCode.set(code, item)
  }
  return byCode
}

/** Leaf items whose first answer is an integer/decimal within [lo, hi], in
 *  document order. Used for the shape heuristic (count + positional mapping). */
function ordinalItems(
  qr: QuestionnaireResponseResource,
  [lo, hi]: [number, number],
): QuestionnaireResponseItem[] {
  const out: QuestionnaireResponseItem[] = []
  for (const item of walkResponseItems(qr?.item)) {
    if (item.item?.length) continue // leaf only
    const ans = item.answer?.[0]
    if (!ans) continue
    const n = typeof ans.valueInteger === 'number' ? ans.valueInteger
      : typeof ans.valueDecimal === 'number' ? ans.valueDecimal
      : undefined
    if (typeof n === 'number' && n >= lo && n <= hi) out.push(item)
  }
  return out
}

/**
 * Recognize the instrument behind a QR whose canonical didn't match a mapper.
 * Tier 2 (code) is preferred over Tier 3 (shape); returns null when neither
 * fires. Shape results are only *acted on* when the caller passes
 * `allowHeuristic` — recognition itself always reports what it found.
 */
export function recognizeInstrument(qr: QuestionnaireResponseResource): RecognitionResult | null {
  const byCode = itemsByCode(qr)
  for (const signature of INSTRUMENT_SIGNATURES) {
    const matches = signature.itemCodes.filter((ic) => byCode.has(ic.code)).length
    if (matches >= signature.minCodeMatches) return { signature, confidence: 'code' }
  }
  for (const signature of INSTRUMENT_SIGNATURES) {
    if (signature.shape && ordinalItems(qr, signature.shape.ordinalRange).length === signature.shape.itemCount) {
      return { signature, confidence: 'shape' }
    }
  }
  return null
}

/**
 * Coerce a foreign answer into a SPiER-recognizable one for `linkId`:
 *   1. a coded answer already resolvable against the SPiER Questionnaire →
 *      pass it through (foreign QR reused standard LOINC answer codes);
 *   2. a bare integer/decimal → synthesize the SPiER answer coding for that
 *      ordinal (SDC weight() inverse), so `ordinalForAnswer` resolves it;
 *   3. a coding whose *code* is itself an integer string → treat as (2).
 * Returns undefined when the answer can't be mapped.
 */
function normalizeAnswer(
  src: QuestionnaireResponseItem,
  spierCanonical: string,
  linkId: string,
): QuestionnaireResponseAnswer | undefined {
  const ans = src.answer?.[0]
  if (!ans) return undefined

  if (ans.valueCoding?.code && ordinalForAnswer(spierCanonical, linkId, ans.valueCoding.code) !== undefined) {
    return { valueCoding: ans.valueCoding }
  }

  const ordinal = typeof ans.valueInteger === 'number' ? ans.valueInteger
    : typeof ans.valueDecimal === 'number' ? ans.valueDecimal
    : ans.valueCoding?.code && /^\d+$/.test(ans.valueCoding.code) ? Number(ans.valueCoding.code)
    : undefined
  if (typeof ordinal === 'number') {
    const coding = answerCodingForOrdinal(spierCanonical, linkId, ordinal)
    if (coding) return { valueCoding: coding }
  }
  return undefined
}

/**
 * Rewrite a foreign QR into a synthetic, SPiER-shaped QuestionnaireResponse:
 * `questionnaire` set to the SPiER canonical, items re-keyed to SPiER linkIds,
 * answers coerced to SPiER answer codings. The result is what the *unchanged*
 * per-tool mapper consumes. Items whose code isn't found, or whose answer can't
 * be mapped, are dropped (the mapper treats a missing item as ordinal 0).
 *
 * `positional` (Tier 3): when the QR carries no item codes, map the Nth ordinal
 * answer to the Nth signature linkId by document order. Only safe for a
 * shape-recognized QR — the heuristic already asserted the item *count* matches.
 */
export function normalizeToSpierQr(
  qr: QuestionnaireResponseResource,
  signature: InstrumentSignature,
  positional = false,
): QuestionnaireResponseResource {
  const byCode = itemsByCode(qr)
  const ordered = positional && signature.shape
    ? ordinalItems(qr, signature.shape.ordinalRange)
    : []
  const item: QuestionnaireResponseItem[] = []
  signature.itemCodes.forEach((ic, i) => {
    const src = byCode.get(ic.code) ?? (positional ? ordered[i] : undefined)
    if (!src) return
    const answer = normalizeAnswer(src, signature.spierCanonical, ic.linkId)
    if (answer) item.push({ linkId: ic.linkId, answer: [answer] })
  })
  const normalized: QuestionnaireResponseResource = {
    resourceType: 'QuestionnaireResponse',
    status: qr?.status ?? 'completed',
    questionnaire: signature.spierCanonical,
    item,
  }
  // Preserve identity fields the mappers/derivation don't strictly need but
  // downstream consumers (stage tagging, derivedFrom) benefit from.
  const subject = (qr as { subject?: unknown }).subject
  if (subject) (normalized as { subject?: unknown }).subject = subject
  if (qr?.authored) normalized.authored = qr.authored
  return normalized
}
