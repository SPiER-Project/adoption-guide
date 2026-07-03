import { describe, it, expect } from 'vitest'
import { mapASQ } from './asq'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// ASQ answers are SNOMED-coded Yes/No (see getYesNoBoolean in shared.ts).
const YES = { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' }
const NO = { system: 'http://snomed.info/sct', code: '373067005', display: 'No' }

/**
 * Build an ASQ QuestionnaireResponse. q1–q4 are the risk items, q5 the acuity
 * item. Structure mirrors the real scenario JSON (items nested under
 * screening/acuity groups) to exercise walkItems' recursion.
 */
function asqResponse(answers: { q1: boolean; q2: boolean; q3: boolean; q4: boolean; q5: boolean }): QuestionnaireResponseResource {
  const code = (b: boolean) => (b ? YES : NO)
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/ASQ-Screening-Tool',
    item: [
      {
        linkId: 'screening-questions',
        item: [
          { linkId: 'q1', answer: [{ valueCoding: code(answers.q1) }] },
          { linkId: 'q2', answer: [{ valueCoding: code(answers.q2) }] },
          { linkId: 'q3', answer: [{ valueCoding: code(answers.q3) }] },
          { linkId: 'q4', answer: [{ valueCoding: code(answers.q4) }] },
        ],
      },
      {
        linkId: 'acuity-section',
        item: [{ linkId: 'q5', answer: [{ valueCoding: code(answers.q5) }] }],
      },
    ],
  } as QuestionnaireResponseResource
}

function resultCoding(r: ReturnType<typeof mapASQ>) {
  return r.observations
    .find(o => o.code?.coding?.[0]?.code === '93374-7')
    ?.valueCodeableConcept?.coding?.[0]
}

describe('mapASQ', () => {
  it('acute positive: any of q1–q4 yes AND q5 (acuity) yes', () => {
    const r = mapASQ(asqResponse({ q1: true, q2: false, q3: false, q4: false, q5: true }))
    expect(resultCoding(r)?.code).toBe('acute-positive')
    // result Observation carries an "A" interpretation for any positive
    const result = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(result?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')

    expect(r.riskAlert.level).toBe('acute')
    expect(r.riskAlert.tool).toBe('ASQ')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('non-acute positive: a risk item yes but q5 (acuity) no', () => {
    const r = mapASQ(asqResponse({ q1: true, q2: true, q3: false, q4: false, q5: false }))
    expect(resultCoding(r)?.code).toBe('non-acute-positive')
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('q4 (ever attempted) alone drives a non-acute positive', () => {
    const r = mapASQ(asqResponse({ q1: false, q2: false, q3: false, q4: true, q5: false }))
    expect(resultCoding(r)?.code).toBe('non-acute-positive')
  })

  it('acuity q5 yes but all risk items no → still negative (anyPositive gate)', () => {
    // Boundary: q5 alone does NOT flip the screen positive.
    const r = mapASQ(asqResponse({ q1: false, q2: false, q3: false, q4: false, q5: true }))
    expect(resultCoding(r)?.code).toBe('negative')
    expect(r.riskAlert.level).toBe('none')
  })

  it('all no → negative screen with N interpretation and no suggested action', () => {
    const r = mapASQ(asqResponse({ q1: false, q2: false, q3: false, q4: false, q5: false }))
    expect(resultCoding(r)?.code).toBe('negative')
    const result = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(result?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('emits per-item Observations bound to the SPiER-local asq-item system', () => {
    const r = mapASQ(asqResponse({ q1: true, q2: false, q3: false, q4: false, q5: false }))
    const itemObs = r.observations.filter(
      o => o.code?.coding?.[0]?.system === 'http://spier.org/CodeSystem/asq-item',
    )
    // one per answered item (q1–q5)
    expect(itemObs).toHaveLength(5)
    expect(itemObs.map(o => o.code?.coding?.[0]?.code)).toContain('wished-dead')
  })
})
