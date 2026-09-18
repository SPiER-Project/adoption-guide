/**
 * What each stage leads with — the definition the guided preset and the stage
 * pages BOTH read.
 *
 * The property that matters most is the last one: the preset's membership is
 * exactly the union of what the stages lead with. Two consumers of one rule is
 * the whole reason this module exists, and nothing else would notice them
 * drifting apart.
 */
import { describe, expect, it } from 'vitest'
import {
  PATHWAY_STAGE_DEFAULTS,
  guidedPathwayToolIds,
  stageAlternativeTools,
  stageLeadToolIds,
  stageLeadTools,
} from './pathwaySelection'
import { isPathwayRealization } from './pathwayRealizations'
import { launchableTools } from '../data/catalog/tools'
import { STAGES } from '../data/catalog/stages'

describe('stageLeadTools', () => {
  it('reads a real catalog and a real pathway, so nothing below is vacuous', () => {
    expect(launchableTools().length).toBeGreaterThanOrEqual(20)
    expect(STAGES.length).toBe(8)
    expect(launchableTools().filter(isPathwayRealization).length).toBeGreaterThan(0)
  })

  it('gives every stage at least one tool', () => {
    for (const stage of STAGES) {
      expect(stageLeadTools(stage.id).length, `${stage.id} leads with nothing`).toBeGreaterThan(0)
    }
  })

  it('prefers what the published pathway names', () => {
    for (const stage of STAGES) {
      const named = launchableTools().filter(t => t.stageId === stage.id && isPathwayRealization(t))
      if (named.length === 0) continue
      expect(stageLeadToolIds(stage.id).sort()).toEqual(named.map(t => t.id).sort())
    }
  })

  it('returns TWO where the pathway names two — it does not collapse an obligation', () => {
    // Document Safety Actions is named twice: share crisis resources AND
    // complete a safety plan. The tier groups carry both as distinct
    // obligations, so a one-tool signature would drop a published one.
    const lead = stageLeadToolIds('document-safety-actions')
    expect(lead.length).toBe(2)
    expect(lead).toContain('TL-007')
    expect(lead).toContain('TL-013')
  })

  it('falls back to the declared default only where the pathway names no TOOL', () => {
    for (const [stageId, toolId] of Object.entries(PATHWAY_STAGE_DEFAULTS)) {
      expect(stageLeadToolIds(stageId)).toEqual([toolId])
    }
  })

  it('needs a default at track-risk-over-time even though the pathway names a canonical there', () => {
    // ⚠️ The canonical is `PlanDefinition/SPiERReassessmentSchedule` — a cadence,
    // not an instrument — so no launchable tool matches it. This is why the
    // predicate is tool-level; the naive "does the pathway name anything here"
    // reports the stage covered and leaves it blank.
    expect(PATHWAY_STAGE_DEFAULTS['track-risk-over-time']).toBe('TL-038')
    expect(
      launchableTools().filter(t => t.stageId === 'track-risk-over-time' && isPathwayRealization(t)),
    ).toEqual([])
  })

  it('returns nothing for a stage that does not exist, rather than guessing', () => {
    expect(stageLeadTools('not-a-stage')).toEqual([])
  })
})

describe('stageAlternativeTools — the escape', () => {
  it('is everything at the stage that is not the lead, and never overlaps it', () => {
    for (const stage of STAGES) {
      const lead = stageLeadToolIds(stage.id)
      const alt = stageAlternativeTools(stage.id).map(t => t.id)
      const all = launchableTools().filter(t => t.stageId === stage.id).map(t => t.id)
      expect([...lead, ...alt].sort(), stage.id).toEqual(all.sort())
      expect(alt.filter(id => lead.includes(id)), stage.id).toEqual([])
    }
  })

  it('is non-empty somewhere, or the escape would be decoration', () => {
    expect(STAGES.some(s => stageAlternativeTools(s.id).length > 0)).toBe(true)
  })
})

describe('the preset and the stage pages read ONE rule', () => {
  it('guidedPathwayToolIds is exactly the union of what the stages lead with', () => {
    // If these ever differ, a deployment enables one set of tools while the
    // stage pages lead with another — the two-copies defect this module exists
    // to prevent, and nothing else in the repo would see it.
    const union = [...new Set(STAGES.flatMap(s => stageLeadToolIds(s.id)))].sort()
    expect(guidedPathwayToolIds().sort()).toEqual(union)
  })

  it('covers all eight stages and is smaller than the catalog', () => {
    expect(guidedPathwayToolIds().length).toBeGreaterThanOrEqual(STAGES.length)
    expect(guidedPathwayToolIds().length).toBeLessThan(launchableTools().length)
  })
})
