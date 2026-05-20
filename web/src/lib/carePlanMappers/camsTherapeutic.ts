import {
  extractAnswer,
  makeSuicidePreventionCarePlan,
  type GeneratedCarePlan,
} from './shared'

/**
 * Transform a CAMS Therapeutic Worksheet QuestionnaireResponse into a
 * 4-activity CarePlan capturing the patient's personal narrative,
 * suicide drivers, and crisis working model. No LOINC codes — all
 * activities are text-only since these CAMS-framework concepts have
 * no published LOINC equivalents.
 */
export function generateTherapeuticCarePlan(questionnaireResponse: any): GeneratedCarePlan {
  const items = questionnaireResponse?.item || []

  // 1. Personal Narrative
  const narrative = extractAnswer(items, 'story-narrative')

  // 2. Direct Drivers — thoughts/feelings/behaviors/themes
  const ddParts = [
    { label: 'Thoughts',  value: extractAnswer(items, 'dd-thoughts') },
    { label: 'Feelings',  value: extractAnswer(items, 'dd-feelings') },
    { label: 'Behaviors', value: extractAnswer(items, 'dd-behaviors') },
    { label: 'Themes',    value: extractAnswer(items, 'dd-themes') },
  ].filter(p => p.value)
  const directDrivers = ddParts.map(p => `${p.label}: ${p.value}`).join('; ')

  // 3. Indirect Drivers — single free-text field
  const indirectDrivers = extractAnswer(items, 'id-desc')

  // 4. Crisis Working Model — three escalation stages, each with
  //    risk-increasing and risk-decreasing factors.
  const stages = [
    { name: 'Indirect Drivers',     increase: extractAnswer(items, 'si-increase'), decrease: extractAnswer(items, 'si-decrease') },
    { name: 'Direct Drivers',       increase: extractAnswer(items, 'sd-increase'), decrease: extractAnswer(items, 'sd-decrease') },
    { name: 'Suicide as an Option', increase: extractAnswer(items, 'so-increase'), decrease: extractAnswer(items, 'so-decrease') },
  ]
  const crisisModel = stages
    .filter(s => s.increase || s.decrease)
    .map(s => {
      const parts: string[] = []
      if (s.increase) parts.push(`Increases risk: ${s.increase}`)
      if (s.decrease) parts.push(`Decreases risk: ${s.decrease}`)
      return `[${s.name}] ${parts.join(' | ')}`
    })
    .join('. ')

  const hasAnyData = [narrative, directDrivers, indirectDrivers, crisisModel].some(s => s.length > 0)

  return makeSuicidePreventionCarePlan({
    id: `cams-therapeutic-careplan-${Date.now()}`,
    profileUrl: 'http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet',
    noteText: "DEMO ONLY — CAMS Therapeutic Worksheet CarePlan generated client-side. This captures the patient's suicide drivers and crisis working model to guide treatment planning. Uses the Hybrid model where core data is embedded in activity.description fields.",
    hasAnyData,
    activities: [
      { stepTitle: 'Personal Narrative',                  description: narrative       || 'No personal narrative provided.' },
      { stepTitle: 'Direct Drivers of Suicidality',       description: directDrivers   || 'No direct drivers identified.' },
      { stepTitle: 'Indirect Drivers of Suicidality',     description: indirectDrivers || 'No indirect drivers identified.' },
      { stepTitle: 'Suicide Crisis Working Model',        description: crisisModel     || 'No crisis model data provided.' },
    ],
  })
}
