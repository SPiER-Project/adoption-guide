import { describe, expect, it } from 'vitest'
import { CASELOAD_VIEWS, DEFAULT_DIR, sortRows, viewById, type SortCol } from './caseloadViews'
import { COLUMNS } from '../components/caseloadColumns'
import type { DerivedRegistryRow } from '@spier/core/lib/registry'

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
    lastAssessment: null,
    // A row fixture must carry every field, so the cast below is gone: an added
    // DerivedRegistryRow field should fail the typecheck here, not blow up at
    // runtime the way `as DerivedRegistryRow` let it.
    reassessment: { kind: 'no-cadence', reason: 'test fixture' },
    ...over,
  }
}

const visit = (date: string) => ({ date, status: 'booked', provider: null })

describe('sortRows', () => {
  it('puts highest risk first in the risk column default direction', () => {
    const rows = [
      row({ id: 'low', currentRiskLevel: 'low' }),
      row({ id: 'acute', currentRiskLevel: 'acute' }),
      row({ id: 'moderate', currentRiskLevel: 'moderate' }),
    ]
    expect(sortRows(rows, { col: 'risk', dir: DEFAULT_DIR.risk }).map(r => r.id)).toEqual([
      'acute',
      'moderate',
      'low',
    ])
  })

  it('puts the soonest visit first in the nextVisit default direction', () => {
    const rows = [
      row({ id: 'late', nextAppointment: visit('2026-09-01') }),
      row({ id: 'soon', nextAppointment: visit('2026-08-12') }),
    ]
    expect(sortRows(rows, { col: 'nextVisit', dir: DEFAULT_DIR.nextVisit }).map(r => r.id)).toEqual([
      'soon',
      'late',
    ])
  })

  it('keeps undated rows last in BOTH directions', () => {
    // "No visit booked" is not "the most overdue visit". Flipping the sort must
    // never promote a missing value to the top, in either nullable column.
    const nullableCols: Array<{ col: SortCol; rows: DerivedRegistryRow[] }> = [
      {
        col: 'nextVisit',
        rows: [
          row({ id: 'none' }),
          row({ id: 'a', nextAppointment: visit('2026-08-12') }),
          row({ id: 'b', nextAppointment: visit('2026-09-01') }),
        ],
      },
      {
        col: 'activity',
        rows: [
          row({ id: 'none' }),
          row({ id: 'a', lastActivity: { label: 'x', date: '2026-08-01' } }),
          row({ id: 'b', lastActivity: { label: 'y', date: '2026-08-05' } }),
        ] as DerivedRegistryRow[],
      },
    ]
    for (const { col, rows } of nullableCols) {
      expect(sortRows(rows, { col, dir: 'asc' }).at(-1)!.id, `${col} asc`).toBe('none')
      expect(sortRows(rows, { col, dir: 'desc' }).at(-1)!.id, `${col} desc`).toBe('none')
    }
  })

  it('reverses when the direction is not the default', () => {
    const rows = [
      row({ id: 'acute', currentRiskLevel: 'acute' }),
      row({ id: 'low', currentRiskLevel: 'low' }),
    ]
    expect(sortRows(rows, { col: 'risk', dir: 'asc' }).map(r => r.id)).toEqual(['low', 'acute'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'b', displayName: 'B' }), row({ id: 'a', displayName: 'A' })]
    sortRows(rows, { col: 'patient', dir: 'asc' })
    expect(rows.map(r => r.id)).toEqual(['b', 'a'])
  })
})

describe('CASELOAD_VIEWS', () => {
  it('gives every view a sort column that view actually renders', () => {
    // A table sorted by an invisible column is a table nobody can tell is
    // sorted, so a view's default sort must name one of its own columns.
    // The available sort columns are read from COLUMNS rather than restated
    // here: a hand-copied map is the thing that drifts, and it did — this test
    // failed on its own hardcoded list the first time a view was added.
    for (const view of CASELOAD_VIEWS) {
      const available = view.columns
        .map(k => COLUMNS[k]?.sortCol)
        .filter((c): c is SortCol => c !== undefined)
      expect(available, `${view.id} default sort`).toContain(view.defaultSort.col)
    }
  })

  it('names only columns that exist in the registry', () => {
    // A typo'd column key renders one fewer column rather than crashing, which
    // is deliberate but silent — so it is caught here instead.
    for (const view of CASELOAD_VIEWS) {
      for (const key of view.columns) {
        expect(COLUMNS[key], `${view.id} column "${key}"`).toBeDefined()
      }
    }
  })

  it('gives every view a unique id and a description', () => {
    const ids = CASELOAD_VIEWS.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const v of CASELOAD_VIEWS) expect(v.description.length).toBeGreaterThan(0)
  })
})

describe('viewById', () => {
  it('falls back to the first view for an unknown id', () => {
    // A stale saved view id must not blank the table.
    expect(viewById('nope')).toBe(CASELOAD_VIEWS[0])
  })

  it('finds a known view', () => {
    expect(viewById('follow-up').id).toBe('follow-up')
  })
})
