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

describe('the licensing floor on what SPiER CHOOSES', () => {
  /**
   * ⚠️ **The default preset is what a deployment ships with, so what it leads
   * with is a distribution decision, not just a UI one.** Every licensing status
   * SPiER publishes is still unverified against the rights holder's current
   * terms — `docs/best-practices/licensing-verification-backlog.md` is the
   * standing list, and #64 gates open-sourcing on it. Until that is done, the
   * defaults SPiER *chooses* must not be the ones that need somebody's
   * permission.
   *
   * The split is deliberate and is the whole rule:
   *
   *   - The pathway's OWN named realizations are whatever the published
   *     artifact says, `registration` included. The C-SSRS Screener and
   *     Stanley-Brown are both `registration`, and that is the PlanDefinition's
   *     claim to make, not this file's to override.
   *   - `PATHWAY_STAGE_DEFAULTS` is the half SPiER picked freely, for the five
   *     stages the pathway leaves open. There a restricted instrument is a
   *     choice nobody had to make, so it fails here instead — and the fix is to
   *     surface the decision, not to quietly ship it.
   *
   * ⚠️ It passes today by luck rather than design: all five picks happen to be
   * `public-domain` or `spier-authored`. That is exactly why it is written down.
   *
   * ⚠️ **Only ONE of the three restricted statuses can currently be planted, and
   * the limit is the catalog's, not the rule's.** Measured across the five open
   * stages: `define-risk-picture` offers `commercial` (TL-024, the CAMS
   * therapeutic worksheet) and `public-domain`; the other four offer nothing but
   * `spier-authored`. So a commercial default goes red on a real plant, while
   * `registration` and `unknown` have no instrument at any open stage to plant
   * WITH — a substitution from another stage fails the wrong-stage test first
   * and proves something else. Recorded rather than dressed up as three plants:
   * the rule is still the one to hold when a stage gains a restricted
   * alternative, which is precisely when nobody will be looking.
   */
  const NEEDS_NOBODYS_PERMISSION = ['public-domain', 'spier-authored']

  it('reads real licensing statuses, or the rule below checks nothing', () => {
    const recorded = launchableTools().filter(t => t.licensing !== undefined)
    expect(recorded.length).toBe(launchableTools().length)
    // The restricted statuses must actually exist in the catalog, or "none of
    // the picks is restricted" is true of a catalog that has no such thing.
    expect(launchableTools().some(t => t.licensing === 'commercial')).toBe(true)
    expect(launchableTools().some(t => t.licensing === 'registration')).toBe(true)
  })

  it('never DEFAULTS to an instrument that needs somebody’s permission', () => {
    for (const [stageId, toolId] of Object.entries(PATHWAY_STAGE_DEFAULTS)) {
      const tool = launchableTools().find(t => t.id === toolId)
      expect(
        NEEDS_NOBODYS_PERMISSION,
        `${stageId} defaults to ${toolId}, whose licensing is "${tool?.licensing}". `
          + 'SPiER chose this one — the pathway does not name it — so a restricted '
          + 'status here is a decision to surface, not to ship. See '
          + 'docs/best-practices/licensing-verification-backlog.md.',
      ).toContain(tool?.licensing)
    }
  })

  it('leads with nothing commercial or unknown, anywhere', () => {
    // Weaker than the rule above and it covers the pathway's half too: a
    // `commercial` or `unknown` instrument as the DEFAULT experience is a
    // distribution problem whoever named it. `registration` is deliberately
    // permitted — two of the pathway's own realizations carry it.
    for (const stage of STAGES) {
      for (const tool of stageLeadTools(stage.id)) {
        expect(
          ['commercial', 'unknown'],
          `${stage.id} leads with ${tool.id} (${tool.licensing})`,
        ).not.toContain(tool.licensing)
      }
    }
  })
})
