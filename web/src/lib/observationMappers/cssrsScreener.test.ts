import { describe, it, expect } from 'vitest'
import { mapCSSRSScreener } from '@spier/core/lib/observationMappers/cssrsScreener'
import { nativeQr, booleanQr } from './__fixtures__/nativeQr'

/**
 * ⚠️ These responses are built from the C-SSRS Screener Questionnaire itself.
 *
 * This file used to open `// C-SSRS Screener items are plain booleans` and
 * hand-build `valueBoolean` items — which is how #327 stayed invisible: the
 * Questionnaire declares every item as `choice` bound to SNOMED Yes/No, the
 * mapper read `valueBoolean` only, and this suite was green the whole time a
 * q5-endorsed screen derived "No risk identified" in the app. `nativeQr` reads
 * the answer shape off the form, so the suite can no longer certify the mapper
 * against input the app does not produce.
 */
const CSSRS_SCREENER = 'http://spier.org/Questionnaire/C-SSRS-Screener'
type CssrsAnswers = Partial<Record<'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q6-recent', boolean>>

const cssrsResponse = (answers: CssrsAnswers) => nativeQr(CSSRS_SCREENER, answers)

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
    // The narrative moved from `coding.display` to `text` (#302): a SPiER-local
    // `Coding.display` must match the CodeSystem, and the validator checks it.
    expect(riskObs?.valueCodeableConcept?.text).toContain('lifetime')
  })

  it('q6 with q6-recent → high risk flagged within past 3 months', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: true, 'q6-recent': true }))
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    // The narrative moved from `coding.display` to `text` (#302): a SPiER-local
    // `Coding.display` must match the CodeSystem, and the validator checks it.
    expect(riskObs?.valueCodeableConcept?.text).toContain('past 3 months')
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

  // #327 in the shape it was actually observed: the app's own form, q1/q2/q5
  // endorsed, deriving "No risk identified".
  it('reads the coded answers the app emits — q5 Yes is high, not none', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q5: true }))
    const q5Answer = nativeQr(CSSRS_SCREENER, { q5: true }).item?.[0]?.item?.[0]?.answer?.[0]
    // Guard the fixture itself: if this stops being a SNOMED coding, the test
    // above stops testing what the app produces.
    expect(q5Answer?.valueCoding).toEqual({ system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' })
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.summary).toBe('C-SSRS: HIGH Risk')
  })

  // The foreign-payload path (#230) normalizes to valueBoolean, so both shapes
  // must keep reading — that inversion (foreign right, native wrong) was #327's
  // tell, and it stays fixed only while this passes alongside the case above.
  it('still reads the normalized valueBoolean shape a foreign QR arrives as', () => {
    const r = mapCSSRSScreener(booleanQr(CSSRS_SCREENER, { q1: true, q2: true, q5: true }))
    expect(riskCoding(r)).toBe('high')
  })
})
