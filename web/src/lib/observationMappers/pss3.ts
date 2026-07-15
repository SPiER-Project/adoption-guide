import { makeObservation, walkItems, getCodingAnswer, getYesNoBoolean, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

// The PSS-3 has NO published panel or per-item LOINC codes, so the three
// screening items bind to the SPiER-local http://spier.org/CodeSystem/pss3-item
// (mirroring the ASQ asq-item pattern). These codes MUST stay in sync with the
// Questionnaire item codes (FHIR-Resources/PSS-3/pss3-questionnaire.json) and the
// anti-drift check web/scripts/check-observation-extract.mjs EXPECTED list.
const PSS3_ITEM_SYSTEM = 'http://spier.org/CodeSystem/pss3-item'
const PSS3_RESULT_SYSTEM = 'http://spier.org/CodeSystem/pss3-result'
const PSS3_RECENCY_SYSTEM = 'http://spier.org/CodeSystem/pss3-attempt-recency'

// Item 3a recency codes that count as a RECENT attempt (within ~6 months) and
// therefore drive a positive screen. "more-than-6-months" does not.
const RECENT_ATTEMPT_CODES = new Set(['within-24-hours', 'within-last-month', 'between-1-and-6-months'])

// Discrete literal item captures (mirror the observationExtract-flagged items).
const CODED_ITEMS = [
  { linkId: 'q1-depression', code: 'depression-2wk', display: 'Depression in the past two weeks' },
  { linkId: 'q2-ideation', code: 'active-ideation-2wk', display: 'Active suicidal ideation in the past two weeks' },
  { linkId: 'q3-lifetime-attempt', code: 'lifetime-attempt', display: 'Lifetime suicide attempt' },
] as const

export function mapPSS3(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // ── Compute the binary result from items 2 and 3a ──
  // Positive = active ideation in the past two weeks (item 2 'yes') OR a suicide
  // attempt within the last ~6 months (item 3a recency). Item 1 (depression) is a
  // lead-in and is NOT counted toward the suicide-risk result.
  const activeIdeation = getYesNoBoolean(walkItems(items, 'q2-ideation'))
  const recencyCoding = getCodingAnswer(walkItems(items, 'q3a-recency'))
  const recentAttempt = recencyCoding?.system === PSS3_RECENCY_SYSTEM && RECENT_ATTEMPT_CODES.has(recencyCoding.code ?? '')

  const positive = activeIdeation === true || recentAttempt
  const resultCode = positive ? 'positive' : 'negative'
  const resultDisplay = positive ? 'Positive Screen (suicide risk)' : 'Negative Screen'

  observations.push(
    makeObservation({
      id: `pss3-result-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: {
        coding: [{ system: PSS3_RESULT_SYSTEM, code: resultCode, display: resultDisplay }],
        text: resultDisplay,
      },
      valueType: 'codeable',
      interpretation: positive
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: resultDisplay }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Negative screen' },
      questionnaireName: 'PSS-3',
    }),
  )

  // ── Discrete coded item captures (SNOMED Yes/No or non-response coding) ──
  for (const { linkId, code, display } of CODED_ITEMS) {
    const coding = getCodingAnswer(walkItems(items, linkId))
    if (coding) {
      observations.push(
        makeObservation({
          id: `pss3-${linkId}-${Date.now()}`,
          code: { system: PSS3_ITEM_SYSTEM, code, display },
          value: { coding: [coding], text: coding.display },
          valueType: 'codeable',
          questionnaireName: 'PSS-3',
        }),
      )
    }
  }

  const riskAlert: RiskAlert = positive
    ? {
        tool: 'PSS-3',
        level: 'moderate',
        summary: 'PSS-3: Positive Screen',
        detail: 'Patient endorsed active suicidal ideation in the past two weeks or a suicide attempt within the last six months. Administer a secondary risk-stratification assessment (Clarify Risk) to guide the risk-mitigation plan.',
        suggestedAction: { label: 'Clarify risk (C-SSRS)', path: '/patient/assessments/cssrs-full' },
      }
    : {
        tool: 'PSS-3',
        level: 'none',
        summary: 'PSS-3: Negative Screen',
        detail: 'No active suicidal ideation in the past two weeks and no suicide attempt within the last six months. No further screening action required at this time. Clinical judgment can always override a negative screen.',
      }

  return { observations, riskAlert }
}
