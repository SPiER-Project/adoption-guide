/**
 * Which patient the chart is showing, resolved from the URL, the query flags and
 * localStorage — in that order of authority.
 *
 * Extracted from `PatientProvider` (#126). It is a concern with three inputs and
 * one output, and none of the rest of the provider needs to know how the answer
 * was reached.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from './useLocalStorage'
import { POPULATION_BY_ID, isAllowedPatientId } from '@spier/demo-population'

// Persisted across non-chart routes so assessment-submit redirects don't lose
// the active patient. The patient *store* keys (spier-patient-store /
// spier-blank-slice) live in LocalDataSource; this one is selection state.
const ACTIVE_ID_KEY = 'spier-active-patient-id'

// The patient shown when the chart is opened in "demo mode" (?demo=1) — the
// ED suicide-care Scenario 11 walkthrough used for the federal-regulator
// briefing. See issue #51 and docs/use-cases/ed-scenario-11.md.
export const DEMO_PATIENT_ID = 'patient-011'

// URL like /patient/chart/patient-005 → 'patient-005'. Returns null for any
// other path. Also returns null for IDs that aren't in the population dataset
// — defense against crafted URLs being used as store keys (e.g.
// /patient/chart/__proto__) and a guard against typo'd IDs silently creating
// empty patient slices.
function deriveActiveIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/patient\/chart\/([^/]+)\/?$/)
  if (!m) return null
  const id = decodeURIComponent(m[1])
  return POPULATION_BY_ID.has(id) ? id : null
}

/**
 * The active patient id, or null for the blank "play with forms" state.
 *
 * Returns the resolved value on the SAME render the route changes — it is
 * derived during render rather than held in state, and the effect below only
 * writes the choice back to storage. Anything that must not act on a stale
 * patient should key off this value, not off an effect that follows it.
 */
export function useActivePatientId(): string | null {
  const location = useLocation()
  const [storedActiveId, setStoredActiveId] = useLocalStorage<string | null>(
    ACTIVE_ID_KEY,
    null,
  )

  // /patient/chart?new=1 is the explicit "blank state" entry point (sidebar
  // Patient tab). /patient/chart?demo=1 is the regulator-briefing entry point
  // that loads the ED Scenario 11 walkthrough. Without either flag, bare
  // /patient/chart preserves the last viewed patient so assessment-submit
  // redirects don't lose context.
  const search = new URLSearchParams(location.search)
  const wantsBlank = location.pathname === '/patient/chart' && search.get('new') === '1'
  const wantsDemo =
    location.pathname === '/patient/chart' &&
    search.get('demo') === '1' &&
    isAllowedPatientId(DEMO_PATIENT_ID)

  const urlPatientId = deriveActiveIdFromPath(location.pathname)
  const safeStoredId =
    storedActiveId && isAllowedPatientId(storedActiveId) ? storedActiveId : null
  const activePatientId: string | null = wantsBlank
    ? null
    : wantsDemo
      ? DEMO_PATIENT_ID
      : (urlPatientId ?? safeStoredId)

  useEffect(() => {
    if (wantsBlank && storedActiveId !== null) {
      setStoredActiveId(null)
    } else if (wantsDemo && storedActiveId !== DEMO_PATIENT_ID) {
      setStoredActiveId(DEMO_PATIENT_ID)
    } else if (urlPatientId && urlPatientId !== storedActiveId) {
      setStoredActiveId(urlPatientId)
    }
  }, [wantsBlank, wantsDemo, urlPatientId, storedActiveId, setStoredActiveId])

  return activePatientId
}
