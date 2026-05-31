/**
 * Per-patient scenario data — one JSON file per population patient, loaded
 * eagerly so PatientContext can pre-seed empty slices on first view.
 *
 * Each scenario has the shape of a `PatientSlice` (responses, observations,
 * carePlans, riskAlerts). The patient id is derived from the filename
 * (e.g. `patient-005.json` → `patient-005`).
 */
import type { PatientSlice, ScenarioEncounter } from '../../../types/fhir'

/**
 * The on-disk scenario shape is a `PatientSlice` plus an optional read-only
 * `encounters` walkthrough timeline (see `ScenarioEncounter`). The encounter
 * list is intentionally kept out of `PatientSlice` so it never lands in the
 * mutable patient store — it's static scenario narration, not chart state.
 */
export type PatientScenario = PatientSlice & {
  encounters?: ScenarioEncounter[]
}

const modules = import.meta.glob<PatientScenario>('./patient-*.json', {
  eager: true,
  import: 'default',
})

function patientIdFromPath(path: string): string {
  // './patient-005.json' → 'patient-005'
  const match = path.match(/\.\/(patient-[0-9]+)\.json$/)
  if (!match) throw new Error(`Unexpected scenario filename: ${path}`)
  return match[1]
}

export const POPULATION_SCENARIOS: Record<string, PatientScenario> = Object.fromEntries(
  Object.entries(modules).map(([path, scenario]) => [patientIdFromPath(path), scenario]),
)
