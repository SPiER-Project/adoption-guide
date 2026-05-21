/**
 * Per-patient scenario data — one JSON file per population patient, loaded
 * eagerly so PatientContext can pre-seed empty slices on first view.
 *
 * Each scenario has the shape { responses, observations, carePlans, riskAlerts }
 * matching the in-memory PatientSlice. The patient id is derived from the
 * filename (e.g. `patient-005.json` → `patient-005`).
 */
import type { RiskAlert } from '../../../lib/observationMappers'

interface StoredResponse {
  id: string
  questionnaireName: string
  completedAt: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: any
}

export interface PatientScenario {
  responses: StoredResponse[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  observations: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  carePlans: any[]
  riskAlerts: RiskAlert[]
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
