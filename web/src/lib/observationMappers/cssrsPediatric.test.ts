import { describe, it, expect } from 'vitest'
import { mapCSSRSPediatric } from './cssrsPediatric'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// The C-SSRS mapper reads booleans (getBooleanAnswer → valueBoolean).
function pedResponse(answers: Record<string, boolean>): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/C-SSRS-Pediatric',
    item: Object.entries(answers).map(([linkId, valueBoolean]) => ({ linkId, answer: [{ valueBoolean }] })),
  } as QuestionnaireResponseResource
}

function riskCode(r: ReturnType<typeof mapCSSRSPediatric>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')?.valueCodeableConcept?.coding?.[0]?.code
}

describe('mapCSSRSPediatric', () => {
  it('q5 → high, labelled "C-SSRS Pediatric"', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: false }))
    expect(riskCode(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.tool).toBe('C-SSRS Pediatric')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('q3 only → moderate', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: false, q2: true, q3: true, q4: false, q5: false, q6: false }))
    expect(riskCode(r)).toBe('moderate')
  })

  it('q1 only → low', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: true, q2: false }))
    expect(riskCode(r)).toBe('low')
  })

  it('q6 behavior overrides to high (recency note)', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: false, q2: false, q6: true, 'q6-recent': true }))
    expect(riskCode(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
  })

  it('all negative → none', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: false, q2: false, q6: false }))
    expect(riskCode(r)).toBe('none')
    expect(r.riskAlert.level).toBe('none')
  })
})
