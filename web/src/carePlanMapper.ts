/**
 * carePlanMapper.ts
 *
 * Transforms a FHIR QuestionnaireResponse from the Stanley-Brown Safety Plan
 * into a FHIR CarePlan resource using the Hybrid model.
 *
 * ⚠️ DEMO ONLY — No data is persisted. Storing patient data without proper
 * safeguards would be a HIPAA violation.
 *
 * Mapping logic follows: Stanley Brown Safety Plan/docs/data-mapping.md
 */

// Helper: extract all answer values for a given linkId from a QuestionnaireResponse
function extractAnswers(items: any[], linkId: string): string[] {
    const results: string[] = []

    function walk(itemList: any[]) {
        for (const item of itemList) {
            if (item.linkId === linkId && item.answer) {
                for (const ans of item.answer) {
                    if (ans.valueString) results.push(ans.valueString)
                    // Walk nested items inside answers (for repeating groups)
                    if (ans.item) walk(ans.item)
                }
            }
            if (item.item) walk(item.item)
        }
    }

    walk(items)
    return results.filter(Boolean)
}

// Helper: extract grouped pairs from repeating groups (e.g. name + contact)
function extractPairs(
    items: any[],
    groupLinkId: string,
    fieldA: string,
    fieldB: string
): Array<{ a: string; b: string }> {
    const pairs: Array<{ a: string; b: string }> = []

    function walk(itemList: any[]) {
        for (const item of itemList) {
            if (item.linkId === groupLinkId && item.answer) {
                for (const ans of item.answer) {
                    if (ans.item) {
                        let a = ''
                        let b = ''
                        for (const nested of ans.item) {
                            if (nested.linkId === fieldA && nested.answer?.[0]?.valueString) {
                                a = nested.answer[0].valueString
                            }
                            if (nested.linkId === fieldB && nested.answer?.[0]?.valueString) {
                                b = nested.answer[0].valueString
                            }
                        }
                        if (a || b) pairs.push({ a, b })
                    }
                }
            }
            if (item.item) walk(item.item)
        }
    }

    walk(items)
    return pairs
}

// Extract Step 5 Professional Support (special: clincian/agency + ED info)
function extractStep5(items: any[]): string {
    const clinicians = extractPairs(items, '5-1-clinician-agency-group', '5-1-name', '5-2-contact-info')
    const clinicianStr = clinicians.map(p => p.b ? `${p.a} (${p.b})` : p.a).join(', ')

    // ED info
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

export interface CarePlanActivity {
    stepTitle: string
    loincCode?: string
    description: string
}

export interface GeneratedCarePlan {
    resource: any // Full FHIR CarePlan JSON
    activities: CarePlanActivity[] // Parsed for display
    isEmpty: boolean
}

export function generateCarePlan(questionnaireResponse: any): GeneratedCarePlan {
    const items = questionnaireResponse?.item || []

    // Step 1: Warning Signs
    const step1 = extractAnswers(items, '1-1-warning-sign').join(', ')

    // Step 2: Internal Coping Strategies
    const step2 = extractAnswers(items, '2-1-coping-strategy').join(', ')

    // Step 3: Distraction Contacts
    const step3Pairs = extractPairs(items, '3-1-distraction-contact-group', '3-1-name-place', '3-2-contact-info')
    const step3 = step3Pairs.map(p => p.b ? `${p.a} (${p.b})` : p.a).join(', ')

    // Step 4: Crisis Support
    const step4Pairs = extractPairs(items, '4-1-support-person-group', '4-1-name', '4-2-contact-info')
    const step4 = step4Pairs.map(p => p.b ? `${p.a} (${p.b})` : p.a).join(', ')

    // Step 5: Professional Support
    const step5 = extractStep5(items)

    // Step 6: Lethal Means Safety
    const step6 = extractAnswers(items, '6-1-safety-action').join(', ')

    // Step 7: Reason for Living
    const step7 = extractAnswers(items, '7-1-worth-living').join(', ')

    const activityDescriptions = [
        { stepTitle: 'Step 1: Warning Signs', loincCode: '76689-1', description: step1 || 'No warning signs provided.' },
        { stepTitle: 'Step 2: Internal Coping Strategies', loincCode: '76690-9', description: step2 || 'No coping strategies provided.' },
        { stepTitle: 'Step 3: Social Distractions', loincCode: '76691-7', description: step3 || 'No distraction contacts provided.' },
        { stepTitle: 'Step 4: Crisis Support Contacts', loincCode: '76692-5', description: step4 || 'No crisis contacts provided.' },
        { stepTitle: 'Step 5: Professional Support', loincCode: '76693-3', description: step5 || 'No professional contacts provided.' },
        { stepTitle: 'Step 6: Lethal Means Safety', loincCode: '76694-1', description: step6 || 'No lethal means plan provided.' },
        { stepTitle: 'Step 7: Reason for Living', loincCode: '81344-4', description: step7 || 'No reason for living provided.' },
    ]

    const hasAnyData = [step1, step2, step3, step4, step5, step6, step7].some(s => s.length > 0)

    const carePlan = {
        resourceType: 'CarePlan',
        id: `stanley-brown-safety-plan-${Date.now()}`,
        meta: {
            profile: ['http://hl7.org/fhir/us/ecareplan/StructureDefinition/us-ecareplan'],
        },
        status: 'active',
        intent: 'plan',
        category: [
            {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code: '735324008',
                        display: 'Treatment plan for suicide prevention',
                    },
                ],
            },
        ],
        subject: {
            reference: 'Patient/demo',
            display: 'Demo Patient (no data persisted)',
        },
        addresses: [{ display: 'Risk for suicide' }],
        activity: activityDescriptions.map(a => ({
            detail: {
                code: {
                    coding: [{ system: 'http://loinc.org', code: a.loincCode }],
                    text: a.stepTitle,
                },
                status: 'in-progress',
                description: a.description,
            },
        })),
        note: [
            {
                text: 'DEMO ONLY — This CarePlan was generated client-side for demonstration purposes. No patient data has been stored or transmitted. This CarePlan uses the Hybrid model where core safety data is embedded in activity.description fields for maximum interoperability.',
            },
        ],
    }

    return {
        resource: carePlan,
        activities: activityDescriptions,
        isEmpty: !hasAnyData,
    }
}
