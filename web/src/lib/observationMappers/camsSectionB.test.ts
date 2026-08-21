import { describe, it, expect } from 'vitest'
import { mapCAMSSectionB } from '@spier/core/lib/observationMappers/camsSectionB'
import { walkItems } from '@spier/core/lib/observationMappers/shared'
import { nativeQr, type NativeAnswer } from './__fixtures__/nativeQr'

/**
 * CAMS SSF-5 Section B (clinician): free-text drivers + ideation/plan questions.
 *
 * `ideation-present` and `plan-present` are `choice` items bound to SNOMED
 * Yes/No, not booleans — this builder used to write `valueBoolean` for them,
 * which is why the mapper's misread (#327) passed the suite. Everything is now
 * built from the Questionnaire; see __fixtures__/nativeQr.ts.
 */
const CAMS_SECTION_B = 'http://spier.org/Questionnaire/CAMS-SSF5-SectionB'

interface Driver { desc?: string; type?: { code: string; display: string } }
function camsBResponse(opts: {
  drivers?: Driver[]
  ideationPresent?: boolean
  planPresent?: boolean
}) {
  const answers: Record<string, NativeAnswer> = {}
  ;(opts.drivers ?? []).forEach((d, i) => {
    const n = i + 1
    if (d.desc !== undefined) answers[`driver-${n}-desc`] = d.desc
    if (d.type) answers[`driver-${n}-type`] = { code: d.type.code }
  })
  if (opts.ideationPresent !== undefined) answers['ideation-present'] = opts.ideationPresent
  if (opts.planPresent !== undefined) answers['plan-present'] = opts.planPresent
  return nativeQr(CAMS_SECTION_B, answers)
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
      drivers: [{ desc: 'Relationship breakup', type: { code: 'direct', display: 'Direct Driver' } }],
    }))
    const conditions = conditionsOf(r)
    expect(conditions).toHaveLength(1)
    expect(conditions[0].code).toMatchObject({ text: 'Relationship breakup' })
  })

  // #327: both yes/no items are `choice` bound to SNOMED Yes/No, so a clinician
  // documenting a suicidal plan through the app derived "no active ideation/plan"
  // for as long as the mapper read valueBoolean alone.
  it('reads the coded Yes the form emits for plan-present', () => {
    const qr = camsBResponse({ planPresent: true, ideationPresent: true })
    expect(walkItems(qr.item ?? [], 'plan-present')?.answer?.[0]?.valueCoding)
      .toEqual({ system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' })
    expect(mapCAMSSectionB(qr).riskAlert.level).toBe('high')
  })

  it('ignores drivers with no description', () => {
    const r = mapCAMSSectionB(camsBResponse({ drivers: [{ type: { code: 'direct', display: 'Direct Driver' } }], ideationPresent: false, planPresent: false }))
    expect(conditionsOf(r)).toHaveLength(0)
    expect(r.riskAlert.level).toBe('none')
  })
})
