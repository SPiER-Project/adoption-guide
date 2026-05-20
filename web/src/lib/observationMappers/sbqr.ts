import { makeObservation, walkItems, getCodingAnswer, getOrdinalValue, type MapperResult, type RiskAlert } from './shared'

export function mapSBQR(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  let totalScore = 0
  for (const linkId of ['q1', 'q2', 'q3', 'q4']) {
    const item = walkItems(items, linkId)
    const coding = getCodingAnswer(item)
    if (coding) {
      const ordinal = getOrdinalValue(coding)
      if (ordinal !== undefined) totalScore += ordinal
    }
  }

  const aboveGeneralCutoff = totalScore >= 7
  const aboveInpatientCutoff = totalScore >= 8

  observations.push(
    makeObservation({
      id: `sbqr-total-${Date.now()}`,
      code: { system: 'http://snomed.info/sct', code: '225337009', display: 'Suicide risk assessment score' },
      value: totalScore,
      valueType: 'integer',
      interpretation: aboveGeneralCutoff
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: `Above general population cutoff (≥7). Score: ${totalScore}/18` }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: `Below cutoff. Score: ${totalScore}/18` },
      note: `SBQ-R total score: ${totalScore}/18. General population cutoff: ≥7 (93% sensitivity, 95% specificity). Psychiatric inpatient cutoff: ≥8 (80% sensitivity, 91% specificity).`,
      questionnaireName: 'SBQ-R',
    }),
  )

  const riskAlert: RiskAlert = aboveInpatientCutoff
    ? {
        tool: 'SBQ-R',
        level: 'high',
        summary: `SBQ-R: ${totalScore}/18 (above inpatient cutoff)`,
        detail: `Score ${totalScore} exceeds both general population (≥7) and psychiatric inpatient (≥8) cutoffs. Comprehensive suicide risk assessment and safety planning recommended.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : aboveGeneralCutoff
    ? {
        tool: 'SBQ-R',
        level: 'moderate',
        summary: `SBQ-R: ${totalScore}/18 (above general cutoff)`,
        detail: `Score ${totalScore} exceeds general population cutoff (≥7). Further assessment recommended.`,
        suggestedAction: { label: 'Start ASQ Screening', path: '/patient/assessments/asq' },
      }
    : {
        tool: 'SBQ-R',
        level: 'none',
        summary: `SBQ-R: ${totalScore}/18 (below cutoff)`,
        detail: `Score ${totalScore} is below general population cutoff of 7. No elevated risk indicated at this time.`,
      }

  return { observations, riskAlert }
}
