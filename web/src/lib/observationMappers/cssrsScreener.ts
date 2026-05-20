import { makeObservation, walkItems, getBooleanAnswer, type MapperResult, type RiskAlert } from './shared'

export function mapCSSRSScreener(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Extract ideation items
  const q1 = getBooleanAnswer(walkItems(items, 'q1'))
  const q2 = getBooleanAnswer(walkItems(items, 'q2'))
  const q3 = getBooleanAnswer(walkItems(items, 'q3'))
  const q4 = getBooleanAnswer(walkItems(items, 'q4'))
  const q5 = getBooleanAnswer(walkItems(items, 'q5'))
  const q6 = getBooleanAnswer(walkItems(items, 'q6'))
  const q6Recent = getBooleanAnswer(walkItems(items, 'q6-recent'))

  // Determine risk level from highest positive
  let riskCode = 'none'
  let riskDisplay = 'No risk identified'
  let highestIdeation = 0

  if (q5) { riskCode = 'high'; riskDisplay = 'High Risk — specific plan with intent'; highestIdeation = 5 }
  else if (q4) { riskCode = 'moderate'; riskDisplay = 'Moderate Risk — ideation with some intent'; highestIdeation = 4 }
  else if (q3) { riskCode = 'moderate'; riskDisplay = 'Moderate Risk — ideation with method'; highestIdeation = 3 }
  else if (q2) { riskCode = 'low'; riskDisplay = 'Low Risk — active suicidal thoughts'; highestIdeation = 2 }
  else if (q1) { riskCode = 'low'; riskDisplay = 'Low Risk — wish to be dead'; highestIdeation = 1 }

  // Q6 (behavior) overrides to high if positive
  if (q6) {
    riskCode = 'high'
    riskDisplay = q6Recent
      ? 'High Risk — suicidal behavior within past 3 months'
      : 'High Risk — lifetime suicidal behavior'
  }

  // Individual item observations
  const cssrsItems = [
    { linkId: 'q1', code: '93246-7', display: 'Wish to be dead' },
    { linkId: 'q2', code: '93247-5', display: 'Non-specific active suicidal thoughts' },
    { linkId: 'q3', code: '93248-3', display: 'Active ideation with methods, no intent' },
    { linkId: 'q4', code: '93249-1', display: 'Active ideation with some intent' },
    { linkId: 'q5', code: '93250-9', display: 'Active ideation with specific plan and intent' },
    { linkId: 'q6', code: '93267-3', display: 'Suicidal behavior (ever)' },
  ]

  for (const { linkId, code, display } of cssrsItems) {
    const val = getBooleanAnswer(walkItems(items, linkId))
    if (val !== undefined) {
      observations.push(
        makeObservation({
          id: `cssrs-${linkId}-${Date.now()}`,
          code: { system: 'http://loinc.org', code, display },
          value: val,
          valueType: 'boolean',
          questionnaireName: 'C-SSRS Screener',
        }),
      )
    }
  }

  // Risk level observation
  observations.push(
    makeObservation({
      id: `cssrs-risk-level-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: {
        coding: [{ system: 'http://spier.org/CodeSystem/cssrs-risk-level', code: riskCode, display: riskDisplay }],
        text: riskDisplay,
      },
      valueType: 'codeable',
      interpretation: riskCode === 'high'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: riskDisplay }
        : riskCode === 'moderate'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: riskDisplay }
        : riskCode === 'low'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'L', display: riskDisplay }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'No risk identified' },
      note: `C-SSRS Screener: Highest ideation level ${highestIdeation}/5. Behavior: ${q6 ? 'Yes' : 'No'}${q6Recent ? ' (within 3 months)' : ''}.`,
      questionnaireName: 'C-SSRS Screener',
    }),
  )

  const riskAlert: RiskAlert = riskCode === 'high'
    ? {
        tool: 'C-SSRS Screener',
        level: 'high',
        summary: `C-SSRS: HIGH Risk`,
        detail: riskDisplay + '. Immediate safety planning and possible emergency psychiatric evaluation indicated.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'moderate'
    ? {
        tool: 'C-SSRS Screener',
        level: 'moderate',
        summary: `C-SSRS: MODERATE Risk`,
        detail: riskDisplay + '. Safety planning recommended. Consider full C-SSRS assessment.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'low'
    ? {
        tool: 'C-SSRS Screener',
        level: 'low',
        summary: `C-SSRS: LOW Risk`,
        detail: riskDisplay + '. Outpatient referral with warm handoff. Provide crisis resources (988).',
      }
    : {
        tool: 'C-SSRS Screener',
        level: 'none',
        summary: 'C-SSRS: No risk identified',
        detail: 'All C-SSRS screener items negative. No suicidal ideation or behavior endorsed.',
      }

  return { observations, riskAlert }
}
