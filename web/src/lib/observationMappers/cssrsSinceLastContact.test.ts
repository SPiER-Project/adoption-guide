import { describe, it, expect } from 'vitest'
import { mapCSSRSSinceLastContact } from './cssrsSinceLastContact'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// The C-SSRS mapper reads booleans (getBooleanAnswer → valueBoolean), matching
// the existing C-SSRS Screener test contract.
function slvResponse(answers: Record<string, boolean>): QuestionnaireResponseResource {
  const items = Object.entries(answers).map(([linkId, valueBoolean]) => ({
    linkId,
    answer: [{ valueBoolean }],
  }))
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/C-SSRS-Since-Last-Contact',
    item: items,
  } as QuestionnaireResponseResource
}

function riskObs(r: ReturnType<typeof mapCSSRSSinceLastContact>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
}

describe('mapCSSRSSinceLastContact', () => {
  it('reuses the screener risk logic: q5 → high, labelled "Since Last Visit"', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: true, q2: true, q3: true, q4: true, q5: true }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.tool).toBe('C-SSRS Since Last Visit')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('q3 only → moderate', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: false, q2: true, q3: true, q4: false, q5: false }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
  })

  it('q1 only → low', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: true, q2: false }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('low')
  })

  it('behavior (q6) over the interval overrides to high', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: false, q2: false, q6: true }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
    expect(r.riskAlert.level).toBe('high')
  })

  it('all negative → none', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: false, q2: false, q6: false }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('none')
    expect(r.riskAlert.level).toBe('none')
  })

  it('emits per-item LOINC Observations tagged with the Since Last Visit label', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: true, q2: false }))
    const q1Obs = r.observations.find(o => o.code?.coding?.[0]?.code === '93246-7') as
      | { valueBoolean?: boolean; note?: Array<{ text?: string }> }
      | undefined
    expect(q1Obs?.valueBoolean).toBe(true)
    expect(q1Obs?.note?.[0]?.text ?? '').toContain('C-SSRS Since Last Visit')
  })
})
