/**
 * The demo population reads the same on any day.
 *
 * The scenario files are dated against `SCENARIO_ANCHOR`; the Workers serve them
 * `populationScenariosAsOf(today)`. The claim worth testing is the one a
 * presenter relies on: every patient's reassessment state — overdue by 3, due in
 * 2, no baseline — is the one it was designed to show, whatever the calendar
 * says. It is checked against the real registry derivation over all 14 slices,
 * not against a hand-built one, because a slice shaped to agree would prove
 * nothing about the fixtures that drifted (patient-001 read 59 days overdue on
 * 2026-10-06, designed as 3).
 */
import { describe, expect, it } from 'vitest'
import { deriveRegistryRow } from '@spier/core/lib/registry'
import {
  POPULATION_PATIENTS as PATIENTS,
  POPULATION_SCENARIOS,
  SCENARIO_ANCHOR,
  daysSinceAnchor,
  populationScenariosAsOf,
  shiftDates,
} from '@spier/demo-population'

/** Noon UTC, `days` after the anchor. */
const dayAfterAnchor = (days: number) =>
  new Date(Date.parse(`${SCENARIO_ANCHOR}T12:00:00Z`) + days * 86_400_000)

/** The reassessment state with its calendar date dropped — the date SHOULD move. */
function stateOf(id: string, slices: typeof POPULATION_SCENARIOS, now: Date) {
  const patient = PATIENTS.find(p => p.id === id)
  if (!patient) throw new Error(`no demo patient ${id}`)
  const { reassessment } = deriveRegistryRow(patient, slices[id], now)
  if (reassessment.kind !== 'scheduled') return reassessment
  const { dueDate: _moves, ...rest } = reassessment
  return rest
}

describe('populationScenariosAsOf', () => {
  const ids = Object.keys(POPULATION_SCENARIOS).sort()

  it('holds all 14 scenarios — an empty set would pass everything below', () => {
    expect(ids).toHaveLength(14)
  })

  it.each([0, 1, 56, 400])('shows every patient in its anchor-day state %i days after the anchor', days => {
    const now = dayAfterAnchor(days)
    for (const id of ids) {
      expect(stateOf(id, populationScenariosAsOf(now), now), id)
        .toEqual(stateOf(id, POPULATION_SCENARIOS, dayAfterAnchor(0)))
    }
  })

  /**
   * The state each patient shows on ANY day, pinned so a change to one is a
   * decision rather than a side effect. 001 is the demo's red case (overdue by
   * 3) and 006 its amber one (due within 48 hours); both lost those states when
   * the caseload row began reading the harmonized tier (2026-09-21), and were
   * re-dated 7 days earlier on 2026-10-06 to get them back. ⚠️ 003 (designed
   * no-baseline) and 008 (designed ~2 weeks) still differ from their design.
   */
  const SERVED_STATES: Record<string, Record<string, unknown>> = {
    'patient-001': { kind: 'scheduled', intervalDays: 14, status: 'overdue', daysUntilDue: -3 },
    'patient-002': { kind: 'no-cadence' },
    'patient-003': { kind: 'scheduled', intervalDays: 30, status: 'scheduled', daysUntilDue: 30 },
    'patient-004': { kind: 'scheduled', intervalDays: 14, status: 'due-today', daysUntilDue: 0 },
    'patient-005': { kind: 'no-cadence' },
    'patient-006': { kind: 'scheduled', intervalDays: 14, status: 'due-soon', daysUntilDue: 2 },
    'patient-007': { kind: 'no-baseline', intervalDays: 14 },
    'patient-008': { kind: 'scheduled', intervalDays: 30, status: 'scheduled', daysUntilDue: 6 },
    'patient-009': { kind: 'scheduled', intervalDays: 7, status: 'overdue', daysUntilDue: -6 },
    'patient-010': { kind: 'scheduled', intervalDays: 30, status: 'scheduled', daysUntilDue: 12 },
    'patient-011': { kind: 'scheduled', intervalDays: 7, status: 'overdue', daysUntilDue: -2 },
    'patient-012': { kind: 'no-cadence' },
    'patient-013': { kind: 'no-cadence' },
    'patient-014': { kind: 'no-cadence' },
  }

  it('serves each patient in its pinned state, on the day the drift was reported', () => {
    const now = new Date('2026-10-06T15:00:00Z')
    const served = populationScenariosAsOf(now)
    expect(Object.keys(SERVED_STATES).sort()).toEqual(ids)
    for (const id of ids) expect(stateOf(id, served, now), id).toMatchObject(SERVED_STATES[id])
  })

  it('serves nothing that already happened in the future, even at midnight UTC', () => {
    // The anchor-day QR is the latest dated thing in the population; served at
    // the first instant of a day, it must not be ahead of that instant.
    const midnight = new Date('2026-10-06T00:00:00.000Z')
    const qr = populationScenariosAsOf(midnight)['patient-003'].responses[0].resource
    expect(Date.parse(qr.authored ?? '')).toBeLessThanOrEqual(midnight.getTime())
  })
})

describe('shiftDates', () => {
  it('moves dates and dateTimes by whole days, keeping each form', () => {
    expect(shiftDates({ a: '2026-08-11', b: '2026-08-11T09:30:00.000Z' }, 56)).toEqual({
      a: '2026-10-06',
      b: '2026-10-06T09:30:00.000Z',
    })
  })

  it('leaves a date inside prose alone — which is why check:dates fails one', () => {
    expect(shiftDates('seen 2026-03-20', 56)).toBe('seen 2026-03-20')
  })

  it('counts UTC calendar days, so the served day turns over at UTC midnight', () => {
    expect(daysSinceAnchor(new Date(`${SCENARIO_ANCHOR}T23:59:59Z`))).toBe(0)
    expect(daysSinceAnchor(new Date('2026-08-12T00:00:00Z'))).toBe(1)
    expect(daysSinceAnchor(new Date('2026-10-06T12:00:00Z'))).toBe(56)
  })
})
