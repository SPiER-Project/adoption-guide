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
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
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
  // The ASQ has NO published per-item LOINC codes (verified against LOINC, June 2026:
  // the codes formerly used here did not exist, and the C-SSRS panel 93373-9 codes that
  // were on the Questionnaire items belong to C-SSRS, not ASQ). We bind to the SPiER-local
  // http://spier.org/CodeSystem/asq-item instead. These codes MUST stay in sync with the
  // Questionnaire item codes and web/scripts/check-observation-extract.mjs EXPECTED.
  const ASQ_ITEM_SYSTEM = 'http://spier.org/CodeSystem/asq-item'
  const itemMap = [
    { linkId: 'q1', code: 'wished-dead', display: 'Wished you were dead' },
    { linkId: 'q2', code: 'family-better-off-dead', display: 'Family better off if dead' },
    { linkId: 'q3', code: 'thoughts-killing-self', display: 'Thoughts about killing yourself' },
    { linkId: 'q4', code: 'ever-attempted', display: 'Ever tried to kill yourself' },
    { linkId: 'q5', code: 'acute-ideation-now', display: 'Killing yourself right now (acuity)' },
  ]

  for (const { linkId, code, display } of itemMap) {
    const coding = getCodingAnswer(walkItems(items, linkId))
    if (coding) {
      observations.push(
        makeObservation({
          id: `asq-${linkId}-${Date.now()}`,
          code: { system: ASQ_ITEM_SYSTEM, code, display },
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
