import { describe, it, expect } from 'vitest'
import { TOOLS } from '../data/catalog'
import {
  isPathwayRealization,
  orderByPathwayRealization,
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

describe('orderByPathwayRealization — the named instrument leads, nothing is dropped', () => {
  it('puts the PHQ-9 first among the screeners and keeps the rest in catalog order', () => {
    const screeners = TOOLS.filter(t => t.stageId === 'identify-possible-risk' && t.launchActions.length > 0)
    const ordered = orderByPathwayRealization(screeners)
    expect(ordered[0].id).toBe('TL-002')
    expect(ordered).toHaveLength(screeners.length)
    const rest = screeners.filter(t => t.id !== 'TL-002')
    expect(ordered.slice(1).map(t => t.id)).toEqual(rest.map(t => t.id))
  })

  it('puts the C-SSRS Screener first on Clarify Risk', () => {
    // The screener is a Clarify Risk tool (pathway-stages.fsh) — the stage the
    // PHQ-9 → C-SSRS workflow hands off to. Before 2026-09-02 it was filed
    // under Identify, and this card never offered it.
    const clarify = TOOLS.filter(t => t.stageId === 'clarify-risk' && t.launchActions.length > 0)
    expect(clarify.map(t => t.id)).toContain('TL-003')
    expect(orderByPathwayRealization(clarify)[0].id).toBe('TL-003')
    expect(isPathwayRealization(orderByPathwayRealization(clarify)[0])).toBe(true)
  })
})
