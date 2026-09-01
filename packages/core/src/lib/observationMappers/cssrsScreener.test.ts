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
const CSSRS_SCREENER = 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener'
type CssrsAnswers = Partial<Record<'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q6-recent', boolean>>

const cssrsResponse = (answers: CssrsAnswers) => nativeQr(CSSRS_SCREENER, answers)

function riskCoding(r: ReturnType<typeof mapCSSRSScreener>) {
  return r.observations
    .find(o => o.code?.coding?.[0]?.code === '93374-7')
    ?.valueCodeableConcept?.coding?.[0]?.code
}

/** `Observation.note` is not on the trimmed ObservationResource type. */
const noteText = (o: unknown) =>
  (o as { note?: Array<{ text?: string }> } | undefined)?.note?.[0]?.text ?? ''

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

  // ── The published triage ladder (spec doc §"Published-instrument
  // verification (Phase 1b)"; pathway plan Phase 1c) ────────────────────────
  //
  // Two corrections shipped with that alignment, and these are the cases that
  // pin them. Both were previously green on the drifted answers, so a
  // regression here means the ladder slipped back, not that a fixture moved.

  it('q4 (some intent) alone → HIGH, not moderate — the published red band', () => {
    // The correction: q4 derived `moderate` for as long as the mapper existed.
    // CMS 2008 and Columbia 2026 both shade item 4 red, and Columbia's response
    // protocol gives it "Behavioral Health Consultation and Patient Safety
    // Precautions" — the high-tier action, same as item 5.
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: false, q4: true, q5: false, q6: false }))
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.summary).toBe('C-SSRS: HIGH Risk')
    // A q4-positive now gets the high-tier alert body, not the moderate one.
    expect(r.riskAlert.detail).toContain('emergency psychiatric evaluation')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
    expect(riskObs?.valueCodeableConcept?.text).toBe('High Risk — ideation with some intent')
  })

  it('q5 (specific plan + intent) → high risk (boundary: highest ideation)', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: false }))
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
  })

  it('q6 behavior lifetime-only (q6-recent unanswered) → MODERATE, not high', () => {
    // The other correction: q6 forced `high` regardless of recency. The
    // published instrument shades lifetime-only behavior orange — the same tier
    // as a lone q3. The diagram's separate "Historical" tier is deliberately not
    // implemented (plan open question 2).
    const r = mapCSSRSScreener(cssrsResponse({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: true }))
    expect(riskCoding(r)).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')
    // The narrative moved from `coding.display` to `text` (#302): a SPiER-local
    // `Coding.display` must match the CodeSystem, and the validator checks it.
    expect(riskObs?.valueCodeableConcept?.text).toBe('Moderate Risk — lifetime-only suicidal behavior')
    expect(noteText(riskObs)).toContain('Behavior: Yes (lifetime only, not within 3 months)')
  })

  it('q6 with q6-recent = No is lifetime-only too → moderate', () => {
    // An explicit "No" and an unanswered recency item mean the same thing; only
    // a Yes reaches the red band.
    const r = mapCSSRSScreener(cssrsResponse({ q1: false, q2: false, q6: true, 'q6-recent': false }))
    expect(riskCoding(r)).toBe('moderate')
  })

  it('q6 within the past 3 months → high risk', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: true, 'q6-recent': true }))
    expect(riskCoding(r)).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.valueCodeableConcept?.text).toBe('High Risk — suicidal behavior within past 3 months')
    expect(noteText(riskObs)).toContain('Behavior: Yes (within 3 months)')
  })

  it('behavior sets a floor, never an override — lifetime-only q6 cannot pull q5 down', () => {
    // The old code assigned the behavior tier outright, which was harmless only
    // while every positive q6 meant `high`. With lifetime-only q6 at moderate,
    // an override would DOWNGRADE a plan-and-intent screen to moderate.
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true, 'q6-recent': false }))
    expect(riskCoding(r)).toBe('high')
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    // Ideation wins the narrative because it is the strictly more severe half.
    expect(riskObs?.valueCodeableConcept?.text).toBe('High Risk — specific plan with intent')
  })

  it('lifetime-only q6 still raises a low ideation screen to moderate', () => {
    const r = mapCSSRSScreener(cssrsResponse({ q1: true, q2: true, q3: false, q4: false, q5: false, q6: true }))
    expect(riskCoding(r)).toBe('moderate')
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
