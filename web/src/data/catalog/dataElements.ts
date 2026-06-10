export type FhirResourceType =
  | 'QuestionnaireResponse'
  | 'Observation'
  | 'Condition'
  | 'CarePlan'

export interface DataElement {
  id: string                          // stable slug, 'phq9-item9'
  name: string                        // human label, 'Thoughts of death/self-harm (Item 9)'
  code: string                        // '44260-8' or 'N/A'
  codeSystem: string                  // 'LOINC', 'SNOMED CT', 'http://spier.org/...', etc.
  codeDisplay: string
  fhirResource: FhirResourceType
  fhirPath: string
  usedBy: string[]                    // tool IDs — ['TL-002', 'TL-020', ...]
  description: string
}

// Tool ID aliases used in the old flat DATA_DICTIONARY tool field:
//   C-SSRS       → TL-003 (screener) + TL-004 (full)
//   PHQ-9        → TL-002
//   SBQ-R        → TL-025
//   ASQ          → TL-001
//   Stanley-Brown → TL-007
//   CAMS          → TL-020 + TL-021 + TL-024 (family)
//   Both          → TL-007 + TL-020

const TOOLS_CSSRS = ['TL-003', 'TL-004']
const TOOLS_CAMS_SSF = ['TL-020']
// const TOOLS_CAMS_FAMILY = ['TL-020', 'TL-021', 'TL-024']

export const DATA_ELEMENTS: DataElement[] = [
  // ── C-SSRS ──
  {
    id: 'cssrs-screener-panel',
    name: 'C-SSRS Screener Panel',
    code: '93373-9',
    codeSystem: 'LOINC',
    codeDisplay: 'Columbia-suicide severity rating scale screener - recent',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'questionnaire',
    usedBy: ['TL-003'],
    description: 'LOINC panel code for the C-SSRS Screener (6-item, recent). Three-tier risk stratification.',
  },
  {
    id: 'cssrs-full-panel',
    name: 'C-SSRS Full Panel',
    code: '93245-9',
    codeSystem: 'LOINC',
    codeDisplay: 'Columbia-suicide severity rating scale - lifetime recent',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'questionnaire',
    usedBy: ['TL-004'],
    description: 'LOINC panel code for the C-SSRS Full Lifetime/Recent version. 5-level ideation + intensity + behavior.',
  },
  {
    id: 'cssrs-wish-dead',
    name: 'Wish to be dead',
    code: '93246-7',
    codeSystem: 'LOINC',
    codeDisplay: 'Wish to be dead',
    fhirResource: 'Observation',
    fhirPath: 'valueBoolean',
    usedBy: TOOLS_CSSRS,
    description: 'C-SSRS Level 1: Passive death wish. Low risk tier.',
  },
  {
    id: 'cssrs-nonspecific-active',
    name: 'Non-specific active suicidal thoughts',
    code: '93247-5',
    codeSystem: 'LOINC',
    codeDisplay: 'Non-specific active suicidal thoughts',
    fhirResource: 'Observation',
    fhirPath: 'valueBoolean',
    usedBy: TOOLS_CSSRS,
    description: 'C-SSRS Level 2: General thoughts of wanting to die. Low risk tier. If Yes, Q3–5 are triggered.',
  },
  {
    id: 'cssrs-methods-no-intent',
    name: 'Ideation with methods, no intent',
    code: '93248-3',
    codeSystem: 'LOINC',
    codeDisplay: 'Active suicidal ideation with any methods without intent to act',
    fhirResource: 'Observation',
    fhirPath: 'valueBoolean',
    usedBy: TOOLS_CSSRS,
    description: 'C-SSRS Level 3: Thought of method but no plan or intent. Moderate risk tier.',
  },
  {
    id: 'cssrs-some-intent',
    name: 'Ideation with some intent',
    code: '93249-1',
    codeSystem: 'LOINC',
    codeDisplay: 'Active suicidal ideation with some intent to act without specific plan',
    fhirResource: 'Observation',
    fhirPath: 'valueBoolean',
    usedBy: TOOLS_CSSRS,
    description: 'C-SSRS Level 4: Some intent to act on thoughts. Moderate risk tier.',
  },
  {
    id: 'cssrs-plan-intent',
    name: 'Ideation with specific plan and intent',
    code: '93250-9',
    codeSystem: 'LOINC',
    codeDisplay: 'Active suicidal ideation with specific plan and intent',
    fhirResource: 'Observation',
    fhirPath: 'valueBoolean',
    usedBy: TOOLS_CSSRS,
    description: 'C-SSRS Level 5: Plan worked out with intent to carry out. High risk tier.',
  },
  {
    id: 'cssrs-behavior-ever',
    name: 'Suicidal behavior (ever)',
    code: '93267-3',
    codeSystem: 'LOINC',
    codeDisplay: 'Have you ever done anything to end your life',
    fhirResource: 'Observation',
    fhirPath: 'valueBoolean',
    usedBy: TOOLS_CSSRS,
    description: 'C-SSRS Q6 / Behavior section: Any lifetime suicidal behavior. High risk tier.',
  },
  {
    id: 'suicide-risk-level',
    name: 'Suicide risk level',
    code: '93374-7',
    codeSystem: 'LOINC',
    codeDisplay: 'Suicide risk level',
    fhirResource: 'Observation',
    fhirPath: 'valueCodeableConcept',
    // Cross-cutting: derived from C-SSRS and reused as CAMS overall risk.
    usedBy: [...TOOLS_CSSRS, ...TOOLS_CAMS_SSF],
    description: 'Derived risk level: Low (Q1–2), Moderate (Q3–4), High (Q5 or Q6+recent). Reused as CAMS overall risk.',
  },
  {
    id: 'cssrs-actual-lethality',
    name: 'Actual lethality/medical damage',
    code: '93271-5',
    codeSystem: 'LOINC',
    codeDisplay: 'Actual lethality/medical damage most lethal suicide attempt',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: ['TL-004'],
    description: 'Lethality scale 0–5 (no damage to death) for the most lethal attempt. Full version only.',
  },

  // ── PHQ-9 ──
  {
    id: 'phq9-panel',
    name: 'PHQ-9 Panel',
    code: '44249-1',
    codeSystem: 'LOINC',
    codeDisplay: 'PHQ-9 quick depression assessment panel',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'questionnaire',
    usedBy: ['TL-002'],
    description: 'LOINC panel code for the complete PHQ-9 instrument. 9 items scored 0–3, total 0–27.',
  },
  {
    id: 'phq9-item1',
    name: 'Little interest or pleasure',
    code: '44250-9',
    codeSystem: 'LOINC',
    codeDisplay: 'Little interest or pleasure in doing things',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q1].answer.valueCoding',
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 1: Anhedonia. Scored 0 (Not at all) to 3 (Nearly every day).',
  },
  {
    id: 'phq9-item2',
    name: 'Feeling down/depressed',
    code: '44255-8',
    codeSystem: 'LOINC',
    codeDisplay: 'Feeling down, depressed, or hopeless',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q2].answer.valueCoding',
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 2: Depressed mood. Scored 0–3.',
  },
  {
    id: 'phq9-item9',
    name: 'Thoughts of death/self-harm (Item 9)',
    code: '44260-8',
    codeSystem: 'LOINC',
    codeDisplay: 'Thoughts that you would be better off dead or of hurting yourself',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q9].answer.valueCoding',
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 9: Suicidal ideation screening gateway. Score ≥1 should trigger further suicide risk assessment (ASQ, C-SSRS). Critical for workflow routing.',
  },
  {
    id: 'phq9-total',
    name: 'PHQ-9 Total Score',
    code: '44261-6',
    codeSystem: 'LOINC',
    codeDisplay: 'Patient Health Questionnaire 9 item total score',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: ['TL-002'],
    description: 'Sum of all 9 items (0–27). Severity: 0–4 Minimal, 5–9 Mild, 10–14 Moderate, 15–19 Moderately Severe, 20–27 Severe.',
  },
  {
    id: 'phq9-functional',
    name: 'Functional Difficulty',
    code: '69722-7',
    codeSystem: 'LOINC',
    codeDisplay: 'How difficult have these problems made it for you',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[difficulty].answer.valueCoding',
    usedBy: ['TL-002'],
    description: 'Functional impairment question: Not difficult at all / Somewhat / Very / Extremely difficult.',
  },

  // ── SBQ-R ──
  {
    id: 'sbqr-q1',
    name: 'Lifetime ideation/attempt',
    code: 'N/A',
    codeSystem: 'http://spier.org/CodeSystem/sbqr-q1',
    codeDisplay: 'Have you ever thought about or attempted to kill yourself',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q1].answer.valueCoding',
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 1: 6 options mapping to 4 subgroups — Non-Suicidal (1pt), Ideation (2pt), Plan (3pt), Attempt (4pt). ordinalValue encoded.',
  },
  {
    id: 'sbqr-q2',
    name: 'Past-year ideation frequency',
    code: 'N/A',
    codeSystem: 'http://spier.org/CodeSystem/sbqr-q2',
    codeDisplay: 'How often have you thought about killing yourself in the past year',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q2].answer.valueCoding',
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 2: Never (1pt) to Very Often/5+ times (5pt). ordinalValue encoded.',
  },
  {
    id: 'sbqr-q3',
    name: 'Threat of suicide attempt',
    code: 'N/A',
    codeSystem: 'http://spier.org/CodeSystem/sbqr-q3',
    codeDisplay: 'Have you ever told someone that you were going to commit suicide',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q3].answer.valueCoding',
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 3: 5 options mapping to 3 levels — No (1pt), Yes once (2pt), Yes more than once (3pt). ordinalValue encoded.',
  },
  {
    id: 'sbqr-q4',
    name: 'Future likelihood of attempt',
    code: 'N/A',
    codeSystem: 'http://spier.org/CodeSystem/sbqr-q4',
    codeDisplay: 'How likely is it that you will attempt suicide someday',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[q4].answer.valueCoding',
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 4: Never (0pt) to Very Likely (6pt). ordinalValue encoded.',
  },
  {
    id: 'sbqr-total',
    name: 'SBQ-R Total Score',
    code: 'N/A',
    codeSystem: 'N/A',
    codeDisplay: 'SBQ-R total score (range 3-18)',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: ['TL-025'],
    description: 'Sum of all 4 items. Cutoff: ≥7 general population (93% sensitivity, 95% specificity), ≥8 psychiatric inpatients (80% sensitivity, 91% specificity).',
  },

  // ── ASQ ──
  {
    id: 'asq-q1-wished-dead',
    name: 'Wished you were dead',
    code: 'wished-dead',
    codeSystem: 'http://spier.org/CodeSystem/asq-item',
    codeDisplay: 'In the past few weeks, have you wished you were dead',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[0].item[0].answer[0].valueBoolean',
    usedBy: ['TL-001'],
    description: 'ASQ Question 1: Passive death wish screening question. Yes/No response.',
  },
  {
    id: 'asq-q2-family',
    name: 'Family better off if dead',
    code: 'family-better-off-dead',
    codeSystem: 'http://spier.org/CodeSystem/asq-item',
    codeDisplay: 'In the past few weeks, have you felt that you or your family would be better off if you were dead',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[0].item[1].answer[0].valueBoolean',
    usedBy: ['TL-001'],
    description: 'ASQ Question 2: Perceived burdensomeness screening question. Yes/No response.',
  },
  {
    id: 'asq-q3-thoughts',
    name: 'Thoughts about killing yourself',
    code: 'thoughts-killing-self',
    codeSystem: 'http://spier.org/CodeSystem/asq-item',
    codeDisplay: 'In the past week, have you been having thoughts about killing yourself',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[0].item[2].answer[0].valueBoolean',
    usedBy: ['TL-001'],
    description: 'ASQ Question 3: Active suicidal ideation in past week. Yes/No response.',
  },
  {
    id: 'asq-q4-ever-tried',
    name: 'Ever tried to kill yourself',
    code: 'ever-attempted',
    codeSystem: 'http://spier.org/CodeSystem/asq-item',
    codeDisplay: 'Have you ever tried to kill yourself',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[0].item[3].answer[0].valueBoolean',
    usedBy: ['TL-001'],
    description: 'ASQ Question 4: Lifetime suicide attempt history. Yes/No response.',
  },
  {
    id: 'asq-q5-acuity',
    name: 'Acuity: Killing yourself right now',
    code: 'acute-ideation-now',
    codeSystem: 'http://spier.org/CodeSystem/asq-item',
    codeDisplay: 'Are you having thoughts of killing yourself right now',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'item[1].item[0].answer[0].valueBoolean',
    usedBy: ['TL-001'],
    description: 'ASQ Question 5 (acuity): Current active suicidal ideation. Only asked if Yes to any Q1–Q4. Determines acute vs non-acute positive.',
  },
  {
    id: 'asq-result',
    name: 'ASQ Screening Result',
    code: 'N/A',
    codeSystem: 'http://spier.org/CodeSystem/asq-screening-result',
    codeDisplay: 'Screening result category (negative / non-acute-positive / acute-positive)',
    fhirResource: 'Observation',
    fhirPath: 'valueCodeableConcept',
    usedBy: ['TL-001'],
    description: 'Three-tier risk stratification: Negative Screen, Non-Acute Positive (potential risk), Acute Positive (imminent risk).',
  },

  // ── Stanley-Brown Safety Plan ──
  {
    id: 'sb-warning-signs',
    name: 'Warning Signs',
    code: '76689-1',
    codeSystem: 'LOINC',
    codeDisplay: 'Self-reported crisis warning signs',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[0].detail.description',
    usedBy: ['TL-007'],
    description: 'Patient-identified thoughts, images, mood, situation, or behaviors that indicate a crisis may be developing.',
  },
  {
    id: 'sb-internal-coping',
    name: 'Internal Coping Strategies',
    code: '76690-9',
    codeSystem: 'LOINC',
    codeDisplay: 'Self-reported distraction strategies to take mind off problems',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[1].detail.description',
    usedBy: ['TL-007'],
    description: 'Things the patient can do on their own to take their mind off problems without contacting another person.',
  },
  {
    id: 'sb-social-distraction',
    name: 'Social Distraction Contacts',
    code: '76691-7',
    codeSystem: 'LOINC',
    codeDisplay: 'Self-reported people and social settings that provide distraction',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[2].detail.description',
    usedBy: ['TL-007'],
    description: 'People and social settings that help take the patient\u2019s mind off problems.',
  },
  {
    id: 'sb-crisis-support',
    name: 'Crisis Support Contacts',
    code: '76692-5',
    codeSystem: 'LOINC',
    codeDisplay: 'Self-reported people whom I can ask for help during a crisis',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[3].detail.description',
    usedBy: ['TL-007'],
    description: 'Family members or friends the patient can contact for help during a crisis.',
  },
  {
    id: 'sb-professional-support',
    name: 'Professional Support',
    code: '76693-3',
    codeSystem: 'LOINC',
    codeDisplay: 'Self-reported professionals or professional services I can contact during a crisis',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[4].detail.description',
    usedBy: ['TL-007'],
    description: 'Clinicians, agencies, crisis lines (988), and local ED contact information.',
  },
  {
    id: 'sb-lethal-means',
    name: 'Lethal Means Safety',
    code: '76694-1',
    codeSystem: 'LOINC',
    codeDisplay: 'Self-reported plan for lethal means safety',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[5].detail.description',
    usedBy: ['TL-007'],
    description: 'Steps to make the environment safer by restricting access to lethal means.',
  },
  {
    id: 'sb-reason-for-living',
    name: 'Reason for Living',
    code: '81344-4',
    codeSystem: 'LOINC',
    codeDisplay: 'Reasons for living',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[6].detail.description',
    usedBy: ['TL-007'],
    description: 'The most important thing to the patient that is worth living for.',
  },
  {
    id: 'safety-plan-category',
    name: 'Safety Plan Category',
    code: '735324008',
    codeSystem: 'SNOMED CT',
    codeDisplay: 'Treatment plan for suicide prevention',
    fhirResource: 'CarePlan',
    fhirPath: 'category[0].coding[0]',
    // Cross-cutting: same SNOMED category is used by Stanley-Brown and CAMS Stabilization.
    usedBy: ['TL-007', 'TL-021'],
    description: 'SNOMED category code classifying the CarePlan as a suicide prevention treatment plan.',
  },

  // ── CAMS SSF-5 Section A ──
  {
    id: 'cams-psych-pain',
    name: 'Psychological Pain Rating',
    code: 'psychological-pain',
    codeSystem: 'http://spier.org/CodeSystem/cams-ssf',
    codeDisplay: 'Psychological Pain',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated psychological pain on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-stress',
    name: 'Stress Rating',
    code: 'stress',
    codeSystem: 'http://spier.org/CodeSystem/cams-ssf',
    codeDisplay: 'Stress',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated stress on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-agitation',
    name: 'Agitation Rating',
    code: 'agitation',
    codeSystem: 'http://spier.org/CodeSystem/cams-ssf',
    codeDisplay: 'Agitation',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated agitation on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-hopelessness',
    name: 'Hopelessness Rating',
    code: 'hopelessness',
    codeSystem: 'http://spier.org/CodeSystem/cams-ssf',
    codeDisplay: 'Hopelessness',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated hopelessness on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-self-hate',
    name: 'Self-Hate Rating',
    code: 'self-hate',
    codeSystem: 'http://spier.org/CodeSystem/cams-ssf',
    codeDisplay: 'Self-Hate',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated self-hate on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-overall-risk',
    name: 'Overall Risk Rating',
    code: 'overall-risk',
    codeSystem: 'http://spier.org/CodeSystem/cams-ssf',
    codeDisplay: 'Overall Risk of Suicide',
    fhirResource: 'Observation',
    fhirPath: 'valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated overall risk on 1–5 scale. Tracked longitudinally across sessions.',
  },

  // ── CAMS Section B - Drivers ──
  {
    id: 'cams-driver',
    name: 'Suicide Driver',
    code: 'suicide-driver',
    codeSystem: 'http://cams-care.com/driver-category',
    codeDisplay: 'Suicide driver condition',
    fhirResource: 'Condition',
    fhirPath: 'code.text',
    usedBy: ['TL-020', 'TL-024'],
    description: 'A problem identified by patient/clinician as driving suicidal thoughts. Tracked on problem list until resolved.',
  },
  {
    id: 'cams-driver-type',
    name: 'Driver Type',
    code: 'direct | indirect',
    codeSystem: 'http://cams-care.com/driver-type',
    codeDisplay: 'Direct or indirect driver classification',
    fhirResource: 'Condition',
    fhirPath: 'category[0].coding[0]',
    usedBy: ['TL-020', 'TL-024'],
    description: 'Classification of whether a driver directly causes suicidal ideation or indirectly contributes.',
  },

  // ── CAMS Stabilization Plan ──
  {
    id: 'cams-stab-lethal-means',
    name: 'Lethal Means Reduction',
    code: 'N/A',
    codeSystem: 'N/A',
    codeDisplay: 'Lethal means reduction actions',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[0].detail.description',
    usedBy: ['TL-021'],
    description: 'Steps to reduce access to lethal means identified in CAMS stabilization plan.',
  },
  {
    id: 'cams-stab-coping',
    name: 'Coping Strategies',
    code: 'N/A',
    codeSystem: 'N/A',
    codeDisplay: 'Patient coping strategies',
    fhirResource: 'CarePlan',
    fhirPath: 'activity[1].detail.description',
    usedBy: ['TL-021'],
    description: 'Self-management strategies identified during CAMS stabilization planning.',
  },

  // ── Shared / Cross-cutting ──
  {
    id: 'careplan-us-profile',
    name: 'CarePlan Profile',
    code: 'us-ecareplan',
    codeSystem: 'http://hl7.org/fhir/us/ecareplan',
    codeDisplay: 'US Core eCare Plan profile',
    fhirResource: 'CarePlan',
    fhirPath: 'meta.profile[0]',
    usedBy: ['TL-007', 'TL-021'],
    description: 'Both Stanley-Brown and CAMS CarePlans conform to the US Core eCare Plan StructureDefinition.',
  },
]

// Utility functions
import { TOOLS, toolById } from './tools'

export const elementsUsedByTool = (toolId: string) =>
  DATA_ELEMENTS.filter(e => e.usedBy.includes(toolId))

/**
 * Primary stage for a data element — the earliest-ordered stage among its using tools.
 * Returns stage id or undefined if no using tool is found.
 */
export const primaryStageFor = (el: DataElement): string | undefined => {
  const stages = el.usedBy
    .map(toolId => toolById(toolId)?.stageId)
    .filter((s): s is string => !!s)
  if (stages.length === 0) return undefined
  // Lower orderIndex wins — but we don't import STAGES here to avoid cycles.
  // Caller is expected to sort; here we just pick the first referenced stage in tool order.
  const toolOrder = new Map(TOOLS.map((t, i) => [t.id, i]))
  const sortedToolIds = [...el.usedBy].sort((a, b) => (toolOrder.get(a) ?? 0) - (toolOrder.get(b) ?? 0))
  return toolById(sortedToolIds[0])?.stageId
}

/**
 * All tools referenced by a data element, in catalog order.
 */
export const toolsForElement = (el: DataElement) =>
  el.usedBy
    .map(toolId => toolById(toolId))
    .filter((t): t is NonNullable<ReturnType<typeof toolById>> => !!t)
