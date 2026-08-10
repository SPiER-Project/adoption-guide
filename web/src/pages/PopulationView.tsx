import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { STAGES, stageTitleById } from '../data/catalog'
import registryPatientsData from '../data/population/patients.json'
import { localDataSource } from '../lib/dataSource/localDataSource'
import { deriveRegistryRow, type RegistryPatient, type DerivedRegistryRow } from '../lib/registry'
import { formatDaysAgo } from '../lib/relativeTime'
import { RISK_LEVEL_ORDER } from '../lib/observationMappers'
import type { RiskAlert } from '../lib/observationMappers'
import type { PatientSlice } from '../types/fhir'
import '../css/PopulationView.css'

type RiskLevel = RiskAlert['level']

const REGISTRY_PATIENTS = registryPatientsData as RegistryPatient[]

const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
  episodes: [],
  flags: [],
  tasks: [],
}

// Rows are computed from the same FhirDataSource slices PatientChart reads —
// this is a query over live FHIR data, not a hand-curated snapshot. Submitting
// an assessment on a patient's chart updates their registry row here too.
function deriveAllRows(): DerivedRegistryRow[] {
  return REGISTRY_PATIENTS.map(p =>
    deriveRegistryRow(p, localDataSource.getSliceSync?.(p.id) ?? EMPTY_SLICE),
  )
}

const RISK_LABEL: Record<RiskLevel, string> = {
  acute: 'Acute',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  none: 'None',
}

const RISK_LEVELS: RiskLevel[] = ['acute', 'high', 'moderate', 'low', 'none']

/* ===========================
   Sorting
   =========================== */

type SortCol = 'patient' | 'risk' | 'activity'
type SortDir = 'asc' | 'desc'
type SortState = { col: SortCol; dir: SortDir }

// Each column's default direction is the end a triage nurse actually wants
// first, so one click on a header never lands on the useless ordering: highest
// risk, most recent activity, names A→Z.
const DEFAULT_DIR: Record<SortCol, SortDir> = {
  patient: 'asc',
  risk: 'desc',
  activity: 'desc',
}

function activityTime(row: DerivedRegistryRow): number | null {
  return row.lastActivity ? new Date(row.lastActivity.date).getTime() : null
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
  }
}

function sortRows(list: DerivedRegistryRow[], sort: SortState): DerivedRegistryRow[] {
  const flip = sort.dir === DEFAULT_DIR[sort.col] ? 1 : -1
  return [...list].sort((a, b) => {
    if (sort.col === 'activity') {
      // "No activity yet" is not "least recent activity" — undated rows sort to
      // the end in both directions, so flipping never promotes them to the top.
      const ta = activityTime(a)
      const tb = activityTime(b)
      if (ta === null || tb === null) return ta === tb ? 0 : ta === null ? 1 : -1
    }
    return flip * compareInDefaultDir(sort.col, a, b)
  })
}

/* ===========================
   Header controls
   =========================== */

const MENU_EDGE_GAP = 8

function SortIcon({ dir }: { dir: SortDir | null }) {
  return (
    <svg
      className={`caseload-sort-icon ${dir ? `caseload-sort-icon--${dir}` : ''}`}
      viewBox="0 0 8 12"
      aria-hidden="true"
      focusable="false"
    >
      <path className="caseload-sort-icon-up" d="M4 0.5 7 4.5H1z" />
      <path className="caseload-sort-icon-down" d="M4 11.5 1 7.5h6z" />
    </svg>
  )
}

function FunnelIcon() {
  return (
    <svg className="caseload-funnel-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M0.5 1.5h11L7 6.8V11L5 9.6V6.8z" />
    </svg>
  )
}

function SortHeader({
  label,
  col,
  sort,
  onSort,
}: {
  label: string
  col: SortCol
  sort: SortState
  onSort: (col: SortCol) => void
}) {
  const active = sort.col === col
  return (
    <button
      type="button"
      className={`caseload-sort-button ${active ? 'caseload-sort-button--active' : ''}`}
      onClick={() => onSort(col)}
    >
      <span>{label}</span>
      <SortIcon dir={active ? sort.dir : null} />
    </button>
  )
}

type FilterOption = { value: string; label: string; count: number; riskLevel?: RiskLevel }

/**
 * Column-header filter: the header label doubles as the trigger for a
 * single-select menu of the values present in the column, each with its row
 * count. Replaces the separate chip toolbar that used to sit above the table.
 */
function HeaderFilter({
  label,
  srLabel,
  options,
  value,
  onChange,
}: {
  label: string
  srLabel: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = pos !== null

  const openMenu = () => {
    if (open) {
      setPos(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
  }

  // The menu is `position: fixed`, not absolute inside the <th>: the table lives
  // in a wrapper with `overflow-x: auto`, and per spec a non-visible overflow on
  // one axis computes the other to `auto` too — so an absolutely positioned
  // panel would be clipped by the scroll container instead of overlaying rows.
  // The cost of escaping that container is having to keep the panel glued to its
  // trigger by hand, which is what this does. Measuring every frame rather than
  // listening for scroll is deliberate: the trigger moves with page scroll, with
  // the wrapper's own horizontal scroll, and with any relayout, and a `scroll`
  // listener only covers the first two. The loop exists only while a menu is
  // open, and re-renders only when the rounded position actually changes.
  useEffect(() => {
    if (!open) return
    let frame = requestAnimationFrame(function track() {
      frame = requestAnimationFrame(track)
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      const t = trigger.getBoundingClientRect()
      // Horizontally scrolled out of the table's viewport: nothing left to anchor
      // to, so dismiss rather than leave the panel stranded over other columns.
      const scroller = trigger.closest('.caseload-table-wrapper')?.getBoundingClientRect()
      if (scroller && (t.right < scroller.left || t.left > scroller.right)) {
        setPos(null)
        return
      }
      const top = t.bottom + 4
      const left = Math.min(t.left, window.innerWidth - menu.offsetWidth - MENU_EDGE_GAP)
      setPos(p =>
        p && Math.round(p.top) === Math.round(top) && Math.round(p.left) === Math.round(left)
          ? p
          : { top, left },
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const menuItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []),
  ]

  useEffect(() => {
    if (!open) return
    const items = menuItems()
    ;(items.find(i => i.getAttribute('aria-checked') === 'true') ?? items[0])?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setPos(null)
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = menuItems()
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`caseload-filter-trigger ${value !== 'all' ? 'caseload-filter-trigger--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={value === 'all' ? `Filter by ${srLabel}` : `Filter by ${srLabel} (1 active)`}
        onClick={openMenu}
      >
        <span>{label}</span>
        <FunnelIcon />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="caseload-filter-menu"
          role="menu"
          aria-label={`Filter by ${srLabel}`}
          style={{ top: pos.top, left: pos.left }}
          onKeyDown={onMenuKeyDown}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={opt.value === value}
              className="caseload-filter-option"
              onClick={() => {
                onChange(opt.value)
                setPos(null)
                triggerRef.current?.focus()
              }}
            >
              <span className="caseload-filter-option-check" aria-hidden="true">
                {opt.value === value ? '✓' : ''}
              </span>
              {opt.riskLevel ? (
                <span className={`risk-pill risk-pill--sm risk-pill--${opt.riskLevel}`}>
                  {opt.label}
                </span>
              ) : (
                <span className="caseload-filter-option-label">{opt.label}</span>
              )}
              <span className="caseload-filter-option-count">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/* ===========================
   Page
   =========================== */

export function PopulationView() {
  const navigate = useNavigate()
  const [stageFilter, setStageFilter] = useState<string | 'all'>('all')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [sort, setSort] = useState<SortState>({ col: 'risk', dir: 'desc' })
  const [rows, setRows] = useState<DerivedRegistryRow[]>(deriveAllRows)
  const wrapperRef = useRef<HTMLElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [tableOverflows, setTableOverflows] = useState(false)

  useEffect(() => {
    const refresh = () => setRows(deriveAllRows())
    refresh()
    return localDataSource.subscribe(refresh)
  }, [])

  // Column-header controls are only reachable once the table stops fitting if the
  // reader thinks to scroll sideways first, so below that point the same two menus
  // are also offered above the table. The condition is measured rather than
  // guessed at a breakpoint: available width depends on whether the shell's
  // sidebar is collapsed, and the table's own width changes as filters narrow it.
  useEffect(() => {
    const wrapper = wrapperRef.current
    const table = tableRef.current
    if (!wrapper || !table) return
    const check = () => setTableOverflows(wrapper.scrollWidth > wrapper.clientWidth + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(wrapper)
    observer.observe(table)
    return () => observer.disconnect()
  }, [])

  const filteredSorted = useMemo(() => {
    let list = rows
    if (stageFilter !== 'all') list = list.filter(p => p.currentStage === stageFilter)
    if (riskFilter !== 'all') list = list.filter(p => p.currentRiskLevel === riskFilter)
    return sortRows(list, sort)
  }, [rows, stageFilter, riskFilter, sort])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of rows) {
      if (p.currentStage) counts[p.currentStage] = (counts[p.currentStage] ?? 0) + 1
    }
    return counts
  }, [rows])

  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of rows) counts[p.currentRiskLevel] = (counts[p.currentRiskLevel] ?? 0) + 1
    return counts
  }, [rows])

  const stageOptions: FilterOption[] = useMemo(
    () => [
      { value: 'all', label: 'All stages', count: rows.length },
      ...STAGES.filter(s => (stageCounts[s.id] ?? 0) > 0).map(s => ({
        value: s.id,
        label: s.title,
        count: stageCounts[s.id] ?? 0,
      })),
    ],
    [rows.length, stageCounts],
  )

  const riskOptions: FilterOption[] = useMemo(
    () => [
      { value: 'all', label: 'All levels', count: rows.length },
      ...RISK_LEVELS.filter(l => (riskCounts[l] ?? 0) > 0).map(l => ({
        value: l,
        label: RISK_LABEL[l],
        count: riskCounts[l] ?? 0,
        riskLevel: l,
      })),
    ],
    [rows.length, riskCounts],
  )

  // The filters now live inside column headers, where an active one is a small
  // marker that is easy to miss. This line is the plain-language readout of
  // what is being hidden, and the only way back to the full caseload.
  const activeFilters = [
    stageFilter !== 'all' ? `Stage: ${stageTitleById(stageFilter)}` : null,
    riskFilter !== 'all' ? `Risk: ${RISK_LABEL[riskFilter]}` : null,
  ].filter((f): f is string => f !== null)

  const clearFilters = () => {
    setStageFilter('all')
    setRiskFilter('all')
  }

  const toggleSort = (col: SortCol) => {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: DEFAULT_DIR[col] },
    )
  }

  const ariaSort = (col: SortCol): 'ascending' | 'descending' | undefined => {
    if (sort.col !== col) return undefined
    return sort.dir === 'asc' ? 'ascending' : 'descending'
  }

  const handleOpenChart = (row: DerivedRegistryRow) => {
    // Just navigate. The FHIRcast patient-open broadcast is centralized in
    // PatientContext's publish-on-activation effect, which fires once this
    // navigation makes the patient active — so a chart open in another tab
    // follows. (The population worklist and the chart behave as two
    // context-synced FHIRcast apps; the receiving tab decides whether to honor
    // it — see FhircastListener.)
    navigate(`/patient/chart/${row.id}`)
  }

  return (
    <div className="population-view">
      <header className="population-header">
        <h2 className="population-title">Population View</h2>
        <p className="population-intro">
          Caseload of patients on the suicide-safer care pathway. Recommendations show the next
          best step regardless of which tools your implementation has enabled — at the population
          level, what matters is the patient's status and risk, not the specific instrument.
        </p>
        <p className="population-meta">
          {filteredSorted.length} of {rows.length} patients shown
          {activeFilters.length > 0 && (
            <>
              {' — '}
              <span className="population-meta-filters">{activeFilters.join(' · ')}</span>{' '}
              <button type="button" className="population-clear-filters" onClick={clearFilters}>
                Clear
              </button>
            </>
          )}
        </p>
      </header>

      {tableOverflows && (
        <div className="population-compact-filters">
          <HeaderFilter
            label="Stage"
            srLabel="current stage"
            options={stageOptions}
            value={stageFilter}
            onChange={setStageFilter}
          />
          <HeaderFilter
            label="Risk"
            srLabel="risk level"
            options={riskOptions}
            value={riskFilter}
            onChange={v => setRiskFilter(v as RiskLevel | 'all')}
          />
        </div>
      )}

      <section className="caseload-table-wrapper" ref={wrapperRef}>
        <table className="caseload-table" ref={tableRef}>
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort('patient')}>
                <SortHeader label="Patient" col="patient" sort={sort} onSort={toggleSort} />
              </th>
              <th scope="col">
                <HeaderFilter
                  label="Current Stage"
                  srLabel="current stage"
                  options={stageOptions}
                  value={stageFilter}
                  onChange={setStageFilter}
                />
              </th>
              <th scope="col" className="caseload-table-risk-col" aria-sort={ariaSort('risk')}>
                <span className="caseload-th-controls">
                  <SortHeader label="Risk" col="risk" sort={sort} onSort={toggleSort} />
                  <HeaderFilter
                    label=""
                    srLabel="risk level"
                    options={riskOptions}
                    value={riskFilter}
                    onChange={v => setRiskFilter(v as RiskLevel | 'all')}
                  />
                </span>
              </th>
              <th scope="col">Work &amp; Follow-Up</th>
              <th scope="col" aria-sort={ariaSort('activity')}>
                <SortHeader label="Last Activity" col="activity" sort={sort} onSort={toggleSort} />
              </th>
              <th scope="col" className="caseload-table-next-col">Recommended Next Step</th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map(p => (
              <tr key={p.id} className="caseload-row" onClick={() => handleOpenChart(p)}>
                <td>
                  {/* Real link: keyboard-focusable and activatable, and announced
                      to screen readers. The whole-row onClick above is a
                      mouse-only convenience; stopPropagation avoids a double
                      navigate when the link itself is clicked. The FHIRcast
                      broadcast happens on activation in PatientContext, so both
                      paths publish without an explicit call here. */}
                  <Link
                    to={`/patient/chart/${p.id}`}
                    className="caseload-patient-link"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="caseload-patient-name">{p.displayName}</span>
                  </Link>
                  <div className="caseload-patient-meta">MRN {p.mrn} &middot; DOB {p.dob}</div>
                </td>
                <td>
                  <span className="caseload-stage">
                    {p.currentStage ? stageTitleById(p.currentStage) : 'Pathway complete'}
                  </span>
                </td>
                <td className="caseload-table-risk-col">
                  <span className={`risk-pill risk-pill--${p.currentRiskLevel}`}>
                    {RISK_LABEL[p.currentRiskLevel]}
                  </span>
                </td>
                {/* Stage-7 work queue (TL-037) and the Stage-6 follow-up rollup
                    (TL-034/TL-035) share one column: neither ever drove a row's
                    height, and merging them buys the width that the patient name
                    and the recommendation need to stop wrapping. Work state is
                    the first group, follow-up the second. Overdue is computed
                    per render, never stored; the follow-up side is derived from
                    the Stage-5 Appointments and outreach Communications, so
                    TL-034 needs no resource of its own. */}
                <td>
                  <div className="caseload-cell-group">
                    {p.episodeOpen ? (
                      <>
                        <div className="caseload-activity-label">
                          {p.openTaskCount === 0
                            ? 'Episode open · no open tasks'
                            : `${p.openTaskCount} open task${p.openTaskCount === 1 ? '' : 's'}`}
                          {p.overdueTaskCount > 0 ? ` · ${p.overdueTaskCount} overdue` : ''}
                        </div>
                        <div className="caseload-activity-date">
                          {p.nextTaskDue ? `Next due ${p.nextTaskDue.slice(0, 10)}` : 'No due dates set'}
                        </div>
                      </>
                    ) : (
                      <div className="caseload-activity-label">No open episode</div>
                    )}
                  </div>
                  <div className="caseload-cell-group">
                    {p.nextAppointment ? (
                      <>
                        <div className="caseload-activity-label">
                          Next visit {p.nextAppointment.date.slice(0, 10)}
                        </div>
                        <div className="caseload-activity-date">
                          {p.nextAppointment.provider ?? 'Provider not recorded'}
                        </div>
                      </>
                    ) : (
                      <div className="caseload-activity-label">
                        {p.awaitingNoShowFollowUp ? 'No-show — outreach due' : 'No visit booked'}
                      </div>
                    )}
                    {(p.noShowCount > 0 || p.unreachedStreak > 0 || p.openReferralCount > 0) && (
                      <div className="caseload-activity-date">
                        {[
                          p.noShowCount > 0 ? `${p.noShowCount} no-show` : null,
                          p.unreachedStreak > 0 ? `${p.unreachedStreak} unreached` : null,
                          p.openReferralCount > 0
                            ? `${p.openReferralCount} referral${p.openReferralCount === 1 ? '' : 's'} open`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  {p.lastActivity ? (
                    <>
                      <div className="caseload-activity-label">{p.lastActivity.label}</div>
                      <div className="caseload-activity-date">
                        {formatDaysAgo(p.lastActivity.date)}
                      </div>
                    </>
                  ) : (
                    <div className="caseload-activity-label">No activity yet</div>
                  )}
                </td>
                <td className="caseload-table-next-col">
                  <div className="caseload-next-label">{p.recommendedNextStep.label}</div>
                  {/* Clamped to three lines to keep rows scannable — a worklist
                      row is a triage cue, not the whole story. `title` keeps the
                      full rationale reachable on hover, and the patient's chart
                      carries it in full. */}
                  <div className="caseload-next-rationale" title={p.recommendedNextStep.rationale}>
                    {p.recommendedNextStep.rationale}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSorted.length === 0 && (
          <p className="caseload-empty">No patients match the active filters.</p>
        )}
      </section>

      <p className="population-footnote">
        Mock registry data &mdash; {rows.length} patients sampled across the pathway stages and
        risk levels. Click any row to view that patient's chart. Opening a patient here also
        broadcasts a <strong>FHIRcast</strong> patient-open event: a chart open in another tab
        follows along, the way context-synced apps do in production.
      </p>
    </div>
  )
}
