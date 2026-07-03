import { describe, it, expect } from 'vitest'
import { mapCAMSSectionA } from './camsSectionA'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// CAMS SSF-5 Section A: six 1–5 integer ratings (linkId "<n>-score").
// n=6 is Overall Risk of Suicide, which also drives the LOINC risk-level obs.
function camsAResponse(scores: { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number }): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/CAMS-SSF5-SectionA',
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

  it('overall-risk (item 6) emits a LOINC risk-level Observation', () => {
    const r = mapCAMSSectionA(camsAResponse({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 5 }))
    const riskObs = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(riskObs?.valueInteger).toBe(5)
    expect(riskObs?.interpretation?.[0]?.coding?.[0]?.code).toBe('H')
  })
})
