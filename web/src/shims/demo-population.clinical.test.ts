import { describe, it, expect } from 'vitest'
import * as real from '@spier/demo-population'
import * as shim from './demo-population.clinical'

/**
 * The clinical shim must offer exactly what the real barrel offers, so the
 * alias swap in vite.config.ts is invisible to every importer — and it must
 * offer nobody.
 */
describe('demo-population clinical shim', () => {
  it('exports the same names as the real barrel', () => {
    expect(Object.keys(shim).sort()).toEqual(Object.keys(real).sort())
  })
  it('contains no patient', () => {
    expect(shim.POPULATION_PATIENTS).toHaveLength(0)
    expect(shim.POPULATION_BY_ID.size).toBe(0)
    expect(Object.keys(shim.POPULATION_SCENARIOS)).toHaveLength(0)
    expect(shim.isAllowedPatientId(real.POPULATION_PATIENTS[0]!.id)).toBe(false)
  })
  it('is only reached on a clinical build — the tests run the demo surface', () => {
    expect(real.POPULATION_PATIENTS.length).toBeGreaterThan(0)
  })
})
