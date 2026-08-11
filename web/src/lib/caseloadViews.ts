/**
 * Caseload sorting and the view registry — the non-rendering half of the
 * Population view's table (issue #278).
 *
 * Split out of `CaseloadTable.tsx` because a file that exports both components
 * and constants breaks fast refresh, and because the sort comparators are worth
 * testing without mounting a table.
 *
 * ─── Why a view is data ───
 *
 * The deck contains FOUR tables over the same rows: the general caseload, the
 * reassessment tracker (panel 5), the care-manager work queue (panel 7) and the
 * consultant queue (panel 6). Written as four components they would share a row
 * shape and nothing else, and would drift the first time `DerivedRegistryRow`
 * gained a field. So a view is a list of column keys plus a default sort, and
 * adding one means adding an entry here — no new component, no new markup.
 */
import { RISK_LEVEL_ORDER } from './observationMappers'
import type { DerivedRegistryRow } from './registry'
import type { RiskAlert } from './observationMappers'

type RiskLevel = RiskAlert['level']

export type SortCol = 'patient' | 'risk' | 'activity' | 'nextVisit' | 'nextDue'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  col: SortCol
  dir: SortDir
}

/** Which header-mounted filter a column carries. */
export type FilterKey = 'stage' | 'risk' | 'age'

export interface FilterOption {
  value: string
  label: string
  count: number
  riskLevel?: RiskLevel
}

// Each column's default direction is the end a triage nurse actually wants
// first, so one click on a header never lands on the useless ordering: highest
// risk, most recent activity, soonest visit, names A→Z.
export const DEFAULT_DIR: Record<SortCol, SortDir> = {
  patient: 'asc',
  risk: 'desc',
  activity: 'desc',
  nextVisit: 'asc',
  // Soonest-due first, which puts the most overdue reassessment at the top —
  // the one end of this column a triage reader ever wants.
  nextDue: 'asc',
}

function activityTime(row: DerivedRegistryRow): number | null {
  return row.lastActivity ? new Date(row.lastActivity.date).getTime() : null
}

function nextVisitTime(row: DerivedRegistryRow): number | null {
  return row.nextAppointment ? new Date(row.nextAppointment.date).getTime() : null
}

function nextDueTime(row: DerivedRegistryRow): number | null {
  return row.reassessment.kind === 'scheduled'
    ? new Date(row.reassessment.dueDate).getTime()
    : null
}

/** Columns whose value can be absent, and the accessor that says so. */
const NULLABLE_TIME: Partial<Record<SortCol, (row: DerivedRegistryRow) => number | null>> = {
  activity: activityTime,
  nextVisit: nextVisitTime,
  nextDue: nextDueTime,
}

// Comparators are written for each column's DEFAULT_DIR and negated for the
// other direction, so "which end is interesting" lives in one table above.
function compareInDefaultDir(col: SortCol, a: DerivedRegistryRow, b: DerivedRegistryRow): number {
  switch (col) {
    case 'patient':
      return a.displayName.localeCompare(b.displayName)
    case 'risk':
      // RISK_LEVEL_ORDER puts acute lowest, so ascending order is highest-risk-first.
      return RISK_LEVEL_ORDER[a.currentRiskLevel] - RISK_LEVEL_ORDER[b.currentRiskLevel]
    case 'activity':
      return (activityTime(b) ?? 0) - (activityTime(a) ?? 0)
    case 'nextVisit':
      return (nextVisitTime(a) ?? 0) - (nextVisitTime(b) ?? 0)
    case 'nextDue':
      return (nextDueTime(a) ?? 0) - (nextDueTime(b) ?? 0)
  }
}

export function sortRows(list: DerivedRegistryRow[], sort: SortState): DerivedRegistryRow[] {
  const flip = sort.dir === DEFAULT_DIR[sort.col] ? 1 : -1
  const nullable = NULLABLE_TIME[sort.col]
  return [...list].sort((a, b) => {
    if (nullable) {
      // "No activity yet" is not "least recent activity", and "no visit booked"
      // is not "the most overdue visit" — undated rows sort to the end in BOTH
      // directions, so flipping never promotes them to the top.
      const ta = nullable(a)
      const tb = nullable(b)
      if (ta === null || tb === null) return ta === tb ? 0 : ta === null ? 1 : -1
    }
    return flip * compareInDefaultDir(sort.col, a, b)
  })
}

export interface CaseloadView {
  id: string
  label: string
  /** One-line explanation of what this view is for. */
  description: string
  columns: string[]
  defaultSort: SortState
}

/**
 * The views the current data supports.
 *
 * Deliberately absent, with what each waits on:
 *  - **Care manager work queue** (panel 7) — Task codes rich enough to pivot by
 *    work type, plus the role model for the "whose queue" part.
 *  - **Consultant queue** (panel 6) — the phase-4 role model and approval gate.
 */
export const CASELOAD_VIEWS: CaseloadView[] = [
  {
    id: 'caseload',
    label: 'Caseload',
    description: 'Every patient on the pathway, highest risk first.',
    columns: ['patient', 'stage', 'risk', 'workFollowUp', 'activity', 'next'],
    defaultSort: { col: 'risk', dir: 'desc' },
  },
  {
    id: 'follow-up',
    label: 'Follow-up',
    description: 'Booked visits, failed outreach and open referrals — soonest visit first.',
    columns: ['patient', 'risk', 'nextVisit', 'outreach', 'referrals', 'activity'],
    defaultSort: { col: 'nextVisit', dir: 'asc' },
  },
  {
    id: 'reassessment',
    label: 'Reassessment',
    description:
      'Deck panel 5 — when each patient is next due, on the cadence their tier publishes. Most overdue first.',
    columns: ['patient', 'risk', 'lastAssessment', 'nextReassessment', 'reassessmentStatus'],
    defaultSort: { col: 'nextDue', dir: 'asc' },
  },
]

/** Falls back to the first view, so a stale saved id cannot blank the table. */
export function viewById(id: string): CaseloadView {
  return CASELOAD_VIEWS.find(v => v.id === id) ?? CASELOAD_VIEWS[0]
}
