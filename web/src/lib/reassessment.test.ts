import { describe, expect, it } from 'vitest'
import {
  DUE_SOON_DAYS,
  REASSESSMENT_INTERVAL_DAYS,
  intervalDaysForLevel,
  reassessmentState,
  reassessmentStatusLabel,
  tierCodeForLevel,
} from './reassessment'

const NOW = new Date('2026-08-11T12:00:00Z')

describe('REASSESSMENT_INTERVAL_DAYS', () => {
  it('is read from the published PlanDefinition, not hardcoded here', () => {
    // The deck's table: High 7 / Moderate 14 / Low 30. If this fails, either the
    // FSH changed (update the deck reference) or the reader broke.
    expect(REASSESSMENT_INTERVAL_DAYS).toEqual({ high: 7, moderate: 14, low: 30 })
  })

  it('publishes no cadence for imminent or no-risk', () => {
    // Deliberate: imminent risk is escalation, not a routine schedule, and a
    // no-risk patient is not on the pathway. check-reassessment.mjs enforces it
    // at the artifact level; this pins the app-side consequence.
    expect(REASSESSMENT_INTERVAL_DAYS.imminent).toBeUndefined()
    expect(REASSESSMENT_INTERVAL_DAYS['no-risk']).toBeUndefined()
  })
})

describe('tierCodeForLevel', () => {
  it('translates the app’s "acute" to the concept layer’s "imminent"', () => {
    // The one place the two vocabularies differ. Getting this backwards would
    // give acute patients the high-risk cadence.
    expect(tierCodeForLevel('acute')).toBe('imminent')
    expect(tierCodeForLevel('high')).toBe('high')
    expect(tierCodeForLevel('none')).toBe('no-risk')
  })
})

describe('intervalDaysForLevel', () => {
  it('maps app levels through to published intervals', () => {
    expect(intervalDaysForLevel('high')).toBe(7)
    expect(intervalDaysForLevel('moderate')).toBe(14)
    expect(intervalDaysForLevel('low')).toBe(30)
  })

  it('returns null for the tiers with no cadence', () => {
    expect(intervalDaysForLevel('acute')).toBeNull()
    expect(intervalDaysForLevel('none')).toBeNull()
  })
})

describe('reassessmentState', () => {
  it('reports no cadence for acute, with a reason', () => {
    const s = reassessmentState('acute', '2026-08-01', NOW)
    expect(s.kind).toBe('no-cadence')
    if (s.kind === 'no-cadence') expect(s.reason).toMatch(/escalation/)
  })

  it('reports no baseline when the tier has a cadence but nothing to count from', () => {
    const s = reassessmentState('high', null, NOW)
    expect(s).toEqual({ kind: 'no-baseline', intervalDays: 7 })
  })

  it('treats an unparseable last-assessment date as no baseline', () => {
    // Better than producing an Invalid Date due date that renders as "NaN".
    expect(reassessmentState('high', 'not-a-date', NOW).kind).toBe('no-baseline')
  })

  it('adds the tier’s interval to the last assessment', () => {
    const s = reassessmentState('high', '2026-08-04T09:00:00Z', NOW)
    expect(s.kind).toBe('scheduled')
    if (s.kind === 'scheduled') {
      expect(s.dueDate).toBe('2026-08-11')
      expect(s.intervalDays).toBe(7)
    }
  })

  it('uses the tier’s own interval, not a single global one', () => {
    const low = reassessmentState('low', '2026-08-04T09:00:00Z', NOW)
    const moderate = reassessmentState('moderate', '2026-08-04T09:00:00Z', NOW)
    if (low.kind === 'scheduled') expect(low.dueDate).toBe('2026-09-03')
    if (moderate.kind === 'scheduled') expect(moderate.dueDate).toBe('2026-08-18')
  })

  it('calls the due date itself "due-today", not "overdue"', () => {
    const s = reassessmentState('high', '2026-08-04T09:00:00Z', NOW)
    if (s.kind === 'scheduled') {
      expect(s.status).toBe('due-today')
      expect(s.daysUntilDue).toBe(0)
    }
  })

  it('compares calendar dates, so a due date later today is still due today', () => {
    // The last assessment was at 09:00 and "now" is 12:00, so a 7-day interval
    // lands at 09:00 today — already past by the clock. Subtracting instants
    // would call this overdue by 0 days, which renders as nonsense.
    const s = reassessmentState('high', '2026-08-04T09:00:00Z', new Date('2026-08-11T23:59:00Z'))
    if (s.kind === 'scheduled') expect(s.status).toBe('due-today')
  })

  it('reports overdue with a positive day count in the label', () => {
    const s = reassessmentState('high', '2026-08-01T09:00:00Z', NOW)
    expect(s.kind).toBe('scheduled')
    if (s.kind === 'scheduled') {
      expect(s.status).toBe('overdue')
      expect(s.daysUntilDue).toBe(-3)
    }
    expect(reassessmentStatusLabel(s)).toBe('Overdue by 3 days')
  })

  it('marks the 48-hour window as due-soon and nothing beyond it', () => {
    const soon = reassessmentState('high', '2026-08-06T09:00:00Z', NOW) // due 08-13, +2
    const later = reassessmentState('high', '2026-08-07T09:00:00Z', NOW) // due 08-14, +3
    if (soon.kind === 'scheduled') {
      expect(soon.daysUntilDue).toBe(DUE_SOON_DAYS)
      expect(soon.status).toBe('due-soon')
    }
    if (later.kind === 'scheduled') expect(later.status).toBe('scheduled')
  })

  it('singularises the day count at exactly one', () => {
    const s = reassessmentState('high', '2026-08-03T09:00:00Z', NOW) // due 08-10, -1
    expect(reassessmentStatusLabel(s)).toBe('Overdue by 1 day')
  })
})

describe('reassessmentStatusLabel', () => {
  it('has a label for every state kind', () => {
    expect(reassessmentStatusLabel({ kind: 'no-cadence', reason: 'x' })).toBe('No routine cadence')
    expect(reassessmentStatusLabel({ kind: 'no-baseline', intervalDays: 7 })).toBe(
      'No assessment on record',
    )
    expect(reassessmentStatusLabel(reassessmentState('high', '2026-08-04T09:00:00Z', NOW))).toBe(
      'Due today',
    )
  })
})
