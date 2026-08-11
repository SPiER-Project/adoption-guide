/**
 * The Population view's executive-summary tiles and risk-tier census
 * (deck panel 1 and panel 2, issue #278).
 *
 * ─── The one rule this module exists to enforce ───
 *
 * **A tile SPiER cannot compute renders as unavailable, never as zero.**
 *
 * Four of the deck's nine summary tiles depend on modeling SPiER does not have
 * yet. Showing "0 psychiatric consultations overdue" would be a false negative
 * dressed as good news — the same defect `measureGaps.ts` was written to stop
 * on the Stage-8 dashboard, where an empty measure now says which artifact it is
 * waiting for instead of showing a bare zero. `SummaryTile.state` carries that
 * distinction into the type system, so a caller cannot render a blocked tile as
 * a number without deleting the `blocked` case.
 */
import type { RiskAlert } from './observationMappers'
import type { DerivedRegistryRow } from './registry'
import type { ObservationResource, PatientSlice } from '../types/fhir'

type RiskLevel = RiskAlert['level']

/** PHQ-9 item 9 — the deck's pathway entry trigger (panel 3). */
const PHQ9_ITEM9_LOINC = '44260-8'

export type SummaryTile =
  | {
      state: 'value'
      id: string
      label: string
      value: string
      /** The deck's stated goal for this metric, if it gave one. */
      goal?: string
      /** Set when the value breaches the goal. */
      breached?: boolean
    }
  | {
      state: 'blocked'
      id: string
      label: string
      goal?: string
      /** What has to exist before this tile can show a number. */
      waitingOn: string
    }

export interface TierCensusEntry {
  level: RiskLevel
  label: string
  count: number
  /** Share of the whole caseload, 0–1. */
  share: number
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  acute: 'Acute',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  none: 'None',
}

/** Highest risk first — the order a triage reader wants, and the census order. */
export const CENSUS_ORDER: RiskLevel[] = ['acute', 'high', 'moderate', 'low', 'none']

export function riskCountsOf(rows: DerivedRegistryRow[]): Record<RiskLevel, number> {
  const counts = { acute: 0, high: 0, moderate: 0, low: 0, none: 0 }
  for (const r of rows) counts[r.currentRiskLevel]++
  return counts
}

/**
 * The tier census. Derived from the same counts the column filter uses — passed
 * in rather than recomputed so the bar and the filter menu can never disagree
 * about how many high-risk patients there are.
 */
export function tierCensus(
  counts: Record<RiskLevel, number>,
  total: number,
): TierCensusEntry[] {
  return CENSUS_ORDER.filter(l => counts[l] > 0).map(level => ({
    level,
    label: RISK_LABEL[level],
    count: counts[level],
    share: total > 0 ? counts[level] / total : 0,
  }))
}

/**
 * Positive PHQ-9 item 9 responses dated on `day`.
 *
 * Item 9 is integer-typed under `spier-phq9-item9`, and ANY endorsement (1, 2
 * or 3 — "several days" up to "nearly every day") is positive. That threshold
 * is the same one the Clarify Risk PlanDefinition trigger uses, expressed there
 * as a FHIRPath action condition; keep the two in step.
 */
export function positiveItem9OnDay(slices: PatientSlice[], day: Date): number {
  const target = day.toISOString().slice(0, 10)
  let n = 0
  for (const slice of slices) {
    for (const obs of slice.observations as ObservationResource[]) {
      const isItem9 = obs.code?.coding?.some(c => c.code === PHQ9_ITEM9_LOINC)
      if (!isItem9) continue
      // `issued` is not on ObservationResource — the profiles are the real
      // contract and the type is deliberately partial — so it is read through a
      // narrow cast, the same way registry.ts reads its date candidates.
      const issued = (obs as { issued?: string }).issued
      const when = obs.effectiveDateTime ?? issued
      if (!when || when.slice(0, 10) !== target) continue
      if (typeof obs.valueInteger === 'number' && obs.valueInteger > 0) n++
    }
  }
  return n
}

export interface SummaryInput {
  rows: DerivedRegistryRow[]
  slices: PatientSlice[]
  counts: Record<RiskLevel, number>
  /** Total red + yellow alerts, for the pathway tile's companion figure. */
  alertCount: number
  now: Date
}

/**
 * The nine panel-1 tiles, in the deck's order.
 *
 * The high-risk tile is the only one the deck gave a numeric target (<5%), so
 * it is the only one that can be `breached`. "Monitor" and "Trending" are not
 * thresholds and are carried as plain goal text.
 */
export function summaryTiles(input: SummaryInput): SummaryTile[] {
  const { rows, slices, counts, now } = input
  const total = rows.length
  const onPathway = rows.filter(r => r.episodeOpen).length
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—')

  // The deck's High Risk tile is a share of the pathway census. SPiER splits
  // that band into `acute` + `high`, and folding them is the honest reading:
  // the deck's four tiers have no level above High, so an acute patient is a
  // high-risk patient as far as this target is concerned.
  const highBand = counts.acute + counts.high
  const highShare = total > 0 ? highBand / total : 0

  return [
    {
      state: 'value',
      id: 'on-pathway',
      label: 'Patients on suicide care pathway',
      value: String(onPathway),
      goal: 'Trending',
    },
    {
      state: 'value',
      id: 'high-risk',
      label: 'High risk',
      value: `${highBand} · ${pct(highBand)}`,
      goal: '<5%',
      breached: total > 0 && highShare >= 0.05,
    },
    {
      state: 'value',
      id: 'moderate-risk',
      label: 'Moderate risk',
      value: String(counts.moderate),
      goal: 'Monitor',
    },
    { state: 'value', id: 'low-risk', label: 'Low risk', value: String(counts.low), goal: 'Monitor' },
    {
      state: 'blocked',
      id: 'historical-risk',
      label: 'Historical risk',
      goal: 'Monitor',
      waitingOn:
        'a lifetime-history axis. SPiER’s risk tier has no “historical” level, and adding one as a fifth ordinal would make the scale non-monotonic — see the plan’s gap 3.',
    },
    {
      state: 'value',
      id: 'new-item9',
      label: 'New positive PHQ-9 item 9 today',
      value: String(positiveItem9OnDay(slices, now)),
      goal: 'Daily',
    },
    {
      // Unblocked by #279: the interval now comes from
      // PlanDefinition-SPiERReassessmentSchedule, so "due today" is computable.
      // Counts reassessments due today across every tier that publishes a
      // cadence — the deck names C-SSRS, but at population level what matters is
      // that a reassessment is due, not which instrument will be used.
      state: 'value',
      id: 'cssrs-due',
      label: 'Reassessments due today',
      value: String(rows.filter(r => r.reassessment.kind === 'scheduled' && r.reassessment.status === 'due-today').length),
      goal: '100%',
    },
    {
      // Not in the deck's tile list, but the reassessment rule makes it free and
      // it is the number a care manager actually acts on: due-today is a task,
      // overdue is a failure.
      state: 'value',
      id: 'reassessments-overdue',
      label: 'Reassessments overdue',
      value: String(rows.filter(r => r.reassessment.kind === 'scheduled' && r.reassessment.status === 'overdue').length),
      goal: '0',
      breached: rows.some(r => r.reassessment.kind === 'scheduled' && r.reassessment.status === 'overdue'),
    },
    {
      state: 'blocked',
      id: 'plans-needing-update',
      label: 'Safety plans needing update',
      goal: '0',
      waitingOn:
        'a safety-plan review interval. The deck states reassessment intervals but never one for plan review.',
    },
    {
      state: 'blocked',
      id: 'consults-overdue',
      label: 'Psychiatric consultations overdue',
      goal: '0',
      waitingOn: 'the care-team role model, which SPiER has no CareTeam or PractitionerRole for (phase 4).',
    },
  ]
}
