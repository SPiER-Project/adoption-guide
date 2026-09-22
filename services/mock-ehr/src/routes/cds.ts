/**
 * This host as a CDS Client: the JWK Set it publishes and the signed,
 * server-to-server invocation the chart page asks it to make.
 */
import { Hono } from 'hono'
import { DEFAULT_CDS_CLIENT_ID, JWKS_PATH, mintCdsToken, publicJwks, signingKeyFor } from '../cdsClient'
import { QR_PREFETCH_KEY, questionnaireResponseBundle } from '../cdsPrefetch'
import { storeFor } from '../store'
import { CDS_SERVICE_PATH, cdsOriginFor, envOf, type AppEnv } from '../env'

export const cdsRoutes = new Hono<AppEnv>()

// ── This host as a CDS Client (CDS Hooks 2.0 § Trusting CDS Clients) ─────────
//
// A CDS Client SHALL present `Authorization: Bearer <JWT>` signed with its own
// key, and the service verifies it against the client's published JWK Set.
// `services/cds` has verified since #147 but ran in `warn` mode — which logs a
// failure and proceeds — because nothing here could produce a token. These two
// routes are the missing half, and they are what let that service flip to
// `require`.
//
// ⚠️ **The CALL is server-to-server, and that is a correctness fix as much as a
// plumbing one.** The chart page used to POST to the CDS service straight from
// the browser. That is not how CDS Hooks works — the *EHR* invokes the service
// — and it is also why signing was impossible: the only way to let a browser
// send a signed token is to hand the browser a signing key, or to mint one on
// demand for anyone who asks for the page. Both give away the identity the
// signature is supposed to prove. So the browser asks this host, and this host
// calls the service.

/**
 * The JWK Set a CDS service fetches to verify this host's tokens.
 *
 * ⚠️ **Open, and it must be.** A verifier reaches this *before* it trusts
 * anything, so an auth check here would be a chicken-and-egg. It publishes only
 * public key material — see `publicJwks`, whose return type has no `d` to set.
 */
cdsRoutes.get(JWKS_PATH, async (c) => {
  const store = storeFor(envOf(c))
  if (!store) return c.json({ error: 'No DEMO_STORE binding — no signing key to publish.' }, 503)
  // `max-age` is a balance: too long and a rotation is invisible to a verifier
  // for that window; too short and every invoke pays a fetch. `jose`'s
  // `createRemoteJWKSet` re-fetches on an unknown `kid` regardless, so a
  // rotation is picked up on the first token that needs it either way.
  c.header('cache-control', 'public, max-age=300')
  return c.json(publicJwks(await signingKeyFor(store)))
})

/**
 * Invoke the CDS Hooks service on the chart page's behalf, signed, and with
 * this chart's data attached.
 *
 * Returns the service's response verbatim — this host adds an identity and a
 * prefetch, and nothing else. A non-2xx is passed through with its status so
 * the chart can say what actually happened rather than "could not be reached".
 *
 * ⚠️ **The PREFETCH is this host's, not the caller's, and that direction is the
 * point.** In CDS Hooks the prefetch is the EHR's statement about its own
 * record; a browser supplying one would be the page telling the service what
 * the chart holds. So whatever arrives under the service's own prefetch key is
 * replaced by what this server actually has. Other keys are left alone: no
 * caller sends any today, and dropping an unknown one would be this route
 * deciding what a future hook may ask for.
 */
cdsRoutes.post('/_admin/cds', async (c) => {
  const store = storeFor(envOf(c))
  if (!store) return c.json({ error: 'No DEMO_STORE binding — cannot sign a CDS request.' }, 503)

  let hookRequest: unknown
  try {
    hookRequest = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be valid JSON.' }, 400)
  }

  const cdsOrigin = cdsOriginFor(envOf(c))
  const endpoint = `${cdsOrigin}${CDS_SERVICE_PATH}`
  const selfOrigin = new URL(c.req.url).origin

  // ── Attach the chart ──────────────────────────────────────────────────────
  //
  // ⚠️ **Without this the service answers about a FIXTURE.** Its live path runs
  // the prefetched responses through the same mappers the app runs on a
  // submitted form; with nothing prefetched it falls back to the bundled
  // population scenario for the patient id, which stops being this chart the
  // moment anything is written to it. The host's card then recommends a screen
  // the panel has already recorded — audit §1.14.
  //
  // ⚠️ A body with no `context.patientId` is passed through untouched rather
  // than rejected. This route is a signing proxy for whatever hook the page
  // asks for, and a patient-less hook (or a malformed one) is the service's to
  // answer; inventing a 400 here would put this host's opinion of the CDS
  // Hooks spec in front of the service that implements it.
  const body = hookRequest as { context?: { patientId?: unknown }; prefetch?: Record<string, unknown> }
  const patientId = typeof body?.context?.patientId === 'string' ? body.context.patientId : ''
  if (patientId) {
    hookRequest = {
      ...body,
      prefetch: {
        ...body.prefetch,
        [QR_PREFETCH_KEY]: await questionnaireResponseBundle(patientId, store, `${selfOrigin}/fhir`),
      },
    }
  }

  const token = await mintCdsToken(await signingKeyFor(store), {
    iss: selfOrigin,
    sub: envOf(c).MOCK_CDS_CLIENT_ID || DEFAULT_CDS_CLIENT_ID,
    // ⚠️ The service's `CDS_JWT_AUDIENCE` is this exact string. An `aud` that
    // names the ORIGIN rather than the invoke URL is the easy mistake, and it
    // fails as a flat 401 with no hint which half is wrong.
    aud: endpoint,
    jku: `${selfOrigin}${JWKS_PATH}`,
  })

  // ⚠️ **The binding, not `fetch`, and it is a correctness fix.** On the
  // deployed origins both Workers sit on `*.bbthorson.workers.dev` — one zone —
  // and Cloudflare refuses a Worker subrequest to another Worker on the same
  // zone, answering HTTP 404 with the body `error code: 1042`. The passthrough
  // below relayed that 404 and the chart blamed the CDS service for a request it
  // never received. The binding dispatches straight to the Worker: same URL,
  // same signed `aud`, same routing on the other side, no zone in the path.
  //
  // ⚠️ The `fetch` fallback is for the unit tests, which pass no env. `wrangler
  // dev` binds through the local dev registry, so a local run takes the same
  // path as the deploy (and 503s if `services/cds` is not running) — which is
  // what makes it able to reproduce this at all. The old `fetch` line could not
  // be reproduced anywhere but production.
  const invoke = envOf(c).CDS?.fetch.bind(envOf(c).CDS) ?? fetch
  let upstream: Response
  try {
    upstream = await invoke(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(hookRequest),
    })
  } catch (error) {
    return c.json(
      { error: `Could not reach the CDS service at ${endpoint}: ${String(error)}` },
      502,
    )
  }

  // ⚠️ A raw `Response` rather than `c.body(...)`, because the status is the
  // service's and Hono's helper types theirs as a literal union this cannot
  // satisfy without an assertion. Passing it through matters: a 401 means this
  // host's identity was refused, which is a completely different thing to debug
  // than a 500 from the card builder, and collapsing both into "unavailable" is
  // exactly what would hide it.
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  })
})

