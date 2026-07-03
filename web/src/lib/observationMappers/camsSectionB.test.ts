import { describe, it, expect } from 'vitest'
import { mapCAMSSectionB } from './camsSectionB'
import type { QuestionnaireResponseResource } from '../../types/fhir'

// CAMS SSF-5 Section B (clinician): free-text drivers + ideation/plan booleans.
interface Driver { desc?: string; type?: { code: string; display: string } }
function camsBResponse(opts: {
  drivers?: Driver[]
  ideationPresent?: boolean
  planPresent?: boolean
}): QuestionnaireResponseResource {
  const item: NonNullable<QuestionnaireResponseResource['item']> = []
  ;(opts.drivers ?? []).forEach((d, i) => {
    const n = i + 1
    if (d.desc !== undefined) item.push({ linkId: `driver-${n}-desc`, answer: [{ valueString: d.desc }] })
    if (d.type) item.push({ linkId: `driver-${n}-type`, answer: [{ valueCoding: { system: 'http://cams-care.com/driver-type', code: d.type.code, display: d.type.display } }] })
  })
  if (opts.ideationPresent !== undefined) item.push({ linkId: 'ideation-present', answer: [{ valueBoolean: opts.ideationPresent }] })
  if (opts.planPresent !== undefined) item.push({ linkId: 'plan-present', answer: [{ valueBoolean: opts.planPresent }] })
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/CAMS-SSF5-SectionB',
    item,
  } as QuestionnaireResponseResource
}

describe('mapCAMSSectionB', () => {
  it('plan present → high alert regardless of driver count', () => {
    const r = mapCAMSSectionB(camsBResponse({ planPresent: true, ideationPresent: true, drivers: [{ desc: 'Job loss' }] }))
    expect(r.riskAlert.level).toBe('high')
    expect(r.riskAlert.summary).toContain('1 driver')
    expect(r.riskAlert.suggestedAction?.path).toBe('/patient/assessments/cams-stabilization-plan')
  })

  it('ideation present without plan → moderate alert', () => {
    const r = mapCAMSSectionB(camsBResponse({ ideationPresent: true, planPresent: false, drivers: [{ desc: 'Isolation' }, { desc: 'Chronic pain' }] }))
    expect(r.riskAlert.level).toBe('moderate')
    expect(r.riskAlert.summary).toContain('2 driver')
  })

  it('no ideation/plan but drivers identified → low', () => {
    const r = mapCAMSSectionB(camsBResponse({ ideationPresent: false, planPresent: false, drivers: [{ desc: 'Grief' }] }))
    expect(r.riskAlert.level).toBe('low')
  })

  it('no ideation/plan and no drivers → none', () => {
    const r = mapCAMSSectionB(camsBResponse({ ideationPresent: false, planPresent: false }))
    expect(r.riskAlert.level).toBe('none')
  })

  // The mapper stashes Conditions in the observations array (cast to
  // ObservationResource), so read resourceType through a widened view.
  const conditionsOf = (r: ReturnType<typeof mapCAMSSectionB>) =>
    r.observations.filter(o => (o as { resourceType: string }).resourceType === 'Condition')

  it('emits a Condition per described driver with type category', () => {
    const r = mapCAMSSectionB(camsBResponse({
      drivers: [{ desc: 'Relationship breakup', type: { code: 'interpersonal', display: 'Interpersonal' } }],
    }))
    const conditions = conditionsOf(r)
    expect(conditions).toHaveLength(1)
    expect(conditions[0].code).toMatchObject({ text: 'Relationship breakup' })
  })

  it('ignores drivers with no description', () => {
    const r = mapCAMSSectionB(camsBResponse({ drivers: [{ type: { code: 'interpersonal', display: 'Interpersonal' } }], ideationPresent: false, planPresent: false }))
    expect(conditionsOf(r)).toHaveLength(0)
    expect(r.riskAlert.level).toBe('none')
  })
})
