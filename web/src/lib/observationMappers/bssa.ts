import { makeObservation, walkItems, getCodingAnswer, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'

// The BSSA has NO published panel or per-item LOINC codes, so the discrete
// interview findings bind to the SPiER-local http://spier.org/CodeSystem/bssa-item
// (mirroring the ASQ asq-item pattern). These codes MUST stay in sync with the
// Questionnaire item codes (FHIR-Resources/BSSA/bssa-questionnaire.json) and the
// anti-drift check web/scripts/check-observation-extract.mjs EXPECTED list.
const BSSA_ITEM_SYSTEM = 'http://spier.org/CodeSystem/bssa-item'
const BSSA_DISPOSITION_SYSTEM = 'http://spier.org/CodeSystem/bssa-disposition'

// Disposition → risk-alert level. Mirrors the crosswalk-bssa.fsh tier mapping
// (imminent/high/moderate/no-risk) collapsed onto the RiskAlert level scale.
const DISPOSITION_ALERT: Record<string, { level: RiskAlert['level']; summary: string; detail: string; interpretation: 'A' | 'N' }> = {
  'emergency-psychiatric-evaluation': {
    level: 'acute',
    summary: 'BSSA: Emergency psychiatric evaluation',
    detail: 'Patient is at imminent risk for suicide (current suicidal thoughts). Send to the emergency department for extensive mental health evaluation. Do not leave the patient alone.',
    interpretation: 'A',
  },
  'further-evaluation-necessary': {
    level: 'high',
    summary: 'BSSA: Further evaluation of risk necessary',
    detail: 'Elevated risk but not imminent. Review the safety plan and send home with a mental health referral, preferably within 72 hours.',
    interpretation: 'A',
  },
  'non-urgent-followup': {
    level: 'moderate',
    summary: 'BSSA: Non-urgent mental health follow-up',
    detail: 'Patient might benefit from non-urgent mental health follow-up. Review the safety plan and send home with a mental health referral.',
    interpretation: 'A',
  },
  'no-intervention': {
    level: 'none',
    summary: 'BSSA: No further intervention necessary',
    detail: 'No further intervention necessary at this time. For all positive screens, follow up at the next appointment.',
    interpretation: 'N',
  },
}

// Discrete interview findings extracted as their own Observations. Each entry's
// linkId + code mirror an observationExtract-flagged item on the Questionnaire.
const CODED_ITEMS = [
  { linkId: 'current-ideation', code: 'current-ideation', display: 'Current suicidal ideation (right now)' },
  { linkId: 'has-plan', code: 'suicide-plan', display: 'Has a suicide plan' },
  { linkId: 'ever-attempt', code: 'past-suicide-attempt', display: 'History of suicide attempt' },
  { linkId: 'needs-help-to-be-safe', code: 'needs-help-to-be-safe', display: 'Reports needing help to stay safe' },
] as const

export function mapBSSA(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // ── Primary output: the clinician-selected disposition ──
  const dispositionCoding = getCodingAnswer(walkItems(items, 'disposition'))
  const dispositionCode = dispositionCoding?.code ?? 'no-intervention'
  const alert = DISPOSITION_ALERT[dispositionCode] ?? DISPOSITION_ALERT['no-intervention']
  const dispositionDisplay = dispositionCoding?.display ?? dispositionCode

  observations.push(
    makeObservation({
      id: `bssa-disposition-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: {
        coding: [{ system: BSSA_DISPOSITION_SYSTEM, code: dispositionCode, display: dispositionDisplay }],
        text: dispositionDisplay,
      },
      valueType: 'codeable',
      interpretation: alert.interpretation === 'A'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: dispositionDisplay }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'No further intervention necessary' },
      questionnaireName: 'BSSA',
    }),
  )

  // ── Discrete coded interview findings (SNOMED Yes/No etc.) ──
  for (const { linkId, code, display } of CODED_ITEMS) {
    const coding = getCodingAnswer(walkItems(items, linkId))
    if (coding) {
      observations.push(
        makeObservation({
          id: `bssa-${linkId}-${Date.now()}`,
          code: { system: BSSA_ITEM_SYSTEM, code, display },
          value: { coding: [coding], text: coding.display },
          valueType: 'codeable',
          questionnaireName: 'BSSA',
        }),
      )
    }
  }

  // ── Intent-to-die 0–10 self-rating (integer) ──
  const intentAnswer = walkItems(items, 'intent-scale')?.answer?.[0]?.valueInteger
  if (typeof intentAnswer === 'number') {
    observations.push(
      makeObservation({
        id: `bssa-intent-scale-${Date.now()}`,
        code: { system: BSSA_ITEM_SYSTEM, code: 'intent-scale', display: 'Intent to die (0–10 self-rating)' },
        value: intentAnswer,
        valueType: 'integer',
        note: `Patient self-rated intent to die: ${intentAnswer}/10 (0 = no chance, 10 = absolutely certain).`,
        questionnaireName: 'BSSA',
      }),
    )
  }

  const riskAlert: RiskAlert = {
    tool: 'BSSA',
    level: alert.level,
    summary: alert.summary,
    detail: alert.detail,
    ...(alert.level !== 'none'
      ? { suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' } }
      : {}),
  }

  return { observations, riskAlert }
}
