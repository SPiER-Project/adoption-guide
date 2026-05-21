/**
 * Minimal FHIR R4 shape used for resources passing through the patient
 * context and scenario data. We don't pull in `@types/fhir` to keep the dep
 * surface small; downstream code (observationMappers, carePlanMappers) still
 * treats payloads as loose JSON.
 *
 * Shared by:
 *  - `context/PatientContext.tsx` (in-memory store + context surface)
 *  - `data/population/scenarios/index.ts` (per-patient seed JSON)
 *  - any consumer that wants a typed handle on resources read from the
 *    patient context.
 */
import type { RiskAlert } from '../lib/observationMappers'

export interface FhirResource {
  resourceType: string
  id?: string
  [k: string]: unknown
}

export type QuestionnaireResponseResource = FhirResource & { resourceType: 'QuestionnaireResponse' }
export type ObservationResource = FhirResource & { resourceType: 'Observation' }
export type CarePlanResource = FhirResource & { resourceType: 'CarePlan' }
export type PatientResource = FhirResource & { resourceType: 'Patient' }

/** One captured QuestionnaireResponse with display metadata for activity lists. */
export interface StoredResponse {
  id: string
  questionnaireName: string
  completedAt: string
  resource: QuestionnaireResponseResource
}

/**
 * One patient's chart slice. Used both as the in-memory store shape inside
 * `PatientContext` and as the on-disk shape of each `patient-*.json` scenario.
 */
export interface PatientSlice {
  responses: StoredResponse[]
  observations: ObservationResource[]
  carePlans: CarePlanResource[]
  riskAlerts: RiskAlert[]
}
