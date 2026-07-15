import { describe, it, expect } from 'vitest'
import { mapSAFET } from './safet'
import type { QuestionnaireResponseResource } from '../../types/fhir'

const YES = { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' }
const TIER = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

interface SAFETAnswers {
  riskLevel?: string
  rationale?: string
  override?: boolean
  overrideRationale?: string
  intervention?: string
}

function safetResponse(a: SAFETAnswers): QuestionnaireResponseResource {
  const step5: unknown[] = []
  if (a.rationale !== undefined) step5.push({ linkId: 'risk-rationale', answer: [{ valueString: a.rationale }] })
  if (a.override !== undefined) step5.push({ linkId: 'clinical-judgment-override', answer: [{ valueCoding: a.override ? YES : { system: 'http://snomed.info/sct', code: '373067005', display: 'No' } }] })
  if (a.overrideRationale !== undefined) step5.push({ linkId: 'override-rationale', answer: [{ valueString: a.overrideRationale }] })
  const step4: unknown[] = []
  if (a.riskLevel !== undefined) step4.push({ linkId: 'risk-level', answer: [{ valueCoding: { system: TIER, code: a.riskLevel, display: a.riskLevel } }] })
  if (a.intervention !== undefined) step4.push({ linkId: 'intervention', answer: [{ valueString: a.intervention }] })
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/SAFE-T',
    item: [
      { linkId: 'step4-risk-level-intervention', item: step4 },
      { linkId: 'step5-document', item: step5 },
    ],
  } as QuestionnaireResponseResource
}

function resultObs(r: ReturnType<typeof mapSAFET>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
}

describe('mapSAFET', () => {
  it('binds the result value directly to the shared suicide-risk tier', () => {
    const r = mapSAFET(safetResponse({ riskLevel: 'moderate' }))
    const coding = resultObs(r)?.valueCodeableConcept?.coding?.[0]
    expect(coding?.system).toBe('http://spier.org/CodeSystem/spier-suicide-risk-tier')
    expect(coding?.code).toBe('moderate')
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.tool).toBe('SAFE-T')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('high risk → high alert with A interpretation', () => {
    const r = mapSAFET(safetResponse({ riskLevel: 'high' }))
    expect(r.riskAlert.level).toBe('high')
    expect(resultObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')
  })

  it('low risk still suggests a safety plan (SAFE-T: safety plan at low/moderate/high)', () => {
    const r = mapSAFET(safetResponse({ riskLevel: 'low' }))
    expect(r.riskAlert.level).toBe('low')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('no-risk → none alert, N interpretation, no suggested action', () => {
    const r = mapSAFET(safetResponse({ riskLevel: 'no-risk' }))
    expect(r.riskAlert.level).toBe('none')
    expect(resultObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('folds rationale and clinical-judgment override into the Observation note', () => {
    const r = mapSAFET(safetResponse({
      riskLevel: 'high',
      rationale: 'ideation with plan and intent',
      override: true,
      overrideRationale: 'recent discharge, low reported ideation but high acuity',
    }))
    const obs = resultObs(r) as { note?: Array<{ text?: string }> } | undefined
    const note = obs?.note?.[0]?.text ?? ''
    expect(note).toContain('Rationale: ideation with plan and intent')
    expect(note).toContain('Clinical-judgment override applied')
    expect(note).toContain('recent discharge')
  })

  it('missing/unknown risk level defaults to no-risk (none)', () => {
    const r = mapSAFET(safetResponse({}))
    expect(resultObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('no-risk')
    expect(r.riskAlert.level).toBe('none')
  })
})
