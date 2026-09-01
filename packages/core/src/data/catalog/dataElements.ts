/**
 * Every R4 resource type SPiER actually emits somewhere in the pathway.
 *
 * This was a closed four-member union (QuestionnaireResponse, Observation,
 * Condition, CarePlan) until #260, which meant most of what Stages 5–8 produce
 * — and everything the Stage-8 measure engine reads — could not be documented at
 * all. The list below is not aspirational: each type has at least one profile in
 * `ig/input/fsh/`, and `check:catalog` fails if a binding names a system with no
 * generated CodeSystem behind it.
 */
export type FhirResourceType =
  | 'QuestionnaireResponse'
  | 'Observation'
  | 'Condition'
  | 'CarePlan'
  | 'EpisodeOfCare'
  | 'Task'
  | 'Flag'
  | 'ServiceRequest'
  | 'Communication'
  | 'Appointment'
  | 'Procedure'
  | 'DocumentReference'
  | 'Consent'

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
  system: string                      // URL — 'http://loinc.org', 'http://thespierproject.org/fhir/CodeSystem/asq-item'
  code: string
  display: string
}

/**
 * A concept that more than one instrument expresses — the shared, actionable
 * meaning that `concept-layer.fsh` defines and that several instruments map into.
 *
 * Deliberately sparse. #260 sketched a Concept for every row, which would have
 * produced ~56 concepts wrapping a single binding each: ceremony that duplicates
 * the binding's own id, name and code while asserting a "shared" concept that
 * nothing shares. A concept earns an entry here when two or more bindings point
 * at it. Today exactly one does — the suicide-risk tier, which five instruments
 * reach by five different routes — and that one case is the whole reason the flat
 * list read as five unrelated rows carrying the same LOINC code.
 *
 * Adding the next one is a single entry plus a `conceptId` on its bindings.
 */
export interface Concept {
  id: string
  name: string
  /** SPiERConceptDomain code — the Gravity-style domain tag (#262). */
  domain: 'suicide-risk'
  /** The concept's own code, as it appears on every binding's resource. */
  code: Coding
  /** Canonical of the ValueSet the harmonized value is drawn from. */
  valueSet?: string
  description: string
}

/**
 * One instrument's or workflow step's expression of a concept in FHIR.
 *
 * `code` and `value` are separate fields, which is the point of the #260 split.
 * The old flat shape had one `code` + `codeSystem` slot, so an Observation coded
 * with one concept and *valued* from a different vocabulary — which is what SPiER
 * does most often — had to pick which of the two to show. Both readings were
 * defensible, which is what made it a bug rather than a preference: `asq-result`
 * put the value system in the code column while `bssa-disposition` put the code
 * there and explained the value in prose.
 */
export interface Binding {
  id: string                          // stable slug, 'phq9-item9'
  name: string                        // human label, 'Thoughts of death/self-harm (Item 9)'
  /** Set only when this binding is one of several expressions of a shared Concept. */
  conceptId?: string
  /**
   * The code identifying the resource — `Observation.code`, `Task.code`, an
   * item code. Absent when the element genuinely has none: an instrument whose
   * items carry no item code, or a resource recognised by its profile rather
   * than by a code (several Stage 5–7 types are, and say so).
   */
  code?: Coding
  /**
   * The vocabulary the element's *value* draws from, when the value is coded.
   * Replaces the interim `answerSystem` field: same job, honest name, and now
   * able to sit alongside `code` on the same row rather than instead of it.
   *
   * `system` is the CodeSystem the codes come from; `valueSet` is the bindable
   * ValueSet when one exists. Both are canonicals, so a gate can resolve them.
   */
  value?: {
    system: string
    valueSet?: string
  }
  fhirResource: FhirResourceType
  fhirPath: string
  usedBy: string[]                    // tool IDs — ['TL-002', 'TL-020', ...]
  description: string
}

const SYSTEM_LABELS: Record<string, string> = {
  'http://loinc.org': 'LOINC',
  'http://snomed.info/sct': 'SNOMED CT',
}

const SPIER_CS_PREFIX = 'http://thespierproject.org/fhir/CodeSystem/'
const THO_PREFIX = 'http://terminology.hl7.org/CodeSystem/'

/**
 * Where a reader can go to read the definition of a code.
 *
 * Derived from `system` + `code`, never hand-written — a link is a claim, and
 * this page's whole recent history (#220, #266) is about unbacked claims on it.
 * The one canonical that is NOT resolvable is SPiER's own:
 * `thespierproject.org/fhir` is an identifier namespace, not a server, so
 * SPiER-local codes point at the IG **we publish**, whose per-concept anchors
 * the IG Publisher generates as `<csId>-<code>`. (It was `spier.org` until
 * #413 — a domain the project never owned, which resolved to an unrelated
 * third party's website.)
 *
 * `import.meta.env.BASE_URL` keeps that following whichever base is active —
 * `/ig/` on Cloudflare, `/adoption-guide/ig/` on the legacy Pages deploy — the
 * same idiom the header's IG link uses (see EhrShell.tsx).
 *
 * Returns undefined when there is nowhere honest to point. `check:catalog`
 * fails the build if a SPiER-local system has no published CodeSystem, so an
 * absent link means "no code", never "we lost track of it".
 */
export function codeHref(system: string, code: string): string | undefined {
  if (system === 'http://loinc.org') return `https://loinc.org/${code}/`
  if (system === 'http://snomed.info/sct') {
    return `https://browser.ihtsdotools.org/?perspective=full&conceptId1=${code}`
  }
  if (system.startsWith(THO_PREFIX)) {
    const id = system.slice(THO_PREFIX.length)
    return `https://terminology.hl7.org/CodeSystem-${id}.html#${id}-${code}`
  }
  if (system.startsWith(SPIER_CS_PREFIX)) {
    const id = system.slice(SPIER_CS_PREFIX.length)
    return `${import.meta.env.BASE_URL}ig/CodeSystem-${id}.html#${id}-${code}`
  }
  return undefined
}

const SPIER_VS_PREFIX = 'http://thespierproject.org/fhir/ValueSet/'

/**
 * Where a reader can go to read the *bindable set* a coded value is drawn from.
 *
 * The sibling of `codeHref`, and the same contract: derived, never hand-written,
 * and undefined when there is nowhere honest to point. `check:catalog` proves
 * every SPiER-local `valueSet:` canonical here has a generated
 * `ValueSet-<id>.json`, which the IG Publisher renders at `ValueSet-<id>.html`,
 * so for SPiER-local canonicals the link is exactly as backed as a code link.
 *
 * Issue #281: that gate's rationale said an unresolvable canonical "would render
 * as a bindable set on the page", and nothing rendered it — `Concept.valueSet`
 * was plain text and `Binding.value.valueSet` was not shown at all. A gate
 * justified by a rendering that does not exist cannot be checked by the person
 * reading it, so the page caught up rather than the comment being trimmed.
 *
 * External canonicals return undefined for now: SPiER's dictionary names none,
 * and guessing a URL pattern for someone else's ValueSet is the kind of unbacked
 * claim this file's history is about. Add them here when one appears.
 */
export function valueSetHref(canonical: string): string | undefined {
  if (canonical.startsWith(SPIER_VS_PREFIX)) {
    const id = canonical.slice(SPIER_VS_PREFIX.length)
    return `${import.meta.env.BASE_URL}ig/ValueSet-${id}.html`
  }
  return undefined
}

/**
 * Short label for a ValueSet canonical — its id, which is what a reader scans
 * for. The full canonical stays in the `title`, exactly as `systemLabel` does
 * for systems.
 */
export function valueSetLabel(canonical: string): string {
  if (canonical.startsWith(SPIER_VS_PREFIX)) return canonical.slice(SPIER_VS_PREFIX.length)
  return canonical
}

/**
 * Short label for a system URL. External vocabularies get their common name;
 * SPiER-local CodeSystems get their id (the URL itself stays available for the
 * `title` attribute and for search, so nothing an implementer needs is lost).
 */
export function systemLabel(system: string): string {
  const known = SYSTEM_LABELS[system]
  if (known) return known
  if (system.startsWith(THO_PREFIX)) return `HL7 ${system.slice(THO_PREFIX.length)}`
  if (system.startsWith(SPIER_CS_PREFIX)) return `SPiER ${system.slice(SPIER_CS_PREFIX.length)}`
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

/**
 * Shared concepts. See the `Concept` doc comment for why there is only one.
 */
export const CONCEPTS: Concept[] = [
  {
    id: 'suicide-risk-tier',
    name: 'Suicide risk tier',
    domain: 'suicide-risk',
    code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs',
    description:
      'The instrument-agnostic, ordered risk tier — the one value a consumer can act on without knowing which tool produced it. Five instruments reach it by five different routes: C-SSRS through cssrs-risk-level, ASQ through asq-screening-result, BSSA through bssa-disposition, PSS-3 through pss3-result, and SAFE-T by binding the shared tier directly with no per-instrument crosswalk at all. CAMS is deliberately absent: a CAMSOverallRiskToRiskTier map is published, but nothing emits a cams-ssf-overall-risk code for it to translate, so CAMS has no route here today (#436). All five carry LOINC 93374-7 as Observation.code, which is why the flat dictionary rendered one concept as five unrelated rows. A sixth binding carries the same tier in a different slot: the episode’s current-risk-tier extension, which has no Observation.code at all. How lossy each route is — a widening, a related-to, or an exact match — is recorded in each ConceptMap and is not surfaced here yet; that is #264.',
  },
]

export const BINDINGS: Binding[] = [
  // ── C-SSRS ──
  {
    id: 'cssrs-screener-panel',
    name: 'C-SSRS Screener Panel',
    code: { system: 'http://loinc.org', code: '93373-9', display: 'Columbia - suicide severity rating scale screener - recent [C-SSRS]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'QuestionnaireResponse.questionnaire',
    usedBy: ['TL-003'],
    description: 'LOINC panel code for the C-SSRS Screener (6-item, recent). Three-tier risk stratification.',
  },
  {
    id: 'cssrs-full-panel',
    name: 'C-SSRS Full Panel',
    code: { system: 'http://loinc.org', code: '93245-9', display: 'Columbia - suicide severity rating scale - lifetime recent [C-SSRS]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: 'QuestionnaireResponse.questionnaire',
    usedBy: ['TL-004'],
    description: 'LOINC panel code for the C-SSRS Full Lifetime/Recent version. 5-level ideation + intensity + behavior.',
  },
  {
    id: 'cssrs-wish-dead',
    name: 'Wish to be dead',
    code: { system: 'http://loinc.org', code: '93246-7', display: 'Wish to be dead 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 1: Passive death wish, past month. Low risk tier. LOINC scopes this code to a 1-month reference period — the Since Last Contact version uses a SPiER-local interval code instead.',
  },
  {
    id: 'cssrs-nonspecific-active',
    name: 'Non-specific active suicidal thoughts',
    code: { system: 'http://loinc.org', code: '93247-5', display: 'Non-specific active suicidal thoughts 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 2: General thoughts of wanting to die, past month. Low risk tier. If Yes, Q3–5 are triggered.',
  },
  {
    id: 'cssrs-methods-no-intent',
    name: 'Ideation with methods, no intent',
    code: { system: 'http://loinc.org', code: '93248-3', display: 'Active suicidal ideation with any methods (not plan) without intent to act 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 3: Thought of method but no plan or intent, past month. Moderate risk tier.',
  },
  {
    id: 'cssrs-some-intent',
    name: 'Ideation with some intent',
    code: { system: 'http://loinc.org', code: '93249-1', display: 'Active suicidal ideation with some intent to act, without specific plan 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 4: Some intent to act on thoughts, past month. High risk tier — items 4 and 5 share the published instrument’s red band.',
  },
  {
    id: 'cssrs-plan-intent',
    name: 'Ideation with specific plan and intent',
    code: { system: 'http://loinc.org', code: '93250-9', display: 'Active suicidal ideation with specific plan and intent 1 month' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Level 5: Plan worked out with intent to carry out, past month. High risk tier.',
  },
  {
    id: 'cssrs-behavior-ever',
    name: 'Preparatory acts or suicidal behavior (lifetime)',
    code: { system: 'http://loinc.org', code: '93267-3', display: 'Preparatory acts or suicidal behavior Lifetime' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueBoolean',
    usedBy: TOOLS_CSSRS_PAST_MONTH,
    description: 'C-SSRS Q6 / Behavior section: any lifetime suicidal behavior or preparatory act. Tier depends on recency — high if within the past three months (the nested Q6 follow-up, LOINC 93269-9), moderate if lifetime-only. Note this is a finding code, not a question — LOINC scopes it to Lifetime while the ideation items above are past-month.',
  },
  {
    id: 'suicide-risk-level',
    conceptId: 'suicide-risk-tier',
    name: 'Suicide risk level',
    code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/cssrs-risk-level', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    // Cross-cutting: derived from C-SSRS (Screener, Full, Since Last Visit, Pediatric) and reused as CAMS overall risk.
    /**
     * ⚠️ **CAMS was on this list and should not have been (#436).** The four
     * entries are C-SSRS variants — Screener, Full, Since Last Contact,
     * Pediatric — and all four genuinely emit `cssrs-risk-level`. The CAMS SSF-5
     * did not: its mappers emit the overall-risk rating as
     * `Observation.valueInteger` with an H/N/L interpretation and never a coding,
     * so listing it here attributed C-SSRS's crosswalk fidelity to CAMS. Per
     * #93 every row of the CAMS map is `wider` — the lossiest of the six — and
     * it deliberately reaches no `imminent` tier, so a reader comparing routes
     * would have concluded the opposite of the truth. CAMS has no route into the
     * concept layer until something produces `cams-ssf-overall-risk`.
     */
    usedBy: [...TOOLS_CSSRS, 'TL-019', 'TL-027'],
    description: 'Derived risk level, per the published C-SSRS Screener with Triage Points: Low (Q1–2), Moderate (Q3, or Q6 lifetime-only), High (Q4, Q5, or Q6 within the past three months). Shared by the C-SSRS Screener, Full, Since Last Visit, and Pediatric versions; reused as CAMS overall risk. Value = SPiER-local cssrs-risk-level tier; crosswalked to the common suicide-risk tier.',
  },
  {
    id: 'cssrs-actual-lethality',
    name: 'Actual lethality/medical damage',
    code: { system: 'http://loinc.org', code: '93271-5', display: 'Actual lethality/medical damage most lethal suicide attempt Lifetime [C-SSRS]' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/cssrs-lethality' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='behavior-section').item.where(linkId='lethality-section').item.where(linkId='actual-lethality').answer.valueCoding",
    usedBy: ['TL-004'],
    description: 'Lethality scale 0–5 (no damage to death) for the most lethal attempt. Full version only. Answers are drawn from http://thespierproject.org/fhir/CodeSystem/cssrs-lethality; no Observation is currently extracted for this item.',
  },

  // ── PHQ-9 ──
  {
    id: 'phq9-panel',
    name: 'PHQ-9 Panel',
    code: { system: 'http://loinc.org', code: '44249-1', display: 'PHQ-9 quick depression assessment panel [Reported.PHQ]' },
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
    code: { system: 'http://loinc.org', code: '44250-9', display: 'Little interest or pleasure in doing things in last 2 weeks' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q1').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 1: Anhedonia. Scored 0 (Not at all) to 3 (Nearly every day).',
  },
  {
    id: 'phq9-item2',
    name: 'Feeling down/depressed',
    code: { system: 'http://loinc.org', code: '44255-8', display: 'Feeling down, depressed, or hopeless in last 2 weeks' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q2').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 2: Depressed mood. Scored 0–3.',
  },
  {
    id: 'phq9-item3',
    name: 'Sleep disturbance',
    code: { system: 'http://loinc.org', code: '44259-0', display: 'Trouble falling or staying asleep, or sleeping too much in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q3').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 3: Insomnia or hypersomnia. Scored 0–3.',
  },
  {
    id: 'phq9-item4',
    name: 'Fatigue / low energy',
    code: { system: 'http://loinc.org', code: '44254-1', display: 'Feeling tired or having little energy in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q4').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 4: Fatigue. Scored 0–3.',
  },
  {
    id: 'phq9-item5',
    name: 'Appetite change',
    code: { system: 'http://loinc.org', code: '44251-7', display: 'Poor appetite or overeating in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q5').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 5: Appetite disturbance. Scored 0–3.',
  },
  {
    id: 'phq9-item6',
    name: 'Feeling bad about yourself',
    code: { system: 'http://loinc.org', code: '44258-2', display: 'Feeling bad about yourself - or that you are a failure or have let yourself or your family down in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q6').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 6: Worthlessness / guilt. Scored 0–3. Clinically adjacent to Item 9 — often elevated alongside suicidal ideation.',
  },
  {
    id: 'phq9-item7',
    name: 'Trouble concentrating',
    code: { system: 'http://loinc.org', code: '44252-5', display: 'Trouble concentrating on things, such as reading the newspaper or watching television in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q7').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 7: Concentration difficulty. Scored 0–3.',
  },
  {
    id: 'phq9-item8',
    name: 'Psychomotor change',
    code: { system: 'http://loinc.org', code: '44253-3', display: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q8').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 8: Psychomotor retardation or agitation. Scored 0–3.',
  },
  {
    id: 'phq9-item9',
    name: 'Thoughts of death/self-harm (Item 9)',
    code: { system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q9').answer.valueCoding",
    usedBy: ['TL-002'],
    description: 'PHQ-9 Item 9: Suicidal ideation screening gateway. Score ≥1 should trigger further suicide risk assessment (ASQ, C-SSRS). Critical for workflow routing. Also extracted to a standalone Observation carrying the same LOINC code.',
  },
  {
    id: 'phq9-total',
    name: 'PHQ-9 Total Score',
    code: { system: 'http://loinc.org', code: '44261-6', display: 'Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: ['TL-002'],
    description: 'Sum of all 9 items (0–27). Severity: 0–4 Minimal, 5–9 Mild, 10–14 Moderate, 15–19 Moderately Severe, 20–27 Severe.',
  },
  {
    id: 'phq9-functional',
    name: 'Functional Difficulty',
    code: { system: 'http://loinc.org', code: '69722-7', display: 'How difficult have these made it for you to do your work, take care of things at home, or get along with other people [Reported.PHQ]' },
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
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/sbqr-q1' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q1').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 1: 6 options mapping to 4 subgroups — Non-Suicidal (1pt), Ideation (2pt), Plan (3pt), Attempt (4pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-q2',
    name: 'Past-year ideation frequency',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/sbqr-q2' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q2').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 2: Never (1pt) to Very Often/5+ times (5pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-q3',
    name: 'Threat of suicide attempt',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/sbqr-q3' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q3').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 3: 5 options mapping to 3 levels — No (1pt), Yes once (2pt), Yes more than once (3pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-q4',
    name: 'Future likelihood of attempt',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/sbqr-q4' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='q4').answer.valueCoding",
    usedBy: ['TL-025'],
    description: 'SBQ-R Item 4: Never (0pt) to Very Likely (6pt). ordinalValue encoded on each answerOption.',
  },
  {
    id: 'sbqr-total',
    name: 'SBQ-R Total Score',
    // SNOMED FSN, matching the item code in sbqr-questionnaire.json.
    code: { system: 'http://snomed.info/sct', code: '225337009', display: 'Suicide risk assessment (procedure)' },
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
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-item', code: 'wished-dead', display: 'Wished you were dead' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q1').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 1 ("In the past few weeks, have you wished you were dead?"): passive death wish. Answered with the SNOMED Yes/No codings; also extracted to an Observation carrying this same code.',
  },
  {
    id: 'asq-q2-family',
    name: 'Family better off if dead',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-item', code: 'family-better-off-dead', display: 'Family better off if dead' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q2').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 2 ("…have you felt that you or your family would be better off if you were dead?"): perceived burdensomeness. Answered with the SNOMED Yes/No codings.',
  },
  {
    id: 'asq-q3-thoughts',
    name: 'Thoughts about killing yourself',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-item', code: 'thoughts-killing-self', display: 'Thoughts about killing yourself' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q3').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 3 ("In the past week, have you been having thoughts about killing yourself?"): active ideation. Answered with the SNOMED Yes/No codings.',
  },
  {
    id: 'asq-q4-ever-tried',
    name: 'Ever tried to kill yourself',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-item', code: 'ever-attempted', display: 'Ever tried to kill yourself' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q4').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 4 ("Have you ever tried to kill yourself?"): lifetime attempt history. Answered with the SNOMED Yes/No codings.',
  },
  {
    id: 'asq-q4-recent-attempt',
    name: 'Most recent attempt (recency)',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-attempt-recency' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='screening-questions').item.where(linkId='q4-recent-attempt').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 4 follow-up: when the most recent attempt occurred. Asked only if Q4 is Yes.',
  },
  {
    id: 'asq-q5-acuity',
    name: 'Acuity: Killing yourself right now',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-item', code: 'acute-ideation-now', display: 'Killing yourself right now (acuity)' },
    fhirResource: 'QuestionnaireResponse',
    fhirPath: "QuestionnaireResponse.item.where(linkId='acuity-section').item.where(linkId='q5').answer.valueCoding",
    usedBy: ['TL-001'],
    description: 'ASQ Question 5 ("Are you having thoughts of killing yourself right now?"): current active ideation. Only asked if Yes to any Q1–Q4. Determines acute vs non-acute positive.',
  },
  {
    id: 'asq-result',
    conceptId: 'suicide-risk-tier',
    name: 'ASQ Screening Result',
    code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/asq-screening-result', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-001'],
    description: 'Three-tier risk stratification: Negative Screen, Non-Acute Positive (potential risk), Acute Positive (imminent risk). The Observation is coded with the generic LOINC suicide-risk-level concept; the value is a SPiER-local http://thespierproject.org/fhir/CodeSystem/asq-screening-result code, crosswalked to the common suicide-risk tier.',
  },

  // ── BSSA (Brief Suicide Safety Assessment) ──
  {
    id: 'bssa-disposition',
    conceptId: 'suicide-risk-tier',
    name: 'BSSA Disposition',
    code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/bssa-disposition', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'Clinician-selected BSSA disposition (emergency psychiatric evaluation / further evaluation necessary / non-urgent follow-up / no intervention). Value = SPiER-local bssa-disposition tier; crosswalked to the common suicide-risk tier.',
  },
  {
    id: 'bssa-current-ideation',
    name: 'Current suicidal ideation (right now)',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/bssa-item', code: 'current-ideation', display: 'Current suicidal ideation (right now)' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA acuity signal. A "yes" indicates imminent risk requiring urgent evaluation; the patient cannot be left alone.',
  },
  {
    id: 'bssa-suicide-plan',
    name: 'Has a suicide plan',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/bssa-item', code: 'suicide-plan', display: 'Has a suicide plan' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA plan/intent assessment. A detailed, feasible plan is a reason for greater concern and means restriction.',
  },
  {
    id: 'bssa-intent-scale',
    name: 'Intent to die (0–10 self-rating)',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/bssa-item', code: 'intent-scale', display: 'Intent to die (0–10 self-rating)' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: ['TL-005'],
    description: 'BSSA patient self-rating of intent to die (0 = no chance, 10 = absolutely certain).',
  },
  {
    id: 'bssa-past-attempt',
    name: 'History of suicide attempt',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/bssa-item', code: 'past-suicide-attempt', display: 'History of suicide attempt' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA past-behavior assessment. Past suicidal behavior is the strongest risk factor for future attempts.',
  },
  {
    id: 'bssa-needs-help-to-be-safe',
    name: 'Reports needing help to stay safe',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/bssa-item', code: 'needs-help-to-be-safe', display: 'Reports needing help to stay safe' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-005'],
    description: 'BSSA safety-plan check. A "yes" is a reason to act immediately; a "no" does not by itself indicate the patient is safe.',
  },

  // ── PSS-3 (Patient Safety Screener 3) ──
  {
    id: 'pss3-result',
    conceptId: 'suicide-risk-tier',
    name: 'PSS-3 Screening Result',
    code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/pss3-result', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'Binary PSS-3 suicide-risk result. Positive if active ideation in the past two weeks (item 2) or a suicide attempt within the last six months (item 3a); a positive result triggers Clarify Risk. Value = SPiER-local pss3-result; crosswalked to the common suicide-risk tier.',
  },
  {
    id: 'pss3-depression',
    name: 'Depression (past two weeks)',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/pss3-item', code: 'depression-2wk', display: 'Depression in the past two weeks' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'PSS-3 Item 1: depression lead-in. Not counted toward the suicide-risk result.',
  },
  {
    id: 'pss3-active-ideation',
    name: 'Active suicidal ideation (past two weeks)',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/pss3-item', code: 'active-ideation-2wk', display: 'Active suicidal ideation in the past two weeks' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'PSS-3 Item 2: active suicidal ideation. A "yes" is a positive suicide-risk screen.',
  },
  {
    id: 'pss3-lifetime-attempt',
    name: 'Lifetime suicide attempt',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/pss3-item', code: 'lifetime-attempt', display: 'Lifetime suicide attempt' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-011'],
    description: 'PSS-3 Item 3: lifetime suicide attempt. A recent attempt (within ~6 months, item 3a) is a positive screen.',
  },

  // ── SAFE-T (Suicide Assessment Five-Step Evaluation and Triage) ──
  {
    id: 'safet-risk-level',
    conceptId: 'suicide-risk-tier',
    name: 'SAFE-T Risk Level',
    code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueCodeableConcept',
    usedBy: ['TL-006'],
    description: 'Clinician-determined SAFE-T risk level (low / moderate / high). Value binds DIRECTLY to the shared spier-suicide-risk-tier — SAFE-T lands on the concept layer with no per-instrument crosswalk. Rationale and any clinical-judgment override are captured in the Observation note.',
  },

  // ── Stanley-Brown Safety Plan ──
  {
    id: 'sb-warning-signs',
    name: 'Warning Signs',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'warning-signs', display: 'Warning Signs' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='warning-signs').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Patient-identified thoughts, images, mood, situation, or behaviors that indicate a crisis may be developing.',
  },
  {
    id: 'sb-internal-coping',
    name: 'Internal Coping Strategies',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'internal-coping', display: 'Internal Coping Strategies' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='internal-coping').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Things the patient can do on their own to take their mind off problems without contacting another person.',
  },
  {
    id: 'sb-social-distraction',
    name: 'Social Distraction Contacts',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'social-distraction', display: 'Social Distractions' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='social-distraction').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'People and social settings that help take the patient\u2019s mind off problems.',
  },
  {
    id: 'sb-crisis-support',
    name: 'Crisis Support Contacts',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'crisis-support', display: 'Crisis Support Contacts' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='crisis-support').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Family members or friends the patient can contact for help during a crisis.',
  },
  {
    id: 'sb-professional-support',
    name: 'Professional Support',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'professional-support', display: 'Professional Support' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='professional-support').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Clinicians, agencies, crisis lines (988), and local ED contact information.',
  },
  {
    id: 'sb-lethal-means',
    name: 'Lethal Means Safety',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'lethal-means-safety', display: 'Lethal Means Safety' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='lethal-means-safety').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'Steps to make the environment safer by restricting access to lethal means.',
  },
  {
    id: 'sb-reason-for-living',
    name: 'Reason for Living',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/safety-plan-section', code: 'reason-for-living', display: 'Reason for Living' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/safety-plan-section' and code='reason-for-living').exists()).detail.description",
    usedBy: ['TL-007'],
    description: 'The most important thing to the patient that is worth living for.',
  },
  {
    id: 'safety-plan-category',
    name: 'Safety Plan Category',
    // SNOMED FSN, matching what `carePlanMappers/shared.ts` actually emits.
    // Both the FSN and the preferred term validate against tx.fhir.org.
    code: { system: 'http://snomed.info/sct', code: '735324008', display: 'Treatment escalation plan (record artifact)' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.category.coding.where(system='http://snomed.info/sct' and code='735324008')",
    // Cross-cutting: same SNOMED category is used by Stanley-Brown and CAMS Stabilization.
    usedBy: ['TL-007', 'TL-015', 'TL-021', 'TL-024'],
    description: 'SNOMED category code classifying the CarePlan as a suicide prevention treatment plan. Emitted on every SPiER CarePlan by the shared factory. The two narrative safety plans also carry LOINC 87626-8 "Suicide prevention note" in category — see the separate entry. Category is unordered, so match on the coding rather than on a position.',
  },
  {
    id: 'careplan-suicide-prevention-note',
    name: 'Suicide Prevention Note Category',
    code: { system: 'http://loinc.org', code: '87626-8', display: 'Suicide prevention note' },
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
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: 'psychological-pain', display: 'Psychological Pain' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated psychological pain on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-stress',
    name: 'Stress Rating',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: 'stress', display: 'Stress' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated stress on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-agitation',
    name: 'Agitation Rating',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: 'agitation', display: 'Agitation' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated agitation on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-hopelessness',
    name: 'Hopelessness Rating',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: 'hopelessness', display: 'Hopelessness' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated hopelessness on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-self-hate',
    name: 'Self-Hate Rating',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: 'self-hate', display: 'Self-Hate' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated self-hate on 1–5 scale. Tracked longitudinally across sessions.',
  },
  {
    id: 'cams-overall-risk',
    name: 'Overall Risk Rating',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf', code: 'overall-risk', display: 'Overall Risk of Suicide' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.valueInteger',
    usedBy: TOOLS_CAMS_SSF,
    description: 'Patient-rated overall risk on 1–5 scale. Tracked longitudinally across sessions.',
  },

  // ── CAMS Section B - Drivers ──
  {
    id: 'cams-driver',
    name: 'Suicide Driver',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-driver-category', code: 'suicide-driver', display: 'Suicide Driver' },
    fhirResource: 'Condition',
    fhirPath: 'Condition.code.text',
    usedBy: ['TL-020', 'TL-024'],
    description: 'A problem identified by patient/clinician as driving suicidal thoughts. The narrative sits in Condition.code.text (a CAMS driver is idiographic and deliberately uncoded); the marker category above identifies the resource as a CAMS driver. Tracked on the problem list until resolved at CAMS disposition. Required on the profile (Condition.category:driverCategory 1..1).',
  },
  {
    id: 'cams-driver-type',
    name: 'Driver Type',
    // `value`, not `code`: this element's value is one of two codes, and naming
    // either one as "the" code would be wrong half the time. Under the old flat
    // schema this had to sit in the interim `answerSystem` field; it now has a
    // proper value slot with its bindable ValueSet.
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-driver-type', valueSet: 'http://thespierproject.org/fhir/ValueSet/cams-driver-type-vs' },
    fhirResource: 'Condition',
    fhirPath: 'Condition.category.coding',
    usedBy: ['TL-020', 'TL-024'],
    description: 'Classification of whether a driver directly causes suicidal ideation (#direct) or indirectly contributes to it (#indirect). Optional on the profile (Condition.category:driverType 0..1) — present only when the clinician classified the driver — but required-bound when present, so the slot cannot carry an arbitrary code. Minted under #265; the demo previously emitted a vendor website URL here that no SPiER artifact defined.',
  },

  // ── CAMS Stabilization Plan ──
  // Five sections, each identified by a SPiER-local cams-careplan-section code
  // in activity.detail.code — the profile slices on that code, so the activity
  // order is not part of the contract.
  {
    id: 'cams-stab-lethal-means',
    name: 'Lethal Means Reduction',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-careplan-section', code: 'lethal-means-reduction', display: 'Lethal Means Reduction' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/cams-careplan-section' and code='lethal-means-reduction').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 1 of the CAMS Stabilization Plan: steps agreed to reduce the patient’s access to lethal means.',
  },
  {
    id: 'cams-stab-coping',
    name: 'Coping Strategies',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-careplan-section', code: 'coping-strategies', display: 'Coping Strategies' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/cams-careplan-section' and code='coping-strategies').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 2 of the CAMS Stabilization Plan: what the patient can do differently to cope during a suicidal crisis.',
  },
  {
    id: 'cams-stab-emergency-contact',
    name: 'Emergency Contact',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-careplan-section', code: 'emergency-contact', display: 'Emergency Contact' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/cams-careplan-section' and code='emergency-contact').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 3 of the CAMS Stabilization Plan: the life-or-death emergency contact number for this patient.',
  },
  {
    id: 'cams-stab-support-network',
    name: 'Support Network',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-careplan-section', code: 'support-network', display: 'Support Network' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/cams-careplan-section' and code='support-network').exists()).detail.description",
    usedBy: ['TL-021'],
    description: 'Section 4 of the CAMS Stabilization Plan: people the patient can call for help or to decrease isolation.',
  },
  {
    id: 'cams-stab-treatment-adherence',
    name: 'Treatment Adherence Plan',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/cams-careplan-section', code: 'treatment-adherence', display: 'Treatment Adherence Plan' },
    fhirResource: 'CarePlan',
    fhirPath: "CarePlan.activity.where(detail.code.coding.where(system='http://thespierproject.org/fhir/CodeSystem/cams-careplan-section' and code='treatment-adherence').exists()).detail.description",
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

  // ══ Stages 5–8 ══════════════════════════════════════════════
  //
  // Everything below became documentable only when `FhirResourceType` was
  // opened (#260). Each row was read off the profile in `ig/input/fsh/` rather
  // than inferred from the app, and every system and ValueSet named here was
  // checked to resolve to a generated definition.
  //
  // One shape recurs and is worth stating once: several of these resources
  // carry NO distinguishing code of their own. R4 gives Communication,
  // DocumentReference and Appointment no natural slot for "this is a
  // suicide-safety one", so SPiER identifies them by profile canonical plus the
  // `suicide-risk` domain category from #262, and puts the workflow detail in
  // extensions. Those rows say so rather than inventing a code column.

  // ── Coordinate Handoffs (Stage 5) ──
  {
    id: 'handoff-content-item',
    name: 'Handoff Content Item',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-handoff-content', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-handoff-content-vs' },
    fhirResource: 'Communication',
    fhirPath: "Communication.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/handoff-content-item').valueCodeableConcept",
    usedBy: ['TL-009', 'TL-030'],
    description: 'Which piece of safety context actually travelled with the patient at a transition — current risk status, most recent assessment, safety-plan status or copy, means-safety actions, crisis resources, follow-up plan, next provider, appointment or referral details, care-team contact, patient instructions, pending tasks. Repeats: one extension per item included. The row has no code because Communication has no coded slot for this; the checklist lives in the extension.',
  },
  {
    id: 'handoff-withheld-item',
    name: 'Withheld Handoff Item (and why)',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-withholding-basis', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-withholding-basis-vs' },
    fhirResource: 'DocumentReference',
    fhirPath: "DocumentReference.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/handoff-withheld-item')",
    usedBy: ['TL-030'],
    description: 'A packet item that was deliberately NOT shared, paired with the basis: patient declined sharing outright, this category excluded, this recipient excluded, recipient not among those the consent permits, consent expired, or no consent on file with the withholding default applied. A complex extension — the item code and the basis are separate sub-extensions — so the value vocabulary shown here is the basis; the item is drawn from spier-handoff-content. Recording why something was withheld is what distinguishes a consent-respecting packet from an incomplete one.',
  },
  {
    id: 'discharge-packet-content',
    name: 'Discharge Safety Packet',
    fhirResource: 'DocumentReference',
    fhirPath: 'DocumentReference.content.attachment',
    usedBy: ['TL-030'],
    description: 'The packet artifact itself, with the live resources it was assembled from in context.related. status is fixed to #current. No code: the SPiER profile carries a type.text rather than a document-type coding, so the resource is recognised by its profile canonical (spier-discharge-safety-packet) plus the suicide-risk domain category.',
  },
  {
    id: 'referral-reason',
    name: 'Referral Reason',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-referral-reason', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-referral-reason-vs' },
    fhirResource: 'ServiceRequest',
    fhirPath: 'ServiceRequest.reasonCode',
    usedBy: ['TL-017'],
    description: 'Why the suicide-safety referral was sent: elevated risk, safety planning, ongoing treatment, higher level of care, specialty assessment, or post-discharge follow-up. Binding is extensible, so a site can add a local reason. intent is fixed to #order and the receiving provider or team is the performer, which is what lets a handoff be tracked past "sent" to accepted and completed.',
  },
  {
    id: 'follow-up-appointment',
    name: 'Follow-Up Appointment',
    fhirResource: 'Appointment',
    fhirPath: 'Appointment.start',
    usedBy: ['TL-031', 'TL-034'],
    description: 'The next visit, booked before the patient leaves. No code and no SPiER-local vocabulary: R4 Appointment has no category element at all, and Appointment.status already carries booked / fulfilled / cancelled / noshow. Attended, no-show and the 7- and 30-day completion windows are all computed from status plus start rather than stored, which is why the Stage-8 measures can read them without a separate resource. Recognised by profile canonical; see #272 for why the domain tag is not on it.',
  },
  {
    id: 'consent-category-suicide-safety',
    name: 'Suicide-Safety Sharing Consent',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-consent-category', code: 'suicide-safety-sharing', display: 'Suicide-safety information sharing' },
    fhirResource: 'Consent',
    fhirPath: 'Consent.category',
    usedBy: ['TL-032'],
    description: 'Marks a Consent as governing whether suicide-safety information may be shared with another provider, team, or support person. Required (Consent.category:suicideSafety 1..1). scope is patient-privacy. The decision itself is native FHIR rather than a SPiER invention: permit or deny on the provision, the recipient as provision.actor, any expiry as provision.period — so a patient declining is a deny provision, not a missing one.',
  },
  {
    id: 'consent-provision-content',
    name: 'Consented / Denied Content Category',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-handoff-content', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-handoff-content-vs' },
    fhirResource: 'Consent',
    fhirPath: 'Consent.provision.code',
    usedBy: ['TL-032'],
    description: 'Which categories of safety information a provision covers, drawn from the same vocabulary as the handoff checklist so a consent and a packet can be compared directly. That shared vocabulary is the point: it is what lets the EHR decide what may be sent or withheld at a handoff instead of guessing.',
  },

  // ── Track Follow-Up (Stage 6) ──
  {
    id: 'outreach-outcome',
    name: 'Outreach Outcome',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-outreach-outcome', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-outreach-outcome-vs' },
    fhirResource: 'Communication',
    fhirPath: "Communication.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/outreach-outcome').valueCodeableConcept",
    usedBy: ['TL-033', 'TL-035'],
    description: 'What came of a follow-up contact attempt — reached, no answer, message left, unable to reach, and so on. Recorded per attempt, which is what makes follow-up auditable attempt-by-attempt rather than as a single vague "we tried".',
  },
  {
    id: 'outreach-prompt',
    name: 'Outreach Prompt',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-outreach-prompt', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-outreach-prompt-vs' },
    fhirResource: 'Communication',
    fhirPath: "Communication.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/outreach-prompt').valueCodeableConcept",
    usedBy: ['TL-033', 'TL-035'],
    description: 'What triggered the outreach — a scheduled follow-up, a missed appointment, a no-show. This is the only thing distinguishing missed-appointment follow-up (TL-035) from routine outreach (TL-033): the same artifact, differing in the prompt, rather than two parallel resources.',
  },
  {
    id: 'outreach-safety-concern',
    name: 'Safety Concern Identified',
    fhirResource: 'Communication',
    fhirPath: "Communication.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/safety-concern-identified').valueBoolean",
    usedBy: ['TL-033', 'TL-035'],
    description: 'Whether the outreach surfaced a new safety concern. A boolean, so no code and no vocabulary — but load-bearing: a true here is what escalates an outreach attempt into a SPiERSafetyTask.',
  },
  {
    id: 'caring-contact-opt-out',
    name: 'Caring Contact Opt-Out',
    fhirResource: 'Communication',
    fhirPath: "Communication.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/caring-contact-opt-out').valueBoolean",
    usedBy: ['TL-010'],
    description: 'Whether the patient has opted out of caring contacts. Deliberately has no outcome vocabulary, unlike outreach: a caring contact asks nothing of the patient, so "reached" and "unreachable" do not apply to it. Opt-out is the only response it can have.',
  },
  {
    id: 'crisis-resource-shared',
    name: 'Crisis Resource Shared',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-crisis-resource', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-crisis-resource-vs' },
    fhirResource: 'Communication',
    fhirPath: "Communication.payload.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/crisis-resource-code').valueCoding",
    usedBy: ['TL-013'],
    description: 'Which patient-facing crisis resource or coping support was given to the patient (988 and the like). The extension exists because Communication.payload has no native coded slot — its context is Communication.payload specifically, so the code sits on the payload entry rather than on the Communication.',
  },

  // ── Reduce Access to Means ──
  {
    id: 'lethal-means-counseling',
    name: 'Lethal Means Counseling',
    fhirResource: 'Procedure',
    fhirPath: 'Procedure.code',
    usedBy: ['TL-008'],
    description: 'The counselling act itself, as a completed Procedure with performed[x] as a dateTime or Period. Procedure.code is required (1..1) but deliberately UNBOUND — SPiER mints no code for it and names no external one, so this row shows no code rather than implying a vocabulary that does not exist. Note the domain category here is 1..1 and assigned directly rather than sliced: R4 caps Procedure.category at 1 (it becomes 0..* only in R5), and FHIR forbids slicing an element whose max is 1.',
  },
  {
    id: 'lethal-means-method',
    name: 'Lethal Means Method',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-lethal-means-method', code: 'firearm', display: 'Firearm' },
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-means-safety-action', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-means-safety-action-vs' },
    fhirResource: 'Observation',
    fhirPath: 'Observation.code',
    usedBy: ['TL-008'],
    description: 'One Observation per method discussed, the method as Observation.code (required binding, 6 codes — firearm shown as the example) and the action agreed as the value (required binding, 6 codes: secured, removed, disposed and so on). This is the row the old flat schema could least express — the code and the value come from different vocabularies and both matter, which is exactly the conflation #260 set out to make unrepresentable.',
  },

  // ── Track Risk Over Time (Stage 7) ──
  {
    id: 'episode-type',
    name: 'Suicide-Safer Care Episode',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-episode-type', code: 'suicide-safer-care', display: 'Suicide-safer care episode' },
    fhirResource: 'EpisodeOfCare',
    fhirPath: 'EpisodeOfCare.type',
    usedBy: ['TL-038'],
    description: 'The anchor resource for the whole Track Risk Over Time stage, and the correlation key the rest of the pathway is expected to hang off: reassessment, care-gap and escalation Tasks all reference it via Task.basedOn. EpisodeOfCare has no category element in R4, so the domain tag rides on `type` instead — one of the three exceptions documented in #272. Extending that correlation to Stages 1–6 is #263.',
  },
  {
    id: 'episode-entry-reason',
    name: 'Episode Entry Reason',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-episode-entry-reason', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-episode-entry-reason-vs' },
    fhirResource: 'EpisodeOfCare',
    fhirPath: "EpisodeOfCare.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/episode-entry-reason').valueCodeableConcept",
    usedBy: ['TL-038'],
    description: 'Why the episode was opened — a positive screen, a disclosure, an attempt, and so on (8 codes, required binding). Recorded rather than inferred, so a reportable episode lifecycle starts with a stated reason.',
  },
  {
    id: 'episode-closure-reason',
    name: 'Episode Closure Reason',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-episode-closure-reason', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-episode-closure-reason-vs' },
    fhirResource: 'EpisodeOfCare',
    fhirPath: "EpisodeOfCare.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/episode-closure-reason').valueCodeableConcept",
    usedBy: ['TL-038'],
    description: 'Why the episode was closed — risk resolved, transferred, lost to follow-up, died, and so on (7 codes, required binding). Closure records both a reason and a final status, so an episode cannot quietly stop being tracked.',
  },
  {
    id: 'episode-current-risk-tier',
    name: 'Episode Current Risk Tier',
    conceptId: 'suicide-risk-tier',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs' },
    fhirResource: 'EpisodeOfCare',
    fhirPath: "EpisodeOfCare.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/episode-current-risk-tier').valueCodeableConcept",
    usedBy: ['TL-037', 'TL-038'],
    description: 'The episode’s current tier, kept on the episode so a work queue can sort and filter by risk without re-reading every Observation. A binding of the shared suicide-risk-tier concept — the only one that carries no LOINC 93374-7, because it sits in an extension rather than on Observation.code. Same tier vocabulary, different slot.',
  },
  {
    id: 'risk-flag-code',
    name: 'Active Risk Episode Flag',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-risk-flag', code: 'active-suicide-risk-episode', display: 'Active suicide-safer care episode' },
    fhirResource: 'Flag',
    fhirPath: 'Flag.code',
    usedBy: ['TL-038'],
    description: 'The chart banner raised while an episode is open (required binding, currently one code). Flag.category is a named slice carrying the standard HL7 safety category alongside the SPiER domain tag — it had to be sliced under #262 because R4 fixes a single value there, which blocked adding a second code.',
  },
  {
    id: 'safety-task-type',
    name: 'Safety Task Type',
    code: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-safety-task-type', code: 'reassessment-due', display: 'Reassessment due' },
    fhirResource: 'Task',
    fhirPath: 'Task.code',
    usedBy: ['TL-036', 'TL-037', 'TL-039', 'TL-040', 'TL-041'],
    description: 'Which piece of safety work is outstanding: assessment needed, reassessment due, safety plan needed or in need of update, an open lethal-means action, follow-up outreach due, an incomplete referral, a missing appointment, or an escalation (9 codes, required binding — reassessment-due shown as the example). intent is fixed to #plan. One Task per gap, each with an owner and a due date on restriction.period.end, each linked to its episode via Task.basedOn. Task has no category element in R4 and no searchable slot for a domain tag at all, which is why #272 left it out rather than tagging it unretrievably.',
  },
  {
    id: 'safety-task-escalation-trigger',
    name: 'Escalation Trigger',
    value: { system: 'http://thespierproject.org/fhir/CodeSystem/spier-escalation-trigger', valueSet: 'http://thespierproject.org/fhir/ValueSet/spier-escalation-trigger-vs' },
    fhirResource: 'Task',
    fhirPath: "Task.extension.where(url='http://thespierproject.org/fhir/StructureDefinition/escalation-trigger').valueCodeableConcept",
    usedBy: ['TL-036', 'TL-041'],
    description: 'Why a case was escalated — high-risk status, worsening or missed reassessment, missed follow-up or appointment, an overdue safety action, unable to reach, or a manual clinician escalation (11 codes, required binding). Repeats, deliberately: the SSC allows several triggers at once. Follow-up escalation reuses this same Task rather than defining a parallel resource, so a case escalated from follow-up and one escalated from the risk registry land in the same work queue.',
  },
  {
    id: 'safety-task-due',
    name: 'Safety Task Due Date',
    fhirResource: 'Task',
    fhirPath: 'Task.restriction.period.end',
    usedBy: ['TL-039', 'TL-040'],
    description: 'When the task is due. No code — it is a dateTime. Worth a row because due and overdue are computed from this rather than stored as a status, which is what stops a reassessment schedule from silently going stale, and because the Stage-8 measures read it directly.',
  },
]

// ─── Lookups ────────────────────────────────────────────────
//
// `primaryStageFor` and `toolsForElement` used to live here. Both were exported,
// neither was imported anywhere, and `primaryStageFor`'s own comment conceded it
// did not sort the way its name implied — it returned the first tool in catalog
// order, not the earliest stage. Deleted under #260 rather than fixed: a
// misleading helper nothing calls is worse than no helper, and the page does its
// own stage grouping (see `stagesReferencedBy` in DataDictionary.tsx).

export const bindingsUsedByTool = (toolId: string) =>
  BINDINGS.filter(b => b.usedBy.includes(toolId))

export const conceptById = (id: string) => CONCEPTS.find(c => c.id === id)

/** The bindings that express a shared concept, in dictionary order. */
export const bindingsForConcept = (conceptId: string) =>
  BINDINGS.filter(b => b.conceptId === conceptId)
