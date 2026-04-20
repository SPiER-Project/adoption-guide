export interface StageTrigger {
  id: string
  fromStageId: string
  toStageId?: string             // undefined = same-stage / ongoing
  event: string
  condition: string
  action: string
}

export const TRIGGERS: StageTrigger[] = [
  // Flag Risk → Clarify Risk
  {
    id: 'TRG-001',
    fromStageId: 'flag-risk',
    toStageId: 'clarify-risk',
    event: 'PHQ-9 completed',
    condition: 'Item 9 response above configured threshold',
    action: 'Flag suicide-related signal and route to Clarify Risk',
  },
  {
    id: 'TRG-002',
    fromStageId: 'flag-risk',
    toStageId: 'clarify-risk',
    event: 'ASQ completed',
    condition: 'Any yes to items 1\u20134',
    action: 'Set screen positive; ask acuity question and route to Clarify Risk',
  },
  {
    id: 'TRG-003',
    fromStageId: 'flag-risk',
    toStageId: 'clarify-risk',
    event: 'ASQ acuity question completed',
    condition: 'Yes to item 5',
    action: 'Set acute positive; route urgent clarification of risk',
  },
  {
    id: 'TRG-004',
    fromStageId: 'flag-risk',
    toStageId: 'clarify-risk',
    event: 'Columbia screener completed',
    condition: 'Positive or urgent result',
    action: 'Flag risk and route to Clarify Risk',
  },
  {
    id: 'TRG-005',
    fromStageId: 'flag-risk',
    toStageId: 'clarify-risk',
    event: 'PSS-3 completed',
    condition: 'Screen positive',
    action: 'Flag risk and launch the configured clarification path',
  },

  // Clarify Risk → Set Risk Status
  {
    id: 'TRG-006',
    fromStageId: 'clarify-risk',
    toStageId: 'set-risk-status',
    event: 'Clarification assessment completed',
    condition: 'Assessment outputs persisted',
    action: 'Route to Set Risk Status with derived risk level',
  },
  {
    id: 'TRG-012',
    fromStageId: 'clarify-risk',
    toStageId: 'set-risk-status',
    event: 'CAMS SSF-5 First Session completed',
    condition: 'CAMS assessment outputs persisted',
    action: 'Update risk status and require documented safety actions',
  },

  // Set Risk Status → Document Safety Actions
  {
    id: 'TRG-007',
    fromStageId: 'set-risk-status',
    toStageId: 'document-safety-actions',
    event: 'Risk status set',
    condition: 'Risk level = moderate / high / imminent',
    action: 'Require Document Safety Actions (safety plan review/update and means counseling status)',
  },
  {
    id: 'TRG-013',
    fromStageId: 'set-risk-status',
    toStageId: 'document-safety-actions',
    event: 'CAMS Therapeutic Worksheet completed',
    condition: 'Driver / working-model content persisted',
    action: 'Make formulation and reasoning visible to the treatment team',
  },

  // Document Safety Actions → Coordinate Handoffs
  {
    id: 'TRG-014',
    fromStageId: 'document-safety-actions',
    toStageId: 'coordinate-handoffs',
    event: 'CAMS Stabilization Support Plan updated',
    condition: 'Plan version updated',
    action: 'Update active plan version, patient copy status, and means-safety fields',
  },

  // Coordinate Handoffs → Track Follow-Up
  {
    id: 'TRG-008',
    fromStageId: 'coordinate-handoffs',
    toStageId: 'track-follow-up',
    event: 'Disposition = discharge or transfer',
    condition: 'Active suicide safer care episode',
    action: 'Create handoff bundle, follow-up appointment requirement, and Track Follow-Up task',
  },
  {
    id: 'TRG-015',
    fromStageId: 'coordinate-handoffs',
    toStageId: 'track-follow-up',
    event: 'CAMS Outcome/Disposition Final Session completed',
    condition: 'Episode state updated',
    action: 'Store outcome/disposition and create handoff and follow-up tasks',
  },

  // Track Follow-Up → Manage Active Risk
  {
    id: 'TRG-009',
    fromStageId: 'track-follow-up',
    toStageId: 'manage-active-risk',
    event: 'Discharge timestamp recorded',
    condition: 'Patient discharged with active episode',
    action: 'Create 24\u201348 hour outreach task',
  },
  {
    id: 'TRG-010',
    fromStageId: 'track-follow-up',
    toStageId: 'manage-active-risk',
    event: 'Missed appointment or failed outreach',
    condition: 'Outreach attempt unsuccessful',
    action: 'Escalate to Manage Active Risk; update queue / registry state',
  },
  {
    id: 'TRG-011',
    fromStageId: 'track-follow-up',
    toStageId: 'manage-active-risk',
    event: 'ED-SAFE protocol assigned at discharge',
    condition: 'Protocol assigned',
    action: 'Create protocol-based outreach task sequence using local cadence',
  },

  // Manage Active Risk — ongoing
  {
    id: 'TRG-016',
    fromStageId: 'manage-active-risk',
    event: 'CAMS Interim Session completed',
    condition: 'Interim session findings persisted',
    action: 'Update trendable findings, episode state, and resolution tracking',
  },
]

export const triggersFromStage = (stageId: string) => TRIGGERS.filter(t => t.fromStageId === stageId)
