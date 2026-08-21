import React, { useMemo, useCallback, useSyncExternalStore } from 'react'
import { formatPatientDisplay } from '../data/demoPatient'
import { useSmart } from './SmartContext'
import {
  PatientContext,
  type PatientContextType,
  type PopulationPatient,
} from './PatientContext'
import { localDataSource } from '../lib/dataSource/localDataSource'
import { SmartDataSource } from '../lib/dataSource/smartDataSource'
import type { FhirDataSource } from '../lib/dataSource/types'
import {
  POPULATION_BY_ID,
  POPULATION_PATIENTS,
  POPULATION_SCENARIOS,
} from '@spier/demo-population'
import { useActivePatientId } from '../hooks/useActivePatientId'
import { usePatientOpenBroadcast } from '../hooks/usePatientOpenBroadcast'
import { usePatientSlice } from '../hooks/usePatientSlice'
import { useCorrelatedSave } from '../hooks/useCorrelatedSave'
import type { PatientResource, ScenarioEncounter } from '../types/fhir'

// PopulationPatient, PatientContextType, the context object and usePatient all
// live in PatientContext.ts so this module stays component-only.
//
// What is left here is deliberately only the wiring: which data source is
// active, which patient it is keyed to, and the Patient resource the banner
// shows. The four concerns that used to sit alongside it are hooks now (#126) —
// useActivePatientId, usePatientOpenBroadcast, usePatientSlice and
// useCorrelatedSave, the last of which carries all the clinical decisions.

/**
 * ⚠️ `npm run check:patients` SCRAPES the MRN system out of this function — it
 * is the third of the three sites that gate reconciles (the FSH is canonical,
 * `patients.json` holds the display copies). The gate exits non-zero with an
 * explanation if the builder is moved or reshaped, so **update it deliberately**
 * rather than deleting the check. That coupling is why this stayed in the
 * provider when the rest was extracted.
 */
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
      { system: 'http://spier.org/identifier/mrn', value: p.mrn },
    ],
  }
}

// Build a FHIR-ish Patient resource that represents the blank state, so
// downstream code (formatPatientDisplay) still gets a defined shape.
const BLANK_PATIENT = {
  resourceType: 'Patient' as const,
  id: 'blank',
  name: [{ use: 'official' as const, given: [''], family: '' }],
  birthDate: '',
  gender: '',
  identifier: [{ system: 'http://spier.org/identifier/mrn', value: '' }],
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

  const activePatientId = useActivePatientId()

  // SMART patient (if connected) wins over population/blank — both for the
  // Patient resource shown in the banner and for where chart data comes from.
  const isSmartConnected = !!(smartPatient && smartPatient.name)
  const smartPatientId = smartPatient?.id ?? smartClient?.patient.id ?? null

  usePatientOpenBroadcast({ activePatientId, isSmartConnected })

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

  const sliceState = usePatientSlice(activeSource, sliceKey)
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

  const { addCarePlan, addResponse, addArtifact, saveError } = useCorrelatedSave({
    activeSource,
    sliceKey,
    slice,
  })

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
