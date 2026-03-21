/**
 * camsTherapeuticCarePlanMapper.ts
 *
 * Transforms a FHIR QuestionnaireResponse from the CAMS Therapeutic Worksheet
 * into a FHIR CarePlan resource using the Hybrid model.
 *
 * Activities:
 *   1. Personal Narrative — patient's suicide story
 *   2. Direct Drivers — thoughts, feelings, behaviors, themes
 *   3. Indirect Drivers — underlying contributing factors
 *   4. Crisis Working Model — 3-stage risk increase/decrease map
 */

function extractAnswer(items: any[], linkId: string): string {
  for (const item of items) {
    if (item.linkId === linkId && item.answer?.[0]) {
      return item.answer[0].valueString || item.answer[0].valueText || ''
    }
    if (item.item) {
      const found = extractAnswer(item.item, linkId)
      if (found) return found
    }
  }
  return ''
}

export interface TherapeuticActivity {
  stepTitle: string
  description: string
}

export interface GeneratedTherapeuticPlan {
  resource: any
  activities: TherapeuticActivity[]
  isEmpty: boolean
}

export function generateTherapeuticCarePlan(questionnaireResponse: any): GeneratedTherapeuticPlan {
  const items = questionnaireResponse?.item || []

  // 1. Personal Narrative
  const narrative = extractAnswer(items, 'story-narrative')

  // 2. Direct Drivers
  const ddParts = [
    { label: 'Thoughts', value: extractAnswer(items, 'dd-thoughts') },
    { label: 'Feelings', value: extractAnswer(items, 'dd-feelings') },
    { label: 'Behaviors', value: extractAnswer(items, 'dd-behaviors') },
    { label: 'Themes', value: extractAnswer(items, 'dd-themes') },
  ].filter(p => p.value)
  const directDrivers = ddParts.map(p => `${p.label}: ${p.value}`).join('; ')

  // 3. Indirect Drivers
  const indirectDrivers = extractAnswer(items, 'id-desc')

  // 4. Crisis Working Model — 3 stages
  const stages = [
    {
      name: 'Indirect Drivers',
      increase: extractAnswer(items, 'si-increase'),
      decrease: extractAnswer(items, 'si-decrease'),
    },
    {
      name: 'Direct Drivers',
      increase: extractAnswer(items, 'sd-increase'),
      decrease: extractAnswer(items, 'sd-decrease'),
    },
    {
      name: 'Suicide as an Option',
      increase: extractAnswer(items, 'so-increase'),
      decrease: extractAnswer(items, 'so-decrease'),
    },
  ]
  const crisisModelParts = stages
    .filter(s => s.increase || s.decrease)
    .map(s => {
      const parts = []
      if (s.increase) parts.push(`Increases risk: ${s.increase}`)
      if (s.decrease) parts.push(`Decreases risk: ${s.decrease}`)
      return `[${s.name}] ${parts.join(' | ')}`
    })
  const crisisModel = crisisModelParts.join('. ')

  const activityDescriptions: TherapeuticActivity[] = [
    { stepTitle: 'Personal Narrative', description: narrative || 'No personal narrative provided.' },
    { stepTitle: 'Direct Drivers of Suicidality', description: directDrivers || 'No direct drivers identified.' },
    { stepTitle: 'Indirect Drivers of Suicidality', description: indirectDrivers || 'No indirect drivers identified.' },
    { stepTitle: 'Suicide Crisis Working Model', description: crisisModel || 'No crisis model data provided.' },
  ]

  const hasAnyData = [narrative, directDrivers, indirectDrivers, crisisModel].some(s => s.length > 0)

  const carePlan = {
    resourceType: 'CarePlan',
    id: `cams-therapeutic-careplan-${Date.now()}`,
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
        code: { text: a.stepTitle },
        status: 'in-progress',
        description: a.description,
      },
    })),
    note: [
      {
        text: 'DEMO ONLY — CAMS Therapeutic Worksheet CarePlan generated client-side. This captures the patient\'s suicide drivers and crisis working model to guide treatment planning. Uses the Hybrid model where core data is embedded in activity.description fields.',
      },
    ],
  }

  return {
    resource: carePlan,
    activities: activityDescriptions,
    isEmpty: !hasAnyData,
  }
}
