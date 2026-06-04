import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { formatPatientDisplay } from '../data/demoPatient'
import type { PatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'
import { mapResponseToObservations } from '../lib/observationMappers'
import type { RiskAlert } from '../lib/observationMappers'
import { stageForResponse, PATHWAY_STAGE_SYSTEM } from '../lib/patientPathway'
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

export type PopulationRiskLevel = 'acute' | 'high' | 'moderate' | 'low' | 'none'

export interface PopulationPatient {
  id: string
  displayName: string
  dob: string
  mrn: string
  gender: string
  currentStage: string
  completedStages: string[]
  currentRiskLevel: PopulationRiskLevel
  lastActivity: { date: string; label: string }
  recommendedNextStep: { stageId: string; label: string; rationale: string }
}

const POPULATION_PATIENTS = populationPatientsData as PopulationPatient[]
const POPULATION_BY_ID = new Map(POPULATION_PATIENTS.map(p => [p.id, p]))

const STORE_KEY = 'spier-patient-store'
const ACTIVE_ID_KEY = 'spier-active-patient-id'
const BLANK_SLICE_KEY = 'spier-blank-slice'

// The patient shown when the chart is opened in "demo mode" (?demo=1) — the
// ED suicide-care Scenario 11 walkthrough used for the federal-regulator
// briefing. See issue #51 and docs/use-cases/ed-scenario-11.md.
const DEMO_PATIENT_ID = 'patient-011'

type PatientStore = Record<string, PatientSlice>

const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
}

// One-time migration from the original single-patient keys into a patient-001
// slice so existing demo data isn't lost when this build first runs in a browser.
function migrateLegacyStorage(): PatientStore | null {
  const read = <T,>(k: string): T | null => {
    try {
      const raw = window.localStorage.getItem(k)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }
  const responses = read<StoredResponse[]>('spier-demo-responses') ?? []
  const observations = read<ObservationResource[]>('spier-demo-observations') ?? []
  const carePlans = read<CarePlanResource[]>('spier-demo-careplans') ?? []
  const riskAlerts = read<RiskAlert[]>('spier-demo-risk-alerts') ?? []
  if (responses.length || observations.length || carePlans.length || riskAlerts.length) {
    return { 'patient-001': { responses, observations, carePlans, riskAlerts } }
  }
  return null
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
  populationRiskLevel: PopulationRiskLevel | null
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

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const { patient: smartPatient } = useSmart()
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

  // Patient-scoped chart store. Initializer reads existing data or runs the
  // one-time migration from legacy single-patient keys. Per-update writes go
  // through useEffect so the setState updater stays pure.
  const [store, setStore] = useState<PatientStore>(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY)
      if (raw) return JSON.parse(raw) as PatientStore
    } catch {
      // fall through to migration
    }
    return migrateLegacyStorage() ?? {}
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
    } catch {
      // ignore
    }
  }, [store])

  // Blank slice — backs the "no patient selected" mode so users can submit
  // assessments without picking a population patient first.
  const [blankSlice, setBlankSlice] = useLocalStorage<PatientSlice>(
    BLANK_SLICE_KEY,
    EMPTY_SLICE,
  )

  // Auto-seed: when a population patient's slice is missing from the store and
  // a static scenario exists, pre-populate it. Idempotent — once data exists
  // (even mutated), the scenario won't reseed. clearing a slice (delete key)
  // and reviewing the patient will re-seed.
  useEffect(() => {
    if (activePatientId === null) return
    if (store[activePatientId]) return
    const scenario = POPULATION_SCENARIOS[activePatientId]
    if (!scenario) return
    setStore(prev => ({ ...prev, [activePatientId]: scenario }))
  }, [activePatientId, store])

  const updateActiveSlice = useCallback(
    (updater: (prev: PatientSlice) => PatientSlice) => {
      if (activePatientId === null) {
        setBlankSlice(prev => updater(prev))
        return
      }
      if (!isAllowedPatientId(activePatientId)) return
      setStore(prev => ({
        ...prev,
        [activePatientId]: updater(prev[activePatientId] ?? EMPTY_SLICE),
      }))
    },
    [activePatientId, setBlankSlice],
  )

  const slice =
    activePatientId === null ? blankSlice : (store[activePatientId] ?? EMPTY_SLICE)

  // SMART patient (if connected) wins over population/blank
  const isSmartConnected = !!(smartPatient && smartPatient.name)
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
      updateActiveSlice(prev => ({
        ...prev,
        carePlans: [...prev.carePlans, { ...carePlan, _savedAt: new Date().toISOString() }],
      }))
    },
    [updateActiveSlice],
  )

  const addResponse = useCallback(
    (questionnaireName: string, resource: QuestionnaireResponseResource) => {
      // Mint the id first and stamp it onto the stored resource so derived
      // Observations can reference it via Observation.derivedFrom.
      const id = `response-${crypto.randomUUID()}`
      const storedResource = { ...resource, id: (resource as { id?: string }).id ?? id }
      const entry: StoredResponse = {
        id,
        questionnaireName,
        completedAt: new Date().toISOString(),
        resource: storedResource,
      }
      // Auto-generate Observations from the response. Dispatch is by
      // resource.questionnaire (canonical URL) — see observationMappers/index.ts.
      const result = mapResponseToObservations(storedResource)
      // Stamp provenance + pathway stage onto each extracted Observation so it
      // (a) links back to its source QR (Observation.derivedFrom — what SDC
      // $extract would emit) and (b) resolves to a pathway stage via the
      // meta.tag channel in stageForArtifact, so it groups under the right
      // stage instead of being orphaned. The stage is the source response's
      // stage (questionnaire → tool → stageId).
      const stageId = stageForResponse(storedResource)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const observations: ObservationResource[] = (result?.observations ?? []).map((obs: any) => ({
        ...obs,
        derivedFrom: [...(obs.derivedFrom ?? []), { reference: `QuestionnaireResponse/${id}` }],
        meta: {
          ...(obs.meta ?? {}),
          tag: [
            ...(obs.meta?.tag ?? []),
            ...(stageId ? [{ system: PATHWAY_STAGE_SYSTEM, code: stageId }] : []),
          ],
        },
      }))
      updateActiveSlice(prev => ({
        ...prev,
        responses: [...prev.responses, entry],
        observations: result ? [...prev.observations, ...observations] : prev.observations,
        riskAlerts: result
          ? [...prev.riskAlerts.filter(a => a.tool !== result.riskAlert.tool), result.riskAlert]
          : prev.riskAlerts,
      }))
    },
    [updateActiveSlice],
  )

  // Generic adder for non-Questionnaire workflow artifacts. Routes by
  // resourceType into the matching slice array and stamps _savedAt. New arrays
  // are read defensively (`?? []`) because slices persisted by earlier builds
  // predate them. QuestionnaireResponses are NOT handled here — use addResponse,
  // which additionally derives Observations.
  const addArtifact = useCallback(
    (resource: FhirResource) => {
      const stamped = { ...resource, _savedAt: new Date().toISOString() }
      updateActiveSlice(prev => {
        switch (resource.resourceType) {
          case 'Communication':
            return {
              ...prev,
              communications: [...(prev.communications ?? []), stamped as CommunicationResource],
            }
          case 'Observation':
            return { ...prev, observations: [...prev.observations, stamped as ObservationResource] }
          case 'CarePlan':
            return { ...prev, carePlans: [...prev.carePlans, stamped as CarePlanResource] }
          default:
            console.warn(`[PatientContext] addArtifact: unhandled resourceType "${resource.resourceType}"`)
            return prev
        }
      })
    },
    [updateActiveSlice],
  )

  const value = useMemo<PatientContextType>(
    () => ({
      patient: activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      populationRiskLevel: populationPatient?.currentRiskLevel ?? null,
      encounters,
      carePlans: slice.carePlans,
      addCarePlan,
      responses: slice.responses,
      addResponse,
      observations: slice.observations,
      communications: slice.communications ?? [],
      riskAlerts: slice.riskAlerts,
      addArtifact,
    }),
    [
      activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      encounters,
      slice,
      addCarePlan,
      addResponse,
      addArtifact,
    ],
  )

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}

export function usePatient() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider')
  }
  return context
}
