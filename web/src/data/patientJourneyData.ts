export interface JourneyTool {
  toolId: string
  name: string
  purpose: string
  inclusionStatus: 'core' | 'optional' | 'future'
  settings?: string
  path?: string
}

export interface StageTrigger {
  triggerId: string
  event: string
  condition: string
  action: string
}

export interface CareStage {
  id: string
  title: string
  description: string
  tools: JourneyTool[]
  triggers: StageTrigger[]
}

export const CARE_STAGES: CareStage[] = [
  {
    id: 'screen',
    title: 'Screen',
    description: 'Universal or targeted screening to identify patients who may be at risk for suicide.',
    tools: [
      {
        toolId: 'TL-001',
        name: 'ASQ Adult / Youth',
        purpose: 'Brief suicide screen',
        inclusionStatus: 'core',
        settings: 'medical, ambulatory, acute care',
        path: '/chart/screenings/asq',
      },
      {
        toolId: 'TL-002',
        name: 'PHQ-9 / PHQ-A Item 9 Trigger',
        purpose: 'Trigger into suicide workflow',
        inclusionStatus: 'core',
        settings: 'ambulatory, primary care, medical settings',
        path: '/chart/screenings/phq-9',
      },
      {
        toolId: 'TL-003',
        name: 'Columbia C-SSRS Screener / Triage',
        purpose: 'Brief suicide screener with triage support',
        inclusionStatus: 'core',
        settings: 'acute care, ED, inpatient, ambulatory, behavioral health',
        path: '/chart/screenings/cssrs-screener',
      },
      {
        toolId: 'TL-011',
        name: 'Patient Safety Screener-3 (PSS-3)',
        purpose: 'Brief acute-care suicide screen',
        inclusionStatus: 'optional',
        settings: 'acute care, ED',
      },
      {
        toolId: 'TL-014',
        name: 'Patient Safety Screener / Suicide Risk Screener (Full)',
        purpose: 'Combined acute-care screen with local stratification',
        inclusionStatus: 'future',
        settings: 'acute care, ED',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-001',
        event: 'PHQ-9 completed',
        condition: 'Item 9 response above configured threshold',
        action: 'Launch suicide-specific assessment workflow or create same-encounter task',
      },
      {
        triggerId: 'TRG-002',
        event: 'ASQ completed',
        condition: 'Any yes to items 1\u20134',
        action: 'Set screen positive; ask acuity question and route assessment',
      },
      {
        triggerId: 'TRG-003',
        event: 'ASQ acuity question completed',
        condition: 'Yes to item 5',
        action: 'Set acute positive; route urgent safety evaluation',
      },
      {
        triggerId: 'TRG-004',
        event: 'Columbia screener completed',
        condition: 'Positive or urgent result',
        action: 'Set screen positive or urgent state and route downstream assessment',
      },
      {
        triggerId: 'TRG-005',
        event: 'PSS-3 completed',
        condition: 'Screen positive',
        action: 'Set screen positive and launch configured assessment path',
      },
    ],
  },
  {
    id: 'assess',
    title: 'Assess',
    description: 'Comprehensive suicide risk assessment for patients who screen positive.',
    tools: [
      {
        toolId: 'TL-004',
        name: 'Columbia C-SSRS Full Scale (Lifetime/Recent)',
        purpose: 'Expanded suicide assessment with lifetime and recent history',
        inclusionStatus: 'core',
        settings: 'acute care, ED, inpatient, ambulatory, behavioral health',
        path: '/chart/screenings/cssrs-full',
      },
      {
        toolId: 'TL-019',
        name: 'Columbia C-SSRS Since Last Contact',
        purpose: 'Repeat assessment since the prior contact',
        inclusionStatus: 'core',
        settings: 'ambulatory, behavioral health',
      },
      {
        toolId: 'TL-005',
        name: 'NIMH Brief Suicide Safety Assessment (BSSA)',
        purpose: 'Disposition-oriented assessment after positive ASQ',
        inclusionStatus: 'core',
        settings: 'medical, ambulatory, acute care',
      },
      {
        toolId: 'TL-020',
        name: 'CAMS SSF-5 First Session',
        purpose: 'Collaborative suicide-focused assessment and episode entry',
        inclusionStatus: 'optional',
        settings: 'behavioral health, outpatient',
        path: '/chart/screenings/cams-section-a',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-006',
        event: 'Assessment completed',
        condition: 'Assessment outputs persisted',
        action: 'Derive / update current risk level',
      },
      {
        triggerId: 'TRG-012',
        event: 'CAMS SSF-5 First Session completed',
        condition: 'CAMS assessment outputs persisted',
        action: 'Create / update current risk state and require stabilization plan',
      },
    ],
  },
  {
    id: 'formulate',
    title: 'Formulate',
    description: 'Structured clinical formulation of risk level, rationale, and disposition.',
    tools: [
      {
        toolId: 'TL-006',
        name: 'SAFE-T',
        purpose: 'Structured clinical formulation and triage',
        inclusionStatus: 'core',
        settings: 'all settings',
      },
      {
        toolId: 'TL-024',
        name: 'CAMS Therapeutic Worksheet',
        purpose: 'Driver formulation and suicide crisis working model',
        inclusionStatus: 'optional',
        settings: 'behavioral health, outpatient',
        path: '/chart/screenings/cams-therapeutic-worksheet',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-007',
        event: 'Risk level determined',
        condition: 'Risk level = moderate / high / imminent',
        action: 'Require safety plan review/update and means counseling status',
      },
      {
        triggerId: 'TRG-013',
        event: 'CAMS Therapeutic Worksheet completed',
        condition: 'Driver / working-model content persisted',
        action: 'Make formulation visible to the treatment team',
      },
    ],
  },
  {
    id: 'plan',
    title: 'Plan',
    description: 'Collaborative creation of a safety plan, means safety counseling, and stabilization strategies.',
    tools: [
      {
        toolId: 'TL-007',
        name: 'Safety Plan Core / Stanley-Brown',
        purpose: 'Collaborative safety planning',
        inclusionStatus: 'core',
        settings: 'all settings',
        path: '/chart/screenings/stanley-and-brown',
      },
      {
        toolId: 'TL-008',
        name: 'Means Safety Counseling',
        purpose: 'Lethal means reduction',
        inclusionStatus: 'core',
        settings: 'all settings',
      },
      {
        toolId: 'TL-021',
        name: 'CAMS Stabilization Support Plan',
        purpose: 'Collaborative stabilization / safety planning within CAMS',
        inclusionStatus: 'optional',
        settings: 'behavioral health, outpatient',
        path: '/chart/screenings/cams-stabilization-plan',
      },
      {
        toolId: 'TL-013',
        name: 'Now Matters Now',
        purpose: 'Patient-facing coping-skills and safety-plan support resource',
        inclusionStatus: 'optional',
        settings: 'all settings',
      },
      {
        toolId: 'TL-015',
        name: 'Crisis Response Planning',
        purpose: 'Alternative crisis-planning framework',
        inclusionStatus: 'future',
        settings: 'military, VA, behavioral health',
      },
      {
        toolId: 'TL-016',
        name: 'CALM / Means Safety Counseling Protocol',
        purpose: 'Named means-safety protocol option',
        inclusionStatus: 'future',
        settings: 'all settings',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-014',
        event: 'CAMS Stabilization Support Plan updated',
        condition: 'Plan version updated',
        action: 'Update active plan version, patient copy status, and means-safety fields',
      },
    ],
  },
  {
    id: 'transition',
    title: 'Transition',
    description: 'Pre-discharge or transfer checkpoint ensuring continuity of care.',
    tools: [
      {
        toolId: 'TL-009',
        name: 'Transition Checkpoint',
        purpose: 'Pre-discharge transfer of care',
        inclusionStatus: 'core',
        settings: 'all settings',
      },
      {
        toolId: 'TL-023',
        name: 'CAMS SSF-5 Outcome/Disposition Final Session',
        purpose: 'Episode closure, disposition, and next-step planning',
        inclusionStatus: 'optional',
        settings: 'behavioral health, outpatient',
      },
      {
        toolId: 'TL-017',
        name: 'Rapid Referral to Outpatient Behavioral Healthcare',
        purpose: 'Warm handoff and accelerated access to follow-up',
        inclusionStatus: 'future',
        settings: 'ED, inpatient',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-008',
        event: 'Disposition = discharge or transfer',
        condition: 'Active suicide safer care episode',
        action: 'Create transition bundle, follow-up appointment requirement, and follow-up task',
      },
      {
        triggerId: 'TRG-015',
        event: 'CAMS Outcome/Disposition Final Session completed',
        condition: 'Episode state updated',
        action: 'Store outcome/disposition and create transition/follow-up tasks',
      },
    ],
  },
  {
    id: 'follow-up',
    title: 'Follow-up',
    description: 'Closed-loop outreach and caring contacts after discharge or transition.',
    tools: [
      {
        toolId: 'TL-010',
        name: 'Outreach / Caring Contacts',
        purpose: 'Closed-loop follow-up',
        inclusionStatus: 'core',
        settings: 'all settings',
      },
      {
        toolId: 'TL-012',
        name: 'ED-SAFE / CLASP-ED Follow-up Protocol',
        purpose: 'Protocol-based post-discharge follow-up',
        inclusionStatus: 'optional',
        settings: 'ED',
      },
      {
        toolId: 'TL-018',
        name: 'Colorado Post-Visit Protocol',
        purpose: 'Protocol-based post-visit outreach',
        inclusionStatus: 'future',
        settings: 'ED, ambulatory',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-009',
        event: 'Discharge timestamp recorded',
        condition: 'Patient discharged with active episode',
        action: 'Create 24\u201348 hour outreach task',
      },
      {
        triggerId: 'TRG-010',
        event: 'Missed appointment or failed outreach',
        condition: 'Outreach attempt unsuccessful',
        action: 'Create escalation task and update queue / registry state',
      },
      {
        triggerId: 'TRG-011',
        event: 'ED-SAFE protocol assigned at discharge',
        condition: 'Protocol assigned',
        action: 'Create protocol-based outreach task sequence using local cadence',
      },
    ],
  },
  {
    id: 'monitor',
    title: 'Monitor',
    description: 'Ongoing in-episode monitoring, reassessment, and treatment updates until resolution.',
    tools: [
      {
        toolId: 'TL-022',
        name: 'CAMS SSF-5 Interim Sessions',
        purpose: 'Ongoing in-episode monitoring and treatment update',
        inclusionStatus: 'optional',
        settings: 'behavioral health, outpatient',
        path: '/chart/screenings/cams-section-a',
      },
    ],
    triggers: [
      {
        triggerId: 'TRG-016',
        event: 'CAMS Interim Session completed',
        condition: 'Interim session findings persisted',
        action: 'Update trendable findings, monitoring state, and resolution tracking',
      },
    ],
  },
]
