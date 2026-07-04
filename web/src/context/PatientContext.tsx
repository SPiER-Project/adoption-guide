import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { formatPatientDisplay } from '../data/demoPatient'
import type { PatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'
import type { RiskAlert } from '../lib/observationMappers'
import { makeId } from '../lib/id'
import { deriveFromResponse } from '../lib/deriveFromResponse'
import { localDataSource } from '../lib/dataSource/localDataSource'
import { SmartDataSource } from '../lib/dataSource/smartDataSource'
import type { FhirDataSource } from '../lib/dataSource/types'
import type { RegistryPatient } from '../lib/registry'
import populationPatientsData from '../data/population/patients.json'
import { POPULATION_SCENARIOS } from '../data/population/scenarios'
import type {
  CarePlanResource,
  CommunicationResource,
  FhirResource,
  ObservationResource,
  PatientResource,
  PatientSlice,
  QuestionnaireResponseResource,
  ScenarioEncounter,
  StoredResponse,
} from '../types/fhir'

/**
 * A population patient's static demographics + curated next-step rationale.
 * Live pathway/risk/activity state is derived from FHIR data (see
 * `lib/registry.ts`) rather than read off this record.
 */
export type PopulationPatient = RegistryPatient

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

interface PatientContextType {
  patient: PatientResource
  patientDisplay: PatientDisplay
  isSmartConnected: boolean
  /** Null when no patient is selected (blank "play with forms" state). */
  activePatientId: string | null
  populationPatient: PopulationPatient | null
  /**
   * Read-only scenario walkthrough timeline for the active patient. Sourced
   * directly from the static scenario (not the mutable store) so submitted
   * assessments never alter it. Empty for blank/SMART patients or scenarios
   * without an authored timeline.
   */
  encounters: ScenarioEncounter[]
  carePlans: CarePlanResource[]
  addCarePlan: (carePlan: CarePlanResource) => void
  responses: StoredResponse[]
  addResponse: (name: string, resource: QuestionnaireResponseResource) => void
  observations: ObservationResource[]
  communications: CommunicationResource[]
  riskAlerts: RiskAlert[]
  /**
   * Append a non-Questionnaire workflow artifact, routing it into the right
   * slice array by `resourceType`. Stamps `_savedAt`. (QuestionnaireResponses
   * go through `addResponse`, which also derives Observations.)
   */
  addArtifact: (resource: FhirResource) => void
  /**
   * True while an async data source (SMART) is fetching the chart slice.
   * Always false for the synchronous local source.
   */
  isSliceLoading: boolean
  /**
   * Read or write failure from the data source — SMART server errors surface
   * here instead of silently falling back to local storage. Null when healthy.
   */
  dataSourceError: string | null
}

const PatientContext = createContext<PatientContextType | undefined>(undefined)

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
  const encounters = useMemo<ScenarioEncounter[]>(
    () =>
      !isSmartConnected && activePatientId !== null
        ? POPULATION_SCENARIOS[activePatientId]?.encounters ?? []
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

  const addCarePlan = useCallback(
    (carePlan: CarePlanResource) => {
      // CarePlans are non-QR artifacts — the source routes them into the
      // carePlans array and stamps _savedAt, same as any other artifact.
      trackSave(activeSource.saveArtifact(sliceKey, carePlan))
    },
    [activeSource, sliceKey, trackSave],
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
      trackSave(activeSource.saveResponse(sliceKey, entry, derived))
    },
    [activeSource, sliceKey, trackSave],
  )

  // Generic adder for non-Questionnaire workflow artifacts. The source routes
  // by resourceType into the matching slice array and stamps _savedAt.
  // QuestionnaireResponses are NOT handled here — use addResponse, which
  // additionally derives Observations.
  const addArtifact = useCallback(
    (resource: FhirResource) => {
      trackSave(activeSource.saveArtifact(sliceKey, resource))
    },
    [activeSource, sliceKey, trackSave],
  )

  const value = useMemo<PatientContextType>(
    () => ({
      patient: activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      encounters,
      carePlans: slice.carePlans,
      addCarePlan,
      responses: slice.responses,
      addResponse,
      observations: slice.observations,
      communications: slice.communications ?? [],
      riskAlerts: slice.riskAlerts,
      addArtifact,
      isSliceLoading: sliceState.isLoading,
      dataSourceError: sliceState.error ?? saveError,
    }),
    [
      activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      encounters,
      slice,
      sliceState.isLoading,
      sliceState.error,
      saveError,
      addCarePlan,
      addResponse,
      addArtifact,
    ],
  )

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}

// Hook co-located with its provider by design (idiomatic context module).
// eslint-disable-next-line react-refresh/only-export-components
export function usePatient() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider')
  }
  return context
}
