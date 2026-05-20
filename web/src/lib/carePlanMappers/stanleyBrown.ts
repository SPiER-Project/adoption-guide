import {
  extractAnswers,
  extractPairs,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
} from './shared'

// Step 5 needs a custom extractor: clinician/agency pairs + a separate
// emergency-department block of three fields.
function extractStep5(items: any[]): string {
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
 * 7-activity CarePlan using the Hybrid model (LOINC codes on each
 * step + patient-authored content in detail.description).
 */
export function generateCarePlan(questionnaireResponse: any): GeneratedCarePlan {
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
    noteText: 'DEMO ONLY — This CarePlan was generated client-side for demonstration purposes. No patient data has been stored or transmitted. This CarePlan uses the Hybrid model where core safety data is embedded in activity.description fields for maximum interoperability.',
    hasAnyData,
    activities: [
      { stepTitle: 'Step 1: Warning Signs',              loincCode: '76689-1', description: step1 || 'No warning signs provided.' },
      { stepTitle: 'Step 2: Internal Coping Strategies', loincCode: '76690-9', description: step2 || 'No coping strategies provided.' },
      { stepTitle: 'Step 3: Social Distractions',        loincCode: '76691-7', description: step3 || 'No distraction contacts provided.' },
      { stepTitle: 'Step 4: Crisis Support Contacts',    loincCode: '76692-5', description: step4 || 'No crisis contacts provided.' },
      { stepTitle: 'Step 5: Professional Support',       loincCode: '76693-3', description: step5 || 'No professional contacts provided.' },
      { stepTitle: 'Step 6: Lethal Means Safety',        loincCode: '76694-1', description: step6 || 'No lethal means plan provided.' },
      { stepTitle: 'Step 7: Reason for Living',          loincCode: '81344-4', description: step7 || 'No reason for living provided.' },
    ],
  })
}
