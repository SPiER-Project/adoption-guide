/**
 * Minimal FHIR R4 shape used for resources passing through the patient
 * context and scenario data. We don't pull in `@types/fhir` to keep the dep
 * surface small; downstream code (observationMappers, carePlanMappers) still
 * treats payloads as loose JSON.
 *
 * Shared by:
 *  - `context/PatientContext.tsx` (in-memory store + context surface)
 *  - `@spier/demo-population` (per-patient seed JSON)
 *  - any consumer that wants a typed handle on resources read from the
 *    patient context.
 */
import type { RiskAlert } from '@spier/core/lib/observationMappers'

/**
 * FHIR R4 `Reference` and `Annotation`, to the depth anything here reads them.
 */
export interface Reference {
  reference?: string
  display?: string
  [k: string]: unknown
}

export interface Annotation {
  text?: string
  [k: string]: unknown
}

/**
 * FHIR R4 `Resource.meta`.
 *
 * ⚠️ **Named on `FhirResource` below because SEVEN call sites were casting to
 * this shape inline** — `(c as { meta?: { profile?: string[] } })` in
 * `handoffs.ts`, `followUp.ts`, `measures.ts`, `crisisResources.ts` and
 * `lethalMeans.ts`. A cast repeated seven times is a type that was missing, and
 * each copy is independently free to drift from what is actually stamped.
 *
 * ⚠️ Both members are load-bearing rather than descriptive: `profile` is how
 * every Stage-8 measure recognizes its own output (a handoff Communication has
 * no required element distinguishing it from any other), and `tag` carries the
 * pathway stage that `stageForArtifact` reads first.
 */
export interface Meta {
  profile?: string[]
  tag?: Coding[]
  [k: string]: unknown
}

export interface FhirResource {
  resourceType: string
  id?: string
  meta?: Meta
  [k: string]: unknown
}

export interface QuestionnaireResource extends FhirResource {
  resourceType: 'Questionnaire'
  url?: string
  version?: string
  item?: QuestionnaireItem[]
}

/**
 * Minimal FHIR R4 Questionnaire.item shape — loose like the rest of this file
 * (`[k: string]: unknown` covers `extension` and the other elements a caller
 * reads off the raw JSON but this type does not name). Recursive through `item`
 * for `group`-type nesting.
 *
 * ⚠️ `code` IS named, and used to be one of the elements that sentence waved
 * at. It is what `fallbackDispatch` reads to recognize a foreign instrument and
 * what `check:extract` gates the observationExtract contract on — reaching it
 * through the index signature meant `unknown`, which is why that module walked
 * Questionnaire items as `any[]` behind a disable.
 */
export interface QuestionnaireAnswerOption {
  valueCoding?: Coding
  valueString?: string
  valueInteger?: number
  [k: string]: unknown
}

export interface QuestionnaireItem {
  linkId: string
  text?: string
  type: string
  code?: Coding[]
  required?: boolean
  answerOption?: QuestionnaireAnswerOption[]
  item?: QuestionnaireItem[]
  [k: string]: unknown
}

export interface QuestionnaireResponseResource extends FhirResource {
  resourceType: 'QuestionnaireResponse'
  /** Canonical URL of the Questionnaire this response answers (used for mapper dispatch). */
  questionnaire?: string
  authored?: string
  item?: QuestionnaireResponseItem[]
}
export interface CodeableConcept {
  text?: string
  coding?: Coding[]
}

export interface ObservationResource extends FhirResource {
  resourceType: 'Observation'
  code?: CodeableConcept
  // ⚠️ Named so `deriveFromResponse` can APPEND to them. It spread
  // `obs.derivedFrom` and `obs.note` off the index signature's `unknown`, which
  // it could only do behind a file-level `no-explicit-any` — in the module that
  // stamps provenance onto every derived Observation the app writes.
  derivedFrom?: Reference[]
  note?: Annotation[]
  effectiveDateTime?: string
  valueInteger?: number
  valueBoolean?: boolean
  valueDecimal?: number
  valueString?: string
  valueCodeableConcept?: CodeableConcept
  interpretation?: Array<{ coding?: Coding[]; text?: string }>
}
export type CarePlanResource = FhirResource & { resourceType: 'CarePlan' }
/**
 * FHIR R4 HumanName — the four fields anything here reads off a name.
 * `[k: string]: unknown` keeps the rest of the element readable, as elsewhere.
 */
export interface HumanName {
  use?: string
  text?: string
  family?: string
  given?: string[]
  [k: string]: unknown
}

/** FHIR R4 Identifier — an MRN, in practice. */
export interface Identifier {
  use?: string
  system?: string
  value?: string
  [k: string]: unknown
}

/**
 * ⚠️ **Named fields, unlike its sibling one-liners above, because a real server
 * answers `Patient.read()` with this and something has to say what it holds.**
 * Everything else in this file is read out of scenario JSON we author; a Patient
 * can arrive from an EHR over SMART. `readSmartPatientSummary` reads exactly
 * these four, and read them through fhirclient's `any`-typed `FHIR.Patient`
 * until 2026-09-20 — so `name[0].given.join(' ')` was unchecked on a value the
 * app does not control. Typed here, `given` is `string[] | undefined` and the
 * optional chaining the code already had is what makes it compile.
 */
export interface PatientResource extends FhirResource {
  resourceType: 'Patient'
  name?: HumanName[]
  identifier?: Identifier[]
  birthDate?: string
  gender?: string
}
/**
 * ⚠️ **`sent` is named because six call sites read it and four of them were
 * casting inline** — `(c as { sent?: string }).sent`, repeated in `measures.ts`
 * and twice each in `followUp.ts`. Two more did `String(c.sent ?? '')` against
 * the index signature's `unknown`, which `no-base-to-string` flags for a real
 * reason: had `sent` ever arrived as an object, every such value would collapse
 * to `"[object Object]"` and sort identically — a handoff list silently in the
 * wrong order rather than an error. It is a FHIR `dateTime`, so: a string.
 */
export interface CommunicationResource extends FhirResource {
  resourceType: 'Communication'
  sent?: string
}
export type AppointmentResource = FhirResource & { resourceType: 'Appointment' }
export type MeasureReportResource = FhirResource & { resourceType: 'MeasureReport' }

// ─── Stage 5 (Coordinate Handoffs) ───────────────────────────
// From ig/input/fsh/handoffs.fsh. Typed loosely like the workflow resources
// above; the profiles are the real contract. Appointment is declared above
// because it predates the stage (the scenario timelines referenced it first).
export type DocumentReferenceResource = FhirResource & { resourceType: 'DocumentReference' }
export type ServiceRequestResource = FhirResource & { resourceType: 'ServiceRequest' }
export type ConsentResource = FhirResource & { resourceType: 'Consent' }

// From ig/input/fsh/lethal-means.fsh (Stage 4). Read by the Stage-8 lethal
// means counseling measure, and written by the TL-008 recorder
// (components/LethalMeansCounselingView.tsx → lib/lethalMeans.ts).
export type ProcedureResource = FhirResource & { resourceType: 'Procedure' }

// ─── Stage 7 (Track Risk Over Time) ──────────────────────────
// The episode pattern from ig/input/fsh/risk-episode.fsh. Typed loosely like
// the other workflow resources above; the profiles are the real contract.
export type EpisodeOfCareResource = FhirResource & { resourceType: 'EpisodeOfCare' }
export type FlagResource = FhirResource & { resourceType: 'Flag' }
export type TaskResource = FhirResource & { resourceType: 'Task' }

/**
 * The correlation hinge from ig/input/fsh/risk-episode.fsh (SPiEREncounter,
 * issue #263). R4 gives most resource types no way to reference an
 * `EpisodeOfCare` directly, but nearly all of them carry a native `.encounter`
 * — so an artifact points at its Encounter and the Encounter points at the
 * episode. NOT to be confused with `ScenarioEncounter` below, which is
 * walkthrough narration and lives in the `walkthrough` bucket.
 */
export type EncounterResource = FhirResource & { resourceType: 'Encounter' }

/**
 * Minimal QuestionnaireResponse item shapes (loose FHIR R4) used by the
 * observation/care-plan mappers to walk captured answers. Intentionally small,
 * every field optional — matching the loose-JSON convention above.
 */
export interface Coding {
  system?: string
  code?: string
  display?: string
}

export interface QuestionnaireResponseAnswer {
  valueCoding?: Coding
  valueBoolean?: boolean
  valueInteger?: number
  valueDecimal?: number
  valueString?: string
  valueText?: string
  valueDate?: string
  item?: QuestionnaireResponseItem[]
}

export interface QuestionnaireResponseItem {
  linkId?: string
  text?: string
  /**
   * Not part of FHIR R4 QuestionnaireResponse.item, but foreign EHRs sometimes
   * annotate captured items with the source Questionnaire's item `code`
   * (LOINC per-item codes). The code-based fallback dispatcher
   * (../lib/observationMappers/fallbackDispatch.ts) reads it — alongside a
   * contained Questionnaire — to recognize an instrument whose canonical URL
   * doesn't match a SPiER Questionnaire.
   */
  code?: Coding[]
  answer?: QuestionnaireResponseAnswer[]
  item?: QuestionnaireResponseItem[]
}

/** One captured QuestionnaireResponse with display metadata for activity lists. */
export interface StoredResponse {
  id: string
  questionnaireName: string
  completedAt: string
  resource: QuestionnaireResponseResource
}

/**
 * One patient's chart slice. Used both as the in-memory store shape inside
 * `PatientContext` and as the on-disk shape of each `patient-*.json` scenario.
 */
export interface PatientSlice {
  responses: StoredResponse[]
  observations: ObservationResource[]
  carePlans: CarePlanResource[]
  riskAlerts: RiskAlert[]
  /**
   * Non-Questionnaire workflow artifacts (caring contacts, referrals, etc.).
   * Optional so previously-persisted slices and existing scenario JSON files —
   * which predate this field — remain valid; always read with `?? []`.
   */
  communications?: CommunicationResource[]
  /**
   * Stage-7 (Track Risk Over Time) artifacts. Optional for the same
   * back-compat reason as `communications` — persisted slices and scenario
   * JSON predate them; always read with `?? []`.
   */
  episodes?: EpisodeOfCareResource[]
  flags?: FlagResource[]
  tasks?: TaskResource[]
  /**
   * Stage-5/6 (Coordinate Handoffs / Track Follow-Up) artifacts. Optional for
   * the same back-compat reason as the buckets above; always read with `?? []`.
   * Stage-6 outreach attempts and caring contacts are Communications, so they
   * land in `communications` rather than getting a bucket of their own.
   */
  documentReferences?: DocumentReferenceResource[]
  serviceRequests?: ServiceRequestResource[]
  appointments?: AppointmentResource[]
  consents?: ConsentResource[]
  /**
   * Stage-4 lethal-means counseling Procedures. Read by the Stage-8 lethal
   * means measure; nothing writes them yet (TL-008 has no recorder).
   */
  procedures?: ProcedureResource[]
  /**
   * Real FHIR `Encounter`s — the correlation hinge for #263. Optional for the
   * same back-compat reason as the buckets above; always read with `?? []`.
   *
   * This bucket holds `Encounter` resources. The scenario *walkthrough* timeline
   * (`ScenarioEncounter`) used to occupy this key and now lives under
   * `walkthrough`, because a bucket named `encounters` that was not an
   * `Encounter` was exactly the kind of misleading name this repo keeps removing.
   */
  encounters?: EncounterResource[]
}

/**
 * One step in a scenario walkthrough timeline. JSON-safe: artifact linking is by
 * FHIR reference (`relatedRefs`) into the same scenario.
 *
 * Used by the ED suicide-care scenario (issue #51) to render the 24-step
 * walkthrough mapped in `docs/use-cases/ed-scenario-11.md`. Each step ties an
 * event in the narrative to the FHIR artifact(s) it produces and the pathway
 * stage it belongs to. Steps whose real-world artifact has no SPiER profile yet
 * are marked `profileGap` (see issue #52 for the non-Questionnaire workflow work).
 *
 * Walkthrough steps are read-only scenario metadata, kept out of the mutable
 * `PatientSlice` store so they're never overwritten by submitted assessments.
 *
 * These are NARRATION, not FHIR. They live in the scenario JSON's `walkthrough`
 * bucket; `encounters` holds real `Encounter` resources (`EncounterResource`).
 * The roadmap issue that introduced these steps already anticipated the
 * successor — "Promote to FHIR. Model real `Encounter` resources alongside
 * scenarios and derive the timeline from them" — which is what #263 begins.
 */
export interface ScenarioEncounter {
  id: string
  /** Scenario step label, e.g. "11.2-1A". Optional for generic timelines. */
  step?: string
  date: string
  /** Short title for the step, e.g. "Triage suicide screen (ASQ)". */
  title: string
  /** Pathway stage slug this step belongs to (matches catalog/stages). */
  stageId?: string
  /** Acting role, e.g. "Triage Nurse / Screener". */
  actor?: string
  status: 'completed' | 'scheduled'
  notes: string
  /** FHIR resource types this step produces, e.g. ["QuestionnaireResponse", "Observation"]. */
  fhirArtifacts?: string[]
  /** True when no SPiER profile exists yet for this step's artifact. */
  profileGap?: boolean
  /**
   * True when the scenario step this narrates is a SPiER *proposal* rather than
   * part of the use case the HL7 working group circulated (#313).
   *
   * The chart shows it as a tag, because a viewer otherwise cannot tell which
   * steps the working group actually authored — and the whole point of marking
   * proposals "(proposed)" in the workbook is lost if the running demo presents
   * them as settled. `build-use-case-workbook.mjs --check` asserts this flag
   * agrees with `origin` in `docs/use-cases/ed-scenario-11.json`.
   */
  proposed?: boolean
  /**
   * The artifacts this step produced, as FHIR references (`Type/id`) into the
   * same scenario — e.g. `QuestionnaireResponse/p011-asq`.
   *
   * Replaces two string-matching fields (#263 phase 5b): `relatedResponseNames`
   * matched a QuestionnaireResponse by its *display name* and
   * `relatedCarePlanIdSubstrings` matched a CarePlan by an id *substring*. Both
   * were the same class of heuristic as the CarePlan id regex phase 5a deleted —
   * renaming a questionnaire or an id silently broke the link with nothing going
   * red. These references are checked by check-scenario-resources.mjs.
   *
   * A step legitimately has none: most of the 24 ED-scenario steps name resource
   * types in `fhirArtifacts` that the demo does not yet emit (Task, Flag,
   * Provenance, Composition…). `fhirArtifacts` is narrative — what a real system
   * would produce. This field is only what is actually on file.
   */
  relatedRefs?: string[]
}
