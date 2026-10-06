import { describe, it, expect } from 'vitest'
import { RISK_LABEL, riskTitle } from './riskLabel'

describe('riskTitle', () => {
  it('reads unknown as "no screening on file" — never as cleared', () => {
    // The clinical distinction: a chart that has never been screened must not
    // read as "screened, no risk".
    expect(riskTitle('unknown')).toMatch(/no suicide-risk screening/i)
    expect(riskTitle('none')).toBe('Current suicide-risk level: None')
  })
  it('has a label for every level', () => {
    for (const level of ['acute', 'high', 'moderate', 'low', 'none', 'unknown'] as const) {
      expect(RISK_LABEL[level]).toBeTruthy()
    }
  })
})
