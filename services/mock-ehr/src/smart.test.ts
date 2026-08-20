/**
 * The SMART stub. Most of these are cases where a lenient stub still "works" —
 * the login succeeds, the demo runs, and the thing it was supposed to prove
 * quietly went unproven.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import app from './app'
import { authorize, mintLaunch, smartConfiguration, token } from './smart'
import { resetSpentCodes, s256, sign } from './tokens'
import { TEST_CLIENT_ID, TEST_REDIRECT_URI, launchFor } from './__fixtures__/launch'

const BASE = 'https://mock-ehr.test'
const FHIR_BASE = `${BASE}/fhir`

beforeEach(() => resetSpentCodes())

/** Authorize params that pass, so each test can spoil exactly one thing. */
async function goodParams(overrides: Record<string, string | undefined> = {}) {
  const verifier = 'a'.repeat(64)
  const base: Record<string, string> = {
    response_type: 'code',
    client_id: TEST_CLIENT_ID,
    scope: 'launch patient/Patient.read',
    redirect_uri: TEST_REDIRECT_URI,
    aud: FHIR_BASE,
    state: 'opaque-state',
    code_challenge: await s256(verifier),
    code_challenge_method: 'S256',
    patient: 'patient-011',
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete base[key]
    else base[key] = value
  }
  return { params: new URLSearchParams(base), verifier }
}

describe('discovery', () => {
  it('advertises S256 — without which the client sends no PKCE at all', async () => {
    // ⚠️ The trap this asserts: fhirclient only sends a code_challenge when
    // `code_challenge_methods_supported` includes S256. Drop it and PKCE
    // silently stops happening while every test that only checks "login works"
    // stays green.
    const config = smartConfiguration(BASE)
    expect(config.code_challenge_methods_supported).toEqual(['S256'])
    expect(config.authorization_endpoint).toBe(`${BASE}/authorize`)
    expect(config.token_endpoint).toBe(`${BASE}/token`)
  })

  it('is served pre-auth, like /metadata', async () => {
    for (const path of ['/fhir/.well-known/smart-configuration', '/fhir/metadata']) {
      const res = await app.request(`${BASE}${path}`)
      expect(res.status, path).toBe(200)
    }
  })
})

describe('/authorize', () => {
  it('issues a code for a valid request, echoing state', async () => {
    const { params } = await goodParams()
    const result = await authorize(params, {}, FHIR_BASE)
    expect(result.kind).toBe('redirect')
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.origin + url.pathname).toBe(TEST_REDIRECT_URI)
    expect(url.searchParams.get('state')).toBe('opaque-state')
    expect(url.searchParams.get('code')).toBeTruthy()
  })

  it('REFUSES rather than redirects an unregistered redirect_uri', async () => {
    // The classic OAuth stub bug: bouncing an error to whatever URI was asked
    // for turns the authorization endpoint into an open redirect.
    const { params } = await goodParams({ redirect_uri: 'https://evil.test/steal' })
    const result = await authorize(params, {}, FHIR_BASE)
    expect(result.kind).toBe('refuse')
    expect(result.kind === 'refuse' && result.status).toBe(400)
  })

  it('REFUSES an unregistered client_id without redirecting', async () => {
    const { params } = await goodParams({ client_id: 'somebody-else' })
    const result = await authorize(params, {}, FHIR_BASE)
    expect(result.kind).toBe('refuse')
  })

  it('rejects a request with no PKCE challenge', async () => {
    const { params } = await goodParams({ code_challenge: undefined, code_challenge_method: undefined })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_request')
    expect(url.searchParams.get('code')).toBeNull()
  })

  it('rejects a plain (non-S256) challenge method', async () => {
    const { params } = await goodParams({ code_challenge_method: 'plain' })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_request')
  })

  it('rejects an aud naming a different server', async () => {
    const { params } = await goodParams({ aud: 'https://someone-elses-ehr.test/fhir' })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_request')
  })

  it('rejects a request with no launch context at all', async () => {
    const { params } = await goodParams({ patient: undefined })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_request')
  })

  it('resolves a minted launch context, and refuses an expired one', async () => {
    const launch = await mintLaunch({ patient: 'patient-012', intent: 'open-cssrs-full' }, {})
    const { params } = await goodParams({ patient: undefined, launch })
    const ok = await authorize(params, {}, FHIR_BASE)
    expect(new URL(ok.kind === 'redirect' ? ok.location : '').searchParams.get('code')).toBeTruthy()

    // 10-minute TTL; look at it an hour later.
    const { params: later } = await goodParams({ patient: undefined, launch })
    const expired = await authorize(later, {}, FHIR_BASE, Date.now() + 3_600_000)
    expect(new URL(expired.kind === 'redirect' ? expired.location : '').searchParams.get('error')).toBe('invalid_request')
  })

  it('refuses a launch context signed with someone else’s secret', async () => {
    const forged = await sign({ patient: 'patient-011', exp: Math.floor(Date.now() / 1000) + 600 }, 'not-our-secret')
    const { params } = await goodParams({ patient: undefined, launch: forged })
    const result = await authorize(params, { MOCK_SIGNING_SECRET: 'ours' }, FHIR_BASE)
    expect(new URL(result.kind === 'redirect' ? result.location : '').searchParams.get('error')).toBe('invalid_request')
  })
})

describe('/token', () => {
  async function codeFor(overrides?: Record<string, string | undefined>) {
    const { params, verifier } = await goodParams(overrides)
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    return { code: url.searchParams.get('code') ?? '', verifier }
  }

  function form(fields: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) params.set(k, v)
    return params
  }

  it('exchanges a code for a token bound to the launch patient', async () => {
    const { code, verifier } = await codeFor()
    const result = await token(form({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      code_verifier: verifier,
    }), {})
    expect(result.ok).toBe(true)
    expect(result.ok && result.body).toMatchObject({
      token_type: 'Bearer',
      patient: 'patient-011',
      expires_in: 3600,
    })
  })

  it('rejects a WRONG code_verifier — the assertion PKCE exists for', async () => {
    const { code } = await codeFor()
    const result = await token(form({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      code_verifier: 'b'.repeat(64),
    }), {})
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.description).toContain('code_verifier')
  })

  it('rejects a missing code_verifier', async () => {
    const { code } = await codeFor()
    const result = await token(form({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
    }), {})
    expect(result.ok).toBe(false)
  })

  it('rejects a replayed code (best-effort, same isolate)', async () => {
    const { code, verifier } = await codeFor()
    const fields = form({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      code_verifier: verifier,
    })
    expect((await token(fields, {})).ok).toBe(true)
    const replayed = await token(fields, {})
    expect(replayed.ok).toBe(false)
    expect(replayed.ok === false && replayed.description).toContain('already been redeemed')
  })

  it('rejects a redirect_uri or client_id that changed between the two calls', async () => {
    const { code, verifier } = await codeFor()
    const swapped = await token(form({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:4173/',
      client_id: TEST_CLIENT_ID,
      code_verifier: verifier,
    }), {})
    expect(swapped.ok).toBe(false)

    const { code: code2, verifier: verifier2 } = await codeFor()
    const otherClient = await token(form({
      grant_type: 'authorization_code',
      code: code2,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: 'someone-else',
      code_verifier: verifier2,
    }), {})
    expect(otherClient.ok).toBe(false)
  })

  it('rejects an expired code', async () => {
    const { code, verifier } = await codeFor()
    const result = await token(form({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      code_verifier: verifier,
    }), {}, undefined, Date.now() + 120_000) // 60s TTL
    expect(result.ok).toBe(false)
  })

  it('rejects an unsupported grant type', async () => {
    const result = await token(form({ grant_type: 'client_credentials' }), {})
    expect(result.ok === false && result.error).toBe('unsupported_grant_type')
  })

  it('passes intent and need_patient_banner through to the app', async () => {
    const launch = await mintLaunch(
      { patient: 'patient-011', intent: 'open-cssrs-full', needPatientBanner: false },
      {},
    )
    const { tokenResponse } = await launchFor(BASE, { launch })
    expect(tokenResponse.intent).toBe('open-cssrs-full')
    expect(tokenResponse.need_patient_banner).toBe(false)
  })

  it('is uncacheable, per OAuth 2', async () => {
    const { code, verifier } = await codeFor()
    const res = await app.request(`${BASE}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({
        grant_type: 'authorization_code',
        code,
        redirect_uri: TEST_REDIRECT_URI,
        client_id: TEST_CLIENT_ID,
        code_verifier: verifier,
      }).toString(),
    })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

describe('the bearer check on /fhir', () => {
  it('401s an unauthenticated read, with WWW-Authenticate', async () => {
    const res = await app.request(`${BASE}/fhir/Patient/patient-011`)
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('Bearer')
  })

  it('401s a forged token', async () => {
    const forged = await sign({ patient: 'patient-011', scope: '', exp: Math.floor(Date.now() / 1000) + 600 }, 'wrong')
    const res = await app.request(`${BASE}/fhir/Patient/patient-011`, {
      headers: { authorization: `Bearer ${forged}` },
    })
    expect(res.status).toBe(401)
  })

  it('403s a token reaching for another patient', async () => {
    // Without this the demo would hand out one token that reads all 14 charts,
    // and "patient-scoped" would be a claim this server does not support.
    const { accessToken } = await launchFor(BASE, { patient: 'patient-011' })
    const headers = { authorization: `Bearer ${accessToken}` }
    const search = await app.request(`${BASE}/fhir/Observation?patient=patient-001`, { headers })
    expect(search.status).toBe(403)
    const read = await app.request(`${BASE}/fhir/Patient/patient-001`, { headers })
    expect(read.status).toBe(403)
    const own = await app.request(`${BASE}/fhir/Patient/patient-011`, { headers })
    expect(own.status).toBe(200)
  })

  it('can be switched off for exploration, and says so on the control page', async () => {
    const open = await app.request(`${BASE}/fhir/Patient/patient-011`, {}, { MOCK_AUTH_ENFORCE: 'off' })
    expect(open.status).toBe(200)
    const page = await (await app.request(`${BASE}/`, {}, { MOCK_AUTH_ENFORCE: 'off' })).text()
    expect(page).toContain('OFF')
  })
})

describe('/_admin/launch', () => {
  it('mints a launch URL an EHR would open', async () => {
    const res = await app.request(`${BASE}/_admin/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patient: 'patient-011', intent: 'open-cssrs-full' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { launchUrl: string; launch: string }
    const url = new URL(body.launchUrl)
    // SMART EHR launch: iss + launch on the app's launch_uri.
    expect(url.searchParams.get('iss')).toBe(`${BASE}/fhir`)
    expect(url.searchParams.get('launch')).toBe(body.launch)
    expect(url.hash).toBe('#/launch')
  })

  it('refuses a patient this server does not hold', async () => {
    const res = await app.request(`${BASE}/_admin/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patient: 'patient-999' }),
    })
    expect(res.status).toBe(400)
  })
})
