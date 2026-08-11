import { describe, expect, it } from 'vitest'
import { positiveItem9OnDay, riskCountsOf, summaryTiles, tierCensus } from './populationSummary'
import type { DerivedRegistryRow } from './registry'
import type { PatientSlice } from '../types/fhir'

function row(over: Partial<DerivedRegistryRow> = {}): DerivedRegistryRow {
  return {
    id: 'p',
    displayName: 'P',
    dob: '1990-01-15',
    mrn: '1',
    gender: 'Female',
    recommendedNextStep: { stageId: 's', label: 'l', rationale: 'r' },
    currentStage: null,
    completedStages: [],
    currentRiskLevel: 'low',
    lastActivity: null,
    episodeOpen: false,
    episodeTier: null,
    openTaskCount: 0,
    overdueTaskCount: 0,
    nextTaskDue: null,
    nextAppointment: null,
    noShowCount: 0,
    awaitingNoShowFollowUp: false,
    unreachedStreak: 0,
    openReferralCount: 0,
    ...over,
  } as DerivedRegistryRow
}

const EMPTY: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
  episodes: [],
  flags: [],
  tasks: [],
}

const NOW = new Date('2026-08-11T12:00:00Z')

function tiles(rows: DerivedRegistryRow[], slices: PatientSlice[] = []) {
  return summaryTiles({
    rows,
    slices,
    counts: riskCountsOf(rows),
    alertCount: 0,
    now: NOW,
  })
}

function tile(rows: DerivedRegistryRow[], id: string) {
  return tiles(rows).find(t => t.id === id)!
}

describe('summaryTiles', () => {
  it('never renders a blocked tile as a value', () => {
    // The whole point of the type split: a tile SPiER cannot compute must not
    // reach the page as a number, because "0 overdue" reads as an all-clear.
    const blocked = tiles([row()]).filter(t => t.state === 'blocked')
    expect(blocked.map(t => t.id)).toEqual([
      'historical-risk',
      'cssrs-due',
      'plans-needing-update',
      'consults-overdue',
    ])
    for (const t of blocked) expect(t.waitingOn).toBeTruthy()
  })

  it('counts only patients with an open episode as on the pathway', () => {
    const rows = [row({ episodeOpen: true }), row({ episodeOpen: true }), row()]
    expect(tile(rows, 'on-pathway')).toMatchObject({ state: 'value', value: '2' })
  })

  it('folds acute into the high-risk band, because the deck has no level above High', () => {
    const rows = [row({ currentRiskLevel: 'acute' }), row({ currentRiskLevel: 'high' }), row()]
    expect(tile(rows, 'high-risk')).toMatchObject({ state: 'value', value: '2 · 67%' })
  })

  it('flags the high-risk tile as breached above the deck’s 5% target', () => {
    const rows = [row({ currentRiskLevel: 'high' }), ...Array.from({ length: 9 }, () => row())]
    expect(tile(rows, 'high-risk')).toMatchObject({ breached: true })
  })

  it('does not flag a breach at exactly zero high-risk patients', () => {
    expect(tile([row(), row()], 'high-risk')).toMatchObject({ breached: false })
  })

  it('does not divide by zero on an empty caseload', () => {
    expect(tile([], 'high-risk')).toMatchObject({ state: 'value', value: '0 · —' })
  })
})

describe('tierCensus', () => {
  it('omits tiers with no patients and shares sum to the whole', () => {
    const rows = [row({ currentRiskLevel: 'high' }), row({ currentRiskLevel: 'low' }), row({ currentRiskLevel: 'low' })]
    const census = tierCensus(riskCountsOf(rows), rows.length)
    expect(census.map(c => c.level)).toEqual(['high', 'low'])
    expect(census.reduce((n, c) => n + c.share, 0)).toBeCloseTo(1)
  })

  it('orders highest risk first', () => {
    const rows = [
      row({ currentRiskLevel: 'none' }),
      row({ currentRiskLevel: 'acute' }),
      row({ currentRiskLevel: 'moderate' }),
    ]
    expect(tierCensus(riskCountsOf(rows), rows.length).map(c => c.level)).toEqual([
      'acute',
      'moderate',
      'none',
    ])
  })

  it('is empty rather than NaN-shared for an empty caseload', () => {
    expect(tierCensus(riskCountsOf([]), 0)).toEqual([])
  })
})

describe('positiveItem9OnDay', () => {
  const item9 = (value: number, when: string) => ({
    ...EMPTY,
    observations: [
      {
        resourceType: 'Observation',
        id: 'o',
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '44260-8' }] },
        effectiveDateTime: when,
        valueInteger: value,
      },
    ],
  }) as unknown as PatientSlice

  it('counts any endorsement, not just severe ones', () => {
    // Item 9 is positive at 1, 2 or 3 — the same threshold the Clarify Risk
    // PlanDefinition trigger uses.
    expect(positiveItem9OnDay([item9(1, '2026-08-11T09:00:00Z')], NOW)).toBe(1)
    expect(positiveItem9OnDay([item9(3, '2026-08-11T09:00:00Z')], NOW)).toBe(1)
  })

  it('does not count a zero answer', () => {
    expect(positiveItem9OnDay([item9(0, '2026-08-11T09:00:00Z')], NOW)).toBe(0)
  })

  it('is scoped to the day, not the trailing 24 hours', () => {
    expect(positiveItem9OnDay([item9(2, '2026-08-10T23:00:00Z')], NOW)).toBe(0)
  })

  it('ignores observations with other codes', () => {
    const other = {
      ...EMPTY,
      observations: [
        {
          resourceType: 'Observation',
          id: 'o',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '44250-9' }] },
          effectiveDateTime: '2026-08-11T09:00:00Z',
          valueInteger: 3,
        },
      ],
    } as unknown as PatientSlice
    expect(positiveItem9OnDay([other], NOW)).toBe(0)
  })
})
