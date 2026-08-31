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
 *            LOINC per-item codes, from a contained Questionnaire's `item.code`,
 *            from a (non-conformant) `QuestionnaireResponse.item[].code`, or from
 *            a `linkId` that is itself a LOINC code. See `itemsByCode`.
 *   Tier 3 — answer-shape heuristic (`confidence: 'shape'`). Crude "N ordinal
 *            items in range [lo,hi]" match; low confidence, opt-in only.
 *
 * The `linkId` source is not a nicety: it is the ONLY place the HL7/ASTP US
 * Behavioral Health Profiles IG carries a code on its published PHQ-9 and C-SSRS
 * QuestionnaireResponses, so without it SPiER cannot read the national
 * behavioural-health guide's own examples. Both are checked in verbatim under
 * `__fixtures__/` and asserted against in `fallbackDispatch.test.ts`. See
 * `docs/research/2026-08-us-behavioral-health-profiles-ig.md`.
 *
 * ⚠️ The LOINC item codes are NOT written here. Each signature names the SPiER
 * linkIds it covers; the `{system, code}` on each of those linkIds is resolved
 * from `QUESTIONNAIRE_ITEM_CODES`, generated out of the very Questionnaire JSON
 * (FHIR-Resources/<tool>/*.json) that declares them. The codes used to be
 * hand-copied here — a third home for a value already living in the
 * Questionnaire and in the mappers — with `check-fallback-signatures.mjs`
 * existing solely to assert the copy still matched; both are gone. What a
 * generator must NOT decide is which linkIds belong to a signature, so those,
 * their order, and the reasoning for every deliberate omission stay below.
 */
import { answerCodingForOrdinal, ordinalForAnswer } from '../../data/questionnaires'
import { getYesNoBoolean } from './shared'
import {
  QUESTIONNAIRE_ITEM_CODES,
  type CodedLinkId,
  type QuestionnaireCanonical,
} from '@spier/fhir-artifacts/generated/instrument-signatures.generated'
import type {
  Coding,
  QuestionnaireResource,
  QuestionnaireResponseAnswer,
  QuestionnaireResponseItem,
  QuestionnaireResponseResource,
} from '../../types/fhir'

const SPIER_Q = 'http://thespierproject.org/fhir/Questionnaire'

/** One standardized item code → the SPiER linkId it corresponds to. */
interface ItemCodeMapping {
  system: string
  code: string
  linkId: string
}

/**
 * The `{system, code}` the Questionnaire declares on each hand-listed linkId.
 *
 * Both ways this can be wrong are loud, which is the whole point of deriving it:
 *
 *  - a linkId that is not a *coded* item on that Questionnaire — renamed,
 *    misspelled, dropped, or never coded — is a **type error**, because
 *    `CodedLinkId<C>` is the key set of the generated lookup for that canonical.
 *    Nothing reaches this function to be silently omitted from `itemCodes`.
 *  - the throws below are the runtime backstop for the same conditions, since
 *    `vitest` executes without typechecking. They fire at module initialization,
 *    so anything importing this module reports them with a stack trace rather
 *    than quietly recognizing one instrument less.
 *
 * A silent drop is the one outcome this must never have: an `itemCodes` entry
 * missing at runtime lowers a signature's match count and its coverage, which is
 * exactly what `recognizeInstrument` ranks on — a dropped code can hand a QR to
 * the wrong instrument's mapper.
 */
function resolveItemCodes<C extends QuestionnaireCanonical>(
  spierCanonical: C,
  linkIds: readonly CodedLinkId<C>[],
): ItemCodeMapping[] {
  const declared = QUESTIONNAIRE_ITEM_CODES[spierCanonical] as Record<
    string,
    readonly { system: string; code: string }[] | undefined
  >
  return linkIds.map((linkId) => {
    const codings = declared[linkId]
    if (!codings?.length) {
      throw new Error(
        `fallbackDispatch: ${spierCanonical} item "${linkId}" declares no code. ` +
          'Either the Questionnaire renamed/dropped it, or the linkId above is wrong — ' +
          'fix one of the two rather than removing the entry.',
      )
    }
    if (codings.length > 1) {
      // `Questionnaire.item.code` is 0..*, and no item in the repo carries two.
      // If one ever does, which of them recognizes the instrument is a judgement,
      // so it belongs beside the signature — not guessed here.
      throw new Error(
        `fallbackDispatch: ${spierCanonical} item "${linkId}" declares ` +
          `${codings.length} codes (${codings.map((c) => c.code).join(', ')}); ` +
          'the signature needs a way to say which one identifies the instrument.',
      )
    }
    return { system: codings[0].system, code: codings[0].code, linkId }
  })
}

/**
 * Build one signature: the curatorial half is written out here, the codes are
 * resolved. Exists so `C` is inferred per entry — that inference is what makes a
 * bad `codedLinkIds` entry a type error against the *right* Questionnaire.
 */
function signature<C extends QuestionnaireCanonical>(spec: {
  spierCanonical: C
  /** The instrument's coded items, in the order Tier-3 maps them positionally. */
  codedLinkIds: readonly CodedLinkId<C>[]
  minCodeMatches: number
  answerKind: InstrumentSignature['answerKind']
  shape?: InstrumentSignature['shape']
}): InstrumentSignature {
  return {
    spierCanonical: spec.spierCanonical,
    itemCodes: resolveItemCodes(spec.spierCanonical, spec.codedLinkIds),
    minCodeMatches: spec.minCodeMatches,
    answerKind: spec.answerKind,
    ...(spec.shape ? { shape: spec.shape } : {}),
  }
}

export interface InstrumentSignature {
  /** SPiER canonical — must be a key in MAPPER_BY_QUESTIONNAIRE_URL (index.ts). */
  spierCanonical: string
  /** Standardized (LOINC) per-item codes → SPiER linkIds. Tier-2 recognition. */
  itemCodes: ItemCodeMapping[]
  /** Minimum item-code matches to accept a Tier-2 recognition. */
  minCodeMatches: number
  /**
   * How this instrument's mapper READS an answer — which is not always how its
   * Questionnaire declares one, and normalization has to satisfy the mapper.
   *
   *  - `ordinal`: the mapper joins the answer code back to an `ordinalValue`
   *    weight (PHQ-9, via `ordinalForAnswer`). A bare integer can be turned into
   *    the SPiER answer coding for that weight.
   *  - `boolean`: the item is a yes/no question (the whole C-SSRS family). Its
   *    Questionnaire declares SNOMED Yes/No `answerOption` codings with no
   *    `ordinalValue`, so neither ordinal helper resolves anything here; the
   *    normalized QR carries `valueBoolean` instead.
   *
   *    ⚠️ That normalization used to be load-bearing in a way it should never
   *    have been: the mappers read `valueBoolean` **only**, so a foreign QR
   *    arriving through this path derived the right tier while a native SPiER
   *    submission derived `none` (#327). `getYesNoBoolean` now reads both
   *    shapes, so the boolean here is a convenience — one normalized form for
   *    LOINC `LA33-6`/`LA32-8`, SNOMED and bare booleans alike — rather than the
   *    only shape the mapper can see.
   */
  answerKind: 'ordinal' | 'boolean'
  /** Optional Tier-3 answer-shape heuristic. */
  shape?: { itemCount: number; ordinalRange: [number, number] }
}

/**
 * Supported instruments — those with real published LOINC per-item codes, which
 * is what makes Tier-2 recognition honest rather than a guess.
 *
 * ⚠️ **ASQ is deliberately absent, and this is where that decision is recorded
 * (#230).** ASQ publishes NO per-item LOINC codes: its items carry SPiER-local
 * `asq-item` codes, and the Questionnaire's own panel code carries a
 * `coding-verification-status` of `no-standard-binding` saying exactly that. The
 * only LOINC on the form is `93374-7` on the *result*, which ASQ shares with the
 * C-SSRS forms and every other harmonized tier Observation — recognizing an
 * instrument from it would identify the wrong one about as often as the right
 * one. Inventing item codes to make Tier 2 work is what #220 cost the repo (six
 * fabricated codes plus one that resolved to healthcare-agent disclosure
 * authority and so validated cleanly while meaning the wrong thing). So a
 * foreign *item-level* ASQ belongs to the ConceptMap path (#77 / #92), which
 * translates a vocabulary instead of guessing which form produced it. The Tier-3
 * shape heuristic could match ASQ's 5 yes/no items, but it is default-off and
 * "5 boolean items" describes far too many instruments to turn on for this one.
 *
 * ⚠️ ASQ's absence is also why this table is not generated wholesale from the
 * Questionnaires. A generator emitting one signature per Questionnaire would put
 * ASQ straight back — on `asq-item` codes and a shared `93374-7` — with nowhere
 * to record why it should not be there. `codedLinkIds` below is the curated
 * half; only the `{system, code}` on each named linkId is derived.
 */
export const INSTRUMENT_SIGNATURES: InstrumentSignature[] = [
  /**
   * The C-SSRS **full** lifetime/recent form. Declared before the screener
   * because it is the more specific of the two — see `recognizeInstrument` for
   * why order alone is not what decides it.
   *
   * Its 19 item codes are timeframe-specific, and the screener's 7 are a strict
   * SUBSET of them (the screener asks the "recent" variants plus the preparatory
   * pair). So every screener QR also matches this signature, and vice versa —
   * which is exactly the ambiguity the scoring rule below exists to settle.
   */
  signature({
    spierCanonical: `${SPIER_Q}/C-SSRS-Full-Lifetime-Recent`,
    codedLinkIds: [
      'q1-lifetime',
      'q1-recent',
      'q2-lifetime',
      'q2-recent',
      'q3-lifetime',
      'q3-recent',
      'q4-lifetime',
      'q4-recent',
      'q5-lifetime',
      'q5-recent',
      'actual-attempt-lifetime',
      'actual-attempt-recent',
      'interrupted-lifetime',
      'interrupted-recent',
      'aborted-lifetime',
      'aborted-recent',
      'preparatory-lifetime',
      'preparatory-recent',
      // ⚠️ 18 of the form's 19 LOINC items, and the missing one is deliberate:
      // `actual-lethality` (93271-5) is a 0–5 damage SCALE on a SPiER-local code
      // system, not a yes/no question. Listing it here would make every foreign
      // full-form QR that answered it fail the boolean normalization and be
      // refused outright. Do not "complete" this list without giving the
      // signature a way to describe a per-item answer kind. The generated lookup
      // DOES carry `actual-lethality` — the omission is a decision taken here,
      // not something the Questionnaire withholds.
    ],
    // A lifetime/recent pair plus one behaviour item: enough to be this form
    // rather than the screener, without demanding a fully-answered instrument.
    minCodeMatches: 3,
    answerKind: 'boolean',
  }),
  /**
   * The C-SSRS 6-item screener family.
   *
   * **One signature covers both the adult Screener and the Pediatric form, on
   * purpose.** Their Questionnaires carry byte-identical LOINC item codes (8 of
   * 8), so no amount of code evidence can tell them apart — a second entry could
   * never win a comparison, it would only make the tie-break look like an
   * accident of array order. Mapping the family to the adult canonical is
   * harmless because `cssrsPediatric.ts` delegates to `mapCSSRSScreenerCore`:
   * both forms derive the same Observations and the same risk tier, and only the
   * tool *label* differs. A foreign pediatric QR is therefore labelled
   * "C-SSRS Screener", which is a naming imprecision, not a clinical one.
   *
   * `risk-level` (93374-7) is excluded deliberately: it is the form's own result
   * code, shared with ASQ and the full form, so admitting it would let an
   * unrelated instrument's summary Observation recognize this one. Like
   * `actual-lethality` above, it is in the generated lookup and left out here.
   */
  signature({
    spierCanonical: `${SPIER_Q}/C-SSRS-Screener`,
    codedLinkIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q6-recent'],
    // Low on purpose: q3–q5 and q6-recent are `enableWhen`-gated on the form, so
    // a legitimately-administered screener can carry as few as two answered
    // items. Requiring more would refuse real conditional QRs; the scoring rule
    // below is what keeps a low floor from mis-recognizing a different form.
    minCodeMatches: 2,
    answerKind: 'boolean',
  }),
  /**
   * PHQ-9. `total-score` (44261-6) and `difficulty` (69722-7) are coded on the
   * Questionnaire and left out for the same reason as the C-SSRS result code:
   * they are the form's OUTPUT, not its questions. The mapper derives the total
   * from the nine items rather than reading a reported one.
   */
  signature({
    spierCanonical: `${SPIER_Q}/PHQ-9`,
    answerKind: 'ordinal',
    codedLinkIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'],
    // Require a strong majority so a stray shared LOINC code can't misfire.
    minCodeMatches: 5,
    shape: { itemCount: 9, ordinalRange: [0, 3] },
  }),
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
 * A `linkId` that IS a standardized code, with an optional leading slash —
 * `/44250-9` or `44250-9`. That is how the HL7/ASTP US Behavioral Health
 * Profiles IG writes its PHQ-9 and C-SSRS QuestionnaireResponses, and it is the
 * only place those examples carry a code at all.
 *
 * Deliberately narrow: LOINC's `nnnnn-n` shape only. A `linkId` is an opaque
 * correlator, so treating one as terminology is a heuristic — restricting it to
 * a syntactic LOINC match keeps a SPiER-style `q1` (or any other opaque id) from
 * being entered into the code map, where a coincidental collision could shadow a
 * genuinely coded item under `itemsByCode`'s first-writer-wins rule.
 */
const LOINC_LINKID = /^\/?(\d{1,7}-\d)$/
function linkIdAsCode(linkId: string | undefined): string | undefined {
  return linkId ? (LOINC_LINKID.exec(linkId)?.[1] ?? undefined) : undefined
}

/**
 * Build a map of standardized item code → the answer-bearing QR item that
 * carries it. Reads codes from three places, in decreasing authority:
 *   1. a contained Questionnaire's `item.code`, joined to the QR item by linkId.
 *   2. `QuestionnaireResponse.item[].code`.
 *   3. the item's own `linkId`, when that linkId is itself a LOINC code.
 *
 * ⚠️ Source 2 is **not a conformant shape**: R4 `QuestionnaireResponse.item` has
 * exactly `linkId`, `definition`, `text`, `answer` and `item` — there is no
 * `code` element (verified against `hl7.org/fhir/R4/questionnaireresponse.profile.json`).
 * It is kept because tolerating a non-conformant producer that annotates its
 * items costs one line and can only add recognition, never break it — but it must
 * not be relied on, and it is why sources 1 and 3 exist. This docblock previously
 * listed it first and implied it was the normal case, which it cannot be.
 *
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
    if (item.linkId) for (const c of codesByLinkId.get(item.linkId) ?? []) codes.push(c)
    for (const c of item.code ?? []) if (c.code) codes.push(c.code)
    // Lowest authority: only consulted when nothing above named a code.
    const fromLinkId = linkIdAsCode(item.linkId)
    if (fromLinkId) codes.push(fromLinkId)
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

  /*
   * BEST match, not the first one over the line (#230).
   *
   * This used to return the first signature clearing its floor, which is fine
   * while no two instruments share a code and wrong the moment they do. The
   * C-SSRS screener's 7 item codes are a strict subset of the full form's 19, so
   * both signatures match both forms and "first past the post" would hand every
   * full C-SSRS to the screener mapper — silently collapsing the lifetime/recent
   * distinction that is the entire reason the full form exists.
   *
   * Two ranking keys, in order:
   *   1. **matched codes** — a full-form QR matches ~19 against the full
   *      signature and only 7 against the screener, so the full form wins.
   *   2. **coverage** (matched ÷ signature size) — a screener QR matches 7 of 7
   *      screener codes and 7 of 19 full ones, a tie on key 1 that coverage
   *      settles for the screener. Read plainly: prefer the instrument the QR
   *      accounts for *completely* over the one it merely fits inside.
   * Declaration order is the final, deterministic tie-break.
   */
  let best: { signature: InstrumentSignature; matches: number; coverage: number } | null = null
  for (const signature of INSTRUMENT_SIGNATURES) {
    const matches = signature.itemCodes.filter((ic) => byCode.has(ic.code)).length
    if (matches < signature.minCodeMatches) continue
    const coverage = matches / signature.itemCodes.length
    if (
      !best ||
      matches > best.matches ||
      (matches === best.matches && coverage > best.coverage)
    ) {
      best = { signature, matches, coverage }
    }
  }
  if (best) return { signature: best.signature, confidence: 'code' }

  for (const signature of INSTRUMENT_SIGNATURES) {
    if (signature.shape && ordinalItems(qr, signature.shape.ordinalRange).length === signature.shape.itemCount) {
      return { signature, confidence: 'shape' }
    }
  }
  return null
}

/**
 * LOINC's normative Yes/No answer pair (answer list LL361-7). Kept here rather
 * than in `shared.ts` because only foreign-QR normalization needs it — no SPiER
 * Questionnaire binds these. Both displays confirmed against tx.fhir.org
 * (2026-08-13); `check:codings` re-checks them nightly.
 */
const LOINC_YES_NO: Record<string, boolean> = { 'LA33-6': true, 'LA32-8': false }

/**
 * Coerce a foreign yes/no answer into one normalized `valueBoolean`.
 *
 * Accepts three shapes:
 *   1. `valueBoolean` — already normalized.
 *   2. a SNOMED Yes/No coding — via `getYesNoBoolean`, the single yes/no reader
 *      every mapper now uses, whose two codes are what SPiER's own C-SSRS
 *      `answerOption` list declares.
 *   3. a LOINC Yes/No coding (`LA33-6` / `LA32-8`).
 *
 * ⚠️ Shape 3 was **deliberately excluded** when this function landed (#323), on
 * the reasoning that accepting it "adds new code literals to the repo". That
 * reasoning was sound in the abstract and wrong for this specific pair: the
 * HL7/ASTP US Behavioral Health Profiles IG answers its published C-SSRS example
 * with `LA32-8`, so refusing LOINC meant SPiER could not read the national
 * behavioural-health guide's own artifact even once it recognized the items. This
 * is not an open door to arbitrary vocabularies — it is two codes from LOINC's
 * normative answer list, verified against the publishing authority, added because
 * a named external consumer emits them.
 *
 * Anything else — a site-local yes/no vocabulary, a free-text "Yes" — still
 * returns undefined, and the caller then refuses the whole response rather than
 * dropping the item. That asymmetry is unchanged and is still the point: see
 * `normalizeToSpierQr`.
 */
function normalizeBooleanAnswer(
  src: QuestionnaireResponseItem,
): QuestionnaireResponseAnswer | undefined {
  const coding = src.answer?.[0]?.valueCoding
  if (coding?.system === 'http://loinc.org' && coding.code && coding.code in LOINC_YES_NO) {
    return { valueBoolean: LOINC_YES_NO[coding.code] }
  }
  const direct = src.answer?.[0]?.valueBoolean
  if (typeof direct === 'boolean') return { valueBoolean: direct }
  const yesNo = getYesNoBoolean(src)
  if (typeof yesNo === 'boolean') return { valueBoolean: yesNo }
  return undefined
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
  answerKind: InstrumentSignature['answerKind'] = 'ordinal',
): QuestionnaireResponseAnswer | undefined {
  const ans = src.answer?.[0]
  if (!ans) return undefined

  if (answerKind === 'boolean') return normalizeBooleanAnswer(src)

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
): QuestionnaireResponseResource | null {
  const byCode = itemsByCode(qr)
  const ordered = positional && signature.shape
    ? ordinalItems(qr, signature.shape.ordinalRange)
    : []
  const item: QuestionnaireResponseItem[] = []
  let uninterpretable = 0
  signature.itemCodes.forEach((ic, i) => {
    const src = byCode.get(ic.code) ?? (positional ? ordered[i] : undefined)
    if (!src) return
    const answer = normalizeAnswer(src, signature.spierCanonical, ic.linkId, signature.answerKind)
    if (answer) item.push({ linkId: ic.linkId, answer: [answer] })
    // An item that IS present, with an answer we could not read, is different
    // from one that is absent — see the refusal below.
    else if (src.answer?.length) uninterpretable++
  })

  /*
   * Fail closed on an answer we found but could not interpret (#230).
   *
   * A missing item is legitimate and means "not asked": C-SSRS gates q3–q5 and
   * q6-recent behind `enableWhen`, and the mappers read an absent item as No. But
   * an item that carries an answer we cannot decode is not a No — and treating it
   * as one turns an unparsed "Yes, I have a specific plan and intent" into a
   * clean screen. That is the worst possible direction for this instrument to be
   * wrong in, and it would be invisible: the derived Observation would look
   * ordinary. So the whole response is refused instead. The QR still renders as
   * submitted; SPiER simply declines to claim a derived risk it cannot stand
   * behind, which is the honest failure and the one a reader can notice.
   */
  if (uninterpretable > 0) return null
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
