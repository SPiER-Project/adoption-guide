// Tool Configuration presets — the named capability profiles an adopter can
// switch between ("what does a site like ours have turned on?").
//
// This lives apart from ToolConfigContext, which holds only the provider and
// its persistence. Two reasons:
//   - Preset *definitions* are data about the catalog, not React state. The
//     provider consumes them; it does not own them.
//   - A module that exports both a component and constants cannot Fast Refresh
//     (`Could not Fast Refresh ("PRESETS" export is incompatible)`), so every
//     edit to the provider file forced a full reload and re-instantiated the
//     other contexts with it.
//
// The catalog is the source of truth for which tools a derived preset contains;
// see presetToolIds. `check-catalog-integrity.mjs` (check E) reads this file and
// fails if a derived preset is re-frozen into hand-listed ids.

import { launchableTools } from '@spier/core/data/catalog'
import { isPathwayRealization } from '@spier/core/lib/pathwayRealizations'

export type PresetId = 'guided-pathway' | 'minimum-viable' | 'common-mid-tier' | 'maximalist'

/**
 * The tool each stage defaults to when the PUBLISHED PATHWAY names none.
 *
 * `PlanDefinition/SPiERSuicideSaferCarePathway` is a clinical protocol — screen,
 * gate, assess, branch by tier, act, reassess — not a per-stage tool list. It
 * names a realization for three of the eight stages (PHQ-9 at Identify, the
 * C-SSRS Screener at Clarify, Stanley-Brown *and* crisis resources at Document
 * Safety Actions) and is deliberately silent on the other five. So a preset that
 * derived purely from it would enable four tools and leave five stages EMPTY —
 * the opposite of guiding a clinician through them.
 *
 * These five close that gap. They are declared here rather than added to the
 * PlanDefinition on purpose: a preset is a claim about what one deployment
 * turned on, and the PlanDefinition is a published clinical claim. Promoting
 * these into the artifact is a separate decision (Brad, 2026-09-18).
 *
 * ⚠️ **A stage the pathway DOES name must not appear here.** Two sources for one
 * stage is the drift this file already learned about the hard way, and
 * `check:catalog` check G fails on it — along with a stage that has neither.
 */
export const PATHWAY_STAGE_DEFAULTS: Readonly<Record<string, string>> = {
  // Only `core` tool at the stage; the alternate (TL-024, the CAMS therapeutic
  // worksheet) is `optional` and licensed separately.
  'define-risk-picture': 'TL-006',
  // The most general of five: it records that a handoff happened at all, which
  // the referral, the discharge packet and the appointment all elaborate.
  'coordinate-handoffs': 'TL-009',
  // The best-evidenced follow-up intervention in suicide prevention, and already
  // load-bearing here: `caring-contact` is a bespoke recorder precisely so it
  // stamps its profile and opt-out extension for a Stage-8 measure.
  'track-follow-up': 'TL-010',
  // The episode is the correlation hinge the rest of the stage hangs off — it is
  // what makes "where is this patient on the pathway" answerable at all.
  'track-risk-over-time': 'TL-038',
  // Already the stage's answer in behaviour: the Stage-8 CDS card's one action
  // is "Open measure dashboard".
  'measure-and-share': 'TL-043',
}

/** A preset id, or 'custom' when the enabled set matches no preset. */
export type ActivePreset = PresetId | 'custom'

export interface Preset {
  id: PresetId
  label: string
  description: string
  /**
   * Explicit tool ids, for presets that are a hand-picked floor. Presets that
   * are *defined* by a catalog property leave this empty and are resolved in
   * `presetToolIds` instead, so the catalog stays the single source of truth.
   */
  toolIds: string[]
}

export const PRESETS: Preset[] = [
  {
    id: 'guided-pathway',
    label: 'Guided Pathway',
    description: 'One tool at each of the eight stages — the instrument the published pathway names where it names one, and a single default where it does not. What a clinician is guided through, rather than a catalogue to choose from.',
    toolIds: [], // half derived from the pathway, half PATHWAY_STAGE_DEFAULTS — see presetToolIds()
  },
  {
    id: 'minimum-viable',
    label: 'Minimum Viable',
    description: 'Only the ASQ screener. Smallest possible implementation — demonstrates a site that can flag risk but has no other tooling in place.',
    toolIds: ['TL-001'],
  },
  {
    id: 'common-mid-tier',
    label: 'Common Mid-Tier',
    description: 'Every tool the catalog marks core — at least one at each of the eight pathway stages. Representative of a site that carries risk through to follow-up rather than only screening for it.',
    toolIds: [], // derived from inclusionStatus — see presetToolIds()
  },
  {
    id: 'maximalist',
    label: 'Maximalist',
    description: 'Every launchable tool enabled, including the optional alternates. A reference implementation with full pathway coverage end-to-end.',
    toolIds: [], // derived as "all launchable" — see presetToolIds()
  },
]

/**
 * The preset the app starts on, and what "reset" returns to.
 *
 * ⚠️ **Changed from `common-mid-tier` on 2026-09-18** (Brad: *"can we make the
 * default set of tools reflect this care pathway"*). Mid-tier turns on every
 * `core` tool — 21 of 34, up to four at one stage — which is a catalogue with a
 * good default, not a pathway.
 *
 * ⚠️ **Changing this default is how the 2026-09-02 defect happened**, so it was
 * measured rather than assumed: `buildCdsCards` DROPS an alert card whose tool
 * is disabled, and a preset that switched off the named tool once made a card
 * vanish from the standalone chart while the host page still showed it. All 14
 * demo scenarios were built under both presets before this landed — same cards,
 * same count, every stage card keeping at least one launch. (The zero-link
 * "consider a problem-list entry" card on four patients is informational and has
 * no links with EVERY tool enabled either.) `toolPresets.test.ts` keeps that
 * property rather than leaving it to the measurement.
 */
export const DEFAULT_PRESET: PresetId = 'guided-pathway'

export function allLaunchableIds(): string[] {
  return launchableTools().map(t => t.id)
}

/**
 * The tools a preset turns on.
 *
 * Only Minimum Viable is a hand-picked list; the other two are *derived from the
 * catalog* so they cannot drift as tools are added. Mid-tier used to hand-list
 * four ids (TL-001/002/003/007) and was never revisited as the catalog grew to
 * 34 launchable tools — it ended up excluding 17 of the 21 launchable tools the
 * catalog itself marks `core`, covering 2 of the 8 pathway stages while
 * describing itself as a typical site. Deriving it from `inclusionStatus`
 * removes the second source of truth; check E of
 * `scripts/check-catalog-integrity.mjs` enforces that it stays derived.
 */
export function presetToolIds(presetId: PresetId): string[] {
  const launchable = launchableTools()
  switch (presetId) {
    case 'guided-pathway': {
      // Derived on both halves: the pathway's own realizations through
      // `isPathwayRealization`, and the five gap-fillers by stage rather than by
      // a frozen id list. Nothing here is a second copy of the catalog.
      const picked = new Set(Object.values(PATHWAY_STAGE_DEFAULTS))
      return launchable.filter(t => isPathwayRealization(t) || picked.has(t.id)).map(t => t.id)
    }
    case 'maximalist':
      return launchable.map(t => t.id)
    case 'common-mid-tier':
      return launchable.filter(t => t.inclusionStatus === 'core').map(t => t.id)
    default:
      return PRESETS.find(p => p.id === presetId)!.toolIds
  }
}

/** A preset resolved to the full enabled/disabled map the provider persists. */
export function presetEnabled(presetId: PresetId): Record<string, boolean> {
  const ids = new Set(presetToolIds(presetId))
  return Object.fromEntries(allLaunchableIds().map(id => [id, ids.has(id)]))
}

/** Whether an enabled map is exactly this preset (used to detect 'custom'). */
export function isExactPresetMatch(
  enabled: Record<string, boolean>,
  presetId: PresetId,
): boolean {
  const target = presetEnabled(presetId)
  const allIds = new Set([...Object.keys(target), ...Object.keys(enabled)])
  for (const id of allIds) {
    if (!!target[id] !== !!enabled[id]) return false
  }
  return true
}
