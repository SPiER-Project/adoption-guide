import { createRequire } from 'node:module'

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
 * RECORDER's rendered words — its JSXText and its prose attributes, a few
 * hundred strings, all of it about what the recorder writes — so "Records an
 * Appointment" there means the resource and the full list is right. The
 * clinical scan reads every string in three whole trees, where "Appointment",
 * "Consent" and "Task" are the chart's own record labels (`KIND_WORD` in
 * `apps/clinical/src/lib/recordKeys.ts`, chosen as the word a clinician uses)
 * and "Appointment marked attended." is a save notice. Firing on those would
 * teach the next person to route around the gate — tried 2026-10-07 with the
 * full list and plurals: six hits, none of them the wire format.
 *
 * The cost is stated: a recorder saying "Records a Consent" — in its lede, its
 * title or a field label — passes the clinical scan. RULE 3 fails it, which is
 * why both gates exist. ⚠️ RULE 3 read only JSXText until 2026-10-07, and the
 * three examples this comment used to give (*Next Appointment & Follow-Up
 * Tracking*, *Task type*, *Consent history*) were recorder attributes that
 * neither gate failed; they were reworded and RULE 3 now reads attributes.
 */
export const ALSO_ENGLISH = new Set([
  'Appointment', 'Task', 'Consent', 'Procedure', 'Encounter', 'Flag',
  'Condition', 'Questionnaire',
])

/**
 * Type names that are only ever the wire format when written as a word: the
 * names above that are not also English, PLUS every FHIR R4 resource and
 * datatype name with a lower-to-upper hump — `CodeSystem`, `ValueSet`,
 * `CarePlan`, `ActivityDefinition`, `CodeableConcept`.
 *
 * ⚠️ **The hump is the test for "not English", and it is derived.** Until
 * 2026-10-09 this was the 18 names above minus eight, so "A partial CodeSystem
 * would read as complete" reached a clinician on the published-protocol page and
 * passed: `CodeSystem` is not a type SPiER writes, so it was not on the list. A
 * one-hump-free R4 name (`Measure`, `Group`, `Library`, `Schedule`) is an
 * ordinary word as often as not, so the derived half leaves those out; the
 * typed half still holds the two single-word names this product only ever means
 * as resources (`Observation`, `Communication`).
 */
export const WIRE_ONLY_RESOURCE_TYPES = [
  ...new Set([
    ...RESOURCE_TYPES.filter((t) => !ALSO_ENGLISH.has(t)),
    ...[...fhirR4TypeNames()].filter((t) => /[a-z][A-Z]/.test(t)),
  ]),
]

/**
 * Every FHIR R4 resource and complex-datatype name — `QuestionnaireResponse`,
 * `CapabilityStatement`, `CodeableConcept`, `ContactPoint` — 189 of them.
 *
 * ⚠️ **Derived, not typed.** Read from the R4 model `fhirpath` ships
 * (`fhirpath/fhir-context/r4`, its `type2Parent` table, which is generated from
 * the R4 StructureDefinitions), so it is the whole spec rather than the 18 names
 * SPiER happens to write. `check:jargon` subtracts it from the repo-identifier
 * index: guide copy legitimately names any resource or datatype, and a repo type
 * that shares the spec's name (`Measure`, `Bundle`) is the spec's word first.
 *
 * `fhirpath` arrives through `@formbox/renderer`, not as a direct dependency; the
 * repo already relies on its `fhir-context/*` layout (the R5 shim). A missing or
 * reshaped module throws here, and the caller floors the count.
 */
export function fhirR4TypeNames() {
  const model = createRequire(import.meta.url)('fhirpath/fhir-context/r4')
  if (!model?.type2Parent || typeof model.type2Parent !== 'object') {
    throw new Error('fhirpath/fhir-context/r4 has no type2Parent table — the R4 type list cannot be derived')
  }
  // Primitive types are lowercase (`string`, `dateTime`) and are not names a
  // reader would see capitalised; only the capitalised ones are kept.
  return new Set(Object.keys(model.type2Parent).filter((t) => /^[A-Z]/.test(t)))
}
