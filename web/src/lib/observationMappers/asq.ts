import { makeObservation, walkItems, getCodingAnswer, getYesNoBoolean, type MapperResult, type RiskAlert } from './shared'

export function mapASQ(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Q1–Q5 carry SNOMED-coded Yes/No answers (post pilot refactor). Convert to booleans for logic gating.
  const q1 = getYesNoBoolean(walkItems(items, 'q1'))
  const q2 = getYesNoBoolean(walkItems(items, 'q2'))
  const q3 = getYesNoBoolean(walkItems(items, 'q3'))
  const q4 = getYesNoBoolean(walkItems(items, 'q4'))
  const q5 = getYesNoBoolean(walkItems(items, 'q5'))

  const anyPositive = q1 || q2 || q3 || q4

  let resultCode = 'negative'
  let resultDisplay = 'Negative Screen'
  if (anyPositive && q5) {
    resultCode = 'acute-positive'
    resultDisplay = 'Acute Positive Screen (imminent/acute risk identified)'
  } else if (anyPositive) {
    resultCode = 'non-acute-positive'
    resultDisplay = 'Non-Acute Positive Screen (potential risk identified)'
  }

  observations.push(
    makeObservation({
      id: `asq-result-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93243-5', display: 'ASQ suicide risk screening result' },
      value: {
        coding: [{ system: 'http://spier.org/CodeSystem/asq-screening-result', code: resultCode, display: resultDisplay }],
        text: resultDisplay,
      },
      valueType: 'codeable',
      interpretation: resultCode !== 'negative'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: resultDisplay }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Negative screen' },
      questionnaireName: 'ASQ',
    }),
  )

  // Individual item observations for discrete tracking.
  // NOTE: LOINC bindings below are candidate/unverified. See ASQ pilot plan for reconciliation.
  const itemMap = [
    { linkId: 'q1', code: '93267-4', display: 'Wished you were dead' },
    { linkId: 'q2', code: '93266-6', display: 'Family better off if dead' },
    { linkId: 'q3', code: '93265-8', display: 'Thoughts about killing yourself' },
    { linkId: 'q4', code: '93264-1', display: 'Ever tried to kill yourself' },
    { linkId: 'q5', code: '93263-3', display: 'Killing yourself right now (acuity)' },
  ]

  for (const { linkId, code, display } of itemMap) {
    const coding = getCodingAnswer(walkItems(items, linkId))
    if (coding) {
      observations.push(
        makeObservation({
          id: `asq-${linkId}-${Date.now()}`,
          code: { system: 'http://loinc.org', code, display },
          value: { coding: [coding], text: coding.display },
          valueType: 'codeable',
          questionnaireName: 'ASQ',
        }),
      )
    }
  }

  const riskAlert: RiskAlert = resultCode === 'acute-positive'
    ? {
        tool: 'ASQ',
        level: 'acute',
        summary: 'ASQ: Acute Positive Screen',
        detail: 'Patient reports active suicidal thoughts RIGHT NOW. STAT/urgent safety evaluation required. Patient cannot leave until evaluated. Keep in sight. Remove dangerous objects.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : resultCode === 'non-acute-positive'
    ? {
        tool: 'ASQ',
        level: 'moderate',
        summary: 'ASQ: Non-Acute Positive Screen',
        detail: 'Patient endorsed suicidal ideation or history. Brief suicide safety assessment recommended to determine if full mental health evaluation is needed.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : {
        tool: 'ASQ',
        level: 'none',
        summary: 'ASQ: Negative Screen',
        detail: 'No suicidal ideation or history endorsed. No intervention required at this time. Clinical judgment can always override a negative screen.',
      }

  return { observations, riskAlert }
}
