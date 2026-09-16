/**
 * `@spier/demo-population` on the CLINICAL surface: the same barrel, empty.
 *
 * vite.config.ts points the alias here when `VITE_SURFACE=clinical`, so the
 * scenario glob in packages/demo-population is never compiled in and the
 * four importers (localDataSource, PatientProvider, useActivePatientId,
 * usePatientOpenBroadcast) see a population of nobody — no code path changes,
 * there is simply no synthetic patient for one to find. The types are
 * imported `type`-only, which is erased, so this file pulls in none of the
 * real package at runtime. `shims/demo-population.clinical.test.ts` holds
 * the export list to the real barrel's so the two cannot drift apart.
 */
import type { PatientScenario } from '../../../packages/demo-population/src/scenarios'
import type { POPULATION_PATIENTS as RealPatients } from '../../../packages/demo-population/src/patients'

export type { PatientScenario }

export const POPULATION_PATIENTS: typeof RealPatients = []
export const POPULATION_BY_ID: ReadonlyMap<string, (typeof RealPatients)[number]> = new Map()
export const POPULATION_SCENARIOS: Record<string, PatientScenario> = {}
export function isAllowedPatientId(id: string): boolean {
  void id
  return false
}
