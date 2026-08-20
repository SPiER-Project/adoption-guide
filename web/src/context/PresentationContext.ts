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
   * Set the chrome for the session, persisting it for the tab.
   *
   * Callers: the `?embed=1` bootstrap (which a host puts on the launch URL), and
   * anything that needs to leave or enter panel chrome without a reload.
   */
  setChromeMode: (mode: ChromeMode) => void
  /**
   * The host already identifies the patient, so the panel must not draw a second
   * banner. Set from the SMART launch context's `need_patient_banner: false`.
   *
   * ⚠️ A THIRD axis, deliberately separate from `chromeMode`. Panel chrome says
   * *the host owns the surrounding UI*; this says *the host owns the patient
   * banner*. They usually travel together and they are not the same claim — a
   * host may embed an activity and still expect the app to identify the patient,
   * and SMART gives it a standard way to say which. Collapsing the two would
   * make honoring the parameter impossible to demonstrate.
   */
  hostDrawsPatientBanner: boolean
  setHostDrawsPatientBanner: (hostDraws: boolean) => void
}

export const PresentationContext = createContext<PresentationContextType | undefined>(undefined)

export function usePresentation() {
  const context = useContext(PresentationContext)
  if (context === undefined) {
    throw new Error('usePresentation must be used within a PresentationProvider')
  }
  return context
}
