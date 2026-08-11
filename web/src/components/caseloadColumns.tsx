/**
 * How each caseload column renders, and which header control it carries
 * (issue #278). The view registry that references these keys is
 * `lib/caseloadViews.ts`; this file holds only the rendering half.
 *
 * Declares and exports no components on purpose: the cell bodies are plain
 * functions returning JSX, so this stays a data module rather than a
 * fast-refresh boundary.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { stageTitleById } from '../data/catalog'
import { ageOf } from '../lib/populationFilters'
import { RISK_LABEL } from '../lib/populationSummary'
import { formatDaysAgo } from '../lib/relativeTime'
import type { FilterKey, SortCol } from '../lib/caseloadViews'
import type { DerivedRegistryRow } from '../lib/registry'

export interface CaseloadColumn {
  header: string
  /** Sortable via a header button when set. */
  sortCol?: SortCol
  /** Filter menu mounted in this column's header when set. */
  filter?: FilterKey
  /**
   * When true the filter replaces the header label rather than sitting beside
   * it — the label lives on the filter trigger. Columns that are both sortable
   * and filterable show both controls instead.
   */
  filterIsLabel?: boolean
  className?: string
  render: (row: DerivedRegistryRow) => ReactNode
}

// A plain render function rather than a component, like `followUpBody` below:
// this module exports data (COLUMNS), and a file that both declares components
// and exports non-components is not a valid fast-refresh boundary.
function patientBody(row: DerivedRegistryRow): ReactNode {
  const age = ageOf(row.dob)
  return (
    <>
      {/* Real link: keyboard-focusable and activatable, and announced to screen
          readers. The whole-row onClick is a mouse-only convenience;
          stopPropagation avoids a double navigate when the link is clicked. The
          FHIRcast broadcast happens on activation in PatientContext, so both
          paths publish without an explicit call here. */}
      <Link
        to={`/patient/chart/${row.id}`}
        className="caseload-patient-link"
        onClick={e => e.stopPropagation()}
      >
        <span className="caseload-patient-name">{row.displayName}</span>
      </Link>
      {/* Age replaces the raw DOB now that an age filter exists — it is what the
          filter selects on, and a reader cannot check a band against a birth
          year at a glance. DOB stays visible when it will not parse, because
          then it is the thing that needs fixing. */}
      <div className="caseload-patient-meta">
        MRN {row.mrn} &middot; {age === null ? `DOB ${row.dob}` : `${age}y`}
      </div>
    </>
  )
}

function followUpBody(row: DerivedRegistryRow): ReactNode {
  if (row.nextAppointment) {
    return (
      <>
        <div className="caseload-activity-label">
          Next visit {row.nextAppointment.date.slice(0, 10)}
        </div>
        <div className="caseload-activity-date">
          {row.nextAppointment.provider ?? 'Provider not recorded'}
        </div>
      </>
    )
  }
  return (
    <div className="caseload-activity-label">
      {row.awaitingNoShowFollowUp ? 'No-show — outreach due' : 'No visit booked'}
    </div>
  )
}

/**
 * Every column any view can use. Keys are referenced by `CASELOAD_VIEWS` as
 * strings, so an unused column is dead weight the type system will not flag —
 * keep the two lists in step by hand.
 */
export const COLUMNS: Record<string, CaseloadColumn> = {
  patient: {
    header: 'Patient',
    sortCol: 'patient',
    filter: 'age',
    render: row => patientBody(row),
  },
  stage: {
    header: 'Current Stage',
    filter: 'stage',
    filterIsLabel: true,
    render: row => (
      <span className="caseload-stage">
        {row.currentStage ? stageTitleById(row.currentStage) : 'Pathway complete'}
      </span>
    ),
  },
  risk: {
    header: 'Risk',
    sortCol: 'risk',
    filter: 'risk',
    className: 'caseload-table-risk-col',
    render: row => (
      <span className={`risk-pill risk-pill--${row.currentRiskLevel}`}>
        {RISK_LABEL[row.currentRiskLevel]}
      </span>
    ),
  },
  // Stage-7 work queue (TL-037) and the Stage-6 follow-up rollup (TL-034/035)
  // share one column: neither ever drove a row's height, and merging them buys
  // the width that the patient name and the recommendation need to stop
  // wrapping. Overdue is computed per render, never stored.
  workFollowUp: {
    header: 'Work & Follow-Up',
    render: row => (
      <>
        <div className="caseload-cell-group">
          {row.episodeOpen ? (
            <>
              <div className="caseload-activity-label">
                {row.openTaskCount === 0
                  ? 'Episode open · no open tasks'
                  : `${row.openTaskCount} open task${row.openTaskCount === 1 ? '' : 's'}`}
                {row.overdueTaskCount > 0 ? ` · ${row.overdueTaskCount} overdue` : ''}
              </div>
              <div className="caseload-activity-date">
                {row.nextTaskDue ? `Next due ${row.nextTaskDue.slice(0, 10)}` : 'No due dates set'}
              </div>
            </>
          ) : (
            <div className="caseload-activity-label">No open episode</div>
          )}
        </div>
        <div className="caseload-cell-group">{followUpBody(row)}</div>
      </>
    ),
  },
  nextVisit: {
    header: 'Next Visit',
    sortCol: 'nextVisit',
    render: row => <div className="caseload-cell-group">{followUpBody(row)}</div>,
  },
  outreach: {
    header: 'Outreach',
    render: row => (
      <>
        <div className="caseload-activity-label">
          {row.unreachedStreak > 0
            ? `${row.unreachedStreak} unreached attempt${row.unreachedStreak === 1 ? '' : 's'}`
            : 'No failed attempts'}
        </div>
        <div className="caseload-activity-date">
          {row.noShowCount > 0
            ? `${row.noShowCount} no-show${row.noShowCount === 1 ? '' : 's'}`
            : 'No no-shows'}
        </div>
      </>
    ),
  },
  referrals: {
    header: 'Referrals',
    render: row => (
      <div className="caseload-activity-label">
        {row.openReferralCount > 0 ? `${row.openReferralCount} open` : 'None open'}
      </div>
    ),
  },
  activity: {
    header: 'Last Activity',
    sortCol: 'activity',
    render: row =>
      row.lastActivity ? (
        <>
          <div className="caseload-activity-label">{row.lastActivity.label}</div>
          <div className="caseload-activity-date">{formatDaysAgo(row.lastActivity.date)}</div>
        </>
      ) : (
        <div className="caseload-activity-label">No activity yet</div>
      ),
  },
  next: {
    header: 'Recommended Next Step',
    className: 'caseload-table-next-col',
    render: row => (
      <>
        <div className="caseload-next-label">{row.recommendedNextStep.label}</div>
        {/* Clamped to three lines to keep rows scannable — a worklist row is a
            triage cue, not the whole story. `title` keeps the full rationale
            reachable on hover, and the patient's chart carries it in full. */}
        <div className="caseload-next-rationale" title={row.recommendedNextStep.rationale}>
          {row.recommendedNextStep.rationale}
        </div>
      </>
    ),
  },
}
