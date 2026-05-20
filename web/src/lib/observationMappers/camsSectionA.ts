import { makeObservation, walkItems, type MapperResult, type RiskAlert } from './shared'

const CAMS_VITALS = [
  { linkId: '1-score', code: 'psychological-pain', display: 'Psychological Pain', textLinkId: '1-text' },
  { linkId: '2-score', code: 'stress', display: 'Stress', textLinkId: '2-text' },
  { linkId: '3-score', code: 'agitation', display: 'Agitation', textLinkId: '3-text' },
  { linkId: '4-score', code: 'hopelessness', display: 'Hopelessness', textLinkId: '4-text' },
  { linkId: '5-score', code: 'self-hate', display: 'Self-Hate', textLinkId: '5-text' },
  { linkId: '6-score', code: 'overall-risk', display: 'Overall Risk of Suicide', textLinkId: '6-text' },
]

export function mapCAMSSectionA(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  let maxScore = 0

  for (const vital of CAMS_VITALS) {
    const scoreItem = walkItems(items, vital.linkId)
    const score = scoreItem?.answer?.[0]?.valueInteger

    if (score !== undefined) {
      if (score > maxScore) maxScore = score

      const obs = makeObservation({
        id: `cams-${vital.code}-${Date.now()}`,
        code: {
          system: 'http://spier.org/CodeSystem/cams-ssf',
          code: vital.code,
          display: `CAMS SSF: ${vital.display}`,
        },
        value: score,
        valueType: 'integer',
        interpretation: score >= 4
          ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: `Elevated (${score}/5)` }
          : score >= 3
          ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: `Moderate (${score}/5)` }
          : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'L', display: `Low (${score}/5)` },
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
          ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: `High risk (${overallScore}/5)` }
          : overallScore >= 3
          ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: `Moderate risk (${overallScore}/5)` }
          : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'L', display: `Lower risk (${overallScore}/5)` },
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
