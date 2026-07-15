import { describe, it, expect } from 'vitest'
import { mapPSS3 } from './pss3'
import type { QuestionnaireResponseResource } from '../../types/fhir'

const YES = { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' }
const NO = { system: 'http://snomed.info/sct', code: '373067005', display: 'No' }
const RECENCY = 'http://spier.org/CodeSystem/pss3-attempt-recency'

interface PSS3Answers {
  depression?: boolean
  ideation?: boolean
  lifetimeAttempt?: boolean
  recency?: string
}

function pss3Response(a: PSS3Answers): QuestionnaireResponseResource {
  const yn = (b: boolean | undefined) => (b === undefined ? undefined : b ? YES : NO)
  const items: unknown[] = []
  if (a.depression !== undefined) items.push({ linkId: 'q1-depression', answer: [{ valueCoding: yn(a.depression) }] })
  if (a.ideation !== undefined) items.push({ linkId: 'q2-ideation', answer: [{ valueCoding: yn(a.ideation) }] })
  if (a.lifetimeAttempt !== undefined) items.push({ linkId: 'q3-lifetime-attempt', answer: [{ valueCoding: yn(a.lifetimeAttempt) }] })
  if (a.recency !== undefined) items.push({ linkId: 'q3a-recency', answer: [{ valueCoding: { system: RECENCY, code: a.recency, display: a.recency } }] })
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/PSS-3',
    item: items,
  } as QuestionnaireResponseResource
}

function resultCoding(r: ReturnType<typeof mapPSS3>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')?.valueCodeableConcept?.coding?.[0]
}

describe('mapPSS3', () => {
  it('active ideation (item 2 yes) → positive, A interpretation, moderate alert', () => {
    const r = mapPSS3(pss3Response({ depression: true, ideation: true, lifetimeAttempt: false }))
    expect(resultCoding(r)?.code).toBe('positive')
    const result = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(result?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.tool).toBe('PSS-3')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/cssrs-full')
  })

  it('recent attempt within 6 months (item 3a) → positive even without current ideation', () => {
    const r = mapPSS3(pss3Response({ ideation: false, lifetimeAttempt: true, recency: 'between-1-and-6-months' }))
    expect(resultCoding(r)?.code).toBe('positive')
    expect(r.riskAlert.level).toBe('moderate')
  })

  it('attempt more than 6 months ago with no current ideation → negative', () => {
    const r = mapPSS3(pss3Response({ ideation: false, lifetimeAttempt: true, recency: 'more-than-6-months' }))
    expect(resultCoding(r)?.code).toBe('negative')
    expect(r.riskAlert.level).toBe('none')
  })

  it('depression only (item 1 yes) does NOT drive a positive suicide-risk screen', () => {
    const r = mapPSS3(pss3Response({ depression: true, ideation: false, lifetimeAttempt: false }))
    expect(resultCoding(r)?.code).toBe('negative')
  })

  it('all no → negative with N interpretation and no suggested action', () => {
    const r = mapPSS3(pss3Response({ depression: false, ideation: false, lifetimeAttempt: false }))
    expect(resultCoding(r)?.code).toBe('negative')
    const result = r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
    expect(result?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('emits discrete item Observations bound to the SPiER-local pss3-item system', () => {
    const r = mapPSS3(pss3Response({ depression: true, ideation: true, lifetimeAttempt: false }))
    const itemObs = r.observations.filter(o => o.code?.coding?.[0]?.system === 'http://spier.org/CodeSystem/pss3-item')
    const codes = itemObs.map(o => o.code?.coding?.[0]?.code)
    expect(codes).toEqual(expect.arrayContaining(['depression-2wk', 'active-ideation-2wk', 'lifetime-attempt']))
  })

  it('recency within-24-hours also drives positive', () => {
    const r = mapPSS3(pss3Response({ ideation: false, lifetimeAttempt: true, recency: 'within-24-hours' }))
    expect(resultCoding(r)?.code).toBe('positive')
  })
})
