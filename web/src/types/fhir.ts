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
export type CommunicationResource = FhirResource & { resourceType: 'Communication' }
export type AppointmentResource = FhirResource & { resourceType: 'Appointment' }
export type MeasureReportResource = FhirResource & { resourceType: 'MeasureReport' }

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
  /**
   * Non-Questionnaire workflow artifacts (caring contacts, referrals, etc.).
   * Optional so previously-persisted slices and existing scenario JSON files —
   * which predate this field — remain valid; always read with `?? []`.
   */
  communications?: CommunicationResource[]
  /** Follow-up appointments (incl. missed-appointment tracking). Optional — read with `?? []`. */
  appointments?: AppointmentResource[]
}

/**
 * One step in a scenario walkthrough timeline. JSON-safe (no RegExp): artifact
 * linking is by string match against the patient's captured resources.
 *
 * Used by the ED suicide-care scenario (issue #51) to render the 24-step
 * walkthrough mapped in `docs/use-cases/ed-scenario-11.md`. Each step ties an
 * event in the narrative to the FHIR artifact(s) it produces and the pathway
 * stage it belongs to. Steps whose real-world artifact has no SPiER profile yet
 * are marked `profileGap` (see issue #52 for the non-Questionnaire workflow work).
 *
 * Encounters are read-only scenario metadata, kept out of the mutable
 * `PatientSlice` store so they're never overwritten by submitted assessments.
 */
export interface ScenarioEncounter {
  id: string
  /** Scenario step label, e.g. "11.2-1A". Optional for generic timelines. */
  step?: string
  date: string
  /** Short title for the step, e.g. "Triage suicide screen (ASQ)". */
  title: string
  /** Pathway stage slug this step belongs to (matches catalog/stages). */
  stageId?: string
  /** Acting role, e.g. "Triage Nurse / Screener". */
  actor?: string
  status: 'completed' | 'scheduled'
  notes: string
  /** FHIR resource types this step produces, e.g. ["QuestionnaireResponse", "Observation"]. */
  fhirArtifacts?: string[]
  /** True when no SPiER profile exists yet for this step's artifact. */
  profileGap?: boolean
  /** Link to captured QuestionnaireResponses by their display name. */
  relatedResponseNames?: string[]
  /** Link to captured CarePlans by substring match on CarePlan.id. */
  relatedCarePlanIdSubstrings?: string[]
}
