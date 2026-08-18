import React, { useMemo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { formatPatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'
import {
  PatientContext,
  type PatientContextType,
  type PopulationPatient,
} from './PatientContext'
import { makeId } from '../lib/id'
import { deriveFromResponse } from '../lib/deriveFromResponse'
import {
  buildEpisode,
  findOpenEpisode,
  isPositiveScreen,
  pickEpisodeTrigger,
} from '../lib/riskEpisode'
import {
  attachAppointment,
  attachEpisode,
  buildEncounter,
  findOpenEncounter,
  stampEncounter,
} from '../lib/encounters'
import { localDataSource } from '../lib/dataSource/localDataSource'
import { SmartDataSource } from '../lib/dataSource/smartDataSource'
import type { FhirDataSource } from '../lib/dataSource/types'
import { publishPatientOpen, shouldPublishOnActivation } from '../lib/fhircast'
import populationPatientsData from '../data/population/patients.json'
import { POPULATION_SCENARIOS } from '../data/population/scenarios'
import type {
  CarePlanResource,
  EncounterResource,
  EpisodeOfCareResource,
  FhirResource,
  ObservationResource,
  PatientResource,
  PatientSlice,
  QuestionnaireResponseResource,
  ScenarioEncounter,
  StoredResponse,
} from '../types/fhir'

// PopulationPatient, PatientContextType, the context object and usePatient all
// live in PatientContext.ts so this module stays component-only.

const POPULATION_PATIENTS = populationPatientsData as PopulationPatient[]
const POPULATION_BY_ID = new Map(POPULATION_PATIENTS.map(p => [p.id, p]))

// Persisted across non-chart routes so assessment-submit redirects don't lose
// the active patient. The patient *store* keys (spier-patient-store /
// spier-blank-slice) live in LocalDataSource; this one is selection state.
const ACTIVE_ID_KEY = 'spier-active-patient-id'

// The patient shown when the chart is opened in "demo mode" (?demo=1) — the
// ED suicide-care Scenario 11 walkthrough used for the federal-regulator
// briefing. See issue #51 and docs/use-cases/ed-scenario-11.md.
const DEMO_PATIENT_ID = 'patient-011'

// Fallback initial slice for the first render when the data source can't
// resolve synchronously (async-only sources like SmartDataSource omit
// getSliceSync). LocalDataSource hydrates synchronously so this is never
// shown in the default configuration.
const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
}

/** Chart-slice load state — the slice plus async fetch progress/failure. */
interface SliceState {
  slice: PatientSlice
  isLoading: boolean
  error: string | null
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function populationToFhir(p: PopulationPatient) {
  const [given, ...familyParts] = p.displayName.split(' ')
  return {
    resourceType: 'Patient' as const,
    id: p.id,
    name: [
      {
        use: 'official' as const,
        given: [given ?? ''],
        family: familyParts.join(' '),
      },
    ],
    birthDate: p.dob,
    gender: p.gender.toLowerCase(),
    identifier: [
      { system: 'http://hospital.example.org/mrn', value: p.mrn },
    ],
  }
}

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

function isAllowedPatientId(id: string): boolean {
  return POPULATION_BY_ID.has(id)
}


// Build a FHIR-ish Patient resource that represents the blank state, so
// downstream code (formatPatientDisplay) still gets a defined shape.
const BLANK_PATIENT = {
  resourceType: 'Patient' as const,
  id: 'blank',
  name: [{ use: 'official' as const, given: [''], family: '' }],
  birthDate: '',
  gender: '',
  identifier: [{ system: 'http://hospital.example.org/mrn', value: '' }],
}

export function PatientProvider({
  children,
  dataSource = localDataSource,
}: {
  children: React.ReactNode
  /** Injectable for tests and the future SMART-backed source; defaults to the
   *  shared localStorage/scenario source. */
  dataSource?: FhirDataSource
}) {
  const { patient: smartPatient, client: smartClient } = useSmart()
  const location = useLocation()

  // Active patient id is persisted across non-chart routes (e.g. when the user
  // submits an assessment and bounces back through /patient/assessments → chart).
  // Null is the "no patient selected" state.
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

  // SMART patient (if connected) wins over population/blank — both for the
  // Patient resource shown in the banner and for where chart data comes from.
  const isSmartConnected = !!(smartPatient && smartPatient.name)
  const smartPatientId = smartPatient?.id ?? smartClient?.patient.id ?? null

  // Two-way FHIRcast: broadcast a `patient-open` whenever the active patient
  // changes to a real patient *in this tab* — so a chart open in another tab
  // follows. This is the chart-side counterpart to the population worklist's
  // publish, giving true two-way sync (direct chart-URL loads and in-chart
  // patient switches now broadcast too, not just worklist clicks).
  //
  // Echo suppression + guards live in shouldPublishOnActivation (lib/fhircast):
  // it skips publishing under SMART, for the blank state, for an already-sent
  // patient, and — crucially — for an activation that was itself an incoming
  // follow (marked by FhircastListener before it navigates), which would
  // otherwise ping-pong across tabs forever.
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

  // Under SMART, chart data is read from / written to the connected FHIR
  // server via SmartDataSource; otherwise the injected source (default: the
  // localStorage/scenario store). The slice key follows suit: the SMART
  // patient id versus the population id.
  const smartSource = useMemo(
    () =>
      isSmartConnected && smartClient && smartPatientId
        ? new SmartDataSource(smartClient)
        : null,
    [isSmartConnected, smartClient, smartPatientId],
  )
  const activeSource: FhirDataSource = smartSource ?? dataSource
  const sliceKey = smartSource ? smartPatientId : activePatientId

  // The active patient's chart slice, delegated to the active data source.
  // Storage (localStorage keys, legacy migration, scenario auto-seeding) all
  // live in the source; the context just holds the current slice in state and
  // refreshes it on active-patient change and on source mutations.
  //
  // Initial state is hydrated synchronously where the source supports it
  // (LocalDataSource does) so the first paint isn't an empty chart; async-only
  // sources (SmartDataSource) show EMPTY_SLICE + isLoading until getSlice
  // resolves.
  const [sliceState, setSliceState] = useState<SliceState>(() => ({
    slice: activeSource.getSliceSync?.(sliceKey) ?? EMPTY_SLICE,
    isLoading: !activeSource.getSliceSync,
    error: null,
  }))

  useEffect(() => {
    let cancelled = false
    // `initial` distinguishes a source/patient switch (reset to empty while
    // the async fetch runs — never show another patient's data under the new
    // context) from a mutation refresh (keep the current slice visible).
    const load = (initial: boolean) => {
      const sync = activeSource.getSliceSync?.(sliceKey)
      if (sync) {
        setSliceState({ slice: sync, isLoading: false, error: null })
        return
      }
      setSliceState(prev => ({
        slice: initial ? EMPTY_SLICE : prev.slice,
        isLoading: true,
        error: null,
      }))
      activeSource.getSlice(sliceKey).then(
        next => {
          if (!cancelled) setSliceState({ slice: next, isLoading: false, error: null })
        },
        (err: unknown) => {
          if (!cancelled)
            setSliceState(prev => ({ ...prev, isLoading: false, error: describeError(err) }))
        },
      )
    }
    load(true)
    const unsubscribe = activeSource.subscribe(() => load(false))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeSource, sliceKey])

  const slice = sliceState.slice

  // The SMART writeback scorecard (#350). Read through useSyncExternalStore
  // rather than an effect + setState: the report lives on the data source (see
  // SmartDataSource.writebackReport), which is exactly the "external mutable
  // store" this hook exists for, and an effect that seeds state synchronously
  // trips react-hooks/set-state-in-effect.
  //
  // It is deliberately NOT folded into the slice load: a writeback where every
  // tier failed changes nothing about the slice, but is precisely what the
  // scorecard exists to show. Null for the local source, so no scorecard renders.
  //
  // getSnapshot must be referentially stable between changes — it is, because
  // `writebackReport` returns the stored object, replaced only by a new writeback.
  const subscribeWriteback = useCallback(
    (onChange: () => void) => smartSource?.subscribe(onChange) ?? (() => {}),
    [smartSource],
  )
  const getWritebackReport = useCallback(
    () => smartSource?.writebackReport ?? null,
    [smartSource],
  )
  const writebackReport = useSyncExternalStore(subscribeWriteback, getWritebackReport)

  // Write failures surface to the UI (the SMART server may reject a POST —
  // scope issues, validation); there is deliberately no silent fallback to
  // local storage. Cleared by the next successful write.
  const [saveError, setSaveError] = useState<string | null>(null)
  const trackSave = useCallback((op: Promise<void>) => {
    op.then(
      () => setSaveError(null),
      (err: unknown) => setSaveError(describeError(err)),
    )
  }, [])

  const populationPatient =
    activePatientId !== null ? POPULATION_BY_ID.get(activePatientId) ?? null : null

  // Read-only scenario walkthrough timeline. Sourced from the static scenario,
  // not the mutable store, so submitted assessments never overwrite it.
  // Suppressed under SMART, where the connected EHR's real chart is authoritative.
  const walkthrough = useMemo<ScenarioEncounter[]>(
    () =>
      !isSmartConnected && activePatientId !== null
        ? POPULATION_SCENARIOS[activePatientId]?.walkthrough ?? []
        : [],
    [isSmartConnected, activePatientId],
  )

  const activePatient = useMemo<PatientResource>(() => {
    // fhirclient returns a FHIR R4 Patient; the local SmartContext typing is a
    // looser subset, so coerce at the boundary.
    if (isSmartConnected && smartPatient) return smartPatient as unknown as PatientResource
    if (populationPatient) return populationToFhir(populationPatient)
    return BLANK_PATIENT
  }, [isSmartConnected, smartPatient, populationPatient])

  const patientDisplay = useMemo(
    () => formatPatientDisplay(activePatient),
    [activePatient],
  )

  // ── #263 phase 4: the correlation hinge at runtime ──────────
  //
  // Every artifact the app records is filed against an Encounter, and that
  // Encounter names the episode. Two things make this less trivial than it looks:
  //
  //  * `slice` is React state, so two saves in the same tick would both read the
  //    same (encounter-less) slice and each mint an Encounter. The ref below is
  //    the within-tick memory that prevents that; `slice.encounters` is the
  //    across-render source of truth.
  //  * The Encounter is created lazily and does not claim the SPiEREncounter
  //    profile until an episode exists — see the note in lib/encounters.ts.
  const openEncounterRef = useRef<EncounterResource | null>(null)

  // A cached Encounter belongs to one patient. Clearing on key change stops an
  // artifact for patient B being filed against patient A's contact.
  useEffect(() => {
    openEncounterRef.current = null
  }, [sliceKey])

  const ensureEncounter = useCallback(async (): Promise<EncounterResource> => {
    const nowIso = new Date().toISOString()

    const cached = openEncounterRef.current
    if (cached && findOpenEncounter([cached], nowIso)) return cached

    const existing = findOpenEncounter(slice.encounters ?? [], nowIso)
    if (existing) {
      openEncounterRef.current = existing
      return existing
    }

    const created = buildEncounter({ patientId: sliceKey, startIso: nowIso })
    openEncounterRef.current = created
    await activeSource.saveArtifact(sliceKey, created)
    return created
  }, [activeSource, sliceKey, slice.encounters])

  /**
   * Save one artifact against the active Encounter, handling the two types that
   * need something other than a plain `.encounter`:
   *
   *  * `Appointment` has no `.encounter` in R4, so the Encounter names it back.
   *  * `EpisodeOfCare` is what the Encounter points at, so saving one attaches
   *    it to the Encounter — which is also when the Encounter starts claiming
   *    the SPiER profile. This covers the manual recorder (RiskEpisodeView) and
   *    the automatic positive-screen path with one piece of code.
   */
  const saveAgainstEncounter = useCallback(
    async (resource: FhirResource) => {
      // An Encounter is not filed against itself.
      if (resource.resourceType === 'Encounter') {
        await activeSource.saveArtifact(sliceKey, resource)
        return
      }

      const encounter = await ensureEncounter()
      const encounterId = String(encounter.id)
      await activeSource.saveArtifact(sliceKey, stampEncounter(resource, encounterId))

      let updated = encounter
      if (resource.resourceType === 'Appointment' && typeof resource.id === 'string') {
        updated = attachAppointment(updated, resource.id)
      }
      if (resource.resourceType === 'EpisodeOfCare') {
        updated = attachEpisode(updated, resource as EpisodeOfCareResource)
      }
      if (updated !== encounter) {
        openEncounterRef.current = updated
        await activeSource.saveArtifact(sliceKey, updated)
      }
    },
    [activeSource, ensureEncounter, sliceKey],
  )

  const addCarePlan = useCallback(
    (carePlan: CarePlanResource) => {
      // CarePlans are non-QR artifacts — the source routes them into the
      // carePlans array and stamps _savedAt, same as any other artifact.
      trackSave(saveAgainstEncounter(carePlan))
    },
    [saveAgainstEncounter, trackSave],
  )

  const addResponse = useCallback(
    (questionnaireName: string, resource: QuestionnaireResponseResource) => {
      // Resolve a single id up front — prefer the resource's own id, otherwise
      // mint one — and use it for the stored resource, the entry, AND the
      // derived Observations' Observation.derivedFrom reference, so they all
      // point at the same QuestionnaireResponse. (The SMART source swaps in
      // the server-assigned id on create.)
      const id = (resource as { id?: string }).id ?? `response-${makeId()}`
      const storedResource = { ...resource, id }
      const entry: StoredResponse = {
        id,
        questionnaireName,
        completedAt: new Date().toISOString(),
        resource: storedResource,
      }
      // Derivation (QR → Observations + risk alert) is business logic, not the
      // source's job. deriveFromResponse returns null when the QR has no mapper
      // (e.g. Stanley-Brown / CAMS plans), in which case only the response is
      // persisted.
      const derived = deriveFromResponse(storedResource)
      trackSave(
        (async () => {
          // The QR and everything derived from it happened at the same contact,
          // so they share one Encounter (#263). The QR is stamped too — it is the
          // artifact that most often triggers the episode, and
          // `QuestionnaireResponse.encounter` is a native R4 element.
          const encounter = await ensureEncounter()
          const encounterId = String(encounter.id)
          const stampedEntry: StoredResponse = {
            ...entry,
            resource: stampEncounter(entry.resource, encounterId),
          }
          const stampedDerived = derived
            ? {
                ...derived,
                observations: derived.observations.map(o =>
                  stampEncounter(o as ObservationResource, encounterId),
                ),
              }
            : null
          await activeSource.saveResponse(sliceKey, stampedEntry, stampedDerived)

          // Decision 1 (#263): a positive screen opens the episode, and the
          // episode names the screen that opened it. Only when none is already
          // open — a second positive screen belongs to the episode already
          // running, not to a new one.
          if (!stampedDerived || !isPositiveScreen(stampedDerived.riskAlert.level)) return
          if (findOpenEpisode(slice.episodes ?? [])) return

          const triggerRef = pickEpisodeTrigger(stampedDerived.observations, stampedEntry.id)
          if (!triggerRef) return // nothing to evidence it with; do not claim a positive screen

          const episode = buildEpisode({
            id: `episode-${makeId()}`,
            patientId: sliceKey,
            entryReason: 'positive-screen',
            startDate: new Date().toISOString(),
            triggerRef,
          })
          // Routed through saveAgainstEncounter so the Encounter gains the episode
          // reference — and with it the SPiER profile claim — in one place.
          await saveAgainstEncounter(episode)
        })(),
      )
    },
    [activeSource, ensureEncounter, saveAgainstEncounter, slice.episodes, sliceKey, trackSave],
  )

  // Generic adder for non-Questionnaire workflow artifacts. The source routes
  // by resourceType into the matching slice array and stamps _savedAt.
  // QuestionnaireResponses are NOT handled here — use addResponse, which
  // additionally derives Observations.
  const addArtifact = useCallback(
    (resource: FhirResource) => {
      trackSave(saveAgainstEncounter(resource))
    },
    [saveAgainstEncounter, trackSave],
  )

  const value = useMemo<PatientContextType>(
    () => ({
      patient: activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      populationPatients: POPULATION_PATIENTS,
      walkthrough,
      carePlans: slice.carePlans,
      addCarePlan,
      responses: slice.responses,
      addResponse,
      observations: slice.observations,
      communications: slice.communications ?? [],
      episodes: slice.episodes ?? [],
      encounters: slice.encounters ?? [],
      flags: slice.flags ?? [],
      tasks: slice.tasks ?? [],
      documentReferences: slice.documentReferences ?? [],
      serviceRequests: slice.serviceRequests ?? [],
      appointments: slice.appointments ?? [],
      consents: slice.consents ?? [],
      procedures: slice.procedures ?? [],
      riskAlerts: slice.riskAlerts,
      addArtifact,
      isSliceLoading: sliceState.isLoading,
      dataSourceError: sliceState.error ?? saveError,
      writebackReport,
    }),
    [
      activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      walkthrough,
      slice,
      sliceState.isLoading,
      sliceState.error,
      saveError,
      writebackReport,
      addCarePlan,
      addResponse,
      addArtifact,
    ],
  )

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}
