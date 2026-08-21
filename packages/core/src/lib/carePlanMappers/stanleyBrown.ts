import {
  LOINC_SYSTEM,
  SAFETY_PLAN_SECTION_SYSTEM,
  extractAnswers,
  extractPairs,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
  type QuestionnaireResponseResource,
  type QuestionnaireResponseItem,
} from './shared'

// Step 5 needs a custom extractor: clinician/agency pairs + a separate
// emergency-department block of three fields.
function extractStep5(items: QuestionnaireResponseItem[]): string {
  const clinicians = extractPairs(items, '5-1-clinician-agency-group', '5-1-name', '5-2-contact-info')
  const clinicianStr = clinicians.map(p => p.b ? `${p.a} (${p.b})` : p.a).join(', ')

  const edName = extractAnswers(items, '5-3-name')
  const edAddress = extractAnswers(items, '5-4-address')
  const edPhone = extractAnswers(items, '5-5-phone')

  let edStr = ''
  if (edName.length > 0) {
    const parts = [edName[0]]
    if (edAddress[0]) parts.push(edAddress[0])
    if (edPhone[0]) parts.push(edPhone[0])
    edStr = parts.join(', ')
  }

  return [clinicianStr, edStr].filter(Boolean).join(' / ')
}

/**
 * Transform a Stanley-Brown Safety Plan QuestionnaireResponse into a
 * 7-activity CarePlan using the Hybrid model (a SPiER-local section code on
 * each step + patient-authored content in detail.description).
 */
export function generateCarePlan(questionnaireResponse: QuestionnaireResponseResource): GeneratedCarePlan {
  const items = questionnaireResponse?.item || []

  const step1 = extractAnswers(items, '1-1-warning-sign').join(', ')
  const step2 = extractAnswers(items, '2-1-coping-strategy').join(', ')

  const step3Pairs = extractPairs(items, '3-1-distraction-contact-group', '3-1-name-place', '3-2-contact-info')
  const step3 = step3Pairs.map(p => p.b ? `${p.a} (${p.b})` : p.a).join(', ')

  const step4Pairs = extractPairs(items, '4-1-support-person-group', '4-1-name', '4-2-contact-info')
  const step4 = step4Pairs.map(p => p.b ? `${p.a} (${p.b})` : p.a).join(', ')

  const step5 = extractStep5(items)
  const step6 = extractAnswers(items, '6-1-safety-action').join(', ')
  const step7 = extractAnswers(items, '7-1-worth-living').join(', ')

  const hasAnyData = [step1, step2, step3, step4, step5, step6, step7].some(s => s.length > 0)

  return makeSuicidePreventionCarePlan({
    id: `stanley-brown-safety-plan-${Date.now()}`,
    profileUrl: 'http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan',
    noteText: 'DEMO ONLY — This CarePlan was generated client-side for demonstration purposes. No patient data has been stored or transmitted. This CarePlan uses the Hybrid model where core safety data is embedded in activity.description fields for maximum interoperability.',
    hasAnyData,
    extraCategories: [{ system: LOINC_SYSTEM, code: '87626-8', display: 'Suicide prevention note' }],
    activities: [
      { stepTitle: 'Step 1: Warning Signs',              sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'warning-signs' },       description: step1 || 'No warning signs provided.' },
      { stepTitle: 'Step 2: Internal Coping Strategies', sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'internal-coping' },     description: step2 || 'No coping strategies provided.' },
      { stepTitle: 'Step 3: Social Distractions',        sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'social-distraction' },  description: step3 || 'No distraction contacts provided.' },
      { stepTitle: 'Step 4: Crisis Support Contacts',    sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'crisis-support' },      description: step4 || 'No crisis contacts provided.' },
      { stepTitle: 'Step 5: Professional Support',       sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'professional-support' }, description: step5 || 'No professional contacts provided.' },
      { stepTitle: 'Step 6: Lethal Means Safety',        sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'lethal-means-safety' }, description: step6 || 'No lethal means plan provided.' },
      { stepTitle: 'Step 7: Reason for Living',          sectionCode: { system: SAFETY_PLAN_SECTION_SYSTEM, code: 'reason-for-living' },   description: step7 || 'No reason for living provided.' },
    ],
  })
}
