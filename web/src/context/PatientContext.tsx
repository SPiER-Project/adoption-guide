import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DEMO_PATIENT, formatPatientDisplay } from '../data/demoPatient'
import type { PatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'
import { mapResponseToObservations } from '../lib/observationMappers'
import type { RiskAlert } from '../lib/observationMappers'
import { MOCK_RESPONSES, MOCK_OBSERVATIONS, MOCK_CAREPLANS, MOCK_RISK_ALERTS } from '../data/mockScenario'
import populationPatientsData from '../data/population/patients.json'

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

// Jane Doe — matches DEMO_PATIENT and gets legacy single-patient storage on migration
const DEFAULT_PATIENT_ID = 'patient-001'
const STORE_KEY = 'spier-patient-store'
const ACTIVE_ID_KEY = 'spier-active-patient-id'

interface StoredResponse {
  id: string
  questionnaireName: string
  completedAt: string
  resource: any
}

interface PatientSlice {
  responses: StoredResponse[]
  observations: any[]
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

// One-time migration from the original single-patient keys into a patient-001 slice
// so existing demo data isn't lost when this build first runs in a browser.
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
  const observations = read<any[]>('spier-demo-observations') ?? []
  const carePlans = read<any[]>('spier-demo-careplans') ?? []
  const riskAlerts = read<RiskAlert[]>('spier-demo-risk-alerts') ?? []
  if (responses.length || observations.length || carePlans.length || riskAlerts.length) {
    return { [DEFAULT_PATIENT_ID]: { responses, observations, carePlans, riskAlerts } }
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

// URL like /patient/chart/patient-005 → 'patient-005'. Returns null for any other path.
function deriveActiveIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/patient\/chart\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

interface PatientContextType {
  patient: any
  patientDisplay: PatientDisplay
  isSmartConnected: boolean
  activePatientId: string
  populationPatient: PopulationPatient | null
  populationRiskLevel: PopulationRiskLevel | null
  carePlans: any[]
  addCarePlan: (carePlan: any) => void
  responses: StoredResponse[]
  addResponse: (name: string, resource: any) => void
  observations: any[]
  riskAlerts: RiskAlert[]
  loadDemoScenario: () => void
  clearDemoData: () => void
}

const PatientContext = createContext<PatientContextType | undefined>(undefined)

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const { patient: smartPatient } = useSmart()
  const location = useLocation()

  const [storedActiveId, setStoredActiveId] = useLocalStorage<string>(
    ACTIVE_ID_KEY,
    DEFAULT_PATIENT_ID,
  )

  // URL is authoritative when it carries an ID; otherwise we use the last stored
  // active patient so non-chart routes (e.g. /patient/assessments/...) stay scoped.
  const urlPatientId = deriveActiveIdFromPath(location.pathname)
  const activePatientId = urlPatientId ?? storedActiveId

  useEffect(() => {
    if (urlPatientId && urlPatientId !== storedActiveId) {
      setStoredActiveId(urlPatientId)
    }
  }, [urlPatientId, storedActiveId, setStoredActiveId])

  // Patient-scoped chart store. Initializer runs once and handles legacy migration.
  const [store, setStoreInternal] = useState<PatientStore>(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY)
      if (raw) return JSON.parse(raw) as PatientStore
    } catch {
      // fall through to migration
    }
    const migrated = migrateLegacyStorage()
    if (migrated) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(migrated))
      } catch {
        // ignore
      }
      return migrated
    }
    return {}
  })

  const setStore = useCallback((updater: (prev: PatientStore) => PatientStore) => {
    setStoreInternal(prev => {
      const next = updater(prev)
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const updateSlice = useCallback(
    (patientId: string, updater: (prev: PatientSlice) => PatientSlice) => {
      setStore(prev => ({
        ...prev,
        [patientId]: updater(prev[patientId] ?? EMPTY_SLICE),
      }))
    },
    [setStore],
  )

  const slice = store[activePatientId] ?? EMPTY_SLICE

  // SMART patient (if connected) wins over population/demo data
  const isSmartConnected = !!(smartPatient && smartPatient.name)
  const populationPatient = POPULATION_BY_ID.get(activePatientId) ?? null

  const activePatient = useMemo(() => {
    if (isSmartConnected) return smartPatient
    if (populationPatient) return populationToFhir(populationPatient)
    return DEMO_PATIENT
  }, [isSmartConnected, smartPatient, populationPatient])

  const patientDisplay = useMemo(
    () => formatPatientDisplay(activePatient),
    [activePatient],
  )

  const addCarePlan = useCallback(
    (carePlan: any) => {
      updateSlice(activePatientId, prev => ({
        ...prev,
        carePlans: [...prev.carePlans, { ...carePlan, _savedAt: new Date().toISOString() }],
      }))
    },
    [activePatientId, updateSlice],
  )

  const addResponse = useCallback(
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
      updateSlice(activePatientId, prev => ({
        ...prev,
        responses: [...prev.responses, entry],
        observations: result ? [...prev.observations, ...result.observations] : prev.observations,
        riskAlerts: result
          ? [...prev.riskAlerts.filter(a => a.tool !== result.riskAlert.tool), result.riskAlert]
          : prev.riskAlerts,
      }))
    },
    [activePatientId, updateSlice],
  )

  const loadDemoScenario = useCallback(() => {
    updateSlice(activePatientId, () => ({
      responses: MOCK_RESPONSES,
      observations: MOCK_OBSERVATIONS,
      carePlans: MOCK_CAREPLANS,
      riskAlerts: MOCK_RISK_ALERTS,
    }))
  }, [activePatientId, updateSlice])

  const clearDemoData = useCallback(() => {
    updateSlice(activePatientId, () => EMPTY_SLICE)
  }, [activePatientId, updateSlice])

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
      loadDemoScenario,
      clearDemoData,
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
      loadDemoScenario,
      clearDemoData,
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
