/**
 * The demo population: 14 synthetic patients and their scenario slices.
 *
 * This barrel is the package's public surface. Consumers import
 * `@spier/demo-population`; the raw `patients.json` is reachable as
 * `@spier/demo-population/patients.json` for the two pages that cast it to
 * their own registry type.
 */
export { POPULATION_PATIENTS, POPULATION_BY_ID, isAllowedPatientId } from './patients'
export { POPULATION_SCENARIOS, type PatientScenario } from './scenarios'
