/**
 * The two halves of the CDS Hooks handshake, driven against each other.
 *
 * ⚠️ **This is the test that makes `CDS_JWT_ENFORCE=require` safe to deploy,
 * and neither service can carry it alone.** `auth.test.ts` proves this service
 * rejects the tokens it should, but it mints its own with `jose` — so it proves
 * the verifier against a *hypothetical* client. `services/mock-ehr`'s own tests
 * prove it produces a well-formed JWS, but nothing there can verify one. Two
 * green suites either side of an interface neither one crosses is exactly the
 * shape that ships a 401 to production, and `warn` mode would have hidden it:
 * the cards would still render, from a request that logged a failure and
 * proceeded.
 *
 * So this file imports the REAL minting code out of `services/mock-ehr` (a
 * relative import across the two service trees — there is no shared package,
 * and inventing one for two functions would be the heavier mistake) and runs
 * its output through the REAL `cdsJwt()` middleware on the REAL route, under
 * the exact policy `services/cds/wrangler.jsonc` deploys.
 *
 * ⚠️ Nothing here uses `jose` to sign. The moment it did, this would go back to
 * testing the verifier against a hypothetical client — which is the failure it
 * exists to catch. The three things that can only be caught this way:
 *
 *   1. **Signature encoding.** WebCrypto's ECDSA output is the raw `r || s`
 *      pair JWS specifies; Node's `crypto` emits DER for the same call. A
 *      minting path that picked up the wrong one produces a token that parses,
 *      carries correct claims, and fails verification.
 *   2. **`alg` agreeing with the curve.** `ES384` means P-384 + SHA-384. A
 *      keypair on P-256 under an `ES384` header is a silent mismatch.
 *   3. **`aud` being the invoke URL and not the origin.** The easy mistake, and
 *      it surfaces as a flat 401 with no hint which half is wrong.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CDS_CLIENT_ID,
  JWKS_PATH,
  generateSigningKey,
  mintCdsToken,
  publicJwks,
  type CdsSigningKey,
} from '../../mock-ehr/src/cdsClient'
import app from './index'
import type { CdsJwtEnv } from './auth'
import type { CdsServiceResponse } from '@spier/core/lib/cdsHooks/types'

const BASE = 'http://cds.test'
const INVOKE = `${BASE}/cds-services/spier-patient-view`
const FEEDBACK = `${INVOKE}/feedback`

/** Stands in for the deployed mock EHR's origin. */
const HOST_ORIGIN = 'https://host.test'
const HOST_JWKS_URL = `${HOST_ORIGIN}${JWKS_PATH}`

let hostKey: CdsSigningKey
/** A key the host generated but never published — the forgery case. */
let unpublishedKey: CdsSigningKey

const fetchMock = vi.fn()
const realFetch = globalThis.fetch

beforeAll(async () => {
  hostKey = await generateSigningKey()
  unpublishedKey = await generateSigningKey()

  // Serve the host's JWK Set exactly as its route does — `publicJwks` is the
  // same function `app.get(JWKS_PATH)` returns, so a change to what is
  // published moves both sides of this test together.
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === HOST_JWKS_URL) {
      return new Response(JSON.stringify(publicJwks(hostKey)), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('not found', { status: 404 })
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterAll(() => {
  globalThis.fetch = realFetch
})

/**
 * The policy `services/cds/wrangler.jsonc` deploys, with the two origins
 * swapped for test ones.
 *
 * ⚠️ `CDS_JWT_JKU_ALLOWED_HOSTS` is set because the deployed policy sets it and
 * the host's tokens carry `jku`. That puts the SSRF guard on the path this test
 * exercises rather than only on `auth.test.ts`'s negative cases.
 */
const DEPLOYED_POLICY: CdsJwtEnv = {
  CDS_JWT_ENFORCE: 'require',
  CDS_JWT_AUDIENCE: INVOKE,
  CDS_JWT_TRUSTED_ISSUERS: HOST_ORIGIN,
  CDS_JWT_JWKS_URL: HOST_JWKS_URL,
  CDS_JWT_JKU_ALLOWED_HOSTS: new URL(HOST_ORIGIN).host,
}

function env(policy: CdsJwtEnv = DEPLOYED_POLICY) {
  return { SMART_LAUNCH_URL: 'https://clinical.test/', ...policy }
}

/** A token shaped exactly as `POST /_admin/cds` in the mock EHR mints one. */
function hostToken(key: CdsSigningKey = hostKey, aud: string = INVOKE) {
  return mintCdsToken(key, {
    iss: HOST_ORIGIN,
    sub: DEFAULT_CDS_CLIENT_ID,
    aud,
    jku: HOST_JWKS_URL,
  })
}

function invoke(token: string, policy?: CdsJwtEnv) {
  return app.request(
    INVOKE,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        hook: 'patient-view',
        hookInstance: crypto.randomUUID(),
        context: { patientId: 'patient-003' },
      }),
    },
    env(policy),
  )
}

describe('the mock EHR as a registered CDS Client', () => {
  it('invokes successfully with a token it minted itself', async () => {
    const res = await invoke(await hostToken())
    expect(res.status).toBe(200)
    const body = (await res.json()) as CdsServiceResponse
    expect(body.cards.length).toBeGreaterThan(0)
  })

  it('is accepted on feedback too', async () => {
    const res = await app.request(
      FEEDBACK,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await hostToken()}`,
        },
        body: JSON.stringify({ feedback: [] }),
      },
      env(),
    )
    expect(res.status).toBe(200)
  })

  it('resolves the key through the jku header, not just the configured URL', async () => {
    // Drop CDS_JWT_JWKS_URL so the ONLY path to a key is the token's own `jku`
    // plus the host allowlist. This is what proves the allowlist is permitting
    // rather than the fixed URL quietly carrying every case.
    const res = await invoke(await hostToken(), {
      ...DEPLOYED_POLICY,
      CDS_JWT_JWKS_URL: '',
    })
    expect(res.status).toBe(200)
  })

  it('is rejected when the host is not an allowlisted jku AND no URL is configured', async () => {
    const res = await invoke(await hostToken(), {
      ...DEPLOYED_POLICY,
      CDS_JWT_JWKS_URL: '',
      CDS_JWT_JKU_ALLOWED_HOSTS: 'somewhere.else',
    })
    expect(res.status).toBe(401)
    // The SSRF guard must refuse BEFORE fetching. If it had fetched, the mock
    // would have been asked for a URL it does not serve.
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ href: HOST_JWKS_URL }),
      expect.anything(),
    )
  })
})

describe('the handshake fails where it should', () => {
  it('rejects a token signed with a key the host never published', async () => {
    // Same issuer, same claims, same `kid` scheme — only the private half
    // differs. This is the case a forged identity would present.
    const res = await invoke(await hostToken(unpublishedKey))
    expect(res.status).toBe(401)
  })

  it('rejects `aud` set to the service ORIGIN rather than the invoke URL', async () => {
    // The mistake this is guarding is a one-word edit in the mock EHR's
    // /_admin/cds route (`cdsOrigin` instead of `endpoint`), and its only
    // symptom in a browser is cards that stop appearing.
    const res = await invoke(await hostToken(hostKey, BASE))
    expect(res.status).toBe(401)
  })

  it('rejects an unsigned call outright — the endpoint is not open compute', async () => {
    const res = await app.request(
      INVOKE,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hook: 'patient-view', hookInstance: 'x', context: {} }),
      },
      env(),
    )
    expect(res.status).toBe(401)
  })

  it('still answers discovery without a token', async () => {
    // A client fetches discovery before it holds anything to present. If this
    // ever 401s, `require` has been applied one route too wide.
    const res = await app.request(`${BASE}/cds-services`, {}, env())
    expect(res.status).toBe(200)
  })
})
