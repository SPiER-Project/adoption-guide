import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_PRESET,
  PRESETS,
  isExactPresetMatch,
  presetEnabled,
  type ActivePreset,
  type PresetId,
} from '../data/toolPresets'
import { ToolConfigContext, type ToolConfigContextValue } from './ToolConfigContext'

// Which tools this implementation has turned on. The preset *definitions* live
// in data/toolPresets.ts and the context object plus its hook in
// ToolConfigContext.ts; this file is only the provider and its persistence, so
// it stays component-only and Fast Refresh works.

// Bumped when the meaning of a preset changes, so a returning browser is not
// left labelled "Common Mid-Tier" while holding the previous definition's tools.
// Mid-tier went from four hand-listed ids to the catalog's 21 launchable core
// tools.
const STORAGE_KEY = 'spier.toolConfig.v2'
const LEGACY_STORAGE_KEYS = ['spier.toolConfig']

interface PersistedState {
  enabledToolIds: Record<string, boolean>
  activePreset: ActivePreset
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
