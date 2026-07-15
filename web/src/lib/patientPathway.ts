import { STAGES, TOOLS, toolForQuestionnaireUrl, type Tool } from '../data/catalog'

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
export const PATHWAY_STAGE_SYSTEM = 'http://spier.org/CodeSystem/spier-pathway-stage'

/**
 * Legacy fallback: tool-emitted CarePlans whose stage is implicit in the id
 * convention (predate the category.coding tagging mechanism).
 */
const CAREPLAN_ID_PATTERNS: { pattern: RegExp; stageId: string }[] = [
  { pattern: /stanley-brown/i, stageId: 'document-safety-actions' },
  { pattern: /cams-stabilization/i, stageId: 'document-safety-actions' },
  { pattern: /crisis-response-plan/i, stageId: 'document-safety-actions' },
  { pattern: /cams-therapeutic/i, stageId: 'define-risk-picture' },
]

const STAGE_IDS = new Set(STAGES.map((s) => s.id))

/** Minimal shape we read off any FHIR resource for pathway-stage resolution. */
export interface FhirResourceLike {
  resourceType?: string
  id?: string
  questionnaire?: string
  meta?: { tag?: { system?: string; code?: string }[] }
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
 *  4. Legacy CarePlan id-regex fallback (Stanley-Brown / CAMS Stabilization /
 *     CAMS Therapeutic) for tool-emitted plans without an explicit stage tag.
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

  if (resource.id) {
    const match = CAREPLAN_ID_PATTERNS.find((p) => p.pattern.test(resource.id!))
    if (match) return match.stageId
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
}

function everyResource(artifacts: PatientArtifacts): FhirResourceLike[] {
  return [
    ...(artifacts.responses ?? []).map((r) => r.resource as FhirResourceLike),
    ...(artifacts.carePlans ?? []),
    ...(artifacts.observations ?? []),
    ...(artifacts.communications ?? []),
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
}

export function groupArtifactsByStage(artifacts: PatientArtifacts): StageArtifacts[] {
  const { responses = [], carePlans = [], observations = [], communications = [] } = artifacts
  return STAGES.map((stage) => ({
    stageId: stage.id,
    responses: responses.filter(
      (r) => stageForArtifact(r.resource as FhirResourceLike) === stage.id,
    ),
    carePlans: carePlans.filter((cp) => stageForArtifact(cp) === stage.id),
    observations: observations.filter((o) => stageForArtifact(o) === stage.id),
    communications: communications.filter((c) => stageForArtifact(c) === stage.id),
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
  const { responses = [], carePlans = [], observations = [], communications = [] } = artifacts
  return {
    responses: responses.filter(
      (r) => stageForArtifact(r.resource as FhirResourceLike) === undefined,
    ),
    carePlans: carePlans.filter((cp) => stageForArtifact(cp) === undefined),
    observations: observations.filter((o) => stageForArtifact(o) === undefined),
    communications: communications.filter((c) => stageForArtifact(c) === undefined),
  }
}

// TOOLS re-exported here for back-compat with patientPathway consumers that
// expected the symbol. Prefer importing from '../data/catalog' directly.
export { TOOLS }
