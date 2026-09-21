import { useMemo, useState } from 'react'
import {
  MEASURE_SPECS,
  buildSummaryMeasureReport,
  evaluateAllMeasures,
  tallyAll,
  trailingPeriod,
  type MeasureTally,
  type MeasurementPeriod,
} from '@spier/core/lib/measures'
import { emptinessOf, type Emptiness } from '../lib/measureGaps'
import { CohortScopeNotice } from '../components/CohortScopeNotice'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { useInspect } from '@spier/tool-views/context/InspectContext'
import { PageHeader } from '@spier/ui/PageHeader'
import { useRegistrySlices } from '../hooks/useRegistrySlices'
import type { PatientSlice } from '@spier/core/types/fhir'
import '../css/MeasureDashboard.css'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { EmptyState } from '@spier/ui/EmptyState'
import { Disclosure } from '@spier/ui/Disclosure'
import { Notice } from '@spier/ui/Notice'
import { Card } from '@spier/ui/Card'
import { isoDay } from '@spier/tool-views/lib/dates'
import { DataTable } from '@spier/ui/DataTable'

const WINDOWS: { days: number; label: string }[] = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
  { days: 3650, label: 'All time' },
]

/** The longest selectable period, used as the "does this ever compute?" baseline. */
const WIDEST_WINDOW_DAYS = Math.max(...WINDOWS.map(w => w.days))

/**
 * ⚠️ **`REPO_URL` and `IssueLinks` were here, and both are gone.** Every empty
 * measure ended its explanation with *"Tracked as #77"* — a link to a GitHub
 * issue, offered to a quality lead as the reason a denominator is empty
 * (clinical-app audit §1.9, §8.5). An issue number is the implementer's
 * tracking, and `check:jargon`'s clinical rule set bans it by name; the reason
 * the measure cannot compute is what the reader needed, and `measureGaps.ts`
 * says it in a sentence.
 *
 * (The constant also has its own history: it was read out of a 356KB committed
 * snapshot of issue bodies, which Vite made a shared chunk, so opening this
 * page downloaded 116KB gzip of issue prose to render a hostname.)
 */

/**
 * Tally every measure across a cohort for one measurement period.
 *
 * Takes the slices rather than reaching for a data source: `measures.ts` is pure
 * and slice-shaped, so the only thing coupling this page to `localDataSource` was
 * the read — which now happens through the `FhirDataSource` seam (#390).
 */
function tallyRegistry(slices: PatientSlice[], period: MeasurementPeriod): MeasureTally[] {
  return tallyAll(slices.map(slice => evaluateAllMeasures(slice, period)))
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
      <Notice tone="info">
        <strong>Nothing left to score.</strong> Patients met the cohort
        criteria, but every one of them fell into a denominator exclusion — so the effective
        denominator is empty. That is a valid result, not a missing one.
      </Notice>
    )
  }

  if (emptiness.kind === 'window') {
    return (
      <Notice tone="info">
        <strong>No qualifying activity in this period.</strong> This measure
        does compute over a longer measurement period — widen the window above to see it.
      </Notice>
    )
  }

  const { gap } = emptiness
  return (
    <Notice tone="info">
      <strong>Not yet measurable.</strong> The denominator counts {gap.denominator}, and no
      patient on this caseload qualifies. {gap.missing}
    </Notice>
  )
}

/**
 * TL-043 — Reporting Dashboard / Aggregate View.
 *
 * Produces no FHIR resource of its own: the tiles are a RENDERING of the
 * MeasureReports TL-042 computes, over the same registry slices the caseload
 * reads. Everything here is a query, which is the whole claim of Stage 8.
 *
 * The measurement period is a rolling window rather than a fiscal quarter — the
 * demo data isn't dated against any calendar, so a trailing window is the only
 * honest default.
 */
export function MeasureDashboard() {
  const [windowDays, setWindowDays] = useState(3650)

  // Slices come from the ACTIVE FhirDataSource and the hook owns the
  // subscribe/refresh, so the manual `tick` counter this page used to keep is
  // gone with the direct `localDataSource` import (#390).
  const { entries, scope, isLoading } = useRegistrySlices()
  // ⚠️ Every `MeasureReport` below is built and then thrown away unless
  // inspection is on, and on this surface it never is — `FhirJsonViewer`
  // returns null without it. Eight of them, on every render and again on every
  // window change, to produce nothing (clinical-app audit §8.3).
  const inspect = useInspect()
  const slices = useMemo(() => entries.map(e => e.slice), [entries])

  const period: MeasurementPeriod = useMemo(() => trailingPeriod(windowDays), [windowDays])

  const tallies: MeasureTally[] = useMemo(() => tallyRegistry(slices, period), [slices, period])

  // The same measures over the widest window. Only used to tell "this measure
  // never computes on the demo data" apart from "nothing happened in the last
  // 30 days" — two different findings that both render as "no denominator".
  const widestTallies: MeasureTally[] = useMemo(
    () =>
      windowDays === WIDEST_WINDOW_DAYS
        ? tallies
        : tallyRegistry(slices, trailingPeriod(WIDEST_WINDOW_DAYS)),
    [windowDays, tallies, slices],
  )

  const emptiness: Emptiness[] = useMemo(
    () => tallies.map((t, i) => emptinessOf(t, widestTallies[i] ?? t)),
    [tallies, widestTallies],
  )

  const emptyCount = emptiness.filter(e => e.kind !== 'none').length

  // ⚠️ `period` is a CACHE KEY here, not a value the callback reads — the
  // MeasureReport's "as of" stamp must be re-minted when the window changes,
  // and `new Date()` reads nothing React can track. The rule can only see that
  // the identifier is unused inside the body, so the intent has to be stated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reportedAt = useMemo(() => new Date().toISOString(), [period])

  // ⚠️ A session with no cohort renders NO measures (audit §8.7). This page
  // was LONGER on a chart launch than on a working one — 937 words against
  // 503 — because eight measures with an empty denominator each explain why,
  // and not one of those explanations was about the actual reason.
  if (scope !== 'registry') {
    return (
      <div className="measure-dashboard">
        <PageHeader
          eyebrow={['Caseload', 'Measures']}
          up="/population/caseload"
          eyebrowStyle="pill"
          title="Measures"
          lede="How this programme is doing, over every patient on the caseload."
        />
        <CohortScopeNotice scope={scope} />
      </div>
    )
  }

  return (
    <div className="measure-dashboard">
      {/* Its own header, because this page is no longer a guide sub-page —
          AdoptionGuide rendered one for every section it wrapped.
          ⚠️ The eyebrow named the retired "Population View" lens until
          2026-09-09. It now names its actual parent and links back to it: this
          page and the caseload are the dashboard's two screens, and `up` is what
          makes the trail a way out rather than a label.
          ⚠️ The lede said "Every tile is a query over the artifacts stages 1–7
          already produce — nothing on this page is stored, which is the point
          of Stage 8." Where the numbers come from is the implementer's
          question and the Adoption Guide answers it; the quality lead reading
          this wants to know what the page IS (audit §8.5). */}
      <PageHeader
        eyebrow={['Caseload', 'Measures']}
        up="/population/caseload"
        eyebrowStyle="pill"
        title="Measures"
        lede="How this programme is doing, over every patient on the caseload. Computed each time you open it — nothing here is saved."
      />

      {/* The dynamic half only — the static claim is the header's lede, and
          saying it twice on one page is what the move first produced.
          ⚠️ The count is COUNTED. This said "All seven measures" while the
          aside four lines below said "1 of 8", because the seven was a literal
          and the eight was `MEASURE_SPECS.length` — the reassessment measure
          made it eight and nothing here noticed (clinical-app audit §8.3). */}
      <p className="md-description">
        All {tallies.length} measures, computed live over {entries.length} patients.
      </p>

      {isLoading && entries.length === 0 && (
        <Notice tone="info">Reading the caseload from the connected server…</Notice>
      )}

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
          {isoDay(period.start)} → {isoDay(period.end)}
        </span>
      </div>

      {/* ⚠️ **A closed drawer, not an aside.** This was 129 words of
          explanation between the reader and the first number — on a phone the
          first table was at 928px because of it. The distinction it draws is
          real and is the reason the page is worth reading at all, so it is
          demoted rather than deleted (audit §2, and the guide's own rule). */}
      {emptyCount > 0 && (
        <Disclosure
          summary={`${emptyCount} of ${tallies.length} measures have no denominator in this period`}
          hint="An empty denominator is not a score of zero"
        >
          <p>
            It means no patient on this caseload meets that measure&rsquo;s criteria, so there is
            nothing to score &mdash; a different finding from &ldquo;we measured, and the answer
            was none.&rdquo;
          </p>
          {/* Deliberately says nothing about WHICH data is missing: that
              belongs on each measure, where it stops rendering as soon as that
              measure computes. A list up here would outlive the gap it names. */}
          <p>
            Every measure below is computed each time this page opens. What is missing is the
            data they read, and each empty one says underneath exactly what it is waiting for.
            Auditing capture that way is what a measure layer is for, so the zeros are the
            finding rather than a fault.
          </p>
        </Disclosure>
      )}

      {tallies.map((tally, i) => {
        const spec = MEASURE_SPECS[i]
        return (
          <Card as="section" padding="compact" className="md-measure" key={tally.measureId}>
            <SectionHeader title={tally.title} />

            {/* The table is six numeric columns and a group name, and
                `.md-score` cannot wrap — so below roughly 600px it is wider
                than the page. It used to push the whole document sideways
                (183px of horizontal scroll on a phone); this keeps the
                overflow inside the table's own box. */}
            <DataTable>
                <thead>
                  <tr>
                    <th scope="col">Group</th>
                    <th scope="col">Denominator</th>
                    <th scope="col">Excluded</th>
                    {/* Cases an exception removed: the reason applied AND the
                        numerator was not met. A patient who met both stays in the
                        denominator and counts as a pass, so this column never
                        hides a success. */}
                    <th scope="col" title="Removed for a valid clinical or system reason, and only because the numerator was not met">
                      Exception
                    </th>
                    <th scope="col">Numerator</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.groups.map(g => {
                    const effective = g.denominator - g.denominatorExclusion - g.denominatorException
                    return (
                      <tr key={g.code}>
                        <th scope="row" className="md-group-name">
                          {g.display}
                        </th>
                        <td>{g.denominator}</td>
                        <td>{g.denominatorExclusion || '—'}</td>
                        <td>{g.denominatorException || '—'}</td>
                        <td>{g.numerator}</td>
                        <td className="md-score">
                          {g.score === null ? (
                            <EmptyState as="span" title="No patients in the denominator">
                              no denominator
                            </EmptyState>
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
            </DataTable>

            <EmptyExplanation emptiness={emptiness[i] ?? { kind: 'none' }} />

            {inspect && (
              <FhirJsonViewer
                data={buildSummaryMeasureReport(tally, spec, period, reportedAt, 'SPiER demo registry')}
                title={`MeasureReport — ${tally.title}`}
              />
            )}
          </Card>
        )
      })}
    </div>
  )
}
