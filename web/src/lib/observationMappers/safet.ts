import { makeObservation, walkItems, getCodingAnswer, getYesNoBoolean, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

// SAFE-T lands DIRECTLY on the concept layer: the risk-level answer is already a
// common suicide-risk tier code (http://spier.org/CodeSystem/spier-suicide-risk-tier),
// so the derived Observation's value is that tier — no per-instrument crosswalk.
const RISK_TIER_SYSTEM = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

// Shared tier → RiskAlert level. SAFE-T's canonical tiers are low/moderate/high;
// no-risk/imminent are handled too since the value binds to the full tier ValueSet.
const TIER_ALERT: Record<string, RiskAlert['level']> = {
  'no-risk': 'none',
  low: 'low',
  moderate: 'moderate',
  high: 'high',
  imminent: 'acute',
}

/** Read a free-text answer for a linkId, if present. */
function textAnswer(items: QuestionnaireResponseResource['item'], linkId: string): string | undefined {
  return walkItems(items ?? [], linkId)?.answer?.[0]?.valueString
}

export function mapSAFET(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  const tierCoding = getCodingAnswer(walkItems(items, 'risk-level'))
  const tierCode = tierCoding?.system === RISK_TIER_SYSTEM ? (tierCoding.code ?? 'no-risk') : 'no-risk'
  const tierDisplay = tierCoding?.display ?? tierCode
  const level = TIER_ALERT[tierCode] ?? 'none'

  // Fold the documented rationale, clinical-judgment override, and intervention
  // into the Observation note so the formulation's reasoning travels with the result.
  const rationale = textAnswer(items, 'risk-rationale')
  const intervention = textAnswer(items, 'intervention')
  const override = getYesNoBoolean(walkItems(items, 'clinical-judgment-override'))
  const overrideRationale = textAnswer(items, 'override-rationale')
  const noteParts: string[] = []
  if (rationale) noteParts.push(`Rationale: ${rationale}`)
  if (override === true) noteParts.push(`Clinical-judgment override applied${overrideRationale ? `: ${overrideRationale}` : ''}.`)
  if (intervention) noteParts.push(`Intervention/triage: ${intervention}`)
  const note = noteParts.length
    ? noteParts.join(' ')
    : `DEMO ONLY — Generated from SAFE-T QuestionnaireResponse. No data persisted to server.`

  observations.push(
    makeObservation({
      id: `safet-risk-level-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: {
        coding: [{ system: RISK_TIER_SYSTEM, code: tierCode, display: tierDisplay }],
        text: tierDisplay,
      },
      valueType: 'codeable',
      interpretation: level === 'none'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'No risk identified' }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: tierDisplay },
      note,
      questionnaireName: 'SAFE-T',
    }),
  )

  const riskAlert: RiskAlert = {
    tool: 'SAFE-T',
    level,
    summary: `SAFE-T: ${tierDisplay}`,
    detail: level === 'none'
      ? 'No suicide risk identified on the SAFE-T formulation. Clinical judgment can always override.'
      : `SAFE-T risk level: ${tierDisplay}. SAFE-T calls for a safety plan at low, moderate, and high risk. Document rationale, treatment plan, means-safety counseling, and follow-up.`,
    // SAFE-T: develop a safety plan for all individuals at low, moderate, and high risk.
    ...(level !== 'none'
      ? { suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' } }
      : {}),
  }

  return { observations, riskAlert }
}
