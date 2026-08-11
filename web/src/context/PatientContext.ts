import { createContext, useContext } from 'react'
import type { PatientDisplay } from '../data/demoPatient'
import type { RiskAlert } from '../lib/observationMappers'
import type { RegistryPatient } from '../lib/registry'
import type {
  AppointmentResource,
  CarePlanResource,
  CommunicationResource,
  ConsentResource,
  DocumentReferenceResource,
  EncounterResource,
  EpisodeOfCareResource,
  FlagResource,
  ServiceRequestResource,
  TaskResource,
  FhirResource,
  ObservationResource,
  PatientResource,
  ProcedureResource,
  QuestionnaireResponseResource,
  ScenarioEncounter,
  StoredResponse,
} from '../types/fhir'

// The patient context object, its value type and its hook. Deliberately NOT a
// .tsx and holding no component: React Fast Refresh only preserves state for a
// module whose exports are all components, so pairing this hook with the
// provider made that module incompatible — and this is the context whose loss
// hurts most on an edit, since it holds the active patient and the whole chart
// slice. The provider lives in PatientProvider.tsx.

/**
 * A population patient's static demographics + curated next-step rationale.
 * Live pathway/risk/activity state is derived from FHIR data (see
 * `lib/registry.ts`) rather than read off this record.
 */
export type PopulationPatient = RegistryPatient

export interface PatientContextType {
  patient: PatientResource
  patientDisplay: PatientDisplay
  isSmartConnected: boolean
  /** Null when no patient is selected (blank "play with forms" state). */
  activePatientId: string | null
  populationPatient: PopulationPatient | null
  /** The full population registry, for patient-switcher UIs. */
  populationPatients: PopulationPatient[]
  /**
   * Read-only scenario walkthrough timeline for the active patient. Sourced
   * directly from the static scenario (not the mutable store) so submitted
   * assessments never alter it. Empty for blank/SMART patients or scenarios
   * without an authored timeline.
   */
  walkthrough: ScenarioEncounter[]
  carePlans: CarePlanResource[]
  addCarePlan: (carePlan: CarePlanResource) => void
  responses: StoredResponse[]
  addResponse: (name: string, resource: QuestionnaireResponseResource) => void
  observations: ObservationResource[]
  communications: CommunicationResource[]
  /** Stage-7 (Track Risk Over Time) artifacts — see lib/riskEpisode.ts helpers. */
  episodes: EpisodeOfCareResource[]
  flags: FlagResource[]
  tasks: TaskResource[]
  /**
   * Real FHIR Encounters — the #263 correlation hinge. Surfaced so a consumer can
   * group artifacts by episode (`lib/episodeRecord.ts`); phase 4 added the bucket
   * to `PatientSlice` but never exposed it here, which is part of why the read
   * side did not exist.
   */
  encounters: EncounterResource[]
  /** Stage-5 (Coordinate Handoffs) artifacts — see lib/handoffs.ts helpers. */
  documentReferences: DocumentReferenceResource[]
  serviceRequests: ServiceRequestResource[]
  appointments: AppointmentResource[]
  consents: ConsentResource[]
  /** Stage-4 lethal-means counseling Procedures — read by the Stage-8 measure. */
  procedures: ProcedureResource[]
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

export const PatientContext = createContext<PatientContextType | undefined>(undefined)

export function usePatient() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider')
  }
  return context
}
