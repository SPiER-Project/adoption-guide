import { STAGES, TOOLS, type Tool } from '../data/catalog'

export type StageStatus = 'not-started' | 'active' | 'complete'

/**
 * Maps the persistName used in QuestionnaireView (and thus stored on
 * StoredResponse.questionnaireName) back to the canonical tool catalog entry.
 * Keep this aligned with the persistName values in App.tsx.
 */
const RESPONSE_NAME_TO_TOOL_ID: Record<string, string> = {
  'ASQ Screening': 'TL-001',
  'PHQ-9': 'TL-002',
  'C-SSRS Screener': 'TL-003',
  'SBQ-R': 'TL-025',
  'C-SSRS Full': 'TL-004',
  'CAMS SSF-5: Section A': 'TL-020',
  'CAMS SSF-5: Section B': 'TL-020',
  'CAMS Therapeutic Worksheet': 'TL-024',
  'Stanley-Brown Safety Plan': 'TL-007',
  'CAMS Stabilization Plan': 'TL-021',
}

export function toolForResponseName(name: string): Tool | undefined {
  const id = RESPONSE_NAME_TO_TOOL_ID[name]
  return id ? TOOLS.find(t => t.id === id) : undefined
}

export function stageForResponseName(name: string): string | undefined {
  return toolForResponseName(name)?.stageId
}

/**
 * CarePlan resources are identified by id strings like 'stanley-brown-...' or
 * 'cams-stabilization-...'. Map them to the stage they belong to.
 */
const CAREPLAN_ID_PATTERNS: { pattern: RegExp; stageId: string }[] = [
  { pattern: /stanley-brown/i,       stageId: 'document-safety-actions' },
  { pattern: /cams-stabilization/i,  stageId: 'document-safety-actions' },
  { pattern: /cams-therapeutic/i,    stageId: 'set-risk-status' },
]

export function stageForCarePlan(plan: { id?: string }): string | undefined {
  if (!plan.id) return undefined
  return CAREPLAN_ID_PATTERNS.find(p => p.pattern.test(plan.id!))?.stageId
}

interface DerivedPathway {
  statuses: Record<string, StageStatus>
  activeStageId: string | null
  maxCompletedIndex: number
}

export function derivePathwayStatus(
  responses: { questionnaireName: string }[],
  carePlans: { id?: string }[],
): DerivedPathway {
  const directlyTouched = new Set<string>()
  for (const r of responses) {
    const stage = stageForResponseName(r.questionnaireName)
    if (stage) directlyTouched.add(stage)
  }
  for (const cp of carePlans) {
    const stage = stageForCarePlan(cp)
    if (stage) directlyTouched.add(stage)
  }

  const stageIndex = (id: string) => STAGES.findIndex(s => s.id === id)
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
  responses: any[]
  carePlans: any[]
}

export function groupArtifactsByStage(
  responses: { questionnaireName: string }[],
  carePlans: { id?: string }[],
): StageArtifacts[] {
  return STAGES.map(stage => ({
    stageId: stage.id,
    responses: responses.filter(r => stageForResponseName(r.questionnaireName) === stage.id),
    carePlans: carePlans.filter(cp => stageForCarePlan(cp) === stage.id),
  }))
}
