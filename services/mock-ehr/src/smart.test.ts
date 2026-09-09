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

  it('a patient-context-free CLINICAL search is refused by the SEARCH layer, not by scope', async () => {
    // Worth pinning, because the obvious guess is wrong and it changed what #404
    // had to build. `parseSearch` requires `patient` for every clinical type, so
    // an unscoped Observation search is a 400 BEFORE auth is consulted. There was
    // never a hole where a patient-bound token could enumerate every chart by
    // omitting the parameter — so no scope check belongs here, and one written
    // here would be unreachable code.
    //
    // ⚠️ #401 added exactly ONE unscoped search — the roster, `GET /fhir/Patient`
    // — and the two tests below are what keep that from widening. This one still
    // covers every other type.
    const { accessToken } = await launchFor(BASE, { patient: 'patient-011' })
    const headers = { authorization: `Bearer ${accessToken}` }
    const cohort = await app.request(`${BASE}/fhir/Observation`, { headers })
    expect(cohort.status).toBe(400)
    expect(await cohort.text()).toContain('every clinical type is patient-scoped')
  })

  it('refuses the ROSTER search to a chart token — it is not a cohort grant', async () => {
    // The roster is the one unscoped search, and a patient-bound token still may
    // not run it: it would enumerate every patient on the server for a token
    // whose whole point is being scoped to one.
    const { accessToken } = await launchFor(BASE, { patient: 'patient-011' })
    const roster = await app.request(`${BASE}/fhir/Patient`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    // 403, not 400: the query is one this server implements, and the token is
    // what it will not honour it for.
    expect(roster.status).toBe(403)
  })

  it('serves the ROSTER to a worklist token, and still refuses an unscoped Observation search', async () => {
    // Both halves matter. The first is what makes a population app possible; the
    // second is what stops "may cross patients" from quietly meaning "may search
    // the whole server for anything".
    const { accessToken } = await launchFor(BASE, {
      launch: await mintLaunch({ userScoped: true }, {}),
      scope: 'launch user/*.read',
    })
    const headers = { authorization: `Bearer ${accessToken}` }

    const roster = await app.request(`${BASE}/fhir/Patient`, { headers })
    expect(roster.status).toBe(200)
    const bundle = await roster.json() as { entry?: unknown[] }
    expect(bundle.entry?.length).toBe(14)

    const observations = await app.request(`${BASE}/fhir/Observation`, { headers })
    expect(observations.status).toBe(400)
  })

  it('lets a user/… scope read ANOTHER patient, which is the worklist grant', async () => {
    // The ONLY scope axis this server enforces (#404 option A). SPiER's own
    // registry read is N per-patient searches, so "may this token read a patient
    // other than its own" is exactly the permission a worklist needs.
    //
    // ⚠️ **Launched with a `userScoped` context, and it has to be.** This test
    // used to attach `user/*.read` to a PATIENT launch, because before #401 that
    // was the only way to obtain the scope at all. `authorize` now drops
    // `user/…` from a patient context — otherwise SPiER's client, which requests
    // one superset scope string on every launch, would hand every chart token
    // cross-patient permission. So the grant is obtained the way a worklist app
    // really obtains it.
    const { accessToken } = await launchFor(BASE, {
      launch: await mintLaunch({ userScoped: true }, {}),
      scope: 'launch openid fhirUser user/*.read',
    })
    const headers = { authorization: `Bearer ${accessToken}` }

    const foreignSearch = await app.request(`${BASE}/fhir/Observation?patient=patient-001`, { headers })
    expect(foreignSearch.status).toBe(200)
    const foreignRead = await app.request(`${BASE}/fhir/Patient/patient-001`, { headers })
    expect(foreignRead.status).toBe(200)
  })

  it('still refuses the same cross-patient read WITHOUT a user/… scope', async () => {
    // The negative half. Without it the test above proves only that something
    // returned 200.
    const { accessToken } = await launchFor(BASE, {
      patient: 'patient-011',
      scope: 'launch openid fhirUser patient/Patient.read patient/Observation.read',
    })
    const headers = { authorization: `Bearer ${accessToken}` }
    const search = await app.request(`${BASE}/fhir/Observation?patient=patient-001`, { headers })
    expect(search.status).toBe(403)
    expect(await search.text()).toContain("needs a 'user/…' scope")
  })

  it('does NOT interpret per-resource-type scopes, deliberately', async () => {
    // #404 chose option A: the patient-crossing axis only. A token with no
    // Observation scope can still read its own patient's Observations, and
    // smart.ts says so — a half-correct scope implementation is worse than none,
    // because it looks like it proves something.
    const { accessToken } = await launchFor(BASE, {
      patient: 'patient-011',
      scope: 'launch openid fhirUser patient/Patient.read',
    })
    const headers = { authorization: `Bearer ${accessToken}` }
    const res = await app.request(`${BASE}/fhir/Observation?patient=patient-011`, { headers })
    expect(res.status).toBe(200)
  })

  it('can be switched off for exploration, and says so on the control page', async () => {
    const open = await app.request(`${BASE}/fhir/Patient/patient-011`, {}, { MOCK_AUTH_ENFORCE: 'off' })
    expect(open.status).toBe(200)
    // The control page is /settings now, not the front door.
    const page = await (await app.request(`${BASE}/settings`, {}, { MOCK_AUTH_ENFORCE: 'off' })).text()
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

/**
 * The worklist grant: an EHR launch whose context names NO patient (#401).
 *
 * ⚠️ **The negative cases here are the file's point, not padding.** A
 * patient-less token reads every patient on this server, so the interesting
 * question is never "does the happy path work" — it is whether the ways to get
 * one by accident are closed. Three of them are: a context with both a patient
 * and the flag, a context with neither (a chart launch that lost its patient),
 * and a worklist launch that asked for no cross-patient scope and would have
 * produced a token that 403s on its first read.
 */
describe('the worklist grant — a launch with no patient (#401)', () => {
  const WORKLIST_SCOPE = 'launch openid fhirUser user/*.read'

  /** An EHR launch context with no patient, the way /_admin/launch mints one. */
  const worklistLaunch = () => mintLaunch({ userScoped: true }, {})

  it('mints a token with NO patient bound, carrying the cross-patient scope', async () => {
    const { tokenResponse } = await launchFor(BASE, {
      launch: await worklistLaunch(),
      scope: WORKLIST_SCOPE,
    })
    // Absent, not empty-string and not null — the app decides whether it has a
    // patient in context by looking for this key.
    expect('patient' in tokenResponse).toBe(false)
    expect(tokenResponse.scope).toContain('user/*.read')
  })

  it('reads TWO different patients on one token — the thing a chart token cannot do', async () => {
    const { accessToken } = await launchFor(BASE, {
      launch: await worklistLaunch(),
      scope: WORKLIST_SCOPE,
    })
    const auth = { authorization: `Bearer ${accessToken}` }
    for (const id of ['patient-001', 'patient-002']) {
      const res = await app.request(`${BASE}/fhir/Patient/${id}`, { headers: auth })
      expect(res.status, id).toBe(200)
    }
    // And a per-patient search, which is how SPiER's registry read actually
    // walks a cohort (N searches, not one cohort query — that is #401 Phase C).
    const search = await app.request(`${BASE}/fhir/Observation?patient=patient-002`, { headers: auth })
    expect(search.status).toBe(200)
  })

  it('still 403s the same cross-patient read on a PATIENT-scoped token', async () => {
    // The planted opposite of the test above. If this ever passes, the worklist
    // grant did not gain a capability — `denyForeignPatient` lost one, and every
    // chart launch in the demo can now read the whole server.
    const { accessToken } = await launchFor(BASE, { patient: 'patient-001' })
    const res = await app.request(`${BASE}/fhir/Patient/patient-002`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('DROPS patient/… scopes from the grant, and reports what it granted', async () => {
    // A `patient/…` scope with no patient bound is a contradiction. Narrowing the
    // grant and returning the narrowed scope is RFC 6749 §3.3's own model.
    const { tokenResponse } = await launchFor(BASE, {
      launch: await worklistLaunch(),
      scope: 'launch user/*.read patient/Observation.read patient/CarePlan.write',
    })
    expect(tokenResponse.scope).toBe('launch user/*.read')
  })

  it('refuses a worklist launch that asked for no cross-patient scope', async () => {
    // Without this the token authorizes nothing it can use: `mayCrossPatients`
    // says no, and every read of a patient other than "none" is a 403. Failing at
    // authorization is strictly better than failing on the first read.
    const { params } = await goodParams({
      patient: undefined,
      launch: await worklistLaunch(),
      scope: 'launch openid patient/Patient.read',
    })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_scope')
  })

  it('refuses a context carrying BOTH a patient and userScoped', async () => {
    const contradictory = await mintLaunch(
      { patient: 'patient-001', userScoped: true } as Parameters<typeof mintLaunch>[0],
      {},
    )
    const { params } = await goodParams({ patient: undefined, launch: contradictory })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_request')
    expect(url.searchParams.get('error_description')).toContain('cannot be both')
  })

  it('refuses a context with NEITHER — a chart launch that lost its patient', async () => {
    // ⚠️ The case this whole design exists for. Were absence alone enough to
    // mean "worklist", this bug would silently hand a chart launch a token that
    // reads every patient in the server, and the panel would look fine.
    const patientless = await mintLaunch({} as Parameters<typeof mintLaunch>[0], {})
    const { params } = await goodParams({ patient: undefined, launch: patientless })
    const result = await authorize(params, {}, FHIR_BASE)
    const url = new URL(result.kind === 'redirect' ? result.location : '')
    expect(url.searchParams.get('error')).toBe('invalid_request')
    expect(url.searchParams.get('error_description')).toContain('lost its patient')
  })

  it('advertises the new grant, and does NOT claim standalone launch', async () => {
    const config = smartConfiguration(BASE)
    expect(config.scopes_supported).toContain('user/*.read')
    expect(config.capabilities).toContain('permission-user')
    // The host mints the context and opens the app; the app cannot start its own
    // flow here. Advertising `launch-standalone` would be a claim with nothing
    // behind it — and the app-side entry point is Phase B, not this one.
    expect(config.capabilities).not.toContain('launch-standalone')
  })
})

/**
 * The mirror rule: a CHART launch may not keep a worklist scope (#401).
 *
 * ⚠️ **This is the test that keeps the patient boundary from evaporating.** The
 * app requests one scope string on every launch — including `user/*.read` —
 * because SMART gives it no way to know which kind of launch it is completing.
 * If `authorize` did not drop that scope for a patient context, every chart
 * token in the demo would satisfy `mayCrossPatients` and could read all fourteen
 * patients, with nothing about the panel looking different.
 */
describe('a chart launch cannot keep a user/… scope', () => {
  const SUPERSET = 'launch openid fhirUser patient/Patient.read user/*.read'

  it('drops user/… from the granted scope of a patient launch', async () => {
    const { tokenResponse } = await launchFor(BASE, { patient: 'patient-011', scope: SUPERSET })
    expect(tokenResponse.scope).toBe('launch openid fhirUser patient/Patient.read')
    expect(String(tokenResponse.scope)).not.toContain('user/')
  })

  it('still 403s a cross-patient read on that token — the boundary holds', async () => {
    const { accessToken } = await launchFor(BASE, { patient: 'patient-011', scope: SUPERSET })
    const res = await app.request(`${BASE}/fhir/Patient/patient-002`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('and cannot enumerate the roster either', async () => {
    const { accessToken } = await launchFor(BASE, { patient: 'patient-011', scope: SUPERSET })
    const res = await app.request(`${BASE}/fhir/Patient`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('keeps patient/… on a chart launch, so the chart still works', async () => {
    // The control: narrowing must not have removed what the chart needs.
    const { tokenResponse } = await launchFor(BASE, { patient: 'patient-011', scope: SUPERSET })
    expect(String(tokenResponse.scope)).toContain('patient/Patient.read')
  })
})
