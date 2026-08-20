import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSmart } from '../context/SmartContext'
import {
  markFollowing,
  subscribePatientOpen,
  type FhircastTransportKind,
  type PatientOpenPayload,
} from '../lib/fhircast'
import '../css/FhircastListener.css'

// Only a tab already viewing a patient chart follows a broadcast. This mirrors
// real FHIRcast: a subscribed chart app follows context changes, but we never
// yank a user out of, say, a half-filled assessment or the adoption guide.
const CHART_ROUTE = /^\/patient\/chart(\/|$)/

/**
 * App-wide listener for FHIRcast `patient-open` events.
 *
 * ── The policy depends on WHO sent the event, and step 6 inverted half of it ──
 *
 * This component used to carry one flat rule: *"Ignore broadcasts entirely under
 * a live SMART session — the connected EHR owns patient context there, not this
 * simulation."* That was right for the only transport that existed. A
 * `BroadcastChannel` reaches other tabs of **this app**, so under SMART an
 * incoming event was another copy of us guessing at context the EHR actually
 * owned.
 *
 * With a real hub (step 6) the opposite holds, and by the same reasoning: a hub
 * event under SMART *is* the connected EHR reporting its own context change. The
 * rule was never "ignore events under SMART" — it was "do not let a simulation
 * override the system of record", and the two transports land on opposite sides
 * of it. So:
 *
 * | Arrived via | Under SMART | Standalone |
 * |---|---|---|
 * | `hub` (the EHR's own hub) | **follow it** — see the patient-scope note | n/a: a hub is only known from a launch |
 * | `broadcast` (another SPiER tab) | ignore — the EHR owns context | follow while on a chart route |
 *
 * ⚠️ **"Follow" cannot mean "read that patient", and this is the constraint that
 * makes an embedded panel different from a standalone app.** The panel's access
 * token is bound to ONE patient — `denyForeignPatient` in the mock returns 403
 * for any other, and a real EHR is no more permissive. So when the host moves to
 * a different patient, the honest response is not to navigate: it is to say the
 * session no longer matches what the clinician is looking at, and stop presenting
 * data as current. Navigating would produce a chart of 403s, and silently
 * continuing to show the old patient while the EHR has moved on is worse than
 * either.
 */
export function FhircastListener() {
  const navigate = useNavigate()
  const location = useLocation()
  const { patient: smartPatient } = useSmart()
  const isSmartConnected = !!(smartPatient && smartPatient.name)
  const smartPatientId = smartPatient?.id ?? null

  /**
   * The followed context change, and which transport it came on. `via` is kept
   * because the banner must not call a real hub event "simulated" — that label
   * was accurate for every event this component could receive before step 6, and
   * is now accurate for only one of the two transports.
   */
  const [followed, setFollowed] = useState<{ payload: PatientOpenPayload; via: FhircastTransportKind } | null>(null)
  /** Set when the host opened a patient this session is not scoped to. */
  const [outOfScope, setOutOfScope] = useState<PatientOpenPayload | null>(null)

  // Read the latest route/SMART state from inside the (stable) subscription
  // without resubscribing on every navigation. Synced in an effect (never
  // during render) so the ref always trails committed state.
  const stateRef = useRef({ pathname: location.pathname, isSmartConnected, smartPatientId })
  useEffect(() => {
    stateRef.current = { pathname: location.pathname, isSmartConnected, smartPatientId }
  }, [location.pathname, isSmartConnected, smartPatientId])

  const dismiss = useCallback(() => {
    setFollowed(null)
    setOutOfScope(null)
  }, [])

  useEffect(() => {
    return subscribePatientOpen((payload, _event, via: FhircastTransportKind) => {
      const { pathname, isSmartConnected, smartPatientId } = stateRef.current

      if (via === 'hub') {
        // The connected EHR's own hub. Its context change is authoritative.
        if (smartPatientId && payload.patientId !== smartPatientId) {
          // Out of scope — see the header. No navigation, and the notice shows
          // regardless of route: someone half-way through an assessment for a
          // patient the EHR has closed most needs to know.
          setOutOfScope(payload)
          return
        }
        if (pathname === `/patient/chart/${payload.patientId}`) return
        if (!CHART_ROUTE.test(pathname)) return
        markFollowing(payload.patientId, Date.now())
        navigate(`/patient/chart/${payload.patientId}`)
        setFollowed({ payload, via })
        return
      }

      // BroadcastChannel — another tab of this app, standing in for a second
      // subscribed app. Never allowed to override a live SMART session.
      if (isSmartConnected) return
      if (!CHART_ROUTE.test(pathname)) return
      // Already viewing this patient — nothing to switch, no banner.
      if (pathname === `/patient/chart/${payload.patientId}`) return
      // Mark this as a programmatic follow BEFORE navigating so PatientContext's
      // publish effect (which fires once the navigation changes the active
      // patient) suppresses it instead of rebroadcasting — no cross-tab echo.
      markFollowing(payload.patientId, Date.now())
      navigate(`/patient/chart/${payload.patientId}`)
      setFollowed({ payload, via })
    })
  }, [navigate])

  if (outOfScope) {
    const who = outOfScope.displayName ?? `patient ${outOfScope.patientId}`
    return (
      <div className="fhircast-banner fhircast-banner--warn" role="alert">
        <span className="fhircast-banner-badge">FHIRcast</span>
        <span className="fhircast-banner-text">
          The chart moved to <strong>{who}</strong>. This panel was launched for a different
          patient, so it cannot show them — <strong>relaunch from their chart</strong>. What is
          below is no longer what the clinician is looking at.
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

  if (!followed) return null

  const who = followed.payload.displayName ?? `patient ${followed.payload.patientId}`

  return (
    <div className="fhircast-banner" role="status" aria-live="polite">
      <span className="fhircast-banner-badge">FHIRcast</span>
      <span className="fhircast-banner-text">
        Context changed to <strong>{who}</strong> via FHIRcast{' '}
        {followed.via === 'hub'
          ? <em>(from the connected EHR&rsquo;s hub)</em>
          : <em>(simulated)</em>}
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
