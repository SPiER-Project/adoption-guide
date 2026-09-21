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
 * ⚠️ **The cohort question is answered by the SOURCE now, not here** (#401).
 * `FhirDataSource.listCohort` is what a source uses to say who is on the panel;
 * it is optional and nullable, and `null` means "I cannot answer that" — which
 * is a different answer from `[]`. A patient-bound SMART session returns `null`
 * (its token 403s for anyone but its own subject), the local store returns the
 * bundled registry because those patients genuinely are its whole population,
 * and a worklist launch returns the roster it fetched.
 *
 * This hook's job is therefore to ASK and to report the resulting scope, never
 * to decide the cohort itself — which is what it used to do, by filtering the
 * bundled list. The rule it still enforces is the honesty one: when the source
 * cannot serve a cohort, the page says it is showing one patient rather than
 * quietly rendering local rows beside a live connection (blocker 1, #390).
 */
import { useEffect, useMemo, useState } from 'react'
import { usePatient } from '@spier/tool-views/context/PatientContext'
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
  /** The source served a cohort, and these are its patients. */
  | 'registry'
  /** A patient-bound session: one chart is readable and a cohort is not. */
  | 'in-context'
  /**
   * Nothing to read at all — no session, and no bundled population to stand in
   * for one. The clinical build compiles the demo population away, so this is
   * what its caseload URL is on a browser that was never launched.
   */
  | 'no-source'

export interface RegistrySlices {
  entries: RegistryEntry[]
  scope: RegistryScope
  /** True until the first async read settles. Never true for a sync source. */
  isLoading: boolean
}

/**
 * ⚠️ **A cohort of one is not a cohort, and this hook stops trying to build
 * one** (clinical-app audit §8.7).
 *
 * It used to answer a patient-bound session by filtering the BUNDLED registry
 * down to the launch patient. Two things were wrong with that, and only the
 * second was visible from inside the hook's own tests, which pass
 * `populationPatients` explicitly:
 *
 *  - `apps/clinical` mounts `PatientProvider` with **no** `populationPatients`,
 *    because neither build carries the demo population. So the filter ran over
 *    an empty list every time and produced nothing — while the page said
 *    *"Showing the patient in context only"* and showed nobody.
 *  - Even where it worked it was answering the wrong question. A caseload is a
 *    cross-patient artifact; one row is a chart. The pages now say which
 *    session they are in and offer the launch that can serve a caseload,
 *    instead of rendering a census of one.
 *
 * So the two non-registry scopes both carry **no entries**, and the difference
 * between them is what a reader is told: `in-context` is "this token is one
 * chart", `no-source` is "there is no connection here at all".
 */

/** Read every cohort patient's slice, synchronously where the source allows. */
function readSync(source: FhirDataSource, patients: RegistryPatient[]): RegistryEntry[] | null {
  if (!source.getSliceSync) return null
  return patients.map(p => ({
    patient: p,
    slice: source.getSliceSync?.(p.id) ?? EMPTY_SLICE,
  }))
}

export function useRegistrySlices(): RegistrySlices {
  const { dataSource, isSmartSession, populationPatients } = usePatient()

  // The source's answer to "who is on the panel", once it has given one. Until
  // then, and whenever it answers `null`, the in-context fallback applies — so
  // the first paint of a live worklist session shows one patient (or none) and
  // widens, rather than showing bundled rows it would have to take back.
  // ⚠️ The answer is stored WITH the source that gave it, and read back only
  // when they still match. The obvious shape — reset to `null` at the top of the
  // effect — is a synchronous `setState` inside an effect, which React flags as
  // cascading renders; tagging instead invalidates a stale cohort on a source
  // swap without a reset at all.
  const [served, setServed] = useState<{
    source: FhirDataSource
    cohort: RegistryPatient[] | null
  } | null>(null)

  useEffect(() => {
    let live = true
    if (!dataSource.listCohort) return
    dataSource
      .listCohort()
      .then(cohort => {
        if (live) setServed({ source: dataSource, cohort })
      })
      // A source that throws is a source that cannot answer. Same rendering as
      // an explicit `null`; the page's error state belongs to slice reads.
      .catch(() => {
        if (live) setServed({ source: dataSource, cohort: null })
      })
    return () => {
      live = false
    }
  }, [dataSource])

  const servedCohort = served && served.source === dataSource ? served.cohort : null

  const { patients, scope } = useMemo(() => {
    // What the source served, once it has served it.
    // `!== null`, not truthiness: an empty roster is a served cohort. A server
    // that genuinely holds no patients reports a panel of zero, which is a
    // different statement from "this source cannot answer".
    if (servedCohort !== null) return { patients: servedCohort, scope: 'registry' as RegistryScope }
    // ⚠️ No server in the picture: the bundled registry IS the cohort, and it is
    // used synchronously so the first paint is populated. `listCohort` is async
    // even on the local source, so waiting for it here would flash a one-patient
    // (or empty) caseload before widening — and this hook's own tests assert the
    // first render is complete, because that is the behaviour the direct
    // `localDataSource` import used to give.
    // ⚠️ `isSmartSession`, NOT `isSmartConnected`. A worklist launch has no
    // patient, so `isSmartConnected` is false for it — and this shortcut would
    // then hand it fourteen bundled demo patients while a real server sat on the
    // other end of the connection, labelled `scope: 'registry'`. Exactly the
    // dishonesty blocker 1 (#390) closed, re-entering through the new door.
    if (!isSmartSession) {
      return populationPatients.length > 0
        ? { patients: populationPatients, scope: 'registry' as RegistryScope }
        : { patients: [], scope: 'no-source' as RegistryScope }
    }
    // Connected, and the source has not served a cohort: one chart, said out
    // loud. This is a patient-bound chart launch, or a source with no
    // `listCohort` at all.
    return { patients: [], scope: 'in-context' as RegistryScope }
  }, [servedCohort, isSmartSession, populationPatients])

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
      // ⚠️ **The cohort read asks for the cohort**, when the source can answer
      // that way. `getSlice` is per patient and a chart slice is fourteen
      // searches, so fourteen patients used to be 196 cross-origin requests —
      // each preflighted — to draw the caseload's summary tiles (clinical-app
      // audit §8.8). `getSlices` is optional on the seam, so the per-patient
      // loop below stays as the answer for a source that does not offer it.
      // A patient missing from the returned map is one the source could not
      // read, which is an empty slice HERE rather than an absent row: the
      // caseload's job is to list the panel, and dropping a row would hide a
      // patient rather than show an empty one.
      const cohortRead = dataSource.getSlices
        ? dataSource
            .getSlices(patients.map(p => p.id))
            .then(slices => patients.map(p => ({ patient: p, slice: slices.get(p.id) ?? EMPTY_SLICE })))
        : Promise.all(
            patients.map(p =>
              dataSource
                .getSlice(p.id)
                .then(slice => ({ patient: p, slice }))
                // One unreadable patient must not blank the whole page: a
                // patient-bound token 403s for anyone but its own subject.
                .catch(() => ({ patient: p, slice: EMPTY_SLICE })),
            ),
          )
      void cohortRead
        .then(next => {
          if (!live) return
          setEntries(next)
          setIsLoading(false)
        })
        // Every per-patient rejection is already caught above; this only
        // guards the render step itself, so a thrown state update can never
        // surface as an unhandled promise rejection.
        .catch(() => {
          if (live) setIsLoading(false)
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
