import { makeObservation, interpretationOf, walkItems, getCodingAnswer, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

// The CAMS Outcome/Disposition final session re-rates the six SSF Core Assessment
// vitals (same cams-ssf codes as Section A) and records a disposition. The
// disposition Observation follows the BSSA precedent: LOINC 93374-7 + a SPiER-local
// disposition value (http://thespierproject.org/fhir/CodeSystem/cams-disposition). These codes MUST
// stay in sync with ig/input/fsh/cams.fsh (CAMSDispositionCodes).
const CAMS_VITALS = [
  { linkId: '1-score', code: 'psychological-pain', display: 'Psychological Pain' },
  { linkId: '2-score', code: 'stress', display: 'Stress' },
  { linkId: '3-score', code: 'agitation', display: 'Agitation' },
  { linkId: '4-score', code: 'hopelessness', display: 'Hopelessness' },
  { linkId: '5-score', code: 'self-hate', display: 'Self-Hate' },
  { linkId: '6-score', code: 'overall-risk', display: 'Overall Risk of Suicide' },
]

const CAMS_DISPOSITION_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/cams-disposition'

export function mapCAMSOutcomeDisposition(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // Final SSF vital re-ratings (cams-ssf codes, integer 1–5), for longitudinal trending.
  let overallRisk: number | undefined
  for (const vital of CAMS_VITALS) {
    const score = walkItems(items, vital.linkId)?.answer?.[0]?.valueInteger
    if (score === undefined) continue
    if (vital.code === 'overall-risk') overallRisk = score
    observations.push(
      makeObservation({
        id: `cams-${vital.code}-${Date.now()}`,
        // See camsSectionA.ts: the authority's display, "CAMS SSF: …" as `.text`.
        code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: vital.code, display: vital.display, text: `CAMS SSF: ${vital.display}` },
        value: score,
        valueType: 'integer',
        interpretation: score >= 4
          ? interpretationOf('H', `Elevated (${score}/5)`)
          : score >= 3
          ? interpretationOf('N', `Moderate (${score}/5)`)
          : interpretationOf('L', `Low (${score}/5)`),
        note: `CAMS SSF-5 Outcome/Disposition: ${vital.display} rated ${score}/5. Local code pending LOINC submission.`,
        questionnaireName: 'CAMS SSF-5: Outcome/Disposition',
      }),
    )
  }

  // Disposition decision (BSSA-style: 93374-7 + local disposition value).
  const dispositionCoding = getCodingAnswer(walkItems(items, 'disposition'))
  const dispositionCode = dispositionCoding?.system === CAMS_DISPOSITION_SYSTEM ? dispositionCoding.code : undefined
  const dispositionDisplay = dispositionCoding?.display ?? 'Disposition not recorded'

  if (dispositionCode) {
    observations.push(
      makeObservation({
        id: `cams-outcome-disposition-${Date.now()}`,
        code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
        value: { coding: [{ system: CAMS_DISPOSITION_SYSTEM, code: dispositionCode, display: dispositionDisplay }], text: dispositionDisplay },
        valueType: 'codeable',
        interpretation: dispositionCode === 'resolved'
          ? interpretationOf('N', 'CAMS resolved')
          : interpretationOf('A', dispositionDisplay),
        note: 'CAMS SSF-5 Outcome/Disposition — final-session disposition decision.',
        questionnaireName: 'CAMS SSF-5: Outcome/Disposition',
      }),
    )
  }

  // Risk alert keyed to the disposition (episode-closure decision).
  const riskAlert: RiskAlert = dispositionCode === 'higher-level-care'
    ? {
        tool: 'CAMS Outcome/Disposition',
        level: 'high',
        summary: 'CAMS: Step up to higher level of care',
        detail: 'CAMS final-session disposition is a higher level of care (e.g., inpatient). Arrange the escalation and warm handoff.',
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : dispositionCode === 'resolved'
    ? {
        tool: 'CAMS Outcome/Disposition',
        level: 'none',
        summary: 'CAMS: Resolved — episode complete',
        detail: `CAMS resolution criteria met${overallRisk !== undefined ? ` (final overall risk ${overallRisk}/5)` : ''}. Episode closed; confirm the patient keeps their stabilization plan.`,
      }
    : {
        tool: 'CAMS Outcome/Disposition',
        level: 'moderate',
        summary: `CAMS: ${dispositionDisplay}`,
        detail: 'CAMS episode continuing or referred to adjunctive treatment. Keep the stabilization plan current and track SSF vitals across sessions.',
      }

  return { observations, riskAlert }
}
