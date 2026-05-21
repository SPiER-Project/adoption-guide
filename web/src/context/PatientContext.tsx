import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { formatPatientDisplay } from '../data/demoPatient'
import type { PatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'
import { mapResponseToObservations } from '../lib/observationMappers'
import type { RiskAlert } from '../lib/observationMappers'
import populationPatientsData from '../data/population/patients.json'
import { POPULATION_SCENARIOS } from '../data/population/scenarios'

type PopulationRiskLevel = 'acute' | 'high' | 'moderate' | 'low' | 'none'

interface PopulationPatient {
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

interface StoredResponse {
  id: string
  questionnaireName: string
  completedAt: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: any
}

interface PatientSlice {
  responses: StoredResponse[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  observations: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  carePlans: any[]
  riskAlerts: RiskAlert[]
}

type PatientStore = Record<string, PatientSlice>

const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observations = read<any[]>('spier-demo-observations') ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carePlans = read<any[]>('spier-demo-careplans') ?? []
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patient: any
  patientDisplay: PatientDisplay
  isSmartConnected: boolean
  /** Null when no patient is selected (blank "play with forms" state). */
  activePatientId: string | null
  populationPatient: PopulationPatient | null
  populationRiskLevel: PopulationRiskLevel | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  carePlans: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCarePlan: (carePlan: any) => void
  responses: StoredResponse[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addResponse: (name: string, resource: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  observations: any[]
  riskAlerts: RiskAlert[]
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
  // Patient tab). Without ?new=1, bare /patient/chart preserves the last
  // viewed patient so assessment-submit redirects don't lose context.
  const search = new URLSearchParams(location.search)
  const wantsBlank = location.pathname === '/patient/chart' && search.get('new') === '1'

  const urlPatientId = deriveActiveIdFromPath(location.pathname)
  const safeStoredId =
    storedActiveId && isAllowedPatientId(storedActiveId) ? storedActiveId : null
  const activePatientId: string | null = wantsBlank ? null : (urlPatientId ?? safeStoredId)

  useEffect(() => {
    if (wantsBlank && storedActiveId !== null) {
      setStoredActiveId(null)
    } else if (urlPatientId && urlPatientId !== storedActiveId) {
      setStoredActiveId(urlPatientId)
    }
  }, [wantsBlank, urlPatientId, storedActiveId, setStoredActiveId])

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

  const activePatient = useMemo(() => {
    if (isSmartConnected) return smartPatient
    if (populationPatient) return populationToFhir(populationPatient)
    return BLANK_PATIENT
  }, [isSmartConnected, smartPatient, populationPatient])

  const patientDisplay = useMemo(
    () => formatPatientDisplay(activePatient),
    [activePatient],
  )

  const addCarePlan = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (carePlan: any) => {
      updateActiveSlice(prev => ({
        ...prev,
        carePlans: [...prev.carePlans, { ...carePlan, _savedAt: new Date().toISOString() }],
      }))
    },
    [updateActiveSlice],
  )

  const addResponse = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (questionnaireName: string, resource: any) => {
      const entry: StoredResponse = {
        id: `response-${Date.now()}`,
        questionnaireName,
        completedAt: new Date().toISOString(),
        resource,
      }
      // Auto-generate Observations from the response. Dispatch is by
      // resource.questionnaire (canonical URL) — see observationMappers/index.ts.
      const result = mapResponseToObservations(resource)
      updateActiveSlice(prev => ({
        ...prev,
        responses: [...prev.responses, entry],
        observations: result ? [...prev.observations, ...result.observations] : prev.observations,
        riskAlerts: result
          ? [...prev.riskAlerts.filter(a => a.tool !== result.riskAlert.tool), result.riskAlert]
          : prev.riskAlerts,
      }))
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
      carePlans: slice.carePlans,
      addCarePlan,
      responses: slice.responses,
      addResponse,
      observations: slice.observations,
      riskAlerts: slice.riskAlerts,
    }),
    [
      activePatient,
      patientDisplay,
      isSmartConnected,
      activePatientId,
      populationPatient,
      slice,
      addCarePlan,
      addResponse,
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
