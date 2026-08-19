/**
 * app — the mock EHR's HTTP surface.
 *
 *   GET  /fhir/metadata           CapabilityStatement (the degradation switch)
 *   GET  /fhir/{Type}/{id}        read
 *   GET  /fhir/{Type}?patient=…   patient-scoped search → searchset Bundle
 *   GET  /                        control page (flip the capability profile)
 *   GET  /_admin/capabilities     the profile, as JSON
 *   PUT  /_admin/capabilities     set it
 *
 * ── Deliberately absent ─────────────────────────────────────────────────────
 * No /authorize, /token or PKCE (step 2); no writes (step 4). Step 1 is an open
 * read API precisely so it can be built and tested before either.
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
import { HELD_RESOURCES, HELD_TYPES, RESOURCES_BY_KEY, type MockResource } from './fixtures'
import { SEARCHABLE_TYPES, applySearch, parseSearch } from './search'
import { controlPage } from './controlPage'

export interface Env {
  /** Profile a freshly started isolate begins with (wrangler.jsonc `vars`). */
  MOCK_CAPABILITY_PROFILE?: string
}

const FHIR_JSON = 'application/fhir+json'

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

const app = new Hono<{ Bindings: Env }>()

app.use('/fhir', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'], maxAge: 86400 }))
app.use('/fhir/*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'], maxAge: 86400 }))

// ── Capability ───────────────────────────────────────────────────────────────

app.get('/fhir/metadata', (c) => {
  const statement = buildCapabilityStatement(getProfile(c.env), HELD_TYPES, fhirBase(c.req.url))
  c.header('content-type', FHIR_JSON)
  return c.body(JSON.stringify(statement))
})

// ── Read ─────────────────────────────────────────────────────────────────────

app.get('/fhir/:type/:id', (c) => {
  const { type, id } = c.req.param()
  const resource = RESOURCES_BY_KEY.get(`${type}/${id}`)
  c.header('content-type', FHIR_JSON)
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

  const matches = applySearch(HELD_RESOURCES.map(h => h.resource), type, parsed.query)
  return c.body(JSON.stringify(searchset(matches, fhirBase(c.req.url))))
})

// ── Control surface ──────────────────────────────────────────────────────────

app.get('/_admin/capabilities', (c) => {
  const profile = getProfile(c.env)
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

app.get('/', (c) => c.html(controlPage(getProfile(c.env), fhirBase(c.req.url), HELD_RESOURCES.length)))

app.all('*', (c) => {
  c.header('content-type', FHIR_JSON)
  return c.body(
    JSON.stringify(operationOutcome('error', 'not-found', `No route for ${c.req.method} ${new URL(c.req.url).pathname}. The FHIR base is /fhir.`)),
    404,
  )
})

export default app
