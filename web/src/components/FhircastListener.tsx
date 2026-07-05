import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSmart } from '../context/SmartContext'
import { subscribePatientOpen, type PatientOpenPayload } from '../lib/fhircast'
import '../css/FhircastListener.css'

// Only a tab already viewing a patient chart follows a broadcast. This mirrors
// real FHIRcast: a subscribed chart app follows context changes, but we never
// yank a user out of, say, a half-filled assessment or the adoption guide.
const CHART_ROUTE = /^\/patient\/chart(\/|$)/

/**
 * Invisible app-wide listener for simulated FHIRcast `patient-open` events
 * broadcast by the population worklist (see `lib/fhircast.ts`). When another
 * tab opens a patient and this tab is currently on a chart route, it navigates
 * to that patient's chart and shows a dismissible "context changed" banner so
 * the switch is never silent.
 *
 * Guardrails:
 *  - Follow only while on a chart route (never interrupt other work).
 *  - Ignore broadcasts entirely under a live SMART session — the connected
 *    EHR owns patient context there, not this simulation.
 */
export function FhircastListener() {
  const navigate = useNavigate()
  const location = useLocation()
  const { patient: smartPatient } = useSmart()
  const isSmartConnected = !!(smartPatient && smartPatient.name)

  const [followed, setFollowed] = useState<PatientOpenPayload | null>(null)

  // Read the latest route/SMART state from inside the (stable) subscription
  // without resubscribing on every navigation. Synced in an effect (never
  // during render) so the ref always trails committed state.
  const stateRef = useRef({ pathname: location.pathname, isSmartConnected })
  useEffect(() => {
    stateRef.current = { pathname: location.pathname, isSmartConnected }
  }, [location.pathname, isSmartConnected])

  const dismiss = useCallback(() => setFollowed(null), [])

  useEffect(() => {
    return subscribePatientOpen(payload => {
      const { pathname, isSmartConnected } = stateRef.current
      if (isSmartConnected) return
      if (!CHART_ROUTE.test(pathname)) return
      // Already viewing this patient — nothing to switch, no banner.
      if (pathname === `/patient/chart/${payload.patientId}`) return
      navigate(`/patient/chart/${payload.patientId}`)
      setFollowed(payload)
    })
  }, [navigate])

  if (!followed) return null

  const who = followed.displayName ?? `patient ${followed.patientId}`

  return (
    <div className="fhircast-banner" role="status" aria-live="polite">
      <span className="fhircast-banner-badge">FHIRcast</span>
      <span className="fhircast-banner-text">
        Context changed to <strong>{who}</strong> via FHIRcast <em>(simulated)</em>
      </span>
      <button
        type="button"
        className="fhircast-banner-dismiss"
        onClick={dismiss}
        aria-label="Dismiss FHIRcast context notice"
      >
        ×
      </button>
    </div>
  )
}
