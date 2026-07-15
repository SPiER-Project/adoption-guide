// FHIR-derived Tool catalog.
//
// Clinical fields (name, purpose, stageId, questionnaireUrls) are read from
// ActivityDefinition and PlanDefinition JSON in web/src/data/fhir/, which the
// `npm run copy-fhir` prebuild step regenerates from ig/input/fsh/. UI
// metadata (badge, launchActions, etc.) is overlaid from tool-ui-metadata.ts.
// Every catalogued tool has a FSH ActivityDefinition; tools not yet fully
// FHIR-modelled use the minimal placeholders in pathway-tool-placeholders.fsh.

import {
  TOOL_UI_METADATA,
  uiMetadataFor,
  type BadgeVariant,
  type FhirExample,
  type InclusionStatus,
  type LaunchAction,
  type Licensing,
  type MaturityLevel,
  type RecordingPattern,
  type RecordingResource,
  type WorkflowType,
} from './tool-ui-metadata'
import { STAGES, type Stage } from './stages'

// Re-export UI metadata types so downstream consumers can keep importing them
// from the catalog barrel without caring about the file split.
export type {
  BadgeVariant,
  FhirExample,
  InclusionStatus,
  LaunchAction,
  Licensing,
  MaturityLevel,
  RecordingPattern,
  RecordingResource,
  WorkflowType,
}

export interface Tool {
  id: string
  name: string
  shortName?: string
  stageId: string
  purpose: string
  description?: string
  questionnaireUrls?: string[]
  /** Kind of FHIR artifact this tool produces. Defaults to 'questionnaire'. */
  workflowType: WorkflowType
  inclusionStatus: InclusionStatus
  settings: string[]
  badge: { label: string; variant: BadgeVariant }
  launchActions: LaunchAction[]
  tags?: string[]
  targetMaturity: {
    electronic: MaturityLevel
    writeback: MaturityLevel
    triggering: MaturityLevel
  }
  recordingPattern?: RecordingPattern
  fhirExamples?: FhirExample[]
  licensing?: Licensing
}

// ─────────────────────────────────────────────────────────────
// FHIR resource loading via Vite's import.meta.glob
// ─────────────────────────────────────────────────────────────

interface ActivityDefinitionDoc {
  id: string
  url: string
  title?: string
  description?: string
  purpose?: string
  kind?: string
  relatedArtifact?: Array<{ type?: string; display?: string; resource?: string }>
}

interface PlanDefinitionDoc {
  id: string
  useContext?: Array<{
    code: { code: string }
    valueCodeableConcept?: { coding?: Array<{ code: string; system?: string }> }
  }>
  action?: Array<{
    definitionCanonical?: string
  }>
}

const adModules = import.meta.glob<{ default: ActivityDefinitionDoc }>(
  '../fhir/ActivityDefinition-*.json',
  { eager: true },
)
const pdModules = import.meta.glob<{ default: PlanDefinitionDoc }>(
  '../fhir/PlanDefinition-*.json',
  { eager: true },
)

const ACTIVITY_DEFS: ActivityDefinitionDoc[] = Object.values(adModules).map((m) => m.default)
const PLAN_DEFS: PlanDefinitionDoc[] = Object.values(pdModules).map((m) => m.default)

/**
 * Strip the optional `|version` suffix from a canonical URL so lookups
 * tolerate both `http://spier.org/Questionnaire/ASQ-Screening-Tool` and
 * `http://spier.org/Questionnaire/ASQ-Screening-Tool|1.1.0-pilot`.
 */
export function stripCanonicalVersion(canonical: string): string {
  const pipe = canonical.indexOf('|')
  return pipe === -1 ? canonical : canonical.slice(0, pipe)
}

// AD.url → stageId, derived by inverting PD.action.definitionCanonical
// (each action points to an AD, the PD itself carries a stage useContext).
// Keys are stored with the version suffix stripped so lookups by AD.url
// (typically unversioned) match PD action canonicals even if those carry
// `|version`.
const STAGE_BY_AD_URL = (() => {
  const stageOf = (pd: PlanDefinitionDoc): string | undefined => {
    const stageContext = pd.useContext?.find((c) => c.code.code === 'focus')
    return stageContext?.valueCodeableConcept?.coding?.find(
      (c) => c.system === 'http://spier.org/CodeSystem/spier-pathway-stage',
    )?.code
  }
  const map = new Map<string, string>()
  for (const pd of PLAN_DEFS) {
    const stageId = stageOf(pd)
    if (!stageId) continue
    for (const action of pd.action ?? []) {
      if (action.definitionCanonical) {
        map.set(stripCanonicalVersion(action.definitionCanonical), stageId)
      }
    }
  }
  return map
})()

// ─────────────────────────────────────────────────────────────
// AD-id → Tool-id mapping (multiple ADs can map to one Tool)
// ─────────────────────────────────────────────────────────────

const AD_TO_TOOL_ID: Record<string, string> = {
  AdministerASQ: 'TL-001',
  AdministerPHQ9: 'TL-002',
  AdministerCSSRSScreener: 'TL-003',
  AdministerCSSRSFull: 'TL-004',
  AdministerStanleyBrown: 'TL-007',
  // The CAMS SSF-5 is ONE catalogued tool (per the SSC stage tiles) — every
  // session-form AD (Section A/B, interim re-rating, outcome/disposition)
  // collapses to TL-020 at the Clarify Risk stage.
  AdministerCAMSSectionA: 'TL-020',
  AdministerCAMSSectionB: 'TL-020',
  AdministerCAMSInterimSession: 'TL-020',
  AdministerCAMSOutcomeDisposition: 'TL-020',
  AdministerCAMSStabilizationPlan: 'TL-021',
  AdministerCAMSTherapeuticWorksheet: 'TL-024',
  AdministerSBQR: 'TL-025',
  // Minimal placeholder ActivityDefinitions (ig/input/fsh/pathway-tool-placeholders.fsh).
  // Clinical fields come from the AD; UI metadata stays keyed by these TL ids.
  AdministerCSSRSPediatric: 'TL-027',
  AdministerPSS3: 'TL-011',
  TriggerSuicideRiskWorkflow: 'TL-026',
  AdministerBSSA: 'TL-005',
  AdministerCSSRSSinceLastContact: 'TL-019',
  AdministerPSSFull: 'TL-014',
  AdministerCARSS: 'TL-028',
  AdministerLocalRiskAssessment: 'TL-029',
  AdministerSAFET: 'TL-006',
  ProvideMeansSafetyCounseling: 'TL-008',
  AuthorCrisisResponsePlan: 'TL-015',
  ShareCrisisResources: 'TL-013',
  RecordTransitionCheckpoint: 'TL-009',
  GenerateDischargeSafetyPacket: 'TL-030',
  SendRapidReferral: 'TL-017',
  ScheduleFollowUpAppointment: 'TL-031',
  RecordConsentSharingStatus: 'TL-032',
  RecordFollowUpOutreach: 'TL-033',
  SendCaringContact: 'TL-010',
  TrackFollowUpAppointment: 'TL-034',
  FollowUpMissedAppointment: 'TL-035',
  EscalateFollowUp: 'TL-036',
  MaintainRiskRegistry: 'TL-037',
  TrackRiskEpisodeStatus: 'TL-038',
  ScheduleRiskReassessment: 'TL-039',
  TrackOpenSafetyActions: 'TL-040',
  EscalateOverdueRisk: 'TL-041',
  ReportSuicideSaferCareMeasures: 'TL-042',
  ProvideReportingDashboard: 'TL-043',
  ExportSuicideSaferCareData: 'TL-044',
  ShareSuicideSaferCareData: 'TL-045',
}

// Where the per-AD FHIR title/purpose is too narrow for the Tool's combined
// scope (e.g. TL-020 spans Section A + Section B), the override here wins.
const CLINICAL_OVERRIDES: Record<
  string,
  { name?: string; purpose?: string; description?: string }
> = {
  'TL-020': {
    name: 'CAMS SSF-5',
    purpose: 'Collaborative suicide-focused assessment across the CAMS episode',
    description:
      'The SSF-5 is the structured collaborative assessment for the whole CAMS episode — one catalogued tool whose session-specific forms are captured inside it. First Session: Section A patient self-report (psychological pain, stress, agitation, hopelessness, self-hate, overall risk) and Section B clinician-rated ideation, plan, preparation, history, and drivers. Interim sessions repeat the Section A re-rating; the final session records outcome/disposition.',
  },
  'TL-002': {
    name: 'PHQ-9 / PHQ-A Item 9 Trigger',
  },
}

// ─────────────────────────────────────────────────────────────
// Build the catalog
// ─────────────────────────────────────────────────────────────

// The ActivityDefinitions reference their source Questionnaire via a
// `depends-on` relatedArtifact whose `resource` is the Questionnaire canonical
// (carrying a `|version` suffix, e.g. `.../Questionnaire/PHQ-9|1.0.0`). Match on
// the `/Questionnaire/` path so a future non-Questionnaire `depends-on` artifact
// isn't mistaken for one, and strip the version suffix so stored URLs line up
// with the (typically unversioned) lookups in `toolForQuestionnaireUrl`.
function questionnaireUrlsFromAD(ad: ActivityDefinitionDoc): string[] {
  return (ad.relatedArtifact ?? [])
    .filter((r) => r.type === 'depends-on' && r.resource?.includes('/Questionnaire/'))
    .map((r) => stripCanonicalVersion(r.resource!))
}

// Derive the catalog WorkflowType from ActivityDefinition.kind. Most tools are
// Questionnaire-based (kind ServiceRequest); outreach/handoff tools declare
// kind CommunicationRequest and surface as `communication`; registry/tracking/
// reporting functionality declares kind Task and surfaces as `workflow`.
function workflowTypeFromAD(ad: ActivityDefinitionDoc): WorkflowType {
  switch (ad.kind) {
    case 'CommunicationRequest':
      return 'communication'
    case 'Appointment':
      return 'appointment'
    case 'Task':
      return 'workflow'
    default:
      return 'questionnaire'
  }
}

function buildFhirBackedTools(): Tool[] {
  // Group ADs by Tool id so multi-AD tools (TL-020) collapse to one entry.
  const groups = new Map<string, ActivityDefinitionDoc[]>()
  for (const ad of ACTIVITY_DEFS) {
    const toolId = AD_TO_TOOL_ID[ad.id]
    if (!toolId) {
      console.warn(`[catalog] ActivityDefinition ${ad.id} has no Tool mapping`)
      continue
    }
    const list = groups.get(toolId) ?? []
    list.push(ad)
    groups.set(toolId, list)
  }

  const tools: Tool[] = []
  for (const [toolId, ads] of groups) {
    const primary = ads[0]
    const stageId = STAGE_BY_AD_URL.get(stripCanonicalVersion(primary.url))
    if (!stageId) {
      console.warn(`[catalog] No PD references ${primary.url} — tool ${toolId} has no stageId`)
      continue
    }
    const overrides = CLINICAL_OVERRIDES[toolId] ?? {}
    const ui = uiMetadataFor(toolId)
    // Dedupe: multi-AD tools can share a Questionnaire (CAMS Section A is
    // depended on by both the first-session and interim-session ADs).
    const questionnaireUrls = [...new Set(ads.flatMap(questionnaireUrlsFromAD))]

    tools.push({
      id: toolId,
      name: overrides.name ?? primary.title ?? toolId,
      stageId,
      purpose: overrides.purpose ?? primary.purpose ?? '',
      description: overrides.description ?? primary.description,
      questionnaireUrls: questionnaireUrls.length > 0 ? questionnaireUrls : undefined,
      workflowType: workflowTypeFromAD(primary),
      ...ui,
    })
  }
  return tools
}

const STATUS_RANK: Record<InclusionStatus, number> = { core: 0, optional: 1, future: 2 }

function sortTools(tools: Tool[]): Tool[] {
  const stageOrder = new Map(STAGES.map((s, i) => [s.id, i]))
  return [...tools].sort((a, b) => {
    const sa = stageOrder.get(a.stageId) ?? 99
    const sb = stageOrder.get(b.stageId) ?? 99
    if (sa !== sb) return sa - sb
    const ra = STATUS_RANK[a.inclusionStatus] ?? 9
    const rb = STATUS_RANK[b.inclusionStatus] ?? 9
    if (ra !== rb) return ra - rb
    return a.id.localeCompare(b.id)
  })
}

export const TOOLS: Tool[] = sortTools(buildFhirBackedTools())

// ─────────────────────────────────────────────────────────────
// Public helpers
// ─────────────────────────────────────────────────────────────

export const toolById = (id: string) => TOOLS.find((t) => t.id === id)
export const toolsByStage = (stageId: string) => TOOLS.filter((t) => t.stageId === stageId)
export const launchableTools = () => TOOLS.filter((t) => t.launchActions.length > 0)

export interface ToolStageGroup {
  stage: Stage
  tools: Tool[]
}

export function groupToolsByStage(
  tools: Tool[] = TOOLS,
  options: { skipEmpty?: boolean } = {},
): ToolStageGroup[] {
  const groups = STAGES.map((stage) => ({
    stage,
    tools: tools.filter((t) => t.stageId === stage.id),
  }))
  return options.skipEmpty ? groups.filter((g) => g.tools.length > 0) : groups
}

/**
 * Find the Tool that owns a Questionnaire canonical URL. Version-tolerant.
 */
export function toolForQuestionnaireUrl(canonical: string | undefined): Tool | undefined {
  if (!canonical) return undefined
  const target = stripCanonicalVersion(canonical)
  return TOOLS.find((t) =>
    t.questionnaireUrls?.some((u) => stripCanonicalVersion(u) === target),
  )
}

// Silence unused warning while TOOL_UI_METADATA is publicly available via the barrel.
export { TOOL_UI_METADATA }
