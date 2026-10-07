/**
 * The demo population: 14 synthetic patients and their scenario slices.
 *
 * This barrel is the package's public surface. Consumers import
 * `@spier/demo-population`. The registry rows are derived from the Patient
 * JSON in `src/patients/` (see `patients.ts`); there is no raw registry file
 * to import.
 */
export { POPULATION_PATIENTS, POPULATION_BY_ID, isAllowedPatientId } from './patients'
export { POPULATION_SCENARIOS, type PatientScenario } from './scenarios'
export {
  SCENARIO_ANCHOR,
  daysSinceAnchor,
  isIsoDate,
  populationScenariosAsOf,
  shiftDates,
} from './scenarioDates'
