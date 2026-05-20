import {
  extractAnswers,
  extractPairs,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
} from './shared'

/**
 * Transform a CAMS Stabilization Plan QuestionnaireResponse into a
 * 5-activity CarePlan. LOINC codes for the first four activities are
 * reused from the Stanley-Brown panel where the concepts overlap;
 * the treatment-adherence step has no published LOINC and uses
 * text-only coding.
 */
export function generateStabilizationCarePlan(questionnaireResponse: any): GeneratedCarePlan {
  const items = questionnaireResponse?.item || []

  const lethalMeans     = extractAnswers(items, 'lethal-means-list').join('; ')
  const coping          = extractAnswers(items, 'coping-list').join('; ')
  const emergencyContact = extractAnswers(items, 'emergency-contact').join(', ')
  const support         = extractAnswers(items, 'support-list').join('; ')

  const barriers = extractPairs(items, 'barrier-solution-group', 'barrier', 'solution')
  const barrierStr = barriers.map(p => p.b ? `${p.a} → ${p.b}` : p.a).join('; ')

  const hasAnyData = [lethalMeans, coping, emergencyContact, support, barrierStr].some(s => s.length > 0)

  return makeSuicidePreventionCarePlan({
    id: `cams-stabilization-careplan-${Date.now()}`,
    profileUrl: 'http://spier.org/StructureDefinition/spier-cams-stabilization-plan',
    noteText: 'DEMO ONLY — CAMS Stabilization CarePlan generated client-side. This plan should be reviewed and updated at the start of every CAMS session. Uses the Hybrid model where core safety data is embedded in activity.description fields.',
    hasAnyData,
    activities: [
      { stepTitle: 'Lethal Means Reduction',   loincCode: '76694-1', description: lethalMeans     || 'No lethal means reduction steps provided.' },
      { stepTitle: 'Coping Strategies',        loincCode: '76690-9', description: coping          || 'No coping strategies provided.' },
      { stepTitle: 'Emergency Contact',        loincCode: '76693-3', description: emergencyContact || 'No emergency contact provided.' },
      { stepTitle: 'Support Network',          loincCode: '76692-5', description: support         || 'No support contacts provided.' },
      // No published LOINC for the treatment-adherence step
      { stepTitle: 'Treatment Adherence Plan', description: barrierStr || 'No barriers/solutions identified.' },
    ],
  })
}
