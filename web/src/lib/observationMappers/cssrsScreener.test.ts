import { describe, it, expect } from 'vitest'
import { mapCSSRSScreener } from './cssrsScreener'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// C-SSRS Screener items are plain booleans (getBooleanAnswer).
type CssrsAnswers = Partial<Record<'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q6-recent', boolean>>

function cssrsResponse(answers: CssrsAnswers): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/C-SSRS-Screener',
    item: Object.entries(answers).map(([linkId, valueBoolean]) => ({
      linkId,
      answer: [{ valueBoolean }],
    })),
  } as QuestionnaireResponseResource
}

function riskCoding(r: ReturnType<typeof mapCSSRSScreener>) {
  return r.observations
    .find(o => o.code?.coding?.[0]?.code === '93374-7')
    ?.valueCodeableConcept?.coding?.[0]?.code
}

describe('mapCSSRSScreener', () => {
  it('q1 only (wish to be dead) → low risk', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: false, q3: false, q4: false, q5: false, q6: false }))
    expect(riskCoding(r)).toBe('low')
    expect(r.riskAlert.level).toBe('low')
    // low risk gives crisis resources but no safety-plan action
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('q3 (method, no intent) → moderate risk with safety-plan action', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: true, q4: false, q5: false, q6: false }))
    expect(riskCoding(r)).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('q5 (specific plan + intent) → high risk (boundary: highest ideation)', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: false }))
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
  })

  it('q6 behavior overrides ideation-only to high even when q1–q5 are moderate', () => {
    // Highest ideation is q3 (moderate) but a positive behavior forces high.
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: true, q4: false, q5: false, q6: true }))
    expect(riskCoding(r)).toBe('high')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.valueCodeableConcept?.coding?.[0]?.display).toContain('lifetime')
  })

  it('q6 with q6-recent → high risk flagged within past 3 months', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: true, 'q6-recent': true }))
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.valueCodeableConcept?.coding?.[0]?.display).toContain('past 3 months')
  })

  it('all negative → no risk identified', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: false }))
    expect(riskCoding(r)).toBe('none')
    expect(r.riskAlert.level).toBe('none')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
  })

  it('emits a boolean Observation per answered ideation/behavior item with LOINC codes', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: false, q3: false, q4: false, q5: false, q6: false }))
    const q1Obs = r.observations.find(o => o.code?.coding?.[0]?.code === '93246-7')
    expect(q1Obs?.valueBoolean).toBe(true)
    expect(q1Obs?.code?.coding?.[0]?.system).toBe('http://loinc.org')
  })
})
