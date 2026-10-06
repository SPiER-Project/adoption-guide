import { describe, it, expect } from 'vitest'
import { TOOLS } from '../data/catalog'
import {
  isPathwayRealization,
  pathwayRealizationsForStage,
} from './pathwayRealizations'

const AD = 'http://thespierproject.org/fhir/ActivityDefinition'

describe('pathwayRealizationsForStage — what the PlanDefinition names per stage', () => {
  it('names the PHQ-9 for the screen and the C-SSRS Screener for the assessment', () => {
    expect(pathwayRealizationsForStage('identify-possible-risk')).toContain(`${AD}/AdministerPHQ9`)
    expect(pathwayRealizationsForStage('clarify-risk')).toContain(`${AD}/AdministerCSSRSScreener`)
  })

  it('reads a nested action’s own stage rather than its parent’s', () => {
    // "Share crisis resources" sits under the tier groups (define-the-risk-picture)
    // but is coded document-safety-actions itself.
    expect(pathwayRealizationsForStage('document-safety-actions')).toContain(`${AD}/ShareCrisisResources`)
    expect(pathwayRealizationsForStage('define-risk-picture')).not.toContain(`${AD}/ShareCrisisResources`)
  })
})

describe('isPathwayRealization — the instrument each step names', () => {
  it('names the PHQ-9 on Identify Possible Risk and no other launchable screener', () => {
    const screeners = TOOLS.filter(t => t.stageId === 'identify-possible-risk' && t.launchActions.length > 0)
    expect(screeners.filter(isPathwayRealization).map(t => t.id)).toEqual(['TL-002'])
  })

  it('names the C-SSRS Screener on Clarify Risk', () => {
    // The screener is a Clarify Risk tool (pathway-stages.fsh) — the stage the
    // PHQ-9 → C-SSRS workflow hands off to. Before 2026-09-02 it was filed
    // under Identify, and this card never offered it.
    const clarify = TOOLS.filter(t => t.stageId === 'clarify-risk' && t.launchActions.length > 0)
    expect(clarify.map(t => t.id)).toContain('TL-003')
    expect(isPathwayRealization(clarify.find(t => t.id === 'TL-003')!)).toBe(true)
  })
})
