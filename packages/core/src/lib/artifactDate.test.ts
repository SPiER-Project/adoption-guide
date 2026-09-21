import { describe, expect, it } from 'vitest'
import { bestArtifactDate, shortDate } from './artifactDate'

describe('bestArtifactDate — one answer to "when was this recorded"', () => {
  it('prefers a resource’s own clinical time over when it was written down', () => {
    expect(
      bestArtifactDate({ effectiveDateTime: '2026-09-03T10:00:00Z', created: '2026-09-04T10:00:00Z' }),
    ).toBe('2026-09-03T10:00:00Z')
  })

  it('reads the fields the pathway evaluator actually meets', () => {
    // A crisis-resources Communication, a safety-plan CarePlan and a
    // means-safety Procedure — the three artifacts that retire an obligation.
    expect(bestArtifactDate({ sent: '2026-09-03T10:00:00Z' })).toBe('2026-09-03T10:00:00Z')
    expect(bestArtifactDate({ created: '2026-09-03T10:00:00Z' })).toBe('2026-09-03T10:00:00Z')
    expect(bestArtifactDate({ performedDateTime: '2026-09-03T10:00:00Z' })).toBe('2026-09-03T10:00:00Z')
  })

  it('falls back to the server’s own stamp before going undated', () => {
    expect(bestArtifactDate({ meta: { lastUpdated: '2026-09-03T10:00:00Z' } })).toBe('2026-09-03T10:00:00Z')
    expect(bestArtifactDate({})).toBeUndefined()
  })
})

describe('shortDate — the same words on every machine', () => {
  const now = new Date('2026-09-21T12:00:00.000Z')

  it('spells a date in this year without the year', () => {
    expect(shortDate('2026-09-03T10:00:00.000Z', now)).toBe('Sep 3')
  })

  it('keeps the year on a date from another one', () => {
    expect(shortDate('2025-12-30T10:00:00.000Z', now)).toBe('Dec 30, 2025')
  })

  it('returns null rather than "Invalid Date"', () => {
    expect(shortDate('not a date', now)).toBeNull()
    expect(shortDate(undefined, now)).toBeNull()
  })
})
