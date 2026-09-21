/**
 * Why a Stage-8 measure has nothing to score.
 *
 * On the seeded demo registry every group of every measure reads "no
 * denominator". That is a true and useful result — a measure layer audits
 * capture completeness rather than asserting numbers the data cannot support —
 * but rendered without explanation it reads as broken software. This module
 * supplies the missing sentence.
 *
 * ⚠️ **Three rules, and the third arrived with PR 7.** The reader of this
 * sentence is a quality lead, not an implementer: every entry below said which
 * FHIR resource type or profile the registry lacks and ended with a GitHub
 * issue number (clinical-app audit §1.9, §8.5). Four of them also asserted
 * things about the demo data that had stopped being true — *"No scenario in
 * the demo registry contains an EpisodeOfCare on the SPiER episode profile"*,
 * on a page whose next table scored eight patients in exactly that cohort —
 * and nobody saw it, because these strings only render for a measure that
 * never computes. They say what is missing from the CHARTS now, which is the
 * thing a quality lead can do something about.
 *
 * Two older rules the copy here has to keep:
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
  /** What is not on any chart here, and why that empties the denominator. */
  missing: string
}

/**
 * Keyed by `Measure.id`. Sourced from the "What the dashboard revealed" gap
 * table in docs/plans/archive/stage-8-measure-and-share.md, which is where these gaps
 * were diagnosed against the real seed data.
 */
export const MEASURE_GAPS: Record<string, MeasureGap> = {
  SPiERScreenToAssessment: {
    denominator: 'patients with a positive suicide-risk screen',
    missing:
      'Screening results are recorded here in each instrument’s own words rather than as a shared positive-or-negative answer, so a positive screen cannot be told apart from a negative one. Counting them anyway would put negative screens into a positive-screen denominator.',
  },
  SPiERRiskStatusDocumented: {
    denominator: 'patients in an open suicide-safer care episode',
    missing:
      'No chart on this caseload has a suicide-safer care episode open, so nobody enters the cohort.',
  },
  SPiERSafetyPlanBeforeDischarge: {
    denominator: 'patients with a documented care transition',
    missing:
      'A transition is a handoff sent or a discharge packet recorded, and no chart here has either — so the safety plans that do exist have no transition to be measured against.',
  },
  SPiERLethalMeansCounselingCompleted: {
    denominator: 'patients in an open suicide-safer care episode',
    missing:
      'No chart on this caseload has a suicide-safer care episode open, so the cohort is empty. The means-safety recorder does write what this measure counts, so the numerator has somewhere to come from as soon as a patient enters it.',
  },
  SPiERReferralCompletion: {
    denominator: 'patients with a suicide-safety referral',
    missing:
      'No chart on this caseload records a referral, so there is no loop to track through to completion.',
  },
  SPiERFollowUpTimeliness: {
    denominator: 'patients with a documented care transition',
    missing:
      'Timeliness is measured forward from a transition — a handoff sent or a discharge packet recorded — and no chart here has one, so the 48-hour, 7-day and 30-day windows have no day to start from.',
  },
  SPiERReassessmentOnTime: {
    denominator: 'patients with at least two risk assessments in the period',
    missing:
      'Being late needs two dated assessments inside the period; a patient assessed once has no gap to be late on. A narrow period empties this measure legitimately — widen the window before reading anything into a blank score.',
  },
  SPiERCaringContactAdherence: {
    denominator: 'patients with a documented care transition',
    missing:
      'The 30-day clock starts at a documented care transition — a handoff sent or a discharge packet recorded — and no chart here has one, so the window has no day to start from. A patient who opted out is excluded, and the caring-contact recorder writes that.',
  },
}

/**
 * Safety net for a Measure added in FSH before its explanation is written.
 * `measureGaps.test.ts` fails in that case, so this should never render — but a
 * missing entry degrading to honest generic copy beats a blank space.
 */
const GENERIC_GAP: MeasureGap = {
  denominator: "this measure's cohort",
  missing:
    'No patient on this caseload meets the criteria, so there is nothing to score. The measure is live and will compute as soon as one does.',
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
