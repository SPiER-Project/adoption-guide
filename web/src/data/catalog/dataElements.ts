export type FhirResourceType =
  | 'QuestionnaireResponse'
  | 'Observation'
  | 'Condition'
  | 'CarePlan'

/**
 * A FHIR Coding, written the way FHIR writes one.
 *
 * `system` is a URL, never a friendly name — that is load-bearing rather than
 * cosmetic. `web/scripts/check-codings.mjs` finds terminology by matching a
 * system-URL literal and then requiring a sibling `system` field on the
 * enclosing object literal. The previous shape here spelled it
 * `codeSystem: 'LOINC'`, so not one of these rows was ever validated — the
 * whole dictionary sat outside the nightly gate while looking, to a reader,
 * exactly like the authoritative list of codes to use. See issue #261, and
 * #220 for what that costs.
 *
 * The friendly label ('LOINC', 'SNOMED CT') is now derived from the URL by
 * `systemLabel()` for display, rather than being the stored truth.
 */
export interface Coding {
  system: string                      // URL — 'http://loinc.org', 'http://spier.org/CodeSystem/asq-item'
  code: string
  display: string
}

export interface DataElement {
  id: string                          // stable slug, 'phq9-item9'
  name: string                        // human label, 'Thoughts of death/self-harm (Item 9)'
  /**
   * The code identifying this element. Absent when the element genuinely has
   * none — an instrument whose items carry no item code, or a row that
   * documents something other than a coded concept.
   */
  coding?: Coding
  /**
   * For an item with no item code: the CodeSystem its *answers* are drawn
   * from. This is a value-side vocabulary, deliberately kept in its own field
   * rather than smuggled into `coding` — conflating an element's code with its
   * value is the defect the accuracy pass removed, and the full separation is
   * the Concept/Binding split in #260.
   */
  answerSystem?: string
  fhirResource: FhirResourceType
  fhirPath: string
  usedBy: string[]                    // tool IDs — ['TL-002', 'TL-020', ...]
  description: string
}

const SYSTEM_LABELS: Record<string, string> = {
  'http://loinc.org': 'LOINC',
  'http://snomed.info/sct': 'SNOMED CT',
}

/**
 * Short label for a system URL. External vocabularies get their common name;
 * SPiER-local CodeSystems get their id (the URL itself stays available for the
 * `title` attribute and for search, so nothing an implementer needs is lost).
 */
export function systemLabel(system: string): string {
  const known = SYSTEM_LABELS[system]
  if (known) return known
  if (system.startsWith('http://terminology.hl7.org/CodeSystem/')) {
    return `HL7 ${system.slice('http://terminology.hl7.org/CodeSystem/'.length)}`
  }
  if (system.startsWith('http://spier.org/CodeSystem/')) {
    return `SPiER ${system.slice('http://spier.org/CodeSystem/'.length)}`
  }
  return system
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

/**
 * The six past-month LOINC item codes are emitted as Observations by the
 * Screener and the Pediatric screener only — both run `mapCSSRSScreenerCore`
 * with the default `CSSRS_SCREENER_ITEM_CODES`. The Full version carries some
 * of the same codes as Questionnaire *item* codes but emits no per-item
 * Observations (see `cssrsFull.ts`), and the Since Last Contact version
 * substitutes SPiER-local `cssrs-interval-item` codes because LOINC publishes
 * nothing for a "since last contact" window.
 */
const TOOLS_CSSRS_PAST_MONTH = ['TL-003', 'TL-027']

export const DATA_ELEMENTS: DataElement[] = [
  // ── C-SSRS ──
  {
    id: 'cssrs-screener-panel',
    name: 'C-SSRS Screener Panel',
    coding: { system: 'http://loinc.org', code: '93373-9', display: 'Columbia - suicide severity rating scale screener - recent [C-SSRS]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'QuestionnaireResponse.questionnaire',
    usedBy: ['TL-003'],
    description: 'LOINC panel code for the C-SSRS Screener (6-item, recent). Three-tier risk stratification.',
  },
  {
    id: 'cssrs-full-panel',
    name: 'C-SSRS Full Panel',
    coding: { system: 'http://loinc.org', code: '93245-9', display: 'Columbia - suicide severity rating scale - lifetime recent [C-SSRS]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'QuestionnaireResponse.questionnaire',
    usedBy: ['TL-004'],
    description: 'LOINC panel code for the C-SSRS Full Lifetime/Recent version. 5-level ideation + intensity + behavior.',
  },
  {
    id: 'cssrs-wish-dead',
    name: 'Wish to be dead',
    coding: { system: 'http://loinc.org', code: '93246-7', display: 'Wish to be dead 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 1: Passive death wish, past month. Low risk tier. LOINC scopes this code to a 1-month reference period — the Since Last Contact version uses a SPiER-local interval code instead.',
  },
  {
    id: 'cssrs-nonspecific-active',
    name: 'Non-specific active suicidal thoughts',
    coding: { system: 'http://loinc.org', code: '93247-5', display: 'Non-specific active suicidal thoughts 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 2: General thoughts of wanting to die, past month. Low risk tier. If Yes, Q3–5 are triggered.',
  },
  {
    id: 'cssrs-methods-no-intent',
    name: 'Ideation with methods, no intent',
    coding: { system: 'http://loinc.org', code: '93248-3', display: 'Active suicidal ideation with any methods (not plan) without intent to act 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 3: Thought of method but no plan or intent, past month. Moderate risk tier.',
  },
  {
    id: 'cssrs-some-intent',
    name: 'Ideation with some intent',
    coding: { system: 'http://loinc.org', code: '93249-1', display: 'Active suicidal ideation with some intent to act, without specific plan 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 4: Some intent to act on thoughts, past month. Moderate risk tier.',
  },
  {
    id: 'cssrs-plan-intent',
    name: 'Ideation with specific plan and intent',
    coding: { system: 'http://loinc.org', code: '93250-9', display: 'Active suicidal ideation with specific plan and intent 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 5: Plan worked out with intent to carry out, past month. High risk tier.',
  },
  {
    id: 'cssrs-behavior-ever',
    name: 'Preparatory acts or suicidal behavior (lifetime)',
    coding: { system: 'http://loinc.org', code: '93267-3', display: 'Preparatory acts or suicidal behavior Lifetime' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Q6 / Behavior section: any lifetime suicidal behavior or preparatory act. High risk tier. Note this is a finding code, not a question — LOINC scopes it to Lifetime while the ideation items above are past-month.',
  },
  {
    id: 'suicide-risk-level',
    name: 'Suicide risk level',
    coding: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    // Cross-cutting: derived from C-SSRS (Screener, Full, Since Last Visit, Pediatric) and reused as CAMS overall risk.
    usedBy: [...TOOLS_CSSRS, 'TL-019', 'TL-027', ...TOOLS_CAMS_SSF],
    description: 'Derived risk level: Low (Q1–2), Moderate (Q3–4), High (Q5 or Q6+recent). Shared by the C-SSRS Screener, Full, Since Last Visit, and Pediatric versions; reused as CAMS overall risk. Value = SPiER-local cssrs-risk-level tier; crosswalked to the common suicide-risk tier.',
  },
  {
    id: 'cssrs-actual-lethality',
    name: 'Actual lethality/medical damage',
    coding: { system: 'http://loinc.org', code: '93271-5', display: 'Actual lethality/medical damage most lethal suicide attempt Lifetime [C-SSRS]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='behavior-section').item.where(linkId='lethality-section').item.where(linkId='actual-lethality').answer.valueCoding",
    usedBy: ['TL-004'],
    description: 'Lethality scale 0–5 (no damage to death) for the most lethal attempt. Full version only. Answers are drawn from http://spier.org/CodeSystem/cssrs-lethality; no Observation is currently extracted for this item.',
  },

  // ── PHQ-9 ──
  {
    id: 'phq9-panel',
    name: 'PHQ-9 Panel',
    coding: { system: 'http://loinc.org', code: '44249-1', display: 'PHQ-9 quick depression assessment panel [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'QuestionnaireResponse.questionnaire',
    usedBy: ['TL-002'],
    description: 'LOINC panel code for the complete PHQ-9 instrument. 9 items scored 0–3, total 0–27.',
  },
  // Items 1–9. Every PHQ-9 item code is scoped by LOINC to a 2-week recall
  // window ("in last 2 weeks"), which is part of the concept, not decoration.
  {
    id: 'phq9-item1',
    name: 'Little interest or pleasure',
    coding: { system: 'http://loinc.org', code: '44250-9', display: 'Little interest or pleasure in doing things in last 2 weeks' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q1').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 1: Anhedonia. Scored 0 (Not at all) to 3 (Nearly every day).',
  },
  {
    id: 'phq9-item2',
    name: 'Feeling down/depressed',
    coding: { system: 'http://loinc.org', code: '44255-8', display: 'Feeling down, depressed, or hopeless in last 2 weeks' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q2').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 2: Depressed mood. Scored 0–3.',
  },
  {
    id: 'phq9-item3',
    name: 'Sleep disturbance',
    coding: { system: 'http://loinc.org', code: '44259-0', display: 'Trouble falling or staying asleep, or sleeping too much in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q3').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 3: Insomnia or hypersomnia. Scored 0–3.',
  },
  {
    id: 'phq9-item4',
    name: 'Fatigue / low energy',
    coding: { system: 'http://loinc.org', code: '44254-1', display: 'Feeling tired or having little energy in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q4').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 4: Fatigue. Scored 0–3.',
  },
  {
    id: 'phq9-item5',
    name: 'Appetite change',
    coding: { system: 'http://loinc.org', code: '44251-7', display: 'Poor appetite or overeating in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q5').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 5: Appetite disturbance. Scored 0–3.',
  },
  {
    id: 'phq9-item6',
    name: 'Feeling bad about yourself',
    coding: { system: 'http://loinc.org', code: '44258-2', display: 'Feeling bad about yourself - or that you are a failure or have let yourself or your family down in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q6').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 6: Worthlessness / guilt. Scored 0–3. Clinically adjacent to Item 9 — often elevated alongside suicidal ideation.',
  },
  {
    id: 'phq9-item7',
    name: 'Trouble concentrating',
    coding: { system: 'http://loinc.org', code: '44252-5', display: 'Trouble concentrating on things, such as reading the newspaper or watching television in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q7').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 7: Concentration difficulty. Scored 0–3.',
  },
  {
    id: 'phq9-item8',
    name: 'Psychomotor change',
    coding: { system: 'http://loinc.org', code: '44253-3', display: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q8').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 8: Psychomotor retardation or agitation. Scored 0–3.',
  },
  {
    id: 'phq9-item9',
    name: 'Thoughts of death/self-harm (Item 9)',
    coding: { system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q9').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 9: Suicidal ideation screening gateway. Score ≥1 should trigger further suicide risk assessment (ASQ, C-SSRS). Critical for workflow routing. Also extracted to a standalone Observation carrying the same LOINC code.',
  },
  {
    id: 'phq9-total',
    name: 'PHQ-9 Total Score',
    coding: { system: 'http://loinc.org', code: '44261-6', display: 'Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: ['TL-002'],
    description: 'Sum of all 9 items (0–27). Severity: 0–4 Minimal, 5–9 Mild, 10–14 Moderate, 15–19 Moderately Severe, 20–27 Severe.',
  },
  {
    id: 'phq9-functional',
    name: 'Functional Difficulty',
    coding: { system: 'http://loinc.org', code: '69722-7', display: 'How difficult have these made it for you to do your work, take care of things at home, or get along with other people [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='difficulty').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'Functional impairment question: Not difficult at all / Somewhat / Very / Extremely difficult. Not counted toward the total score.',
  },

  // ── SBQ-R ──
  // The four SBQ-R items carry NO item code — the instrument has no published
  // LOINC or SNOMED item coding, so the Questionnaire leaves `item.code` empty.
  // The system named on each row below is the item's *answer-option*
  // CodeSystem, which is what actually appears in the QuestionnaireResponse.
  {
    id: 'sbqr-q1',
    name: 'Lifetime ideation/attempt',
    answerSystem: 'http://spier.org/CodeSystem/sbqr-q1',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q1').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 1: 6 options mapping to 4 subgroups — Non-Suicidal (1pt), Ideation (2pt), Plan (3pt), Attempt (4pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-q2',
    name: 'Past-year ideation frequency',
    answerSystem: 'http://spier.org/CodeSystem/sbqr-q2',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q2').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 2: Never (1pt) to Very Often/5+ times (5pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-q3',
    name: 'Threat of suicide attempt',
    answerSystem: 'http://spier.org/CodeSystem/sbqr-q3',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q3').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 3: 5 options mapping to 3 levels — No (1pt), Yes once (2pt), Yes more than once (3pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-q4',
    name: 'Future likelihood of attempt',
    answerSystem: 'http://spier.org/CodeSystem/sbqr-q4',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q4').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 4: Never (0pt) to Very Likely (6pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-total',
    name: 'SBQ-R Total Score',
    // SNOMED FSN, matching the item code in sbqr-questionnaire.json.
    coding: { system: 'http://snomed.info/sct', code: '225337009', display: 'Suicide risk assessment (procedure)' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: ['TL-025'],
    description: 'Sum of all 4 items (range 3–18). Cutoff: ≥7 general population (93% sensitivity, 95% specificity), ≥8 psychiatric inpatients (80% sensitivity, 91% specificity). LOINC publishes no SBQ-R total-score code, so the SPiERSBQRTotalScore profile fixes the generic SNOMED suicide-risk-assessment procedure concept instead — a deliberate local choice to re-check at the next major release, not an SBQ-R-specific code.',
  },

  // ── ASQ ──
  // Every ASQ item is `type: choice`, answered with SNOMED 373066001 (Yes) /
  // 373067005 (No) — NOT valueBoolean. Each item is also observationExtract-
  // tagged, so the same asq-item code lands on an extracted Observation.
  {
    id: 'asq-q1-wished-dead',
    name: 'Wished you were dead',
    coding: { system: 'http://spier.org/CodeSystem/asq-item', code: 'wished-dead', display: 'Wished you were dead' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q1').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 1 ("In the past few weeks, have you wished you were dead?"): passive death wish. Answered with the SNOMED Yes/No codings; also extracted to an Observation carrying this same code.',
  },
  {
    id: 'asq-q2-family',
    name: 'Family better off if dead',
    coding: { system: 'http://spier.org/CodeSystem/asq-item', code: 'family-better-off-dead', display: 'Family better off if dead' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q2').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 2 ("…have you felt that you or your family would be better off if you were dead?"): perceived burdensomeness. Answered with the SNOMED Yes/No codings.',
  },
  {
    id: 'asq-q3-thoughts',
    name: 'Thoughts about killing yourself',
    coding: { system: 'http://spier.org/CodeSystem/asq-item', code: 'thoughts-killing-self', display: 'Thoughts about killing yourself' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q3').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 3 ("In the past week, have you been having thoughts about killing yourself?"): active ideation. Answered with the SNOMED Yes/No codings.',
  },
  {
    id: 'asq-q4-ever-tried',
    name: 'Ever tried to kill yourself',
    coding: { system: 'http://spier.org/CodeSystem/asq-item', code: 'ever-attempted', display: 'Ever tried to kill yourself' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q4').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 4 ("Have you ever tried to kill yourself?"): lifetime attempt history. Answered with the SNOMED Yes/No codings.',
  },
  {
    id: 'asq-q4-recent-attempt',
    name: 'Most recent attempt (recency)',
    answerSystem: 'http://spier.org/CodeSystem/asq-attempt-recency',
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q4-recent-attempt').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 4 follow-up: when the most recent attempt occurred. Asked only if Q4 is Yes.',
  },
  {
    id: 'asq-q5-acuity',
    name: 'Acuity: Killing yourself right now',
    coding: { system: 'http://spier.org/CodeSystem/asq-item', code: 'acute-ideation-now', display: 'Killing yourself right now (acuity)' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='acuity-section').item.where(linkId='q5').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 5 ("Are you having thoughts of killing yourself right now?"): current active ideation. Only asked if Yes to any Q1–Q4. Determines acute vs non-acute positive.',
  },
  {
    id: 'asq-result',
    name: 'ASQ Screening Result',
    coding: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-001'],
    description: 'Three-tier risk stratification: Negative Screen, Non-Acute Positive (potential risk), Acute Positive (imminent risk). The Observation is coded with the generic LOINC suicide-risk-level concept; the value is a SPiER-local http://spier.org/CodeSystem/asq-screening-result code, crosswalked to the common suicide-risk tier.',
  },

  // ── BSSA (Brief Suicide Safety Assessment) ──
  {
    id: 'bssa-disposition',
    name: 'BSSA Disposition',
    coding: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'Clinician-selected BSSA disposition (emergency psychiatric evaluation / further evaluation necessary / non-urgent follow-up / no intervention). Value = SPiER-local bssa-disposition tier; crosswalked to the common suicide-risk tier.',
  },
  {
    id: 'bssa-current-ideation',
    name: 'Current suicidal ideation (right now)',
    coding: { system: 'http://spier.org/CodeSystem/bssa-item', code: 'current-ideation', display: 'Current suicidal ideation (right now)' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA acuity signal. A "yes" indicates imminent risk requiring urgent evaluation; the patient cannot be left alone.',
  },
  {
    id: 'bssa-suicide-plan',
    name: 'Has a suicide plan',
    coding: { system: 'http://spier.org/CodeSystem/bssa-item', code: 'suicide-plan', display: 'Has a suicide plan' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA plan/intent assessment. A detailed, feasible plan is a reason for greater concern and means restriction.',
  },
  {
    id: 'bssa-intent-scale',
    name: 'Intent to die (0–10 self-rating)',
    coding: { system: 'http://spier.org/CodeSystem/bssa-item', code: 'intent-scale', display: 'Intent to die (0–10 self-rating)' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: ['TL-005'],
    description: 'BSSA patient self-rating of intent to die (0 = no chance, 10 = absolutely certain).',
  },
  {
    id: 'bssa-past-attempt',
    name: 'History of suicide attempt',
    coding: { system: 'http://spier.org/CodeSystem/bssa-item', code: 'past-suicide-attempt', display: 'History of suicide attempt' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA past-behavior assessment. Past suicidal behavior is the strongest risk factor for future attempts.',
  },
  {
    id: 'bssa-needs-help-to-be-safe',
    name: 'Reports needing help to stay safe',
    coding: { system: 'http://spier.org/CodeSystem/bssa-item', code: 'needs-help-to-be-safe', display: 'Reports needing help to stay safe' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA safety-plan check. A "yes" is a reason to act immediately; a "no" does not by itself indicate the patient is safe.',
  },

  // ── PSS-3 (Patient Safety Screener 3) ──
  {
    id: 'pss3-result',
    name: 'PSS-3 Screening Result',
    coding: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'Binary PSS-3 suicide-risk result. Positive if active ideation in the past two weeks (item 2) or a suicide attempt within the last six months (item 3a); a positive result triggers Clarify Risk. Value = SPiER-local pss3-result; crosswalked to the common suicide-risk tier.',
  },
  {
    id: 'pss3-depression',
    name: 'Depression (past two weeks)',
    coding: { system: 'http://spier.org/CodeSystem/pss3-item', code: 'depression-2wk', display: 'Depression in the past two weeks' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'PSS-3 Item 1: depression lead-in. Not counted toward the suicide-risk result.',
  },
  {
    id: 'pss3-active-ideation',
    name: 'Active suicidal ideation (past two weeks)',
    coding: { system: 'http://spier.org/CodeSystem/pss3-item', code: 'active-ideation-2wk', display: 'Active suicidal ideation in the past two weeks' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'PSS-3 Item 2: active suicidal ideation. A "yes" is a positive suicide-risk screen.',
  },
  {
    id: 'pss3-lifetime-attempt',
    name: 'Lifetime suicide attempt',
    coding: { system: 'http://spier.org/CodeSystem/pss3-item', code: 'lifetime-attempt', display: 'Lifetime suicide attempt' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'PSS-3 Item 3: lifetime suicide attempt. A recent attempt (within ~6 months, item 3a) is a positive screen.',
  },

  // ── SAFE-T (Suicide Assessment Five-Step Evaluation and Triage) ──
  {
    id: 'safet-risk-level',
    name: 'SAFE-T Risk Level',
    coding: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-006'],
    description: 'Clinician-determined SAFE-T risk level (low / moderate / high). Value binds DIRECTLY to the shared spier-suicide-risk-tier — SAFE-T lands on the concept layer with no per-instrument crosswalk. Rationale and any clinical-judgment override are captured in the Observation note.',
  },

  // ── Stanley-Brown Safety Plan ──
  {
    id: 'sb-warning-signs',
    name: 'Warning Signs',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'warning-signs', display: 'Warning Signs' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='warning-signs').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Patient-identified thoughts, images, mood, situation, or behaviors that indicate a crisis may be developing.',
  },
  {
    id: 'sb-internal-coping',
    name: 'Internal Coping Strategies',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'internal-coping', display: 'Internal Coping Strategies' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='internal-coping').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Things the patient can do on their own to take their mind off problems without contacting another person.',
  },
  {
    id: 'sb-social-distraction',
    name: 'Social Distraction Contacts',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'social-distraction', display: 'Social Distractions' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='social-distraction').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'People and social settings that help take the patient\u2019s mind off problems.',
  },
  {
    id: 'sb-crisis-support',
    name: 'Crisis Support Contacts',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'crisis-support', display: 'Crisis Support Contacts' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='crisis-support').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Family members or friends the patient can contact for help during a crisis.',
  },
  {
    id: 'sb-professional-support',
    name: 'Professional Support',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'professional-support', display: 'Professional Support' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='professional-support').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Clinicians, agencies, crisis lines (988), and local ED contact information.',
  },
  {
    id: 'sb-lethal-means',
    name: 'Lethal Means Safety',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'lethal-means-safety', display: 'Lethal Means Safety' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='lethal-means-safety').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Steps to make the environment safer by restricting access to lethal means.',
  },
  {
    id: 'sb-reason-for-living',
    name: 'Reason for Living',
    coding: { system: 'http://spier.org/CodeSystem/safety-plan-section', code: 'reason-for-living', display: 'Reason for Living' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/safety-plan-section' and code='reason-for-living').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'The most important thing to the patient that is worth living for.',
  },
  {
    id: 'safety-plan-category',
    name: 'Safety Plan Category',
    // SNOMED FSN, matching what `carePlanMappers/shared.ts` actually emits.
    // Both the FSN and the preferred term validate against tx.fhir.org.
    coding: { system: 'http://snomed.info/sct', code: '735324008', display: 'Treatment escalation plan (record artifact)' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.category.coding.where(system='http://snomed.info/sct' and code='735324008')",
    // Cross-cutting: same SNOMED category is used by Stanley-Brown and CAMS Stabilization.
    usedBy: ['TL-007', 'TL-015', 'TL-021', 'TL-024'],
    description: 'SNOMED category code classifying the CarePlan as a suicide prevention treatment plan. Emitted on every SPiER CarePlan by the shared factory. The two narrative safety plans also carry LOINC 87626-8 "Suicide prevention note" in category — see the separate entry. Category is unordered, so match on the coding rather than on a position.',
  },
  {
    id: 'careplan-suicide-prevention-note',
    name: 'Suicide Prevention Note Category',
    coding: { system: 'http://loinc.org', code: '87626-8', display: 'Suicide prevention note' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.category.coding.where(system='http://loinc.org' and code='87626-8')",
    // Opt-in, not universal: the CAMS CarePlans share the same factory but their
    // IG examples do not carry 87626-8, so the mappers do not emit it for them.
    usedBy: ['TL-007', 'TL-015'],
    description: 'LOINC document-type concept carried alongside the SNOMED treatment-escalation-plan category on the two narrative safety plans (Stanley-Brown, Crisis Response Plan) so the plan is discoverable by suicide-prevention consumers. Modelling caveat: 87626-8 is a document-type concept whose most precise home is Composition.type or DocumentReference.type — CarePlan.category has only an example binding, so this is legal and useful for discovery, but a consumer should not read it as a claim that the CarePlan is a document.',
  },

  // ── CAMS SSF-5 Section A ──
  {
    id: 'cams-psych-pain',
    name: 'Psychological Pain Rating',
    coding: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'psychological-pain', display: 'Psychological Pain' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated psychological pain on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-stress',
    name: 'Stress Rating',
    coding: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'stress', display: 'Stress' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated stress on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-agitation',
    name: 'Agitation Rating',
    coding: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'agitation', display: 'Agitation' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated agitation on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-hopelessness',
    name: 'Hopelessness Rating',
    coding: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'hopelessness', display: 'Hopelessness' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated hopelessness on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-self-hate',
    name: 'Self-Hate Rating',
    coding: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'self-hate', display: 'Self-Hate' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated self-hate on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-overall-risk',
    name: 'Overall Risk Rating',
    coding: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'overall-risk', display: 'Overall Risk of Suicide' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated overall risk on 1–5 scale. Tracked longitudinally across sessions.',
  },

  // ── CAMS Section B - Drivers ──
  {
    id: 'cams-driver',
    name: 'Suicide Driver',
    coding: { system: 'http://spier.org/CodeSystem/cams-driver-category', code: 'suicide-driver', display: 'Suicide Driver' },
    fhirResource: 'Condition',
    fhirPath: 'Condition.code.text',
    usedBy: ['TL-020', 'TL-024'],
    description: 'A problem identified by patient/clinician as driving suicidal thoughts. The narrative sits in Condition.code.text (a CAMS driver is idiographic and deliberately uncoded); the marker category above identifies the resource as a CAMS driver. Tracked on the problem list until resolved at CAMS disposition. NOTE: the demo mapper currently emits the vendor URL http://cams-care.com/driver-category instead of this canonical SPiER system — the IG is authoritative.',
  },
  {
    id: 'cams-driver-type',
    name: 'Driver Type',
    answerSystem: 'http://cams-care.com/driver-type',
    fhirResource: 'Condition',
    fhirPath: 'Condition.category.coding',
    usedBy: ['TL-020', 'TL-024'],
    description: 'Classification of whether a driver directly causes suicidal ideation or indirectly contributes. UNHARMONIZED: this is the only vocabulary the demo emits that has no SPiER CodeSystem behind it — the URL shown is a vendor website, not a resolvable terminology server. Do not treat it as bindable. The IG expresses the same distinction only as CarePlan section codes (cams-careplan-section#direct-drivers / #indirect-drivers).',
  },

  // ── CAMS Stabilization Plan ──
  // Five sections, each identified by a SPiER-local cams-careplan-section code
  // in activity.detail.code — the profile slices on that code, so the activity
  // order is not part of the contract.
  {
    id: 'cams-stab-lethal-means',
    name: 'Lethal Means Reduction',
    coding: { system: 'http://spier.org/CodeSystem/cams-careplan-section', code: 'lethal-means-reduction', display: 'Lethal Means Reduction' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/cams-careplan-section' and code='lethal-means-reduction').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 1 of the CAMS Stabilization Plan: steps agreed to reduce the patient’s access to lethal means.',
  },
  {
    id: 'cams-stab-coping',
    name: 'Coping Strategies',
    coding: { system: 'http://spier.org/CodeSystem/cams-careplan-section', code: 'coping-strategies', display: 'Coping Strategies' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/cams-careplan-section' and code='coping-strategies').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 2 of the CAMS Stabilization Plan: what the patient can do differently to cope during a suicidal crisis.',
  },
  {
    id: 'cams-stab-emergency-contact',
    name: 'Emergency Contact',
    coding: { system: 'http://spier.org/CodeSystem/cams-careplan-section', code: 'emergency-contact', display: 'Emergency Contact' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/cams-careplan-section' and code='emergency-contact').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 3 of the CAMS Stabilization Plan: the life-or-death emergency contact number for this patient.',
  },
  {
    id: 'cams-stab-support-network',
    name: 'Support Network',
    coding: { system: 'http://spier.org/CodeSystem/cams-careplan-section', code: 'support-network', display: 'Support Network' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/cams-careplan-section' and code='support-network').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 4 of the CAMS Stabilization Plan: people the patient can call for help or to decrease isolation.',
  },
  {
    id: 'cams-stab-treatment-adherence',
    name: 'Treatment Adherence Plan',
    coding: { system: 'http://spier.org/CodeSystem/cams-careplan-section', code: 'treatment-adherence', display: 'Treatment Adherence Plan' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://spier.org/CodeSystem/cams-careplan-section' and code='treatment-adherence').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 5 of the CAMS Stabilization Plan: barriers to attending treatment as scheduled, each paired with the solution agreed for it.',
  },

  // ── Shared / Cross-cutting ──
  {
    id: 'careplan-profile',
    name: 'CarePlan Profile',
    fhirResource: 'CarePlan',
    fhirPath: 'CarePlan.meta.profile',
    usedBy: ['TL-007', 'TL-015', 'TL-021', 'TL-024'],
    description: 'Every SPiER CarePlan declares its SPiER profile canonical in meta.profile — spier-stanley-brown-safety-plan (TL-007), spier-crisis-response-plan (TL-015), spier-cams-stabilization-plan (TL-021), spier-cams-therapeutic-worksheet (TL-024). meta.profile holds canonical URLs, not Codings, so this row has no code. No SPiER CarePlan currently claims conformance to an external care-plan IG.',
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
