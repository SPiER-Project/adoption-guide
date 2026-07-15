import { describe, it, expect } from 'vitest'
import { mapBSSA } from './bssa'
import type { QuestionnaireResponseResource } from '../../types/fhir'

const YES = { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' }
const NO = { system: 'http://snomed.info/sct', code: '373067005', display: 'No' }
const DISP = 'http://spier.org/CodeSystem/bssa-disposition'

interface BSSAAnswers {
  disposition: string
  currentIdeation?: boolean
  hasPlan?: boolean
  everAttempt?: boolean
  needsHelp?: boolean
  intent?: number
}

/** Build a BSSA QuestionnaireResponse with items nested under their groups. */
function bssaResponse(a: BSSAAnswers): QuestionnaireResponseResource {
  const yn = (b: boolean | undefined) => (b === undefined ? undefined : b ? YES : NO)
  const assessmentItems: unknown[] = []
  if (a.currentIdeation !== undefined) assessmentItems.push({ linkId: 'current-ideation', answer: [{ valueCoding: yn(a.currentIdeation) }] })
  if (a.hasPlan !== undefined) assessmentItems.push({ linkId: 'has-plan', answer: [{ valueCoding: yn(a.hasPlan) }] })
  if (a.everAttempt !== undefined) assessmentItems.push({ linkId: 'ever-attempt', answer: [{ valueCoding: yn(a.everAttempt) }] })
  if (a.intent !== undefined) assessmentItems.push({ linkId: 'intent-scale', answer: [{ valueInteger: a.intent }] })
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/BSSA',
    item: [
      { linkId: 'assessment', item: assessmentItems },
      {
        linkId: 'safety-plan',
        item: a.needsHelp === undefined ? [] : [{ linkId: 'needs-help-to-be-safe', answer: [{ valueCoding: yn(a.needsHelp) }] }],
      },
      {
        linkId: 'disposition-section',
        item: [{ linkId: 'disposition', answer: [{ valueCoding: { system: DISP, code: a.disposition, display: a.disposition } }] }],
      },
    ],
  } as QuestionnaireResponseResource
}

function dispositionObs(r: ReturnType<typeof mapBSSA>) {
  return r.observations.find(o => o.code?.coding?.[0]?.code === '93374-7')
}

describe('mapBSSA', () => {
  it('emergency disposition → acute alert with A interpretation and safety-plan action', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'emergency-psychiatric-evaluation', currentIdeation: true }))
    expect(dispositionObs(r)?.valueCodeableConcept?.coding?.[0]?.code).toBe('emergency-psychiatric-evaluation')
    expect(dispositionObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('A')
    expect(r.riskAlert.level).toBe('acute')
    expect(r.riskAlert.tool).toBe('BSSA')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('further-evaluation disposition → high alert', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'further-evaluation-necessary', everAttempt: true, intent: 3 }))
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/stanley-and-brown')
  })

  it('non-urgent-followup disposition → moderate alert', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'non-urgent-followup' }))
    expect(r.riskAlert.level).toBe('moderate')
  })

  it('no-intervention disposition → none alert, N interpretation, no action', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'no-intervention', currentIdeation: false }))
    expect(r.riskAlert.level).toBe('none')
    expect(dispositionObs(r)?.interpretation?.[0]?.coding?.[0]?.code).toBe('N')
    expect(r.riskAlert.suggestedAction).toBeUndefined()
  })

  it('extracts discrete coded item Observations bound to the SPiER-local bssa-item system', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'further-evaluation-necessary', currentIdeation: false, hasPlan: false, everAttempt: true, needsHelp: true }))
    const itemObs = r.observations.filter(o => o.code?.coding?.[0]?.system === 'http://spier.org/CodeSystem/bssa-item')
    const codes = itemObs.map(o => o.code?.coding?.[0]?.code)
    expect(codes).toEqual(expect.arrayContaining(['current-ideation', 'suicide-plan', 'past-suicide-attempt', 'needs-help-to-be-safe']))
  })

  it('extracts the 0–10 intent self-rating as an integer Observation', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'further-evaluation-necessary', intent: 7 }))
    const intent = r.observations.find(o => o.code?.coding?.[0]?.code === 'intent-scale')
    expect(intent?.valueInteger).toBe(7)
  })

  it('omits item Observations for items that were not asked/answered', () => {
    const r = mapBSSA(bssaResponse({ disposition: 'no-intervention' }))
    // Only the disposition Observation is present when no discrete items answered.
    expect(r.observations).toHaveLength(1)
    expect(r.observations[0].code?.coding?.[0]?.code).toBe('93374-7')
  })
})
