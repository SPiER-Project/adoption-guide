export type InclusionStatus = 'core' | 'optional' | 'future'
export type BadgeVariant = 'screening' | 'assessment' | 'safety' | 'cams' | 'handoff' | 'followup' | 'monitoring'
export type MaturityLevel = 0 | 1 | 2 | 3

export interface LaunchAction {
  label: string
  path: string
  variant?: 'primary' | 'secondary'
}

export interface RecordingResource {
  type: string              // 'QuestionnaireResponse', 'Observation', 'CarePlan', 'Condition', ...
  description: string
  when: string              // 'On submit', 'Extracted from response', 'Generated from response'
}

export interface RecordingPattern {
  resources: RecordingResource[]
  workflowTrigger?: string
}

export interface FhirExample {
  title: string
  resource: Record<string, unknown>
}

export interface Tool {
  id: string                                // 'TL-001'
  name: string                              // 'ASQ Adult / Youth'
  shortName?: string                        // used in compact contexts
  stageId: string                           // stages.id
  purpose: string                           // 1-line purpose
  description?: string                      // longer body copy
  inclusionStatus: InclusionStatus
  settings: string[]
  badge: { label: string; variant: BadgeVariant }
  launchActions: LaunchAction[]             // empty array = not yet launchable
  tags?: string[]                           // '9 items', 'LOINC coded', etc.
  targetMaturity: {
    electronic: MaturityLevel
    writeback: MaturityLevel
    triggering: MaturityLevel
  }
  recordingPattern?: RecordingPattern       // how data gets recorded/structured
  fhirExamples?: FhirExample[]              // sample FHIR resources
  pilotPlanSlug?: string                    // matches a file in data/pilot-plans/<slug>.md
}

// ─────────────────────────────────────────────────────────────
// FHIR example resources (moved from ImplementationGuide.tsx)
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
// Tool registry
// ─────────────────────────────────────────────────────────────

export const TOOLS: Tool[] = [
  // ── Flag Risk ──
  {
    id: 'TL-001',
    name: 'ASQ — Ask Suicide-Screening Questions',
    shortName: 'ASQ',
    stageId: 'flag-risk',
    purpose: 'Brief suicide screen for youth and adults',
    description: 'NIMH-validated 4-question suicide risk screening tool for youth (8+) and adults. Includes acuity question with three-tier risk stratification (negative / non-acute-positive / acute-positive).',
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
  {
    id: 'TL-002',
    name: 'PHQ-9 / PHQ-A Item 9 Trigger',
    shortName: 'PHQ-9',
    stageId: 'flag-risk',
    purpose: 'Depression screen with Item 9 as suicide-risk gateway',
    description: '9-item depression screening (0–27) with Item 9 as the primary gateway for suicide risk in most EHR workflows. Fully LOINC-coded with ordinalValue scoring.',
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
  {
    id: 'TL-003',
    name: 'Columbia C-SSRS Screener / Triage',
    shortName: 'C-SSRS Screener',
    stageId: 'flag-risk',
    purpose: 'Brief suicide screener with triage support',
    description: 'Columbia 6-item suicide risk screener with three-tier stratification (Low / Moderate / High). The gold-standard brief screening tool.',
    inclusionStatus: 'core',
    settings: ['acute care', 'ED', 'inpatient', 'ambulatory', 'behavioral health'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [{ label: 'Launch C-SSRS Screener', path: '/patient/assessments/cssrs-screener' }],
    tags: ['LOINC coded', '3-tier risk'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-011',
    name: 'Patient Safety Screener-3 (PSS-3)',
    shortName: 'PSS-3',
    stageId: 'flag-risk',
    purpose: 'Brief acute-care suicide screen',
    inclusionStatus: 'optional',
    settings: ['acute care', 'ED'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },
  {
    id: 'TL-014',
    name: 'Patient Safety Screener / Suicide Risk Screener (Full)',
    shortName: 'PSS / SRS Full',
    stageId: 'flag-risk',
    purpose: 'Combined acute-care screen with local stratification',
    inclusionStatus: 'future',
    settings: ['acute care', 'ED'],
    badge: { label: 'Screening', variant: 'screening' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },
  {
    id: 'TL-025',
    name: 'SBQ-R — Suicide Behaviors Questionnaire',
    shortName: 'SBQ-R',
    stageId: 'flag-risk',
    purpose: '4-item self-report of lifetime and past-year suicidal behavior',
    description: '4-item self-report covering lifetime ideation, past-year frequency, threat disclosure, and future likelihood. Score range 3–18 with population-specific cutoffs (≥7 general, ≥8 inpatient).',
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
  {
    id: 'TL-004',
    name: 'Columbia C-SSRS Full Scale (Lifetime/Recent)',
    shortName: 'C-SSRS Full',
    stageId: 'clarify-risk',
    purpose: 'Expanded suicide assessment with lifetime and recent history',
    description: 'Comprehensive Columbia assessment: 5-level ideation hierarchy, intensity ratings (frequency, duration, controllability, deterrents, reasons), and full behavior section with lethality scoring.',
    inclusionStatus: 'core',
    settings: ['acute care', 'ED', 'inpatient', 'ambulatory', 'behavioral health'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [{ label: 'Launch C-SSRS Full', path: '/patient/assessments/cssrs-full' }],
    tags: ['LOINC coded', '5-level hierarchy', 'risk stratification'],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-019',
    name: 'Columbia C-SSRS Since Last Contact',
    shortName: 'C-SSRS Since Last',
    stageId: 'clarify-risk',
    purpose: 'Repeat assessment since the prior contact',
    inclusionStatus: 'core',
    settings: ['ambulatory', 'behavioral health'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },
  {
    id: 'TL-005',
    name: 'NIMH Brief Suicide Safety Assessment (BSSA)',
    shortName: 'BSSA',
    stageId: 'clarify-risk',
    purpose: 'Disposition-oriented assessment after positive ASQ',
    inclusionStatus: 'core',
    settings: ['medical', 'ambulatory', 'acute care'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-020',
    name: 'CAMS SSF-5 First Session',
    shortName: 'CAMS SSF-5',
    stageId: 'clarify-risk',
    purpose: 'Collaborative suicide-focused assessment and episode entry',
    description: 'The SSF-5 is the structured collaborative assessment used to enter a CAMS episode. Section A is patient self-report (psychological pain, stress, agitation, hopelessness, self-hate, overall risk); Section B is clinician-rated ideation, plan, preparation, history, and drivers.',
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
  {
    id: 'TL-006',
    name: 'SAFE-T',
    shortName: 'SAFE-T',
    stageId: 'set-risk-status',
    purpose: 'Structured clinical formulation and triage',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Assessment', variant: 'assessment' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-024',
    name: 'CAMS Therapeutic Worksheet',
    shortName: 'CAMS Worksheet',
    stageId: 'set-risk-status',
    purpose: 'Driver formulation and suicide crisis working model',
    description: 'Exploration of suicide drivers and development of a working crisis model used across CAMS sessions.',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [{ label: 'Launch Therapeutic Worksheet', path: '/patient/assessments/cams-therapeutic-worksheet' }],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },

  // ── Document Safety Actions ──
  {
    id: 'TL-007',
    name: 'Stanley-Brown Safety Plan',
    shortName: 'Stanley-Brown',
    stageId: 'document-safety-actions',
    purpose: 'Collaborative safety planning',
    description: 'A brief intervention to help individuals manage suicidal crises and reduce access to lethal means. LOINC-coded 7-step plan persisted as a FHIR CarePlan.',
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
  {
    id: 'TL-008',
    name: 'Means Safety Counseling',
    shortName: 'Means Safety',
    stageId: 'document-safety-actions',
    purpose: 'Lethal means reduction',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },
  {
    id: 'TL-021',
    name: 'CAMS Stabilization Support Plan',
    shortName: 'CAMS Stabilization',
    stageId: 'document-safety-actions',
    purpose: 'Collaborative stabilization / safety planning within CAMS',
    description: 'Collaborative safety and stabilization plan including lethal means counseling and coping strategies. Updated at the start of every CAMS session.',
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
  {
    id: 'TL-013',
    name: 'Now Matters Now',
    shortName: 'Now Matters Now',
    stageId: 'document-safety-actions',
    purpose: 'Patient-facing coping-skills and safety-plan support resource',
    inclusionStatus: 'optional',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 1, triggering: 1 },
  },
  {
    id: 'TL-015',
    name: 'Crisis Response Planning',
    shortName: 'CRP',
    stageId: 'document-safety-actions',
    purpose: 'Alternative crisis-planning framework',
    inclusionStatus: 'future',
    settings: ['military', 'VA', 'behavioral health'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },
  {
    id: 'TL-016',
    name: 'CALM / Means Safety Counseling Protocol',
    shortName: 'CALM',
    stageId: 'document-safety-actions',
    purpose: 'Named means-safety protocol option',
    inclusionStatus: 'future',
    settings: ['all settings'],
    badge: { label: 'Safety Plan', variant: 'safety' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },

  // ── Coordinate Handoffs ──
  {
    id: 'TL-009',
    name: 'Transition Checkpoint',
    shortName: 'Transition',
    stageId: 'coordinate-handoffs',
    purpose: 'Pre-discharge transfer of care',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-023',
    name: 'CAMS SSF-5 Outcome/Disposition Final Session',
    shortName: 'CAMS Outcome',
    stageId: 'coordinate-handoffs',
    purpose: 'Episode closure, disposition, and next-step planning',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-017',
    name: 'Rapid Referral to Outpatient Behavioral Healthcare',
    shortName: 'Rapid Referral',
    stageId: 'coordinate-handoffs',
    purpose: 'Warm handoff and accelerated access to follow-up',
    inclusionStatus: 'future',
    settings: ['ED', 'inpatient'],
    badge: { label: 'Handoff', variant: 'handoff' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 3 },
  },

  // ── Track Follow-Up ──
  {
    id: 'TL-010',
    name: 'Outreach / Caring Contacts',
    shortName: 'Caring Contacts',
    stageId: 'track-follow-up',
    purpose: 'Closed-loop follow-up',
    inclusionStatus: 'core',
    settings: ['all settings'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 3, triggering: 3 },
  },
  {
    id: 'TL-012',
    name: 'ED-SAFE / CLASP-ED Follow-up Protocol',
    shortName: 'ED-SAFE',
    stageId: 'track-follow-up',
    purpose: 'Protocol-based post-discharge follow-up',
    inclusionStatus: 'optional',
    settings: ['ED'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 3 },
  },
  {
    id: 'TL-018',
    name: 'Colorado Post-Visit Protocol',
    shortName: 'Colorado Post-Visit',
    stageId: 'track-follow-up',
    purpose: 'Protocol-based post-visit outreach',
    inclusionStatus: 'future',
    settings: ['ED', 'ambulatory'],
    badge: { label: 'Follow-Up', variant: 'followup' },
    launchActions: [],
    targetMaturity: { electronic: 2, writeback: 2, triggering: 2 },
  },

  // ── Manage Active Risk ──
  {
    id: 'TL-022',
    name: 'CAMS SSF-5 Interim Sessions',
    shortName: 'CAMS Interim',
    stageId: 'manage-active-risk',
    purpose: 'Ongoing in-episode monitoring and treatment update',
    inclusionStatus: 'optional',
    settings: ['behavioral health', 'outpatient'],
    badge: { label: 'CAMS', variant: 'cams' },
    launchActions: [{ label: 'Launch Interim Session', path: '/patient/assessments/cams-section-a' }],
    targetMaturity: { electronic: 3, writeback: 3, triggering: 2 },
  },

  // ── Measure and Share — no mapped tools yet ──
]

export const toolById = (id: string) => TOOLS.find(t => t.id === id)
export const toolsByStage = (stageId: string) => TOOLS.filter(t => t.stageId === stageId)
export const launchableTools = () => TOOLS.filter(t => t.launchActions.length > 0)
