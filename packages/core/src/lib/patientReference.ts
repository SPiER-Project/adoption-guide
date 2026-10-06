/**
 * The patient a resource is about — the one place a builder turns a patient id
 * into a `Reference(Patient)`.
 *
 * ⚠️ **A placeholder exists, and it is deliberate.** The Adoption Guide's tool
 * pages run every recorder with NO patient selected, and they show readers the
 * FHIR the recorder builds. A resource with no patient reference teaches the
 * wrong shape, so the guide's resources name one recognisable placeholder. A
 * resource built for a chart always names that chart's patient.
 *
 * This literal was written out in fourteen builders as
 * `Patient/${params.patientId ?? 'demo-patient'}`, and the instrument mappers
 * stamped it unconditionally — on real charts too, corrected only because the
 * SMART source re-stamps the patient before a write. One definition makes the
 * placeholder a decision about the no-patient case rather than a default that
 * reached every case.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
export const PLAYGROUND_PATIENT_ID = 'demo-patient'

export function patientReference(patientId: string | null | undefined): { reference: string } {
  return { reference: `Patient/${patientId ?? PLAYGROUND_PATIENT_ID}` }
}
