import { makeObservation, walkItems, getCodingAnswer, type MapperResult, type RiskAlert } from './shared'
import { ordinalForAnswer } from '../../data/questionnaires'

export function mapPHQ9(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []
  const questionnaireUrl: string | undefined = response?.questionnaire

  // Total score. Prefer a renderer-computed total-score item (SDC
  // calculatedExpression) when present; otherwise compute it by joining each
  // answer's code back to the Questionnaire answerOption ordinal (SDC weight()
  // semantics) — the renderer does not carry ordinalValue onto the answer.
  const itemLinkIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']
  const rendererTotal = walkItems(items, 'total-score')?.answer?.[0]?.valueInteger
  const totalScore = typeof rendererTotal === 'number'
    ? rendererTotal
    : itemLinkIds.reduce((sum, linkId) => {
        const coding = getCodingAnswer(walkItems(items, linkId))
        return sum + (ordinalForAnswer(questionnaireUrl, linkId, coding?.code) ?? 0)
      }, 0)

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
  const item9Coding = getCodingAnswer(walkItems(items, 'q9'))
  const item9Score = ordinalForAnswer(questionnaireUrl, 'q9', item9Coding?.code) ?? 0

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
