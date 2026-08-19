/**
 * app — the mock EHR's HTTP surface.
 *
 *   GET  /fhir/.well-known/smart-configuration  discovery
 *   GET  /fhir/metadata           CapabilityStatement (the degradation switch)
 *   GET  /fhir/{Type}/{id}        read
 *   GET  /fhir/{Type}?patient=…   patient-scoped search → searchset Bundle
 *   GET  /authorize               SMART authorization (PKCE S256 required)
 *   POST /token                   authorization_code → access token
 *   GET  /                        control page: capability profile + launch
 *   GET  /_admin/capabilities     the profile, as JSON
 *   PUT  /_admin/capabilities     set it
 *   POST /_admin/launch           mint a launch context + the app's launch URL
 *
 * ── Deliberately absent ─────────────────────────────────────────────────────
 * No writes (step 4). No `id_token` and no scope enforcement — see the header
 * of smart.ts, which says exactly what the auth stub does and does not prove.
 *
 * ── CORS is not optional here ───────────────────────────────────────────────
 * The panel is a browser app on a DIFFERENT origin talking to this server
 * directly — that cross-origin split is the point of the exercise, not an
 * accident. Without these headers every read fails in the browser while every
 * curl succeeds, which is the most misleading way for this to break.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  CAPABILITY_PROFILES,
  PROFILE_DESCRIPTIONS,
  buildCapabilityStatement,
  creatableTypes,
  isCapabilityProfile,
  type CapabilityProfile,
} from './capability'
import { HELD_RESOURCES, HELD_TYPES, PATIENT_IDS, RESOURCES_BY_KEY, type MockResource } from './fixtures'
import { SEARCHABLE_TYPES, applySearch, parseSearch } from './search'
import { controlPage } from './controlPage'
import {
  authRequired,
  authorize,
  grantFor,
  mintLaunch,
  smartConfiguration,
  token,
  type Grant,
  type SmartEnv,
} from './smart'

export interface Env extends SmartEnv {
  /** Profile a freshly started isolate begins with (wrangler.jsonc `vars`). */
  MOCK_CAPABILITY_PROFILE?: string
  /** Where the panel app lives, for the launch URL the control page builds. */
  MOCK_PANEL_BASE_URL?: string
}

/** Default panel origin for a minted launch URL; overridden by the env var. */
const DEFAULT_PANEL_BASE_URL = 'https://spier-adoption-guide.bbthorson.workers.dev/'

const FHIR_JSON = 'application/fhir+json'

/**
 * `c.env` is undefined when the app is driven through `app.request()` with no
 * env — which is how every test calls it, and how a misconfigured deploy would
 * behave too. Reading a var off undefined throws inside middleware and surfaces
 * as a 500, which is the least informative failure available; normalize once.
 */
function envOf(c: { env?: Env }): Env {
  return c.env ?? {}
}

// The live profile. Per-isolate and non-durable by design — see capability.ts.
let activeProfile: CapabilityProfile | null = null

export function getProfile(env: Env = {}): CapabilityProfile {
  if (activeProfile) return activeProfile
  return isCapabilityProfile(env.MOCK_CAPABILITY_PROFILE) ? env.MOCK_CAPABILITY_PROFILE : 'full'
}

export function setProfile(profile: CapabilityProfile): void {
  activeProfile = profile
}

/** Test seam: forget the runtime override so each test starts from the env. */
export function resetProfile(): void {
  activeProfile = null
}

function fhirBase(url: string): string {
  return `${new URL(url).origin}/fhir`
}

function operationOutcome(severity: 'error' | 'warning', code: string, diagnostics: string) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  }
}

/**
 * A searchset Bundle, which is what `client.request(url, { flat: true })`
 * unwraps. ⚠️ No `link` entry: `pageLimit: 0` means fhirclient follows every
 * `next` it is given, so emitting a link this server cannot serve would loop
 * the client rather than fail it.
 */
function searchset(resources: MockResource[], base: string) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map(resource => ({
      fullUrl: `${base}/${resource.resourceType}/${resource.id}`,
      resource,
      search: { mode: 'match' },
    })),
  }
}

const app = new Hono<{ Bindings: Env; Variables: { grant?: Grant } }>()

// The panel is on another origin, so every endpoint it touches needs CORS —
// including /token, which it POSTs to directly as a public client. A preflight
// failure here looks exactly like a broken login.
const apiCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
})
app.use('/fhir', apiCors)
app.use('/fhir/*', apiCors)
app.use('/token', apiCors)

// ── Bearer check ─────────────────────────────────────────────────────────────
// Everything under /fhir except discovery and /metadata, which are pre-auth by
// definition: a client reads them to find out how to authorize at all.
app.use('/fhir/*', async (c, next) => {
  const path = c.req.path
  if (path.endsWith('/metadata') || path.includes('/.well-known/')) return next()
  if (!authRequired(envOf(c))) return next()

  const grant = await grantFor(c.req.header('authorization'), envOf(c))
  if (!grant) {
    c.header('content-type', FHIR_JSON)
    c.header('www-authenticate', 'Bearer realm="SPiER mock EHR"')
    return c.body(
      JSON.stringify(operationOutcome('error', 'login', 'A valid SMART access token is required. Launch via /authorize.')),
      401,
    )
  }
  c.set('grant', grant)
  return next()
})

// ── Discovery + capability (both pre-auth) ───────────────────────────────────

app.get('/fhir/.well-known/smart-configuration', (c) => {
  c.header('content-type', 'application/json')
  return c.body(JSON.stringify(smartConfiguration(new URL(c.req.url).origin)))
})

app.get('/fhir/metadata', (c) => {
  const statement = buildCapabilityStatement(getProfile(envOf(c)), HELD_TYPES, fhirBase(c.req.url))
  c.header('content-type', FHIR_JSON)
  return c.body(JSON.stringify(statement))
})

// ── Read ─────────────────────────────────────────────────────────────────────

app.get('/fhir/:type/:id', (c) => {
  const { type, id } = c.req.param()
  const resource = RESOURCES_BY_KEY.get(`${type}/${id}`)
  c.header('content-type', FHIR_JSON)
  // A token is bound to one patient. Reading a Patient it was not issued for is
  // a 403 — otherwise "patient-scoped" would be a claim this server does not
  // support. (Non-Patient reads are not checked here: this server's search is
  // the patient-scoped surface, and a read-by-id is reached from one.)
  const denied = denyForeignPatient(c, type === 'Patient' ? id : undefined)
  if (denied) return denied
  if (!resource) {
    return c.body(
      JSON.stringify(operationOutcome('error', 'not-found', `No ${type} with id '${id}' on this server.`)),
      404,
    )
  }
  return c.body(JSON.stringify(resource))
})

// ── Search ───────────────────────────────────────────────────────────────────

app.get('/fhir/:type', (c) => {
  const type = c.req.param('type')
  c.header('content-type', FHIR_JSON)

  if (!SEARCHABLE_TYPES.includes(type)) {
    // 404, not an empty Bundle: an empty Bundle for a type this server does not
    // implement is indistinguishable from a patient who has none of them.
    return c.body(
      JSON.stringify(operationOutcome(
        'error',
        'not-supported',
        `This server does not implement search for '${type}'. Searchable: ${SEARCHABLE_TYPES.join(', ')}.`,
      )),
      404,
    )
  }

  const parsed = parseSearch(new URL(c.req.url).searchParams)
  if (!parsed.ok) {
    return c.body(JSON.stringify(operationOutcome('error', 'invalid', parsed.diagnostics)), parsed.status)
  }

  const denied = denyForeignPatient(c, parsed.query.patientId)
  if (denied) return denied

  const matches = applySearch(HELD_RESOURCES.map(h => h.resource), type, parsed.query)
  return c.body(JSON.stringify(searchset(matches, fhirBase(c.req.url))))
})

/**
 * 403 when the request asks about a patient the bearer token was not issued
 * for. Returns null when there is no grant (enforcement off) or the patient
 * matches.
 */
function denyForeignPatient(
  c: { get: (key: 'grant') => Grant | undefined; body: (body: string, status?: 403) => Response },
  patientId: string | undefined,
): Response | null {
  const grant = c.get('grant')
  if (!grant || !patientId || grant.patient === patientId) return null
  return c.body(
    JSON.stringify(operationOutcome(
      'error',
      'forbidden',
      `This access token is scoped to patient '${grant.patient}' and cannot read '${patientId}'.`,
    )),
    403,
  )
}

// ── SMART authorization ──────────────────────────────────────────────────────

app.get('/authorize', async (c) => {
  const result = await authorize(new URL(c.req.url).searchParams, envOf(c), `${new URL(c.req.url).origin}/fhir`)
  if (result.kind === 'redirect') return c.redirect(result.location, 302)
  // Refusals are rendered rather than redirected — see AuthorizeResult.
  return c.json({ error: result.error, error_description: result.description }, result.status)
})

app.post('/token', async (c) => {
  const form = new URLSearchParams(await c.req.text())
  const result = await token(form, envOf(c))
  // OAuth 2 requires token responses to be uncacheable.
  c.header('cache-control', 'no-store')
  c.header('pragma', 'no-cache')
  if (!result.ok) {
    return c.json({ error: result.error, error_description: result.description }, result.status as 400)
  }
  return c.json(result.body)
})

// ── Control surface ──────────────────────────────────────────────────────────

app.get('/_admin/capabilities', (c) => {
  const profile = getProfile(envOf(c))
  return c.json({
    profile,
    description: PROFILE_DESCRIPTIONS[profile],
    creates: creatableTypes(profile),
    available: CAPABILITY_PROFILES.map(p => ({ profile: p, description: PROFILE_DESCRIPTIONS[p] })),
    durable: false,
  })
})

app.put('/_admin/capabilities', async (c) => {
  const body = await c.req.json<{ profile?: unknown }>().catch(() => ({ profile: undefined }))
  if (!isCapabilityProfile(body?.profile)) {
    return c.json(
      { error: `profile must be one of: ${CAPABILITY_PROFILES.join(', ')}` },
      400,
    )
  }
  setProfile(body.profile)
  return c.json({ profile: body.profile, creates: creatableTypes(body.profile), durable: false })
})

/**
 * Mint a launch context and the URL an EHR would open. This is the step-5
 * launch button's engine, built here because without it nothing can be
 * launched at all — step 5 adds the chart around it, not the mechanism.
 */
app.post('/_admin/launch', async (c) => {
  const body = await c.req.json<{
    patient?: unknown
    intent?: unknown
    needPatientBanner?: unknown
  }>().catch(() => ({} as { patient?: unknown; intent?: unknown; needPatientBanner?: unknown }))
  const patient = typeof body.patient === 'string' ? body.patient : ''
  if (!RESOURCES_BY_KEY.has(`Patient/${patient}`)) {
    return c.json({ error: `Unknown patient '${patient}'.` }, 400)
  }
  const launch = await mintLaunch({
    patient,
    intent: typeof body.intent === 'string' && body.intent ? body.intent : undefined,
    needPatientBanner: typeof body.needPatientBanner === 'boolean' ? body.needPatientBanner : undefined,
  }, envOf(c))

  const origin = new URL(c.req.url).origin
  const panelBase = envOf(c).MOCK_PANEL_BASE_URL || DEFAULT_PANEL_BASE_URL
  // SMART EHR launch: the EHR opens the app's launch_uri with `iss` + `launch`.
  // The app's launch screen is under its hash router, and main.tsx routes the
  // real query string into it.
  const launchUrl = `${panelBase}?iss=${encodeURIComponent(`${origin}/fhir`)}&launch=${encodeURIComponent(launch)}#/launch`
  return c.json({ launch, launchUrl, patient })
})

app.get('/', (c) => c.html(controlPage(
  getProfile(envOf(c)),
  fhirBase(c.req.url),
  HELD_RESOURCES.length,
  PATIENT_IDS,
  authRequired(envOf(c)),
)))

app.all('*', (c) => {
  c.header('content-type', FHIR_JSON)
  return c.body(
    JSON.stringify(operationOutcome('error', 'not-found', `No route for ${c.req.method} ${new URL(c.req.url).pathname}. The FHIR base is /fhir.`)),
    404,
  )
})

export default app
