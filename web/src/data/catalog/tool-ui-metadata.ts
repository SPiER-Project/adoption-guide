// React-only metadata that overlays the FHIR-derived Tool catalog.
//
// Anything in this file is UI/demo concern (button copy, badge styling,
// adoption-rubric maturity targets, inline example resources). The clinical
// fields (id/name/purpose/stageId/questionnaireUrl) come from FHIR
// ActivityDefinitions in ig/input/fsh/ and are wired up in tools.ts.
//
// Keyed by Tool.id ('TL-001'…). When an ActivityDefinition or stub exists
// without a matching entry here, that tool gets default UI metadata.

export type InclusionStatus = 'core' | 'optional' | 'future'

/**
 * The kind of FHIR artifact a tool produces. Drives how a tool is recorded and
 * how its output binds to the pathway. Most tools are `questionnaire`
 * (QuestionnaireResponse); stages 5-8 introduce non-Questionnaire workflows.
 */
export type WorkflowType =
  | 'questionnaire'
  | 'communication'
  | 'appointment'
  | 'observation'
  | 'measure'
  | 'workflow'
export type BadgeVariant =
  | 'screening'
  | 'assessment'
  | 'safety'
  | 'cams'
  | 'handoff'
  | 'followup'
  | 'monitoring'
export type MaturityLevel = 0 | 1 | 2 | 3

export interface LaunchAction {
  label: string
  path: string
  variant?: 'primary' | 'secondary'
}

export interface RecordingResource {
  type: string
  description: string
  when: string
}

export interface RecordingPattern {
  resources: RecordingResource[]
  workflowTrigger?: string
}

export interface FhirExample {
  title: string
  resource: Record<string, unknown>
}

export interface ToolUiMetadata {
  shortName?: string
  inclusionStatus: InclusionStatus
  settings: string[]
  badge: { label: string; variant: BadgeVariant }
  launchActions: LaunchAction[]
  tags?: string[]
  targetMaturity: {
    electronic: MaturityLevel
    writeback: MaturityLevel
    triggering: MaturityLevel
  }
  recordingPattern?: RecordingPattern
  fhirExamples?: FhirExample[]
}

// ─────────────────────────────────────────────────────────────
// Inline FHIR example resources
// (TODO: replace with reads from web/src/data/fhir/Observation-Example*.json
//  once a viewer page lists IG instances directly.)
// ─────────────────────────────────────────────────────────────

const PHQ9_ITEM9_EXAMPLE = {
  resourceType: 'Observation',
  id: 'phq9-item9-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T10:30:00Z',
  valueInteger: 2,
  // `display` is HL7's for code A; the instrument's own wording goes in `text`.
  // These payloads are what the guide shows a reader as "this is the shape SPiER
  // emits", so a drifted display here teaches the defect as well as shipping it.
  interpretation: [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }],
    text: 'Positive — suicide risk screening indicated',
  }],
}

const ASQ_RESULT_EXAMPLE = {
  resourceType: 'Observation',
  id: 'asq-result-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T10:35:00Z',
  valueCodeableConcept: {
    coding: [{ system: 'http://spier.org/CodeSystem/asq-screening-result', code: 'non-acute-positive', display: 'Non-Acute Positive Screen' }],
  },
}

const BSSA_DISPOSITION_EXAMPLE = {
  resourceType: 'Observation',
  id: 'bssa-disposition-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-07-15T14:20:00Z',
  valueCodeableConcept: {
    coding: [{ system: 'http://spier.org/CodeSystem/bssa-disposition', code: 'further-evaluation-necessary', display: 'Further evaluation of risk is necessary' }],
  },
  interpretation: [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }],
    text: 'Further evaluation of risk is necessary',
  }],
}

const PSS3_RESULT_EXAMPLE = {
  resourceType: 'Observation',
  id: 'pss3-result-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-07-15T09:10:00Z',
  valueCodeableConcept: {
    coding: [{ system: 'http://spier.org/CodeSystem/pss3-result', code: 'positive', display: 'Positive Screen (suicide risk)' }],
  },
  interpretation: [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }],
    text: 'Positive suicide-risk screen',
  }],
}

const SAFET_RISK_LEVEL_EXAMPLE = {
  resourceType: 'Observation',
  id: 'safet-risk-level-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-07-15T15:05:00Z',
  valueCodeableConcept: {
    coding: [{ system: 'http://spier.org/CodeSystem/spier-suicide-risk-tier', code: 'moderate', display: 'Moderate risk' }],
  },
  interpretation: [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }],
    text: 'Moderate risk',
  }],
  note: [{ text: 'Value binds directly to the shared suicide-risk tier — no per-instrument crosswalk. Rationale: ideation with plan but no intent; multiple risk factors, few protective factors.' }],
}

const CSSRS_SLV_EXAMPLE = {
  resourceType: 'Observation',
  id: 'cssrs-since-last-contact-risk-level-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-07-15T12:00:00Z',
  valueCodeableConcept: {
    // Dual-coded: SPiER-local C-SSRS tier + matching LOINC answer (LL465-6) for HL7 interop.
    coding: [
      { system: 'http://spier.org/CodeSystem/cssrs-risk-level', code: 'moderate', display: 'Moderate' },
      { system: 'http://loinc.org', code: 'LA6751-7', display: 'Moderate' },
    ],
    text: 'Moderate Risk — ideation with method, no intent (since last visit)',
  },
  interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }] }],
}

const CAMS_VITAL_EXAMPLE = {
  resourceType: 'Observation',
  id: 'cams-psychological-pain-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: {
    coding: [{ system: 'http://spier.org/CodeSystem/cams-ssf', code: 'psychological-pain', display: 'Psychological Pain' }],
    text: 'CAMS SSF: Psychological Pain — local code pending LOINC submission',
  },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T11:00:00Z',
  valueInteger: 4,
  interpretation: [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: 'High' }],
    text: 'Elevated (4/5)',
  }],
  note: [{ text: 'Track longitudinally across CAMS sessions to show trending.' }],
}

const CAMS_DRIVER_EXAMPLE = {
  resourceType: 'Condition',
  id: 'cams-driver-example',
  clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
  category: [
    { coding: [{ system: 'http://spier.org/CodeSystem/cams-driver-category', code: 'suicide-driver', display: 'Suicide Driver' }] },
    { coding: [{ system: 'http://spier.org/CodeSystem/cams-driver-type', code: 'direct', display: 'Direct Driver' }] },
  ],
  code: { text: 'Relationship conflict with spouse — feeling trapped and hopeless' },
  subject: { reference: 'Patient/123' },
  note: [{ text: 'Track on problem list until resolved. Update clinicalStatus to "resolved" at CAMS disposition.' }],
}

// ─────────────────────────────────────────────────────────────
// UI metadata per tool id
// ─────────────────────────────────────────────────────────────

export const TOOL_UI_METADATA: Record<string, ToolUiMetadata> = {
  // ── Identify Possible Risk ──
  'TL-001': {
    shortName: 'ASQ',
    inclusionStatus: 'core',
    settings: ['medical', 'ambulatory', 'acute care'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch ASQ Screening', path: '/patient/assessments/asq' }],
    tags: ['~20 seconds', 'NIMH public domain', 'enableWhen logic'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'All 5 items (Q1–Q4 + acuity Q5)', when: 'On submit' },
        { type: 'Observation', description: 'Screening result (negative / non-acute-positive / acute-positive)', when: 'Extracted from response' },
        { type: 'Observation', description: 'Individual item responses (SPiER-local asq-item codes; ASQ has no per-item LOINC)', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Acute positive → STAT safety evaluation + safety plan. Non-acute positive → brief safety assessment.',
    },
    fhirExamples: [{ title: 'ASQ → Observation (screening result)', resource: ASQ_RESULT_EXAMPLE }],
  },
  'TL-002': {
    shortName: 'PHQ-9',
    inclusionStatus: 'core',
    settings: ['ambulatory', 'primary care', 'medical'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch PHQ-9', path: '/patient/assessments/phq-9' }],
    tags: ['9 items', 'LOINC coded', 'public domain'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'Raw form data — all 9 item responses', when: 'On submit' },
        { type: 'Observation', description: 'Total score (LOINC 44261-6) with severity interpretation', when: 'Extracted from response' },
        { type: 'Observation', description: 'Item 9 score (LOINC 44260-8) — suicide risk gateway flag', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Item 9 score ≥ 1 → recommend ASQ or C-SSRS follow-up',
    },
    fhirExamples: [{ title: 'PHQ-9 Item 9 → Observation (suicide risk gateway)', resource: PHQ9_ITEM9_EXAMPLE }],
  },
  'TL-003': {
    shortName: 'C-SSRS Screener',
    inclusionStatus: 'core',
    settings: ['acute care', 'ED', 'inpatient', 'ambulatory', 'behavioral health'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch C-SSRS Screener', path: '/patient/assessments/cssrs-screener' }],
    tags: ['LOINC coded', '3-tier risk'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  'TL-011': {
    shortName: 'PSS-3',
    inclusionStatus: 'optional',
    settings: ['acute care', 'ED'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch PSS-3', path: '/patient/assessments/pss-3' }],
    tags: ['3 items', 'ED-SAFE public tool', 'universal screen'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'All 3 items (depression, active ideation, lifetime attempt + recency)', when: 'On submit' },
        { type: 'Observation', description: 'Binary suicide-risk result (LOINC 93374-7) — positive / negative', when: 'Computed from response' },
        { type: 'Observation (x3)', description: 'Individual item responses (SPiER-local pss3-item codes; PSS-3 has no per-item LOINC)', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Active ideation (item 2) or attempt within 6 months (item 3a) → positive → Clarify Risk (secondary stratification).',
    },
    fhirExamples: [{ title: 'PSS-3 → Observation (screening result)', resource: PSS3_RESULT_EXAMPLE }],
  },
  'TL-014': {
    shortName: 'PSS / SRS Full',
    inclusionStatus: 'optional',
    settings: ['acute care', 'ED'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch PSS Full', path: '/patient/assessments/pss-full' }],
    tags: ['combined screen + stratify', 'PSS-3 items + site tier', 'lands on concept layer'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'PSS-3 universal screen (3 items + recency) + site-defined stratification', when: 'On submit' },
        { type: 'Observation', description: 'Risk level (LOINC 93374-7) — value is a shared suicide-risk tier (low/moderate/high)', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Positive screen → site stratifies to a tier → safety planning per local protocol.',
    },
  },
  'TL-025': {
    shortName: 'SBQ-R',
    inclusionStatus: 'optional',
    settings: ['ambulatory', 'behavioral health'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch SBQ-R', path: '/patient/assessments/sbq-r' }],
    tags: ['4 items', 'ordinalValue scoring', 'validated cutoffs'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'All 4 items with ordinal scoring', when: 'On submit' },
        { type: 'Observation', description: 'Total score (3–18) with cutoff comparison', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Score ≥ 7 (general) or ≥ 8 (inpatient) → further assessment',
    },
  },

  'TL-027': {
    shortName: 'C-SSRS Pediatric',
    inclusionStatus: 'optional',
    settings: ['pediatrics', 'ED', 'ambulatory'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch C-SSRS Pediatric', path: '/patient/assessments/cssrs-pediatric' }],
    tags: ['pediatric/adolescent', 'shared risk-level profile', 'registration'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: '6-item C-SSRS screener (pediatric/adolescent administration)', when: 'On submit' },
        { type: 'Observation', description: 'Derived suicide risk level (LOINC 93374-7) — none/low/moderate/high (shared SPiERCSSRSRiskLevel profile)', when: 'Computed from response' },
        { type: 'Observation (x6)', description: 'Individual ideation/behavior items (per-item LOINC)', when: 'Extracted from response' },
      ],
      workflowTrigger: 'High/moderate → safety planning; involve parent/guardian per protocol for youth.',
    },
    fhirExamples: [{ title: 'C-SSRS Pediatric → Observation (risk level)', resource: CSSRS_SLV_EXAMPLE }],
  },
  'TL-026': {
    shortName: 'Risk Workflow Trigger',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Workflow', variant: 'monitoring' },
    launchActions: [],
    tags: ['positive-screen flag', 'automatic routing'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },

  // ── Clarify Risk ──
  'TL-004': {
    shortName: 'C-SSRS Full',
    inclusionStatus: 'core',
    settings: ['acute care', 'ED', 'inpatient', 'ambulatory', 'behavioral health'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [{ label: 'Launch C-SSRS Full', path: '/patient/assessments/cssrs-full' }],
    tags: ['LOINC coded', '5-level hierarchy', 'risk stratification'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  'TL-019': {
    shortName: 'C-SSRS Since Last',
    inclusionStatus: 'core',
    settings: ['ambulatory', 'behavioral health'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [{ label: 'Launch C-SSRS Since Last Visit', path: '/patient/assessments/cssrs-since-last-contact' }],
    tags: ['interval reassessment', 'shared risk-level profile', 'registration'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: '6-item C-SSRS scoped to the interval since the prior contact', when: 'On submit' },
        { type: 'Observation', description: 'Derived suicide risk level (LOINC 93374-7) — none/low/moderate/high (shared SPiERCSSRSRiskLevel profile)', when: 'Computed from response' },
        { type: 'Observation (x6)', description: 'Individual ideation/behavior items (per-item LOINC)', when: 'Extracted from response' },
      ],
      workflowTrigger: 'High/moderate → safety planning; reassessment updates the current risk workflow.',
    },
    fhirExamples: [{ title: 'C-SSRS Since Last Visit → Observation (risk level)', resource: CSSRS_SLV_EXAMPLE }],
  },
  'TL-005': {
    shortName: 'BSSA',
    inclusionStatus: 'core',
    settings: ['medical', 'ambulatory', 'acute care'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [{ label: 'Launch BSSA', path: '/patient/assessments/bssa' }],
    tags: ['NIMH public domain', 'disposition-oriented', 'post-positive-screen'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'Structured interview — frequency, plan/intent, past behavior, symptoms, supports, safety plan', when: 'On submit' },
        { type: 'Observation', description: 'Disposition result (LOINC 93374-7) — one of four dispositions', when: 'Extracted from response' },
        { type: 'Observation (x1–5)', description: 'Discrete findings: current ideation, plan, intent 0–10, prior attempt, needs-help-to-be-safe (SPiER-local bssa-item codes)', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Emergency psychiatric evaluation → STAT eval, do not leave alone. Further evaluation / non-urgent follow-up → safety plan + mental health referral.',
    },
    fhirExamples: [{ title: 'BSSA → Observation (disposition)', resource: BSSA_DISPOSITION_EXAMPLE }],
  },
  'TL-020': {
    shortName: 'CAMS SSF-5',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [
      // One catalogued CAMS SSF-5 tool: first-session Sections A/B and interim
      // re-ratings all live here (the interim session reuses the Section A
      // questionnaire). `?tool=` still stamps the launching tool's stage onto
      // the submitted QR via QuestionnaireView → stampLaunchStage.
      { label: 'SSF-5 Section A (Patient)', path: '/patient/assessments/cams-section-a?tool=TL-020', variant: 'secondary' },
      { label: 'SSF-5 Section B (Clinician)', path: '/patient/assessments/cams-section-b', variant: 'secondary' },
      { label: 'SSF-5 Outcome/Disposition (Final)', path: '/patient/assessments/cams-outcome-disposition?tool=TL-020', variant: 'secondary' },
    ],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'SSF-5 Section A — 6 vital ratings + qualitative text', when: 'On submit' },
        { type: 'Observation (x6)', description: 'Individual vital scores (pain, stress, agitation, hopelessness, self-hate, overall risk)', when: 'Extracted from response' },
        { type: 'Observation', description: 'Overall suicide risk level (LOINC 93374-7)', when: 'Extracted from response' },
        { type: 'QuestionnaireResponse', description: 'SSF-5 Section B — ideation, plan, preparation, history, drivers', when: 'On submit (Section B)' },
        { type: 'Condition (x1-3)', description: 'Suicide drivers added to problem list (clinicalStatus: active)', when: 'Extracted from Section B' },
        { type: 'Observation', description: 'Final-session disposition (continue / resolved / refer / higher level of care) — SPiERCAMSOutcomeDisposition', when: 'On submit (Outcome/Disposition)' },
      ],
      workflowTrigger: 'Any vital ≥ 4 → stabilization planning. Drivers tracked until resolved. Final session records the episode disposition.',
    },
    fhirExamples: [
      { title: 'CAMS Section A → Observation (psychological pain vital)', resource: CAMS_VITAL_EXAMPLE },
      { title: 'CAMS Section B → Condition (suicide driver on problem list)', resource: CAMS_DRIVER_EXAMPLE },
    ],
  },

  'TL-028': {
    shortName: 'CARS-S',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'ambulatory'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    tags: ['cultural risk & protective factors'],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 1 },
  },
  'TL-029': {
    shortName: 'Local Assessment',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    tags: ['site-defined form', 'structured capture'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },

  // ── Define the Risk Picture ──
  'TL-006': {
    shortName: 'SAFE-T',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [{ label: 'Launch SAFE-T', path: '/patient/assessments/safe-t' }],
    tags: ['SAMHSA public resource', '5-step formulation', 'lands on concept layer'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'Five steps: risk factors, protective factors, suicide inquiry, risk level + intervention, documentation', when: 'On submit' },
        { type: 'Observation', description: 'Risk-level result (LOINC 93374-7) — value is a shared suicide-risk tier (low/moderate/high); rationale + override in note', when: 'Extracted from response' },
      ],
      workflowTrigger: 'Safety plan developed at low, moderate, and high risk. High → emergency psychiatric evaluation in a secure setting.',
    },
    fhirExamples: [{ title: 'SAFE-T → Observation (risk level on the shared tier)', resource: SAFET_RISK_LEVEL_EXAMPLE }],
  },
  'TL-024': {
    shortName: 'CAMS Worksheet',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [{ label: 'Launch Therapeutic Worksheet', path: '/patient/assessments/cams-therapeutic-worksheet' }],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },

  // ── Document Safety Actions ──
  'TL-007': {
    shortName: 'Stanley-Brown',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [{ label: 'Launch Safety Plan', path: '/patient/assessments/stanley-and-brown' }],
    tags: ['7-step plan', 'LOINC coded', 'CarePlan output'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: '7-step safety plan responses', when: 'On submit' },
        { type: 'CarePlan', description: 'FHIR CarePlan with LOINC-coded activities (hybrid model)', when: 'Generated from response' },
      ],
      workflowTrigger: 'CarePlan persists on chart. Reviewed at follow-up encounters.',
    },
  },
  'TL-008': {
    // Lethal means safety counseling / means safety actions — absorbs the
    // former standalone CALM protocol entry (TL-016).
    shortName: 'Means Safety',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [{ label: 'Record means safety counseling', path: '/patient/workflow/lethal-means' }],
    tags: ['means-safety actions', 'CALM protocol', 'Procedure + Observations'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'Procedure', description: 'Lethal means safety counseling provided (SPiERLethalMeansCounseling)', when: 'On counseling' },
        { type: 'Observation (x1-n)', description: 'Per-method means-safety action (method → action taken; SPiERMeansSafetyAction) — firearm, medication, sharps, ligature, etc.', when: 'Per means addressed' },
      ],
      workflowTrigger: 'Documented, reportable means-safety actions; status final = completed, preliminary = agreed/planned.',
    },
  },
  'TL-021': {
    shortName: 'CAMS Stabilization',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [{ label: 'Launch Stabilization Plan', path: '/patient/assessments/cams-stabilization-plan' }],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'Stabilization plan responses', when: 'On submit' },
        { type: 'CarePlan', description: 'Stabilization CarePlan with lethal means, coping strategies, support network', when: 'Generated from response' },
      ],
      workflowTrigger: 'CarePlan updated at start of every CAMS session.',
    },
  },
  'TL-013': {
    // Patient-facing crisis resources / coping supports (988, Crisis Text
    // Line, Now Matters Now, safety-plan copy).
    shortName: 'Crisis Resources',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [{ label: 'Record Crisis Resources Shared', path: '/patient/workflow/crisis-resources' }],
    tags: ['988', 'Crisis Text Line', 'Now Matters Now'],
    targetMaturity: { electronic: 3, writeback: 2, triggering: 1 },
    recordingPattern: {
      resources: [
        { type: 'Communication', description: 'Crisis resources shared (SPiERCrisisResourcesShared) — payloads coded via the crisis-resource ValueSet; sent timestamp; stage-tagged', when: 'On sharing' },
      ],
      workflowTrigger: 'Ensures the patient leaves with documented crisis-support access.',
    },
  },
  'TL-015': {
    shortName: 'CRP',
    inclusionStatus: 'optional',
    settings: ['military', 'VA', 'behavioral health'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [{ label: 'Author Crisis Response Plan', path: '/patient/assessments/crisis-response-plan' }],
    tags: ['Bryan & Rudd', 'CarePlan output', '5 sections'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'Five CRP sections (warning signs, coping, reasons for living, social support, professional/crisis support)', when: 'On submit' },
        { type: 'CarePlan', description: 'Crisis Response Plan (SPiERCrisisResponsePlan) — one activity per section; LOINC reused from the Stanley-Brown panel', when: 'Generated from response' },
      ],
      workflowTrigger: 'An alternative/complement to the Stanley-Brown Safety Plan at Document Safety Actions; patient keeps a copy.',
    },
  },

  // ── Coordinate Handoffs ──
  'TL-009': {
    shortName: 'Safety Handoff',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [{ label: 'Record transition', path: '/patient/workflow/transition' }],
    tags: ['risk status', 'responsibility', 'next steps'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Communication', description: 'Suicide-safety handoff (SPiERSafetyHandoff) — who received it, when, and which safety context travelled, as repeating handoff-content-item codes', when: 'On record' },
      ],
      workflowTrigger: 'Pre-discharge transfer of care to the next setting.',
    },
  },
  'TL-030': {
    shortName: 'Discharge Packet',
    inclusionStatus: 'core',
    settings: ['ED', 'inpatient'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [{ label: 'Assemble discharge packet', path: '/patient/workflow/discharge-packet' }],
    tags: ['safety plan copy', 'crisis resources', 'follow-up details'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'DocumentReference', description: 'The packet itself (SPiERDischargeSafetyPacket) — attachment plus context.related pointing at the live safety plan / risk Observation / appointment it was assembled from', when: 'At discharge or transition' },
      ],
      workflowTrigger: 'DocumentReference rather than Communication because the packet is a retrievable artifact, not a one-time transmission.',
    },
  },
  'TL-017': {
    shortName: 'Referral Handoff',
    inclusionStatus: 'core',
    settings: ['ED', 'inpatient'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [{ label: 'Send referral', path: '/patient/workflow/referral' }],
    tags: ['status tracked to completion', 'ServiceRequest'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'ServiceRequest', description: 'The referral (SPiERSafetyReferral), trackable past sent through accepted/completed via ServiceRequest.status — which is what the SSC asks for and a Communication cannot express', when: 'On referral' },
        { type: 'ServiceRequest (same resource)', description: 'Advancing the referral to completed or revoked is an update to the SAME resource, not a new one — the recorder upserts by id so a closed referral cannot still read as outstanding', when: 'On acceptance / completion' },
      ],
      workflowTrigger: 'Warm handoff / accelerated access to follow-up care.',
    },
  },
  'TL-031': {
    shortName: 'Next Appointment',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [{ label: 'Book follow-up appointment', path: '/patient/workflow/follow-up-appointment' }],
    tags: ['scheduled before discharge', 'missing-appointment alert'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'Appointment', description: 'The follow-up visit (SPiERFollowUpAppointment) — date/time, receiving provider or team, location, status', when: 'Before transition/discharge' },
      ],
      workflowTrigger: 'Appointment.status carries booked → fulfilled / noshow, which is what makes the Stage-6 no-show workflow possible without a second resource type.',
    },
  },
  'TL-032': {
    shortName: 'Consent / Sharing',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [{ label: 'Record sharing consent', path: '/patient/workflow/sharing-consent' }],
    tags: ['sharing restrictions', 'support-person access'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 1 },
    recordingPattern: {
      resources: [
        { type: 'Consent', description: 'Whether suicide-safety information may be shared and with whom (SPiERInformationSharingConsent) — native Consent provisions: permit/deny is the decision, provision.actor the recipient, provision.period the expiry', when: 'On documenting consent' },
      ],
      workflowTrigger: 'A patient declining is a deny provision, not a separate status — so the EHR can compute what to send or withhold at a handoff.',
    },
  },

  // ── Track Follow-Up ──
  'TL-033': {
    shortName: 'Outreach Attempts',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [{ label: 'Record outreach attempt', path: '/patient/workflow/outreach' }],
    tags: ['due dates', 'attempt outcomes', 'assignments'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Communication', description: 'One attempt (SPiEROutreachAttempt) — method, time, and an outcome extension (reached / no answer / message left / unable to reach), plus a separate flag for a new safety concern', when: 'Per attempt' },
      ],
      workflowTrigger: 'Outcome is an extension because Communication.status only says a message was sent, not whether anyone answered.',
    },
  },
  'TL-010': {
    shortName: 'Caring Contacts',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [{ label: 'Log caring contact', path: '/patient/workflow/caring-contact' }],
    targetMaturity: { electronic: 2, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Communication', description: 'The caring contact itself (SPiERCaringContact) — method, sent date, opt-out status. NOT an outreach attempt: a caring contact asks nothing of the patient, so it has no reached/unreached outcome', when: 'On each scheduled contact' },
      ],
      workflowTrigger: 'Post-discharge caring-contact cadence (e.g. 24–48h, 7-day, 30-day).',
    },
  },
  'TL-034': {
    shortName: 'Appointment Tracking',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [{ label: 'Track follow-up appointments', path: '/patient/workflow/follow-up-appointment' }],
    tags: ['attended / no-show', '7-day & 30-day windows', 'reuses TL-031 Appointment'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: '(none — reads TL-031)', description: 'Stores nothing new. Appointment.status already carries booked / fulfilled / cancelled / noshow and Appointment.start the date, so attended, no-show, rescheduled and the 7-/30-day windows all derive from the SPiERFollowUpAppointment created at handoff', when: 'On view' },
      ],
      workflowTrigger: 'The 7-/30-day completion figures are Stage-8 measures computed over these appointments.',
    },
  },
  'TL-035': {
    shortName: 'No-Show Follow-Up',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [{ label: 'Follow up on a no-show', path: '/patient/workflow/outreach' }],
    tags: ['risk-aware no-show handling', 'reuses TL-033 outreach'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Communication', description: 'The same SPiEROutreachAttempt as routine outreach, with outreach-prompt = missed-appointment or no-show. The artifact is identical; only the trigger differs', when: 'After a missed appointment' },
        { type: 'Appointment', description: 'A rescheduled visit, if one is booked', when: 'If rescheduled' },
        { type: 'Task', description: 'A SPiERSafetyTask escalation, if contact fails', when: 'If escalated' },
      ],
      workflowTrigger: 'Treats a missed appointment by a high-risk patient as a safety event, not an empty slot.',
    },
  },
  'TL-036': {
    shortName: 'Follow-Up Escalation',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [{ label: 'Escalate a failing follow-up', path: '/patient/workflow/safety-tasks' }],
    tags: ['unreachable patient', 'supervisor routing', 'reuses TL-041 task'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Task', description: 'The same SPiERSafetyTask (code = escalation) Stage 7 uses, with repeating escalation triggers — so a case escalated from failing follow-up and one escalated from the risk registry land in the same work queue', when: 'On escalation' },
      ],
      workflowTrigger: 'Triggers extended for this stage: new safety concern, missed outreach window, failed contact sequence.',
    },
  },

  // ── Track Risk Over Time ──
  'TL-037': {
    shortName: 'Risk Registry',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Monitoring', variant: 'monitoring' },
    launchActions: [],
    tags: ['work queue', 'owners & due dates', 'query, not a resource'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: '(none — a query)', description: 'The registry stores nothing. It reads open episodes and their tasks: EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on', when: 'On view' },
      ],
      workflowTrigger: 'Sorted/filtered by the episode current-risk-tier extension and each task due date; overdue is computed, not stored.',
    },
  },
  'TL-038': {
    shortName: 'Episode Status',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Monitoring', variant: 'monitoring' },
    launchActions: [{ label: 'Open / close episode', path: '/patient/workflow/risk-episode' }],
    tags: ['open/closed lifecycle', 'closure reason', 'stage anchor'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'EpisodeOfCare', description: 'The suicide-safer care episode (SPiERSuicideRiskEpisode) — entry reason, current risk tier, owner/team, open→closed with closure reason + statusHistory', when: 'On episode open; updated through to closure' },
        { type: 'Flag', description: 'Chart banner announcing the open episode (SPiERSuicideRiskFlag). Carries no clinical detail; set inactive at closure', when: 'While the episode is open' },
      ],
      workflowTrigger: 'Anchor for the stage — reassessment, care-gap, and escalation Tasks all link back via Task.basedOn.',
    },
  },
  'TL-039': {
    shortName: 'Reassessment Schedule',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Monitoring', variant: 'monitoring' },
    launchActions: [{ label: 'Schedule reassessment', path: '/patient/workflow/safety-tasks' }],
    tags: ['tier-driven cadence', 'due & overdue alerts'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Task', description: 'SPiERSafetyTask coded reassessment-due, with owner and due date (restriction.period.end), linked to the episode', when: 'On scheduling' },
      ],
      workflowTrigger: 'Due/overdue computed from the due date rather than stored, so the schedule cannot go stale.',
    },
  },
  'TL-040': {
    shortName: 'Care Gap Tracking',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Monitoring', variant: 'monitoring' },
    launchActions: [{ label: 'Track a care gap', path: '/patient/workflow/safety-tasks' }],
    tags: ['open safety actions', 'owner + due date'],
    targetMaturity: { electronic: 2, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'Task (x1-n)', description: 'One SPiERSafetyTask per open gap (safety plan needed, lethal-means action open, referral incomplete, appointment missing, …), each with owner + due date', when: 'While the gap is open' },
      ],
      workflowTrigger: 'Completion = Task.status completed. Gaps roll up into the registry work queue.',
    },
  },
  'TL-041': {
    shortName: 'Overdue Escalation',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Monitoring', variant: 'monitoring' },
    launchActions: [{ label: 'Escalate a case', path: '/patient/workflow/safety-tasks' }],
    tags: ['worsening risk', 'documented outcome'],
    targetMaturity: { electronic: 2, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'Task', description: 'SPiERSafetyTask coded escalation with a repeating escalation-trigger extension (several triggers can fire at once); Task.owner routes it, businessStatus records the outcome', when: 'On escalation' },
      ],
      workflowTrigger: 'Triggers: high-risk status, worsening/missed reassessment, missed follow-up or appointment, overdue safety action, unable to reach, manual escalation.',
    },
  },

  // ── Measure and Share the Data ──
  // Only TL-042 produces a resource. TL-043 is a rendering, TL-044 a
  // serialization, TL-045 a transport — so their recordingPattern describes
  // what they READ rather than what they write. See
  // docs/plans/stage-8-measure-and-share.md.
  'TL-042': {
    shortName: 'KPI Reporting',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Reporting', variant: 'monitoring' },
    launchActions: [{ label: 'Open measure dashboard', path: '/guide/measures' }],
    tags: ['numerators & denominators', 'follow-up timeliness'],
    targetMaturity: { electronic: 3, writeback: 2, triggering: 1 },
    recordingPattern: {
      resources: [
        { type: 'MeasureReport', description: 'One report per measure per period. Summary reports answer "how is the program doing"; individual reports carry evaluatedResource links back to the artifacts behind the result', when: 'On each measurement run' },
        { type: 'Measure', description: 'The seven definitions — screen-to-assessment, risk status documented, safety plan before discharge (+ patient copy), lethal means counseling, follow-up timeliness at 48h/7d/30d, caring-contact adherence, referral loop closure', when: 'Published definitions; not created per patient' },
        { type: 'Library', description: 'The CQL computing every population criterion (ig/input/cql/). Retrieves filter on SPiER profiles, so the measures read exactly the stage 1–7 artifacts and nothing else', when: 'Published definition' },
      ],
      workflowTrigger: 'Reads only — no new capture. The episode (TL-038) supplies the cohort and index date; the documented transition (TL-009/TL-030) indexes every post-discharge window.',
    },
  },
  'TL-043': {
    shortName: 'Dashboard',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Reporting', variant: 'monitoring' },
    launchActions: [{ label: 'Open measure dashboard', path: '/guide/measures' }],
    tags: ['aggregate view', 'site/team filters'],
    targetMaturity: { electronic: 3, writeback: 2, triggering: 1 },
    recordingPattern: {
      resources: [
        { type: 'MeasureReport', description: 'Read, not written — the measure tiles render summary reports produced by TL-042', when: 'On dashboard load' },
        { type: 'EpisodeOfCare', description: 'Read — operational counts (active episodes, overdue items) come from the same registry query TL-037 defines: EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on', when: 'On dashboard load' },
      ],
      workflowTrigger: 'Produces no resource. The SSC filter list (date range, site, setting, provider/team, tool, risk level, completion status) maps onto search parameters over those two reads.',
    },
  },
  'TL-044': {
    shortName: 'Analytics Extract',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Reporting', variant: 'monitoring' },
    launchActions: [],
    tags: ['structured fields + timestamps'],
    targetMaturity: { electronic: 3, writeback: 2, triggering: 1 },
    recordingPattern: {
      resources: [
        { type: 'Bundle', description: 'A Bulk Data $export of the SPiER resource types. The SSC requirement that an extract carry structured fields AND measurement timestamps is already met by the profiles — every one mandates a discrete date (Observation.effective, Procedure.performed, Communication.sent, Appointment.start, ServiceRequest.authoredOn, EpisodeOfCare.period, Task.authoredOn)', when: 'On scheduled or on-demand export' },
      ],
      workflowTrigger: 'Defines no new artifact — CSV and warehouse extracts are flattenings of the same resource set. Declared on the SPiERQualityReporter CapabilityStatement.',
    },
  },
  'TL-045': {
    shortName: 'Interop Output',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Reporting', variant: 'monitoring' },
    launchActions: [],
    tags: ['HIE / FHIR API', 'consent-aware sharing'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
    recordingPattern: {
      resources: [
        { type: 'Observation', description: 'The harmonized SPiERSuicideRiskConcept is the minimum viable payload for a receiver that does not know the originating instrument', when: 'On share' },
        { type: 'Consent', description: 'Read first, always — the SPiERInformationSharingConsent from TL-032 governs what may go where. A deny provision naming a recipient is what withholds data from that recipient', when: 'Before every share' },
      ],
      workflowTrigger: 'Every item on the SSC shareable list is already a SPiER profile, so sharing needs no new shape. What it needs is that the resources are readable and movable — a conformance claim, not a profile.',
    },
  },
}

const DEFAULT_BADGE: ToolUiMetadata['badge'] = { label: 'Tool', variant: 'screening' }
const DEFAULT_MATURITY: ToolUiMetadata['targetMaturity'] = { electronic: 0, writeback: 0, triggering: 0 }

export function uiMetadataFor(toolId: string): ToolUiMetadata {
  return (
    TOOL_UI_METADATA[toolId] ?? {
      inclusionStatus: 'future',
      settings: [],
      badge: DEFAULT_BADGE,
      launchActions: [],
      targetMaturity: DEFAULT_MATURITY,
    }
  )
}
