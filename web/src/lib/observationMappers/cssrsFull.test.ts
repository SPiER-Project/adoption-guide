import { describe, it, expect } from 'vitest'
import { mapCSSRSFull } from '@spier/core/lib/observationMappers/cssrsFull'
import { nativeQr, booleanQr } from './__fixtures__/nativeQr'

// C-SSRS Full asks each ideation level as a lifetime/recent pair. Every one is a
// `choice` item bound to SNOMED Yes/No, so the answers here are built from the
// Questionnaire — see __fixtures__/nativeQr.ts and issue #327.
const CSSRS_FULL = 'http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent'
type FullAnswers = Record<string, boolean>

const fullResponse = (answers: FullAnswers) => nativeQr(CSSRS_FULL, answers)

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
    // The narrative moved from `coding.display` to `text` (#302): a SPiER-local
    // `Coding.display` must match the CodeSystem, and the validator checks it.
    expect(riskObs?.valueCodeableConcept?.text).toContain('historical')
  })

  it('all negative → no risk identified', () => {
    const r = mapCSSRSFull(fullResponse({ 'q1-recent': false, 'q1-lifetime': false }))
    expect(riskCoding(r)).toBe('none')
    expect(r.riskAlert.level).toBe('none')
  })

  // Both shapes read (#327): coded is the form's, valueBoolean is the foreign-
  // payload normalizer's (#230).
  it('reads the normalized valueBoolean shape too', () => {
    const r = mapCSSRSFull(booleanQr(CSSRS_FULL, { 'q5-recent': true }))
    expect(riskCoding(r)).toBe('high')
  })
})
