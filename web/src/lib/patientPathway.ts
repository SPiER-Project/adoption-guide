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
 * CarePlan resources are identified by id strings like 'stanley-brown-...' or
 * 'cams-stabilization-...'. Map them to the stage they belong to.
 */
const CAREPLAN_ID_PATTERNS: { pattern: RegExp; stageId: string }[] = [
  { pattern: /stanley-brown/i, stageId: 'document-safety-actions' },
  { pattern: /cams-stabilization/i, stageId: 'document-safety-actions' },
  { pattern: /cams-therapeutic/i, stageId: 'set-risk-status' },
]

export function stageForCarePlan(plan: { id?: string }): string | undefined {
  if (!plan.id) return undefined
  return CAREPLAN_ID_PATTERNS.find((p) => p.pattern.test(plan.id!))?.stageId
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
  carePlans: { id?: string }[],
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
  carePlans: { id?: string }[]
}

export function groupArtifactsByStage(
  responses: StoredResponseLike[],
  carePlans: { id?: string }[],
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
