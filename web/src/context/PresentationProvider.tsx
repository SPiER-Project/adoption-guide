import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { PresentationContext, type ChromeMode } from './PresentationContext'

/**
 * Reads the initial chrome mode from `?embed=1`.
 *
 * ⚠️ The REAL query string, not the hash route — same constraint the SMART
 * bootstrap in `main.tsx` documents. Under `HashRouter` the query lives before
 * the `#`, so it survives every in-app navigation without being threaded through
 * the router. That is exactly the property an embed flag needs: the host frames
 * the app once, and the panel stays a panel for the whole session.
 */
function initialChromeMode(): ChromeMode {
  if (typeof window === 'undefined') return 'ehr'
  return new URLSearchParams(window.location.search).get('embed') === '1' ? 'panel' : 'ehr'
}

export function PresentationProvider({
  children,
  /** Test seam; production reads `?embed=1`. */
  initialMode,
}: {
  children: ReactNode
  initialMode?: ChromeMode
}) {
  const [chromeMode, setMode] = useState<ChromeMode>(() => initialMode ?? initialChromeMode())
  const setChromeMode = useCallback((mode: ChromeMode) => setMode(mode), [])
  const value = useMemo(() => ({ chromeMode, setChromeMode }), [chromeMode, setChromeMode])
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>
}
