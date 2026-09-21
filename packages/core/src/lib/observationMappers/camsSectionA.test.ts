import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  CAMS_OVERALL_RISK_OPTIONS,
  CAMS_OVERALL_RISK_SYSTEM,
  mapCAMSSectionA,
} from '@spier/core/lib/observationMappers/camsSectionA'
import { tierForCodings } from '@spier/core/lib/conceptCrosswalk'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'

// CAMS SSF-5 Section A: six 1–5 integer ratings (linkId "<n>-score").
// n=6 is Overall Risk of Suicide, which also drives the LOINC risk-level obs.
function camsAResponse(scores: { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number }): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionA',
    item: [
      {
        linkId: 'core-ratings',
        item: ([1, 2, 3, 4, 5, 6] as const).map(n => ({
          linkId: `${n}-score`,
          answer: [{ valueInteger: scores[n] }],
        })),
      },
    ],
  } as QuestionnaireResponseResource
}

describe('mapCAMSSectionA', () => {
  it('a vital rated 4–5 → high alert with stabilization action', () => {
    const r = mapCAMSSectionA(camsAResponse({ 1: 4, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3 }))
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/cams-stabilization-plan')
    // psychological-pain vital rated 4 → elevated (H)
    const pain = r.observations.find(o => o.code?.coding?.[0]?.code === 'psychological-pain')
    expect(pain?.valueInteger).toBe(4)
    expect(pain?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
  })

  it('max vital 3 (boundary) → moderate alert with therapeutic-worksheet action', () => {
    const r = mapCAMSSectionA(camsAResponse({ 1: 3, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2 }))
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/cams-therapeutic-worksheet')
  })

  it('all vitals 1–2 → low alert, no suggested action', () => {
    const r = mapCAMSSectionA(camsAResponse({ 1: 2, 2: 1, 3: 2, 4: 1, 5: 2, 6: 2 }))
    expect(r.riskAlert.level).toBe('low')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('overall-risk (item 6) emits a LOINC risk-level Observation, CODED', () => {
    const r = mapCAMSSectionA(camsAResponse({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 5 }))
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    // ⚠️ Coded, not `valueInteger` — see the table in camsSectionA.ts. An
    // integer here is what left CAMS with no route into the concept layer
    // (#436), because the published crosswalk translates codes.
    expect(riskObs?.valueInteger).toBeUndefined()
    expect(riskObs?.valueCodeableConcept?.coding?.[0]).toEqual({
      system: CAMS_OVERALL_RISK_SYSTEM,
      code: '5',
      display: '5 — Extremely high risk',
    })
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
  })

  it('keeps the rating as an integer on the SSF vital, which the profile requires', () => {
    // `SPiERCAMSSSFVital` constrains `value[x] only integer`. Coding the
    // concept Observation must not have quietly re-typed the vital beside it.
    const r = mapCAMSSectionA(camsAResponse({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 5 }))
    const vital = r.observations.find(o => o.code?.coding?.[0]?.code === 'overall-risk')
    expect(vital?.valueInteger).toBe(5)
    expect(vital?.valueCodeableConcept).toBeUndefined()
  })

  it('the coded value reaches the shared tier through the PUBLISHED crosswalk', () => {
    // The point of the change: `ConceptMap/CAMSOverallRiskToRiskTier` was
    // published with nothing to translate. This is the end-to-end join.
    for (const [rating, tier] of [[1, 'low'], [3, 'moderate'], [5, 'high']] as const) {
      const r = mapCAMSSectionA(camsAResponse({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: rating }))
      const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
      expect(tierForCodings(riskObs?.valueCodeableConcept?.coding), `rating ${rating}`).toBe(tier)
    }
  })

  it('emits no concept Observation for a rating the published CodeSystem has no code for', () => {
    // Unreachable from a conformant response (the SSF scale is 1–5), and the
    // alternative would be inventing a code on a published CodeSystem.
    const r = mapCAMSSectionA(camsAResponse({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 9 }))
    expect(r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')).toBeUndefined()
    // The rating itself is not lost.
    expect(r.observations.find(o => o.code?.coding?.[0]?.code === 'overall-risk')?.valueInteger).toBe(9)
  })
})

describe('the overall-risk table against the published CodeSystem', () => {
  it('carries exactly the codes and displays cams.fsh publishes', () => {
    // ⚠️ Hand-written codes and displays, so this is what keeps them true. A
    // display that drifts would also fail `validate-fhir.mjs` — but only on a
    // full validator run with Java, which is not part of `npm run verify`.
    // Read from the generated artifact, never restated.
    const cs = JSON.parse(
      readFileSync(
        new URL(
          '../../../../fhir-artifacts/generated/CodeSystem-cams-ssf-overall-risk.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { url?: string; concept?: Array<{ code: string; display: string }> }
    // Reading nothing must not pass: an empty CodeSystem would make the two
    // sets trivially comparable in the wrong direction.
    expect(cs.concept?.length).toBeGreaterThan(0)
    expect(cs.url).toBe(CAMS_OVERALL_RISK_SYSTEM)
    expect(CAMS_OVERALL_RISK_OPTIONS).toEqual(
      cs.concept!.map(c => ({ code: c.code, display: c.display })),
    )
  })
})
