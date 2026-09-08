import { describe, it, expect } from 'vitest'
import { mapASQ } from '@spier/core/lib/observationMappers/asq'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'

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
    questionnaire: 'http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool',
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

  // The per-item codes are LOINC as of LOINC 2.83 (panel 115564-7). They were
  // SPiER-local `asq-item` codes until then, and twice before that they were
  // wrong (#220: C-SSRS panel members, then codes that did not exist). This
  // asserts the system as well as the codes, because every one of those defects
  // would have passed a code-only assertion.
  it('emits per-item Observations bound to the published LOINC ASQ item codes', () => {
    const r = mapASQ(asqResponse({ q1: true, q2: false, q3: false, q4: false, q5: false }))
    const itemObs = r.observations.filter(o => o.code?.coding?.[0]?.system === 'http://loinc.org')
    // one per answered item (q1–q5); the disposition Observation carries 93374-7.
    const itemCodes = itemObs.map(o => o.code?.coding?.[0]?.code).filter(c => c !== '93374-7')
    expect(itemCodes).toEqual(['115566-2', '115567-0', '115568-8', '115569-6', '115571-2'])
    expect(itemObs.some(o => o.code?.coding?.[0]?.code === '93374-7')).toBe(true)
  })

  it('emits no SPiER-local asq-item codings — that CodeSystem is deleted', () => {
    const r = mapASQ(asqResponse({ q1: true, q2: true, q3: true, q4: true, q5: true }))
    const systems = r.observations.flatMap(o => o.code?.coding?.map(c => c.system) ?? [])
    expect(systems).not.toContain('http://thespierproject.org/fhir/CodeSystem/asq-item')
  })
})
