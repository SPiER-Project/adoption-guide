/**
 * The prefetch this host attaches when it invokes the CDS Hooks service.
 *
 * ⚠️ **What the defect looked like, and why no test caught it.** This host
 * invoked the service with context only, so the service took its documented
 * fallback and evaluated the bundled population scenario for the patient id.
 * Every assertion on both sides passed: the host really did sign and send a
 * valid `patient-view` request, and the service really did return valid cards
 * for a real patient. They were just cards about a fixture. Nothing anywhere
 * compared what the chart HELD with what the service was TOLD, which is the
 * only place the two could differ — and they differ the moment the panel
 * writes anything (audit §1.14).
 *
 * So the assertions below are all about the OUTBOUND body. What the service
 * does with it is `services/cds`'s to test, and what it recommends is not this
 * PR's to change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from './app'
import { fakeStore, type FakeStoreBinding } from './__fixtures__/store'
import { questionnaireResponseBundle, QR_PREFETCH_KEY, type SearchsetBundle } from './cdsPrefetch'
import { HELD_RESOURCES, type MockResource } from './fixtures'
// The service's OWN discovery document — the same cross-service import
// `chartPage.test.ts` uses for SERVICE_ID, and for the same reason.
import { PATIENT_VIEW_SERVICE } from '../../cds/src/service'

const BASE = 'http://host.test'
/** Five completed responses in the fixtures. */
const RICH = 'patient-011'
/** None at all — the "nothing on file" story the front door tells about him. */
const EMPTY = 'patient-002'

interface HookBody {
  hook: string
  context?: { patientId?: string }
  prefetch?: Record<string, unknown>
}

function completedQr(patientId: string, over: Partial<MockResource> = {}): MockResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    authored: '2026-09-21T10:00:00.000Z',
    ...over,
  }
}

describe('the prefetch key', () => {
  it('is the one the service\'s discovery document declares', async () => {
    // ⚠️ **Asserting `QR_PREFETCH_KEY` against itself proves nothing**, and
    // that is not hypothetical: misspelling the constant was planted and every
    // other assertion in this file stayed green, because they all read the
    // constant. The key is a contract between two Workers, so the only honest
    // comparison is against the other side of it.
    expect(Object.keys(PATIENT_VIEW_SERVICE.prefetch ?? {})).toContain(QR_PREFETCH_KEY)
  })

  it('is the query the template asks for — patient, completed, newest first', async () => {
    // What this file's filters and sort are FOR. A template that grew an
    // `_include` or dropped `status=completed` would leave those implementing
    // a request nobody makes any more.
    const template = (PATIENT_VIEW_SERVICE.prefetch ?? {})[QR_PREFETCH_KEY]
    expect(template).toContain('QuestionnaireResponse?patient={{context.patientId}}')
    expect(template).toContain('status=completed')
    expect(template).toContain('_sort=-authored')
  })
})

describe('questionnaireResponseBundle', () => {
  it('is a searchset Bundle — the shape a real CDS client returns for a query prefetch', async () => {
    // The service tolerates a bare resource or an array so hand-built payloads
    // work. Sending one of those from the real client would leave the Bundle
    // branch — the one every other CDS client exercises — covered by nothing.
    const bundle = await questionnaireResponseBundle(RICH, null, `${BASE}/fhir`)
    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.type).toBe('searchset')
    expect(bundle.total).toBe(bundle.entry.length)
    expect(bundle.entry[0].fullUrl).toMatch(new RegExp(`^${BASE}/fhir/QuestionnaireResponse/`))
  })

  it('carries the FIXTURE responses for a patient who has them', async () => {
    const bundle = await questionnaireResponseBundle(RICH, null, `${BASE}/fhir`)
    const expected = HELD_RESOURCES
      .filter(h => h.patientId === RICH && h.resource.resourceType === 'QuestionnaireResponse')
      .map(h => String(h.resource.id))
    expect(expected.length).toBeGreaterThan(1)
    expect(bundle.entry.map(e => String(e.resource.id)).sort()).toEqual(expected.sort())
  })

  it('carries the WRITTEN responses too — the half the fallback can never see', async () => {
    const env = fakeStore()
    const written = await env.state.add(EMPTY, completedQr(EMPTY))
    const bundle = await questionnaireResponseBundle(EMPTY, env.state, `${BASE}/fhir`)
    expect(bundle.total).toBe(1)
    expect(bundle.entry[0].resource.id).toBe(written.id)
  })

  it('carries BOTH at once, which is the state a demo is in after one submit', async () => {
    const env = fakeStore()
    await env.state.add(RICH, completedQr(RICH, { id: 'ignored-client-id' }))
    const fixtures = await questionnaireResponseBundle(RICH, null, `${BASE}/fhir`)
    const both = await questionnaireResponseBundle(RICH, env.state, `${BASE}/fhir`)
    expect(both.total).toBe(fixtures.total + 1)
  })

  it('leaves another patient\'s responses out of it', async () => {
    const env = fakeStore()
    await env.state.add(RICH, completedQr(RICH))
    const bundle = await questionnaireResponseBundle(EMPTY, env.state, `${BASE}/fhir`)
    expect(bundle.total).toBe(0)
    expect(bundle.entry).toEqual([])
  })

  it('leaves an in-progress response out — the prefetch template says status=completed', async () => {
    const env = fakeStore()
    await env.state.add(EMPTY, completedQr(EMPTY, { status: 'in-progress' }))
    expect((await questionnaireResponseBundle(EMPTY, env.state, `${BASE}/fhir`)).total).toBe(0)
  })

  it('leaves everything that is not a QuestionnaireResponse out', async () => {
    const env = fakeStore()
    await env.state.add(EMPTY, { resourceType: 'Observation', status: 'completed' })
    expect((await questionnaireResponseBundle(EMPTY, env.state, `${BASE}/fhir`)).total).toBe(0)
  })

  it('sorts newest first, the _sort=-authored the template asks for', async () => {
    const env = fakeStore()
    await env.state.add(EMPTY, completedQr(EMPTY, { authored: '2026-01-01T00:00:00.000Z' }))
    await env.state.add(EMPTY, completedQr(EMPTY, { authored: '2026-09-01T00:00:00.000Z' }))
    await env.state.add(EMPTY, completedQr(EMPTY, { authored: '2026-05-01T00:00:00.000Z' }))
    const bundle = await questionnaireResponseBundle(EMPTY, env.state, `${BASE}/fhir`)
    expect(bundle.entry.map(e => String(e.resource.authored))).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ])
  })

  it('lets a WRITE shadow the fixture it replaces, rather than sending both', async () => {
    // `upsert` exists because the app converges lifecycle resources on one id
    // instead of appending versions. A prefetch carrying the superseded copy
    // beside its replacement would hand the service two answers to one
    // question and no way to tell which is current.
    const env = fakeStore()
    const fixtureId = HELD_RESOURCES
      .find(h => h.patientId === RICH && h.resource.resourceType === 'QuestionnaireResponse')!
      .resource.id as string
    await env.state.upsert(RICH, completedQr(RICH, { id: fixtureId, authored: '2026-09-21T23:00:00.000Z' }))
    const bundle = await questionnaireResponseBundle(RICH, env.state, `${BASE}/fhir`)
    const matches = bundle.entry.filter(e => e.resource.id === fixtureId)
    expect(matches.length).toBe(1)
    expect(matches[0].resource.authored).toBe('2026-09-21T23:00:00.000Z')
  })
})

describe('POST /_admin/cds — the outbound body', () => {
  const realFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ cards: [] }), { headers: { 'content-type': 'application/json' } }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => { globalThis.fetch = realFetch })

  async function invoke(env: FakeStoreBinding | Record<string, unknown>, body: HookBody) {
    const res = await app.request(
      `${BASE}/_admin/cds`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      env,
    )
    const [, init] = (fetchMock.mock.calls[0] ?? []) as [string, RequestInit]
    return { res, sent: init ? (JSON.parse(String(init.body)) as HookBody) : null }
  }

  const patientView = (patientId?: string): HookBody => ({
    hook: 'patient-view',
    ...(patientId ? { context: { patientId } } : {}),
  })

  it('attaches the prefetch under the key the service\'s discovery document declares', async () => {
    // ⚠️ The key is the contract. `questionnaireResponses` is what
    // PATIENT_VIEW_SERVICE.prefetch names, and the service reads it back by
    // scanning every prefetch value — so a wrong key here would still be
    // *handled*, and would stop being handled the day that scan is narrowed.
    const { sent } = await invoke(fakeStore(), patientView(RICH))
    expect(Object.keys(sent!.prefetch!)).toContain(QR_PREFETCH_KEY)
    const bundle = sent!.prefetch![QR_PREFETCH_KEY] as SearchsetBundle
    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.total).toBeGreaterThan(0)
  })

  it('carries a WRITTEN response, so the service sees the chart and not the fixture', async () => {
    // The defect, stated as a test: patient-002's fixture holds no
    // QuestionnaireResponse at all, so a prefetch that reached the service with
    // this entry in it cannot have come from the bundled scenario.
    const env = fakeStore()
    const written = await env.state.add(EMPTY, completedQr(EMPTY))
    const { sent } = await invoke(env, patientView(EMPTY))
    const bundle = sent!.prefetch![QR_PREFETCH_KEY] as SearchsetBundle
    expect(bundle.total).toBe(1)
    expect(bundle.entry[0].resource.id).toBe(written.id)
    expect(bundle.entry[0].resource.subject).toEqual({ reference: `Patient/${EMPTY}` })
  })

  it('sends an EMPTY bundle for a chart with nothing on it, not no prefetch at all', async () => {
    // Honest, and load-bearing for what comes next: "this server holds no
    // responses for this patient" is a different statement from "this client
    // did not look", and only the first can ever mean "screen them".
    const { sent } = await invoke(fakeStore(), patientView(EMPTY))
    const bundle = sent!.prefetch![QR_PREFETCH_KEY] as SearchsetBundle
    expect(bundle.total).toBe(0)
    expect(bundle.entry).toEqual([])
  })

  it('replaces a prefetch the CALLER supplied under that key, and keeps its other keys', async () => {
    // The prefetch is the EHR's statement about its own record. A browser
    // supplying one would be the page telling the service what the chart holds
    // — which is the direction this whole route exists to reverse.
    const { sent } = await invoke(fakeStore(), {
      ...patientView(EMPTY),
      prefetch: {
        [QR_PREFETCH_KEY]: { resourceType: 'Bundle', type: 'searchset', total: 99, entry: [] },
        somethingElse: { resourceType: 'Patient', id: 'left-alone' },
      },
    })
    expect((sent!.prefetch![QR_PREFETCH_KEY] as SearchsetBundle).total).toBe(0)
    expect(sent!.prefetch!.somethingElse).toEqual({ resourceType: 'Patient', id: 'left-alone' })
  })

  it('passes a hook with no patient straight through, prefetch and all', async () => {
    // This route signs whatever hook the page asks for. A patient-less or
    // malformed body is the service's to answer; a 400 minted here would put
    // this host's reading of the spec in front of the service implementing it.
    const { res, sent } = await invoke(fakeStore(), patientView())
    expect(res.status).toBe(200)
    expect(sent!.prefetch).toBeUndefined()
  })

  it('still sends the hook it was given, unchanged apart from the prefetch', async () => {
    const env = fakeStore()
    const { sent } = await invoke(env, { ...patientView(RICH), hook: 'patient-view' })
    expect(sent!.hook).toBe('patient-view')
    expect(sent!.context).toEqual({ patientId: RICH })
  })
})
