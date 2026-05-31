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
  pilotPlanSlug?: string
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
  code: { coding: [{ system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead or of hurting yourself' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T10:30:00Z',
  valueInteger: 2,
  interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Positive — suicide risk screening indicated' }] }],
}

const ASQ_RESULT_EXAMPLE = {
  resourceType: 'Observation',
  id: 'asq-result-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93243-5', display: 'ASQ suicide risk screening result' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T10:35:00Z',
  valueCodeableConcept: {
    coding: [{ system: 'http://spier.org/CodeSystem/asq-screening-result', code: 'non-acute-positive', display: 'Non-Acute Positive Screen' }],
  },
}

const CAMS_VITAL_EXAMPLE = {
  resourceType: 'Observation',
  id: 'cams-psychological-pain-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: {
    coding: [{ system: 'http://spier.org/CodeSystem/cams-ssf', code: 'psychological-pain', display: 'CAMS SSF: Psychological Pain' }],
    text: 'Psychological Pain — local code pending LOINC submission',
  },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T11:00:00Z',
  valueInteger: 4,
  interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: 'Elevated (4/5)' }] }],
  note: [{ text: 'Track longitudinally across CAMS sessions to show trending.' }],
}

const CAMS_DRIVER_EXAMPLE = {
  resourceType: 'Condition',
  id: 'cams-driver-example',
  clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
  category: [
    { coding: [{ system: 'http://cams-care.com/driver-category', code: 'suicide-driver', display: 'Suicide Driver' }] },
    { coding: [{ system: 'http://cams-care.com/driver-type', code: 'direct', display: 'Direct Driver' }] },
  ],
  code: { text: 'Relationship conflict with spouse — feeling trapped and hopeless' },
  subject: { reference: 'Patient/123' },
  note: [{ text: 'Track on problem list until resolved. Update clinicalStatus to "resolved" at CAMS disposition.' }],
}

// ─────────────────────────────────────────────────────────────
// UI metadata per tool id
// ─────────────────────────────────────────────────────────────

export const TOOL_UI_METADATA: Record<string, ToolUiMetadata> = {
  // ── Flag Risk ──
  'TL-001': {
    shortName: 'ASQ',
    inclusionStatus: 'core',
    settings: ['medical', 'ambulatory', 'acute care'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch ASQ Screening', path: '/patient/assessments/asq' }],
    tags: ['~20 seconds', 'NIMH public domain', 'enableWhen logic'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    pilotPlanSlug: 'asq',
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'All 5 items (Q1–Q4 + acuity Q5)', when: 'On submit' },
        { type: 'Observation', description: 'Screening result (negative / non-acute-positive / acute-positive)', when: 'Extracted from response' },
        { type: 'Observation', description: 'Individual item responses (LOINC 93263-3 through 93267-4)', when: 'Extracted from response' },
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
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },
  'TL-014': {
    shortName: 'PSS / SRS Full',
    inclusionStatus: 'future',
    settings: ['acute care', 'ED'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
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
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },
  'TL-005': {
    shortName: 'BSSA',
    inclusionStatus: 'core',
    settings: ['medical', 'ambulatory', 'acute care'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  'TL-020': {
    shortName: 'CAMS SSF-5',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [
      { label: 'SSF-5 Section A (Patient)', path: '/patient/assessments/cams-section-a', variant: 'secondary' },
      { label: 'SSF-5 Section B (Clinician)', path: '/patient/assessments/cams-section-b', variant: 'secondary' },
    ],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
    recordingPattern: {
      resources: [
        { type: 'QuestionnaireResponse', description: 'SSF-5 Section A — 6 vital ratings + qualitative text', when: 'On submit' },
        { type: 'Observation (x6)', description: 'Individual vital scores (pain, stress, agitation, hopelessness, self-hate, overall risk)', when: 'Extracted from response' },
        { type: 'Observation', description: 'Overall suicide risk level (LOINC 93374-7)', when: 'Extracted from response' },
        { type: 'QuestionnaireResponse', description: 'SSF-5 Section B — ideation, plan, preparation, history, drivers', when: 'On submit (Section B)' },
        { type: 'Condition (x1-3)', description: 'Suicide drivers added to problem list (clinicalStatus: active)', when: 'Extracted from Section B' },
      ],
      workflowTrigger: 'Any vital ≥ 4 → stabilization planning. Drivers tracked until resolved.',
    },
    fhirExamples: [
      { title: 'CAMS Section A → Observation (psychological pain vital)', resource: CAMS_VITAL_EXAMPLE },
      { title: 'CAMS Section B → Condition (suicide driver on problem list)', resource: CAMS_DRIVER_EXAMPLE },
    ],
  },

  // ── Set Risk Status ──
  'TL-006': {
    shortName: 'SAFE-T',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
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
    shortName: 'Means Safety',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
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
    shortName: 'Now Matters Now',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 1, triggering: 1 },
  },
  'TL-015': {
    shortName: 'CRP',
    inclusionStatus: 'future',
    settings: ['military', 'VA', 'behavioral health'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },
  'TL-016': {
    shortName: 'CALM',
    inclusionStatus: 'future',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },

  // ── Coordinate Handoffs ──
  'TL-009': {
    shortName: 'Transition',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  'TL-023': {
    shortName: 'CAMS Outcome',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  'TL-017': {
    shortName: 'Rapid Referral',
    inclusionStatus: 'future',
    settings: ['ED', 'inpatient'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 3 },
  },

  // ── Track Follow-Up ──
  'TL-010': {
    shortName: 'Caring Contacts',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 3, triggering: 3 },
  },
  'TL-012': {
    shortName: 'ED-SAFE',
    inclusionStatus: 'optional',
    settings: ['ED'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 3 },
  },
  'TL-018': {
    shortName: 'Colorado Post-Visit',
    inclusionStatus: 'future',
    settings: ['ED', 'ambulatory'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },

  // ── Manage Active Risk ──
  'TL-022': {
    shortName: 'CAMS Interim',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [{ label: 'Launch Interim Session', path: '/patient/assessments/cams-section-a' }],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
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
