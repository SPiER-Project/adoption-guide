/**
 * The Guided Pathway preset is the app's default, and these are the properties
 * that make that safe rather than merely tidy.
 *
 * ⚠️ **Changing DEFAULT_PRESET used to be how the 2026-09-02 defect happened.**
 * `buildCdsCards` dropped an alert card whose tool was disabled, so a preset
 * that switched off a named tool made a recommendation VANISH from the
 * standalone chart while the host page — which offers every tool — still
 * showed it. Same patient, two answers. Cards now come from the published
 * pathway and a disabled tool costs one only its launch button; the last
 * describe below is that closure, as a standing check.
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

describe('no preset can change WHICH recommendation a patient gets', () => {
  /**
   * ⚠️ **The 2026-09-02 defect, closed on 2026-09-21 rather than guarded.**
   *
   * The old `buildCdsCards` dropped a card whose tool was disabled, so a preset
   * change could make a recommendation vanish from the standalone chart while
   * the host page — which offers every tool — still showed it. Same patient,
   * two answers. This suite used to measure that: it compared every scenario
   * under three presets and pinned the one card the default still withheld
   * (patient-006's stabilization plan) in a `KNOWN_WITHHELD` allowlist.
   *
   * Cards are now what the PUBLISHED PATHWAY owes the record, and what a
   * protocol obliges is not a site setting — so a disabled tool costs a card
   * its launch button and nothing else. The allowlist is gone because the
   * condition it recorded cannot arise. What replaces it is the stronger
   * property: the card LIST is identical under every preset.
   */
  const scenarios = Object.entries(POPULATION_SCENARIOS)

  const cardsFor = (scenario: (typeof scenarios)[number][1], enabled: (id: string) => boolean) =>
    buildCdsCards({
      record: {
        responses: scenario.responses,
        observations: scenario.observations,
        carePlans: scenario.carePlans,
        communications: scenario.communications ?? [],
        procedures: scenario.procedures ?? [],
        episodes: scenario.episodes ?? [],
        riskAlerts: scenario.riskAlerts,
      },
      isToolEnabled: enabled,
    })

  it('has scenarios to check', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10)
  })

  it.each(scenarios)('%s gets the same cards under every preset, and with none', (_id, scenario) => {
    const everything = cardsFor(scenario, () => true).map(c => c.summary)
    for (const preset of PRESETS) {
      const ids = new Set(presetToolIds(preset.id))
      expect(cardsFor(scenario, id => ids.has(id)).map(c => c.summary)).toEqual(everything)
    }
    expect(cardsFor(scenario, () => false).map(c => c.summary)).toEqual(everything)
  })

  it.each(scenarios)('%s keeps a launch on every card the Guided Pathway enables', (_id, scenario) => {
    // The preset decides what a site can LAUNCH. Guided Pathway is derived from
    // the published pathway, so every tool the pathway itself names is in it —
    // which means no card the protocol produces should lose its button.
    const ids = guidedIds()
    const all = cardsFor(scenario, () => true)
    for (const card of cardsFor(scenario, id => ids.has(id))) {
      const before = (all.find(c => c.summary === card.summary)?.links ?? []).length
      const after = (card.links ?? []).length
      expect(after, `"${card.summary}" had ${before} launch(es) and now has none`).toBe(before)
    }
  })
})
