import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { STAGES, stageTitleById } from '../data/catalog'
import registryPatientsData from '../data/population/patients.json'
import { localDataSource } from '../lib/dataSource/localDataSource'
import { deriveRegistryRow, type RegistryPatient, type DerivedRegistryRow } from '../lib/registry'
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

type SortKey = 'risk' | 'oldest' | 'recent' | 'name'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'risk', label: 'Risk (highest first)' },
  { value: 'oldest', label: 'Last activity (oldest first)' },
  { value: 'recent', label: 'Last activity (most recent)' },
  { value: 'name', label: 'Name (A→Z)' },
]

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - then) / 86_400_000))
}

function formatDaysAgo(isoDate: string): string {
  const d = daysSince(isoDate)
  if (d === 0) return 'Today'
  if (d === 1) return '1 day ago'
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`
  return `${Math.floor(d / 30)} months ago`
}

// Undated rows sort to the end regardless of sort direction.
function activityTime(row: DerivedRegistryRow): number {
  return row.lastActivity ? new Date(row.lastActivity.date).getTime() : Number.NEGATIVE_INFINITY
}

export function PopulationView() {
  const navigate = useNavigate()
  const [stageFilter, setStageFilter] = useState<string | 'all'>('all')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('risk')
  const [rows, setRows] = useState<DerivedRegistryRow[]>(deriveAllRows)

  useEffect(() => {
    const refresh = () => setRows(deriveAllRows())
    refresh()
    return localDataSource.subscribe(refresh)
  }, [])

  const filteredSorted = useMemo(() => {
    let list = rows
    if (stageFilter !== 'all') list = list.filter(p => p.currentStage === stageFilter)
    if (riskFilter !== 'all') list = list.filter(p => p.currentRiskLevel === riskFilter)

    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'risk':
          return RISK_LEVEL_ORDER[a.currentRiskLevel] - RISK_LEVEL_ORDER[b.currentRiskLevel]
        case 'oldest':
          return activityTime(a) - activityTime(b)
        case 'recent':
          return activityTime(b) - activityTime(a)
        case 'name':
          return a.displayName.localeCompare(b.displayName)
      }
    })
    return sorted
  }, [rows, stageFilter, riskFilter, sortKey])

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

  const handleOpenChart = (patientId: string) => {
    // v1: cross-app patient switching is mocked. In production this would be FHIRcast.
    navigate(`/patient/chart/${patientId}`)
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
        </p>
      </header>

      <section className="population-filters">
        <div className="filter-group">
          <span className="filter-group-label">Stage</span>
          <button
            type="button"
            className={`filter-chip ${stageFilter === 'all' ? 'filter-chip--active' : ''}`}
            onClick={() => setStageFilter('all')}
          >
            All ({rows.length})
          </button>
          {STAGES.map(stage => {
            const count = stageCounts[stage.id] ?? 0
            if (count === 0) return null
            return (
              <button
                key={stage.id}
                type="button"
                className={`filter-chip ${stageFilter === stage.id ? 'filter-chip--active' : ''}`}
                onClick={() => setStageFilter(stage.id)}
              >
                {stage.title} ({count})
              </button>
            )
          })}
        </div>

        <div className="filter-group">
          <span className="filter-group-label">Risk</span>
          <button
            type="button"
            className={`filter-chip ${riskFilter === 'all' ? 'filter-chip--active' : ''}`}
            onClick={() => setRiskFilter('all')}
          >
            All
          </button>
          {(['acute', 'high', 'moderate', 'low', 'none'] as RiskLevel[]).map(level => {
            const count = riskCounts[level] ?? 0
            if (count === 0) return null
            return (
              <button
                key={level}
                type="button"
                className={`filter-chip filter-chip--risk filter-chip--risk-${level} ${riskFilter === level ? 'filter-chip--active' : ''}`}
                onClick={() => setRiskFilter(level)}
              >
                {RISK_LABEL[level]} ({count})
              </button>
            )
          })}
        </div>

        <div className="filter-group filter-group--sort">
          <label className="filter-group-label" htmlFor="population-sort">Sort by</label>
          <select
            id="population-sort"
            className="filter-sort-select"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="caseload-table-wrapper">
        <table className="caseload-table">
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Current Stage</th>
              <th scope="col">Risk</th>
              <th scope="col">Last Activity</th>
              <th scope="col">Recommended Next Step</th>
              <th scope="col" className="caseload-table-action-col"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map(p => (
              <tr key={p.id} className="caseload-row" onClick={() => handleOpenChart(p.id)}>
                <td>
                  {/* Real link: keyboard-focusable and activatable, and announced
                      to screen readers. The whole-row onClick above is a
                      mouse-only convenience; stopPropagation avoids a double
                      navigate when the link itself is clicked. */}
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
                <td>
                  <span className={`risk-pill risk-pill--${p.currentRiskLevel}`}>
                    {RISK_LABEL[p.currentRiskLevel]}
                  </span>
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
                <td>
                  <div className="caseload-next-label">{p.recommendedNextStep.label}</div>
                  <div className="caseload-next-rationale">{p.recommendedNextStep.rationale}</div>
                </td>
                <td className="caseload-table-action-col">
                  <span className="caseload-open-cta">View chart &rarr;</span>
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
        risk levels. Click any row to view that patient's chart. In a production implementation,
        cross-app patient context would switch via <strong>FHIRcast</strong>.
      </p>
    </div>
  )
}
