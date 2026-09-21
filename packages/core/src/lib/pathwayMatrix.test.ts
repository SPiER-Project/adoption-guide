import { describe, it, expect } from 'vitest'
import { loadPathway, type PathwayAction } from './pathway'
import { buildTierMatrix } from './pathwayMatrix'
import { RISK_TIER_SYSTEM } from './riskEpisode'

/**
 * Two halves, as in pathway.test.ts.
 *
 * The first reads the PUBLISHED artifact and asserts the property the table
 * exists to show: the obligations every tier repeats are stated identically in
 * each, so the matrix draws each of them as ONE cell spanning all three tiers
 * — the source diagram's spanning row. ⚠️ A tier-specific sentence on one of
 * those obligations is a legitimate rendering (two cells, not a bug), so a
 * failure here means the artifact changed what it says, and the question is
 * whether that was meant. The FSH's note above the tier branch says the same.
 *
 * The second half builds tiers by hand and checks the folding rules on shapes
 * the artifact does not currently have.
 */

const tier = (code: string, children: PathwayAction[]): PathwayAction => ({
  id: `tier-${code}`,
  title: `${code} risk`,
  tier: { system: RISK_TIER_SYSTEM, code },
  documentation: [],
  conditions: [],
  triggers: [],
  children,
})

const obligation = (id: string, title: string, extra: Partial<PathwayAction> = {}): PathwayAction => ({
  id,
  title,
  documentation: [],
  conditions: [],
  triggers: [],
  children: [],
  ...extra,
})

describe('the published tier branch, as a matrix', () => {
  const rows = buildTierMatrix(loadPathway().tierBranch.tiers)
  const row = (title: RegExp) => {
    const r = rows.find(x => title.test(x.title))
    if (!r) throw new Error(`no row matching ${title}`)
    return r
  }

  it('has one row per distinct obligation, in the high tier\'s order', () => {
    expect(rows.map(r => r.title)).toEqual([
      'Share patient-facing crisis resources',
      'Complete a collaborative safety plan',
      'Reassess on the published cadence for this tier',
      'Ask the direct question at every contact',
      'STAT safety evaluation',
      'Missed-appointment outreach protocol',
    ])
  })

  it('draws the obligations every tier repeats as ONE cell spanning all three', () => {
    for (const r of [row(/crisis resources/), row(/Reassess on the published cadence/)]) {
      expect(r.cells).toHaveLength(1)
      expect(r.cells[0]).toMatchObject({ kind: 'owed', span: 3, tierCodes: ['low', 'moderate', 'high'] })
    }
  })

  it('draws the safety plan as one cell over moderate and high, and none at low', () => {
    const r = row(/collaborative safety plan/)
    expect(r.cells.map(c => c.kind)).toEqual(['none', 'owed'])
    expect(r.cells[1]).toMatchObject({ span: 2, tierCodes: ['moderate', 'high'] })
  })

  it('draws the high-risk-only protocol in the high column alone', () => {
    for (const r of [row(/direct question/), row(/STAT safety/), row(/Missed-appointment/)]) {
      expect(r.cells.map(c => c.kind)).toEqual(['none', 'none', 'owed'])
      expect(r.cells[2]).toMatchObject({ span: 1, tierCodes: ['high'] })
    }
  })

  it('carries each row\'s realization from the artifact, and spans add up to the tier count', () => {
    expect(row(/crisis resources/).definitionCanonical).toBe(
      'http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources',
    )
    expect(row(/Reassess/).definitionCanonical).toBe(
      'http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule',
    )
    expect(row(/STAT safety/).definitionCanonical).toBeUndefined()
    for (const r of rows) {
      const width = r.cells.reduce((n, c) => n + (c.kind === 'owed' ? c.span : 1), 0)
      expect(width).toBe(3)
    }
  })
})

describe('the folding rules', () => {
  it('splits a row where adjacent tiers say different things about one obligation', () => {
    const rows = buildTierMatrix([
      tier('low', [obligation('a', 'Do X', { description: 'plainly' })]),
      tier('moderate', [obligation('b', 'Do X', { description: 'plainly' })]),
      tier('high', [obligation('c', 'Do X', { description: 'urgently' })]),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].cells.map(c => (c.kind === 'owed' ? c.span : 0))).toEqual([2, 1])
  })

  it('does not span across a tier that lacks the obligation', () => {
    const rows = buildTierMatrix([
      tier('low', [obligation('a', 'Do X')]),
      tier('moderate', []),
      tier('high', [obligation('c', 'Do X')]),
    ])
    expect(rows[0].cells.map(c => c.kind)).toEqual(['owed', 'none', 'owed'])
  })

  it('compares documentation, not just the description', () => {
    const note = { label: 'Note', display: 'said once' }
    const rows = buildTierMatrix([
      tier('low', [obligation('a', 'Do X', { documentation: [note] })]),
      tier('high', [obligation('b', 'Do X', { documentation: [{ ...note, display: 'said differently' }] })]),
    ])
    expect(rows[0].cells.map(c => (c.kind === 'owed' ? c.span : 0))).toEqual([1, 1])
  })

  it('orders rows by the widest tier, then adds what it lacks', () => {
    const rows = buildTierMatrix([
      tier('low', [obligation('a', 'Only at low'), obligation('b', 'Everywhere')]),
      tier('high', [obligation('c', 'Everywhere'), obligation('d', 'Also at high'), obligation('e', 'High only')]),
    ])
    expect(rows.map(r => r.title)).toEqual(['Everywhere', 'Also at high', 'High only', 'Only at low'])
  })

  it('throws on a tier that owes the same obligation twice', () => {
    expect(() =>
      buildTierMatrix([tier('low', [obligation('a', 'Do X'), obligation('b', 'Do X')])]),
    ).toThrow(/lists "Do X" 2 times/)
  })

  it('throws on no tiers rather than drawing an empty table', () => {
    expect(() => buildTierMatrix([])).toThrow(/no tier groups/)
  })
})
