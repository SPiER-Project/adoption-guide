import { describe, expect, it } from 'vitest'
import { crosswalkedSourceSystems, routePrecision, tierForCoding, tierForCodings, tierRoute } from './conceptCrosswalk'
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

describe('tierRoute / routePrecision — each route’s fidelity, read from the maps (#264)', () => {
  it('summarizes a route by its LOSSIEST row, and names the rows that earn it', () => {
    // C-SSRS is exact for none / low / moderate and related-to for high, so the
    // route is not exact — and `high` is the row a reader has to be told about.
    const cssrs = tierRoute(`${CS}/cssrs-risk-level`)
    expect(cssrs?.kind).toBe('crosswalk')
    const { precision, inexact } = routePrecision(cssrs!)
    expect(precision).toBe('approximate')
    expect(inexact.map(r => r.source.code)).toEqual(['high'])
  })

  it('calls a route that widens any row widened, not approximate', () => {
    const cams = routePrecision(tierRoute(`${CS}/cams-ssf-overall-risk`)!)
    expect(cams.precision).toBe('widened')
    expect(cams.inexact).toHaveLength(5)
  })

  it('carries the map’s draft status, which is how the IG marks pending sign-off', () => {
    const asq = tierRoute(`${CS}/asq-screening-result`)
    expect(asq).toMatchObject({ kind: 'crosswalk', draft: true })
  })

  it('calls the tier vocabulary itself native, and an unmapped system nothing', () => {
    expect(tierRoute(RISK_TIER_SYSTEM)).toEqual({ kind: 'native' })
    expect(routePrecision({ kind: 'native' }).precision).toBe('native')
    // Not a guess from a neighbour: a vocabulary no map lands on the tier has no route.
    expect(tierRoute(`${CS}/phq9-item9`)).toBeUndefined()
    expect(tierRoute(undefined)).toBeUndefined()
  })

  it('never reads the egress map (tier → LOINC) as a route into the tier', () => {
    // SPiERRiskTierToLOINC's source IS the tier system, and it has `wider` rows.
    // Read as a route, it would make SAFE-T look widened.
    expect(routePrecision(tierRoute(RISK_TIER_SYSTEM)!).precision).toBe('native')
  })
})
