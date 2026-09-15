import { describe, it, expect } from 'vitest'
import { RISK_LABEL, highestActiveRiskLevel, riskTitle } from './riskLabel'

describe('highestActiveRiskLevel', () => {
  it('is unknown — not none — when nothing has been screened', () => {
    // The clinical distinction the two component copies existed to preserve.
    expect(highestActiveRiskLevel([])).toBe('unknown')
    expect(riskTitle('unknown')).toMatch(/no suicide-risk screening/i)
  })
  it('is none when screened with no risk', () => {
    expect(highestActiveRiskLevel(['none'])).toBe('none')
  })
  it('picks the highest level present', () => {
    expect(highestActiveRiskLevel(['low', 'acute', 'moderate'])).toBe('acute')
    expect(highestActiveRiskLevel(['moderate', 'low'])).toBe('moderate')
  })
  it('has a label for every level', () => {
    for (const level of ['acute', 'high', 'moderate', 'low', 'none', 'unknown'] as const) {
      expect(RISK_LABEL[level]).toBeTruthy()
    }
  })
})
