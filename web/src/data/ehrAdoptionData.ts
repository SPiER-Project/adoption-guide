/**
 * Thin adapter that derives the rubric view over the shared catalog.
 * New code should import from `./catalog` directly.
 */
import { STAGES, TOOLS, type MaturityLevel } from './catalog'

export interface RubricCriterion {
  id: string
  name: string
  description: string
  levels: { level: number; label: string; description: string }[]
}

export interface RubricTool {
  toolId: string
  name: string
  stage: string
  targets: Record<string, MaturityLevel>
}

export const RUBRIC_CRITERIA: RubricCriterion[] = [
  {
    id: 'electronic',
    name: 'Electronic Availability',
    description: 'Can this tool be used electronically?',
    levels: [
      { level: 0, label: 'Paper Only', description: 'Not available electronically' },
      { level: 1, label: 'Scanned / Attached', description: 'Source document stored as DocumentReference or attachment' },
      { level: 2, label: 'Hybrid', description: 'Some structured fields captured alongside source document' },
      { level: 3, label: 'Fully Native', description: 'Built as Questionnaire + QuestionnaireResponse with full fidelity' },
    ],
  },
  {
    id: 'writeback',
    name: 'Data Write-Back',
    description: 'Does structured data get written back to the chart?',
    levels: [
      { level: 0, label: 'No Data', description: 'No discrete data captured' },
      { level: 1, label: 'Manual Abstraction', description: 'Key results manually entered into flowsheet or note' },
      { level: 2, label: 'Partial Extraction', description: 'Some observations auto-extracted from form' },
      { level: 3, label: 'Full Discrete', description: 'All outputs as FHIR resources (Observation, RiskAssessment, CarePlan)' },
    ],
  },
  {
    id: 'triggering',
    name: 'Care Triggering',
    description: 'Is the data useable for triggering follow-on care?',
    levels: [
      { level: 0, label: 'No Triggers', description: 'No automated or systematic follow-up' },
      { level: 1, label: 'Manual Review', description: 'Clinician manually reviews and decides next steps' },
      { level: 2, label: 'Task / Alert', description: 'System generates tasks or alerts from results' },
      { level: 3, label: 'Automated Routing', description: 'CDS Hooks, BPA triggers, or task queues route care automatically' },
    ],
  },
]

const stageTitleById = new Map(STAGES.map(s => [s.id, s.title]))

export const RUBRIC_TOOLS: RubricTool[] = TOOLS.map(t => ({
  toolId: t.id,
  name: t.shortName ?? t.name,
  stage: stageTitleById.get(t.stageId) ?? t.stageId,
  targets: t.targetMaturity as unknown as Record<string, MaturityLevel>,
}))

export const STAGE_ORDER = STAGES.map(s => s.title)

export const STAGE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  STAGES.map(s => [s.title, s.description])
)
