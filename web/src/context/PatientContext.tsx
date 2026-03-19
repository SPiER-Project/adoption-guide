import React, { createContext, useContext, useMemo, useCallback } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DEMO_PATIENT, formatPatientDisplay } from '../data/demoPatient'
import type { PatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'

interface StoredResponse {
  id: string
  questionnaireName: string
  completedAt: string
  resource: any
}

interface PatientContextType {
  patient: any
  patientDisplay: PatientDisplay
  isSmartConnected: boolean
  carePlans: any[]
  addCarePlan: (carePlan: any) => void
  responses: StoredResponse[]
  addResponse: (name: string, resource: any) => void
  clearDemoData: () => void
}

const PatientContext = createContext<PatientContextType | undefined>(undefined)

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const { patient: smartPatient } = useSmart()
  const [demoPatient] = useLocalStorage('spier-demo-patient', DEMO_PATIENT)
  const [carePlans, setCarePlans, removeCarePlans] = useLocalStorage<any[]>('spier-demo-careplans', [])
  const [responses, setResponses, removeResponses] = useLocalStorage<StoredResponse[]>('spier-demo-responses', [])

  // SMART patient takes priority over demo patient
  const isSmartConnected = !!(smartPatient && smartPatient.name)
  const activePatient = isSmartConnected ? smartPatient : demoPatient

  const patientDisplay = useMemo(
    () => formatPatientDisplay(activePatient),
    [activePatient]
  )

  const addCarePlan = useCallback((carePlan: any) => {
    setCarePlans(prev => [...prev, { ...carePlan, _savedAt: new Date().toISOString() }])
  }, [setCarePlans])

  const addResponse = useCallback((questionnaireName: string, resource: any) => {
    const entry: StoredResponse = {
      id: `response-${Date.now()}`,
      questionnaireName,
      completedAt: new Date().toISOString(),
      resource,
    }
    setResponses(prev => [...prev, entry])
  }, [setResponses])

  const clearDemoData = useCallback(() => {
    removeCarePlans()
    removeResponses()
  }, [removeCarePlans, removeResponses])

  const value = useMemo(() => ({
    patient: activePatient,
    patientDisplay,
    isSmartConnected,
    carePlans,
    addCarePlan,
    responses,
    addResponse,
    clearDemoData,
  }), [activePatient, patientDisplay, isSmartConnected, carePlans, addCarePlan, responses, addResponse, clearDemoData])

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  )
}

export function usePatient() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider')
  }
  return context
}
