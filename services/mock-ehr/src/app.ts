/**
 * app — the mock EHR's HTTP surface.
 *
 *   GET  /fhir/.well-known/smart-configuration  discovery
 *   GET  /fhir/metadata           CapabilityStatement (the degradation switch)
 *   GET  /fhir/{Type}/{id}        read
 *   GET  /fhir/{Type}?patient=…   patient-scoped search → searchset Bundle
 *   POST /fhir/{Type}             create — capability-gated and VALIDATED
 *   PUT  /fhir/{Type}/{id}        update-as-create, for the lifecycle types
 *   GET  /authorize               SMART authorization (PKCE S256 required)
 *   POST /token                   authorization_code → access token
 *   GET  /                        control page: capability profile + launch
 *   GET  /chart                   host chrome: the patient list
 *   GET  /chart/{id}              host chrome: one chart, with the panel framed
 *   GET  /_admin/capabilities     the profile, as JSON
 *   PUT  /_admin/capabilities     set it
 *   POST /_admin/launch           mint a launch context + the app's launch URL
 *   GET  /_admin/writes           what has been written, as JSON
 *   POST /_admin/reset            discard every write
 *   POST /fhircast                FHIRcast subscription (websocket channel)
 *   GET  /fhircast/ws             the subscribed WebSocket channel
 *   POST /fhircast/{topic}        publish a context change; hub fans it out
 *   GET  /_admin/fhircast         live hub stats
 *
 * ── Deliberately absent ─────────────────────────────────────────────────────
 * No `id_token` and no scope enforcement — see the header of smart.ts, which
 * says exactly what the auth stub does and does not prove. No update, no delete,
 * no transaction Bundle: the writeback ladder POSTs one resource at a time, and
 * an endpoint nothing exercises is an endpoint nobody has watched reject
 * anything.
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
  updatableTypes,
  type CapabilityProfile,
} from './capability'
import {
  DEMO_PATIENTS,
  DEMO_PATIENTS_BY_ID,
  HELD_RESOURCES,
  HELD_TYPES,
  PATIENT_IDS,
  RESOURCES_BY_KEY,
  type MockResource,
} from './fixtures'
import { SEARCHABLE_TYPES, applySearch, parseSearch } from './search'
import { controlPage } from './controlPage'
import { homePage, patientChartPage } from './chartPage'
import { validateWrite, withAssignedId } from './validate'
import { storeFor } from './store'
import type { DemoStore } from './demoStore'
import { parseSubscription } from './fhircastProtocol'
import type { HubNotification } from './fhircastProtocol'
// Type-only: see the header of fhircastHub.ts for why this must never become a
// value import.
import type { FhircastHub } from './fhircastHub'
import {
  authRequired,
  authorize,
  grantFor,
  mintLaunch,
  smartConfiguration,
  token,
  mayCrossPatients,
  type Grant,
  type SmartEnv,
} from './smart'

export interface Env extends SmartEnv {
  /**
   * Durable Object holding written resources and the live capability profile.
   * Absent in unit tests (which pass their own `DemoState`) and in a
   * misconfigured deploy — see `storeFor`, which refuses to fake it.
   */
  DEMO_STORE?: DurableObjectNamespace<DemoStore>
  /** The FHIRcast hub (step 6). Absent in unit tests that do not need it. */
  FHIRCAST_HUB?: DurableObjectNamespace<FhircastHub>
  /** Profile a freshly started isolate begins with (wrangler.jsonc `vars`). */
  MOCK_CAPABILITY_PROFILE?: string
  /** Where the panel app lives, for the launch URL the control page builds. */
  MOCK_PANEL_BASE_URL?: string
}

/** Default panel origin for a minted launch URL; overridden by the env var. */
const DEFAULT_PANEL_BASE_URL = 'https://spier-adoption-guide.bbthorson.workers.dev/'

/**
 * Where the panel host serves its CDS Hooks service. One Worker hosts both the
 * SPA and `/cds-services/*`, so this is a path on the panel's own origin.
 *
 * ⚠️ Hand-written here rather than imported, because importing the service
 * module would pull the whole card builder into this Worker's bundle for one
 * string. `app.test.ts` asserts it against the real `SERVICE_ID` instead, so the
 * drift is gated without the weight. (A mismatch would not fail silently — the
 * chart page renders the fetch error — but "visible in a browser" is not a gate.)
 */
const CDS_SERVICE_PATH = '/cds-services/spier-patient-view'

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

/**
 * The profile this request should answer with.
 *
 * ⚠️ **The durable value wins, and that ordering is the fix, not a preference.**
 * `getProfile` above reads module memory, which is per-isolate: an operator flips
 * the profile in whichever isolate served the control page, and the panel then
 * reads `/metadata` from whichever serves that — so the presenter says "this EHR
 * refuses Observations" while the panel is told it accepts them. Every local test
 * passes because `wrangler dev` runs one isolate. The module value survives as
 * the fallback for unit tests (no binding) and for a first request that precedes
 * any switch.
 */
async function liveProfile(c: { env?: Env }): Promise<CapabilityProfile> {
  const store = storeFor(envOf(c))
  const stored = await store?.getProfile()
  return stored ?? getProfile(envOf(c))
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
 * Everything this server can serve for a patient: the fixtures plus anything
 * written since.
 *
 * ⚠️ Written resources come LAST. `applySearch` preserves order and the app
 * renders newest-last lists, so appending is what makes a just-submitted
 * instrument appear where a clinician expects it. It also means a write cannot
 * displace a fixture, which keeps the demo re-runnable.
 */
async function servableFor(c: { env?: Env }): Promise<MockResource[]> {
  const store = storeFor(envOf(c))
  if (!store) return HELD_RESOURCES.map(h => h.resource)
  const written = await store.list()
  if (written.length === 0) return HELD_RESOURCES.map(h => h.resource)

  // ⚠️ Keyed by `Type/id`, with the written version REPLACING a fixture of the
  // same id — not appended beside it. A PUT is update-as-create, so the app
  // closing an episode that came from the fixtures sends the fixture's own id;
  // concatenating would return both versions and the chart would show the
  // episode as open and closed at once. Insertion order is preserved so a
  // just-written resource still lands after the fixtures.
  const byKey = new Map<string, MockResource>()
  for (const { resource } of HELD_RESOURCES) {
    byKey.set(`${resource.resourceType}/${String(resource.id)}`, resource)
  }
  for (const { resource } of written) {
    byKey.set(`${resource.resourceType}/${String(resource.id)}`, resource)
  }
  return [...byKey.values()]
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
  // ⚠️ PUT is here because the app uses it, and finding that out took a browser.
  // §4 of the panel plan lists only `POST /fhir/{Type}`, but
  // `SmartDataSource.saveArtifact` PUTs the LIFECYCLE types (Encounter,
  // EpisodeOfCare, Flag, Task, ServiceRequest, Appointment, Consent,
  // DocumentReference) so open→close converges on one resource instead of
  // leaving the superseded version behind. Without PUT here the browser refused
  // the preflight and the whole submit aborted — with the console error naming
  // CORS, which reads as a configuration problem rather than a missing route.
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  // ⚠️ `Prefer` is not optional here, and its absence broke nothing until step 4.
  // `SmartDataSource.create` sends `prefer: return=representation`, which makes
  // the browser preflight the POST asking for that header; a server that does not
  // list it fails the preflight, so **every write fails cross-origin while every
  // curl succeeds** — the most misleading way for this to break, and the same
  // shape as the CORS note in this file's header.
  allowHeaders: ['Content-Type', 'Authorization', 'Prefer'],
  // `Location` carries the new resource's id. fhirclient prefers the id in the
  // response body (which `return=representation` supplies), so this is a
  // fallback — but a cross-origin client cannot read an unexposed header at all,
  // and a client relying on it would see a successful write with no id.
  exposeHeaders: ['Location', 'Content-Location', 'ETag'],
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

app.get('/fhir/metadata', async (c) => {
  const statement = buildCapabilityStatement(await liveProfile(c), HELD_TYPES, fhirBase(c.req.url))
  c.header('content-type', FHIR_JSON)
  return c.body(JSON.stringify(statement))
})

// ── Read ─────────────────────────────────────────────────────────────────────

app.get('/fhir/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  // ⚠️ The merged view FIRST, not the fixtures: a PUT can replace a fixture by
  // id, and reading the fixture back would report the pre-update version of a
  // resource the client just changed. `servableFor` already resolves the
  // precedence; `RESOURCES_BY_KEY` is only the fallback for the unbound-store
  // case.
  const resource = (await servableFor(c)).find(r => r.resourceType === type && r.id === id)
    ?? RESOURCES_BY_KEY.get(`${type}/${id}`)
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

app.get('/fhir/:type', async (c) => {
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

  const matches = applySearch(await servableFor(c), type, parsed.query)
  return c.body(JSON.stringify(searchset(matches, fhirBase(c.req.url))))
})

// ── Create (step 4) ──────────────────────────────────────────────────────────

/**
 * `POST /fhir/{Type}` — the write half of the writeback ladder.
 *
 * Four refusals, in this order, and the order matters:
 *
 *   1. **Not creatable under the live capability profile → 405.** This is the
 *      degradation demo's server half. The ladder reads `/metadata` and will not
 *      even attempt an unadvertised type, so this path only fires for a client
 *      that ignored the CapabilityStatement — which is precisely why it has to
 *      exist. A server that advertises a restriction and then accepts the write
 *      anyway makes its own `/metadata` decorative, the same way an unexercised
 *      `frame-ancestors` was decorative before step 5 tested it.
 *   2. **Unparseable body → 400.**
 *   3. **Another patient's resource → 403**, via the same grant check the read
 *      path uses. A token scoped to one patient must not be able to write into
 *      another's chart.
 *   4. **Anything the shared rules object to → 422**, listing EVERY problem as
 *      an OperationOutcome issue. See validate.ts for why the rules are shared
 *      with `check-scenario-resources.mjs` rather than restated here — leniency
 *      is the specific failure this endpoint is a guardrail against.
 *
 * On success: 201, the stored representation (so `prefer: return=representation`
 * is honoured), and a `Location` header. The id is the server's, never the
 * client's — see store.ts.
 */
app.post('/fhir/:type', async (c) => {
  const type = c.req.param('type')
  c.header('content-type', FHIR_JSON)

  const checked = await checkWritable(c, type, 'create')
  if (checked.refusal) return checked.refusal
  const { store } = checked

  const body = await c.req.json<unknown>().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.body(
      JSON.stringify(operationOutcome('error', 'structure', 'Request body must be a FHIR resource object.')),
      400,
    )
  }

  const scoped = patientForWrite(c, body as MockResource)
  if ('refusal' in scoped) return scoped.refusal
  const { patientId } = scoped

  // ⚠️ The id is assigned BEFORE validation, because the shared rules require
  // one and a create must not carry one. See `withAssignedId` for why resolving
  // that the other way would have quietly loosened the scenario gate too.
  const nextId = `srv-${(await store.list()).length + 1}`
  const candidate = withAssignedId(body as MockResource, nextId)
  const problems = validateWrite(candidate, { expectedType: type, patientId })
  if (problems.length > 0) {
    return c.body(JSON.stringify({ resourceType: 'OperationOutcome', issue: problems }), 422)
  }

  const stored = await store.add(patientId, candidate)
  c.header('location', `${fhirBase(c.req.url)}/${type}/${String(stored.id)}`)
  return c.body(JSON.stringify(stored), 201)
})

/**
 * `PUT /fhir/{Type}/{id}` — update-as-create, keeping the client's id.
 *
 * ⚠️ **This endpoint exists because a browser found it, not because the plan
 * asked for it.** §4's table lists `POST /fhir/{Type}` and nothing else, and the
 * writeback ladder does only POST — but `SmartDataSource.saveArtifact` PUTs the
 * LIFECYCLE types, so that an episode opened and later closed converges on one
 * resource instead of leaving the open version behind. The first real submit in
 * a browser failed on the CORS preflight for `PUT`, which aborted the whole save
 * with a console error about `Access-Control-Allow-Methods` — a message that
 * points at configuration rather than at the missing route.
 *
 * Same gate, same rules, same patient scoping as POST. Two differences:
 *
 *   - the id comes from the URL and is kept, so the store upserts rather than
 *     appends (see `DemoState.upsert`);
 *   - 200 for a replacement, 201 for a first write, which is what FHIR's
 *     update-as-create says and what tells a client which one happened.
 *
 * The app's own comment notes this "relies on the server permitting
 * update-as-create (FHIR allows it, but a server may reject a client-supplied
 * id)". This server permits it. A real EHR may not, and that is a portability
 * caveat the demo must not paper over.
 */
app.put('/fhir/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  c.header('content-type', FHIR_JSON)

  const checked = await checkWritable(c, type, 'update')
  if (checked.refusal) return checked.refusal
  const { store } = checked

  const body = await c.req.json<unknown>().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.body(
      JSON.stringify(operationOutcome('error', 'structure', 'Request body must be a FHIR resource object.')),
      400,
    )
  }

  const bodyId = (body as MockResource).id
  if (typeof bodyId === 'string' && bodyId !== id) {
    // FHIR is explicit that these must agree; accepting a mismatch would let a
    // client believe it updated one resource while updating another.
    return c.body(
      JSON.stringify(operationOutcome(
        'error',
        'invalid',
        `Resource.id "${bodyId}" does not match the id in the URL ("${id}").`,
      )),
      400,
    )
  }

  const scoped = patientForWrite(c, body as MockResource)
  if ('refusal' in scoped) return scoped.refusal
  const { patientId } = scoped

  const candidate = withAssignedId(body as MockResource, id)
  const problems = validateWrite(candidate, { expectedType: type, patientId })
  if (problems.length > 0) {
    return c.body(JSON.stringify({ resourceType: 'OperationOutcome', issue: problems }), 422)
  }

  const existed = (await store.list()).some(
    w => w.resource.resourceType === type && w.resource.id === id,
  )
  const stored = await store.upsert(patientId, candidate)
  c.header('location', `${fhirBase(c.req.url)}/${type}/${id}`)
  return c.body(JSON.stringify(stored), existed ? 200 : 201)
})

/**
 * The gate both write verbs share: is this type writable under the live
 * capability profile, and is there somewhere to put it?
 *
 * Factored so POST and PUT cannot drift — a profile that refused creates while
 * still accepting updates would be a hole in the degradation demo, and it is the
 * kind of hole that opens by adding an endpoint rather than by changing a rule.
 */
async function checkWritable(
  c: Parameters<typeof envOf>[0] & { header: (k: string, v: string) => void; body: (b: string, s?: 405 | 503) => Response; req: { url: string } },
  type: string,
  interaction: 'create' | 'update',
): Promise<{ refusal: Response; store?: undefined; profile?: undefined } | { refusal: null; store: NonNullable<ReturnType<typeof storeFor>>; profile: CapabilityProfile }> {
  const profile = await liveProfile(c)
  const allowed = interaction === 'create' ? creatableTypes(profile) : updatableTypes(profile)
  if (!allowed.includes(type)) {
    // 405 rather than 404: the resource type is understood, the interaction is
    // not offered. `Allow` says what is, which is what a client should read.
    // 405 rather than 404: the resource type is understood, the interaction is
    // not offered. `Allow` says what is, which is what a client should read.
    c.header('allow', 'GET')
    return {
      refusal: c.body(
        JSON.stringify(operationOutcome(
          'error',
          'not-supported',
          `This server does not support ${interaction} for '${type}' under capability profile `
          + `'${profile}'. Supported for ${interaction}: ${allowed.join(', ') || 'nothing'}. `
          + 'This is the capability-degradation demo, not a defect.',
        )),
        405,
      ),
    }
  }

  const store = storeFor(envOf(c))
  if (!store) {
    // Deliberately not a memory fallback — see storeFor. A demo that accepts
    // writes and then loses them between isolates is harder to diagnose than one
    // that says the binding is missing.
    return {
      refusal: c.body(
        JSON.stringify(operationOutcome(
          'error',
          'transient',
          'No DEMO_STORE binding: this deployment cannot persist writes. Check the '
          + 'durable_objects binding in wrangler.jsonc.',
        )),
        503,
      ),
    }
  }
  return { refusal: null, store, profile }
}

/**
 * The patient a write belongs to, or a refusal.
 *
 * With auth enforced there is always a grant; with `MOCK_AUTH_ENFORCE=off` this
 * falls back to the resource's own link so curl exploration still works — and
 * validation then checks the link against itself, which is weaker and is why
 * `off` is not the deployed setting.
 */
function patientForWrite(
  c: Parameters<typeof denyForeignPatient>[0] & { get: (k: 'grant') => Grant | undefined; body: (b: string, s?: 400) => Response },
  resource: MockResource,
): { patientId: string } | { refusal: Response } {
  const claimed = patientOf(resource)
  const patientId = c.get('grant')?.patient ?? claimed
  if (!patientId) {
    return {
      refusal: c.body(
        JSON.stringify(operationOutcome(
          'error',
          'invalid',
          'Cannot tell which patient this resource is for: no access-token patient context '
          + 'and no patient reference on the resource.',
        )),
        400,
      ),
    }
  }
  const denied = denyForeignPatient(c, claimed)
  if (denied) return { refusal: denied }
  return { patientId }
}

/** The patient a resource points at, by whichever element its type uses. */
function patientOf(resource: MockResource): string | undefined {
  const refs: string[] = []
  for (const key of ['subject', 'patient', 'for'] as const) {
    const ref = (resource[key] as { reference?: string } | undefined)?.reference
    if (typeof ref === 'string') refs.push(ref)
  }
  for (const p of (resource.participant as Array<{ actor?: { reference?: string } }> | undefined) ?? []) {
    if (typeof p?.actor?.reference === 'string') refs.push(p.actor.reference)
  }
  return refs.map(r => /^Patient\/(.+)$/.exec(r)?.[1]).find((id): id is string => !!id)
}

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
  // A `user/…` read scope is the worklist grant: it may cross patients. This is
  // the one scope axis this server enforces — #404 option A, and the reasoning is
  // on `mayCrossPatients`.
  if (mayCrossPatients(grant)) return null
  return c.body(
    JSON.stringify(operationOutcome(
      'error',
      'forbidden',
      `This access token is scoped to patient '${grant.patient}' and cannot read '${patientId}'. ` +
        `A cross-patient read needs a 'user/…' scope.`,
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
  const result = await token(form, envOf(c), new URL(c.req.url).origin)
  // OAuth 2 requires token responses to be uncacheable.
  c.header('cache-control', 'no-store')
  c.header('pragma', 'no-cache')
  if (!result.ok) {
    return c.json({ error: result.error, error_description: result.description }, result.status as 400)
  }
  return c.json(result.body)
})

// ── Control surface ──────────────────────────────────────────────────────────

app.get('/_admin/capabilities', async (c) => {
  const profile = await liveProfile(c)
  return c.json({
    profile,
    description: PROFILE_DESCRIPTIONS[profile],
    creates: creatableTypes(profile),
    available: CAPABILITY_PROFILES.map(p => ({ profile: p, description: PROFILE_DESCRIPTIONS[p] })),
    durable: storeFor(envOf(c)) !== null,
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
  // Both layers: the durable one is what other isolates will read, the module
  // one keeps this isolate consistent without a round trip.
  setProfile(body.profile)
  const store = storeFor(envOf(c))
  await store?.setProfile(body.profile)
  return c.json({
    profile: body.profile,
    creates: creatableTypes(body.profile),
    durable: store !== null,
  })
})

/**
 * Mint a launch context and the URL an EHR would open.
 *
 * The engine behind both launch surfaces: the chart page's activity button and
 * CDS cards (`/chart/{id}`), and the control page's top-level launch. It stayed
 * an `_admin` endpoint after step 5 added the chart because the chart is a
 * *caller*, not the mechanism — which is also what lets the two surfaces differ
 * only in what they put in the body (`embed`, `intent`, `needPatientBanner`).
 */
app.post('/_admin/launch', async (c) => {
  type LaunchBody = {
    patient?: unknown
    intent?: unknown
    needPatientBanner?: unknown
    embed?: unknown
    topic?: unknown
  }
  const body = await c.req.json<LaunchBody>().catch(() => ({} as LaunchBody))
  const patient = typeof body.patient === 'string' ? body.patient : ''
  if (!RESOURCES_BY_KEY.has(`Patient/${patient}`)) {
    return c.json({ error: `Unknown patient '${patient}'.` }, 400)
  }
  // ⚠️ A FHIRcast topic per launch, minted here unless the caller supplies one.
  // The caller supplying one is the interesting case: the chart page reuses ONE
  // topic across every launch it makes, so the host and the panel share a session
  // (step 6). A fresh topic per launch would give each of them its own session and
  // nothing would cross — which looks identical to working until you check.
  const topic = typeof body.topic === 'string' && body.topic
    ? body.topic
    : `spier-${crypto.randomUUID()}`
  const launch = await mintLaunch({
    patient,
    intent: typeof body.intent === 'string' && body.intent ? body.intent : undefined,
    needPatientBanner: typeof body.needPatientBanner === 'boolean' ? body.needPatientBanner : undefined,
    topic,
  }, envOf(c))

  const origin = new URL(c.req.url).origin
  const panelBase = envOf(c).MOCK_PANEL_BASE_URL || DEFAULT_PANEL_BASE_URL
  // SMART EHR launch: the EHR opens the app's launch_uri with `iss` + `launch`.
  // The app's launch screen is under its hash router, and main.tsx routes the
  // real query string into it.
  //
  // ⚠️ `embed=1` is the panel-chrome flag, and it belongs in the QUERY, before
  // the `#`. The app reads it from `location.search` on purpose (see
  // PresentationProvider) — appending it after the fragment would make it part
  // of the route and it would be silently ignored.
  const url = new URL(panelBase)
  url.searchParams.set('iss', `${origin}/fhir`)
  url.searchParams.set('launch', launch)
  if (body.embed === true) url.searchParams.set('embed', '1')
  url.hash = '#/launch'
  return c.json({ launch, launchUrl: url.toString(), patient, topic })
})

/**
 * What has been written. Powers the "written so far" readout and, more
 * importantly, makes the writeback demo checkable: the ladder's scorecard is
 * SPiER reporting on itself, and this is the server's own account of the same
 * event. Two independent statements of what happened is the difference between a
 * demo and an assertion.
 */
app.get('/_admin/writes', async (c) => {
  const store = storeFor(envOf(c))
  if (!store) return c.json({ error: 'No DEMO_STORE binding — this deployment cannot persist writes.' }, 503)
  const writes = await store.list()
  return c.json({
    count: writes.length,
    byType: writes.reduce<Record<string, number>>((acc, w) => {
      const type = String(w.resource.resourceType)
      acc[type] = (acc[type] ?? 0) + 1
      return acc
    }, {}),
    writes: writes.map(w => ({
      patient: w.patientId,
      resourceType: w.resource.resourceType,
      id: w.resource.id,
    })),
  })
})

/**
 * Reset the demo. The plan asks for this explicitly — "this demo will be run
 * many times, and one that cannot be reset in a click goes stale
 * mid-presentation".
 *
 * Discards writes only. The capability profile survives on purpose: "reset the
 * data" and "put the server back to full capability" are different intentions,
 * and a reset that silently re-armed the ladder would undo the degradation the
 * presenter just set up.
 */
app.post('/_admin/reset', async (c) => {
  const store = storeFor(envOf(c))
  if (!store) return c.json({ error: 'No DEMO_STORE binding — nothing to reset.' }, 503)
  const discarded = await store.reset()
  return c.json({ discarded, profileUnchanged: await liveProfile(c) })
})

// ── FHIRcast hub (step 6) ────────────────────────────────────────────────────
//
// The hub itself is a Durable Object (fhircastHub.ts); these routes are its HTTP
// surface. CORS matters here for the same reason it does on /fhir: the panel is
// on another origin, so a subscription request is a cross-origin POST and a
// preflight failure looks exactly like a hub that is down.

const hubCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
})
app.use('/fhircast', hubCors)
app.use('/fhircast/*', hubCors)

/** The single hub instance, or null when the binding is absent. */
function hubFor(env: Env): DurableObjectStub<FhircastHub> | null {
  if (!env.FHIRCAST_HUB) return null
  return env.FHIRCAST_HUB.get(env.FHIRCAST_HUB.idFromName('hub'))
}

/**
 * `POST /fhircast` — a FHIRcast subscription request.
 *
 * Form-encoded per the spec, and refused rather than coerced when it asks for
 * something this hub does not do (see `parseSubscription`). Answers 202 with the
 * `hub.channel.endpoint` to connect a WebSocket to.
 *
 * ⚠️ The endpoint is built from the REQUEST's origin, with the scheme swapped to
 * `ws`/`wss`. Not from a configured base URL: the hub has to be reachable at
 * whatever host the client actually used, and a hardcoded origin is how a
 * localhost demo ends up handing out a production socket URL.
 */
app.post('/fhircast', async (c) => {
  const hub = hubFor(envOf(c))
  if (!hub) return c.json({ error: 'No FHIRCAST_HUB binding — this deployment has no hub.' }, 503)

  const parsed = parseSubscription(new URLSearchParams(await c.req.text()))
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)

  if (parsed.mode === 'unsubscribe') {
    const closed = await hub.unsubscribe(parsed.subscription.topic)
    return c.json({ 'hub.mode': 'unsubscribe', 'hub.topic': parsed.subscription.topic, closed }, 202)
  }

  const url = new URL(c.req.url)
  const scheme = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const endpoint = `${scheme}//${url.host}/fhircast/ws`
    + `?topic=${encodeURIComponent(parsed.subscription.topic)}`
    + `&events=${encodeURIComponent(parsed.subscription.events.join(','))}`
  return c.json({
    'hub.mode': 'subscribe',
    'hub.topic': parsed.subscription.topic,
    'hub.events': parsed.subscription.events.join(','),
    'hub.channel.type': 'websocket',
    'hub.channel.endpoint': endpoint,
  }, 202)
})

/** The WebSocket channel. Handed straight to the DO — see its `fetch`. */
app.get('/fhircast/ws', (c) => {
  const hub = hubFor(envOf(c))
  if (!hub) return c.json({ error: 'No FHIRCAST_HUB binding — this deployment has no hub.' }, 503)
  return hub.fetch(c.req.raw)
})

/**
 * `POST /fhircast/{topic}` — an app reporting a context change. The hub fans it
 * out to that topic's subscribers.
 *
 * The topic in the URL must match the one in the body. A mismatch is refused
 * rather than resolved in either direction: taking the URL's would let a
 * misaddressed event reach the wrong session, and taking the body's would make
 * the URL decorative.
 */
app.post('/fhircast/:topic', async (c) => {
  const hub = hubFor(envOf(c))
  if (!hub) return c.json({ error: 'No FHIRCAST_HUB binding — this deployment has no hub.' }, 503)
  const topic = c.req.param('topic')
  const body = await c.req.json<HubNotification>().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Body must be a FHIRcast event notification.' }, 400)
  }
  const bodyTopic = body.event?.['hub.topic']
  if (bodyTopic && bodyTopic !== topic) {
    return c.json({ error: `hub.topic in the body ("${bodyTopic}") does not match the URL ("${topic}").` }, 400)
  }
  const delivered = await hub.publish(topic, body)
  return c.json({ 'hub.topic': topic, delivered })
})

/**
 * Live hub stats. `sockets` and `topics` are derived from the live socket set and
 * are trustworthy; `sent` and `acked` count only since the hub last woke from
 * hibernation — see the note on those fields in fhircastHub.ts.
 */
app.get('/_admin/fhircast', async (c) => {
  const hub = hubFor(envOf(c))
  if (!hub) return c.json({ error: 'No FHIRCAST_HUB binding — this deployment has no hub.' }, 503)
  return c.json(await hub.stats())
})

// ── Host chrome (step 5) ─────────────────────────────────────────────────────
// The patient list and one chart, with the panel framed inside it. This is what
// exercises `frame-ancestors` on the panel host — see chartPage.ts.

/**
 * The front door: the patient list, plus the population dashboard embedded the
 * way an EHR hosts a worklist.
 *
 * ⚠️ `/` used to serve the operator's bench and the demo was two undiscoverable
 * clicks away. See `homePage` for the report that prompted the change.
 */
app.get('/', async (c) => {
  const panelBase = envOf(c).MOCK_PANEL_BASE_URL || DEFAULT_PANEL_BASE_URL
  // `embed=1` puts the app in panel chrome; NO `iss`/`launch`, because this is
  // deliberately not a SMART launch — see the label on the frame.
  const url = new URL(panelBase)
  url.searchParams.set('embed', '1')
  url.hash = '#/population'
  return c.html(homePage(DEMO_PATIENTS, { populationPanelUrl: url.toString() }))
})

// `/chart` was the patient list before the list became the front door. Kept as a
// redirect rather than deleted: it is in the README, in two plan docs and in
// anyone's history, and a 404 on a URL we published is a worse answer than a
// redirect.
app.get('/chart', (c) => c.redirect('/', 301))

app.get('/chart/:patientId', async (c) => {
  const patient = DEMO_PATIENTS_BY_ID.get(c.req.param('patientId'))
  if (!patient) return c.notFound()
  const panelBase = envOf(c).MOCK_PANEL_BASE_URL || DEFAULT_PANEL_BASE_URL
  // The panel host serves the SPA and the CDS Hooks API from ONE Worker, so the
  // service lives at the panel's own origin. Deriving it (rather than taking a
  // second env var) means a redeploy cannot point the two at different hosts.
  const panelOrigin = new URL(panelBase).origin
  return c.html(patientChartPage(patient, {
    cdsEndpoint: `${panelOrigin}${CDS_SERVICE_PATH}`,
    panelOrigin,
    profiles: CAPABILITY_PROFILES.map(p => ({ profile: p, description: PROFILE_DESCRIPTIONS[p] })),
    activeProfile: await liveProfile(c),
    // Everyone except the patient whose chart this is — the FHIRcast affordance
    // announces a move to a DIFFERENT patient, so offering this one would
    // demonstrate nothing.
    otherPatients: DEMO_PATIENTS.filter(p => p.id !== patient.id),
  }))
})

/**
 * The operator's bench — moved off `/` deliberately. Everything here is server
 * equipment (the capability switch, a top-level launch, the FHIR base), and none
 * of it tells a visitor what to do.
 */
app.get('/settings', async (c) => c.html(controlPage(
  await liveProfile(c),
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
