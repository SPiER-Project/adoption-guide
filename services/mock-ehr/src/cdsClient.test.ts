/**
 * This host's CDS Client identity: the key it holds, what it publishes, and the
 * token it signs.
 *
 * ⚠️ **What this file does NOT prove is that the token verifies.** That needs
 * the other half, and it lives in `services/cds/src/cdsClientInterop.test.ts` —
 * the real `cdsJwt()` middleware, on the real route, under the policy
 * `services/cds/wrangler.jsonc` deploys. Two green suites either side of an
 * interface neither crosses is the shape that ships a 401; these assert the
 * things only this side can see.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from './app'
import { fakeStore, type FakeStoreBinding } from './__fixtures__/store'
import {
  JWKS_PATH,
  TOKEN_TTL_SECONDS,
  generateSigningKey,
  mintCdsToken,
  publicJwks,
  signingKeyFor,
} from './cdsClient'

const BASE = 'http://host.test'

function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (segment.length % 4)) % 4)
  return JSON.parse(atob(padded)) as Record<string, unknown>
}

describe('publicJwks', () => {
  it('publishes the key id, use and algorithm a verifier selects on', async () => {
    const key = await generateSigningKey()
    const [jwk] = publicJwks(key).keys
    expect(jwk).toMatchObject({ kty: 'EC', crv: 'P-384', kid: key.kid, use: 'sig', alg: 'ES384' })
    expect(jwk.x).toBeTruthy()
    expect(jwk.y).toBeTruthy()
  })

  it('carries NO private material', async () => {
    // ⚠️ **The one mistake in this module that cannot be walked back.** A
    // deploy that served `d` has published the private key to everyone who
    // fetched the set, and rotating afterwards does not un-publish it.
    //
    // ⚠️ This assertion is the whole guard, and it was written because it was
    // MISSING: swapping `key.publicJwk` for `key.privateJwk` in `publicJwks`
    // was planted and every other test — including the full interop handshake —
    // stayed green. It has to, because an EC private JWK carries the same
    // `x`/`y` as the public one plus `d`, so the signature still verifies. The
    // only observable difference is the field this checks for.
    const key = await generateSigningKey()
    const serialized = JSON.stringify(publicJwks(key))
    expect(serialized).not.toContain('"d"')
    expect(key.privateJwk.d).toBeTruthy() // the scalar exists; it is just not published
    for (const jwk of publicJwks(key).keys) {
      expect(Object.keys(jwk)).toEqual(
        expect.not.arrayContaining(['d', 'p', 'q', 'dp', 'dq', 'qi', 'k']),
      )
    }
  })
})

describe('signingKeyFor', () => {
  it('mints once and returns the same key thereafter', async () => {
    const { state } = fakeStore()
    const first = await signingKeyFor(state)
    const second = await signingKeyFor(state)
    expect(second.kid).toBe(first.kid)
    expect(second.privateJwk.d).toBe(first.privateJwk.d)
  })

  it('hands a late arrival the INCUMBENT key, not its own', async () => {
    // The race two isolates run on a cold start: both find no key and both
    // generate. Whoever writes second must be given the first one back — its
    // own public half was never published, so a token signed with it would be
    // rejected by anything reading /.well-known/jwks.json.
    const { state } = fakeStore()
    const winner = await signingKeyFor(state)
    const loser = await generateSigningKey()
    expect(loser.kid).not.toBe(winner.kid)
    expect(await state.putCdsKeyIfAbsent(loser)).toMatchObject({ kid: winner.kid })
  })
})

describe('mintCdsToken', () => {
  it('produces a compact JWS carrying the registered CDS Hooks claims', async () => {
    const key = await generateSigningKey()
    const now = 1_700_000_000_000
    const token = await mintCdsToken(
      key,
      {
        iss: BASE,
        sub: 'spier-mock-ehr',
        aud: 'https://cds.test/cds-services/spier-patient-view',
        jku: `${BASE}${JWKS_PATH}`,
      },
      now,
    )

    const [rawHeader, rawPayload, signature] = token.split('.')
    expect(signature).toBeTruthy()
    // ES384 over P-384 is r||s at 48 bytes each = 96 bytes, which is 128
    // base64url characters. A DER-encoded signature would be a different
    // length AND would fail verification — see the interop suite.
    expect(signature).toHaveLength(128)

    expect(decodeSegment(rawHeader)).toEqual({
      alg: 'ES384',
      typ: 'JWT',
      kid: key.kid,
      jku: `${BASE}${JWKS_PATH}`,
    })

    const payload = decodeSegment(rawPayload)
    expect(payload).toMatchObject({
      iss: BASE,
      sub: 'spier-mock-ehr',
      aud: 'https://cds.test/cds-services/spier-patient-view',
      iat: now / 1000,
      exp: now / 1000 + TOKEN_TTL_SECONDS,
    })
    expect(payload.jti).toEqual(expect.any(String))
  })

  it('gives every token its own jti', async () => {
    // The verifier's replay guard keys on `jti`. A constant one would make the
    // SECOND card fetch of any session look like a replay.
    const key = await generateSigningKey()
    const claims = { iss: BASE, sub: 's', aud: 'a', jku: 'j' }
    const [one, two] = await Promise.all([mintCdsToken(key, claims), mintCdsToken(key, claims)])
    expect(decodeSegment(one.split('.')[1]).jti).not.toBe(decodeSegment(two.split('.')[1]).jti)
  })
})

describe(`GET ${JWKS_PATH}`, () => {
  it('serves the key set, and is open', async () => {
    // Open by necessity: a verifier reaches this BEFORE it trusts anything.
    const env = fakeStore()
    const res = await app.request(`${BASE}${JWKS_PATH}`, {}, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { keys: Array<Record<string, unknown>> }
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0]).toMatchObject({ use: 'sig', alg: 'ES384' })
  })

  it('publishes the SAME key the host would sign with', async () => {
    const env = fakeStore()
    const res = await app.request(`${BASE}${JWKS_PATH}`, {}, env)
    const body = (await res.json()) as { keys: Array<{ kid: string }> }
    const held = await env.state.getCdsKey()
    expect(body.keys[0].kid).toBe(held?.kid)
  })

  it('503s rather than minting an ephemeral key when there is no store', async () => {
    // A per-isolate fallback would publish a key some other isolate does not
    // hold — a verifier rejecting a token this host legitimately signed,
    // intermittently, and never locally.
    const res = await app.request(`${BASE}${JWKS_PATH}`, {}, {})
    expect(res.status).toBe(503)
  })
})

describe('POST /_admin/cds', () => {
  const realFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ cards: [] }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => { globalThis.fetch = realFetch })

  function post(env: FakeStoreBinding | Record<string, unknown>) {
    return app.request(
      `${BASE}/_admin/cds`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hook: 'patient-view', hookInstance: 'x', context: {} }),
      },
      env,
    )
  }

  it('calls the CDS service with a signed bearer token', async () => {
    const env = fakeStore()
    const res = await post(env)
    expect(res.status).toBe(200)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://spier-cds.bbthorson.workers.dev/cds-services/spier-patient-view')
    const authorization = (init.headers as Record<string, string>).authorization
    expect(authorization).toMatch(/^Bearer /)

    const [header, payload] = authorization.slice(7).split('.')
    expect(decodeSegment(header)).toMatchObject({ alg: 'ES384', jku: `${BASE}${JWKS_PATH}` })
    expect(decodeSegment(payload)).toMatchObject({
      iss: BASE,
      sub: 'spier-mock-ehr',
      // ⚠️ The INVOKE URL, not the origin. The service's CDS_JWT_AUDIENCE is
      // this exact string, and the origin is the easy mistake — it fails as a
      // flat 401 whose only symptom is cards that stop appearing.
      aud: 'https://spier-cds.bbthorson.workers.dev/cds-services/spier-patient-view',
    })
  })

  // ⚠️ **This is the test the deployed 404 needed and nobody had.** A plain
  // `fetch()` to the service's URL succeeds here, and is refused on the deployed
  // origins: both Workers sit on one `workers.dev` zone, and Cloudflare answers
  // a same-zone Worker subrequest with HTTP 404 / `error code: 1042`. So "the
  // CDS call is covered" was true of every path except the only one that ran in
  // production. A unit test cannot reach the edge; what it can assert is the
  // dispatch CHOICE — that a bound Worker is used when one exists. The end of
  // the chain is exercised by running both Workers under `wrangler dev`.
  it('dispatches through the CDS service binding when it is bound', async () => {
    // Params are declared so the mock's call tuple is typed — `bound.mock.calls[0][0]`
    // is `never` off a zero-arg mock, which is a compile error rather than a
    // failing assertion.
    const bound = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ cards: [] }), { headers: { 'content-type': 'application/json' } }),
    )
    const res = await post({ ...fakeStore(), CDS: { fetch: bound } })
    expect(res.status).toBe(200)
    expect(bound).toHaveBeenCalledTimes(1)
    // The URL is unchanged by the transport — the signed `aud` is that string.
    expect(bound.mock.calls[0]?.[0]).toBe(
      'https://spier-cds.bbthorson.workers.dev/cds-services/spier-patient-view',
    )
    // And the zone-refused path is not taken.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('signs with the key it publishes', async () => {
    const env = fakeStore()
    await post(env)
    const jwks = await (await app.request(`${BASE}${JWKS_PATH}`, {}, env)).json() as {
      keys: Array<{ kid: string }>
    }
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const header = decodeSegment(
      (init.headers as Record<string, string>).authorization.slice(7).split('.')[0],
    )
    expect(header.kid).toBe(jwks.keys[0].kid)
  })

  it('passes the service status through instead of flattening it', async () => {
    // A 401 means this host's identity was refused; a 500 means the card
    // builder broke. Collapsing both into "unavailable" is what would hide the
    // first, and the first is the one a `require` rollout produces.
    fetchMock.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ error: 'nope' }), { status: 401 }),
    )
    expect((await post(fakeStore())).status).toBe(401)
  })

  it('honours MOCK_CDS_BASE_URL for the endpoint AND the audience', async () => {
    const env = { ...fakeStore(), MOCK_CDS_BASE_URL: 'https://cds.example.org/ignored/path' }
    await post(env)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://cds.example.org/cds-services/spier-patient-view')
    // The two must move together. An audience left on the default while the
    // endpoint moved is a 401 from a service that never sees the mismatch.
    expect(
      decodeSegment((init.headers as Record<string, string>).authorization.slice(7).split('.')[1]),
    ).toMatchObject({ aud: 'https://cds.example.org/cds-services/spier-patient-view' })
  })

  it('503s without a store rather than calling the service unsigned', async () => {
    expect((await post({})).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
