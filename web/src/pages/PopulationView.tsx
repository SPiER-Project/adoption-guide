import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAGES, stageTitleById } from '../data/catalog'
import patientsData from '../data/population/patients.json'
import '../css/PopulationView.css'

type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'acute'

interface Patient {
  id: string
  displayName: string
  dob: string
  mrn: string
  gender: string
  currentStage: string
  completedStages: string[]
  currentRiskLevel: RiskLevel
  lastActivity: { date: string; label: string }
  recommendedNextStep: { stageId: string; label: string; rationale: string }
}

const PATIENTS = patientsData as Patient[]

const RISK_ORDER: Record<RiskLevel, number> = {
  acute: 0,
  high: 1,
  moderate: 2,
  low: 3,
  none: 4,
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

export function PopulationView() {
  const navigate = useNavigate()
  const [stageFilter, setStageFilter] = useState<string | 'all'>('all')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('risk')

  const filteredSorted = useMemo(() => {
    let list = PATIENTS
    if (stageFilter !== 'all') list = list.filter(p => p.currentStage === stageFilter)
    if (riskFilter !== 'all') list = list.filter(p => p.currentRiskLevel === riskFilter)

    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'risk':
          return RISK_ORDER[a.currentRiskLevel] - RISK_ORDER[b.currentRiskLevel]
        case 'oldest':
          return new Date(a.lastActivity.date).getTime() - new Date(b.lastActivity.date).getTime()
        case 'recent':
          return new Date(b.lastActivity.date).getTime() - new Date(a.lastActivity.date).getTime()
        case 'name':
          return a.displayName.localeCompare(b.displayName)
      }
    })
    return sorted
  }, [stageFilter, riskFilter, sortKey])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of PATIENTS) counts[p.currentStage] = (counts[p.currentStage] ?? 0) + 1
    return counts
  }, [])

  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of PATIENTS) counts[p.currentRiskLevel] = (counts[p.currentRiskLevel] ?? 0) + 1
    return counts
  }, [])

  const handleOpenChart = () => {
    // v1: cross-app patient switching is mocked. In production this would be FHIRcast.
    navigate('/patient/chart')
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
          {filteredSorted.length} of {PATIENTS.length} patients shown
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
            All ({PATIENTS.length})
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
              <tr key={p.id} className="caseload-row" onClick={handleOpenChart}>
                <td>
                  <div className="caseload-patient-name">{p.displayName}</div>
                  <div className="caseload-patient-meta">MRN {p.mrn} &middot; DOB {p.dob}</div>
                </td>
                <td>
                  <span className="caseload-stage">{stageTitleById(p.currentStage)}</span>
                </td>
                <td>
                  <span className={`caseload-risk caseload-risk--${p.currentRiskLevel}`}>
                    {RISK_LABEL[p.currentRiskLevel]}
                  </span>
                </td>
                <td>
                  <div className="caseload-activity-label">{p.lastActivity.label}</div>
                  <div className="caseload-activity-date">
                    {formatDaysAgo(p.lastActivity.date)}
                  </div>
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
        Mock registry data &mdash; 10 patients sampled across all 8 pathway stages and risk levels.
        Click any row to view that patient's chart. In a production implementation, cross-app
        patient context would switch via <strong>FHIRcast</strong>.
      </p>
    </div>
  )
}
