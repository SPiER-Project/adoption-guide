import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { launchableTools } from '../data/catalog'

export type PresetId = 'minimum-viable' | 'common-mid-tier' | 'maximalist'
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

// Shared preset data co-located with the provider by design.
// eslint-disable-next-line react-refresh/only-export-components
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

// Bumped when the meaning of a preset changes, so a returning browser is not
// left labelled "Common Mid-Tier" while holding the previous definition's tools.
// Mid-tier went from four hand-listed ids to the catalog's 21 launchable core
// tools.
const STORAGE_KEY = 'spier.toolConfig.v2'
const LEGACY_STORAGE_KEYS = ['spier.toolConfig']
const DEFAULT_PRESET: PresetId = 'common-mid-tier'

interface PersistedState {
  enabledToolIds: Record<string, boolean>
  activePreset: ActivePreset
}

function getAllLaunchableIds(): string[] {
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
 * describing itself as a typical site. Deriving it from `inclusionStatus` removes the
 * second source of truth; `check-catalog.mjs` enforces that it stays derived.
 */
// Preset resolution is co-located with PRESETS and the provider by design.
// eslint-disable-next-line react-refresh/only-export-components
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

function presetEnabled(presetId: PresetId): Record<string, boolean> {
  const ids = new Set(presetToolIds(presetId))
  return Object.fromEntries(getAllLaunchableIds().map(id => [id, ids.has(id)]))
}

function loadInitial(): PersistedState {
  if (typeof window === 'undefined') {
    return { enabledToolIds: presetEnabled(DEFAULT_PRESET), activePreset: DEFAULT_PRESET }
  }
  try {
    // Drop superseded keys rather than leaving a stale toolset in every
    // returning browser's storage.
    for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key)
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState
      if (parsed.enabledToolIds && parsed.activePreset) return parsed
    }
  } catch {
    // ignore — fall through to default
  }
  return { enabledToolIds: presetEnabled(DEFAULT_PRESET), activePreset: DEFAULT_PRESET }
}

function isExactPresetMatch(enabled: Record<string, boolean>, presetId: PresetId): boolean {
  const target = presetEnabled(presetId)
  const allIds = new Set([...Object.keys(target), ...Object.keys(enabled)])
  for (const id of allIds) {
    if (!!target[id] !== !!enabled[id]) return false
  }
  return true
}

interface ToolConfigContextValue {
  enabledToolIds: Record<string, boolean>
  activePreset: ActivePreset
  isToolEnabled: (toolId: string) => boolean
  setPreset: (presetId: PresetId) => void
  toggleTool: (toolId: string) => void
  resetToDefault: () => void
}

const ToolConfigContext = createContext<ToolConfigContextValue | undefined>(undefined)

export function ToolConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitial)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore quota / private-mode errors
    }
  }, [state])

  const isToolEnabled = useCallback(
    (toolId: string) => !!state.enabledToolIds[toolId],
    [state.enabledToolIds],
  )

  const setPreset = useCallback((presetId: PresetId) => {
    setState({ enabledToolIds: presetEnabled(presetId), activePreset: presetId })
  }, [])

  const toggleTool = useCallback((toolId: string) => {
    setState(prev => {
      const nextEnabled = { ...prev.enabledToolIds, [toolId]: !prev.enabledToolIds[toolId] }
      // After toggling, check whether the resulting set still matches a known preset
      const matched = PRESETS.find(p => isExactPresetMatch(nextEnabled, p.id))
      return { enabledToolIds: nextEnabled, activePreset: matched ? matched.id : 'custom' }
    })
  }, [])

  const resetToDefault = useCallback(() => setPreset(DEFAULT_PRESET), [setPreset])

  const value = useMemo<ToolConfigContextValue>(
    () => ({
      enabledToolIds: state.enabledToolIds,
      activePreset: state.activePreset,
      isToolEnabled,
      setPreset,
      toggleTool,
      resetToDefault,
    }),
    [state, isToolEnabled, setPreset, toggleTool, resetToDefault],
  )

  return <ToolConfigContext.Provider value={value}>{children}</ToolConfigContext.Provider>
}

// Hook co-located with its provider by design (idiomatic context module).
// eslint-disable-next-line react-refresh/only-export-components
export function useToolConfig() {
  const ctx = useContext(ToolConfigContext)
  if (!ctx) throw new Error('useToolConfig must be used inside ToolConfigProvider')
  return ctx
}
