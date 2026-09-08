import { makeObservation, interpretationOf, walkItems, getCodingAnswer, getYesNoBoolean, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

export function mapASQ(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

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
        coding: [{ system: 'http://thespierproject.org/fhir/CodeSystem/asq-screening-result', code: resultCode, display: resultDisplay }],
        text: resultDisplay,
      },
      valueType: 'codeable',
      interpretation: resultCode !== 'negative'
        ? interpretationOf('A', resultDisplay)
        : interpretationOf('N', 'Negative screen'),
      questionnaireName: 'ASQ',
    }),
  )

  // Individual item observations for discrete tracking.
  // LOINC 2.83 published the ASQ panel (115564-7) and a code per item, so these bind
  // to LOINC. Before that the ASQ had none and these were SPiER-local `asq-item` codes
  // — a deliberate stand-in recorded in ig/input/fsh/asq.fsh, not an oversight, and the
  // second such stand-in the ASQ has had: #220 removed an earlier set that were either
  // C-SSRS panel members or nonexistent. The displays below are LOINC's own, which is
  // what `check:codings` compares against; they read as questions rather than findings
  // because that is how LOINC names them. MUST stay in sync with the Questionnaire item
  // codes and web/scripts/check-observation-extract.mjs EXPECTED.
  const LOINC = 'http://loinc.org'
  const itemMap = [
    { linkId: 'q1', code: '115566-2', display: 'In the past few weeks have you wished you were dead' },
    { linkId: 'q2', code: '115567-0', display: 'In the past few weeks have you felt that you or your family would be better off if you were dead' },
    { linkId: 'q3', code: '115568-8', display: 'In the past week have you been having thoughts about killing yourself' },
    { linkId: 'q4', code: '115569-6', display: 'Have you ever tried to kill yourself' },
    { linkId: 'q5', code: '115571-2', display: 'Are you having thoughts of killing yourself right now' },
  ]

  for (const { linkId, code, display } of itemMap) {
    const coding = getCodingAnswer(walkItems(items, linkId))
    if (coding) {
      observations.push(
        makeObservation({
          id: `asq-${linkId}-${Date.now()}`,
          code: { system: LOINC, code, display },
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
