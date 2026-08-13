import { describe, expect, it } from 'vitest'
import { MEASURE_SPECS, type GroupTally, type MeasureTally } from './measures'
import { MEASURE_GAPS, emptinessOf, gapFor, isComputed } from './measureGaps'

function group(partial: Partial<GroupTally>): GroupTally {
  const denominator = partial.denominator ?? 0
  const exclusion = partial.denominatorExclusion ?? 0
  const exception = partial.denominatorException ?? 0
  const numerator = partial.numerator ?? 0
  const effective = denominator - exclusion - exception
  return {
    code: partial.code ?? 'g',
    display: partial.display ?? 'Group',
    initialPopulation: partial.initialPopulation ?? denominator,
    denominator,
    denominatorExclusion: exclusion,
    denominatorException: exception,
    numerator,
    score: 'score' in partial ? (partial.score ?? null) : effective > 0 ? numerator / effective : null,
  }
}

function tally(measureId: string, groups: Partial<GroupTally>[]): MeasureTally {
  return {
    measureId,
    measureUrl: `http://spier.org/Measure/${measureId}`,
    title: measureId,
    groups: groups.map(group),
  }
}

describe('MEASURE_GAPS coverage', () => {
  // The whole point of the explanation is that it is specific to the measure.
  // A measure added in FSH should fail here rather than quietly rendering the
  // generic fallback copy.
  it('has an entry for every published Measure', () => {
    const missing = MEASURE_SPECS.map(s => s.id).filter(id => !(id in MEASURE_GAPS))
    expect(missing).toEqual([])
  })

  it('has no orphan entries', () => {
    const ids = new Set(MEASURE_SPECS.map(s => s.id))
    const orphans = Object.keys(MEASURE_GAPS).filter(id => !ids.has(id))
    expect(orphans).toEqual([])
  })

  it('never claims a number', () => {
    for (const [id, gap] of Object.entries(MEASURE_GAPS)) {
      expect(gap.denominator, id).not.toMatch(/\b\d+(\.\d+)?%/)
      expect(gap.issues.length, id).toBeGreaterThan(0)
    }
  })

  it('falls back to generic copy for an unknown measure', () => {
    expect(gapFor('SPiERNotAThing').missing).toMatch(/no patient in the demo registry/i)
  })
})

describe('emptinessOf', () => {
  it('explains nothing once any group computes', () => {
    const t = tally('SPiERRiskStatusDocumented', [{ denominator: 0 }, { denominator: 3, numerator: 2 }])
    expect(isComputed(t)).toBe(true)
    expect(emptinessOf(t, t)).toEqual({ kind: 'none' })
  })

  it('reports a structural gap when the measure is empty over every period', () => {
    const t = tally('SPiERRiskStatusDocumented', [{ denominator: 0 }])
    const result = emptinessOf(t, t)
    expect(result.kind).toBe('structural')
    if (result.kind === 'structural') {
      expect(result.gap).toBe(MEASURE_GAPS.SPiERRiskStatusDocumented)
    }
  })

  it('blames the window, not the data, when a wider period does compute', () => {
    const selected = tally('SPiERReferralCompletion', [{ denominator: 0 }])
    const widest = tally('SPiERReferralCompletion', [{ denominator: 4, numerator: 3 }])
    expect(emptinessOf(selected, widest)).toEqual({ kind: 'window' })
  })

  // A fully-excluded cohort also renders "no denominator", but it is a real
  // measurement rather than absent data — saying "the registry seeds none"
  // there would be false.
  it('distinguishes a fully-excluded cohort from an empty one', () => {
    const t = tally('SPiERFollowUpTimeliness', [
      { denominator: 2, denominatorExclusion: 2, numerator: 0 },
    ])
    expect(t.groups[0].score).toBeNull()
    expect(emptinessOf(t, t)).toEqual({ kind: 'all-excluded' })
  })
})
