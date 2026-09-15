import { describe, it, expect } from 'vitest'
import { todayLocalIso, nowLocalIso, toIsoOrNow, isoDay, formatDate, formatDateTime } from './dates'

describe('workflow date helpers', () => {
  // 23:30 local on the 15th — the case toISOString() gets wrong east of UTC.
  const lateEvening = new Date(2026, 8, 15, 23, 30)

  it('todayLocalIso uses the local calendar date, zero-padded', () => {
    expect(todayLocalIso(lateEvening)).toBe('2026-09-15')
    expect(todayLocalIso(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('nowLocalIso is the datetime-local input shape', () => {
    expect(nowLocalIso(lateEvening)).toBe('2026-09-15T23:30')
  })

  it('toIsoOrNow parses a datetime-local value to a UTC instant', () => {
    const iso = toIsoOrNow('2026-09-15T23:30')
    expect(iso).toBe(new Date(2026, 8, 15, 23, 30).toISOString())
  })

  it('toIsoOrNow falls back to now for an empty or garbage value', () => {
    const now = new Date('2026-09-15T12:00:00Z')
    expect(toIsoOrNow('', now)).toBe('2026-09-15T12:00:00.000Z')
    expect(toIsoOrNow('not a date', now)).toBe('2026-09-15T12:00:00.000Z')
  })
})

describe('reading dates', () => {
  it('isoDay takes the day off a FHIR dateTime and is empty for nothing', () => {
    expect(isoDay('2026-09-15T23:30:00Z')).toBe('2026-09-15')
    expect(isoDay(undefined)).toBe('')
    expect(isoDay(null)).toBe('')
  })

  it('formatDate treats a date-only value as a calendar day, not UTC midnight', () => {
    // West of Greenwich, new Date('2026-09-15') rendered locally is Sep 14.
    expect(formatDate('2026-09-15')).toMatch(/Sep 15, 2026/)
  })

  it('formatDate and formatDateTime say — for nothing parseable', () => {
    for (const bad of ['', undefined, null, 'not a date']) {
      expect(formatDate(bad)).toBe('—')
      expect(formatDateTime(bad)).toBe('—')
    }
  })

  it('formatDateTime leads with the same date formatDate gives', () => {
    const iso = '2026-09-15T14:30:00'
    expect(formatDateTime(iso).startsWith(formatDate(iso))).toBe(true)
    expect(formatDateTime(iso)).toMatch(/\d{1,2}:\d{2}/)
  })
})
