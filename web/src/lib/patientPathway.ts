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
 * Map a CarePlan to its pathway stage.
 *
 * Preferred (FHIR-clean): a `category.coding` entry that points at the SPiER
 * pathway-stage CodeSystem. Used for stages 4-7 that don't have dedicated tools
 * yet, so a synthetic CarePlan can mark a stage complete without a matching
 * QuestionnaireResponse.
 *
 * Fallback (legacy): regex on the plan id for tool-emitted CarePlans whose
 * stage is implicit in the id convention (Stanley-Brown, CAMS Stabilization,
 * CAMS Therapeutic).
 */
const PATHWAY_STAGE_SYSTEM = 'http://spier.org/CodeSystem/spier-pathway-stage'

const CAREPLAN_ID_PATTERNS: { pattern: RegExp; stageId: string }[] = [
  { pattern: /stanley-brown/i, stageId: 'document-safety-actions' },
  { pattern: /cams-stabilization/i, stageId: 'document-safety-actions' },
  { pattern: /cams-therapeutic/i, stageId: 'set-risk-status' },
]

const STAGE_IDS = new Set(STAGES.map((s) => s.id))

export interface CarePlanLike {
  id?: string
  category?: { coding?: { system?: string; code?: string }[] }[]
}

export function stageForCarePlan(plan: CarePlanLike): string | undefined {
  for (const cat of plan.category ?? []) {
    for (const coding of cat.coding ?? []) {
      if (coding.system === PATHWAY_STAGE_SYSTEM && coding.code && STAGE_IDS.has(coding.code)) {
        return coding.code
      }
    }
  }
  if (plan.id) {
    const match = CAREPLAN_ID_PATTERNS.find((p) => p.pattern.test(plan.id!))
    if (match) return match.stageId
  }
  return undefined
}

interface DerivedPathway {
  statuses: Record<string, StageStatus>
  activeStageId: string | null
  maxCompletedIndex: number
}

export interface StoredResponseLike {
  resource: QuestionnaireResponseLike
}

export function derivePathwayStatus(
  responses: StoredResponseLike[],
  carePlans: CarePlanLike[],
): DerivedPathway {
  const directlyTouched = new Set<string>()
  for (const r of responses) {
    const stage = stageForResponse(r.resource)
    if (stage) directlyTouched.add(stage)
  }
  for (const cp of carePlans) {
    const stage = stageForCarePlan(cp)
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
 * artifacts (caller can decide whether to render the empty section).
 */
export interface StageArtifacts {
  stageId: string
  responses: StoredResponseLike[]
  carePlans: CarePlanLike[]
}

export function groupArtifactsByStage(
  responses: StoredResponseLike[],
  carePlans: CarePlanLike[],
): StageArtifacts[] {
  return STAGES.map((stage) => ({
    stageId: stage.id,
    responses: responses.filter((r) => stageForResponse(r.resource) === stage.id),
    carePlans: carePlans.filter((cp) => stageForCarePlan(cp) === stage.id),
  }))
}

// TOOLS re-exported here for back-compat with patientPathway consumers that
// expected the symbol. Prefer importing from '../data/catalog' directly.
export { TOOLS }
