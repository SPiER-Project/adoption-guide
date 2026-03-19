export interface WorkflowTool {
  name: string
  description: string
  status: 'active' | 'coming-soon'
  path?: string // link to tool if active
}

export interface CdsHookExample {
  title: string
  description: string
  hookJson: object
}

export interface WorkflowPhase {
  id: string
  title: string
  description: string
  tools: WorkflowTool[]
  cdsHook?: CdsHookExample
}

export const WORKFLOW_PHASES: WorkflowPhase[] = [
  {
    id: 'screening',
    title: 'Screening',
    description: 'Universal or targeted screening to identify patients who may be at risk.',
    tools: [
      {
        name: 'PHQ-9 (Item 9)',
        description: 'Depression screening with 9 items (0-27). Item 9 asks about self-harm thoughts — the most common screening gateway for suicide risk assessment.',
        status: 'active',
        path: '/chart/screenings/phq-9',
      },
      {
        name: 'ASQ (Ask Suicide-Screening Questions)',
        description: 'Brief 4-question screening tool (~20 sec) validated for youth (8+) and adults across ED, inpatient, outpatient, and primary care.',
        status: 'active',
        path: '/chart/screenings/asq',
      },
      {
        name: 'SBQ-R (Suicide Behaviors Questionnaire-Revised)',
        description: '4-item self-report covering lifetime ideation, past-year frequency, threat disclosure, and future likelihood. Score 3-18.',
        status: 'active',
        path: '/chart/screenings/sbq-r',
      },
    ],
    cdsHook: {
      title: 'patient-screening-due',
      description: 'Fires when a patient encounter is opened and no suicide screening has been completed within the configured timeframe.',
      hookJson: {
        hook: 'patient-view',
        name: 'Suicide Risk Screening Due',
        description: 'Recommend universal suicide screening for patients without a recent screening on file.',
        id: 'spier-screening-due',
        prefetch: {
          screenings: 'Observation?patient={{context.patientId}}&code=http://loinc.org|44261-6&_sort=-date&_count=1',
        },
      },
    },
  },
  {
    id: 'assessment',
    title: 'Assessment',
    description: 'Comprehensive risk assessment for patients who screen positive.',
    tools: [
      {
        name: 'C-SSRS Screener (6-item)',
        description: 'Quick risk assessment with 3-tier stratification (Low/Moderate/High). 6 questions with enableWhen logic.',
        status: 'active',
        path: '/chart/screenings/cssrs-screener',
      },
      {
        name: 'C-SSRS Full (Lifetime/Recent)',
        description: '5-level ideation hierarchy, intensity ratings, full behavior section with lethality scoring. Comprehensive assessment.',
        status: 'active',
        path: '/chart/screenings/cssrs-full',
      },
      {
        name: 'SAFE-T (Suicide Assessment Five-Step Eval & Triage)',
        description: 'Structured clinical interview guide for comprehensive suicide risk evaluation.',
        status: 'coming-soon',
      },
    ],
    cdsHook: {
      title: 'positive-screen-assessment',
      description: 'Fires when a screening result indicates elevated risk, recommending a full risk assessment.',
      hookJson: {
        hook: 'order-sign',
        name: 'Positive Suicide Screen — Assessment Recommended',
        description: 'Patient screened positive on PHQ-9 Item 9 or ASQ. Recommend C-SSRS or SAFE-T assessment.',
        id: 'spier-positive-screen',
        prefetch: {
          screening: 'Observation?patient={{context.patientId}}&code=http://loinc.org|44261-6&_sort=-date&_count=1',
        },
      },
    },
  },
  {
    id: 'stratification',
    title: 'Risk Stratification',
    description: 'Automated or clinician-guided risk level classification based on assessment results.',
    tools: [
      {
        name: 'Risk Stratification Logic',
        description: 'Rules-based classification: Negative, Historical, Low, Moderate, High, Imminent. Drives workflow routing.',
        status: 'coming-soon',
      },
    ],
    cdsHook: {
      title: 'risk-level-determined',
      description: 'Fires after risk stratification is complete, triggering appropriate downstream workflows based on risk level.',
      hookJson: {
        hook: 'patient-view',
        name: 'Suicide Risk Level Alert',
        description: 'Patient risk level determined as HIGH. Recommend immediate safety planning and lethal means counseling.',
        id: 'spier-risk-alert',
        indicator: 'critical',
        source: { label: 'SPiER Risk Engine' },
        suggestions: [
          {
            label: 'Launch Stanley-Brown Safety Plan',
            actions: [{ type: 'create', description: 'Open safety planning questionnaire' }],
          },
          {
            label: 'Launch CAMS Assessment',
            actions: [{ type: 'create', description: 'Open CAMS SSF-5 assessment' }],
          },
        ],
      },
    },
  },
  {
    id: 'safety-planning',
    title: 'Safety Planning',
    description: 'Collaborative creation of a safety plan and/or stabilization plan with the patient.',
    tools: [
      {
        name: 'Stanley-Brown Safety Plan',
        description: '7-step safety plan with LOINC-coded fields. Generates a FHIR CarePlan resource.',
        status: 'active',
        path: '/chart/screenings/stanley-and-brown',
      },
      {
        name: 'CAMS Stabilization Plan',
        description: 'Collaborative stabilization plan including lethal means counseling, coping strategies, and support network.',
        status: 'active',
        path: '/chart/screenings/cams-stabilization-plan',
      },
      {
        name: 'Now Matters Now (Emotional Fire Safety Plan)',
        description: 'DBT-informed emotional safety planning tool.',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'follow-up',
    title: 'Follow-up & Monitoring',
    description: 'Ongoing monitoring, reassessment, and treatment until drivers are resolved.',
    tools: [
      {
        name: 'CAMS Therapeutic Worksheet',
        description: 'Exploration of suicide drivers with direct/indirect classification and crisis model development.',
        status: 'active',
        path: '/chart/screenings/cams-therapeutic-worksheet',
      },
      {
        name: 'CAMS SSF-5 Reassessment',
        description: 'Repeat Section A ratings to track vital signs longitudinally across sessions.',
        status: 'active',
        path: '/chart/screenings/cams-section-a',
      },
      {
        name: 'Follow-up Contact Protocol',
        description: 'Structured outreach cadence based on risk level (caring contacts, appointment reminders).',
        status: 'coming-soon',
      },
    ],
    cdsHook: {
      title: 'follow-up-overdue',
      description: 'Fires when a patient with an active safety plan has not had a follow-up contact within the risk-stratified timeframe.',
      hookJson: {
        hook: 'patient-view',
        name: 'Follow-up Overdue — Active Safety Plan',
        description: 'Patient has an active safety plan but no follow-up contact in 7 days. Risk level: HIGH.',
        id: 'spier-follow-up-overdue',
        indicator: 'warning',
      },
    },
  },
]
