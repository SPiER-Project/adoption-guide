/**
 * FHIR `Patient` → the registry's view of a patient.
 *
 * Split out of `SmartDataSource` so the mapping has one home and a test can
 * reach it: a cohort read (#401) was the first thing in the app to build a
 * `RegistryPatient` from a resource. Since 2026-10-07 the bundled demo registry
 * is built by this same function from its Patient JSON (demo-population's
 * `patients.ts`), so the two cannot render a patient differently.
 *
 * ⚠️ **`recommendedNextStep` is `null` and cannot be otherwise.** It is
 * hand-curated per demo patient in `next-steps.json` and no FHIR element carries it, so
 * a server-backed row derives its next step from the published pathway instead
 * — `DerivedRegistryRow.nextStep`, which the caseload column falls back to and
 * which the patient's own chart leads with (`lib/pathwayEvaluation.ts`).
 *
 * ⚠️ **`gender` is title-cased on purpose.** FHIR's `administrative-gender`
 * codes are lowercase (`female`); the caseload prints `Female`, straight
 * through. (This used to be matched against a hand-typed `Female` in the demo's
 * display copies; those are now derived here, so there is one rule.)
 */
import { MRN_SYSTEM } from '../fhircast'
import type { RegistryPatient } from '../registry'
import type { FhirResource } from '../../types/fhir'

interface PatientLike extends FhirResource {
  name?: Array<{ given?: string[]; family?: string; text?: string }>
  identifier?: Array<{ system?: string; value?: string }>
  gender?: string
  birthDate?: string
}

function displayNameOf(patient: PatientLike): string {
  const name = patient.name?.[0]
  if (!name) return patient.id ?? 'Unknown patient'
  if (name.text) return name.text
  const given = (name.given ?? []).join(' ')
  const full = [given, name.family].filter(Boolean).join(' ').trim()
  return full || (patient.id ?? 'Unknown patient')
}

function titleCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

export function toRegistryPatient(resource: FhirResource): RegistryPatient {
  const patient = resource as PatientLike
  return {
    id: patient.id ?? '',
    displayName: displayNameOf(patient),
    dob: patient.birthDate ?? '',
    // The MRN is the identifier the demo's own system names; any other
    // identifier is left alone rather than guessed at.
    mrn: patient.identifier?.find(i => i.system === MRN_SYSTEM)?.value ?? '',
    gender: titleCase(patient.gender ?? ''),
    recommendedNextStep: null,
  }
}
