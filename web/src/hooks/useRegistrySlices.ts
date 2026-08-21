/**
 * Registry-wide slices, read through the `FhirDataSource` seam.
 *
 * The population lens and the measure dashboard both need "every patient's
 * slice", and both used to get it by importing `localDataSource` directly and
 * calling its optional synchronous read. That is what made them local-only under
 * SMART: a live SMART session changed the chart's source and left these two pages
 * rendering bundled demo data, which looks exactly like a server read
 * (`embedded-panel-smart-launch.md` §6.3, blocker 1). Step C (#390).
 *
 * ⚠️ **The cohort question is deliberately NOT answered here.** `FhirDataSource`
 * is per-patient, and a SMART token is bound to one patient — reaching for
 * another is a 403. A genuine registry read needs a user-scoped launch
 * (`user/*.read`, no patient in context) plus a decision about what "the
 * caseload" is on a server where it is not a static list of 14.
 * `mock-patient-smart-launch.md` §8 calls that genuine design work rather than a
 * refactor, and it is blocker 2. So this hook reports its SCOPE and lets the page
 * say so, instead of quietly falling back to local data.
 */
import { useEffect, useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import type { PatientSlice } from '@spier/core/types/fhir'
import type { FhirDataSource } from '@spier/core/lib/dataSource/types'
import type { RegistryPatient } from '@spier/core/lib/registry'

export const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
}

export interface RegistryEntry {
  patient: RegistryPatient
  slice: PatientSlice
}

export type RegistryScope =
  /** The source can serve the whole demo registry (local / in-memory). */
  | 'registry'
  /** The source is bound to one patient, so only that patient is readable. */
  | 'in-context'

export interface RegistrySlices {
  entries: RegistryEntry[]
  scope: RegistryScope
  /** True until the first async read settles. Never true for a sync source. */
  isLoading: boolean
}

/**
 * Which patients the ACTIVE source can honestly answer for.
 *
 * A SMART session is patient-bound, so the cohort is the patient in context and
 * nothing else. This is the one judgement the hook makes, and it is a
 * presentational honesty call rather than a new capability: the alternative on
 * the table was to keep reading local data during a SMART session, which states
 * something false about where the rows came from.
 */
function cohortFor(
  all: RegistryPatient[],
  isSmartConnected: boolean,
  inContextId: string | null,
): { patients: RegistryPatient[]; scope: RegistryScope } {
  if (!isSmartConnected) return { patients: all, scope: 'registry' }
  // ⚠️ Under SMART the identity comes from the SMART context, NOT the URL:
  // `activePatientId` is URL-derived and is null on /population, so filtering on
  // it yielded an empty cohort. The launch patient is `patient.id`.
  //
  // Against the mock EHR the ids line up, because it serves these same fixtures.
  // Against a foreign server they would not, and the cohort is then empty — which
  // the scope notice explains rather than the page silently showing local rows.
  // Rendering an arbitrary server patient here would need display fields this
  // registry type does not carry, and that is part of blocker 2's design work.
  const inContext = all.filter(p => p.id === inContextId)
  return { patients: inContext, scope: 'in-context' }
}

/** Read every cohort patient's slice, synchronously where the source allows. */
function readSync(source: FhirDataSource, patients: RegistryPatient[]): RegistryEntry[] | null {
  if (!source.getSliceSync) return null
  return patients.map(p => ({
    patient: p,
    slice: source.getSliceSync?.(p.id) ?? EMPTY_SLICE,
  }))
}

export function useRegistrySlices(): RegistrySlices {
  const { dataSource, isSmartConnected, activePatientId, patient, populationPatients } =
    usePatient()

  // Under SMART the in-context patient is the launch patient (`patient.id`);
  // locally it is whatever the URL names.
  const inContextId = isSmartConnected ? (patient?.id ?? null) : activePatientId

  const { patients, scope } = useMemo(
    () => cohortFor(populationPatients, isSmartConnected, inContextId),
    [populationPatients, isSmartConnected, inContextId],
  )

  // First paint uses the sync read when the source has one, so a local session
  // renders with no loading flash — the behaviour before step C.
  const [entries, setEntries] = useState<RegistryEntry[]>(
    () => readSync(dataSource, patients) ?? [],
  )
  const [isLoading, setIsLoading] = useState(() => !dataSource.getSliceSync)

  useEffect(() => {
    let live = true

    const refresh = () => {
      const sync = readSync(dataSource, patients)
      if (sync) {
        // A synchronous source: no await, and no window where the page shows
        // stale rows after a submit.
        setEntries(sync)
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      // `getSlice` is per-patient, so a cohort read is N reads. That is honest
      // about what the seam offers rather than pretending to a batch query.
      Promise.all(
        patients.map(p =>
          dataSource
            .getSlice(p.id)
            .then(slice => ({ patient: p, slice }))
            // One unreadable patient must not blank the whole page: a
            // patient-bound token 403s for anyone but its own subject.
            .catch(() => ({ patient: p, slice: EMPTY_SLICE })),
        ),
      ).then(next => {
        if (!live) return
        setEntries(next)
        setIsLoading(false)
      })
    }

    refresh()
    const unsubscribe = dataSource.subscribe(refresh)
    return () => {
      live = false
      unsubscribe()
    }
  }, [dataSource, patients])

  return { entries, scope, isLoading }
}
