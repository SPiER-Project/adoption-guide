// Stage-transition triggers.
//
// Two of these are now FHIR-encoded as PlanDefinition.action.trigger entries
// in ig/input/fsh/. The remaining narrative entries below describe transitions
// that the IG has not yet machine-encoded. The merged TRIGGERS array surfaces
// both kinds so PatientJourney and other consumers stay stable.
//
// As more stage transitions get encoded in FSH, move them out of
// NARRATIVE_TRIGGERS below — the FHIR-derived list will pick them up.

import { STAGES } from './stages'

export type TriggerSource = 'fhir' | 'narrative'

export interface StageTrigger {
  id: string
  fromStageId: string
  toStageId?: string
  event: string
  condition: string
  action: string
  source: TriggerSource
  fhirActionId?: string
}

// ─────────────────────────────────────────────────────────────
// Narrative triggers (text-only; not yet in FSH)
// ─────────────────────────────────────────────────────────────

const NARRATIVE_TRIGGERS: Omit<StageTrigger, 'source'>[] = [
  // Identify Possible Risk → Clarify Risk (TRG-001 PHQ-9 and TRG-002 ASQ removed — now FHIR-encoded)
  {
    id: 'TRG-003',
    fromStageId: 'identify-possible-risk',
    toStageId: 'clarify-risk',
    event: 'ASQ acuity question completed',
    condition: 'Yes to item 5',
    action: 'Set acute positive; route urgent clarification of risk',
  },
  {
    id: 'TRG-004',
    fromStageId: 'identify-possible-risk',
    toStageId: 'clarify-risk',
    event: 'Columbia screener completed',
    condition: 'Positive or urgent result',
    action: 'Flag risk and route to Clarify Risk',
  },
  {
    id: 'TRG-005',
    fromStageId: 'identify-possible-risk',
    toStageId: 'clarify-risk',
    event: 'PSS-3 completed',
    condition: 'Screen positive',
    action: 'Flag risk and launch the configured clarification path',
  },

  // Clarify Risk → Define the Risk Picture
  {
    id: 'TRG-006',
    fromStageId: 'clarify-risk',
    toStageId: 'define-risk-picture',
    event: 'Clarification assessment completed',
    condition: 'Assessment outputs persisted',
    action: 'Route to Define the Risk Picture with derived risk level',
  },
  {
    id: 'TRG-012',
    fromStageId: 'clarify-risk',
    toStageId: 'define-risk-picture',
    event: 'CAMS SSF-5 First Session completed',
    condition: 'CAMS assessment outputs persisted',
    action: 'Update risk status and require documented safety actions',
  },

  // Define the Risk Picture → Document Safety Actions
  {
    id: 'TRG-007',
    fromStageId: 'define-risk-picture',
    toStageId: 'document-safety-actions',
    event: 'Risk status set',
    condition: 'Risk level = moderate / high / imminent',
    action: 'Require Document Safety Actions (safety plan review/update and means counseling status)',
  },
  {
    id: 'TRG-013',
    fromStageId: 'define-risk-picture',
    toStageId: 'document-safety-actions',
    event: 'CAMS Therapeutic Worksheet completed',
    condition: 'Driver / working-model content persisted',
    action: 'Make formulation and reasoning visible to the treatment team',
  },

  // Document Safety Actions → Coordinate Handoffs
  {
    id: 'TRG-014',
    fromStageId: 'document-safety-actions',
    toStageId: 'coordinate-handoffs',
    event: 'CAMS Stabilization Support Plan updated',
    condition: 'Plan version updated',
    action: 'Update active plan version, patient copy status, and means-safety fields',
  },

  // Coordinate Handoffs → Track Follow-Up
  {
    id: 'TRG-008',
    fromStageId: 'coordinate-handoffs',
    toStageId: 'track-follow-up',
    event: 'Disposition = discharge or transfer',
    condition: 'Active suicide safer care episode',
    action: 'Create handoff bundle, follow-up appointment requirement, and Track Follow-Up task',
  },
  {
    id: 'TRG-015',
    fromStageId: 'coordinate-handoffs',
    toStageId: 'track-follow-up',
    event: 'CAMS Outcome/Disposition Final Session completed',
    condition: 'Episode state updated',
    action: 'Store outcome/disposition and create handoff and follow-up tasks',
  },

  // Track Follow-Up → Track Risk Over Time
  {
    id: 'TRG-009',
    fromStageId: 'track-follow-up',
    toStageId: 'track-risk-over-time',
    event: 'Discharge timestamp recorded',
    condition: 'Patient discharged with active episode',
    action: 'Create 24–48 hour outreach task',
  },
  {
    id: 'TRG-010',
    fromStageId: 'track-follow-up',
    toStageId: 'track-risk-over-time',
    event: 'Missed appointment or failed outreach',
    condition: 'Outreach attempt unsuccessful',
    action: 'Escalate to Track Risk Over Time; update queue / registry state',
  },
  {
    id: 'TRG-011',
    fromStageId: 'track-follow-up',
    toStageId: 'track-risk-over-time',
    event: 'Follow-up outreach sequence assigned at discharge',
    condition: 'Outreach sequence assigned',
    action: 'Create outreach task sequence (caring contacts / contact attempts) using local cadence',
  },

  // Track Risk Over Time — ongoing
  {
    id: 'TRG-016',
    fromStageId: 'track-risk-over-time',
    event: 'Interim reassessment (e.g. CAMS SSF re-rating) completed',
    condition: 'Reassessment findings persisted',
    action: 'Update trendable findings, episode state, and resolution tracking',
  },
]

// ─────────────────────────────────────────────────────────────
// FHIR-derived triggers (from PlanDefinition.action.trigger)
// ─────────────────────────────────────────────────────────────

interface PdTriggerData {
  type?: string
  profile?: string[]
  codeFilter?: Array<{
    path?: string
    code?: Array<{ system?: string; code?: string; display?: string }>
    valueSet?: string
  }>
}

interface PdAction {
  id?: string
  title?: string
  description?: string
  trigger?: Array<{
    type?: string
    name?: string
    data?: PdTriggerData[]
  }>
}

interface PlanDefinitionDoc {
  id: string
  useContext?: Array<{
    code: { code: string }
    valueCodeableConcept?: { coding?: Array<{ code: string; system?: string }> }
  }>
  action?: PdAction[]
}

const pdModules = import.meta.glob<{ default: PlanDefinitionDoc }>(
  '../fhir/PlanDefinition-*.json',
  { eager: true },
)
const PLAN_DEFS: PlanDefinitionDoc[] = Object.values(pdModules).map((m) => m.default)

function stageIdOf(pd: PlanDefinitionDoc): string | undefined {
  const focus = pd.useContext?.find((c) => c.code.code === 'focus')
  return focus?.valueCodeableConcept?.coding?.find(
    (c) => c.system === 'http://spier.org/CodeSystem/spier-pathway-stage',
  )?.code
}

function previousStageId(stageId: string): string {
  const idx = STAGES.findIndex((s) => s.id === stageId)
  if (idx <= 0) return stageId
  return STAGES[idx - 1].id
}

function describeData(data: PdTriggerData): string {
  const profile = data.profile?.[0]?.split('/').pop() ?? data.type ?? 'resource'
  const valueSet = data.codeFilter?.find((cf) => cf.valueSet)?.valueSet
  if (valueSet) {
    const vsName = valueSet.split('/').pop()
    return `${profile} added with value in ${vsName}`
  }
  const code = data.codeFilter?.find((cf) => cf.code?.length)?.code?.[0]
  if (code?.code) {
    const display = code.display ? ` (${code.display})` : ''
    return `${profile} added with code ${code.code}${display}`
  }
  return `${profile} added`
}

function buildFhirTriggers(): StageTrigger[] {
  const triggers: StageTrigger[] = []
  for (const pd of PLAN_DEFS) {
    const toStageId = stageIdOf(pd)
    if (!toStageId) continue
    for (const action of pd.action ?? []) {
      for (const trig of action.trigger ?? []) {
        const condition = (trig.data ?? []).map(describeData).join(' AND ') || 'data-added'
        triggers.push({
          id: `pd-${pd.id}-${action.id ?? trig.name ?? 'action'}`,
          fromStageId: previousStageId(toStageId),
          toStageId,
          event: action.title ?? trig.name ?? 'data-added trigger',
          condition,
          action: `Route to ${toStageId} stage`,
          source: 'fhir',
          fhirActionId: action.id,
        })
      }
    }
  }
  return triggers
}

// ─────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────

export const TRIGGERS: StageTrigger[] = [
  ...buildFhirTriggers(),
  ...NARRATIVE_TRIGGERS.map((t) => ({ ...t, source: 'narrative' as const })),
]

export const triggersFromStage = (stageId: string) =>
  TRIGGERS.filter((t) => t.fromStageId === stageId)
