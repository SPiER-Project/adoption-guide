import { describe, it, expect } from 'vitest'
import { mapCAMSOutcomeDisposition } from './camsOutcomeDisposition'
import type { QuestionnaireResponseResource } from '../../types/fhir'

const DISP = 'http://spier.org/CodeSystem/cams-disposition'

function response(opts: { vitals?: Record<string, number>; disposition?: string }): QuestionnaireResponseResource {
  const coreItems = Object.entries(opts.vitals ?? {}).map(([linkId, valueInteger]) => ({ linkId, answer: [{ valueInteger }] }))
  const item: unknown[] = [{ linkId: 'core-ratings', item: coreItems }]
  if (opts.disposition) {
    item.push({ linkId: 'disposition', answer: [{ valueCoding: { system: DISP, code: opts.disposition, display: opts.disposition } }] })
  }
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/CAMS-SSF5-OutcomeDisposition',
    item,
  } as QuestionnaireResponseResource
}

function dispositionObs(r: ReturnType<typeof mapCAMSOutcomeDisposition>) {
  return r.observations.find(o => o.valueCodeableConcept?.coding?.[0]?.system === DISP)
}

describe('mapCAMSOutcomeDisposition', () => {
  it('emits SSF vital Observations for the final re-rating', () => {
    const r = mapCAMSOutcomeDisposition(response({ vitals: { '1-score': 2, '6-score': 2 }, disposition: 'resolved' }))
    const vitals = r.observations.filter(o => o.code?.coding?.[0]?.system === 'http://spier.org/CodeSystem/cams-ssf')
    expect(vitals.map(v => v.code?.coding?.[0]?.code)).toEqual(expect.arrayContaining(['psychological-pain', 'overall-risk']))
  })

  it('resolved disposition → none alert, N interpretation, no action', () => {
    const r = mapCAMSOutcomeDisposition(response({ vitals: { '6-score': 2 }, disposition: 'resolved' }))
    expect(dispositionObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('resolved')
    expect(dispositionObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.level).toBe('none')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('higher-level-care disposition → high alert with safety-plan action', () => {
    const r = mapCAMSOutcomeDisposition(response({ vitals: { '6-score': 5 }, disposition: 'higher-level-care' }))
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('continue-cams disposition → moderate alert', () => {
    const r = mapCAMSOutcomeDisposition(response({ vitals: { '6-score': 3 }, disposition: 'continue-cams' }))
    expect(r.riskAlert.level).toBe('moderate')
    expect(dispositionObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')
  })

  it('disposition Observation uses LOINC 93374-7 as its code (BSSA precedent)', () => {
    const r = mapCAMSOutcomeDisposition(response({ disposition: 'resolved' }))
    expect(dispositionObs(r)?.code?.coding?.[0]?.code).toBe('93374-7')
  })
})
