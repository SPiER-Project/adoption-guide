import { describe, it, expect } from 'vitest'
import { mapCSSRSFull } from '@spier/core/lib/observationMappers/cssrsFull'
import { nativeQr, booleanQr } from './__fixtures__/nativeQr'

// C-SSRS Full asks each ideation level as a lifetime/recent pair. Every one is a
// `choice` item bound to SNOMED Yes/No, so the answers here are built from the
// Questionnaire — see __fixtures__/nativeQr.ts and issue #327.
const CSSRS_FULL = 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Full-Lifetime-Recent'
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

  // ── The published triage ladder, applied to the full form (spec doc §1b,
  // pathway plan Phase 1c) ─────────────────────────────────────────────────

  it('recent ideation level 4 (some intent) → HIGH, not moderate', () => {
    // The correction: `highestRecent >= 5` was the high boundary, so level 4
    // scored moderate. Both published sources put item 4 in the red band.
    const r = mapCSSRSFull(fullResponse({ 'q4-recent': true, 'q4-lifetime': true, 'q1-recent': true }))
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
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

  it('lifetime-only attempt, no recent ideation → MODERATE, not low', () => {
    // The other correction: a lifetime-only attempt scored `low — historical
    // behavior`. The published instrument scores lifetime-only behavior in the
    // orange band — the same tier as a lone item 3. The diagram's separate
    // "Historical" tier is deliberately not implemented (plan open question 2).
    const r = mapCSSRSFull(fullResponse({ 'actual-attempt-lifetime': true, 'q3-lifetime': true }))
    expect(riskCoding(r)).toBe('moderate')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    // The narrative moved from `coding.display` to `text` (#302): a SPiER-local
    // `Coding.display` must match the CodeSystem, and the validator checks it.
    expect(riskObs?.valueCodeableConcept?.text).toBe('Moderate Risk — lifetime-only suicide attempt')
  })

  it('a lifetime-only attempt is a floor, not an override — it cannot pull level 5 down', () => {
    const r = mapCSSRSFull(fullResponse({ 'q5-recent': true, 'q5-lifetime': true, 'actual-attempt-lifetime': true }))
    expect(riskCoding(r)).toBe('high')
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
