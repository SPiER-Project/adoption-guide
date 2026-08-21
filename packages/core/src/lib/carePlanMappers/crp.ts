import {
  LOINC_SYSTEM,
  SAFETY_PLAN_SECTION_SYSTEM,
  extractAnswers,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
  type QuestionnaireResponseResource,
} from './shared'

/**
 * Transform a Crisis Response Plan (Bryan & Rudd) QuestionnaireResponse into a
 * 5-activity CarePlan. Section codes come from the SPiER-local safety-plan
 * section CodeSystem shared with Stanley-Brown — the CRP's five sections are a
 * subset of Stanley-Brown's seven, and LOINC publishes nothing at this
 * granularity for either instrument.
 */
export function generateCrisisResponseCarePlan(questionnaireResponse: QuestionnaireResponseResource): GeneratedCarePlan {
  const items = questionnaireResponse?.item || []

  const warningSigns = extractAnswers(items, 'warning-signs-list').join('; ')
  const coping = extractAnswers(items, 'coping-list').join('; ')
  const reasonsLiving = extractAnswers(items, 'reasons-living-list').join('; ')
  const socialSupport = extractAnswers(items, 'social-support-list').join('; ')
  const professionalSupport = extractAnswers(items, 'professional-support-list').join('; ')

  const hasAnyData = [warningSigns, coping, reasonsLiving, socialSupport, professionalSupport].some(s => s.length > 0)

  return makeSuicidePreventionCarePlan({
    id: `crisis-response-plan-${Date.now()}`,
    profileUrl: 'http://spier.org/StructureDefinition/spier-crisis-response-plan',
    noteText: 'DEMO ONLY — Crisis Response Plan (Bryan & Rudd) CarePlan generated client-side. No patient data has been stored or transmitted. Uses the Hybrid model where core plan content is embedded in activity.description fields. The patient should keep a copy of the plan.',
    hasAnyData,
    extraCategories: [{ system: LOINC_SYSTEM, code: '87626-8', display: 'Suicide prevention note' }],
    activities: [
      { stepTitle: 'Warning Signs',                        sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'warning-signs' },        description: warningSigns        || 'No warning signs provided.' },
      { stepTitle: 'Coping Strategies (Self-Management)',  sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'internal-coping' },      description: coping              || 'No coping strategies provided.' },
      { stepTitle: 'Reasons for Living',                   sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'reason-for-living' },    description: reasonsLiving       || 'No reasons for living provided.' },
      { stepTitle: 'Social Support',                       sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'crisis-support' },       description: socialSupport       || 'No social supports provided.' },
      { stepTitle: 'Professional & Crisis Support',        sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'professional-support' }, description: professionalSupport || 'No professional/crisis supports provided.' },
    ],
  })
}
