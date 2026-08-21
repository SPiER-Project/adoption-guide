/**
 * `POST /fhir/{Type}` — panel step 4.
 *
 * ⚠️ **This file is guardrail 2, and the guardrail is not "there are tests".**
 * The panel plan §1 reverses an earlier decision against writing our own mock
 * FHIR server, and the reversal is conditional:
 *
 *   > **Prove it can reject.** Plant an invalid write — wrong `Coding.display`, a
 *   > missing required slice — and watch it 422 before the mock is trusted. A
 *   > mock nobody has seen reject anything is not evidence of anything.
 *
 * So the rejection cases below are the point of the file and the acceptance case
 * is the control. Every invalid payload is derived by **breaking a resource the
 * repo's own gate already accepts** rather than by hand-writing something
 * obviously wrong: a hand-written invalid resource proves the validator rejects
 * things nobody would send.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import app, { resetProfile } from './app'
import { authHeaderFor } from './__fixtures__/launch'
import { fakeStore, type FakeStoreBinding } from './__fixtures__/store'
import { POPULATION_SCENARIOS } from '@spier/demo-population'

const BASE = 'https://mock-ehr.test'
const PATIENT = 'patient-011'

let auth: Record<string, string>
let foreignAuth: Record<string, string>

beforeAll(async () => {
  auth = await authHeaderFor(BASE, PATIENT)
  foreignAuth = await authHeaderFor(BASE, 'patient-002')
})

/**
 * A resource the repo's own gate accepts, ready to POST.
 *
 * Taken from the population scenarios and stripped of its `id` exactly the way
 * `SmartDataSource.toCreatePayload` strips it — so the happy path here is the
 * shape the app really sends, not a shape invented to pass.
 */
function validObservation(): Record<string, unknown> {
  const source = POPULATION_SCENARIOS[PATIENT]?.observations?.[0]
  if (!source) throw new Error(`${PATIENT} has no scenario Observation to derive a write from`)
  return strip(source)
}

/**
 * A scenario Observation that CLAIMS a SPiER profile with a required binding on
 * its coded value.
 *
 * ⚠️ Separate from `validObservation` because the two are checked to different
 * depths, and that difference is a real limit of this guardrail rather than a
 * test detail. `observations[0]` for this patient carries no `meta.profile`, so
 * it gets base-R4 checks only — no min-cardinality, no fixed values, no
 * bindings. A client can therefore write an unprofiled resource this server has
 * little opinion about. Asserted explicitly below, so the hole is written down
 * rather than discovered.
 */
function profiledObservation(): Record<string, unknown> {
  const source = (POPULATION_SCENARIOS[PATIENT]?.observations ?? []).find(
    o => Array.isArray((o as { meta?: { profile?: unknown[] } }).meta?.profile)
      && ((o as { meta?: { profile?: unknown[] } }).meta?.profile?.length ?? 0) > 0
      && !!(o as { valueCodeableConcept?: { coding?: unknown[] } }).valueCodeableConcept?.coding?.[0],
  )
  if (!source) throw new Error(`${PATIENT} has no profiled Observation with a coded value`)
  return strip(source)
}

/** Strip what a create must not carry, exactly as toCreatePayload does. */
function strip(source: unknown): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
  delete clone.id
  delete clone._savedAt
  return clone
}

async function post(
  type: string,
  body: unknown,
  // `{}` is the deliberately-unbound case (see the 503 test), so the env type
  // has to admit it as well as a real binding.
  { env = fakeStore(), headers = auth }: { env?: FakeStoreBinding | Record<string, never>; headers?: Record<string, string> } = {},
) {
  const res = await app.request(
    `${BASE}/fhir/${type}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/fhir+json', prefer: 'return=representation', ...headers },
      body: JSON.stringify(body),
    },
    env,
  )
  return { res, body: (await res.json().catch(() => null)) as Record<string, unknown> | null }
}

/** Every diagnostics string on an OperationOutcome, joined. */
function diagnosticsOf(body: Record<string, unknown> | null): string {
  const issues = (body?.issue ?? []) as Array<{ diagnostics?: string }>
  return issues.map(i => i.diagnostics ?? '').join(' | ')
}

describe('a valid write', () => {
  it('is accepted with 201, a server-minted id, and the representation', async () => {
    const { res, body } = await post('Observation', validObservation())
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toContain('application/fhir+json')
    expect(body).toMatchObject({ resourceType: 'Observation' })
    // ⚠️ The id is the SERVER's, and deliberately unlike a client id. The ladder
    // remaps `QuestionnaireResponse/<client id>` to the server's id inside
    // `Observation.derivedFrom`; echoing the client's id back would make that
    // remap a no-op and the provenance bug it guards untestable here.
    expect(body?.id).toBe('srv-1')
    expect(res.headers.get('location')).toBe(`${BASE}/fhir/Observation/srv-1`)
  })

  it('is then readable — a write the server forgets is worse than no write', async () => {
    const env = fakeStore()
    const created = await post('Observation', validObservation(), { env })
    expect(created.res.status).toBe(201)

    const read = await app.request(`${BASE}/fhir/Observation/srv-1`, { headers: auth }, env)
    expect(read.status).toBe(200)

    const searched = await app.request(
      `${BASE}/fhir/Observation?patient=${PATIENT}`,
      { headers: auth },
      env,
    )
    const bundle = (await searched.json()) as { entry?: Array<{ resource?: { id?: string } }> }
    expect(bundle.entry?.some(e => e.resource?.id === 'srv-1')).toBe(true)
  })

  it('appends rather than displacing the fixtures, so the demo re-runs', async () => {
    const env = fakeStore()
    const before = await app.request(`${BASE}/fhir/Observation?patient=${PATIENT}`, { headers: auth }, env)
    const beforeTotal = ((await before.json()) as { total?: number }).total ?? 0
    await post('Observation', validObservation(), { env })
    const after = await app.request(`${BASE}/fhir/Observation?patient=${PATIENT}`, { headers: auth }, env)
    expect(((await after.json()) as { total?: number }).total).toBe(beforeTotal + 1)
  })
})

describe('it rejects — guardrail 2', () => {
  // Each case breaks ONE thing in a resource the scenario gate already accepts.
  const CASES: Array<[string, (o: Record<string, unknown>) => void, RegExp]> = [
    [
      'a status outside the required binding',
      o => { o.status = 'totally-final' },
      /status "totally-final" is not a valid Observation.status code/,
    ],
    [
      'a missing base-R4 required element',
      o => { delete o.code },
      /Observation\.code is required by base FHIR R4/,
    ],
    [
      'a meta.profile canonical that resolves to nothing',
      o => { o.meta = { profile: ['http://example.org/not-a-real-profile'] } },
      /does not resolve to any known StructureDefinition/,
    ],
    [
      'a date that is not a FHIR dateTime',
      o => { o.effectiveDateTime = 'last Tuesday' },
      /is not a valid FHIR date\/dateTime/,
    ],
    [
      'a body whose resourceType disagrees with the URL',
      o => { o.resourceType = 'Patient' },
      /this bucket holds Observation/,
    ],
  ]

  for (const [name, breakIt, expected] of CASES) {
    it(`refuses ${name} with 422`, async () => {
      const resource = validObservation()
      breakIt(resource)
      const { res, body } = await post('Observation', resource)
      expect(res.status).toBe(422)
      expect(body?.resourceType).toBe('OperationOutcome')
      expect(diagnosticsOf(body)).toMatch(expected)
    })
  }

  it('refuses a coding outside a required binding with 422', async () => {
    // The profile-derived half — the checks that come from the generated
    // StructureDefinitions rather than from a hand-listed table. This is the one
    // §1 names ("a `Coding.display` that does not match its CodeSystem"), and it
    // needs a resource that claims a profile.
    const resource = profiledObservation()
    const value = resource.valueCodeableConcept as { coding: Array<{ code: string }> }
    value.coding[0].code = 'not-a-real-code'
    const { res, body } = await post('Observation', resource)
    expect(res.status).toBe(422)
    expect(diagnosticsOf(body)).toMatch(/is not in the required binding/)
  })

  it('refuses a profiled resource missing an element its profile requires', async () => {
    const resource = profiledObservation()
    delete resource.valueCodeableConcept
    const { res, body } = await post('Observation', resource)
    expect(res.status).toBe(422)
    expect(diagnosticsOf(body)).toMatch(/is required by http:\/\/spier\.org/)
  })

  it('⚠️ checks an UNPROFILED resource less deeply — a stated limit, not a bug', async () => {
    // A resource claiming no SPiER profile gets base-R4 checks only. Worth
    // pinning: it means "the mock accepted it" is a weaker statement for
    // unprofiled writes than for profiled ones, and the ladder's own artifacts
    // DO carry profiles. Conformance evidence still lives elsewhere (§1
    // guardrail 3) — this server accepting a resource is never that evidence.
    const unprofiled = validObservation()
    // It has a `meta` (a pathway-stage tag) but claims no profile, which is the
    // condition that matters: no profile, no profile-derived checks.
    expect((unprofiled.meta as { profile?: unknown[] } | undefined)?.profile).toBeUndefined()
    const { res } = await post('Observation', unprofiled)
    expect(res.status).toBe(201)
  })

  it('reports EVERY problem, not just the first', async () => {
    // A 422 naming one defect invites fixing that one and re-POSTing forever.
    const resource = validObservation()
    resource.status = 'nonsense'
    delete resource.code
    const { res, body } = await post('Observation', resource)
    expect(res.status).toBe(422)
    expect((body?.issue as unknown[]).length).toBeGreaterThan(1)
  })

  it('stores nothing it refused', async () => {
    const env = fakeStore()
    const resource = validObservation()
    resource.status = 'nonsense'
    await post('Observation', resource, { env })
    expect(await env.state.list()).toEqual([])
  })

  it('refuses a body that is not a resource object', async () => {
    const { res } = await post('Observation', ['not', 'a', 'resource'])
    expect(res.status).toBe(400)
  })
})

describe('the capability profile gates writes — the degradation demo', () => {
  it('refuses a type the live profile does not advertise, with 405', async () => {
    const env = fakeStore()
    await env.state.setProfile('no-observation')
    const { res, body } = await post('Observation', validObservation(), { env })
    expect(res.status).toBe(405)
    expect(body?.resourceType).toBe('OperationOutcome')
    expect(diagnosticsOf(body)).toMatch(/does not support create for 'Observation'/)
    // Says which profile, so the reader can tell a demo posture from a defect.
    expect(diagnosticsOf(body)).toMatch(/no-observation/)
  })

  it('still accepts the types that profile DOES advertise', async () => {
    // The degradation has to be selective or it proves nothing: under
    // `no-observation` the Tier-0 DocumentReference floor must still land.
    const env = fakeStore()
    await env.state.setProfile('no-observation')
    const { res } = await post('QuestionnaireResponse', {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      subject: { reference: `Patient/${PATIENT}` },
      authored: '2026-08-11T10:00:00Z',
    }, { env })
    expect(res.status).toBe(201)
  })

  it('refuses everything under read-only', async () => {
    const env = fakeStore()
    await env.state.setProfile('read-only')
    const { res, body } = await post('QuestionnaireResponse', {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      subject: { reference: `Patient/${PATIENT}` },
    }, { env })
    expect(res.status).toBe(405)
    expect(diagnosticsOf(body)).toMatch(/Supported for create: nothing/)
  })

  it('and /metadata agrees with the refusal — one source of truth, not two', async () => {
    // The refusal above and the CapabilityStatement the ladder reads must come
    // from the SAME live profile. If they could disagree, the ladder would
    // attempt a write the server refuses (or skip one it would accept) and the
    // scorecard would be describing a different server.
    const env = fakeStore()
    await env.state.setProfile('no-observation')
    const res = await app.request(`${BASE}/fhir/metadata`, {}, env)
    const statement = (await res.json()) as {
      rest?: Array<{ resource?: Array<{ type?: string; interaction?: Array<{ code?: string }> }> }>
    }
    const observation = statement.rest?.[0]?.resource?.find(r => r.type === 'Observation')
    expect(observation?.interaction?.some(i => i.code === 'create')).toBe(false)
  })

  it('reads the profile from the store, not from module memory', async () => {
    // ⚠️ The whole reason the profile became durable. `setProfile` in module
    // memory is per-isolate: an operator flips it in the isolate serving the
    // control page and the panel reads /metadata from another. Here the module
    // value says `full` and the store says `read-only`; the store must win.
    resetProfile()
    const env = fakeStore()
    await env.state.setProfile('read-only')
    const { res } = await post('Observation', validObservation(), { env })
    expect(res.status).toBe(405)
  })
})

describe('writes are patient-scoped and authorized', () => {
  it('401s without a token', async () => {
    const { res } = await post('Observation', validObservation(), { headers: {} })
    expect(res.status).toBe(401)
  })

  it('403s a resource belonging to another patient', async () => {
    const { res, body } = await post('Observation', validObservation(), { headers: foreignAuth })
    expect(res.status).toBe(403)
    expect(diagnosticsOf(body)).toMatch(/scoped to patient 'patient-002'/)
  })
})

describe('without a DEMO_STORE binding', () => {
  it('503s rather than accepting a write it cannot keep', async () => {
    // Deliberately not a memory fallback: writes accepted and then lost between
    // isolates is the hardest failure to diagnose from a demo.
    const { res, body } = await post('Observation', validObservation(), { env: {} })
    expect(res.status).toBe(503)
    expect(diagnosticsOf(body)).toMatch(/DEMO_STORE/)
  })
})

describe('reset', () => {
  it('discards writes and leaves the profile alone', async () => {
    const env = fakeStore()
    await env.state.setProfile('no-observation')
    await post('QuestionnaireResponse', {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      subject: { reference: `Patient/${PATIENT}` },
    }, { env })
    expect((await env.state.list()).length).toBe(1)

    const res = await app.request(`${BASE}/_admin/reset`, { method: 'POST' }, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ discarded: 1, profileUnchanged: 'no-observation' })
    expect(await env.state.list()).toEqual([])
    // "Reset the data" and "re-arm the ladder" are different intentions; a reset
    // that silently restored `full` would undo the degradation just set up.
    expect(await env.state.getProfile()).toBe('no-observation')
  })

  it('does not reuse ids after a reset', async () => {
    // A stale `srv-1` reference resolving to a different resource is the kind of
    // thing that makes a demo look haunted.
    const env = fakeStore()
    await post('Observation', validObservation(), { env })
    await app.request(`${BASE}/_admin/reset`, { method: 'POST' }, env)
    const { body } = await post('Observation', validObservation(), { env })
    expect(body?.id).not.toBe('srv-1')
  })
})

describe('PUT — update-as-create, which the browser found and the plan did not list', () => {
  /**
   * A lifecycle resource of the kind `SmartDataSource.saveArtifact` PUTs. Derived
   * from the scenario fixtures for the same reason as the Observation above: a
   * hand-written body would prove the endpoint accepts something nobody sends.
   */
  function lifecycleResource(): Record<string, unknown> {
    const source = POPULATION_SCENARIOS[PATIENT]?.episodes?.[0]
    if (!source) throw new Error(`${PATIENT} has no scenario EpisodeOfCare`)
    return JSON.parse(JSON.stringify(source)) as Record<string, unknown>
  }

  async function put(
    type: string,
    id: string,
    body: unknown,
    { env = fakeStore(), headers = auth }: { env?: FakeStoreBinding | Record<string, never>; headers?: Record<string, string> } = {},
  ) {
    const res = await app.request(
      `${BASE}/fhir/${type}/${id}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/fhir+json', ...headers },
        body: JSON.stringify(body),
      },
      env,
    )
    return { res, body: (await res.json().catch(() => null)) as Record<string, unknown> | null }
  }

  it('keeps the CLIENT’s id, unlike POST', async () => {
    // The whole point: an episode opened and later closed has to converge on ONE
    // resource, which only works if the id survives the round trip.
    const resource = lifecycleResource()
    const id = String(resource.id)
    const { res, body } = await put('EpisodeOfCare', id, resource)
    expect([200, 201]).toContain(res.status)
    expect(body?.id).toBe(id)
    expect(body?.id).not.toMatch(/^srv-/)
  })

  it('replaces rather than appending, so open→close converges', async () => {
    const env = fakeStore()
    const resource = lifecycleResource()
    const id = String(resource.id)

    const first = await put('EpisodeOfCare', id, resource, { env })
    expect(first.res.status).toBe(201)

    const closed = { ...resource, status: 'finished' }
    const second = await put('EpisodeOfCare', id, closed, { env })
    // 200, not 201 — a client should be able to tell a replacement from a create.
    expect(second.res.status).toBe(200)

    const stored = await env.state.list()
    expect(stored).toHaveLength(1)
    expect(stored[0].resource.status).toBe('finished')
  })

  it('a read returns the UPDATED version, not the fixture it replaced', async () => {
    // ⚠️ The merged view is keyed by Type/id with the written version winning.
    // Concatenating instead would return both, and the chart would show one
    // episode as simultaneously active and finished.
    const env = fakeStore()
    const resource = lifecycleResource()
    const id = String(resource.id)
    expect(resource.status).not.toBe('finished')

    await put('EpisodeOfCare', id, { ...resource, status: 'finished' }, { env })

    const read = await app.request(`${BASE}/fhir/EpisodeOfCare/${id}`, { headers: auth }, env)
    expect(((await read.json()) as { status?: string }).status).toBe('finished')

    const searched = await app.request(`${BASE}/fhir/EpisodeOfCare?patient=${PATIENT}`, { headers: auth }, env)
    const bundle = (await searched.json()) as { entry?: Array<{ resource?: { id?: string; status?: string } }> }
    const matches = (bundle.entry ?? []).filter(e => e.resource?.id === id)
    expect(matches).toHaveLength(1)
    expect(matches[0].resource?.status).toBe('finished')
  })

  it('refuses a body whose id disagrees with the URL', async () => {
    const resource = lifecycleResource()
    const { res, body } = await put('EpisodeOfCare', 'some-other-id', resource)
    expect(res.status).toBe(400)
    expect(diagnosticsOf(body)).toMatch(/does not match the id in the URL/)
  })

  it('applies the same validation as POST', async () => {
    const resource = lifecycleResource()
    resource.status = 'nonsense'
    const { res, body } = await put('EpisodeOfCare', String(resource.id), resource)
    expect(res.status).toBe(422)
    expect(diagnosticsOf(body)).toMatch(/is not a valid EpisodeOfCare.status code/)
  })

  it('is gated by the SAME capability profile as POST', async () => {
    // A profile that refused creates while still accepting updates would be a
    // hole in the degradation demo — and exactly the kind of hole that opens by
    // adding an endpoint rather than by changing a rule.
    const env = fakeStore()
    await env.state.setProfile('read-only')
    const resource = lifecycleResource()
    const { res } = await put('EpisodeOfCare', String(resource.id), resource, { env })
    expect(res.status).toBe(405)
  })

  it('403s another patient’s resource', async () => {
    const resource = lifecycleResource()
    const { res } = await put('EpisodeOfCare', String(resource.id), resource, { headers: foreignAuth })
    expect(res.status).toBe(403)
  })
})
