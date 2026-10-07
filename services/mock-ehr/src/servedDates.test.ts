/**
 * Every path a client reads the population through serves it AS OF TODAY.
 *
 * `fixtures.ts` keeps two views: `HELD_RESOURCES`, dated as authored (the
 * dataset's shape), and `heldResourcesAsOf()`, what is served. A serving path
 * that reached for the first would put the demo back where it was on
 * 2026-10-06 — every patient overdue by the two months since the anchor —
 * while every structural test stayed green, because ids and types never move.
 * The chart has its own case in `chartPage.test.ts`; these are the other two.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import app from './app'
import { questionnaireResponseBundle } from './cdsPrefetch'
import { servableFor } from './fhirResponses'

// 56 days after the anchor. p011-enc-ed starts 2026-08-02 as authored; p003's
// PHQ-9 is authored on the anchor day itself.
const NOW = new Date('2026-10-06T15:00:00Z')

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterAll(() => { vi.useRealTimers() })

describe('served dates', () => {
  it('search and read serve the fixtures as of today', async () => {
    const served = await servableFor({})
    const encounter = served.find(r => r.resourceType === 'Encounter' && r.id === 'p011-enc-ed')
    expect(encounter).toMatchObject({ period: { start: '2026-09-27T08:15:00.000Z' } })
  })

  it('read-by-id serves the fixture as of today', async () => {
    // Auth off, as smart.test.ts does for an open read: this asserts the body,
    // and a 401 would assert nothing.
    const res = await app.request('/fhir/Encounter/p011-enc-ed', {}, { MOCK_AUTH_ENFORCE: 'off' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ period: { start: '2026-09-27T08:15:00.000Z' } })
  })

  it('the CDS prefetch hands the service today’s dates, not the anchor’s', async () => {
    const bundle = await questionnaireResponseBundle('patient-003', null, 'https://ehr.test/fhir')
    const authored = bundle.entry?.map(e => (e.resource as { authored?: string }).authored) ?? []
    expect(authored.length).toBeGreaterThan(0)
    expect(authored).toContain('2026-10-06T00:00:00.000Z')
  })
})
