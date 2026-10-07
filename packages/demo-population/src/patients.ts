/**
 * The demo population registry, derived once.
 *
 * Extracted from `PatientProvider` (#126) because two consumers now need the
 * id lookup: the provider itself, for the Patient resource it builds, and
 * `useActivePatientId`, which validates ids out of the URL against it.
 *
 * ⚠️ **The demographics are DERIVED, not copied.** Until 2026-10-07 a
 * `patients.json` held display copies of each patient's name, birth date,
 * gender and MRN beside the canonical Patient JSON in `./patients/`, and
 * `check:patients` compared the two field by field. The copies are gone: each
 * row is read off its Patient resource here, so the caseload and the banner
 * cannot show one age while the mock EHR serves another. What is left by hand
 * is `next-steps.json` — the curated next-step line, which no FHIR resource
 * carries (see `RegistryPatient.recommendedNextStep`).
 */
// Step B (#389) closed the type-only edge this used to have into the app.
// `PopulationPatient` was only ever an alias of `RegistryPatient`, which now
// lives in packages/core — so this is a package-to-package import, and this
// package no longer references the app at all.
import type { RegistryPatient as PopulationPatient } from '@spier/core/lib/registry'
import { MRN_SYSTEM } from '@spier/core/lib/fhircast'
import { toRegistryPatient } from '@spier/core/lib/dataSource/registryPatient'
import type { FhirResource } from '@spier/core/types/fhir'
import NEXT_STEPS from './next-steps.json'

interface DemoPatientResource extends FhirResource {
  identifier?: { system?: string; value?: string }[]
  name?: { given?: string[]; family?: string }[]
  gender?: string
  birthDate?: string
}

const modules = import.meta.glob<DemoPatientResource>('./patients/patient-*.json', {
  eager: true,
  import: 'default',
})

/**
 * One Patient resource as a registry row — the SAME mapping a server-backed
 * cohort read uses (`toRegistryPatient`), so a bundled row and a SMART row
 * cannot render a patient differently. Plus the curated next step.
 *
 * Throws on a resource that cannot supply a field, where `toRegistryPatient`
 * would fall back to a blank: from a real server a gap is data, but a demo
 * patient with no MRN under the system the app stamps is a broken fixture.
 */
function demoRow(patient: DemoPatientResource): PopulationPatient {
  const step = (NEXT_STEPS as Record<string, PopulationPatient['recommendedNextStep']>)[patient.id ?? '']
  const missing = [
    !patient.name?.[0] && 'name',
    !patient.birthDate && 'birthDate',
    !patient.gender && 'gender',
    !patient.identifier?.some(i => i.system === MRN_SYSTEM && i.value) && `identifier with system ${MRN_SYSTEM}`,
    step === undefined && 'next-steps.json entry',
  ].filter(Boolean)
  if (missing.length > 0 || step === undefined) {
    throw new Error(`demo Patient/${patient.id} has no ${missing.join(', ')}`)
  }
  return { ...toRegistryPatient(patient), recommendedNextStep: step }
}

export const POPULATION_PATIENTS: PopulationPatient[] = Object.values(modules)
  .map(demoRow)
  .sort((a, b) => a.id.localeCompare(b.id))

{
  // A next step for a patient who does not exist is a renamed or deleted
  // patient whose copy stayed behind.
  const orphans = Object.keys(NEXT_STEPS).filter(id => !POPULATION_PATIENTS.some(p => p.id === id))
  if (orphans.length > 0) throw new Error(`next-steps.json names no demo Patient: ${orphans.join(', ')}`)
}

export const POPULATION_BY_ID = new Map(POPULATION_PATIENTS.map(p => [p.id, p]))

/**
 * Whether an id names a real demo patient.
 *
 * Load-bearing as a guard, not just a convenience: ids reach `LocalDataSource`
 * as store keys, so an unvalidated one from a crafted URL (`__proto__`) or a
 * typo would silently create an empty patient slice.
 */
export function isAllowedPatientId(id: string): boolean {
  return POPULATION_BY_ID.has(id)
}
