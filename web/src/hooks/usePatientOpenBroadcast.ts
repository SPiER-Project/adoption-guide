/**
 * The chart side of two-way FHIRcast: tell other tabs which patient this one
 * opened. Extracted from `PatientProvider` (#126).
 */
import { useEffect, useRef } from 'react'
import { publishPatientOpen, shouldPublishOnActivation } from '../lib/fhircast'
import { POPULATION_BY_ID } from '@spier/demo-population'

/**
 * Broadcast a `patient-open` whenever the active patient changes to a real
 * patient *in this tab* — so a chart open in another tab follows. This is the
 * chart-side counterpart to the population worklist's publish, giving true
 * two-way sync (direct chart-URL loads and in-chart patient switches now
 * broadcast too, not just worklist clicks).
 *
 * Echo suppression + guards live in shouldPublishOnActivation (lib/fhircast):
 * it skips publishing under SMART, for the blank state, for an already-sent
 * patient, and — crucially — for an activation that was itself an incoming
 * follow (marked by FhircastListener before it navigates), which would
 * otherwise ping-pong across tabs forever.
 */
export function usePatientOpenBroadcast({
  activePatientId,
  isSmartConnected,
}: {
  activePatientId: string | null
  isSmartConnected: boolean
}): void {
  const lastPublishedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      activePatientId !== null &&
      shouldPublishOnActivation({
        activePatientId,
        isSmartConnected,
        lastPublishedId: lastPublishedIdRef.current,
        now: Date.now(),
      })
    ) {
      const p = POPULATION_BY_ID.get(activePatientId)
      publishPatientOpen(
        { patientId: activePatientId, mrn: p?.mrn, displayName: p?.displayName },
        new Date().toISOString(),
      )
    }
    // Track the current selection either way, so a later re-run for an unchanged
    // patient (e.g. SMART toggling) doesn't rebroadcast it.
    lastPublishedIdRef.current = activePatientId
  }, [activePatientId, isSmartConnected])
}
