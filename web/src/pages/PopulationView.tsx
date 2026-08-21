import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAGES, stageTitleById } from '@spier/core/data/catalog'
import { resetLocalDemoData } from '../lib/dataSource/localDataSource'
import { deriveRegistryRow, type DerivedRegistryRow } from '@spier/core/lib/registry'
import { evaluateAllMeasures, trailingPeriod } from '@spier/core/lib/measures'
import { alertsForPatient, groupAlertsByPatient } from '../lib/populationAlerts'
import {
  RISK_LABEL,
  riskCountsOf,
  summaryTiles,
  tierCensus,
  CENSUS_ORDER,
} from '../lib/populationSummary'
import { AGE_BANDS, bandOf, ageOf } from '../lib/populationFilters'
import type { RiskAlert } from '@spier/core/lib/observationMappers'
import type { PatientSlice } from '@spier/core/types/fhir'
import { useRegistrySlices } from '../hooks/useRegistrySlices'
import {
  CASELOAD_VIEWS,
  DEFAULT_DIR,
  sortRows,
  viewById,
  type FilterKey,
  type FilterOption,
  type SortCol,
  type SortState,
} from '../lib/caseloadViews'
import { CaseloadTable, HeaderFilter } from '../components/CaseloadTable'
import { COLUMNS } from '../components/caseloadColumns'
import { PageHeader } from '../components/PageHeader'
import { PopulationAlertsPanel } from '../components/PopulationAlertsPanel'
import { PopulationSummary } from '../components/PopulationSummary'
import '../css/PopulationView.css'

type RiskLevel = RiskAlert['level']

const ALERT_PERIOD_DAYS = 3650

/** Rows and slices together: the alerts need the slice, the table needs the row. */
interface RegistryEntry {
  row: DerivedRegistryRow
  slice: PatientSlice
}

const RISK_LEVELS: RiskLevel[] = CENSUS_ORDER

/* ===========================
   Page
   =========================== */

export function PopulationView() {
  const navigate = useNavigate()
  const [viewId, setViewId] = useState(CASELOAD_VIEWS[0].id)
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [ageFilter, setAgeFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortState>(CASELOAD_VIEWS[0].defaultSort)
  const wrapperRef = useRef<HTMLElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [tableOverflows, setTableOverflows] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  // Rows come from the ACTIVE FhirDataSource, not a hardcoded local one — this
  // page used to import `localDataSource` directly, so a live SMART session left
  // it rendering bundled demo data that looked like a server read (#390).
  const { entries: sliceEntries, scope, isLoading } = useRegistrySlices()
  const entries = useMemo<RegistryEntry[]>(
    () => sliceEntries.map(e => ({ row: deriveRegistryRow(e.patient, e.slice), slice: e.slice })),
    [sliceEntries],
  )

  // Column-header controls are only reachable once the table stops fitting if the
  // reader thinks to scroll sideways first, so below that point the same menus
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
  }, [viewId])

  const rows = useMemo(() => entries.map(e => e.row), [entries])
  const view = viewById(viewId)

  const filteredSorted = useMemo(() => {
    let list = rows
    if (stageFilter !== 'all') list = list.filter(p => p.currentStage === stageFilter)
    if (riskFilter !== 'all') list = list.filter(p => p.currentRiskLevel === riskFilter)
    if (ageFilter !== 'all') list = list.filter(p => bandOf(ageOf(p.dob))?.value === ageFilter)
    return sortRows(list, sort)
  }, [rows, stageFilter, riskFilter, ageFilter, sort])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of rows) {
      if (p.currentStage) counts[p.currentStage] = (counts[p.currentStage] ?? 0) + 1
    }
    return counts
  }, [rows])

  // One source for every risk count on the page: the census bar, the high-risk
  // tile and the Risk column's filter menu all read this.
  const riskCounts = useMemo(() => riskCountsOf(rows), [rows])

  const ageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of rows) {
      const band = bandOf(ageOf(p.dob))
      if (band) counts[band.value] = (counts[band.value] ?? 0) + 1
    }
    return counts
  }, [rows])

  const alertGroups = useMemo(() => {
    const period = trailingPeriod(ALERT_PERIOD_DAYS)
    return groupAlertsByPatient(
      entries.flatMap(e => alertsForPatient(e.row, evaluateAllMeasures(e.slice, period))),
    )
  }, [entries])

  const tiles = useMemo(
    () =>
      summaryTiles({
        rows,
        slices: entries.map(e => e.slice),
        counts: riskCounts,
        alertCount: alertGroups.reduce((n, g) => n + g.alerts.length, 0),
        now: new Date(),
      }),
    [rows, entries, riskCounts, alertGroups],
  )

  const census = useMemo(() => tierCensus(riskCounts, rows.length), [riskCounts, rows.length])

  const filters: Record<FilterKey, { srLabel: string; options: FilterOption[] }> = useMemo(
    () => ({
      stage: {
        srLabel: 'current stage',
        options: [
          { value: 'all', label: 'All stages', count: rows.length },
          ...STAGES.filter(s => (stageCounts[s.id] ?? 0) > 0).map(s => ({
            value: s.id,
            label: s.title,
            count: stageCounts[s.id] ?? 0,
          })),
        ],
      },
      risk: {
        srLabel: 'risk level',
        options: [
          { value: 'all', label: 'All levels', count: rows.length },
          ...RISK_LEVELS.filter(l => (riskCounts[l] ?? 0) > 0).map(l => ({
            value: l,
            label: RISK_LABEL[l],
            count: riskCounts[l] ?? 0,
            riskLevel: l,
          })),
        ],
      },
      age: {
        srLabel: 'age band',
        options: [
          { value: 'all', label: 'All ages', count: rows.length },
          ...AGE_BANDS.filter(b => (ageCounts[b.value] ?? 0) > 0).map(b => ({
            value: b.value,
            label: b.label,
            count: ageCounts[b.value] ?? 0,
          })),
        ],
      },
    }),
    [rows.length, stageCounts, riskCounts, ageCounts],
  )

  const filterValues: Record<FilterKey, string> = {
    stage: stageFilter,
    risk: riskFilter,
    age: ageFilter,
  }

  const setFilter = (key: FilterKey, value: string) => {
    if (key === 'stage') setStageFilter(value)
    else if (key === 'risk') setRiskFilter(value)
    else setAgeFilter(value)
  }

  // The filters live inside column headers, where an active one is a small
  // marker that is easy to miss. This line is the plain-language readout of what
  // is being hidden, and the only way back to the full caseload.
  const activeFilters = [
    stageFilter !== 'all' ? `Stage: ${stageTitleById(stageFilter)}` : null,
    riskFilter !== 'all' ? `Risk: ${RISK_LABEL[riskFilter as RiskLevel]}` : null,
    ageFilter !== 'all'
      ? `Age: ${AGE_BANDS.find(b => b.value === ageFilter)?.label ?? ageFilter}`
      : null,
  ].filter((f): f is string => f !== null)

  const clearFilters = () => {
    setStageFilter('all')
    setRiskFilter('all')
    setAgeFilter('all')
  }

  /**
   * Clear the stored slices, then reload. The reload is the point: every context,
   * memo and derived registry row in the app is built from slice data, so
   * re-rendering in place would leave some of it stale. See
   * `resetLocalDemoData()`.
   */
  const handleResetDemo = () => {
    resetLocalDemoData()
    window.location.reload()
  }

  const toggleSort = (col: SortCol) => {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: DEFAULT_DIR[col] },
    )
  }

  // Switching view resets the sort to that view's default, because the previous
  // sort column may not exist in the new column set — and a table sorted by an
  // invisible column is a table nobody can tell is sorted.
  const switchView = (id: string) => {
    setViewId(id)
    setSort(viewById(id).defaultSort)
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

  // Which filters the current view actually offers, read from the column
  // registry rather than hardcoded — so a view that drops the Stage column stops
  // offering a Stage filter here too, instead of hiding rows by a control the
  // reader can no longer see.
  const compactFilterKeys = useMemo(
    () => [
      ...new Set(
        view.columns
          .map(key => COLUMNS[key]?.filter)
          .filter((k): k is FilterKey => k !== undefined),
      ),
    ],
    [view.columns],
  )

  const FILTER_LABEL: Record<FilterKey, string> = { stage: 'Stage', risk: 'Risk', age: 'Age' }

  return (
    <div className="population-view">
      {/* Eyebrow names the project, not the lens: this lens is a single page, so
          its parent is SPiER itself — same as the front door. See PageHeader. */}
      <PageHeader
        eyebrow="SPiER"
        title="Population View"
        lede="Caseload of patients on the suicide-safer care pathway. Recommendations show the next best step regardless of which tools your implementation has enabled — what matters here is the patient's status and risk, not the specific instrument."
      />

      {/* ⚠️ Under SMART the seam is bound to ONE patient, so the caseload is that
          patient and nothing else. Saying so is the point: this page previously
          rendered the bundled 14-patient registry during a live SMART session,
          which reads as a server-side worklist. A genuine one needs a
          user-scoped launch and a cohort read — blocker 2 in
          embedded-panel-smart-launch.md §6.3, deliberately not invented here. */}
      {scope === 'in-context' && (
        <p className="population-scope-notice">
          <strong>Showing the patient in context only.</strong> A SMART access token is
          bound to one patient, so this connection cannot serve a caseload. A
          registry read needs a user-scoped launch and a cohort query, which this
          server does not offer yet — so nothing here is a cross-patient claim.
        </p>
      )}

      {isLoading && entries.length === 0 && (
        <p className="population-scope-notice">Reading the caseload from the connected server…</p>
      )}

      {/* Side by side on wide screens. Stacked, these two zones cost ~640px of
          vertical space before the caseload table starts — which buries the
          worklist the page exists for. Two columns make the cost the taller of
          the pair instead of their sum. */}
      <div className="population-zones">
        <PopulationSummary tiles={tiles} census={census} total={rows.length} />
        <PopulationAlertsPanel groups={alertGroups} />
      </div>

      <div className="population-table-head">
        {/* Toggle buttons, not role="tab": there is no tabpanel here — the same
            table re-renders with different columns — and claiming the tab pattern
            without one leaves a screen reader looking for a panel that does not
            exist. `aria-pressed` says what is actually true. No `title` either:
            it would override each button's accessible name with the description,
            which is already on the page for the selected view. */}
        <div className="population-views" role="group" aria-label="Caseload view">
          {CASELOAD_VIEWS.map(v => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === viewId}
              className={`population-view-tab ${v.id === viewId ? 'population-view-tab--active' : ''}`}
              onClick={() => switchView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
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
      </div>

      <p className="population-view-description">{view.description}</p>

      {tableOverflows && (
        <div className="population-compact-filters">
          {compactFilterKeys.map(key => (
            <HeaderFilter
              key={key}
              label={FILTER_LABEL[key]}
              srLabel={filters[key].srLabel}
              options={filters[key].options}
              value={filterValues[key]}
              onChange={v => setFilter(key, v)}
            />
          ))}
        </div>
      )}

      <CaseloadTable
        view={view}
        rows={filteredSorted}
        sort={sort}
        onSort={toggleSort}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={setFilter}
        onOpenChart={handleOpenChart}
        wrapperRef={wrapperRef}
        tableRef={tableRef}
      />

      <p className="population-footnote">
        Mock registry data &mdash; {rows.length} patients sampled across the pathway stages and
        risk levels. Click any row to view that patient's chart. Opening a patient here also
        broadcasts a <strong>FHIRcast</strong> patient-open event: a chart open in another tab
        follows along, the way context-synced apps do in production.
      </p>

      {/*
        The deliberate way back to the curated scenarios (#301). Refreshed
        fixtures reach an untouched patient on their own, but a patient you have
        written to is yours and is never overwritten — and a slice seeded before
        that mechanism existed cannot be told apart from one you edited. This is
        the escape hatch for both, and it lives here because this is where the
        page already says the data is a demo.

        Two-click rather than a `window.confirm`: it discards anything entered in
        the demo, the app uses no browser dialogs anywhere else, and the second
        label states the consequence instead of asking "are you sure?".
      */}
      {/* ⚠️ Local-demo affordance only, so it is gated on the scope. This is the
          one remaining `localDataSource` import on this page, and it is an ACTION
          on demo storage rather than a data read — the read is what coupled this
          lens to a concrete source (#390). Offering "reset the demo data" while
          the rows came from a connected server would claim to do something it
          cannot. */}
      <p className="population-footnote">
        {scope !== 'registry' ? (
          <span className="population-reset-unavailable">
            Resetting demo data applies to the local scenarios only — not to a connected
            server.
          </span>
        ) : confirmingReset ? (
          <>
            <button type="button" className="population-reset-demo" onClick={handleResetDemo}>
              Confirm reset &mdash; discards anything you entered
            </button>{' '}
            <button
              type="button"
              className="population-clear-filters"
              onClick={() => setConfirmingReset(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="population-clear-filters"
            onClick={() => setConfirmingReset(true)}
          >
            Reset demo data to the shipped scenarios
          </button>
        )}
      </p>
    </div>
  )
}
