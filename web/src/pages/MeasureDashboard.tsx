import { useEffect, useMemo, useState } from 'react'
import registryPatientsData from '../data/population/patients.json'
import { localDataSource } from '../lib/dataSource/localDataSource'
import {
  MEASURE_SPECS,
  buildSummaryMeasureReport,
  evaluateAllMeasures,
  tallyAll,
  trailingPeriod,
  type MeasureTally,
  type MeasurementPeriod,
} from '../lib/measures'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import type { RegistryPatient } from '../lib/registry'
import type { PatientSlice } from '../types/fhir'
import '../css/MeasureDashboard.css'

const REGISTRY_PATIENTS = registryPatientsData as RegistryPatient[]

const EMPTY_SLICE: PatientSlice = { responses: [], observations: [], carePlans: [], riskAlerts: [] }

const WINDOWS: { days: number; label: string }[] = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
  { days: 3650, label: 'All time' },
]

/**
 * TL-043 — Reporting Dashboard / Aggregate View.
 *
 * Produces no FHIR resource of its own: the tiles are a RENDERING of the
 * MeasureReports TL-042 computes, over the same registry slices Population View
 * reads. Everything here is a query, which is the whole claim of Stage 8.
 *
 * The measurement period is a rolling window rather than a fiscal quarter — the
 * demo data isn't dated against any calendar, so a trailing window is the only
 * honest default.
 */
export function MeasureDashboard() {
  const [windowDays, setWindowDays] = useState(3650)
  const [tick, setTick] = useState(0)

  // Recompute when any patient's slice changes, exactly like the registry does.
  useEffect(() => localDataSource.subscribe(() => setTick(t => t + 1)), [])

  const period: MeasurementPeriod = useMemo(
    () => trailingPeriod(windowDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windowDays, tick],
  )

  const tallies: MeasureTally[] = useMemo(() => {
    const perPatient = REGISTRY_PATIENTS.map(p =>
      evaluateAllMeasures(localDataSource.getSliceSync?.(p.id) ?? EMPTY_SLICE, period),
    )
    return tallyAll(perPatient)
  }, [period])

  const reportedAt = useMemo(() => new Date().toISOString(), [period])

  return (
    <div className="measure-dashboard">
      <p className="md-description">
        Aggregate view of the seven suicide-safer care measures, computed live over the{' '}
        {REGISTRY_PATIENTS.length}-patient registry. Nothing on this page is stored — each tile is a
        query over the artifacts stages 1–7 already produce, which is the point of Stage 8.
      </p>

      <div className="md-controls">
        <label className="md-control-label" htmlFor="md-window">
          Measurement period
        </label>
        <select
          id="md-window"
          className="md-select"
          value={windowDays}
          onChange={e => setWindowDays(Number(e.target.value))}
        >
          {WINDOWS.map(w => (
            <option key={w.days} value={w.days}>
              {w.label}
            </option>
          ))}
        </select>
        <span className="md-period">
          {period.start.slice(0, 10)} → {period.end.slice(0, 10)}
        </span>
      </div>

      {tallies.map((tally, i) => {
        const spec = MEASURE_SPECS[i]
        return (
          <section className="md-measure" key={tally.measureId}>
            <header className="md-measure-header">
              <h2 className="md-measure-title">{tally.title}</h2>
            </header>

            <table className="md-table">
              <thead>
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Denominator</th>
                  <th scope="col">Excluded</th>
                  <th scope="col">Numerator</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {tally.groups.map(g => {
                  const effective = g.denominator - g.denominatorExclusion
                  return (
                    <tr key={g.code}>
                      <th scope="row" className="md-group-name">
                        {g.display}
                      </th>
                      <td>{g.denominator}</td>
                      <td>{g.denominatorExclusion || '—'}</td>
                      <td>{g.numerator}</td>
                      <td className="md-score">
                        {g.score === null ? (
                          <span className="md-empty" title="No patients in the denominator">
                            no denominator
                          </span>
                        ) : (
                          <>
                            <span className="md-score-value">{Math.round(g.score * 100)}%</span>
                            <span className="md-score-fraction">
                              {g.numerator}/{effective}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <FhirJsonViewer
              data={buildSummaryMeasureReport(tally, spec, period, reportedAt, 'SPiER demo registry')}
              title={`MeasureReport — ${tally.title}`}
            />
          </section>
        )
      })}
    </div>
  )
}
