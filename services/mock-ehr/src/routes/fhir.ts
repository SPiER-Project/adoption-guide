/**
 * The FHIR API: discovery, CapabilityStatement, read, search, create, update.
 *
 * One of six route modules `app.ts` composes. Everything here answers under
 * `/fhir`; the bearer check is the first middleware and the two pre-auth
 * routes (discovery, `/metadata`) are exempted inside it. Route ORDER matters
 * within this file — `/fhir/metadata` and the discovery path are registered
 * before `/fhir/:type` and `/fhir/:type/:id`, which would otherwise match them
 * — so keep additions below the two literal paths.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  buildCapabilityStatement,
  creatableTypes,
  updatableTypes,
  type CapabilityProfile,
} from '../capability'
import { HELD_TYPES, RESOURCES_BY_KEY, type MockResource } from '../fixtures'
import { ROSTER_TYPE, SEARCHABLE_TYPES, applySearch, parseSearch } from '../search'
import { validateWrite, withAssignedId } from '../validate'
import { storeFor } from '../store'
import { authRequired, grantFor, mayCrossPatients, smartConfiguration, type Grant } from '../smart'
import { envOf, type AppEnv } from '../env'
import { liveProfile } from '../profile'
import { FHIR_JSON, fhirBase, operationOutcome, searchset, servableFor } from '../fhirResponses'

export const fhirRoutes = new Hono<AppEnv>()

// The panel is on another origin, so every endpoint it touches needs CORS —
// including /token, which it POSTs to directly as a public client. A preflight
// failure here looks exactly like a broken login.
export const apiCors = cors({
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
fhirRoutes.use('/fhir', apiCors)
fhirRoutes.use('/fhir/*', apiCors)

// ── Bearer check ─────────────────────────────────────────────────────────────
// Everything under /fhir except discovery and /metadata, which are pre-auth by
// definition: a client reads them to find out how to authorize at all.
fhirRoutes.use('/fhir/*', async (c, next) => {
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

fhirRoutes.get('/fhir/.well-known/smart-configuration', (c) => {
  c.header('content-type', 'application/json')
  return c.body(JSON.stringify(smartConfiguration(new URL(c.req.url).origin)))
})

fhirRoutes.get('/fhir/metadata', async (c) => {
  const statement = buildCapabilityStatement(await liveProfile(c), HELD_TYPES, fhirBase(c.req.url))
  c.header('content-type', FHIR_JSON)
  return c.body(JSON.stringify(statement))
})

// ── Read ─────────────────────────────────────────────────────────────────────

fhirRoutes.get('/fhir/:type/:id', async (c) => {
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

fhirRoutes.get('/fhir/:type', async (c) => {
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

  // ⚠️ The roster search (#401), and the narrowest possible version of it: an
  // unscoped `GET /fhir/Patient` for a token that may cross patients, and
  // nothing else. A worklist app cannot ask "which patients are there?" one
  // patient at a time — but every clinical type stays patient-scoped, so an
  // unscoped Observation search is still a 400 from the search layer.
  //
  // The PERMISSION is a 403 raised here rather than a 400 from `parseSearch`:
  // enumerating the roster on a chart token is a scope refusal, and the search
  // layer only answers 400. With `MOCK_AUTH_ENFORCE=off` there is no grant, so
  // this admits it — the same leniency `patientForWrite` documents for that
  // mode, and part of why `off` is not the deployed setting.
  const grant = c.get('grant')
  if (type === ROSTER_TYPE && grant && !mayCrossPatients(grant)) {
    return c.body(
      JSON.stringify(operationOutcome(
        'error',
        'forbidden',
        `This access token is scoped to patient '${grant.patient}' and cannot enumerate the `
          + `${ROSTER_TYPE} roster. A cohort read needs a 'user/…' scope.`,
      )),
      403,
    )
  }
  const parsed = parseSearch(new URL(c.req.url).searchParams, { type })
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
fhirRoutes.post('/fhir/:type', async (c) => {
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
 * `PUT /fhir/{Type}/{id}` — update a resource this server already holds.
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
 * ⚠️ **It was update-as-create for months, and that was the defect this service
 * existed to catch.** See the comment on the not-found branch below: a `PUT` to
 * an id this server has never held is a **404** now, not a 201. The app creates
 * with POST and updates against the id the server hands back.
 *
 * Same gate, same rules, same patient scoping as POST. Two differences:
 *
 *   - the id comes from the URL and is kept, so the store upserts rather than
 *     appends (see `DemoState.upsert`) — it replaces the resource already at
 *     that id;
 *   - 200 always, because a PUT here can only ever be a replacement.
 */
fhirRoutes.put('/fhir/:type/:id', async (c) => {
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

  // ⚠️ **This server used to do update-as-create, and that was a defect it
  // spent months certifying.** A PUT to an id it had never held returned 201 and
  // created the resource, because `SmartDataSource` PUT the eight lifecycle
  // types at client-minted ids and the alternative was a demo that did not save.
  // The README was candid about it — *"`PUT` exists because a browser found it,
  // not because the spec asked"* — and being candid did not make it safe: FHIR
  // permits update-as-create, real servers frequently refuse it, and Medplum
  // refuses it outright. So SPiER's whole writeback passed here and failed at
  // the first server nobody on this project had written.
  //
  // That is the hazard of a mock you control: when the app and the server
  // disagree, the server is what moves. It refuses now, so it can go back to
  // answering the question it is actually for — what happens when a server says
  // no — instead of quietly answering yes.
  const existing = (await servableFor(c)).find(
    r => r.resourceType === type && r.id === id,
  )
  if (!existing) {
    c.header('allow', 'GET, POST')
    return c.body(
      JSON.stringify(operationOutcome(
        'error',
        'not-found',
        `No ${type} with id '${id}' on this server. This server does not implement `
        + 'update-as-create: POST to create a resource and let the server assign the id, '
        + 'then PUT against that id. Carry your own id as an `identifier` if you need to '
        + 'find it again — `GET /fhir/' + type + '?identifier=<system>|<value>` is supported.',
      )),
      404,
    )
  }

  const stored = await store.upsert(patientId, candidate)
  c.header('location', `${fhirBase(c.req.url)}/${type}/${id}`)
  return c.body(JSON.stringify(stored), 200)
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
  const grant = c.get('grant')
  // ⚠️ **A worklist grant may not write, and this is a CONTEXT rule rather than
  // a new scope axis** (#404 settled that this server enforces exactly one scope
  // axis, and this does not add a second). A write is attributed to the token's
  // patient context; a token with no patient context cannot say which chart it
  // is writing to, and the only remaining answer — believe the resource's own
  // `subject` — is explicitly the WEAKER `MOCK_AUTH_ENFORCE=off` path, where
  // "validation then checks the link against itself". That path must not become
  // reachable with auth on.
  //
  // Found by inspection, not by a failing test: before #401 no patient-less
  // token could exist, so `?? claimed` below was unreachable with auth on. Making
  // one possible turned it into a cross-patient write for a token whose only
  // scope is `user/*.read`, and nothing in the type system or the suite noticed.
  if (grant && !grant.patient) {
    return {
      refusal: c.body(
        JSON.stringify(operationOutcome(
          'error',
          'forbidden',
          'This access token has no patient in context (a worklist grant), so it cannot be used '
          + 'to write. Writes are attributed to the launch\'s patient; launch against a specific '
          + 'patient to record anything.',
        )),
        // Deliberately 403 and not 400: the request is well-formed and the
        // server understood it. What is missing is authority, not information.
        403 as 400,
      ),
    }
  }
  const patientId = grant?.patient ?? claimed
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

