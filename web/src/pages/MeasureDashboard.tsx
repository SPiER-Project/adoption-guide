import { useEffect, useMemo, useState } from 'react'
import registryPatientsData from '../data/population/patients.json'
import roadmapSnapshot from '../data/roadmap.generated.json'
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
import { emptinessOf, type Emptiness } from '../lib/measureGaps'
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

/** The longest selectable period, used as the "does this ever compute?" baseline. */
const WIDEST_WINDOW_DAYS = Math.max(...WINDOWS.map(w => w.days))

const REPO_URL = `https://github.com/${(roadmapSnapshot as { repo: string }).repo}`

/** Tally every measure across the whole registry for one measurement period. */
function tallyRegistry(period: MeasurementPeriod): MeasureTally[] {
  return tallyAll(
    REGISTRY_PATIENTS.map(p =>
      evaluateAllMeasures(localDataSource.getSliceSync?.(p.id) ?? EMPTY_SLICE, period),
    ),
  )
}

function IssueLinks({ issues }: { issues: number[] }) {
  return (
    <>
      {issues.map((n, i) => (
        <span key={n}>
          {i > 0 && ', '}
          <a
            className="md-gap-link"
            href={`${REPO_URL}/issues/${n}`}
            target="_blank"
            rel="noreferrer"
          >
            #{n}
          </a>
        </span>
      ))}
    </>
  )
}

/**
 * The sentence that separates "not yet measurable" from "measured zero".
 *
 * Renders nothing once the measure computes, so it retires itself when a seeded
 * cohort lands rather than becoming a stale caveat someone has to remember to
 * delete.
 */
function EmptyExplanation({ emptiness }: { emptiness: Emptiness }) {
  if (emptiness.kind === 'none') return null

  if (emptiness.kind === 'all-excluded') {
    return (
      <p className="md-gap">
        <strong className="md-gap-lead">Nothing left to score.</strong> Patients met the cohort
        criteria, but every one of them fell into a denominator exclusion — so the effective
        denominator is empty. That is a valid result, not a missing one.
      </p>
    )
  }

  if (emptiness.kind === 'window') {
    return (
      <p className="md-gap">
        <strong className="md-gap-lead">No qualifying activity in this period.</strong> This measure
        does compute over a longer measurement period — widen the window above to see it.
      </p>
    )
  }

  const { gap } = emptiness
  return (
    <p className="md-gap">
      <strong className="md-gap-lead">Not yet measurable.</strong> The denominator counts{' '}
      {gap.denominator}, and no patient in the demo registry qualifies. {gap.missing} Tracked as{' '}
      <IssueLinks issues={gap.issues} />.
    </p>
  )
}

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

  const tallies: MeasureTally[] = useMemo(() => tallyRegistry(period), [period])

  // The same measures over the widest window. Only used to tell "this measure
  // never computes on the demo data" apart from "nothing happened in the last
  // 30 days" — two different findings that both render as "no denominator".
  const widestTallies: MeasureTally[] = useMemo(
    () =>
      windowDays === WIDEST_WINDOW_DAYS ? tallies : tallyRegistry(trailingPeriod(WIDEST_WINDOW_DAYS)),
    [windowDays, tallies],
  )

  const emptiness: Emptiness[] = useMemo(
    () => tallies.map((t, i) => emptinessOf(t, widestTallies[i] ?? t)),
    [tallies, widestTallies],
  )

  const emptyCount = emptiness.filter(e => e.kind !== 'none').length

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

      {emptyCount > 0 && (
        <aside className="md-caveat" aria-label="Why some measures have no denominator">
          {/* h3, not h2: the guide's page header owns this page's only h2
              ("Measures"), and these sit under it. */}
          <h3 className="md-caveat-title">
            {emptyCount} of {tallies.length} measures have no denominator in this period
          </h3>
          <p className="md-caveat-body">
            An empty denominator is not a score of zero. It means no patient in the registry meets
            that measure&rsquo;s cohort criteria, so there is nothing to score — a different finding
            from &ldquo;we measured, and the answer was none.&rdquo;
          </p>
          {/* Deliberately says nothing about WHICH artifacts are missing: that
              belongs on each measure, where it stops rendering as soon as that
              measure computes. A list up here would outlive the gap it names. */}
          <p className="md-caveat-body">
            The definitions below are live — every table is computed and every MeasureReport is
            assembled at render time. What is missing is the data they read: the demo registry does
            not yet contain conforming artifacts for every stage these measures query. Each empty
            measure says below exactly which artifact it is waiting on. Auditing capture
            completeness that way is what a measure layer is for, so the zeros are the finding
            rather than a bug.
          </p>
        </aside>
      )}

      {tallies.map((tally, i) => {
        const spec = MEASURE_SPECS[i]
        return (
          <section className="md-measure" key={tally.measureId}>
            <header className="md-measure-header">
              <h3 className="md-measure-title">{tally.title}</h3>
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

            <EmptyExplanation emptiness={emptiness[i] ?? { kind: 'none' }} />

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
