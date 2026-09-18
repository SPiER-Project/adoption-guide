/**
 * The Guided Pathway preset is the app's default, and these are the properties
 * that make that safe rather than merely tidy.
 *
 * ⚠️ **Changing DEFAULT_PRESET is how the 2026-09-02 defect happened.**
 * `buildCdsCards` drops an alert card whose tool is disabled, so a preset that
 * switches off a named tool makes a recommendation VANISH from the standalone
 * chart while the host page — which offers every tool — still shows it. Same
 * patient, two answers. The last two describes below are that measurement,
 * turned into a standing check.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRESET,
  PATHWAY_STAGE_DEFAULTS,
  PRESETS,
  presetToolIds,
} from './toolPresets'
import { launchableTools } from '@spier/core/data/catalog'
import { STAGES } from '@spier/core/data/catalog/stages'
import { isPathwayRealization } from '@spier/core/lib/pathwayRealizations'
import { buildCdsCards } from '@spier/core/lib/cdsHooks/cards'
import { derivePathwayStatus } from '@spier/core/lib/patientPathway'
import { POPULATION_SCENARIOS } from '@spier/demo-population'

const guidedIds = () => new Set(presetToolIds('guided-pathway'))

describe('Guided Pathway — one tool at every stage', () => {
  it('is the default preset', () => {
    expect(DEFAULT_PRESET).toBe('guided-pathway')
    expect(PRESETS.map(p => p.id)).toContain('guided-pathway')
  })

  it('reads a real catalog and a real pathway, so the rules below are not vacuous', () => {
    // Every other assertion here filters these two. A gate that reads nothing
    // must fail rather than certify an empty set.
    expect(launchableTools().length).toBeGreaterThanOrEqual(20)
    expect(STAGES.length).toBe(8)
    expect(launchableTools().filter(isPathwayRealization).length).toBeGreaterThan(0)
  })

  it('leaves no stage empty', () => {
    const enabled = launchableTools().filter(t => guidedIds().has(t.id))
    const covered = new Set(enabled.map(t => t.stageId))
    const missing = STAGES.filter(s => !covered.has(s.id)).map(s => s.id)
    expect(missing, 'stages with no tool enabled — a clinician would meet a blank page').toEqual([])
  })

  it('takes its pick from the pathway wherever the pathway names one', () => {
    // The derived half. If the published PlanDefinition starts naming a tool at
    // a new stage, the preset follows it without anyone editing this file.
    for (const tool of launchableTools()) {
      if (isPathwayRealization(tool)) {
        expect(guidedIds().has(tool.id), `${tool.id} is named by the pathway but is not enabled`).toBe(true)
      }
    }
  })

  it('declares a default ONLY for the stages that get no TOOL from the pathway', () => {
    // ⚠️ "The pathway names nothing here" is the wrong test, and writing it that
    // way failed on `track-risk-over-time`: the pathway DOES name a canonical
    // there — `PlanDefinition/SPiERReassessmentSchedule`, a cadence, not an
    // instrument — so `pathwayRealizationsForStage` is non-empty while no
    // launchable tool matches it and the stage would still be blank.
    //
    // The property that matters is tool-level, and it is the same predicate the
    // preset itself uses, so the two cannot drift apart.
    const hasPathwayTool = (stageId: string) =>
      launchableTools().some(t => t.stageId === stageId && isPathwayRealization(t))

    for (const stageId of Object.keys(PATHWAY_STAGE_DEFAULTS)) {
      expect(STAGES.map(s => s.id), `${stageId} is not a real stage`).toContain(stageId)
      expect(
        hasPathwayTool(stageId),
        `${stageId} already gets a tool from the published pathway AND is hand-defaulted here — remove the entry and let the artifact decide`,
      ).toBe(false)
    }
    const silent = STAGES.filter(s => !hasPathwayTool(s.id)).map(s => s.id)
    expect(
      Object.keys(PATHWAY_STAGE_DEFAULTS).sort(),
      'every stage the pathway leaves without a tool needs exactly one declared default',
    ).toEqual(silent.sort())
  })

  it('names a real, launchable tool at the stage it is declared for', () => {
    for (const [stageId, toolId] of Object.entries(PATHWAY_STAGE_DEFAULTS)) {
      const tool = launchableTools().find(t => t.id === toolId)
      expect(tool, `${toolId} is not a launchable tool`).toBeDefined()
      expect(tool!.stageId, `${toolId} is declared for ${stageId} but sits at ${tool!.stageId}`).toBe(stageId)
    }
  })

  it('enables fewer tools than mid-tier — otherwise it is not a selection', () => {
    expect(presetToolIds('guided-pathway').length).toBeLessThan(presetToolIds('common-mid-tier').length)
  })
})

describe('the default preset withholds no recommendation it did not already', () => {
  /**
   * The 2026-09-02 defect, as a standing check. `buildCdsCards` DROPS an alert
   * card whose tool is disabled, so a preset change can make a recommendation
   * vanish from the standalone chart while the host page — which offers every
   * tool — still shows it. Same patient, two answers.
   *
   * Every demo scenario is built three ways: everything enabled (what the CDS
   * service and the embedded panel apply), the outgoing default, and the new
   * one.
   */
  const scenarios = Object.entries(POPULATION_SCENARIOS)

  const cardsFor = (scenario: (typeof scenarios)[number][1], enabled: (id: string) => boolean) => {
    const artifacts = {
      responses: scenario.responses,
      carePlans: scenario.carePlans,
      observations: scenario.observations,
      communications: scenario.communications ?? [],
    }
    return buildCdsCards({
      activeStageId: derivePathwayStatus(artifacts).activeStageId,
      riskAlerts: scenario.riskAlerts,
      recommendedNextStep: null,
      isSmartConnected: false,
      observations: scenario.observations,
      isToolEnabled: enabled,
    })
  }

  it('has scenarios to check', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10)
  })

  it.each(scenarios)('%s loses no card that the outgoing default kept', (_id, scenario) => {
    // The actual question this change has to answer. Narrowing 21 tools to 9
    // must not cost a recommendation that mid-tier was showing.
    const mid = new Set(presetToolIds('common-mid-tier'))
    const ids = guidedIds()
    const before = cardsFor(scenario, id => mid.has(id)).map(c => c.summary)
    const after = cardsFor(scenario, id => ids.has(id)).map(c => c.summary)
    expect(before.filter(s => !after.includes(s))).toEqual([])
  })

  it.each(scenarios)('%s keeps a launch on every card that had one', (_id, scenario) => {
    // Fewer alternatives per card is the POINT; a card losing its LAST launch is
    // a dead recommendation. Matched by summary, not index, so a dropped card
    // fails the test above rather than misaligning this one.
    //
    // ⚠️ **No planted defect makes this one fail, and that is recorded rather
    // than taken as strength.** With today's `buildCdsCards`, a stage card's
    // links come from the enabled tools at that stage and every catalogued tool
    // has at least one launch action — so "the stage is not empty" already
    // implies "the card has a launch", which the test above covers. Every plant
    // tried either emptied a stage (firing that one) or was a legitimate
    // alternative pick. It stays because the implication is a property of the
    // CARD BUILDER, not of the preset: a future `cards.ts` that filters links
    // separately from tools would break it silently, and this is the only thing
    // looking.
    const all = cardsFor(scenario, () => true)
    const ids = guidedIds()
    for (const card of cardsFor(scenario, id => ids.has(id))) {
      const before = (all.find(c => c.summary === card.summary)?.links ?? []).length
      const after = (card.links ?? []).length
      if (before > 0) {
        expect(after, `"${card.summary}" had ${before} launch(es) and now has none`).toBeGreaterThan(0)
      }
    }
  })

  /**
   * ⚠️ **The one card the standalone chart still withholds, pinned exactly.**
   *
   * This is NOT caused by the Guided Pathway preset — `common-mid-tier` loses
   * the same card and nothing else, because the CAMS stabilization plan is
   * `optional` and neither preset turns optional tools on. It is the half of the
   * 2026-09-02 defect that was never closed: `web/src/lib/toolEnablement.ts`
   * fixed the PANEL by offering every tool there, and the standalone chart kept
   * honouring the preset, which is where the preset is the point.
   *
   * Pinned as an exact list rather than a count so it can only shrink: a NEW
   * withheld card fails, and closing this one fails too and takes the entry with
   * it. The real fix is the per-site toolset the SERVICE can read, which
   * `toolEnablement.ts` describes and nothing implements yet.
   */
  const KNOWN_WITHHELD: Record<string, string[]> = {
    'patient-006': ['Start Stabilization Plan'],
  }

  it('withholds exactly the cards we know about, and no others', () => {
    const ids = guidedIds()
    const actual: Record<string, string[]> = {}
    for (const [pid, scenario] of scenarios) {
      const all = cardsFor(scenario, () => true).map(c => c.summary)
      const guided = cardsFor(scenario, id => ids.has(id)).map(c => c.summary)
      const lost = all.filter(s => !guided.includes(s))
      if (lost.length) actual[pid] = lost
    }
    expect(actual).toEqual(KNOWN_WITHHELD)
  })
})
