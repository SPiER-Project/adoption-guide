/**
 * FHIR `Patient` → the registry's view of a patient.
 *
 * Split out of `SmartDataSource` so the mapping has one home and a test can
 * reach it: a cohort read (#401) is the first thing in the app that has to build
 * a `RegistryPatient` from a resource rather than from `patients.json`.
 *
 * ⚠️ **`recommendedNextStep` is `null` and cannot be otherwise.** It is
 * hand-curated per patient in `patients.json` and no FHIR element carries it, so
 * a server-backed row derives its next step from the pathway instead — see
 * `derivedNextStep` in `lib/cdsHooks/cards.ts`, which the caseload column falls
 * back to.
 *
 * ⚠️ **`gender` is title-cased on purpose.** FHIR's `administrative-gender`
 * codes are lowercase (`female`); `patients.json` carries `Female`, and the
 * caseload prints the value straight through. Passing the raw code would make a
 * server-backed row render differently from a bundled one for no reason a reader
 * could see — the sort of difference that gets mistaken for a data problem.
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
