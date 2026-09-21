import { describe, expect, it } from 'vitest'
import { crosswalkedSourceSystems, tierForCoding, tierForCodings } from './conceptCrosswalk'
import { RISK_TIER_SYSTEM } from './riskEpisode'

const CS = 'http://thespierproject.org/fhir/CodeSystem'

describe('conceptCrosswalk — the published ConceptMaps, read as data', () => {
  it('reads a real set of maps, so nothing below passes vacuously', () => {
    // ⚠️ A reader whose glob stops matching returns an empty index and every
    // lookup below then yields `undefined` — which reads as "this instrument
    // has no crosswalk" rather than as a build problem. The floor is the only
    // thing that can tell those apart.
    const systems = crosswalkedSourceSystems()
    expect(systems.length).toBeGreaterThanOrEqual(4)
    expect(systems).toContain(`${CS}/cssrs-risk-level`)
    expect(systems).toContain(`${CS}/asq-screening-result`)
  })

  it('translates each instrument’s own result into the harmonized tier', () => {
    // These are the rows crosswalk-*.fsh publishes; nothing is written in
    // TypeScript, so a row changed in FSH changes this answer.
    expect(tierForCoding({ system: `${CS}/cssrs-risk-level`, code: 'moderate' })).toBe('moderate')
    expect(tierForCoding({ system: `${CS}/cssrs-risk-level`, code: 'none' })).toBe('no-risk')
    expect(tierForCoding({ system: `${CS}/asq-screening-result`, code: 'acute-positive' })).toBe('imminent')
    expect(tierForCoding({ system: `${CS}/bssa-disposition`, code: 'further-evaluation-necessary' })).toBe('high')
  })

  it('passes a coding that is ALREADY the harmonized tier straight through', () => {
    expect(tierForCoding({ system: RISK_TIER_SYSTEM, code: 'high' })).toBe('high')
  })

  it('never reads a map that runs the other way', () => {
    // ⚠️ SPiERRiskTierToLOINC maps a tier ONTO a LOINC answer code, and its
    // SOURCE is the tier vocabulary. Indexing it would put
    // `spier-suicide-risk-tier|low → LA9194-7` in the table, and a caller that
    // did not short-circuit on the tier system would get a LOINC answer code
    // back where a tier belongs. Asserted on the source list rather than on a
    // lookup, because the short-circuit hides the poisoned row from every
    // lookup — which is exactly how this would ship unnoticed.
    expect(crosswalkedSourceSystems()).not.toContain(RISK_TIER_SYSTEM)
    expect(tierForCoding({ system: 'http://loinc.org', code: 'LA9194-7' })).toBeUndefined()
  })

  it('yields nothing for a vocabulary no published map covers', () => {
    expect(tierForCoding({ system: 'http://example.org/made-up', code: 'severe' })).toBeUndefined()
    expect(tierForCoding({ code: 'high' })).toBeUndefined()
    expect(tierForCoding(undefined)).toBeUndefined()
  })

  it('takes the first coding that yields a tier', () => {
    expect(
      tierForCodings([
        { system: 'http://example.org/made-up', code: 'severe' },
        { system: `${CS}/pss3-result`, code: 'positive' },
      ]),
    ).toBe('moderate')
    expect(tierForCodings([])).toBeUndefined()
    expect(tierForCodings(undefined)).toBeUndefined()
  })
})
