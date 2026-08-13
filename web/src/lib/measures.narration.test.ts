/**
 * The demo's NARRATION and the demo's MEASURES have to tell the same story.
 *
 * ── Why this exists (issue #324) ─────────────────────────────
 *
 * Patient-011's walkthrough step 11.6-2A says "Lethal-means counseling
 * delivered and documented". Her scenario carried no Procedure, so the Stage-8
 * dashboard scored her as a *miss* on the very step her own chart narrates as
 * completed — and it had been that way since the ED scenario landed. Nobody saw
 * it because the two halves are read in different places: the walkthrough
 * renders on the patient chart, the score renders on the measure dashboard, and
 * no gate compared them.
 *
 * That mattered beyond one fixture. #324 opened because lethal-means counseling
 * read 29% and the question was whether the *definition* was wrong. One of the
 * five misses was not a definitional problem at all — it was a missing artifact.
 * A measure layer that audits capture completeness has to be audited itself, or
 * a fixture gap and a specification gap are indistinguishable.
 *
 * ── The two rules ────────────────────────────────────────────
 *
 * 1. A step narrated `completed` that claims a measured artifact must put the
 *    patient in that measure's numerator (`NARRATED_NUMERATORS`).
 * 2. For a patient whose story is narrated at all, EVERY measure miss must be
 *    written down with a reason (`EXPLAINED_MISSES`). This is the direction
 *    that generalizes: it needs no per-step mapping, and it makes the next
 *    unexplained miss a build failure instead of a number on a dashboard.
 *
 * Rule 2 is scoped to patients that HAVE a walkthrough (011–014), because its
 * premise is that a narrative exists to contradict. Patients 001–010 carry
 * legitimate misses — the registry deliberately shows imperfect care — and
 * demanding a reason for each would be busywork, not a gate.
 *
 * ⚠️ Neither rule says a walkthrough step must materialize every FHIR resource
 * type it names. 21 completed steps across the ED cohort name a type SPiER
 * profiles but carry no such artifact (1:1 observation logs, room-clearance
 * checklists, precaution orders). That is a real gap and it is filed separately
 * — it is not this test, because a demo is not obliged to instantiate every
 * artifact it describes. What it IS obliged to do is not contradict itself
 * where a score depends on the answer.
 */
import { describe, expect, it } from 'vitest'
import { MEASURE_SPECS, evaluateAllMeasures, trailingPeriod } from './measures'
import { POPULATION_SCENARIOS } from '../data/population/scenarios'
import type { PatientSlice, ScenarioEncounter } from '../types/fhir'

/** Wide enough to contain the whole seeded registry. */
const PERIOD = trailingPeriod(365)

function sliceFor(patientId: string): PatientSlice {
  const empty: PatientSlice = { responses: [], observations: [], carePlans: [], riskAlerts: [] }
  return { ...empty, ...POPULATION_SCENARIOS[patientId] } as PatientSlice
}

function walkthroughOf(patientId: string): ScenarioEncounter[] {
  return (POPULATION_SCENARIOS[patientId] as { walkthrough?: ScenarioEncounter[] }).walkthrough ?? []
}

/** Every patient whose scenario narrates a walkthrough. */
const NARRATED = Object.keys(POPULATION_SCENARIOS)
  .sort()
  .filter(id => walkthroughOf(id).length > 0)

function groupsFor(patientId: string) {
  return evaluateAllMeasures(sliceFor(patientId), PERIOD).flatMap(m =>
    m.groups.map(g => ({ ...g, measureId: m.measureId })),
  )
}

/**
 * Walkthrough steps that claim, in words, the exact artifact a measure counts.
 *
 * Deliberately small: a row belongs here only when the step's completion and
 * the numerator are the same clinical fact. A step that merely happens near a
 * measured event is not a row — an over-broad table would fail for reasons that
 * are not defects and would be tuned into uselessness.
 */
const NARRATED_NUMERATORS: Array<{
  patientId: string
  step: string
  group: string
  because: string
}> = [
  {
    patientId: 'patient-011',
    step: '11.6-2A',
    group: 'lethal-means-counseling',
    because: 'the step says counseling was delivered AND documented — #324 found no Procedure behind it',
  },
  {
    patientId: 'patient-011',
    step: '11.6-1A',
    group: 'safety-plan-completed',
    because: 'the step says a collaborative Stanley-Brown plan was completed and stored as a CarePlan',
  },
  {
    patientId: 'patient-011',
    step: '11.6-3A',
    group: 'patient-copy-documented',
    because: 'the step says the safety plan was delivered to the patient in the after-visit packet',
  },
  {
    patientId: 'patient-011',
    step: '11.4-1B',
    group: 'risk-status-documented',
    because: 'the step says the current risk level was set and persisted',
  },
]

/**
 * Measure misses that ARE the story — a narrated patient who legitimately did
 * not receive something. Each needs a reason, and adding one should feel like a
 * decision.
 *
 * Empty today, and that is the finding: after #324 every miss among the
 * narrated patients is either a real pass, an administrative exclusion, or the
 * transfer/elopement exception. Before it, patient-011 / lethal-means-counseling
 * would have had to be written down here — and writing the reason is where
 * someone notices there isn't one.
 */
const EXPLAINED_MISSES: Array<{ patientId: string; group: string; because: string }> = []

describe('walkthrough narration agrees with the measure layer', () => {
  it('narrates at least the four ED patients', () => {
    // A guard on the guard: if scenarios stopped carrying walkthroughs, every
    // rule below would pass over an empty set.
    expect(NARRATED).toEqual(['patient-011', 'patient-012', 'patient-013', 'patient-014'])
  })

  it.each(NARRATED_NUMERATORS)(
    '$patientId step $step → $group numerator',
    ({ patientId, step, group, because }) => {
      const entry = walkthroughOf(patientId).find(w => w.step === step)
      // The table must not rot: a renamed or deleted step fails here rather
      // than quietly asserting nothing.
      expect(entry, `${patientId} has no walkthrough step ${step}`).toBeDefined()
      expect(entry?.status, `${step} is no longer narrated as completed`).toBe('completed')

      const row = groupsFor(patientId).find(g => g.code === group)
      expect(row, `${patientId} has no measure group ${group}`).toBeDefined()
      expect(
        row?.inNumerator,
        `${patientId} narrates "${entry?.title}" as completed (${because}), but the ${group} ` +
          `measure scores it as ${row?.inDenominator ? 'a miss' : 'outside the denominator'}. ` +
          `Either the artifact is missing from the scenario or the narration overstates what happened.`,
      ).toBe(true)
    },
  )

  it.each(NARRATED)('%s has no unexplained measure miss', patientId => {
    const misses = groupsFor(patientId)
      .filter(g => g.inDenominator && !g.inNumerator)
      .map(g => g.code)
    const unexplained = misses.filter(
      code => !EXPLAINED_MISSES.some(e => e.patientId === patientId && e.group === code),
    )
    expect(
      unexplained,
      `${patientId} misses ${unexplained.join(', ')} with no recorded reason. If the care really ` +
        `did not happen, add it to EXPLAINED_MISSES with why; if it did, the scenario is missing ` +
        `the artifact the numerator counts (that was #324).`,
    ).toEqual([])
  })

  it('the two ED exception branches are excepted, not scored as failures', () => {
    for (const patientId of ['patient-013', 'patient-014']) {
      const row = groupsFor(patientId).find(g => g.code === 'lethal-means-counseling')
      expect(row?.removedByException, `${patientId} should be a #324 exception`).toBe(true)
      expect(row?.inDenominator).toBe(false)
    }
  })

  it('never removes a patient by exception while counting them in a numerator', () => {
    // The invariant that makes an exception safe to add anywhere: it can only
    // ever remove a case that was going to be a miss.
    for (const patientId of Object.keys(POPULATION_SCENARIOS)) {
      for (const g of groupsFor(patientId)) {
        if (g.removedByException) expect(g.inNumerator).toBe(false)
      }
    }
  })

  it('every group named in the tables is a real measure group', () => {
    const known = new Set(MEASURE_SPECS.flatMap(m => m.groups.map(g => g.code)))
    for (const { group } of [...NARRATED_NUMERATORS, ...EXPLAINED_MISSES]) {
      expect(known, `${group} is not a published measure group`).toContain(group)
    }
  })
})
