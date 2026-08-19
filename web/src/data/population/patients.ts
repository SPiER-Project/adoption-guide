/**
 * The demo population registry, parsed once.
 *
 * Extracted from `PatientProvider` (#126) because two consumers now need the
 * id lookup: the provider itself, for the Patient resource it builds, and
 * `useActivePatientId`, which validates ids out of the URL against it.
 *
 * ⚠️ This is one of the THREE sites `npm run check:patients` reconciles —
 * `population-patients.fsh` is canonical, `patients.json` holds the display
 * copies, and the MRN system the app emits is scraped out of
 * `PatientProvider.tsx`. Changing a demographic here alone will fail that gate.
 */
import populationPatientsData from './patients.json'
import type { PopulationPatient } from '../../context/PatientContext'

export const POPULATION_PATIENTS = populationPatientsData as PopulationPatient[]

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
