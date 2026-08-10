// The tool-config context object and its hook — deliberately NOT a .tsx, and
// deliberately holding no component.
//
// React Fast Refresh can only preserve state for a module whose exports are all
// components. Pairing the `useToolConfig` hook with the `ToolConfigProvider`
// component in one file made that module incompatible, so every edit to it (or
// to anything it imported, such as the presets) re-executed it and reset the
// contexts below it. Splitting them means the provider file is component-only
// and refreshes cleanly, and this file is hook-only so the rule does not apply.
//
// The provider lives in ToolConfigProvider.tsx and imports the context object
// from here. Consumers import `useToolConfig` from here, which is the path they
// already used.

import { createContext, useContext } from 'react'
import type { ActivePreset, PresetId } from '../data/toolPresets'

export interface ToolConfigContextValue {
  enabledToolIds: Record<string, boolean>
  activePreset: ActivePreset
  isToolEnabled: (toolId: string) => boolean
  setPreset: (presetId: PresetId) => void
  toggleTool: (toolId: string) => void
  resetToDefault: () => void
}

export const ToolConfigContext = createContext<ToolConfigContextValue | undefined>(undefined)

export function useToolConfig() {
  const ctx = useContext(ToolConfigContext)
  if (!ctx) throw new Error('useToolConfig must be used inside ToolConfigProvider')
  return ctx
}
