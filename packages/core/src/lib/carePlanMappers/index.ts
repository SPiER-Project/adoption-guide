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

import { QUESTIONNAIRE_URLS } from '@spier/fhir-artifacts/generated/questionnaire-urls.generated'
import type { GeneratedCarePlan, QuestionnaireResponseResource } from './shared'
import { generateCarePlan } from './stanleyBrown'
import { generateStabilizationCarePlan } from './camsStabilization'
import { generateTherapeuticCarePlan } from './camsTherapeutic'
import { generateCrisisResponseCarePlan } from './crp'

export type { CarePlanActivity, GeneratedCarePlan } from './shared'
export { CAMS_SECTION_SYSTEM, LOINC_SYSTEM } from './shared'

export { generateCarePlan, generateStabilizationCarePlan, generateTherapeuticCarePlan, generateCrisisResponseCarePlan }

/**
 * Questionnaire canonical → the CarePlan mapper that reads its responses — the
 * carePlan counterpart of `MAPPER_BY_QUESTIONNAIRE_URL`, and the ONE place the
 * pairing is stated: the tool views look the mapper up here by the canonical
 * they render.
 *
 * ⚠️ Added 2026-10-06 for `check:careplan-readers`. Without a registry that
 * gate resolved every linkId a mapper read against ALL eighteen
 * Questionnaires, so `stanleyBrown.ts` reading CRP's `coping-list` passed —
 * the item existed, just in another form. The gate now loads this and checks
 * each mapper against the form it serves.
 */
export const CAREPLAN_MAPPER_BY_QUESTIONNAIRE_URL: Record<string, (qr: QuestionnaireResponseResource) => GeneratedCarePlan> = {
  [QUESTIONNAIRE_URLS['StanleyBrownSafetyPlan']]: generateCarePlan,
  [QUESTIONNAIRE_URLS['CAMS-Stabilization-Plan']]: generateStabilizationCarePlan,
  [QUESTIONNAIRE_URLS['CAMS-Therapeutic-Worksheet']]: generateTherapeuticCarePlan,
  [QUESTIONNAIRE_URLS['CrisisResponsePlan']]: generateCrisisResponseCarePlan,
}
