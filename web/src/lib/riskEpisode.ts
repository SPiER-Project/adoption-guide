/**
 * Stage-7 (Track Risk Over Time) domain helpers.
 *
 * The FHIR shape is defined in ig/input/fsh/risk-episode.fsh; this module is
 * the runtime counterpart shared by the episode recorder, the safety-task
 * recorder, and the registry work queue. Keeping the logic here (rather than
 * in the components) is what makes it unit-testable — the interesting rules
 * are "is this episode open", "is this task overdue", and "may a second
 * episode be opened", none of which should be re-implemented per view.
 *
 * ⚠️ DEMO ONLY — no data is persisted to a server.
 */
import { PATHWAY_STAGE_SYSTEM } from './patientPathway'
import type { EpisodeOfCareResource, FlagResource, TaskResource } from '../types/fhir'

export const STAGE_ID = 'track-risk-over-time'

export const EPISODE_PROFILE = 'http://spier.org/StructureDefinition/spier-suicide-risk-episode'
export const FLAG_PROFILE = 'http://spier.org/StructureDefinition/spier-suicide-risk-flag'
export const TASK_PROFILE = 'http://spier.org/StructureDefinition/spier-safety-task'

export const EPISODE_TYPE_SYSTEM = 'http://spier.org/CodeSystem/spier-episode-type'
export const ENTRY_REASON_SYSTEM = 'http://spier.org/CodeSystem/spier-episode-entry-reason'
export const CLOSURE_REASON_SYSTEM = 'http://spier.org/CodeSystem/spier-episode-closure-reason'
export const SAFETY_TASK_TYPE_SYSTEM = 'http://spier.org/CodeSystem/spier-safety-task-type'
export const ESCALATION_TRIGGER_SYSTEM = 'http://spier.org/CodeSystem/spier-escalation-trigger'
export const RISK_FLAG_SYSTEM = 'http://spier.org/CodeSystem/spier-risk-flag'
export const RISK_TIER_SYSTEM = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

export const ENTRY_REASON_EXT = 'http://spier.org/StructureDefinition/episode-entry-reason'
export const CLOSURE_REASON_EXT = 'http://spier.org/StructureDefinition/episode-closure-reason'
export const CURRENT_TIER_EXT = 'http://spier.org/StructureDefinition/episode-current-risk-tier'
export const ESCALATION_TRIGGER_EXT = 'http://spier.org/StructureDefinition/escalation-trigger'

/** EpisodeOfCare.status values that mean the episode is still open. */
const OPEN_EPISODE_STATUSES = new Set(['planned', 'waitlist', 'active', 'onhold'])

/** Task.status values that mean the work is still outstanding. */
const OPEN_TASK_STATUSES = new Set([
  'draft',
  'requested',
  'received',
  'accepted',
  'ready',
  'in-progress',
  'on-hold',
])

export interface CodedOption {
  code: string
  display: string
}

export const ENTRY_REASONS: CodedOption[] = [
  { code: 'positive-screen', display: 'Positive screen' },
  { code: 'elevated-assessment', display: 'Elevated risk on assessment' },
  { code: 'suicide-attempt', display: 'Suicide attempt' },
  { code: 'safety-plan-needed', display: 'Safety plan needed' },
  { code: 'transition-discharge', display: 'Transition or discharge' },
  { code: 'referral', display: 'Referral' },
  { code: 'clinician-judgment', display: 'Clinician judgment' },
  { code: 'manual-add', display: 'Manual add' },
]

export const CLOSURE_REASONS: CodedOption[] = [
  { code: 'risk-resolved', display: 'Risk resolved' },
  { code: 'transferred', display: 'Transferred to other care' },
  { code: 'stepped-down', display: 'Stepped down to routine care' },
  { code: 'patient-declined', display: 'Patient declined' },
  { code: 'lost-to-follow-up', display: 'Lost to follow-up' },
  { code: 'deceased', display: 'Deceased' },
  { code: 'administrative', display: 'Administrative closure' },
]

export const RISK_TIERS: CodedOption[] = [
  { code: 'no-risk', display: 'No risk identified' },
  { code: 'low', display: 'Low risk' },
  { code: 'moderate', display: 'Moderate risk' },
  { code: 'high', display: 'High risk' },
  { code: 'imminent', display: 'Imminent risk' },
]

export const SAFETY_TASK_TYPES: CodedOption[] = [
  { code: 'reassessment-due', display: 'Reassessment due' },
  { code: 'assessment-needed', display: 'Assessment needed' },
  { code: 'safety-plan-needed', display: 'Safety plan needed' },
  { code: 'safety-plan-update', display: 'Safety plan update needed' },
  { code: 'lethal-means-action-open', display: 'Lethal means action open' },
  { code: 'follow-up-outreach-due', display: 'Follow-up outreach due' },
  { code: 'referral-incomplete', display: 'Referral / handoff incomplete' },
  { code: 'appointment-missing', display: 'Appointment missing' },
  { code: 'escalation', display: 'Risk escalation' },
]

export const ESCALATION_TRIGGERS: CodedOption[] = [
  { code: 'high-risk-status', display: 'High-risk status' },
  { code: 'worsening-reassessment', display: 'Worsening reassessment' },
  { code: 'missed-reassessment', display: 'Missed reassessment' },
  { code: 'missed-follow-up', display: 'Missed follow-up' },
  { code: 'safety-action-overdue', display: 'Open safety action overdue' },
  { code: 'missed-appointment', display: 'Missed appointment / no-show' },
  { code: 'unable-to-reach', display: 'Unable to reach patient' },
  { code: 'manual-escalation', display: 'Clinician manually escalated' },
  // Added for Stage 6 (Track Follow-Up), whose SSC trigger list extends this
  // one. Kept in the SAME CodeSystem (spier-escalation-trigger) rather than
  // forked, so a case escalated from failing follow-up and one escalated from
  // the risk registry land in the same work queue — see follow-up.fsh.
  { code: 'new-safety-concern', display: 'New safety concern' },
  { code: 'missed-outreach-window', display: 'Missed outreach window' },
  { code: 'failed-contact-sequence', display: 'Failed contact sequence' },
]

export function displayFor(options: CodedOption[], code: string): string {
  return options.find(o => o.code === code)?.display ?? code
}

// ─── Episode predicates ──────────────────────────────────────

export function isEpisodeOpen(episode: EpisodeOfCareResource): boolean {
  return OPEN_EPISODE_STATUSES.has((episode as { status?: string }).status ?? '')
}

/**
 * The patient's currently-open episode, or undefined.
 *
 * Per the Stage-7 design decision, a patient may have SEVERAL episodes over
 * time but only ONE open at a time — so this is the resource a new task
 * attaches to, and its presence is what blocks opening another episode.
 */
export function findOpenEpisode(
  episodes: EpisodeOfCareResource[],
): EpisodeOfCareResource | undefined {
  return episodes.find(isEpisodeOpen)
}

export function episodeCurrentTier(episode: EpisodeOfCareResource | undefined): string | undefined {
  if (!episode) return undefined
  const exts = (episode as { extension?: { url?: string; valueCodeableConcept?: { coding?: { code?: string }[] } }[] }).extension
  return exts?.find(e => e.url === CURRENT_TIER_EXT)?.valueCodeableConcept?.coding?.[0]?.code
}

// ─── Task predicates ─────────────────────────────────────────

export function isTaskOpen(task: TaskResource): boolean {
  return OPEN_TASK_STATUSES.has((task as { status?: string }).status ?? '')
}

/** Due date (`Task.restriction.period.end`), or undefined when open-ended. */
export function taskDueDate(task: TaskResource): string | undefined {
  return (task as { restriction?: { period?: { end?: string } } }).restriction?.period?.end
}

/**
 * Overdue is COMPUTED, never stored (Stage-7 design §2): a stored flag would
 * need a sweeper job and would read wrong between sweeps. A completed or
 * cancelled task is never overdue, however far past its due date.
 */
export function isTaskOverdue(task: TaskResource, now: Date = new Date()): boolean {
  if (!isTaskOpen(task)) return false
  const due = taskDueDate(task)
  if (!due) return false
  const dueMs = new Date(due).getTime()
  return Number.isFinite(dueMs) && dueMs < now.getTime()
}

/** Open tasks for a given episode, soonest due first (undated last). */
export function tasksForEpisode(tasks: TaskResource[], episodeId: string | undefined): TaskResource[] {
  if (!episodeId) return []
  return tasks
    .filter(t => {
      const basedOn = (t as { basedOn?: { reference?: string }[] }).basedOn
      return basedOn?.some(b => b.reference === `EpisodeOfCare/${episodeId}`) ?? false
    })
    .sort((a, b) => {
      const da = taskDueDate(a)
      const db = taskDueDate(b)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return new Date(da).getTime() - new Date(db).getTime()
    })
}

// ─── Builders ────────────────────────────────────────────────

function stageTag() {
  return [{ system: PATHWAY_STAGE_SYSTEM, code: STAGE_ID, display: 'Track Risk Over Time' }]
}

export function buildEpisode(params: {
  id: string
  patientId: string | null
  entryReason: string
  currentTier?: string
  startDate: string
}): EpisodeOfCareResource {
  return {
    resourceType: 'EpisodeOfCare',
    id: params.id,
    meta: { profile: [EPISODE_PROFILE], tag: stageTag() },
    status: 'active',
    type: [
      {
        coding: [
          { system: EPISODE_TYPE_SYSTEM, code: 'suicide-safer-care', display: 'Suicide-safer care episode' },
        ],
      },
    ],
    extension: [
      {
        url: ENTRY_REASON_EXT,
        valueCodeableConcept: {
          coding: [
            { system: ENTRY_REASON_SYSTEM, code: params.entryReason, display: displayFor(ENTRY_REASONS, params.entryReason) },
          ],
        },
      },
      ...(params.currentTier
        ? [
            {
              url: CURRENT_TIER_EXT,
              valueCodeableConcept: {
                coding: [
                  { system: RISK_TIER_SYSTEM, code: params.currentTier, display: displayFor(RISK_TIERS, params.currentTier) },
                ],
              },
            },
          ]
        : []),
    ],
    patient: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    period: { start: params.startDate },
  }
}

/**
 * Close an episode: finished status, an end date, a closure reason, and a
 * statusHistory entry. Returns a NEW resource with the same id so the store's
 * upsert-by-id replaces the open version rather than leaving both.
 */
export function closeEpisode(
  episode: EpisodeOfCareResource,
  params: { closureReason: string; endDate: string },
): EpisodeOfCareResource {
  const e = episode as EpisodeOfCareResource & {
    period?: { start?: string }
    extension?: { url?: string }[]
    statusHistory?: unknown[]
  }
  const start = e.period?.start
  const priorExtensions = (e.extension ?? []).filter(x => x.url !== CLOSURE_REASON_EXT)
  return {
    ...e,
    status: 'finished',
    statusHistory: [
      ...(e.statusHistory ?? []),
      { status: 'active', period: { start, end: params.endDate } },
      { status: 'finished', period: { start: params.endDate } },
    ],
    period: { start, end: params.endDate },
    extension: [
      ...priorExtensions,
      {
        url: CLOSURE_REASON_EXT,
        valueCodeableConcept: {
          coding: [
            { system: CLOSURE_REASON_SYSTEM, code: params.closureReason, display: displayFor(CLOSURE_REASONS, params.closureReason) },
          ],
        },
      },
    ],
  } as EpisodeOfCareResource
}

export function buildFlag(params: { id: string; patientId: string | null; startDate: string }): FlagResource {
  return {
    resourceType: 'Flag',
    id: params.id,
    meta: { profile: [FLAG_PROFILE], tag: stageTag() },
    status: 'active',
    category: [
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/flag-category', code: 'safety', display: 'Safety' }] },
    ],
    code: {
      coding: [
        {
          system: RISK_FLAG_SYSTEM,
          code: 'active-suicide-risk-episode',
          display: 'Active suicide-safer care episode',
        },
      ],
      text: 'Active suicide-safer care episode',
    },
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    period: { start: params.startDate },
  }
}

/** Clear a flag when its episode closes. Same id ⇒ upsert replaces it. */
export function clearFlag(flag: FlagResource, endDate: string): FlagResource {
  const f = flag as FlagResource & { period?: { start?: string } }
  return { ...f, status: 'inactive', period: { start: f.period?.start, end: endDate } } as FlagResource
}

export function buildSafetyTask(params: {
  id: string
  patientId: string | null
  episodeId?: string
  taskType: string
  dueDate?: string
  owner?: string
  escalationTriggers?: string[]
  note?: string
  authoredOn: string
}): TaskResource {
  const triggers = params.escalationTriggers ?? []
  return {
    resourceType: 'Task',
    id: params.id,
    meta: { profile: [TASK_PROFILE], tag: stageTag() },
    status: 'requested',
    intent: 'plan',
    code: {
      coding: [
        { system: SAFETY_TASK_TYPE_SYSTEM, code: params.taskType, display: displayFor(SAFETY_TASK_TYPES, params.taskType) },
      ],
      text: displayFor(SAFETY_TASK_TYPES, params.taskType),
    },
    for: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    ...(params.episodeId ? { basedOn: [{ reference: `EpisodeOfCare/${params.episodeId}` }] } : {}),
    authoredOn: params.authoredOn,
    ...(params.owner ? { owner: { display: params.owner } } : {}),
    ...(params.dueDate ? { restriction: { period: { end: params.dueDate } } } : {}),
    ...(triggers.length
      ? {
          extension: triggers.map(code => ({
            url: ESCALATION_TRIGGER_EXT,
            valueCodeableConcept: {
              coding: [{ system: ESCALATION_TRIGGER_SYSTEM, code, display: displayFor(ESCALATION_TRIGGERS, code) }],
            },
          })),
        }
      : {}),
    ...(params.note ? { note: [{ text: params.note }] } : {}),
  }
}

/** Mark a task complete. Same id ⇒ upsert replaces it. */
export function completeTask(task: TaskResource): TaskResource {
  return { ...task, status: 'completed' } as TaskResource
}
