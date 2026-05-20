/**
 * carePlanMappers — per-tool QuestionnaireResponse → CarePlan logic.
 *
 * Three tools produce CarePlans rather than Observations:
 *   - Stanley-Brown Safety Plan (7-step canonical safety plan)
 *   - CAMS Stabilization Plan   (5-step CAMS-framework safety plan)
 *   - CAMS Therapeutic Worksheet (4-step drivers + crisis working model)
 *
 * All three share the FHIR CarePlan shell via
 * `makeSuicidePreventionCarePlan` in ./shared.ts; per-tool files contain
 * only the QuestionnaireResponse extraction logic specific to that form.
 *
 * ⚠️ DEMO ONLY — No data is persisted to a server.
 */

export type { CarePlanActivity, GeneratedCarePlan } from './shared'

export { generateCarePlan } from './stanleyBrown'
export { generateStabilizationCarePlan } from './camsStabilization'
export { generateTherapeuticCarePlan } from './camsTherapeutic'
