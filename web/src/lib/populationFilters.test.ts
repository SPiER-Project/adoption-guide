import { describe, expect, it } from 'vitest'
import { AGE_BANDS, ageOf, bandOf, matchesAgeBand } from './populationFilters'

describe('ageOf', () => {
  it('counts whole years', () => {
    expect(ageOf('1990-01-15', new Date('2026-08-11T00:00:00Z'))).toBe(36)
  })

  it('does not credit a birthday that has not happened yet this year', () => {
    // The ms-division shortcut gets this wrong, and the boundary is clinical:
    // under-18 selects the ASQ and the pediatric C-SSRS.
    expect(ageOf('2008-12-31', new Date('2026-08-11T00:00:00Z'))).toBe(17)
    expect(ageOf('2008-08-12', new Date('2026-08-11T00:00:00Z'))).toBe(17)
  })

  it('credits the birthday on the day itself', () => {
    expect(ageOf('2008-08-11', new Date('2026-08-11T00:00:00Z'))).toBe(18)
  })

  it('handles a leap-day birth without drifting', () => {
    expect(ageOf('2004-02-29', new Date('2026-02-28T00:00:00Z'))).toBe(21)
    expect(ageOf('2004-02-29', new Date('2026-03-01T00:00:00Z'))).toBe(22)
  })

  it('returns null for an unparseable or future date', () => {
    expect(ageOf('not-a-date')).toBeNull()
    expect(ageOf('2030-01-01', new Date('2026-08-11T00:00:00Z'))).toBeNull()
  })
})

describe('bandOf', () => {
  it('places each boundary age in exactly one band', () => {
    // Every age from 0 to 120 must match one band and only one, or a filter
    // silently hides patients.
    for (let age = 0; age <= 120; age++) {
      const matching = AGE_BANDS.filter(b => age >= b.min && (b.max === undefined || age <= b.max))
      expect(matching, `age ${age}`).toHaveLength(1)
    }
  })

  it('maps the pediatric boundary to the under-18 band', () => {
    expect(bandOf(17)?.value).toBe('under-18')
    expect(bandOf(18)?.value).toBe('18-24')
  })

  it('returns null for an unknown age', () => {
    expect(bandOf(null)).toBeNull()
  })
})

describe('matchesAgeBand', () => {
  it('matches the band the patient falls in', () => {
    expect(matchesAgeBand('1990-01-15', '25-44', new Date('2026-08-11T00:00:00Z'))).toBe(true)
    expect(matchesAgeBand('1990-01-15', '45-64', new Date('2026-08-11T00:00:00Z'))).toBe(false)
  })

  it('matches no band when the date of birth is unusable', () => {
    // A broken record is hidden by an active filter rather than appearing in
    // every band, which would make the counts wrong in five places at once.
    for (const b of AGE_BANDS) expect(matchesAgeBand('garbage', b.value)).toBe(false)
  })
})
