import { makeObservation, walkItems, getBooleanAnswer, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

export function mapCSSRSFull(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // Check both lifetime and recent for each ideation level
  const q1Life = getBooleanAnswer(walkItems(items, 'q1-lifetime'))
  const q1Recent = getBooleanAnswer(walkItems(items, 'q1-recent'))
  const q2Life = getBooleanAnswer(walkItems(items, 'q2-lifetime'))
  const q2Recent = getBooleanAnswer(walkItems(items, 'q2-recent'))
  const q3Life = getBooleanAnswer(walkItems(items, 'q3-lifetime'))
  const q3Recent = getBooleanAnswer(walkItems(items, 'q3-recent'))
  const q4Life = getBooleanAnswer(walkItems(items, 'q4-lifetime'))
  const q4Recent = getBooleanAnswer(walkItems(items, 'q4-recent'))
  const q5Life = getBooleanAnswer(walkItems(items, 'q5-lifetime'))
  const q5Recent = getBooleanAnswer(walkItems(items, 'q5-recent'))

  const attemptLife = getBooleanAnswer(walkItems(items, 'actual-attempt-lifetime'))
  const attemptRecent = getBooleanAnswer(walkItems(items, 'actual-attempt-recent'))

  // Highest recent ideation level
  let highestRecent = 0
  if (q5Recent) highestRecent = 5
  else if (q4Recent) highestRecent = 4
  else if (q3Recent) highestRecent = 3
  else if (q2Recent) highestRecent = 2
  else if (q1Recent) highestRecent = 1

  let highestLifetime = 0
  if (q5Life) highestLifetime = 5
  else if (q4Life) highestLifetime = 4
  else if (q3Life) highestLifetime = 3
  else if (q2Life) highestLifetime = 2
  else if (q1Life) highestLifetime = 1

  // Most severe ideation type from intensity section
  const mostSevereType = walkItems(items, 'most-severe-type')?.answer?.[0]?.valueInteger

  // Risk level observation
  let riskCode = 'none'
  let riskDisplay = 'No risk identified'
  if (highestRecent >= 5 || attemptRecent) { riskCode = 'high'; riskDisplay = 'High Risk' }
  else if (highestRecent >= 3) { riskCode = 'moderate'; riskDisplay = 'Moderate Risk' }
  else if (highestRecent >= 1) { riskCode = 'low'; riskDisplay = 'Low Risk' }
  else if (attemptLife) { riskCode = 'low'; riskDisplay = 'Low Risk — historical behavior' }

  observations.push(
    makeObservation({
      id: `cssrs-full-risk-${Date.now()}`,
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
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'L', display: riskDisplay },
      note: `C-SSRS Full: Highest recent ideation level ${highestRecent}/5, highest lifetime ${highestLifetime}/5. Most severe type: ${mostSevereType || 'N/A'}. Attempt history: lifetime=${attemptLife ? 'Yes' : 'No'}, recent=${attemptRecent ? 'Yes' : 'No'}.`,
      questionnaireName: 'C-SSRS Full',
    }),
  )

  const riskAlert: RiskAlert = riskCode === 'high'
    ? {
        tool: 'C-SSRS Full',
        level: 'high',
        summary: `C-SSRS Full: HIGH Risk (ideation level ${highestRecent}/5)`,
        detail: `Comprehensive assessment indicates high risk. ${attemptRecent ? 'Recent suicide attempt reported.' : ''} Immediate safety planning and intervention required.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'moderate'
    ? {
        tool: 'C-SSRS Full',
        level: 'moderate',
        summary: `C-SSRS Full: MODERATE Risk (ideation level ${highestRecent}/5)`,
        detail: `Active ideation with method or intent identified. Safety planning recommended.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'low'
    ? {
        tool: 'C-SSRS Full',
        level: 'low',
        summary: `C-SSRS Full: LOW Risk (ideation level ${highestRecent}/5)`,
        detail: `Passive ideation or historical risk only. Outpatient follow-up recommended.`,
      }
    : {
        tool: 'C-SSRS Full',
        level: 'none',
        summary: 'C-SSRS Full: No current risk identified',
        detail: 'No suicidal ideation or behavior endorsed in recent or lifetime assessment.',
      }

  return { observations, riskAlert }
}
