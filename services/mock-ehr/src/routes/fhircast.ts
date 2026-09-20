/**
 * The FHIRcast hub's HTTP surface. The hub itself is a Durable Object
 * (fhircastHub.ts); these routes subscribe, hand off the WebSocket, publish,
 * and report stats.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { parseSubscription } from '../fhircastProtocol'
import type { HubNotification } from '../fhircastProtocol'
// Type-only: see the header of fhircastHub.ts for why this must never become a
// value import.
import type { FhircastHub } from '../fhircastHub'
import { envOf, type AppEnv, type Env } from '../env'

export const fhircastRoutes = new Hono<AppEnv>()

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
fhircastRoutes.use('/fhircast', hubCors)
fhircastRoutes.use('/fhircast/*', hubCors)

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
fhircastRoutes.post('/fhircast', async (c) => {
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
fhircastRoutes.get('/fhircast/ws', (c) => {
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
fhircastRoutes.post('/fhircast/:topic', async (c) => {
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
fhircastRoutes.get('/_admin/fhircast', async (c) => {
  const hub = hubFor(envOf(c))
  if (!hub) return c.json({ error: 'No FHIRCAST_HUB binding — this deployment has no hub.' }, 503)
  return c.json(await hub.stats())
})

