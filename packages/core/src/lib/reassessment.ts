/**
 * Reassessment cadence — when the next suicide-risk reassessment is due
 * (deck panel 5, issue #279).
 *
 * ⚠️ **The intervals are NOT written here.** They are read out of
 * `PlanDefinition-SPiERReassessmentSchedule.json`, the generated form of
 * `ig/input/fsh/risk-episode.fsh`. Editing the FSH changes this module's
 * behaviour with no TypeScript change, which is the same contract `measures.ts`
 * holds for measure wiring — and `npm run check:reassessment` fails if the two
 * spellings of a tier inside that PlanDefinition ever disagree.
 *
 * Why read `action.code` rather than evaluate `condition[applicability]`: the
 * condition is FHIRPath, for a CDS engine that can evaluate it. This app cannot,
 * so each action restates its tier as a plain Coding. See the FSH for why both
 * exist.
 *
 * **Due dates are computed on read, never stored.** A stored next-due is a
 * second copy of a derived fact, and it goes stale the moment a tier changes or
 * an assessment lands — the same reason `overdueTaskCount` is computed per
 * render in `registry.ts`.
 */
import { RISK_TIER_SYSTEM } from './riskEpisode'
import type { RiskAlert } from './observationMappers'

type RiskLevel = RiskAlert['level']

const SCHEDULE_URL = 'http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule'

interface PlanDefinitionActionDoc {
  id?: string
  title?: string
  code?: Array<{ coding?: Array<{ system?: string; code?: string }> }>
  timingDuration?: { value?: number; code?: string; system?: string }
}

interface PlanDefinitionDoc {
  url?: string
  action?: PlanDefinitionActionDoc[]
}

const planModules = import.meta.glob<{ default: PlanDefinitionDoc }>(
  // ⚠️ Relative, not `@spier/fhir-artifacts/...`: Vite does not resolve aliases
  // inside `import.meta.glob`. Climbs out of web/ into the artifacts package.
  '../../../fhir-artifacts/generated/PlanDefinition-*.json',
  { eager: true },
)

const DAY_MS = 24 * 60 * 60 * 1000

/** UCUM codes this reader understands, in days. */
const UCUM_DAYS: Record<string, number> = { d: 1, wk: 7, mo: 30, a: 365 }

function readSchedule(): Record<string, number> {
  const doc = Object.values(planModules)
    .map(m => m.default)
    .find(d => d.url === SCHEDULE_URL)
  // An absent schedule yields an empty map, and every tier then reports "no
  // interval defined" rather than silently falling back to a hardcoded number —
  // a wrong due date is worse than a missing one.
  if (!doc?.action) return {}

  const out: Record<string, number> = {}
  for (const action of doc.action) {
    const tier = action.code
      ?.flatMap(c => c.coding ?? [])
      .find(c => c.system === RISK_TIER_SYSTEM)?.code
    const duration = action.timingDuration
    if (!tier || duration?.value === undefined) continue
    const perUnit = UCUM_DAYS[duration.code ?? 'd']
    if (perUnit === undefined) continue
    out[tier] = duration.value * perUnit
  }
  return out
}

/** Tier code → reassessment interval in days, from the published schedule. */
export const REASSESSMENT_INTERVAL_DAYS: Record<string, number> = readSchedule()

/**
 * App risk level → FSH tier code.
 *
 * Only `acute` differs: the concept layer calls that tier `imminent`, and the
 * app's `RiskAlert.level` calls it `acute`. Every mapper already does this
 * translation (see `safet.ts`, `pssFull.ts`); this is the same map in the one
 * place that needs it back.
 */
const LEVEL_TO_TIER: Record<RiskLevel, string> = {
  acute: 'imminent',
  high: 'high',
  moderate: 'moderate',
  low: 'low',
  none: 'no-risk',
}

export function tierCodeForLevel(level: RiskLevel): string {
  return LEVEL_TO_TIER[level]
}

/**
 * The inverse, built by inverting the SAME table rather than typing a second
 * one — so the two can never disagree about which end `acute`/`imminent` is.
 */
const TIER_TO_LEVEL = Object.fromEntries(
  Object.entries(LEVEL_TO_TIER).map(([level, tier]) => [tier, level]),
) as Record<string, RiskLevel>

/**
 * The app's risk level for a harmonized tier code, or `undefined` for a tier
 * this app has no word for.
 *
 * ⚠️ **`undefined` rather than a default.** A tier added to
 * `SPiERSuicideRiskTier` that nothing here knows about must not quietly render
 * as `none` — "screened, no risk" — which is the strongest claim in the
 * vocabulary and the opposite of "we do not recognise this". Callers fall back
 * to what they had.
 */
export function riskLevelForTier(tierCode: string): RiskLevel | undefined {
  return TIER_TO_LEVEL[tierCode]
}

/** Interval for a risk level, or null when that tier has no routine cadence. */
export function intervalDaysForLevel(level: RiskLevel): number | null {
  return REASSESSMENT_INTERVAL_DAYS[tierCodeForLevel(level)] ?? null
}

export type ReassessmentState =
  /** No routine cadence for this tier — see the FSH for imminent and no-risk. */
  | { kind: 'no-cadence'; reason: string }
  /** A cadence exists but there is no assessment to count forward from. */
  | { kind: 'no-baseline'; intervalDays: number }
  | {
      kind: 'scheduled'
      intervalDays: number
      /** ISO date (YYYY-MM-DD) the next reassessment is due. */
      dueDate: string
      /** Negative when overdue. */
      daysUntilDue: number
      status: 'overdue' | 'due-today' | 'due-soon' | 'scheduled'
    }

/**
 * How soon "due soon" is. 48 hours, because that is the window the deck's
 * amber "reassessment due in 48 hours" alert names — the alert and this column
 * must agree, so the threshold is defined once.
 */
export const DUE_SOON_DAYS = 2

const NO_CADENCE_REASON: Record<string, string> = {
  imminent:
    'Imminent risk has no routine cadence — it is handled by escalation rather than a schedule.',
  'no-risk': 'Not on the suicide-safer care pathway.',
}

/**
 * Reassessment state for one patient.
 *
 * `lastAssessment` is the date of the most recent risk-concept Observation, or
 * null when there is none. Counting forward from the last assessment rather than
 * from episode start is what the deck's tracker column means by "Last C-SSRS →
 * Next Due".
 */
export function reassessmentState(
  level: RiskLevel,
  lastAssessment: string | null,
  now: Date = new Date(),
): ReassessmentState {
  return reassessmentStateForTier(tierCodeForLevel(level), lastAssessment, now)
}

/**
 * The same, from a harmonized tier code rather than an app risk level.
 *
 * ⚠️ **The tier is what the published schedule is keyed on**, and the pathway
 * evaluator reads a tier off the record (a `SPiERSuicideRiskTier` Observation
 * or the episode's cached tier) rather than off an instrument's `RiskAlert`.
 * Translating that back into a `RiskAlert.level` just to call the function
 * above would round-trip through the one vocabulary the concept layer exists to
 * replace — so the tier-shaped entry point is the real one and
 * `reassessmentState` delegates to it.
 */
export function reassessmentStateForTier(
  tierCode: string,
  lastAssessment: string | null,
  now: Date = new Date(),
): ReassessmentState {
  const intervalDays = REASSESSMENT_INTERVAL_DAYS[tierCode] ?? null
  if (intervalDays === null) {
    return {
      kind: 'no-cadence',
      reason:
        NO_CADENCE_REASON[tierCode] ??
        'No reassessment interval is published for this tier.',
    }
  }
  if (!lastAssessment) return { kind: 'no-baseline', intervalDays }

  const last = new Date(lastAssessment)
  if (Number.isNaN(last.getTime())) return { kind: 'no-baseline', intervalDays }

  const due = new Date(last.getTime() + intervalDays * DAY_MS)
  // Whole days between calendar dates, so "due today" means the due date IS
  // today rather than "due within 24 hours" — the deck's tracker reads as dates.
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysUntilDue = Math.round((dueDay - today) / DAY_MS)

  const status =
    daysUntilDue < 0
      ? 'overdue'
      : daysUntilDue === 0
        ? 'due-today'
        : daysUntilDue <= DUE_SOON_DAYS
          ? 'due-soon'
          : 'scheduled'

  return {
    kind: 'scheduled',
    intervalDays,
    dueDate: due.toISOString().slice(0, 10),
    daysUntilDue,
    status,
  }
}

/** Human-readable status for the tracker's Status column. */
export function reassessmentStatusLabel(state: ReassessmentState): string {
  switch (state.kind) {
    case 'no-cadence':
      return 'No routine cadence'
    case 'no-baseline':
      return 'No assessment on record'
    case 'scheduled':
      switch (state.status) {
        case 'overdue':
          return `Overdue by ${Math.abs(state.daysUntilDue)} day${Math.abs(state.daysUntilDue) === 1 ? '' : 's'}`
        case 'due-today':
          return 'Due today'
        case 'due-soon':
          return `Due in ${state.daysUntilDue} day${state.daysUntilDue === 1 ? '' : 's'}`
        case 'scheduled':
          return `Due in ${state.daysUntilDue} days`
      }
  }
}
