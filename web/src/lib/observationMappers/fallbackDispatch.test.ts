import { describe, it, expect } from 'vitest'
import { mapResponseToObservations } from '@spier/core/lib/observationMappers'
import { recognizeInstrument, normalizeToSpierQr, INSTRUMENT_SIGNATURES } from '@spier/core/lib/observationMappers/fallbackDispatch'
import { deriveFromResponse } from '@spier/core/lib/deriveFromResponse'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'
import bhpCssrs from './__fixtures__/bhp-cssrs-example.json'
import bhpPhq9 from './__fixtures__/bhp-phq9-example.json'

// SPiER PHQ-9 answer-option ordinals (FHIR-Resources/PHQ-9/phq9-questionnaire.json).
const LA = { 0: 'LA6568-5', 1: 'LA6569-3', 2: 'LA6570-1', 3: 'LA6571-9' } as const
// LOINC per-item codes q1..q9 (same order as the SPiER Questionnaire items).
const ITEM_LOINC = ['44250-9', '44255-8', '44259-0', '44254-1', '44251-7', '44258-2', '44252-5', '44253-3', '44260-8']

/** Native SPiER PHQ-9 QR — dispatches via canonical (Tier 1). */
function nativeQr(scores: number[]): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://thespierproject.org/fhir/Questionnaire/PHQ-9',
    item: scores.map((s, i) => ({
      linkId: `q${i + 1}`,
      answer: [{ valueCoding: { system: 'http://loinc.org', code: LA[s as 0 | 1 | 2 | 3] } }],
    })),
  } as QuestionnaireResponseResource
}

/**
 * Foreign PHQ-9 QR: a non-SPiER canonical, foreign linkIds, LOINC item codes on
 * each item, and standard LOINC answer codings. This is the Tier-2 target.
 */
function foreignCodedQr(scores: number[], canonical?: string): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    ...(canonical ? { questionnaire: canonical } : {}),
    item: scores.map((s, i) => ({
      linkId: `EPIC-ITEM-${i + 1}`,
      code: [{ system: 'http://loinc.org', code: ITEM_LOINC[i] }],
      answer: [{ valueCoding: { system: 'http://loinc.org', code: LA[s as 0 | 1 | 2 | 3] } }],
    })),
  } as QuestionnaireResponseResource
}

/** Foreign PHQ-9 QR with LOINC item codes but bare-integer (0–3) answers. */
function foreignIntegerQr(scores: number[]): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://example.org/fhir/Questionnaire/depression-screen',
    item: scores.map((s, i) => ({
      linkId: `item${i + 1}`,
      code: [{ system: 'http://loinc.org', code: ITEM_LOINC[i] }],
      answer: [{ valueInteger: s }],
    })),
  } as QuestionnaireResponseResource
}

const totalOf = (r: NonNullable<ReturnType<typeof mapResponseToObservations>>) =>
  r.observations.find(o => o.code?.coding?.[0]?.code === '44261-6')?.valueInteger
const item9InterpOf = (r: NonNullable<ReturnType<typeof mapResponseToObservations>>) =>
  r.observations.find(o => o.code?.coding?.[0]?.code === '44260-8')?.interpretation?.[0]?.coding?.[0]?.code

describe('fallback dispatch — Tier 2 (item-code recognition)', () => {
  it('foreign-canonical PHQ-9 with LOINC item codes yields the same result as the native fixture', () => {
    const scores = [2, 2, 1, 1, 0, 0, 0, 0, 2]
    const native = mapResponseToObservations(nativeQr(scores))!
    const foreign = mapResponseToObservations(foreignCodedQr(scores, 'http://loinc.org/q/44249-1'))!

    expect(totalOf(foreign)).toBe(totalOf(native))
    expect(totalOf(foreign)).toBe(8)
    expect(item9InterpOf(foreign)).toBe(item9InterpOf(native)) // both 'A' (positive)
    expect(foreign.riskAlert.level).toBe(native.riskAlert.level) // both 'high'
    expect(foreign.riskAlert.summary).toBe(native.riskAlert.summary)
  })

  it('marks the fallback result with code-dispatch provenance; the native result has none', () => {
    const foreign = mapResponseToObservations(foreignCodedQr([0, 0, 0, 0, 0, 0, 0, 0, 2]))!
    expect(foreign.dispatch?.via).toBe('code')
    expect(foreign.dispatch?.recognizedCanonical).toBe('http://thespierproject.org/fhir/Questionnaire/PHQ-9')
    expect(mapResponseToObservations(nativeQr([0, 0, 0, 0, 0, 0, 0, 0, 2]))!.dispatch).toBeUndefined()
  })

  it('recognizes PHQ-9 with NO canonical at all (Tier 2)', () => {
    const qr = foreignCodedQr([1, 1, 1, 1, 1, 1, 1, 1, 1]) // no canonical passed
    expect(qr.questionnaire).toBeUndefined()
    const recognized = recognizeInstrument(qr)
    expect(recognized?.confidence).toBe('code')
    const result = mapResponseToObservations(qr)!
    expect(totalOf(result)).toBe(9)
  })

  it('synthesizes SPiER answer codings from bare-integer answers', () => {
    const result = mapResponseToObservations(foreignIntegerQr([3, 3, 3, 3, 3, 3, 0, 0, 0]))!
    expect(totalOf(result)).toBe(18)
    expect(result.dispatch?.via).toBe('code')
  })

  it('recognizes an instrument from a contained Questionnaire item.code', () => {
    const qr = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: '#phq9-local',
      contained: [
        {
          resourceType: 'Questionnaire',
          id: 'phq9-local',
          url: 'http://example.org/phq9-local',
          item: ITEM_LOINC.map((code, i) => ({ linkId: `L${i + 1}`, code: [{ system: 'http://loinc.org', code }] })),
        },
      ],
      item: [2, 2, 2, 2, 2, 0, 0, 0, 0].map((s, i) => ({
        linkId: `L${i + 1}`,
        answer: [{ valueCoding: { system: 'http://loinc.org', code: LA[s as 0 | 2] } }],
      })),
    } as unknown as QuestionnaireResponseResource
    const result = mapResponseToObservations(qr)!
    expect(result.dispatch?.via).toBe('code')
    expect(totalOf(result)).toBe(10)
  })
})

describe('fallback dispatch — Tier 3 (shape heuristic) is gated', () => {
  // 9 bare-integer answers in [0,3], no codes, foreign canonical → shape-only.
  function shapeOnlyQr(scores: number[]): QuestionnaireResponseResource {
    return {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://example.org/unknown-depression-tool',
      item: scores.map((s, i) => ({ linkId: `x${i + 1}`, answer: [{ valueInteger: s }] })),
    } as QuestionnaireResponseResource
  }

  it('an ambiguous shape returns null without allowHeuristic (no fabricated tier)', () => {
    expect(mapResponseToObservations(shapeOnlyQr([1, 1, 1, 1, 1, 1, 1, 1, 2]))).toBeNull()
  })

  it('recognizes shape but flags low confidence', () => {
    expect(recognizeInstrument(shapeOnlyQr([1, 1, 1, 1, 1, 1, 1, 1, 2]))?.confidence).toBe('shape')
  })

  it('with allowHeuristic, maps positionally and marks shape provenance', () => {
    const result = mapResponseToObservations(shapeOnlyQr([2, 2, 2, 2, 2, 0, 0, 0, 3]), { allowHeuristic: true })!
    expect(result.dispatch?.via).toBe('shape')
    expect(totalOf(result)).toBe(13)
    expect(item9InterpOf(result)).toBe('A') // 9th positional answer (3) → item 9 positive
  })
})

describe('fallback dispatch — regression & guards', () => {
  it('native SPiER QRs are unchanged (Tier 1 still wins, no fallback provenance)', () => {
    const result = mapResponseToObservations(nativeQr([2, 2, 1, 1, 0, 0, 0, 0, 0]))!
    expect(totalOf(result)).toBe(6)
    expect(result.dispatch).toBeUndefined()
  })

  it('QRs with too few code matches are not recognized', () => {
    const qr = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [
        { linkId: 'a', code: [{ system: 'http://loinc.org', code: '44260-8' }], answer: [{ valueInteger: 2 }] },
        { linkId: 'b', code: [{ system: 'http://loinc.org', code: '44250-9' }], answer: [{ valueInteger: 1 }] },
      ],
    } as unknown as QuestionnaireResponseResource
    expect(recognizeInstrument(qr)).toBeNull()
    expect(mapResponseToObservations(qr)).toBeNull()
  })

  it('normalizeToSpierQr produces SPiER linkIds + a SPiER canonical', () => {
    const sig = INSTRUMENT_SIGNATURES.find(s => s.spierCanonical.endsWith('/PHQ-9'))!
    // Null only when an answer was present and unreadable (#230), which this
    // fully-mappable QR is not — so assert it mapped before reading it.
    const normalized = normalizeToSpierQr(foreignCodedQr([1, 2, 3, 0, 1, 2, 3, 0, 1]), sig)!
    expect(normalized).not.toBeNull()
    expect(normalized.questionnaire).toBe('http://thespierproject.org/fhir/Questionnaire/PHQ-9')
    expect(normalized.item?.map(i => i.linkId)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'])
  })
})

/**
 * The real published artifacts, not our idea of a foreign QR. See
 * `__fixtures__/README.md` — these carry their LOINC code only in `linkId`
 * ("/44250-9"), with no `item.code` and no contained Questionnaire, and the
 * C-SSRS one points `questionnaire` at a PDF so Tier 1 cannot fire.
 */
describe('fallback dispatch — the US Behavioral Health Profiles IG examples', () => {
  it('recognizes the published PHQ-9 example and scores it (12, per the IG total)', () => {
    const result = mapResponseToObservations(bhpPhq9 as unknown as QuestionnaireResponseResource)!
    expect(result).not.toBeNull()
    expect(result.dispatch?.via).toBe('code')
    expect(result.dispatch?.recognizedCanonical).toBe('http://thespierproject.org/fhir/Questionnaire/PHQ-9')
    // The IG's own item 44261-6 states the total is 12; SPiER must agree, having
    // read only the nine per-item answers.
    expect(totalOf(result)).toBe(12)
  })

  it('recognizes the published C-SSRS example despite `questionnaire` being a PDF', () => {
    const qr = bhpCssrs as unknown as QuestionnaireResponseResource
    expect(qr.questionnaire).toMatch(/\.pdf$/)
    const recognized = recognizeInstrument(qr)
    expect(recognized?.confidence).toBe('code')
    expect(recognized?.signature.spierCanonical).toBe('http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener')
  })

  it('maps the C-SSRS example to the risk level the IG itself asserts (Low)', () => {
    const result = mapResponseToObservations(bhpCssrs as unknown as QuestionnaireResponseResource)!
    const risk = result.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    // Every item is answered "No" (LA32-8), and the IG's own 93374-7 item says
    // LA9194-7 "Low". SPiER derives from the items alone and must not disagree.
    expect(risk?.valueCodeableConcept?.coding?.[0]?.code).toBe('none')
  })

  it('converts the IG\'s LOINC yes/no codings into the booleans the mapper reads', () => {
    const sig = INSTRUMENT_SIGNATURES.find(s => s.spierCanonical.endsWith('/C-SSRS-Screener'))!
    const normalized = normalizeToSpierQr(bhpCssrs as unknown as QuestionnaireResponseResource, sig)
    // Not null: every one of the IG's answers is readable, so nothing is refused.
    expect(normalized).not.toBeNull()
    expect(normalized!.questionnaire).toBe('http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener')
    expect(normalized!.item?.map(i => i.linkId)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q6-recent'])
    // valueBoolean, not a passed-through LA32-8 coding — `getBooleanAnswer`
    // reads nothing else.
    expect(normalized!.item?.every(i => i.answer?.[0]?.valueBoolean === false)).toBe(true)
  })

  it('a "Yes" C-SSRS answer drives the risk level up (the fixture is not passing by always saying No)', () => {
    const qr = JSON.parse(JSON.stringify(bhpCssrs)) as QuestionnaireResponseResource
    // Endorse item 5 — active ideation with specific plan and intent.
    const q5 = qr.item?.find(i => i.linkId === '/93250-9')
    q5!.answer = [{ valueCoding: { system: 'http://loinc.org', code: 'LA33-6', display: 'Yes' } }]
    const result = mapResponseToObservations(qr)!
    const risk = result.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(risk?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
  })

  it('does NOT treat an opaque linkId as terminology', () => {
    // Same nine answers, but linkIds that are not LOINC-shaped. Recognition must
    // fail rather than guess — otherwise `linkIdAsCode` would be matching noise.
    const qr = JSON.parse(JSON.stringify(bhpPhq9)) as QuestionnaireResponseResource
    qr.item?.forEach((it, i) => { it.linkId = `question-${i + 1}` })
    expect(recognizeInstrument(qr)).toBeNull()
    expect(mapResponseToObservations(qr)).toBeNull()
  })
})

describe('deriveFromResponse — provenance stamping', () => {
  const notesOf = (o: unknown) => ((o as { note?: Array<{ text?: string }> }).note) ?? []

  it('stamps fallback Observations with a provenance note and augments the alert detail', () => {
    const qr = { id: 'qr-foreign-1', ...foreignCodedQr([0, 0, 0, 0, 0, 0, 0, 0, 2]) } as QuestionnaireResponseResource
    const derived = deriveFromResponse(qr)!
    expect(derived.observations.every(o => notesOf(o).some(n => /recognized via standardized item codes/.test(n.text ?? '')))).toBe(true)
    expect(derived.riskAlert.detail).toMatch(/Instrument recognized from standardized item codes/)
  })

  it('does NOT add provenance noise to a native (canonical-matched) QR', () => {
    const qr = { id: 'qr-native-1', ...nativeQr([0, 0, 0, 0, 0, 0, 0, 0, 2]) } as QuestionnaireResponseResource
    const derived = deriveFromResponse(qr)!
    expect(derived.riskAlert.detail).not.toMatch(/Instrument recognized from/)
    expect(derived.observations.every(o => !notesOf(o).some(n => /recognized via/.test(n.text ?? '')))).toBe(true)
  })

  it('does not opt into the shape heuristic by default', () => {
    const shapeQr = {
      id: 'qr-shape-1',
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://example.org/unknown',
      item: [1, 1, 1, 1, 1, 1, 1, 1, 2].map((s, i) => ({ linkId: `x${i}`, answer: [{ valueInteger: s }] })),
    } as unknown as QuestionnaireResponseResource
    expect(deriveFromResponse(shapeQr)).toBeNull()
  })
})

/**
 * #230 — the C-SSRS family. This is the case #60's HIE pilot is actually about:
 * a QuestionnaireResponse arriving from another EHR under that EHR's own
 * canonical, carrying LOINC item codes SPiER can recognize.
 *
 * The C-SSRS answer contract differs from PHQ-9's in a way that matters here: the
 * mappers read `valueBoolean` (getBooleanAnswer), while the Questionnaire declares
 * SNOMED Yes/No codings. Both foreign shapes are therefore exercised below.
 */
const SNOMED_YES = { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' }
const SNOMED_NO = { system: 'http://snomed.info/sct', code: '373067005', display: 'No' }

/** Screener item codes, q1..q6 + q6-recent (see the signature). */
const SCREENER_LOINC = ['93246-7', '93247-5', '93248-3', '93249-1', '93250-9', '93267-3', '93269-9']

/** A foreign C-SSRS screener QR. `answers` is keyed by LOINC item code. */
function foreignCssrs(
  answers: Record<string, unknown>,
  canonical = 'http://cerner.example.org/Questionnaire/cssrs-6item',
): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: canonical,
    item: Object.entries(answers).map(([code, answer], i) => ({
      linkId: `SITE-Q${i + 1}`,
      code: [{ system: 'http://loinc.org', code }],
      answer: [answer],
    })),
  } as unknown as QuestionnaireResponseResource
}

const riskLevelOf = (r: ReturnType<typeof mapResponseToObservations>) =>
  r?.observations
    .find(o => o.code?.coding?.[0]?.code === '93374-7')
    ?.valueCodeableConcept?.coding?.[0]?.code

describe('C-SSRS screener via Tier 2 (#230)', () => {
  it('derives a risk tier from a foreign canonical with SNOMED Yes/No answers', () => {
    const result = mapResponseToObservations(
      foreignCssrs({
        '93246-7': { valueCoding: SNOMED_YES },
        '93247-5': { valueCoding: SNOMED_YES },
        '93248-3': { valueCoding: SNOMED_YES },
        '93267-3': { valueCoding: SNOMED_NO },
      }),
    )!
    expect(result).not.toBeNull()
    expect(result.dispatch?.via).toBe('code')
    expect(result.dispatch?.recognizedCanonical).toBe('http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener')
    // q3 endorsed → ideation with method → moderate.
    expect(riskLevelOf(result)).toBe('moderate')
    expect(result.riskAlert.level).toBe('moderate')
  })

  it('accepts valueBoolean answers too — the shape the mapper itself reads', () => {
    const result = mapResponseToObservations(
      foreignCssrs({
        '93246-7': { valueBoolean: true },
        '93247-5': { valueBoolean: true },
        '93250-9': { valueBoolean: true },
      }),
    )!
    // q5 endorsed → specific plan and intent → high.
    expect(riskLevelOf(result)).toBe('high')
  })

  it('treats an enableWhen-skipped item as unasked, not as unreadable', () => {
    // q2 = No, so q3–q5 are never asked on the real form. That must still derive.
    const result = mapResponseToObservations(
      foreignCssrs({
        '93246-7': { valueCoding: SNOMED_YES },
        '93247-5': { valueCoding: SNOMED_NO },
      }),
    )!
    expect(result).not.toBeNull()
    expect(riskLevelOf(result)).toBe('low')
  })

  it('REFUSES the response when an answer is present but unreadable', () => {
    // A site-local yes/no vocabulary SPiER does not map. Scoring the rest would
    // read this endorsed item as a "No" and report a clean screen — so nothing is
    // derived.
    //
    // This case originally used LOINC `LA33-6` as its unreadable example. LOINC's
    // normative Yes/No pair is now accepted (the US Behavioral Health Profiles IG
    // answers with it — see `normalizeBooleanAnswer`), so the example moved to a
    // vocabulary that really is unmappable. The property under test is unchanged:
    // an answer that is *present but not understood* must refuse the whole
    // response, never be silently treated as absent.
    const result = mapResponseToObservations(
      foreignCssrs({
        '93246-7': { valueCoding: SNOMED_YES },
        '93250-9': { valueCoding: { system: 'http://acme-ehr.example.org/answers', code: 'Y', display: 'Yes' } },
      }),
    )
    expect(result).toBeNull()
  })
})

describe('C-SSRS variant disambiguation (#230)', () => {
  it('sends a full lifetime/recent QR to the full-form mapper, not the screener', () => {
    // Its codes include the screener's 7 as a subset, so "first signature over
    // the line" would have mis-recognized this as the screener.
    const result = mapResponseToObservations(
      foreignCssrs({
        '93299-6': { valueBoolean: true },  // q1-lifetime
        '93246-7': { valueBoolean: true },  // q1-recent
        '93298-8': { valueBoolean: true },  // q2-lifetime
        '93247-5': { valueBoolean: false }, // q2-recent
        '93253-3': { valueBoolean: true },  // actual attempt, lifetime
      }),
    )!
    expect(result.dispatch?.recognizedCanonical).toBe(
      'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Full-Lifetime-Recent',
    )
  })

  it('keeps a screener QR on the screener, which its codes cover completely', () => {
    const result = mapResponseToObservations(
      foreignCssrs(Object.fromEntries(SCREENER_LOINC.map(c => [c, { valueBoolean: false }]))),
    )!
    expect(result.dispatch?.recognizedCanonical).toBe(
      'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener',
    )
  })

  it('does not regress PHQ-9 recognition', () => {
    const result = mapResponseToObservations(foreignCodedQr([1, 2, 3, 0, 1, 2, 3, 0, 1]))!
    expect(result.dispatch?.recognizedCanonical).toBe('http://thespierproject.org/fhir/Questionnaire/PHQ-9')
  })
})
