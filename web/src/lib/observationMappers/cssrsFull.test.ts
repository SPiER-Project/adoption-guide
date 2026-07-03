import { describe, it, expect } from 'vitest'
import { mapCSSRSFull } from './cssrsFull'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// C-SSRS Full uses per-level lifetime/recent boolean items plus attempt items.
type FullAnswers = Partial<Record<string, boolean>>

function fullResponse(answers: FullAnswers): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent',
    item: Object.entries(answers).map(([linkId, valueBoolean]) => ({
      linkId,
      answer: [{ valueBoolean }],
    })),
  } as QuestionnaireResponseResource
}

function riskCoding(r: ReturnType<typeof mapCSSRSFull>) {
  return r.observations
    .find(o => o.code?.coding?.[0]?.code === '93374-7')
    ?.valueCodeableConcept?.coding?.[0]?.code
}

describe('mapCSSRSFull', () => {
  it('recent ideation level 5 → high risk', () => {
    const r = mapCSSRSFull(fullResponse({ 'q5-recent': true, 'q5-lifetime': true }))
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('recent attempt → high risk even without high ideation', () => {
    const r = mapCSSRSFull(fullResponse({ 'q1-recent': true, 'actual-attempt-recent': true }))
    expect(riskCoding(r)).toBe('high')
  })

  it('recent ideation level 3 (boundary) → moderate risk', () => {
    const r = mapCSSRSFull(fullResponse({ 'q3-recent': true, 'q1-recent': true }))
    expect(riskCoding(r)).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
  })

  it('recent ideation level 2 (below moderate boundary) → low risk', () => {
    const r = mapCSSRSFull(fullResponse({ 'q2-recent': true, 'q1-recent': true }))
    expect(riskCoding(r)).toBe('low')
    expect(r.riskAlert.level).toBe('low')
  })

  it('lifetime attempt only, no recent ideation → low (historical)', () => {
    const r = mapCSSRSFull(fullResponse({ 'actual-attempt-lifetime': true, 'q3-lifetime': true }))
    expect(riskCoding(r)).toBe('low')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.valueCodeableConcept?.coding?.[0]?.display).toContain('historical')
  })

  it('all negative → no risk identified', () => {
    const r = mapCSSRSFull(fullResponse({ 'q1-recent': false, 'q1-lifetime': false }))
    expect(riskCoding(r)).toBe('none')
    expect(r.riskAlert.level).toBe('none')
  })
})
