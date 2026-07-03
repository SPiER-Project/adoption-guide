import { describe, it, expect } from 'vitest'
import { mapPHQ9 } from './phq9'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// PHQ-9 answerOption ordinals (from FHIR-Resources/PHQ-9/phq9-questionnaire.json):
//   LA6568-5 = 0 (Not at all)
//   LA6569-3 = 1 (Several days)
//   LA6570-1 = 2 (More than half the days)
//   LA6571-9 = 3 (Nearly every day)
// The mapper resolves scores by joining these codes back to the Questionnaire
// (SDC weight() semantics), so fixtures carry codes, not pre-summed integers.
const CODE = {
  0: 'LA6568-5',
  1: 'LA6569-3',
  2: 'LA6570-1',
  3: 'LA6571-9',
} as const

/**
 * Build a PHQ-9 QuestionnaireResponse from a 9-length array of per-item
 * ordinal scores (0–3). Item 9 (`q9`) is the suicide-risk gateway.
 */
function phq9Response(scores: number[]): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/PHQ-9',
    item: scores.map((s, i) => ({
      linkId: `q${i + 1}`,
      answer: [{ valueCoding: { system: 'http://loinc.org', code: CODE[s as 0 | 1 | 2 | 3] } }],
    })),
  } as QuestionnaireResponseResource
}

describe('mapPHQ9', () => {
  it('emits a total-score Observation with the correct LOINC code and summed value', () => {
    // 2+2+1+1+0+0+0+0+0 = 6 → Mild
    const { observations } = mapPHQ9(phq9Response([2, 2, 1, 1, 0, 0, 0, 0, 0]))
    const total = observations.find(o => o.code?.coding?.[0]?.code === '44261-6')
    expect(total).toBeDefined()
    expect(total?.code?.coding?.[0]?.system).toBe('http://loinc.org')
    expect(total?.valueInteger).toBe(6)
    expect(total?.interpretation?.[0]?.coding?.[0]?.code).toBe('L') // Mild
  })

  it('prefers a renderer-computed total-score item over re-summing', () => {
    const resp = phq9Response([1, 1, 1, 1, 1, 1, 1, 1, 0])
    resp.item!.push({ linkId: 'total-score', answer: [{ valueInteger: 21 }] })
    const { observations } = mapPHQ9(resp)
    const total = observations.find(o => o.code?.coding?.[0]?.code === '44261-6')
    expect(total?.valueInteger).toBe(21)
    expect(total?.interpretation?.[0]?.coding?.[0]?.code).toBe('HH') // Severe (>=20)
  })

  it('classifies severity bands from the total score', () => {
    // Minimal (<5): all zero
    expect(
      mapPHQ9(phq9Response([0, 0, 0, 0, 0, 0, 0, 0, 0])).observations
        .find(o => o.code?.coding?.[0]?.code === '44261-6')?.interpretation?.[0]?.coding?.[0]?.code,
    ).toBe('N')
    // Moderate (10–14): 2*5 = 10
    expect(
      mapPHQ9(phq9Response([2, 2, 2, 2, 2, 0, 0, 0, 0])).observations
        .find(o => o.code?.coding?.[0]?.code === '44261-6')?.interpretation?.[0]?.coding?.[0]?.code,
    ).toBe('H')
  })

  it('item 9 positive with score >= 2 → high risk alert + positive item-9 interpretation', () => {
    // q9 = 2 (More than half the days)
    const { observations, riskAlert } = mapPHQ9(phq9Response([0, 0, 0, 0, 0, 0, 0, 0, 2]))
    const item9 = observations.find(o => o.code?.coding?.[0]?.code === '44260-8')
    expect(item9?.valueInteger).toBe(2)
    expect(item9?.interpretation?.[0]?.coding?.[0]?.code).toBe('A') // positive

    expect(riskAlert.tool).toBe('PHQ-9')
    expect(riskAlert.level).toBe('high')
    expect(riskAlert.suggestedAction?.path).toBe('/patient/assessments/asq')
  })

  it('item 9 positive with score 1 → moderate risk alert (boundary)', () => {
    const { riskAlert } = mapPHQ9(phq9Response([0, 0, 0, 0, 0, 0, 0, 0, 1]))
    expect(riskAlert.level).toBe('moderate')
    expect(riskAlert.summary).toContain('Item 9 positive')
  })

  it('item 9 negative → no suicide alert; item-9 interpretation is negative', () => {
    // Total 10 (moderate depression) but q9 = 0
    const { observations, riskAlert } = mapPHQ9(phq9Response([2, 2, 2, 2, 2, 0, 0, 0, 0]))
    const item9 = observations.find(o => o.code?.coding?.[0]?.code === '44260-8')
    expect(item9?.valueInteger).toBe(0)
    expect(item9?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    // Item 9 negative but total >= 10 → 'low', not a suicide-gateway alert
    expect(riskAlert.level).toBe('low')
    expect(riskAlert.suggestedAction).toBeUndefined()
  })

  it('item 9 negative and low total → risk level none', () => {
    const { riskAlert } = mapPHQ9(phq9Response([1, 0, 0, 0, 0, 0, 0, 0, 0]))
    expect(riskAlert.level).toBe('none')
  })
})
