import {
  extractAnswers,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
  type QuestionnaireResponseResource,
} from './shared'

/**
 * Transform a Crisis Response Plan (Bryan & Rudd) QuestionnaireResponse into a
 * 5-activity CarePlan. LOINC codes are reused from the Stanley-Brown safety-plan
 * panel where the concepts overlap; there is no validated CRP-specific panel.
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
    activities: [
      { stepTitle: 'Warning Signs',                        loincCode: '76689-1', description: warningSigns        || 'No warning signs provided.' },
      { stepTitle: 'Coping Strategies (Self-Management)',  loincCode: '76690-9', description: coping              || 'No coping strategies provided.' },
      { stepTitle: 'Reasons for Living',                   loincCode: '81344-4', description: reasonsLiving       || 'No reasons for living provided.' },
      { stepTitle: 'Social Support',                       loincCode: '76692-5', description: socialSupport       || 'No social supports provided.' },
      { stepTitle: 'Professional & Crisis Support',        loincCode: '76693-3', description: professionalSupport || 'No professional/crisis supports provided.' },
    ],
  })
}
