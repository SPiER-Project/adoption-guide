/**
 * Bearer-JWT validation on the invoke + feedback routes.
 *
 * These drive the real Hono app (`app.request`) with a per-test `env` so the
 * middleware sees a concrete CDS_JWT_* policy. A throwaway RSA keypair is
 * generated with `jose`; its public JWK is served from a mocked `fetch` so
 * `createRemoteJWKSet` resolves it without touching the network. The rogue
 * keypair (never published) lets us forge a bad-signature token whose `kid`
 * still resolves to the published key.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import app from './index'
import type { CdsJwtEnv } from './auth'
import type { CdsServiceResponse } from '../../../web/src/lib/cdsHooks/types'

const BASE = 'http://cds.test'
const INVOKE = `${BASE}/cds-services/spier-patient-view`
const FEEDBACK = `${INVOKE}/feedback`

const AUDIENCE = `${BASE}/cds-services/spier-patient-view`
const ISSUER = 'https://issuer.test'
const KID = 'test-key-1'
const JWKS_URL = 'https://keys.test/jwks.json'
const JWKS_HOST = 'keys.test'

let signingKey: CryptoKey
let roguePrivateKey: CryptoKey
let jwks: { keys: unknown[] }
const fetchMock = vi.fn()
const realFetch = globalThis.fetch

beforeAll(async () => {
  const good = await generateKeyPair('RS256', { extractable: true })
  const rogue = await generateKeyPair('RS256', { extractable: true })
  signingKey = good.privateKey
  roguePrivateKey = rogue.privateKey

  const jwk = await exportJWK(good.publicKey)
  jwk.kid = KID
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  jwks = { keys: [jwk] }

  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === JWKS_URL) {
      return new Response(JSON.stringify(jwks), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('not found', { status: 404 })
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterAll(() => {
  globalThis.fetch = realFetch
})

/** Sign a JWT, defaulting every claim/header to a happy-path value. */
async function signToken(
  overrides: {
    audience?: string
    issuer?: string
    kid?: string
    jku?: string
    jti?: string
    iatSeconds?: number
    expSeconds?: number
    key?: CryptoKey
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header: { alg: 'RS256'; kid: string; jku?: string } = {
    alg: 'RS256',
    kid: overrides.kid ?? KID,
  }
  if (overrides.jku) header.jku = overrides.jku

  const jwt = new SignJWT({})
    .setProtectedHeader(header)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setIssuer(overrides.issuer ?? ISSUER)
    .setIssuedAt(overrides.iatSeconds ?? now)
    .setExpirationTime(overrides.expSeconds ?? now + 300)
  if (overrides.jti) jwt.setJti(overrides.jti)

  return jwt.sign(overrides.key ?? signingKey)
}

/** A full Bindings env — stub ASSETS plus the JWT policy under test. */
function env(policy: CdsJwtEnv) {
  return {
    ASSETS: { fetch: async () => new Response(null) },
    ...policy,
  }
}

const invokeBody = JSON.stringify({
  hook: 'patient-view',
  hookInstance: 'test',
  context: { patientId: 'patient-006' },
})

function invoke(headers: Record<string, string>, policy: CdsJwtEnv) {
  return app.request(
    INVOKE,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: invokeBody },
    env(policy),
  )
}

const REQUIRE: CdsJwtEnv = {
  CDS_JWT_ENFORCE: 'require',
  CDS_JWT_AUDIENCE: AUDIENCE,
  CDS_JWT_TRUSTED_ISSUERS: ISSUER,
  CDS_JWT_JWKS_URL: JWKS_URL,
}

describe('enforce=off', () => {
  it('invokes tokenless (back-compat)', async () => {
    const res = await invoke({}, { CDS_JWT_ENFORCE: 'off' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as CdsServiceResponse
    expect(body.cards.length).toBeGreaterThan(0)
  })
})

describe('enforce=require', () => {
  it('rejects a missing token with 401', async () => {
    const res = await invoke({}, REQUIRE)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toMatch(/missing bearer token/i)
  })

  it('accepts a valid signed token with correct aud/iss/exp → 200 + cards', async () => {
    const token = await signToken({ jti: 'valid-1' })
    const res = await invoke({ Authorization: `Bearer ${token}` }, REQUIRE)
    expect(res.status).toBe(200)
    const body = (await res.json()) as CdsServiceResponse
    expect(body.cards.length).toBeGreaterThan(0)
  })

  it('rejects a wrong audience with 401', async () => {
    const token = await signToken({ audience: 'https://someone-else.test/invoke', jti: 'aud-1' })
    const res = await invoke({ Authorization: `Bearer ${token}` }, REQUIRE)
    expect(res.status).toBe(401)
  })

  it('rejects an expired token with 401', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await signToken({ iatSeconds: now - 3600, expSeconds: now - 1800, jti: 'exp-1' })
    const res = await invoke({ Authorization: `Bearer ${token}` }, REQUIRE)
    expect(res.status).toBe(401)
  })

  it('rejects a bad signature with 401', async () => {
    // Signed by the rogue key, but kid points at the published key → mismatch.
    const token = await signToken({ key: roguePrivateKey, jti: 'sig-1' })
    const res = await invoke({ Authorization: `Bearer ${token}` }, REQUIRE)
    expect(res.status).toBe(401)
  })

  it('rejects an untrusted issuer with 401', async () => {
    const token = await signToken({ issuer: 'https://evil-issuer.test', jti: 'iss-1' })
    const res = await invoke({ Authorization: `Bearer ${token}` }, REQUIRE)
    expect(res.status).toBe(401)
  })

  it('guards feedback too — no token → 401', async () => {
    const res = await app.request(
      FEEDBACK,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"feedback":[]}' },
      env(REQUIRE),
    )
    expect(res.status).toBe(401)
  })
})

describe('jku SSRF guard', () => {
  it('rejects a non-allowlisted jku host WITHOUT fetching it', async () => {
    const evilJku = 'https://evil.test/.well-known/jwks.json'
    const token = await signToken({ jku: evilJku, jti: 'jku-1' })
    const res = await invoke(
      { Authorization: `Bearer ${token}` },
      { ...REQUIRE, CDS_JWT_JKU_ALLOWED_HOSTS: JWKS_HOST },
    )
    expect(res.status).toBe(401)
    // The whole point: no outbound request to the attacker-controlled host.
    const fetchedEvil = fetchMock.mock.calls.some((call) => String(call[0]).includes('evil.test'))
    expect(fetchedEvil).toBe(false)
  })
})

describe('enforce=warn', () => {
  it('lets a bad token through with 200 (logged, not blocked)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const token = await signToken({ key: roguePrivateKey, jti: 'warn-1' })
    const res = await invoke(
      { Authorization: `Bearer ${token}` },
      { CDS_JWT_ENFORCE: 'warn', CDS_JWT_AUDIENCE: AUDIENCE, CDS_JWT_JWKS_URL: JWKS_URL },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as CdsServiceResponse
    expect(body.cards.length).toBeGreaterThan(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('lets a tokenless request through with 200', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await invoke({}, { CDS_JWT_ENFORCE: 'warn', CDS_JWT_AUDIENCE: AUDIENCE })
    expect(res.status).toBe(200)
    warn.mockRestore()
  })
})

describe('discovery stays open', () => {
  it('never requires a token, even under enforce=require', async () => {
    const res = await app.request(`${BASE}/cds-services`, {}, env(REQUIRE))
    expect(res.status).toBe(200)
  })
})
