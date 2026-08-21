// @vitest-environment jsdom
//
// This suite is about localStorage, so it needs a DOM. The repo default is the
// lighter `node` environment (see vitest.config.ts) and this docblock is the
// documented way to opt in, same as hooks/useScrollToHash.test.tsx.
import { describe, it, expect, beforeEach } from 'vitest'
import { LocalDataSource, resetLocalDemoData } from './localDataSource'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import type { StoredResponse } from '../../types/fhir'

/**
 * #301: seeding used to be once-only, so a browser that had opened the demo kept
 * its first fixture version forever — visible on the deployed site as relative
 * dates drifting further out with every re-anchor of the scenarios.
 *
 * The fix has two halves that pull against each other, which is why both are
 * tested here rather than just the happy path: an UNTOUCHED slice must refresh
 * when its fixture changes, and a slice the user has written to must never be
 * overwritten. Getting the second one wrong destroys a visitor's work, so the
 * tests below assert it from both directions — after a write, and for a slice
 * that predates the seed record entirely.
 */

const STORE_KEY = 'spier-patient-store'
const SEEDS_KEY = 'spier-scenario-seeds'
const PATIENT = 'patient-001'

/** A response shaped like one the user submitted, not one from a fixture. */
const userResponse: StoredResponse = {
  id: 'user-authored-1',
  questionnaireName: 'PHQ-9',
  completedAt: '2026-08-12T10:00:00.000Z',
  resource: {
    resourceType: 'QuestionnaireResponse',
    id: 'user-authored-1',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/PHQ-9',
  },
}

const readStore = () => JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}')
const readSeeds = () => JSON.parse(window.localStorage.getItem(SEEDS_KEY) ?? '{}')

/** Simulate a fixture change by corrupting the recorded fingerprint. */
const staleTheSeedRecord = () => {
  window.localStorage.setItem(SEEDS_KEY, JSON.stringify({ [PATIENT]: 'fingerprint-of-an-old-build' }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('seeding a fresh browser', () => {
  it('seeds from the scenario and records a fingerprint', () => {
    const source = new LocalDataSource()
    const slice = source.getSliceSync(PATIENT)

    expect(slice.responses.length).toBe(POPULATION_SCENARIOS[PATIENT].responses.length)
    expect(readSeeds()[PATIENT]).toBeTruthy()
  })

  it('does not reseed a slice whose fixture is unchanged', () => {
    new LocalDataSource().getSliceSync(PATIENT)
    const firstFingerprint = readSeeds()[PATIENT]

    // A second visit: same fixtures, so the recorded fingerprint still matches
    // and the stored slice is returned untouched.
    const second = new LocalDataSource()
    second.getSliceSync(PATIENT)
    expect(readSeeds()[PATIENT]).toBe(firstFingerprint)
  })
})

describe('an untouched slice refreshes when its fixture changes', () => {
  it('reseeds and re-records the new fingerprint', () => {
    new LocalDataSource().getSliceSync(PATIENT)
    // Pretend the stored slice came from an older build of the fixtures.
    const store = readStore()
    store[PATIENT] = { ...store[PATIENT], responses: [] }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
    staleTheSeedRecord()

    const slice = new LocalDataSource().getSliceSync(PATIENT)

    // Refreshed from the shipped scenario, not the stale copy.
    expect(slice.responses.length).toBe(POPULATION_SCENARIOS[PATIENT].responses.length)
    expect(readSeeds()[PATIENT]).not.toBe('fingerprint-of-an-old-build')
  })
})

describe('a slice the user has written to is never overwritten', () => {
  it('drops the seed record on write, so a later fixture change leaves it alone', async () => {
    const source = new LocalDataSource()
    source.getSliceSync(PATIENT)
    expect(readSeeds()[PATIENT]).toBeTruthy()

    await source.saveResponse(PATIENT, userResponse, null)
    // The slice is the user's now.
    expect(readSeeds()[PATIENT]).toBeUndefined()

    // A fixture refresh arrives; their submission must survive it.
    staleTheSeedRecord()
    window.localStorage.setItem(SEEDS_KEY, JSON.stringify({})) // no record at all
    const slice = new LocalDataSource().getSliceSync(PATIENT)
    expect(slice.responses.some(r => r.id === 'user-authored-1')).toBe(true)
  })

  it('leaves a pre-#301 slice (seeded with no record) alone', () => {
    // The case the fingerprint cannot resolve: an existing browser's slice, with
    // no seed record, holding the user's own response. Guessing it is "just an
    // old fixture" would delete their work — so it is never touched, and
    // resetLocalDemoData() is the deliberate way out.
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ [PATIENT]: { ...POPULATION_SCENARIOS[PATIENT], responses: [userResponse] } }),
    )

    const slice = new LocalDataSource().getSliceSync(PATIENT)

    expect(slice.responses).toHaveLength(1)
    expect(slice.responses[0].id).toBe('user-authored-1')
    expect(readSeeds()[PATIENT]).toBeUndefined()
  })
})

describe('resetLocalDemoData', () => {
  it('clears the store, the seed record, and the legacy keys', () => {
    const source = new LocalDataSource()
    source.getSliceSync(PATIENT)
    // A legacy key left behind would let migrateLegacyStorage resurrect
    // pre-slice data on the next construct — a "reset" that restores old state.
    window.localStorage.setItem('spier-demo-responses', JSON.stringify([userResponse]))

    resetLocalDemoData()

    expect(window.localStorage.getItem(STORE_KEY)).toBeNull()
    expect(window.localStorage.getItem(SEEDS_KEY)).toBeNull()
    expect(window.localStorage.getItem('spier-demo-responses')).toBeNull()
  })

  it('leaves the next construct seeding fresh from the shipped scenarios', () => {
    const source = new LocalDataSource()
    source.getSliceSync(PATIENT)
    const store = readStore()
    store[PATIENT] = { ...store[PATIENT], responses: [userResponse] }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))

    resetLocalDemoData()
    const slice = new LocalDataSource().getSliceSync(PATIENT)

    expect(slice.responses.some(r => r.id === 'user-authored-1')).toBe(false)
    expect(slice.responses.length).toBe(POPULATION_SCENARIOS[PATIENT].responses.length)
  })
})
