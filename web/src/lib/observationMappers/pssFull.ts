import { makeObservation, walkItems, getCodingAnswer, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

// PSS Full is a combined acute-care screen (public ED-SAFE PSS-3 items) whose
// site-defined risk-stratification step yields a common suicide-risk tier
// directly (like SAFE-T) — no per-instrument crosswalk.
const RISK_TIER_SYSTEM = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

const TIER_ALERT: Record<string, RiskAlert['level']> = {
  'no-risk': 'none',
  low: 'low',
  moderate: 'moderate',
  high: 'high',
  imminent: 'acute',
}

export function mapPSSFull(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  const tierCoding = getCodingAnswer(walkItems(items, 'risk-level'))
  const tierCode = tierCoding?.system === RISK_TIER_SYSTEM ? (tierCoding.code ?? 'no-risk') : 'no-risk'
  const tierDisplay = tierCoding?.display ?? tierCode
  const level = TIER_ALERT[tierCode] ?? 'none'

  observations.push(
    makeObservation({
      id: `pss-full-risk-level-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: { coding: [{ system: RISK_TIER_SYSTEM, code: tierCode, display: tierDisplay }], text: tierDisplay },
      valueType: 'codeable',
      interpretation: level === 'none'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'No risk identified' }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: tierDisplay },
      note: 'Patient Safety Screener (Full): combined ED-SAFE PSS-3 universal screen + site-defined risk stratification. Value binds directly to the shared suicide-risk tier.',
      questionnaireName: 'PSS Full',
    }),
  )

  const riskAlert: RiskAlert = level === 'none'
    ? {
        tool: 'PSS Full',
        level: 'none',
        summary: 'PSS Full: No risk identified',
        detail: 'Combined screen negative / stratified to no risk. Clinical judgment can always override.',
      }
    : {
        tool: 'PSS Full',
        level,
        summary: `PSS Full: ${tierDisplay}`,
        detail: `Combined acute-care screen stratified to ${tierDisplay}. Proceed to safety planning per the site protocol.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }

  return { observations, riskAlert }
}
