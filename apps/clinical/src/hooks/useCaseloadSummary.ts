/**
 * useCaseloadSummary — the caseload derivation the Population lens and the
 * embeddable summary widget both need.
 *
 * Extracted when the mock EHR's front door stopped framing the whole population
 * view. That page had **two patient lists** on it — the host's own demographics
 * table and SPiER's sortable caseload inside the frame — so the embed's job
 * collapsed to duplicating the list beside it. What an EHR would actually host
 * at the top of a worklist page is the *summary and the alerts*: the part the
 * host cannot compute for itself. `/population/summary` renders exactly those
 * two panels, and this hook is what stops that route from re-deriving them.
 *
 * ⚠️ **Everything here is caseload-wide and filter-independent, and that is the
 * seam.** Sorting, filtering and the view switcher stay in `PopulationView` —
 * they describe the table. The tiles, the census bar and the alert groups
 * describe the whole cohort and never narrow with a filter (a summary that moved
 * when you filtered the table would be a different, and much more confusing,
 * artifact). So this hook takes no arguments.
 *
 * `scope` is passed straight through from `useRegistrySlices` rather than
 * resolved here: under SMART the cohort is one patient, and both consumers have
 * to say so rather than presenting a one-patient census as a caseload.
 */
import { useMemo } from 'react'
import { evaluateAllMeasures, trailingPeriod } from '@spier/core/lib/measures'
import { deriveRegistryRow, type DerivedRegistryRow } from '@spier/core/lib/registry'
import type { RiskAlert } from '@spier/core/lib/observationMappers'
import type { PatientSlice } from '@spier/core/types/fhir'
import { alertsForPatient, groupAlertsByPatient, type PatientAlertGroup } from '../lib/populationAlerts'
import { riskCountsOf, summaryTiles, tierCensus } from '../lib/populationSummary'
import type { SummaryTile, TierCensusEntry } from '../lib/populationSummary'
import { useRegistrySlices, type RegistryScope } from './useRegistrySlices'

/**
 * How far back the alert rules look. Ten years — these are demo fixtures whose
 * clinical dates are re-anchored periodically (`check:dates`), and a realistic
 * measurement period would empty the panel on a fixture set that had drifted.
 * Moved here with the alert derivation so the two cannot separate.
 */
const ALERT_PERIOD_DAYS = 3650

/** Rows and slices together: the alerts need the slice, the table needs the row. */
export interface CaseloadEntry {
  row: DerivedRegistryRow
  slice: PatientSlice
}

export interface CaseloadSummary {
  entries: CaseloadEntry[]
  rows: DerivedRegistryRow[]
  /** Patients per risk tier. One source for the census bar, the high-risk tile and the Risk filter. */
  riskCounts: Record<RiskAlert['level'], number>
  alertGroups: PatientAlertGroup[]
  tiles: SummaryTile[]
  census: TierCensusEntry[]
  scope: RegistryScope
  isLoading: boolean
}

export function useCaseloadSummary(): CaseloadSummary {
  // Rows come from the ACTIVE FhirDataSource, not a hardcoded local one — these
  // pages used to import `localDataSource` directly, so a live SMART session left
  // them rendering bundled demo data that looked like a server read (#390).
  const { entries: sliceEntries, scope, isLoading } = useRegistrySlices()

  const entries = useMemo<CaseloadEntry[]>(
    () => sliceEntries.map(e => ({ row: deriveRegistryRow(e.patient, e.slice), slice: e.slice })),
    [sliceEntries],
  )

  const rows = useMemo(() => entries.map(e => e.row), [entries])

  const riskCounts = useMemo(() => riskCountsOf(rows), [rows])

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

  return { entries, rows, riskCounts, alertGroups, tiles, census, scope, isLoading }
}
