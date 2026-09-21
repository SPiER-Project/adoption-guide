/**
 * The words that mean "this is the wire format", for the gates that forbid them
 * in front of a clinician.
 *
 * ⚠️ **One list, two gates.** `check:fhir-render` RULE 3 has read it since
 * 2026-09-17 (a recorder describes the act, not the resource); `check:jargon`'s
 * clinical scan reads it since 2026-09-21, over the whole of `apps/clinical`
 * and `packages/tool-views` rather than over the eleven recorders. Two copies
 * would have meant a resource type banned from a recorder's lede and allowed on
 * the chart row beside it, which is the defect one of them exists for.
 *
 * ⚠️ **Resource types SPiER actually writes or reads**, not all 150-odd in R4.
 * A recorder writing an `AllergyIntolerance` would pass both gates; that is a
 * stated limit rather than an oversight, and the fix is a name on this list.
 *
 * ⚠️ **`Patient` and `Measure` are not on it at all**, and no rule should put
 * them there: a check that fires on "the patient" or "measure and share" would
 * be reverted within the week, and a gate everyone has learned to override is
 * worse than no gate.
 */
export const RESOURCE_TYPES = [
  'Communication', 'ServiceRequest', 'DocumentReference', 'Appointment', 'Consent',
  'Task', 'Procedure', 'Observation', 'EpisodeOfCare', 'Flag', 'CarePlan',
  'QuestionnaireResponse', 'Questionnaire', 'Encounter', 'DiagnosticReport',
  'Condition', 'PlanDefinition', 'ActivityDefinition',
]

/**
 * The names above that are ALSO ordinary English words in this product's copy.
 *
 * ⚠️ **The difference between the two gates is this set, and it is a real
 * difference rather than a softening.** `check:fhir-render` RULE 3 reads a
 * RECORDER's JSXText — a few hundred words, all of it prose about what the
 * recorder writes — so "Records an Appointment" there means the resource and
 * the full list is right. The clinical scan reads every string in two whole
 * trees, where *Next Appointment & Follow-Up Tracking* is a form title, *Task
 * type* is a field label and *Consent history* is a list heading. Firing on
 * those would teach the next person to route around the gate.
 *
 * The cost is stated: a recorder's lede saying "Records a Consent" passes the
 * clinical scan. RULE 3 fails it, which is why both gates exist.
 */
export const ALSO_ENGLISH = new Set([
  'Appointment', 'Task', 'Consent', 'Procedure', 'Encounter', 'Flag',
  'Condition', 'Questionnaire',
])

/** Resource types that are only ever the wire format when written as a word. */
export const WIRE_ONLY_RESOURCE_TYPES = RESOURCE_TYPES.filter((t) => !ALSO_ENGLISH.has(t))
