/**
 * fhircastProtocol — the FHIRcast hub's wire contract, with no runtime in it.
 *
 * The hub itself is a Durable Object in `fhircastHub.ts`. This file holds the
 * types and the subscription-request validation, for the same reason
 * `store.ts` is separate from `demoStore.ts`: `cloudflare:workers` is not
 * resolvable outside the Workers runtime, and `app.ts` — which every unit test
 * drives under plain Node — needs `parseSubscription` as a VALUE. Importing it
 * from the class module would fail the whole suite with "Failed to load url
 * cloudflare:workers", which reads as a missing file rather than a missing
 * runtime.
 *
 * What the hub is, and what it deliberately is not:
 *
 * ── Why this is an upgrade rather than a tax ─────────────────────────────────
 *
 * The panel plan §6 filed FHIRcast under "what cross-origin costs":
 * `web/src/lib/fhircast.ts` relayed context over a `BroadcastChannel`, which is
 * same-origin by construction and cannot reach a host chart on another origin.
 * The floor it proposed was `postMessage` with strict origin checks. It also
 * noted the better version — *"Durable Objects speak WebSocket, so the mock EHR
 * could host an actual FHIRcast hub, which is what real FHIRcast uses"*.
 *
 * Step 4 added a Durable Object for writes, which is what made the better
 * version the cheap one. So the app no longer simulates a hub between its own
 * tabs when a real one is available: it subscribes to this, at the *EHR's*
 * origin, exactly as it would against a vendor hub.
 *
 * ── What is implemented, and what is deliberately not ───────────────────────
 *
 * Implemented, because a subscription that skipped them would not be one an EHR
 * could stand in for:
 *
 *   - `POST {hub.url}` — a form-encoded subscription request
 *     (`hub.channel.type=websocket`, `hub.mode`, `hub.topic`, `hub.events`),
 *     answered with `hub.channel.endpoint`. Refused when the channel type is not
 *     `websocket` or the topic is missing.
 *   - The WebSocket channel, with a confirmation frame on connect.
 *   - `POST {hub.url}/{topic}` — the notification endpoint an app publishes a
 *     context change to, fanned out to every socket subscribed to that topic
 *     (including the publisher's own, if it has one — see `publish`).
 *   - Subscriber ACKs (`{id, status}`) read off the socket and counted, so
 *     "delivered" can be distinguished from "sent".
 *   - `hub.mode=unsubscribe`.
 *
 * NOT implemented, and none of it is needed to show context crossing an origin:
 *
 *   - **No `hub.secret` / no HMAC signature.** Real FHIRcast signs notifications
 *     so a subscriber can verify the hub. Skipping it is the same class of
 *     shortcut as the missing `id_token` in `smart.ts` — recorded there and here
 *     rather than glossed. **Do not describe this hub as authenticating
 *     anything.**
 *   - **No `webhook` channel type**, no server-sent events, no lease expiry.
 *   - **No `Patient.close` / anchor-context lifecycle**, no `FHIR.prefetch`.
 *   - **No authorization on the hub at all.** Anyone who can reach the Worker can
 *     subscribe to any topic and publish to it. The topic is an unguessable
 *     per-session value, which is a demo's worth of protection and not a
 *     security control; the data is synthetic either way.
 *
 * ⚠️ **One hub instance, keyed by topic inside it.** Like the write store, this
 * uses a single named Durable Object rather than one per session, because a
 * WebSocket fan-out has to reach every subscriber from one place. Topics are kept
 * apart *within* it — a socket only receives notifications for the topic it
 * subscribed to, and `fhircastHub.test.ts` pins that. Two people demonstrating at
 * once therefore get different topics and do not see each other's context.
 */
/** A notification body, as loose as it arrives. */
export interface HubNotification {
  timestamp?: string
  id?: string
  event?: {
    'hub.topic'?: string
    'hub.event'?: string
    context?: unknown[]
  }
  [key: string]: unknown
}

/** What a subscription request asked for, once validated. */
export interface Subscription {
  topic: string
  events: string[]
}

export interface SubscribeResult {
  ok: boolean
  /** The WebSocket URL to connect to, when ok. */
  endpoint?: string
  /** Why the request was refused, when not ok. */
  error?: string
}

/**
 * Validate a subscription request. Split out from the DO so it is testable
 * without a Durable Object, and so the refusals are visible in one place.
 */
export function parseSubscription(form: URLSearchParams): {
  mode: 'subscribe' | 'unsubscribe'
  subscription: Subscription
} | { error: string } {
  const mode = form.get('hub.mode')
  if (mode !== 'subscribe' && mode !== 'unsubscribe') {
    return { error: "hub.mode must be 'subscribe' or 'unsubscribe'." }
  }
  const channel = form.get('hub.channel.type')
  // Refused rather than defaulted: an app that asked for a `webhook` channel and
  // silently got a WebSocket would wait forever for callbacks that never come.
  if (channel !== 'websocket') {
    return { error: `This hub only supports hub.channel.type=websocket (got ${String(channel)}).` }
  }
  const topic = form.get('hub.topic')
  if (!topic) return { error: 'hub.topic is required — it is what scopes a session.' }
  const events = (form.get('hub.events') ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)
  if (events.length === 0) return { error: 'hub.events is required.' }
  return { mode, subscription: { topic, events } }
}

/** Per-socket bookkeeping. Serialized into the socket's attachment. */
export interface SocketMeta {
  topic: string
  events: string[]
}
