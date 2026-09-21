import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAGES, stageTitleById } from '@spier/core/data/catalog'
import { type DerivedRegistryRow, type RegistryRiskLevel } from '@spier/core/lib/registry'
import { RISK_LABEL, CENSUS_ORDER } from '../lib/populationSummary'
import { AGE_BANDS, bandOf, ageOf } from '../lib/populationFilters'
import { useCaseloadSummary } from '../hooks/useCaseloadSummary'
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
import { PageHeader } from '@spier/ui/PageHeader'
import { CaseloadAlertsLine } from '../components/CaseloadAlertsLine'
import { CohortScopeNotice } from '../components/CohortScopeNotice'
import { PopulationSummary } from '../components/PopulationSummary'
import '../css/PopulationView.css'
import { cx } from '@spier/ui/cx'
import { Notice } from '@spier/ui/Notice'

type RiskLevel = RegistryRiskLevel

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

  // Caseload-wide derivation — rows, risk counts, tiles, census, alerts —
  // shared verbatim with the embeddable summary widget on /population/summary.
  // Filtering and sorting stay here, because they describe the table below.
  const { entries, rows, riskCounts, alertGroups, tiles, census, scope, isLoading } =
    useCaseloadSummary()

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

  const ageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of rows) {
      const band = bandOf(ageOf(p.dob))
      if (band) counts[band.value] = (counts[band.value] ?? 0) + 1
    }
    return counts
  }, [rows])

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
    navigate(`/patient/record/${row.id}`)
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

  // ⚠️ A session that cannot serve a cohort renders NO cohort screen — see
  // `CohortScopeNotice`. Rendering the tiles, the alerts and the table over
  // zero patients is what produced a page of zeros captioned "that is a real
  // result" on a chart launch (audit §8.7).
  if (scope !== 'registry') {
    return (
      <div className="population-view">
        <PageHeader eyebrow="SPiER" title="Caseload" lede="Who on your panel is owed an action." />
        <CohortScopeNotice scope={scope} />
      </div>
    )
  }

  return (
    <div className="population-view">
      {/* ⚠️ Titled "Caseload", not "Population View" — the retired lens name.
          The dashboard PRODUCT is explained at /guide/dashboard; this page and
          /population/measures are its two screens, and naming this one after the
          product would leave the reader wondering which of the two they were on.
          Eyebrow names the project rather than a lens: this is a single page, so
          its parent is SPiER itself — same as the front door. See PageHeader.
          ⚠️ The lede STOPS EXPLAINING (audit §4.8). It used to spend 37 words on
          what a recommendation is and on tool enablement — a fact about the
          deployment, addressed to whoever configured it, above a worklist. */}
      <PageHeader eyebrow="SPiER" title="Caseload" lede="Who on your panel is owed an action." />

      {isLoading && entries.length === 0 && (
        <Notice tone="info">Reading the caseload from the connected server…</Notice>
      )}

      {/* One line, and it is above the table because an urgent alert is the one
          thing that outranks the worklist order. The panel it replaces cost
          ~350px here; the page it opens costs nothing until someone wants it. */}
      <CaseloadAlertsLine groups={alertGroups} />

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
              className={cx('population-view-tab', v.id === viewId && 'population-view-tab--active')}
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

      {/* BELOW the table (audit §4.8). Two zones stacked above it put the first
          patient row at 1,104px on a laptop; the summary is a management
          artifact and the table is the triage one, and only one of them can be
          first. */}
      <PopulationSummary tiles={tiles} census={census} total={rows.length} />

      <p className="population-footnote">
        {/* ⚠️ This said "Mock registry data — 14 patients sampled across the
            pathway stages and risk levels", and then explained FHIRcast: "a
            chart open in another tab follows along, the way context-synced
            apps do in production" (audit §1.9, §8.5). Both are the demo
            presenter's copy, and the presenter's copy is the mock EHR's own
            pages — the same call PR 5 made about the scenario walkthrough. */}
        Opening a patient here opens their chart, and any chart already open beside it
        follows.
      </p>

      {/* ⚠️ **"Reset demo data to the shipped scenarios" was HERE and is gone,
          because it could not do anything from this page any more** (audit
          §8.6). It called `resetLocalDemoData()`, which clears the browser's
          copy of the bundled scenarios — and it was gated on
          `scope !== 'registry'`, written when `registry` meant "the local
          store". Since #401 a worklist launch reports `registry` too, so the
          button rendered during a live session against a server it cannot
          touch, reloaded the page, and changed nothing a reader could see. The
          clinical build compiles the demo population away, so there is no
          session left in which it would have had anything to reset. The
          control that actually resets this demo is **Reset written data** on
          the demo EHR's own Settings page, beside the nightly job that does
          the same thing (PR 2); `resetLocalDemoData` itself stays in
          `packages/app-shell` with its tests. */}
    </div>
  )
}
