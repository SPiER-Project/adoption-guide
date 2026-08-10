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

import { launchableTools } from './catalog'

export type PresetId = 'minimum-viable' | 'common-mid-tier' | 'maximalist'

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

/** The preset the app starts on, and what "reset" returns to. */
export const DEFAULT_PRESET: PresetId = 'common-mid-tier'

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
