import { describe, expect, it } from 'vitest'
import { formatDaysAgo } from './relativeTime'

// Build an ISO timestamp `n` days before now. A sub-millisecond elapse between
// this and Date.now() inside the function only ever rounds *up* toward n, so
// floor(...) still lands on n — boundaries stay stable.
function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

describe('formatDaysAgo', () => {
  it('says Today for the current day', () => {
    expect(formatDaysAgo(daysAgoIso(0))).toBe('Today')
  })

  it('uses singular for one unit, plural otherwise', () => {
    expect(formatDaysAgo(daysAgoIso(1))).toBe('1 day ago')
    expect(formatDaysAgo(daysAgoIso(3))).toBe('3 days ago')
    expect(formatDaysAgo(daysAgoIso(7))).toBe('1 week ago')
    expect(formatDaysAgo(daysAgoIso(14))).toBe('2 weeks ago')
    expect(formatDaysAgo(daysAgoIso(30))).toBe('1 month ago')
    expect(formatDaysAgo(daysAgoIso(90))).toBe('3 months ago')
  })

  it('crosses unit boundaries at 7 and 30 days', () => {
    expect(formatDaysAgo(daysAgoIso(6))).toBe('6 days ago')
    expect(formatDaysAgo(daysAgoIso(13))).toBe('1 week ago')
    expect(formatDaysAgo(daysAgoIso(29))).toBe('4 weeks ago')
  })
})
