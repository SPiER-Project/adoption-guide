import { STAGES, TOOLS, toolForQuestionnaireUrl, type Tool } from '../data/catalog'
import type { CarePlanProfileUrl } from '@spier/fhir-artifacts/generated/care-plan-profiles.generated'

export type StageStatus = 'not-started' | 'active' | 'complete'

/**
 * The subset of QuestionnaireResponse we care about for pathway lookup.
 * `questionnaire` is the canonical URL of the source Questionnaire (FHIR
 * R4 conformance field — see https://hl7.org/fhir/R4/questionnaireresponse-definitions.html#QuestionnaireResponse.questionnaire).
 */
export interface QuestionnaireResponseLike {
  questionnaire?: string
  [k: string]: unknown
}

export function toolForResponse(qr: QuestionnaireResponseLike | undefined): Tool | undefined {
  return toolForQuestionnaireUrl(qr?.questionnaire)
}

export function stageForResponse(qr: QuestionnaireResponseLike | undefined): string | undefined {
  return toolForResponse(qr)?.stageId
}

/**
 * The SPiER pathway-stage CodeSystem. A coding/tag against this system whose
 * `code` is a known stage id binds a resource to that pathway stage. Exported
 * so resource producers (e.g. the workflow recorder) can stamp `meta.tag`.
 */
export const PATHWAY_STAGE_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'

/**
 * Which pathway stage each CarePlan profile belongs to (#263 phase 5).
 *
 * This replaces an id-substring regex (`/stanley-brown/i` and three siblings) that
 * resolved stage by pattern-matching `CarePlan.id`. Keying on the profile
 * canonical instead is better in three ways: an id is a local convention while a
 * profile is a declared claim, the value is already present on every CarePlan the
 * app emits, and — because the key type is the GENERATED union from
 * `care-plan-profiles.generated.ts` — adding a CarePlan profile in FSH fails the
 * typecheck until someone assigns it a stage. The regex silently returned
 * `undefined` for anything it had not been taught.
 *
 * ⚠️ This mapping lives only here. No FHIR artifact records it: the IG's four
 * CarePlan examples carry no pathway-stage tag, and neither does the runtime
 * builder in `lib/carePlanMappers/shared.ts`. Stamping it onto the resources
 * would be the more FHIR-native answer, but the Stanley-Brown CarePlan is
 * compared byte-for-byte against a golden file shared with its FML map
 * (`scripts/fixtures/stanley-brown/careplan-expected.json`), and the parity
 * normalizer does not exclude `meta` — so adding a tag there is a change to the
 * declared transformation, not a display detail. Worth doing deliberately, not as
 * a side effect of deleting a regex.
 */
const CAREPLAN_PROFILE_STAGES: Record<CarePlanProfileUrl, string> = {
  'http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan':
    'document-safety-actions',
  'http://thespierproject.org/fhir/StructureDefinition/spier-cams-stabilization-plan':
    'document-safety-actions',
  'http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan': 'document-safety-actions',
  'http://thespierproject.org/fhir/StructureDefinition/spier-cams-therapeutic-worksheet': 'define-risk-picture',
}

const STAGE_IDS = new Set(STAGES.map((s) => s.id))

/** Minimal shape we read off any FHIR resource for pathway-stage resolution. */
export interface FhirResourceLike {
  resourceType?: string
  id?: string
  questionnaire?: string
  meta?: { tag?: { system?: string; code?: string }[]; profile?: string[] }
  category?: { coding?: { system?: string; code?: string }[] }[]
  [k: string]: unknown
}

/** Kept for back-compat with importers that referenced the CarePlan-specific shape. */
export interface CarePlanLike {
  id?: string
  category?: { coding?: { system?: string; code?: string }[] }[]
}

function stageFromCodings(
  codings: { system?: string; code?: string }[] | undefined,
): string | undefined {
  return codings?.find(
    (c) => c.system === PATHWAY_STAGE_SYSTEM && !!c.code && STAGE_IDS.has(c.code),
  )?.code
}

/**
 * Resolve the pathway stage for ANY FHIR resource. Resolution order:
 *  1. `meta.tag` against the SPiER pathway-stage CodeSystem — the universal
 *     channel that works on Communication / Appointment / Observation /
 *     MeasureReport / etc. without each type needing bespoke handling.
 *  2. `category.coding` against the same CodeSystem — the CarePlan mechanism
 *     introduced by PR #48 (placeholder CarePlans for stages 4-7).
 *  3. QuestionnaireResponse → its source Questionnaire's tool → stageId.
 *  4. `meta.profile` against CAREPLAN_PROFILE_STAGES — tool-emitted CarePlans
 *     carry their profile canonical but no stage tag. Replaced the id-substring
 *     regex in #263 phase 5.
 */
export function stageForArtifact(resource: FhirResourceLike | undefined): string | undefined {
  if (!resource) return undefined

  const fromTag = stageFromCodings(resource.meta?.tag)
  if (fromTag) return fromTag

  const fromCategory = stageFromCodings(
    (resource.category ?? []).flatMap((cat) => cat.coding ?? []),
  )
  if (fromCategory) return fromCategory

  if (resource.resourceType === 'QuestionnaireResponse') {
    const fromQr = stageForResponse(resource as QuestionnaireResponseLike)
    if (fromQr) return fromQr
  }

  for (const profile of resource.meta?.profile ?? []) {
    const stage = CAREPLAN_PROFILE_STAGES[profile as CarePlanProfileUrl]
    if (stage) return stage
  }

  return undefined
}

/**
 * Back-compat delegate — CarePlan stage resolution now flows through the
 * generalized `stageForArtifact`.
 */
export function stageForCarePlan(plan: CarePlanLike): string | undefined {
  return stageForArtifact(plan as FhirResourceLike)
}

interface DerivedPathway {
  statuses: Record<string, StageStatus>
  activeStageId: string | null
  maxCompletedIndex: number
}

export interface StoredResponseLike {
  resource: QuestionnaireResponseLike
  /**
   * Wrapper-level display metadata from `StoredResponse`. Optional because stage
   * resolution never needs them — but the walkthrough reference index does, and
   * casting them back in at every read site would be worse than declaring them.
   */
  id?: string
  questionnaireName?: string
}

/**
 * A patient's stage-bearing artifacts. `responses` wrap their FHIR resource in
 * `.resource` (display metadata lives alongside); the other kinds are the FHIR
 * resources directly. All optional kinds default to empty so callers can pass a
 * partial set.
 */
export interface PatientArtifacts {
  responses: StoredResponseLike[]
  carePlans?: FhirResourceLike[]
  observations?: FhirResourceLike[]
  communications?: FhirResourceLike[]
  /**
   * Stage-5/6 workflow artifacts that stage themselves through `meta.tag` —
   * DocumentReference (discharge packet), ServiceRequest (referral),
   * Appointment (follow-up visit), Consent (sharing status).
   *
   * Deliberately ONE untyped bucket rather than a named field per resource
   * type: staging and grouping read nothing type-specific (just the stage tag),
   * so a named field per type would mean the same four-site surgery again for
   * every resource a later stage introduces.
   *
   * The Stage-7 episode/flag/task set is intentionally NOT routed here. Those
   * have their own surfaces (the recorders plus the registry work-queue rollup),
   * and staging them would mark every earlier stage complete the moment an
   * episode opens — an episode can legitimately be opened straight off a
   * positive screen, before any handoff has happened.
   */
  workflowArtifacts?: FhirResourceLike[]
}

function everyResource(artifacts: PatientArtifacts): FhirResourceLike[] {
  return [
    ...(artifacts.responses ?? []).map((r) => r.resource as FhirResourceLike),
    ...(artifacts.carePlans ?? []),
    ...(artifacts.observations ?? []),
    ...(artifacts.communications ?? []),
    ...(artifacts.workflowArtifacts ?? []),
  ]
}

export function derivePathwayStatus(artifacts: PatientArtifacts): DerivedPathway {
  const directlyTouched = new Set<string>()
  for (const resource of everyResource(artifacts)) {
    const stage = stageForArtifact(resource)
    if (stage) directlyTouched.add(stage)
  }

  const stageIndex = (id: string) => STAGES.findIndex((s) => s.id === id)
  const maxCompletedIndex = Array.from(directlyTouched)
    .map(stageIndex)
    .reduce((a, b) => Math.max(a, b), -1)

  const statuses: Record<string, StageStatus> = {}
  let activeStageId: string | null = null
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i]
    if (i <= maxCompletedIndex) {
      statuses[stage.id] = 'complete'
    } else if (i === maxCompletedIndex + 1) {
      statuses[stage.id] = 'active'
      activeStageId = stage.id
    } else {
      statuses[stage.id] = 'not-started'
    }
  }

  return { statuses, activeStageId, maxCompletedIndex }
}

/**
 * Group a patient's artifacts by the pathway stage they belong to.
 * Returns one entry per stage, in pathway order, including stages with no
 * artifacts (caller can decide whether to render the empty section). Buckets
 * are kept per-kind so the chart can render type-specific cards.
 */
export interface StageArtifacts {
  stageId: string
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
  workflowArtifacts: FhirResourceLike[]
}

export function groupArtifactsByStage(artifacts: PatientArtifacts): StageArtifacts[] {
  const {
    responses = [],
    carePlans = [],
    observations = [],
    communications = [],
    workflowArtifacts = [],
  } = artifacts
  return STAGES.map((stage) => ({
    stageId: stage.id,
    responses: responses.filter(
      (r) => stageForArtifact(r.resource as FhirResourceLike) === stage.id,
    ),
    carePlans: carePlans.filter((cp) => stageForArtifact(cp) === stage.id),
    observations: observations.filter((o) => stageForArtifact(o) === stage.id),
    communications: communications.filter((c) => stageForArtifact(c) === stage.id),
    workflowArtifacts: workflowArtifacts.filter((w) => stageForArtifact(w) === stage.id),
  }))
}

/**
 * Artifacts that resolve to no pathway stage — typically foreign EHR data
 * read over SMART whose codes SPiER doesn't recognize (a QR against a
 * non-SPiER Questionnaire canonical, a survey Observation from another
 * system). The chart renders these in an "Other activity" bucket so they
 * stay visible instead of silently disappearing from the stage grouping.
 */
export function unstagedArtifacts(artifacts: PatientArtifacts): Omit<StageArtifacts, 'stageId'> {
  const {
    responses = [],
    carePlans = [],
    observations = [],
    communications = [],
    workflowArtifacts = [],
  } = artifacts
  return {
    responses: responses.filter(
      (r) => stageForArtifact(r.resource as FhirResourceLike) === undefined,
    ),
    carePlans: carePlans.filter((cp) => stageForArtifact(cp) === undefined),
    observations: observations.filter((o) => stageForArtifact(o) === undefined),
    communications: communications.filter((c) => stageForArtifact(c) === undefined),
    workflowArtifacts: workflowArtifacts.filter((w) => stageForArtifact(w) === undefined),
  }
}

// TOOLS re-exported here for back-compat with patientPathway consumers that
// expected the symbol. Prefer importing from '../data/catalog' directly.
export { TOOLS }
