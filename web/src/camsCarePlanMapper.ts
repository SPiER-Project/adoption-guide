/**
 * camsCarePlanMapper.ts
 *
 * Transforms a FHIR QuestionnaireResponse from the CAMS Stabilization Plan
 * into a FHIR CarePlan resource using the Hybrid model.
 *
 * Activities:
 *   1. Lethal Means Reduction
 *   2. Coping Strategies
 *   3. Emergency Contact
 *   4. Support Network
 *   5. Treatment Adherence (Barriers & Solutions)
 */

function extractAnswers(items: any[], linkId: string): string[] {
  const results: string[] = []
  function walk(itemList: any[]) {
    for (const item of itemList) {
      if (item.linkId === linkId && item.answer) {
        for (const ans of item.answer) {
          if (ans.valueString) results.push(ans.valueString)
          if (ans.item) walk(ans.item)
        }
      }
      if (item.item) walk(item.item)
    }
  }
  walk(items)
  return results.filter(Boolean)
}

function extractPairs(items: any[], groupLinkId: string, fieldA: string, fieldB: string): Array<{ a: string; b: string }> {
  const pairs: Array<{ a: string; b: string }> = []
  function walk(itemList: any[]) {
    for (const item of itemList) {
      if (item.linkId === groupLinkId && item.answer) {
        for (const ans of item.answer) {
          if (ans.item) {
            let a = ''
            let b = ''
            for (const nested of ans.item) {
              if (nested.linkId === fieldA && nested.answer?.[0]?.valueString) a = nested.answer[0].valueString
              if (nested.linkId === fieldB && nested.answer?.[0]?.valueString) b = nested.answer[0].valueString
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

export interface CarePlanActivity {
  stepTitle: string
  loincCode?: string
  description: string
}

export interface GeneratedStabilizationPlan {
  resource: any
  activities: CarePlanActivity[]
  isEmpty: boolean
}

export function generateStabilizationCarePlan(questionnaireResponse: any): GeneratedStabilizationPlan {
  const items = questionnaireResponse?.item || []

  // 1. Lethal Means Reduction
  const lethalMeans = extractAnswers(items, 'lethal-means-list').join('; ')

  // 2. Coping Strategies
  const coping = extractAnswers(items, 'coping-list').join('; ')

  // 3. Emergency Contact
  const emergencyContact = extractAnswers(items, 'emergency-contact').join(', ')

  // 4. Support People
  const support = extractAnswers(items, 'support-list').join('; ')

  // 5. Treatment Barriers & Solutions
  const barriers = extractPairs(items, 'barrier-solution-group', 'barrier', 'solution')
  const barrierStr = barriers.map(p => p.b ? `${p.a} → ${p.b}` : p.a).join('; ')

  // LOINC codes reused from Stanley-Brown Safety Plan panel where concepts overlap
  const activityDescriptions: CarePlanActivity[] = [
    { stepTitle: 'Lethal Means Reduction', loincCode: '76694-1', description: lethalMeans || 'No lethal means reduction steps provided.' },
    { stepTitle: 'Coping Strategies', loincCode: '76690-9', description: coping || 'No coping strategies provided.' },
    { stepTitle: 'Emergency Contact', loincCode: '76693-3', description: emergencyContact || 'No emergency contact provided.' },
    { stepTitle: 'Support Network', loincCode: '76692-5', description: support || 'No support contacts provided.' },
    { stepTitle: 'Treatment Adherence Plan', description: barrierStr || 'No barriers/solutions identified.' },
  ]

  const hasAnyData = [lethalMeans, coping, emergencyContact, support, barrierStr].some(s => s.length > 0)

  const carePlan = {
    resourceType: 'CarePlan',
    id: `cams-stabilization-careplan-${Date.now()}`,
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
      reference: 'Patient/demo-patient',
      display: 'Demo Patient (no data persisted to server)',
    },
    addresses: [{ display: 'Risk for suicide' }],
    activity: activityDescriptions.map(a => ({
      detail: {
        code: a.loincCode
          ? { coding: [{ system: 'http://loinc.org', code: a.loincCode }], text: a.stepTitle }
          : { text: a.stepTitle },
        status: 'in-progress',
        description: a.description,
      },
    })),
    note: [
      {
        text: 'DEMO ONLY — CAMS Stabilization CarePlan generated client-side. This plan should be reviewed and updated at the start of every CAMS session. Uses the Hybrid model where core safety data is embedded in activity.description fields.',
      },
    ],
  }

  return {
    resource: carePlan,
    activities: activityDescriptions,
    isEmpty: !hasAnyData,
  }
}
