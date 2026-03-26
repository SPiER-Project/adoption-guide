export interface RubricCriterion {
  id: string
  name: string
  description: string
  levels: { level: number; label: string; description: string }[]
}

export interface RubricTool {
  toolId: string
  name: string
  stage: string
  targets: Record<string, number> // criterionId → target level
}

export const RUBRIC_CRITERIA: RubricCriterion[] = [
  {
    id: 'electronic',
    name: 'Electronic Availability',
    description: 'Can this tool be used electronically?',
    levels: [
      { level: 0, label: 'Paper Only', description: 'Not available electronically' },
      { level: 1, label: 'Scanned / Attached', description: 'Source document stored as DocumentReference or attachment' },
      { level: 2, label: 'Hybrid', description: 'Some structured fields captured alongside source document' },
      { level: 3, label: 'Fully Native', description: 'Built as Questionnaire + QuestionnaireResponse with full fidelity' },
    ],
  },
  {
    id: 'writeback',
    name: 'Data Write-Back',
    description: 'Does structured data get written back to the chart?',
    levels: [
      { level: 0, label: 'No Data', description: 'No discrete data captured' },
      { level: 1, label: 'Manual Abstraction', description: 'Key results manually entered into flowsheet or note' },
      { level: 2, label: 'Partial Extraction', description: 'Some observations auto-extracted from form' },
      { level: 3, label: 'Full Discrete', description: 'All outputs as FHIR resources (Observation, RiskAssessment, CarePlan)' },
    ],
  },
  {
    id: 'triggering',
    name: 'Care Triggering',
    description: 'Is the data useable for triggering follow-on care?',
    levels: [
      { level: 0, label: 'No Triggers', description: 'No automated or systematic follow-up' },
      { level: 1, label: 'Manual Review', description: 'Clinician manually reviews and decides next steps' },
      { level: 2, label: 'Task / Alert', description: 'System generates tasks or alerts from results' },
      { level: 3, label: 'Automated Routing', description: 'CDS Hooks, BPA triggers, or task queues route care automatically' },
    ],
  },
]

export const RUBRIC_TOOLS: RubricTool[] = [
  // Screen
  { toolId: 'TL-001', name: 'ASQ Adult / Youth', stage: 'Screen', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-002', name: 'PHQ-9 / PHQ-A Item 9 Trigger', stage: 'Screen', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-003', name: 'C-SSRS Screener / Triage', stage: 'Screen', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-011', name: 'PSS-3', stage: 'Screen', targets: { electronic: 3, writeback: 3, triggering: 2 } },
  { toolId: 'TL-014', name: 'PSS / SRS Full', stage: 'Screen', targets: { electronic: 2, writeback: 2, triggering: 2 } },

  // Assess
  { toolId: 'TL-004', name: 'C-SSRS Full Scale (Lifetime/Recent)', stage: 'Assess', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-019', name: 'C-SSRS Since Last Contact', stage: 'Assess', targets: { electronic: 3, writeback: 3, triggering: 2 } },
  { toolId: 'TL-005', name: 'BSSA', stage: 'Assess', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-020', name: 'CAMS SSF-5 First Session', stage: 'Assess', targets: { electronic: 3, writeback: 3, triggering: 3 } },

  // Formulate
  { toolId: 'TL-006', name: 'SAFE-T', stage: 'Formulate', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-024', name: 'CAMS Therapeutic Worksheet', stage: 'Formulate', targets: { electronic: 3, writeback: 3, triggering: 2 } },

  // Plan
  { toolId: 'TL-007', name: 'Safety Plan Core / Stanley-Brown', stage: 'Plan', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-008', name: 'Means Safety Counseling', stage: 'Plan', targets: { electronic: 3, writeback: 3, triggering: 2 } },
  { toolId: 'TL-021', name: 'CAMS Stabilization Support Plan', stage: 'Plan', targets: { electronic: 3, writeback: 3, triggering: 2 } },
  { toolId: 'TL-013', name: 'Now Matters Now', stage: 'Plan', targets: { electronic: 2, writeback: 1, triggering: 1 } },
  { toolId: 'TL-015', name: 'Crisis Response Planning', stage: 'Plan', targets: { electronic: 2, writeback: 2, triggering: 2 } },
  { toolId: 'TL-016', name: 'CALM / Means Safety Protocol', stage: 'Plan', targets: { electronic: 2, writeback: 2, triggering: 2 } },

  // Transition
  { toolId: 'TL-009', name: 'Transition Checkpoint', stage: 'Transition', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-023', name: 'CAMS Outcome/Disposition', stage: 'Transition', targets: { electronic: 3, writeback: 3, triggering: 3 } },
  { toolId: 'TL-017', name: 'Rapid Referral', stage: 'Transition', targets: { electronic: 2, writeback: 2, triggering: 3 } },

  // Follow-up
  { toolId: 'TL-010', name: 'Outreach / Caring Contacts', stage: 'Follow-up', targets: { electronic: 2, writeback: 3, triggering: 3 } },
  { toolId: 'TL-012', name: 'ED-SAFE / CLASP-ED Protocol', stage: 'Follow-up', targets: { electronic: 2, writeback: 2, triggering: 3 } },
  { toolId: 'TL-018', name: 'Colorado Post-Visit Protocol', stage: 'Follow-up', targets: { electronic: 2, writeback: 2, triggering: 2 } },

  // Monitor
  { toolId: 'TL-022', name: 'CAMS SSF-5 Interim Sessions', stage: 'Monitor', targets: { electronic: 3, writeback: 3, triggering: 2 } },
]

export const STAGE_ORDER = ['Screen', 'Assess', 'Formulate', 'Plan', 'Transition', 'Follow-up', 'Monitor']
