import { describe, it, expect } from 'vitest'
import { mapCSSRSPediatric } from '@spier/core/lib/observationMappers/cssrsPediatric'
import { nativeQr, booleanQr } from './__fixtures__/nativeQr'

// Answers are built from the Pediatric Questionnaire (SNOMED-coded Yes/No), not
// hand-written booleans — see __fixtures__/nativeQr.ts and issue #327.
const CSSRS_PEDIATRIC = 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Pediatric'
const pedResponse = (answers: Record<string, boolean>) => nativeQr(CSSRS_PEDIATRIC, answers)

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

  // The pediatric form carries the same nested `q6-recent` item as the adult
  // screener, so the published recency gate applies unchanged here — see the
  // ladder comment in cssrsScreener.ts and spec doc §1b.
  it('q4 (some intent) → high, matching the published red band', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: true, q2: true, q3: false, q4: true, q5: false, q6: false }))
    expect(riskCode(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
  })

  it('q6 behavior within the past 3 months → high', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: false, q2: false, q6: true, 'q6-recent': true }))
    expect(riskCode(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
  })

  it('q6 behavior lifetime-only → moderate, not high', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: false, q2: false, q6: true }))
    expect(riskCode(r)).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
  })

  it('all negative → none', () => {
    const r = mapCSSRSPediatric(pedResponse({ q1: false, q2: false, q6: false }))
    expect(riskCode(r)).toBe('none')
    expect(r.riskAlert.level).toBe('none')
  })

  // Both shapes read (#327): coded is what the form emits, valueBoolean is what
  // the foreign-payload normalizer (#230) produces.
  it('reads the normalized valueBoolean shape too', () => {
    const r = mapCSSRSPediatric(booleanQr(CSSRS_PEDIATRIC, { q5: true }))
    expect(riskCode(r)).toBe('high')
  })
})
