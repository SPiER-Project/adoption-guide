import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { PresentationContext, type ChromeMode } from './PresentationContext'

/**
 * Where the persisted chrome mode lives. Session-scoped, so it dies with the tab.
 */
const CHROME_KEY = 'spier:chrome-mode'

/**
 * ⚠️ **The embed flag cannot survive the SMART redirect in the URL, so it is
 * persisted.** This is not a convenience.
 *
 * `?embed=1` arrives on the launch URL the host frames. The OAuth leg then
 * replaces the whole query string with `?code=…&state=…`, because a redirect URI
 * may not carry a fragment and the app registers its bare base URL as the
 * redirect (see `SmartLaunch`). So by the time the panel renders anything, the
 * flag the host sent is gone — and the app would come back up in full EHR
 * chrome *inside the host's iframe*, complete with a second header and a second
 * patient banner. Reading it once and remembering it for the session is what
 * makes an embedded launch stay embedded.
 *
 * Session storage rather than local: the host frames the app per tab, and a flag
 * that outlived the tab would put a later ordinary visit into panel chrome.
 *
 * ⚠️ It can throw, and that is a real case rather than defensive habit. A
 * cross-origin iframe under full third-party storage blocking (Safari's default)
 * denies storage access outright. Every access here is guarded so the panel
 * degrades to EHR chrome rather than failing to render — though note that
 * `fhirclient` keeps its own OAuth state in `sessionStorage` too, so in that
 * browser the launch itself does not complete and the chrome is the least of it.
 */
function readStoredMode(): ChromeMode | null {
  try {
    const stored = window.sessionStorage.getItem(CHROME_KEY)
    return stored === 'panel' || stored === 'ehr' ? stored : null
  } catch {
    return null
  }
}

function storeMode(mode: ChromeMode): void {
  try {
    window.sessionStorage.setItem(CHROME_KEY, mode)
  } catch {
    // Storage denied — see above. The mode still applies to this render.
  }
}

/**
 * Reads the initial chrome mode from `?embed=1`, falling back to what an earlier
 * navigation in this tab recorded.
 *
 * ⚠️ The REAL query string, not the hash route — same constraint the SMART
 * bootstrap in `main.tsx` documents. Under `HashRouter` the query lives before
 * the `#`, so it survives every in-app navigation without being threaded through
 * the router. That is exactly the property an embed flag needs: the host frames
 * the app once, and the panel stays a panel for the whole session.
 *
 * An explicit `embed` parameter always wins and is always recorded — including
 * `embed=0`, which is how a host (or a developer) leaves panel chrome without
 * opening a new tab.
 */
function initialChromeMode(): ChromeMode {
  if (typeof window === 'undefined') return 'ehr'
  const param = new URLSearchParams(window.location.search).get('embed')
  if (param !== null) {
    const mode: ChromeMode = param === '1' ? 'panel' : 'ehr'
    storeMode(mode)
    return mode
  }
  return readStoredMode() ?? 'ehr'
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
  /**
   * The host told us it draws the patient banner itself.
   *
   * Starts false because the safe default is to name the patient: a panel that
   * silently stops identifying whose chart it is showing is a safety problem,
   * not a layout one. Only an explicit `need_patient_banner: false` in the SMART
   * launch context turns it off, and `SmartRedirect` is the only caller.
   */
  const [hostDrawsPatientBanner, setHostDrawsPatientBanner] = useState(false)

  const setChromeMode = useCallback((mode: ChromeMode) => {
    storeMode(mode)
    setMode(mode)
  }, [])

  const value = useMemo(
    () => ({ chromeMode, setChromeMode, hostDrawsPatientBanner, setHostDrawsPatientBanner }),
    [chromeMode, setChromeMode, hostDrawsPatientBanner],
  )
  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>
}
