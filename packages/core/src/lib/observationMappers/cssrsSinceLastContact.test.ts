import { describe, it, expect } from 'vitest'
import { mapCSSRSSinceLastContact } from '@spier/core/lib/observationMappers/cssrsSinceLastContact'
import { nativeQr, booleanQr } from './__fixtures__/nativeQr'

// Answers built from the Since-Last-Contact Questionnaire (SNOMED-coded Yes/No)
// rather than hand-written booleans — see __fixtures__/nativeQr.ts, issue #327.
const CSSRS_SLC = 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Since-Last-Contact'
const slvResponse = (answers: Record<string, boolean>) => nativeQr(CSSRS_SLC, answers)

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

  it('q4 (some intent) → high, matching the published red band', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: true, q2: true, q3: false, q4: true, q5: false }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
    expect(r.riskAlert.level).toBe('high')
  })

  // ⚠️ The per-variant difference the ladder alignment turns on. The published
  // gate for behavior is "within the past 3 months", and the Screener and
  // Pediatric forms establish that with a nested `q6-recent` item. THIS FORM HAS
  // NO SUCH ITEM — every question is framed to the period since the patient's
  // last visit or contact, so a positive q6 is recent by construction. Reading
  // the absent `q6-recent` as "lifetime-only" would score this `moderate` and
  // silently downgrade the one variant whose whole purpose is interval
  // surveillance; `behaviorRecency: 'interval'` in the mapper is what prevents
  // it, and this case is what would catch its removal.
  it('behavior (q6) over the interval is recent by construction → high', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: false, q2: false, q6: true }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
    expect(r.riskAlert.level).toBe('high')
    expect(riskObs(r)?.valueCodeableConcept?.text).toBe('High Risk — suicidal behavior since last contact')
    const note = (riskObs(r) as { note?: Array<{ text?: string }> } | undefined)?.note?.[0]?.text ?? ''
    expect(note).toContain('Behavior: Yes (since last contact)')
  })

  it('all negative → none', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: false, q2: false, q6: false }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('none')
    expect(r.riskAlert.level).toBe('none')
  })

  it('emits per-item Observations tagged with the Since Last Visit label', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: true, q2: false }))
    const q1Obs = r.observations.find(o => o.code?.coding?.[0]?.code === 'wish-to-be-dead') as
      | { valueBoolean?: boolean; note?: Array<{ text?: string }> }
      | undefined
    expect(q1Obs?.valueBoolean).toBe(true)
    expect(q1Obs?.note?.[0]?.text ?? '').toContain('C-SSRS Since Last Visit')
  })

  it('codes per-item Observations locally, never with a LOINC timeframe code', () => {
    // LOINC's C-SSRS item codes all assert a window (Lifetime / 1 month / 3 months);
    // none matches "since last contact", so reusing one here would misstate the
    // reference period to a receiving system. Issue #220.
    const r = mapCSSRSSinceLastContact(
      slvResponse({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true }),
    )
    const perItem = r.observations.filter(o => o.code?.coding?.[0]?.code !== '93374-7')
    expect(perItem).toHaveLength(6)
    for (const obs of perItem) {
      expect(obs.code?.coding?.[0]?.system).toBe('http://thespierproject.org/fhir/CodeSystem/cssrs-interval-item')
    }
  })

  it('still derives the shared timeframe-agnostic risk-level Observation', () => {
    const r = mapCSSRSSinceLastContact(slvResponse({ q1: true, q2: true, q5: true }))
    expect(riskObs(r)?.code?.coding?.[0]?.code).toBe('93374-7')
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
  })

  // Both shapes read (#327): coded is the form's, valueBoolean is the foreign-
  // payload normalizer's (#230).
  it('reads the normalized valueBoolean shape too', () => {
    const r = mapCSSRSSinceLastContact(booleanQr(CSSRS_SLC, { q5: true }))
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
  })
})
