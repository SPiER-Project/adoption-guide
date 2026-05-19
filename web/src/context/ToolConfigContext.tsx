import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { launchableTools } from '../data/catalog'

export type PresetId = 'minimum-viable' | 'common-mid-tier' | 'maximalist'
export type ActivePreset = PresetId | 'custom'

export interface Preset {
  id: PresetId
  label: string
  description: string
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
    description: 'ASQ + PHQ-9 + C-SSRS Screener for flagging, plus Stanley-Brown for safety planning. Representative of a typical ambulatory EHR setup.',
    toolIds: ['TL-001', 'TL-002', 'TL-003', 'TL-007'],
  },
  {
    id: 'maximalist',
    label: 'Maximalist',
    description: 'Every launchable tool enabled. A reference implementation with full pathway coverage end-to-end.',
    toolIds: [], // populated lazily as "all launchable" below
  },
]

const STORAGE_KEY = 'spier.toolConfig'
const DEFAULT_PRESET: PresetId = 'common-mid-tier'

interface PersistedState {
  enabledToolIds: Record<string, boolean>
  activePreset: ActivePreset
}

function getAllLaunchableIds(): string[] {
  return launchableTools().map(t => t.id)
}

function presetEnabled(presetId: PresetId): Record<string, boolean> {
  const preset = PRESETS.find(p => p.id === presetId)!
  const ids = presetId === 'maximalist' ? getAllLaunchableIds() : preset.toolIds
  const all = getAllLaunchableIds()
  return Object.fromEntries(all.map(id => [id, ids.includes(id)]))
}

function loadInitial(): PersistedState {
  if (typeof window === 'undefined') {
    return { enabledToolIds: presetEnabled(DEFAULT_PRESET), activePreset: DEFAULT_PRESET }
  }
  try {
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

export function useToolConfig() {
  const ctx = useContext(ToolConfigContext)
  if (!ctx) throw new Error('useToolConfig must be used inside ToolConfigProvider')
  return ctx
}
