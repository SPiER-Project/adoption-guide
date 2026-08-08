import { makeObservation, interpretationOf, walkItems, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

// Each entry also carried a `textLinkId` ('1-text' … '6-text') that nothing ever
// read. '6-text' did not even exist in cams-ssf5-section-a.json — unlike ratings
// 1–5, the SSF-5's overall-risk item has rating anchors rather than a "what I
// mean by this is…" prompt. Six hand-duplicated linkIds with no consumer is the
// drift risk CLAUDE.md warns about, so they are gone; the score↔text pairing is
// recoverable from the Questionnaire's own naming.
const CAMS_VITALS = [
  { linkId: '1-score', code: 'psychological-pain', display: 'Psychological Pain' },
  { linkId: '2-score', code: 'stress', display: 'Stress' },
  { linkId: '3-score', code: 'agitation', display: 'Agitation' },
  { linkId: '4-score', code: 'hopelessness', display: 'Hopelessness' },
  { linkId: '5-score', code: 'self-hate', display: 'Self-Hate' },
  { linkId: '6-score', code: 'overall-risk', display: 'Overall Risk of Suicide' },
]

export function mapCAMSSectionA(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  let maxScore = 0

  for (const vital of CAMS_VITALS) {
    const scoreItem = walkItems(items, vital.linkId)
    const score = scoreItem?.answer?.[0]?.valueInteger

    if (score !== undefined) {
      if (score > maxScore) maxScore = score

      const obs = makeObservation({
        id: `cams-${vital.code}-${Date.now()}`,
        // `display` is the cams-ssf CodeSystem's own wording (ig/input/fsh/cams.fsh)
        // — CAMS_VITALS[].display is kept identical to it on purpose. The "CAMS
        // SSF:" prefix a reader wants is `.text`, not a redefinition of the code.
        code: {
          system: 'http://spier.org/CodeSystem/cams-ssf',
          code: vital.code,
          display: vital.display,
          text: `CAMS SSF: ${vital.display}`,
        },
        value: score,
        valueType: 'integer',
        interpretation: score >= 4
          ? interpretationOf('H', `Elevated (${score}/5)`)
          : score >= 3
          ? interpretationOf('N', `Moderate (${score}/5)`)
          : interpretationOf('L', `Low (${score}/5)`),
        note: `CAMS SSF-5 Section A: ${vital.display} rated ${score}/5 by patient. Code system is local (pending LOINC submission). EHRs should track these longitudinally across sessions to show trending.`,
        questionnaireName: 'CAMS SSF-5: Section A',
      })

      observations.push(obs)
    }
  }

  // Overall risk observation using the LOINC code that does exist
  const overallRisk = walkItems(items, '6-score')
  const overallScore = overallRisk?.answer?.[0]?.valueInteger
  if (overallScore !== undefined) {
    observations.push(
      makeObservation({
        id: `cams-risk-level-${Date.now()}`,
        code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
        value: overallScore,
        valueType: 'integer',
        interpretation: overallScore >= 4
          ? interpretationOf('H', `High risk (${overallScore}/5)`)
          : overallScore >= 3
          ? interpretationOf('N', `Moderate risk (${overallScore}/5)`)
          : interpretationOf('L', `Lower risk (${overallScore}/5)`),
        questionnaireName: 'CAMS SSF-5: Section A',
      }),
    )
  }

  const riskAlert: RiskAlert = maxScore >= 4
    ? {
        tool: 'CAMS Section A',
        level: 'high',
        summary: `CAMS Vitals: Elevated scores (max ${maxScore}/5)`,
        detail: `One or more CAMS SSF vitals rated 4-5/5. Stabilization planning and driver-focused treatment indicated.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/patient/assessments/cams-stabilization-plan' },
      }
    : maxScore >= 3
    ? {
        tool: 'CAMS Section A',
        level: 'moderate',
        summary: `CAMS Vitals: Moderate scores (max ${maxScore}/5)`,
        detail: `CAMS SSF vitals in moderate range. Continue CAMS framework with driver exploration.`,
        suggestedAction: { label: 'Start Therapeutic Worksheet', path: '/patient/assessments/cams-therapeutic-worksheet' },
      }
    : {
        tool: 'CAMS Section A',
        level: 'low',
        summary: `CAMS Vitals: Low scores (max ${maxScore}/5)`,
        detail: `All CAMS SSF vitals rated low (1-2/5). Consider whether resolution criteria are met.`,
      }

  return { observations, riskAlert }
}
