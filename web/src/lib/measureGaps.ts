/**
 * Why a Stage-8 measure has nothing to score.
 *
 * On the seeded demo registry every group of every measure reads "no
 * denominator". That is a true and useful result — a measure layer audits
 * capture completeness rather than asserting numbers the data cannot support —
 * but rendered without explanation it reads as broken software. This module
 * supplies the missing sentence.
 *
 * Two rules the copy here has to keep:
 *
 *  1. NO FABRICATED NUMBERS. The explanation says what the denominator counts
 *     and which artifact the registry does not contain. It never invents a
 *     score, and the empty tables stay on the page — the zeros are the finding.
 *
 *  2. IT HAS TO DISAPPEAR ON ITS OWN. `emptinessOf()` is computed from the
 *     tally, so the moment a seeded cohort lands (#209) and a measure starts
 *     computing, its explanation stops rendering. Nothing has to be deleted by
 *     hand — which is exactly the kind of caveat that otherwise outlives the
 *     problem it described.
 *
 * The per-measure text below is a hand-written mapping keyed by Measure id, so
 * `measureGaps.test.ts` asserts it covers MEASURE_SPECS exactly in both
 * directions — a measure added in FSH fails the test rather than silently
 * falling back to generic copy.
 */
import type { MeasureTally } from '@spier/core/lib/measures'

/** Why the tables for a measure are empty, if they are. */
export type Emptiness =
  /** At least one group computed a score. Nothing to explain. */
  | { kind: 'none' }
  /**
   * Patients met the cohort criteria but every one of them was excluded, so
   * there is no effective denominator left. Not the same as an empty cohort.
   */
  | { kind: 'all-excluded' }
  /**
   * The measure computes over a wider window — the selected measurement period
   * just doesn't contain any qualifying activity.
   */
  | { kind: 'window' }
  /** No patient in the registry meets the cohort criteria at all. */
  | { kind: 'structural'; gap: MeasureGap }

export interface MeasureGap {
  /** What the denominator counts, in plain language. */
  denominator: string
  /** Which artifact the demo registry does not contain, and why that empties it. */
  missing: string
  /** Issues that would populate it. Rendered as links to the SPiER repo. */
  issues: number[]
}

/**
 * Keyed by `Measure.id`. Sourced from the "What the dashboard revealed" gap
 * table in docs/plans/stage-8-measure-and-share.md, which is where these gaps
 * were diagnosed against the real seed data.
 */
export const MEASURE_GAPS: Record<string, MeasureGap> = {
  SPiERScreenToAssessment: {
    denominator: 'patients with a positive suicide-risk screen',
    missing:
      'The registry does seed screen-stage risk-concept Observations, but they carry no interpretation and score into instrument-specific value sets (the ASQ screening-result CodeSystem, for one) rather than the shared risk-tier ValueSet. A positive screen therefore cannot be told apart from a negative one, and counting them anyway would put negatives into a positive-screen denominator.',
    issues: [77],
  },
  SPiERRiskStatusDocumented: {
    denominator: 'patients in an open suicide-safer care episode',
    missing:
      'No scenario in the demo registry contains an EpisodeOfCare on the SPiER episode profile, so no patient enters the cohort.',
    issues: [209],
  },
  SPiERSafetyPlanBeforeDischarge: {
    denominator: 'patients with a documented care transition',
    missing:
      'A transition is evidenced by a safety-handoff Communication or a handoff-packet DocumentReference. The registry seeds neither, so the safety plans it does seed have no transition to be measured against.',
    issues: [209],
  },
  SPiERLethalMeansCounselingCompleted: {
    denominator: 'patients in an open suicide-safer care episode',
    missing:
      'No patient in the registry is in an EpisodeOfCare on the SPiER episode profile, so the cohort is empty. TL-008 does record the lethal-means counseling Procedure this measure counts — the numerator has somewhere to come from as soon as a patient enters the cohort.',
    issues: [209],
  },
  SPiERReferralCompletion: {
    denominator: 'patients with a suicide-safety referral',
    missing:
      'TL-017 records referrals as ServiceRequest, but no scenario in the registry contains one — so there is no referral loop to track through to completion.',
    issues: [209],
  },
  SPiERFollowUpTimeliness: {
    denominator: 'patients with a documented care transition',
    missing:
      'Timeliness is measured forward from a transition — a safety-handoff Communication or a handoff packet — and the registry seeds none, so there is no index date for the 48-hour, 7-day, and 30-day windows to run from.',
    issues: [209],
  },
  SPiERReassessmentOnTime: {
    denominator: 'patients with at least two risk assessments in the period',
    missing:
      'A reassessment interval needs two dated SPiERSuicideRiskConcept Observations inside the measurement period; a patient assessed once has no gap to be late on. Narrow periods therefore empty this measure legitimately — widen the window before reading anything into a blank score.',
    issues: [279],
  },
  SPiERCaringContactAdherence: {
    denominator: 'patients with a documented care transition',
    missing:
      'The 30-day clock starts at a documented care transition — a safety-handoff Communication or a handoff packet — and no patient in the registry has one, so there is no index date for the window to run from. The opt-out exclusion is reachable: the TL-010 recorder writes the caring-contact-opt-out extension.',
    issues: [209],
  },
}

/**
 * Safety net for a Measure added in FSH before its explanation is written.
 * `measureGaps.test.ts` fails in that case, so this should never render — but a
 * missing entry degrading to honest generic copy beats a blank space.
 */
export const GENERIC_GAP: MeasureGap = {
  denominator: "this measure's cohort",
  missing:
    'No patient in the demo registry meets the cohort criteria, so there is nothing to score. The definition is live and will compute as soon as conforming artifacts exist.',
  issues: [209],
}

export function gapFor(measureId: string): MeasureGap {
  return MEASURE_GAPS[measureId] ?? GENERIC_GAP
}

/** True when at least one group produced a score. */
export function isComputed(tally: MeasureTally): boolean {
  return tally.groups.some(g => g.score !== null)
}

/** True when at least one patient met a group's denominator, pre-exclusion. */
function hasCohort(tally: MeasureTally): boolean {
  return tally.groups.some(g => g.denominator > 0)
}

/**
 * Classify why a measure has no score in the selected period.
 *
 * `widest` is the same measure tallied over the longest available measurement
 * period. It is what separates "the registry cannot exercise this measure at
 * all" from "nothing happened in the last 30 days", which are different
 * findings and deserve different sentences. Pass the same tally when the
 * selected period already IS the widest.
 */
export function emptinessOf(tally: MeasureTally, widest: MeasureTally): Emptiness {
  if (isComputed(tally)) return { kind: 'none' }
  if (hasCohort(tally)) return { kind: 'all-excluded' }
  if (isComputed(widest) || hasCohort(widest)) return { kind: 'window' }
  return { kind: 'structural', gap: gapFor(tally.measureId) }
}
