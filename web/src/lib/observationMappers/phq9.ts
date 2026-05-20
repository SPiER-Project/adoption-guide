import { makeObservation, walkItems, getCodingAnswer, getOrdinalValue, type MapperResult, type RiskAlert } from './shared'

export function mapPHQ9(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Calculate total score from ordinal values
  let totalScore = 0
  const itemLinkIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']

  for (const linkId of itemLinkIds) {
    const item = walkItems(items, linkId)
    const coding = getCodingAnswer(item)
    if (coding) {
      const ordinal = getOrdinalValue(coding)
      if (ordinal !== undefined) totalScore += ordinal
    }
  }

  // Total score Observation
  let severity = 'Minimal'
  let interpretationCode = 'N'
  if (totalScore >= 20) { severity = 'Severe'; interpretationCode = 'HH' }
  else if (totalScore >= 15) { severity = 'Moderately Severe'; interpretationCode = 'H' }
  else if (totalScore >= 10) { severity = 'Moderate'; interpretationCode = 'H' }
  else if (totalScore >= 5) { severity = 'Mild'; interpretationCode = 'L' }

  observations.push(
    makeObservation({
      id: `phq9-total-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '44261-6', display: 'Patient Health Questionnaire 9 item total score' },
      value: totalScore,
      valueType: 'integer',
      interpretation: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
        code: interpretationCode,
        display: `${severity} depression (score ${totalScore}/27)`,
      },
      questionnaireName: 'PHQ-9',
    }),
  )

  // Item 9 specifically — suicide risk gateway
  const item9 = walkItems(items, 'q9')
  const item9Coding = getCodingAnswer(item9)
  const item9Score = item9Coding ? (getOrdinalValue(item9Coding) ?? 0) : 0

  observations.push(
    makeObservation({
      id: `phq9-item9-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead or of hurting yourself' },
      value: item9Score,
      valueType: 'integer',
      interpretation: item9Score > 0
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Positive — suicide risk screening indicated' }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Negative — no thoughts of death/self-harm endorsed' },
      questionnaireName: 'PHQ-9',
    }),
  )

  // Risk alert
  const riskAlert: RiskAlert = item9Score > 0
    ? {
        tool: 'PHQ-9',
        level: item9Score >= 2 ? 'high' : 'moderate',
        summary: `PHQ-9 Item 9 positive (score: ${item9Score}/3)`,
        detail: `Patient endorsed thoughts of death or self-harm. Total PHQ-9 score: ${totalScore}/27 (${severity}). Further suicide risk assessment recommended.`,
        suggestedAction: { label: 'Start ASQ Screening', path: '/patient/assessments/asq' },
      }
    : {
        tool: 'PHQ-9',
        level: totalScore >= 10 ? 'low' : 'none',
        summary: `PHQ-9 total: ${totalScore}/27 (${severity})`,
        detail: `Item 9 negative. No thoughts of death or self-harm endorsed. Depression severity: ${severity}.`,
      }

  return { observations, riskAlert }
}
