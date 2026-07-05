import { describe, it, expect } from 'vitest'
import { mapResponseToObservations } from './index'
import { recognizeInstrument, normalizeToSpierQr, INSTRUMENT_SIGNATURES } from './fallbackDispatch'
import { deriveFromResponse } from '../deriveFromResponse'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// SPiER PHQ-9 answer-option ordinals (FHIR-Resources/PHQ-9/phq9-questionnaire.json).
const LA = { 0: 'LA6568-5', 1: 'LA6569-3', 2: 'LA6570-1', 3: 'LA6571-9' } as const
// LOINC per-item codes q1..q9 (same order as the SPiER Questionnaire items).
const ITEM_LOINC = ['44250-9', '44255-8', '44259-0', '44254-1', '44251-7', '44258-2', '44252-5', '44253-3', '44260-8']

/** Native SPiER PHQ-9 QR — dispatches via canonical (Tier 1). */
function nativeQr(scores: number[]): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/PHQ-9',
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
    expect(foreign.dispatch?.recognizedCanonical).toBe('http://spier.org/Questionnaire/PHQ-9')
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
    const normalized = normalizeToSpierQr(foreignCodedQr([1, 2, 3, 0, 1, 2, 3, 0, 1]), sig)
    expect(normalized.questionnaire).toBe('http://spier.org/Questionnaire/PHQ-9')
    expect(normalized.item?.map(i => i.linkId)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'])
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
