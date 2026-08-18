import { createContext, useContext } from 'react'

/**
 * Which chrome the app is wearing.
 *
 * - `ehr`   — the standalone demo: full header, lens sidebar, patient banner,
 *             footer. What every route has rendered until now.
 * - `panel` — SPiER embedded as a SMART activity in a host chart. The host owns
 *             the surrounding chrome, so ours collapses to a patient identity
 *             strip and the page's own header.
 *
 * Deliberately NOT a "data source" or "build surface" flag. Those are two other
 * axes (`FhirDataSource`, and `VITE_SURFACE` in surfaces-and-distribution.md §3),
 * and conflating any two of the three is what the panel plan warns against —
 * panel chrome must not imply a connected server, and neither implies what a
 * client receives.
 */
export type ChromeMode = 'ehr' | 'panel'

export interface PresentationContextType {
  chromeMode: ChromeMode
  /**
   * Set the chrome for the session.
   *
   * The seam for phase 2: a SMART launch that carries `intent` marking an
   * embedded activity calls this from `/redirect`. Today the only caller is the
   * `?embed=1` bootstrap, which is the testing path the plan names.
   */
  setChromeMode: (mode: ChromeMode) => void
}

export const PresentationContext = createContext<PresentationContextType | undefined>(undefined)

export function usePresentation() {
  const context = useContext(PresentationContext)
  if (context === undefined) {
    throw new Error('usePresentation must be used within a PresentationProvider')
  }
  return context
}
