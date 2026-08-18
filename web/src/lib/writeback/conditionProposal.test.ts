import { describe, it, expect } from 'vitest'
import { buildConditionProposal, riskAlertLevelToTier, SPIER_RISK_TIER_SYSTEM } from './conditionProposal'
import type { RiskAlert } from '../observationMappers'

const alert = (level: RiskAlert['level']): RiskAlert => ({
  tool: 'PHQ-9',
  level,
  summary: 's',
  detail: 'd',
})

describe('riskAlertLevelToTier', () => {
  it('crosswalks the alert vocabulary to SPiER tiers (endpoints differ)', () => {
    expect(riskAlertLevelToTier('none').code).toBe('no-risk')
    expect(riskAlertLevelToTier('low').code).toBe('low')
    expect(riskAlertLevelToTier('moderate').code).toBe('moderate')
    expect(riskAlertLevelToTier('high').code).toBe('high')
    expect(riskAlertLevelToTier('acute').code).toBe('imminent')
  })
})

describe('buildConditionProposal', () => {
  it('returns null for a negative screen (no problem proposed)', () => {
    expect(buildConditionProposal({ riskAlert: alert('none'), patientId: 'p1' })).toBeNull()
  })

  it('builds an unconfirmed problem-list Condition using concept-layer tier codes', () => {
    const c = buildConditionProposal({
      riskAlert: alert('high'),
      patientId: 'p1',
      derivedFromRefs: ['QuestionnaireResponse/qr-1', 'Observation/o1'],
      recordedDate: '2026-07-14T10:00:00Z',
    })!
    expect(c).not.toBeNull()
    expect(c.resourceType).toBe('Condition')

    const coding = (c.code as { coding: { system: string; code: string }[] }).coding[0]
    expect(coding.system).toBe(SPIER_RISK_TIER_SYSTEM)
    expect(coding.code).toBe('high')

    const ver = (c.verificationStatus as { coding: { code: string }[] }).coding[0]
    expect(ver.code).toBe('unconfirmed')

    const cat = (c.category as { coding: { code: string }[] }[])[0].coding[0]
    expect(cat.code).toBe('problem-list-item')

    expect((c.subject as { reference: string }).reference).toBe('Patient/p1')
    expect(c.recordedDate).toBe('2026-07-14T10:00:00Z')

    const evidence = c.evidence as Array<{ detail: { reference: string }[] }>
    expect(evidence[0].detail.map(d => d.reference)).toEqual([
      'QuestionnaireResponse/qr-1',
      'Observation/o1',
    ])
  })

  it('omits evidence when no provenance refs are supplied', () => {
    const c = buildConditionProposal({ riskAlert: alert('moderate'), patientId: 'p1' })!
    expect(c.evidence).toBeUndefined()
  })
})
