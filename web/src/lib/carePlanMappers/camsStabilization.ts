import {
  CAMS_SECTION_SYSTEM,
  LOINC_SYSTEM,
  extractAnswers,
  extractPairs,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
  type QuestionnaireResponseResource,
} from './shared'

/**
 * Transform a CAMS Stabilization Plan QuestionnaireResponse into a
 * 5-activity CarePlan. LOINC codes for the first four activities are
 * reused from the Stanley-Brown panel where the concepts overlap;
 * the treatment-adherence step has no published LOINC and uses
 * text-only coding.
 */
export function generateStabilizationCarePlan(questionnaireResponse: QuestionnaireResponseResource): GeneratedCarePlan {
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
    // Section codes are required by SPiERCAMSStabilizationPlan, which slices
    // activity on detail.code — all five must be present and coded or the
    // CarePlan does not conform to the profile it declares in meta.profile.
    activities: [
      { stepTitle: 'Lethal Means Reduction',   sectionCode: { system: LOINC_SYSTEM, code: '76694-1' }, description: lethalMeans     || 'No lethal means reduction steps provided.' },
      { stepTitle: 'Coping Strategies',        sectionCode: { system: LOINC_SYSTEM, code: '76690-9' }, description: coping          || 'No coping strategies provided.' },
      { stepTitle: 'Emergency Contact',        sectionCode: { system: LOINC_SYSTEM, code: '76693-3' }, description: emergencyContact || 'No emergency contact provided.' },
      { stepTitle: 'Support Network',          sectionCode: { system: LOINC_SYSTEM, code: '76692-5' }, description: support         || 'No support contacts provided.' },
      // No published LOINC for the treatment-adherence step — SPiER-local code.
      { stepTitle: 'Treatment Adherence Plan', sectionCode: { system: CAMS_SECTION_SYSTEM, code: 'treatment-adherence' }, description: barrierStr || 'No barriers/solutions identified.' },
    ],
  })
}
