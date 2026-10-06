/**
 * The FHIR buckets of a `PatientSlice`, each mapped to the one resourceType it
 * holds.
 *
 * ⚠️ **Typed off `PatientSlice` itself, so it cannot drift from it.** The mapped
 * type below demands one entry per FHIR bucket the slice declares (`-?` makes
 * the optional buckets required here), and each value must be the literal
 * `resourceType` of that bucket's element type. A bucket added to the slice
 * without an entry here, or filed under the wrong type, is a compile error.
 *
 * `check:scenarios:resources` reads this table (through
 * `scripts/lib/load-core.mjs`) to decide which top-level scenario keys are FHIR
 * buckets and what each must hold. It used to keep its own copy marked "keep in
 * step with LocalDataSource.saveArtifact's switch", which nothing enforced.
 *
 * `responses` (StoredResponse wrappers) and `riskAlerts` (an app type) are not
 * FHIR buckets and are deliberately absent.
 */
import type { PatientSlice } from '../types/fhir'

type FhirBucketKey = Exclude<keyof PatientSlice, 'responses' | 'riskAlerts'>

export const PATIENT_SLICE_FHIR_BUCKETS: {
  readonly [K in FhirBucketKey]-?: NonNullable<PatientSlice[K]>[number]['resourceType']
} = {
  observations: 'Observation',
  carePlans: 'CarePlan',
  communications: 'Communication',
  episodes: 'EpisodeOfCare',
  flags: 'Flag',
  tasks: 'Task',
  documentReferences: 'DocumentReference',
  serviceRequests: 'ServiceRequest',
  appointments: 'Appointment',
  consents: 'Consent',
  procedures: 'Procedure',
  encounters: 'Encounter',
}
