/**
 * observationMappers.ts
 *
 * Transforms FHIR QuestionnaireResponses into FHIR Observation resources.
 *
 * The QuestionnaireResponse is the raw form record (what was filled out).
 * The Observation is the clinical data point that triggers workflows
 * and is queryable across encounters.
 *
 * Pattern: QuestionnaireResponse → Observation(s) → Workflow Triggers
 *
 * ⚠️ DEMO ONLY — No data is persisted to a server.
 */

// ── Helpers ──

function walkItems(items: any[], linkId: string): any | undefined {
  for (const item of items) {
    if (item.linkId === linkId) return item
    if (item.item) {
      const found = walkItems(item.item, linkId)
      if (found) return found
    }
    if (item.answer) {
      for (const ans of item.answer) {
        if (ans.item) {
          const found = walkItems(ans.item, linkId)
          if (found) return found
        }
      }
    }
  }
  return undefined
}

function getOrdinalValue(answerOption: any): number | undefined {
  const ext = answerOption?.extension?.find(
    (e: any) => e.url === 'http://hl7.org/fhir/StructureDefinition/ordinalValue'
  )
  return ext?.valueDecimal
}

function getCodingAnswer(item: any): any | undefined {
  return item?.answer?.[0]?.valueCoding
}

function getBooleanAnswer(item: any): boolean | undefined {
  return item?.answer?.[0]?.valueBoolean
}

function makeObservation(params: {
  id: string
  code: { system: string; code: string; display: string }
  value: any
  valueType: 'integer' | 'codeable' | 'boolean' | 'string'
  interpretation?: { system: string; code: string; display: string }
  note?: string
  questionnaireName: string
}): any {
  const obs: any = {
    resourceType: 'Observation',
    id: params.id,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          },
        ],
      },
    ],
    code: {
      coding: [params.code],
      text: params.code.display,
    },
    subject: { reference: 'Patient/demo-patient' },
    effectiveDateTime: new Date().toISOString(),
    note: params.note
      ? [{ text: params.note }]
      : [{ text: `DEMO ONLY — Generated from ${params.questionnaireName} QuestionnaireResponse. No data persisted to server.` }],
  }

  if (params.valueType === 'integer') {
    obs.valueInteger = params.value
  } else if (params.valueType === 'codeable') {
    obs.valueCodeableConcept = params.value
  } else if (params.valueType === 'boolean') {
    obs.valueBoolean = params.value
  } else if (params.valueType === 'string') {
    obs.valueString = params.value
  }

  if (params.interpretation) {
    obs.interpretation = [
      {
        coding: [params.interpretation],
      },
    ]
  }

  return obs
}

// ── Risk level type used by dashboard ──

export interface RiskAlert {
  tool: string
  level: 'none' | 'low' | 'moderate' | 'high' | 'acute'
  summary: string
  detail: string
  suggestedAction?: {
    label: string
    path: string
  }
}

export interface MapperResult {
  observations: any[]
  riskAlert: RiskAlert
}

// ── PHQ-9 Mapper ──

export function mapPHQ9(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Calculate total score from ordinal values
  let totalScore = 0
  const itemLinkIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9']

  for (const linkId of itemLinkIds) {
    const item = walkItems(items, linkId)
    const coding = getCodingAnswer(item)
    if (coding) {
      const ordinal = getOrdinalValue(coding)
      if (ordinal !== undefined) totalScore += ordinal
    }
  }

  // Total score Observation
  let severity = 'Minimal'
  let interpretationCode = 'N'
  if (totalScore >= 20) { severity = 'Severe'; interpretationCode = 'HH' }
  else if (totalScore >= 15) { severity = 'Moderately Severe'; interpretationCode = 'H' }
  else if (totalScore >= 10) { severity = 'Moderate'; interpretationCode = 'H' }
  else if (totalScore >= 5) { severity = 'Mild'; interpretationCode = 'L' }

  observations.push(
    makeObservation({
      id: `phq9-total-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '44261-6', display: 'Patient Health Questionnaire 9 item total score' },
      value: totalScore,
      valueType: 'integer',
      interpretation: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
        code: interpretationCode,
        display: `${severity} depression (score ${totalScore}/27)`,
      },
      questionnaireName: 'PHQ-9',
    })
  )

  // Item 9 specifically — suicide risk gateway
  const item9 = walkItems(items, 'q9')
  const item9Coding = getCodingAnswer(item9)
  const item9Score = item9Coding ? (getOrdinalValue(item9Coding) ?? 0) : 0

  observations.push(
    makeObservation({
      id: `phq9-item9-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead or of hurting yourself' },
      value: item9Score,
      valueType: 'integer',
      interpretation: item9Score > 0
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Positive — suicide risk screening indicated' }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Negative — no thoughts of death/self-harm endorsed' },
      questionnaireName: 'PHQ-9',
    })
  )

  // Risk alert
  const riskAlert: RiskAlert = item9Score > 0
    ? {
        tool: 'PHQ-9',
        level: item9Score >= 2 ? 'high' : 'moderate',
        summary: `PHQ-9 Item 9 positive (score: ${item9Score}/3)`,
        detail: `Patient endorsed thoughts of death or self-harm. Total PHQ-9 score: ${totalScore}/27 (${severity}). Further suicide risk assessment recommended.`,
        suggestedAction: { label: 'Start ASQ Screening', path: '/chart/screenings/asq' },
      }
    : {
        tool: 'PHQ-9',
        level: totalScore >= 10 ? 'low' : 'none',
        summary: `PHQ-9 total: ${totalScore}/27 (${severity})`,
        detail: `Item 9 negative. No thoughts of death or self-harm endorsed. Depression severity: ${severity}.`,
      }

  return { observations, riskAlert }
}

// ── ASQ Mapper ──

export function mapASQ(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Check Q1-Q4
  const q1 = getBooleanAnswer(walkItems(items, 'q1'))
  const q2 = getBooleanAnswer(walkItems(items, 'q2'))
  const q3 = getBooleanAnswer(walkItems(items, 'q3'))
  const q4 = getBooleanAnswer(walkItems(items, 'q4'))
  const q5 = getBooleanAnswer(walkItems(items, 'q5'))

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
      code: { system: 'http://loinc.org', code: '93243-5', display: 'ASQ suicide risk screening result' },
      value: {
        coding: [{ system: 'http://spier.org/CodeSystem/asq-screening-result', code: resultCode, display: resultDisplay }],
        text: resultDisplay,
      },
      valueType: 'codeable',
      interpretation: resultCode !== 'negative'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: resultDisplay }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'N', display: 'Negative screen' },
      questionnaireName: 'ASQ',
    })
  )

  // Individual item observations for discrete tracking
  const itemMap = [
    { linkId: 'q1', code: '93267-4', display: 'Wished you were dead' },
    { linkId: 'q2', code: '93266-6', display: 'Family better off if dead' },
    { linkId: 'q3', code: '93265-8', display: 'Thoughts about killing yourself' },
    { linkId: 'q4', code: '93264-1', display: 'Ever tried to kill yourself' },
    { linkId: 'q5', code: '93263-3', display: 'Killing yourself right now (acuity)' },
  ]

  for (const { linkId, code, display } of itemMap) {
    const val = getBooleanAnswer(walkItems(items, linkId))
    if (val !== undefined) {
      observations.push(
        makeObservation({
          id: `asq-${linkId}-${Date.now()}`,
          code: { system: 'http://loinc.org', code, display },
          value: val,
          valueType: 'boolean',
          questionnaireName: 'ASQ',
        })
      )
    }
  }

  const riskAlert: RiskAlert = resultCode === 'acute-positive'
    ? {
        tool: 'ASQ',
        level: 'acute',
        summary: 'ASQ: Acute Positive Screen',
        detail: 'Patient reports active suicidal thoughts RIGHT NOW. STAT/urgent safety evaluation required. Patient cannot leave until evaluated. Keep in sight. Remove dangerous objects.',
        suggestedAction: { label: 'Start Safety Plan', path: '/chart/screenings/stanley-and-brown' },
      }
    : resultCode === 'non-acute-positive'
    ? {
        tool: 'ASQ',
        level: 'moderate',
        summary: 'ASQ: Non-Acute Positive Screen',
        detail: 'Patient endorsed suicidal ideation or history. Brief suicide safety assessment recommended to determine if full mental health evaluation is needed.',
        suggestedAction: { label: 'Start Safety Plan', path: '/chart/screenings/stanley-and-brown' },
      }
    : {
        tool: 'ASQ',
        level: 'none',
        summary: 'ASQ: Negative Screen',
        detail: 'No suicidal ideation or history endorsed. No intervention required at this time. Clinical judgment can always override a negative screen.',
      }

  return { observations, riskAlert }
}

// ── SBQ-R Mapper ──

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
    })
  )

  const riskAlert: RiskAlert = aboveInpatientCutoff
    ? {
        tool: 'SBQ-R',
        level: 'high',
        summary: `SBQ-R: ${totalScore}/18 (above inpatient cutoff)`,
        detail: `Score ${totalScore} exceeds both general population (≥7) and psychiatric inpatient (≥8) cutoffs. Comprehensive suicide risk assessment and safety planning recommended.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/chart/screenings/stanley-and-brown' },
      }
    : aboveGeneralCutoff
    ? {
        tool: 'SBQ-R',
        level: 'moderate',
        summary: `SBQ-R: ${totalScore}/18 (above general cutoff)`,
        detail: `Score ${totalScore} exceeds general population cutoff (≥7). Further assessment recommended.`,
        suggestedAction: { label: 'Start ASQ Screening', path: '/chart/screenings/asq' },
      }
    : {
        tool: 'SBQ-R',
        level: 'none',
        summary: `SBQ-R: ${totalScore}/18 (below cutoff)`,
        detail: `Score ${totalScore} is below general population cutoff of 7. No elevated risk indicated at this time.`,
      }

  return { observations, riskAlert }
}

// ── CAMS Section A Mapper (SSF-5 Patient Vitals) ──

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
      })
    )
  }

  const riskAlert: RiskAlert = maxScore >= 4
    ? {
        tool: 'CAMS Section A',
        level: 'high',
        summary: `CAMS Vitals: Elevated scores (max ${maxScore}/5)`,
        detail: `One or more CAMS SSF vitals rated 4-5/5. Stabilization planning and driver-focused treatment indicated.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/chart/screenings/cams-stabilization-plan' },
      }
    : maxScore >= 3
    ? {
        tool: 'CAMS Section A',
        level: 'moderate',
        summary: `CAMS Vitals: Moderate scores (max ${maxScore}/5)`,
        detail: `CAMS SSF vitals in moderate range. Continue CAMS framework with driver exploration.`,
        suggestedAction: { label: 'Start Therapeutic Worksheet', path: '/chart/screenings/cams-therapeutic-worksheet' },
      }
    : {
        tool: 'CAMS Section A',
        level: 'low',
        summary: `CAMS Vitals: Low scores (max ${maxScore}/5)`,
        detail: `All CAMS SSF vitals rated low (1-2/5). Consider whether resolution criteria are met.`,
      }

  return { observations, riskAlert }
}

// ── CAMS Section B Mapper (Clinician Risk Assessment → Conditions for Drivers) ──

export function mapCAMSSectionB(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Extract identified drivers (Problem #1-3)
  const driverLinkIds = [
    { descLinkId: 'driver-1-desc', typeLinkId: 'driver-1-type', label: 'Driver #1' },
    { descLinkId: 'driver-2-desc', typeLinkId: 'driver-2-type', label: 'Driver #2' },
    { descLinkId: 'driver-3-desc', typeLinkId: 'driver-3-type', label: 'Driver #3' },
  ]

  const conditions: any[] = []

  for (const driver of driverLinkIds) {
    const descItem = walkItems(items, driver.descLinkId)
    const typeItem = walkItems(items, driver.typeLinkId)
    const description = descItem?.answer?.[0]?.valueString
    const driverType = getCodingAnswer(typeItem)

    if (description) {
      conditions.push({
        resourceType: 'Condition',
        id: `cams-driver-${Date.now()}-${driver.label.replace(/\s+/g, '-')}`,
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
        },
        category: [
          {
            coding: [
              {
                system: 'http://cams-care.com/driver-category',
                code: 'suicide-driver',
                display: 'Suicide Driver',
              },
            ],
          },
          ...(driverType ? [{
            coding: [{
              system: 'http://cams-care.com/driver-type',
              code: driverType.code,
              display: driverType.display,
            }],
          }] : []),
        ],
        code: { text: description },
        subject: { reference: 'Patient/demo-patient' },
        note: [
          { text: `${driver.label}: ${description}. Type: ${driverType?.display || 'Not classified'}. Identified during CAMS SSF-5 Section B assessment. Track on problem list until resolved.` },
        ],
      })
    }
  }

  // Store conditions as observations (they're really Conditions but we store them together for the demo)
  observations.push(...conditions)

  // Check for ideation, plan, preparation
  const ideationPresent = getBooleanAnswer(walkItems(items, 'ideation-present'))
  const planPresent = getBooleanAnswer(walkItems(items, 'plan-present'))

  const driverCount = conditions.length

  const riskAlert: RiskAlert = planPresent
    ? {
        tool: 'CAMS Section B',
        level: 'high',
        summary: `CAMS: Suicidal plan identified, ${driverCount} driver(s)`,
        detail: `Clinician assessment indicates presence of suicidal plan. ${driverCount} suicide driver(s) identified for problem list. Immediate stabilization planning recommended.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/chart/screenings/cams-stabilization-plan' },
      }
    : ideationPresent
    ? {
        tool: 'CAMS Section B',
        level: 'moderate',
        summary: `CAMS: Ideation present, ${driverCount} driver(s)`,
        detail: `Clinician assessment indicates suicidal ideation without specific plan. ${driverCount} suicide driver(s) identified. Continue CAMS framework with driver-focused treatment.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/chart/screenings/cams-stabilization-plan' },
      }
    : {
        tool: 'CAMS Section B',
        level: driverCount > 0 ? 'low' : 'none',
        summary: `CAMS: ${driverCount} driver(s) identified, no active ideation/plan`,
        detail: `No active suicidal ideation or plan reported. ${driverCount} driver(s) identified for monitoring.`,
      }

  return { observations, riskAlert }
}

// ── Dispatcher ──

export function mapResponseToObservations(questionnaireName: string, response: any): MapperResult | null {
  switch (questionnaireName) {
    case 'PHQ-9':
      return mapPHQ9(response)
    case 'ASQ Screening':
      return mapASQ(response)
    case 'SBQ-R':
      return mapSBQR(response)
    case 'CAMS SSF-5: Section A':
      return mapCAMSSectionA(response)
    case 'CAMS SSF-5: Section B':
      return mapCAMSSectionB(response)
    default:
      return null
  }
}
