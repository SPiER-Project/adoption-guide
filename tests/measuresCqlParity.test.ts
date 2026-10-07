/**
 * The measure CQL and the measure TypeScript must compute the same answer.
 *
 * A population criterion lives in four places (docs/internals/measures.md) and
 * `tests/measures.test.ts` ties only the FSH names to the TypeScript names. Until this
 * file, NOTHING compared what the CQL — the published, normative statement —
 * computes with what `evaluateMeasure()` — what the app runs — computes. A
 * planted 7→8-day change to the follow-up window in measures.ts passed every
 * gate and every test.
 *
 * How: the CQL is translated in-process by the same translator the IG Publisher
 * uses and executed by cql-execution (tests/cql/cqlMeasureEngine.ts), over
 *
 *   - the 14 demo patients, each bundled as FHIR, and
 *   - synthetic patients sitting on every window edge (tests/cql/boundaryPatients.ts),
 *
 * and every population of every Measure group is compared per patient. A CQL
 * `null` counts as "not in the population", which is how a measure evaluator
 * treats it.
 *
 * ⚠️ KNOWN_DIVERGENCES is a ledger of REAL disagreements, not an allowlist of
 * noise. Each one is a patient the published measure and the app's dashboard
 * score differently today. The ledger is exact in both directions: a new
 * divergence fails, and so does an entry that has stopped diverging — fix the
 * engine, then delete its line. Do not add a line to make this file green
 * without deciding which engine is wrong and saying so in the reason.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { MEASURE_SPECS, evaluateMeasure, referencedCriteria, type MeasurementPeriod } from '@spier/core/lib/measures'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import type { PatientSlice } from '@spier/core/types/fhir'
import {
  bundleFor,
  executeMeasureLibrary,
  translateMeasureLibrary,
  type CqlResults,
  type TranslatedLibraries,
} from './cql/cqlMeasureEngine'
import { BOUNDARY_PATIENTS, BOUNDARY_PERIOD } from './cql/boundaryPatients'

/**
 * Fixed, not trailing: the demo dates run 2026-04 → 2027-08, and a period
 * computed from today would move patients in and out of the comparison as the
 * calendar does.
 */
const DEMO_PERIOD: MeasurementPeriod = { start: '2026-01-01T00:00:00.000Z', end: '2027-12-31T23:59:59.999Z' }

interface Cohort {
  name: string
  period: MeasurementPeriod
  slices: Record<string, PatientSlice>
}

const COHORTS: Cohort[] = [
  {
    name: 'demo',
    period: DEMO_PERIOD,
    slices: Object.fromEntries(
      Object.keys(POPULATION_SCENARIOS)
        .sort()
        .map((id): [string, PatientSlice] => [id, POPULATION_SCENARIOS[id]]),
    ),
  },
  {
    name: 'boundary',
    period: BOUNDARY_PERIOD,
    slices: Object.fromEntries(BOUNDARY_PATIENTS.map(p => [p.id, p.slice])),
  },
]

/**
 * `patient :: criterion` → which engine is wrong and why. Keyed by criterion
 * rather than by population because one criterion feeds several groups, and one
 * root cause should be one line.
 */
const WHY = {
  unprofiledConcept:
    'TS isRiskConcept() accepts an Observation that claims no profile when its content is 93374-7 valued in the tier ' +
    'vocabulary (deliberate, riskConcept.ts, 2026-10-06); the CQL "Risk Concept Observations" requires the profile claim. ' +
    'The CQL has not followed the TS rule — or the demo fixtures, which claim no profile, should.',
  wholeDays:
    'TS compares elapsed time ((latest − preceding) / 1 day ≤ interval, so 7d 1h is late); the CQL compares ' +
    '`days between`, which counts WHOLE days and calls 7d 1h on time. Undecided which the published cadence means.',
  positiveScreen:
    'TS counts a screen positive on interpretation POS or A, or failing both on any tier above no-risk; the CQL reads ' +
    'interpretation POS only.',
  stageResolution:
    "TS resolves an artifact's stage from meta.tag, then category, then a derived-from QuestionnaireResponse; the CQL " +
    'TaggedStage() reads meta.tag only.',
  performedPeriod:
    'The CQL requires the whole performedPeriod `during` the episode; TS reads only its start. Counseling that began ' +
    'inside the episode and ran past its close counts on the dashboard only.',
}

const KNOWN_DIVERGENCES: Record<string, string> = {
  // ── The demo population ──
  'patient-008 :: Risk Tier Documented During Episode': WHY.unprofiledConcept,
  'patient-009 :: Risk Tier Documented During Episode': WHY.unprofiledConcept,
  'patient-010 :: Risk Tier Documented During Episode': WHY.unprofiledConcept,

  // ── The boundary patients ──
  'bp-unprofiled-concept :: Risk Tier Documented During Episode': WHY.unprofiledConcept,
  'bp-reassess-high-7d-1h :: Most Recent Reassessment Was On Time': WHY.wholeDays,
  'bp-positive-by-tier-only :: Has A Positive Screen': WHY.positiveScreen,
  'bp-positive-by-abnormal :: Has A Positive Screen': WHY.positiveScreen,
  'bp-stage-in-category :: Has A Suicide Risk Screen': WHY.stageResolution,
  'bp-stage-in-category :: Has A Positive Screen': WHY.stageResolution,
  'bp-counseling-period-overruns-episode :: Lethal Means Counseling During Episode': WHY.performedPeriod,
}

interface Divergence {
  key: string
  ts: boolean
  cql: unknown
  /** Every measure/group/population the criterion feeds. */
  where: string[]
}

function divergencesFor(cohort: Cohort, cqlResults: CqlResults): Divergence[] {
  const byKey = new Map<string, Divergence>()
  for (const [patientId, slice] of Object.entries(cohort.slices)) {
    const cql = cqlResults[patientId]
    if (!cql) throw new Error(`cql-execution returned no results for ${patientId}`)
    for (const spec of MEASURE_SPECS) {
      const evaluation = evaluateMeasure(spec, slice, cohort.period)
      for (const group of spec.groups) {
        const populations = evaluation.groups.find(g => g.code === group.code)?.populations ?? {}
        for (const [population, criterion] of Object.entries(group.criteria)) {
          const ts = populations[population]
          const cqlValue = cql[criterion]
          if (ts === (cqlValue === true)) continue
          const key = `${patientId} :: ${criterion}`
          const d = byKey.get(key) ?? { key, ts, cql: cqlValue, where: [] }
          d.where.push(`${spec.id}/${group.code}/${population}`)
          byKey.set(key, d)
        }
      }
    }
  }
  return [...byKey.values()]
}

function describeDivergence(d: Divergence): string {
  return `${d.key}: TypeScript=${String(d.ts)} CQL=${String(d.cql)} (feeds ${d.where.join(', ')})`
}

let elm: TranslatedLibraries
const results: Record<string, CqlResults> = {}

beforeAll(async () => {
  elm = await translateMeasureLibrary()
  for (const cohort of COHORTS) {
    results[cohort.name] = await executeMeasureLibrary(
      elm,
      Object.entries(cohort.slices).map(([id, slice]) => bundleFor(id, slice)),
      cohort.period,
    )
  }
}, 120_000)

describe('the measure CQL', () => {
  it('defines every criterion a Measure references', () => {
    // A criterion missing from the ELM would read as `undefined` → "not in the
    // population" on every patient, and agree with every TypeScript `false`.
    const statements = (elm.measures as { library: { statements?: { def?: Array<{ name: string }> } } }).library
      .statements?.def?.map(d => d.name) ?? []
    expect(referencedCriteria().filter(c => !statements.includes(c))).toEqual([])
  })

  it('answers every criterion with a boolean or null, for every patient', () => {
    const wrong: string[] = []
    for (const cohort of COHORTS) {
      for (const [patientId, values] of Object.entries(results[cohort.name])) {
        for (const criterion of referencedCriteria()) {
          const v = values[criterion]
          if (v !== true && v !== false && v !== null) wrong.push(`${patientId} :: ${criterion} = ${JSON.stringify(v)}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('puts at least one patient IN every population, on both engines', () => {
    // An all-false criterion agrees with an all-false implementation whatever
    // either says. Every criterion has to be exercised from the true side.
    const neverTrue: string[] = []
    for (const criterion of referencedCriteria()) {
      const cqlTrue = COHORTS.some(c => Object.values(results[c.name]).some(r => r[criterion] === true))
      const tsTrue = COHORTS.some(c =>
        Object.values(c.slices).some(slice =>
          MEASURE_SPECS.some(spec =>
            evaluateMeasure(spec, slice, c.period).groups.some(g => {
              const group = spec.groups.find(x => x.code === g.code)
              return Object.entries(group?.criteria ?? {}).some(([pop, expr]) => expr === criterion && g.populations[pop])
            }),
          ),
        ),
      )
      if (!cqlTrue) neverTrue.push(`${criterion} (CQL)`)
      if (!tsTrue) neverTrue.push(`${criterion} (TypeScript)`)
    }
    expect(neverTrue).toEqual([])
  })
})

describe('the boundary patients sit where they claim to', () => {
  it.each(BOUNDARY_PATIENTS.map(p => [p.id, p] as const))('%s', (_id, patient) => {
    const answered: Record<string, boolean> = {}
    for (const spec of MEASURE_SPECS) {
      const evaluation = evaluateMeasure(spec, patient.slice, BOUNDARY_PERIOD)
      for (const group of spec.groups) {
        const populations = evaluation.groups.find(g => g.code === group.code)?.populations ?? {}
        for (const [pop, criterion] of Object.entries(group.criteria)) answered[criterion] = populations[pop]
      }
    }
    const got = Object.fromEntries(Object.keys(patient.expectTs).map(c => [c, answered[c]]))
    expect(got, patient.why).toEqual(patient.expectTs)
  })
})

describe('the CQL and evaluateMeasure() agree', () => {
  it.each(COHORTS.map(c => [c.name, c] as const))('on every %s patient, population by population', (_name, cohort) => {
    const unexplained = divergencesFor(cohort, results[cohort.name])
      .filter(d => !(d.key in KNOWN_DIVERGENCES))
      .map(describeDivergence)
    expect(unexplained).toEqual([])
  })

  it('still disagrees on every ledgered divergence — fix one, delete its line', () => {
    const live = new Set(COHORTS.flatMap(c => divergencesFor(c, results[c.name]).map(d => d.key)))
    expect(Object.keys(KNOWN_DIVERGENCES).filter(k => !live.has(k))).toEqual([])
  })
})
