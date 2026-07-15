import { describe, it, expect } from 'vitest'
import { mapPSSFull } from './pssFull'
import type { QuestionnaireResponseResource } from '../../types/fhir'

const TIER = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

function response(riskLevel?: string): QuestionnaireResponseResource {
  const item: unknown[] = [{ linkId: 'q2-ideation', answer: [{ valueCoding: { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' } }] }]
  if (riskLevel) item.push({ linkId: 'risk-level', answer: [{ valueCoding: { system: TIER, code: riskLevel, display: riskLevel } }] })
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/PSS-Full',
    item,
  } as QuestionnaireResponseResource
}

function riskObs(r: ReturnType<typeof mapPSSFull>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
}

describe('mapPSSFull', () => {
  it('binds the result value directly to the shared suicide-risk tier', () => {
    const r = mapPSSFull(response('moderate'))
    const coding = riskObs(r)?.valueCodeableConcept?.coding?.[0]
    expect(coding?.system).toBe(TIER)
    expect(coding?.code).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.tool).toBe('PSS Full')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('high stratification → high alert with A interpretation', () => {
    const r = mapPSSFull(response('high'))
    expect(r.riskAlert.level).toBe('high')
    expect(riskObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')
  })

  it('missing stratification defaults to no-risk (none, N, no action)', () => {
    const r = mapPSSFull(response())
    expect(riskObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('no-risk')
    expect(r.riskAlert.level).toBe('none')
    expect(riskObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })
})
