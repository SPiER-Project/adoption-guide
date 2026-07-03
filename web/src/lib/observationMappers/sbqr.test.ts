import { describe, it, expect } from 'vitest'
import { mapSBQR } from './sbqr'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// SBQ-R answerOption codes → ordinal (from FHIR-Resources/SBQ-R/sbqr-questionnaire.json):
//   q1: "1"=1 "2"=2 "3a/3b"=3 "4a/4b"=4   (own CodeSystem per item)
//   q2: "1"=1 … "5"=5
//   q3: "1"=1 "2a/2b"=2 "3a/3b"=3
//   q4: "0"=0 … "6"=6
// The mapper joins these codes back to the Questionnaire for the total.
function sbqrResponse(codes: { q1: string; q2: string; q3: string; q4: string }): QuestionnaireResponseResource {
  const sys = (q: string) => `http://spier.org/CodeSystem/sbqr-${q}`
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/SBQ-R',
    item: (['q1', 'q2', 'q3', 'q4'] as const).map(q => ({
      linkId: q,
      answer: [{ valueCoding: { system: sys(q), code: codes[q] } }],
    })),
  } as QuestionnaireResponseResource
}

function total(r: ReturnType<typeof mapSBQR>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '225337009')
}

describe('mapSBQR', () => {
  it('below general cutoff (<7) → risk none, N interpretation', () => {
    // 1 + 1 + 1 + 0 = 3
    const r = mapSBQR(sbqrResponse({ q1: '1', q2: '1', q3: '1', q4: '0' }))
    expect(total(r)?.valueInteger).toBe(3)
    expect(total(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.level).toBe('none')
  })

  it('exactly 7 → above general cutoff only (boundary) → moderate', () => {
    // 3 + 3 + 1 + 0 = 7  (>=7 general, <8 inpatient)
    const r = mapSBQR(sbqrResponse({ q1: '3a', q2: '3', q3: '1', q4: '0' }))
    expect(total(r)?.valueInteger).toBe(7)
    expect(total(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/asq')
  })

  it('exactly 8 → above inpatient cutoff (boundary) → high', () => {
    // 3 + 3 + 1 + 1 = 8
    const r = mapSBQR(sbqrResponse({ q1: '3a', q2: '3', q3: '1', q4: '1' }))
    expect(total(r)?.valueInteger).toBe(8)
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('prefers a renderer-computed total-score item', () => {
    const resp = sbqrResponse({ q1: '1', q2: '1', q3: '1', q4: '0' })
    resp.item!.push({ linkId: 'total-score', answer: [{ valueInteger: 12 }] })
    const r = mapSBQR(resp)
    expect(total(r)?.valueInteger).toBe(12)
    expect(r.riskAlert.level).toBe('high')
  })
})
