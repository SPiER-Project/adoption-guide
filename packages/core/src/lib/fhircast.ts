import { makeId } from './id'

/**
 * FHIRcast (STU3) patient-open events, over a real hub when there is one.
 *
 * A real FHIRcast deployment has a *hub* that relays context-change events to
 * every subscribed app over WebSocket. **Step 6 made that the primary path**:
 * when a SMART launch tells us the EHR's `hub.url` and `hub.topic`, this module
 * subscribes to it and context crosses the origin boundary between the host
 * chart and the embedded panel.
 *
 * The `BroadcastChannel` transport remains, and is still the right thing where
 * it applies: two tabs of THIS app (the population worklist and a chart) with no
 * EHR in the picture. It is a simulation, and the distinction matters enough to
 * be modelled — see the transport section. What was always true of both is that
 * the payload on the wire is a real FHIRcast **event notification**, so it can be
 * inspected and maps 1:1 onto what a production hub delivers.
 *
 * ⚠️ The panel plan §6 listed leaving `BroadcastChannel` as a *cost* of going
 * cross-origin, with `postMessage` as the floor and a real hub as the better
 * version. The Durable Object that step 4 added for writes is what made the
 * better version cheap: it already speaks WebSocket.
 *
 * Two-way and v1-scoped: this module only *models* the `patient-open` event,
 * but context changes flow both directions — the population worklist and any
 * open chart each publish when they change the active patient, and each follows
 * the other. The receiving side's *policy* guardrails (only follow while on a
 * chart route, ignore under a live SMART session) live in the React listener,
 * not here — this file stays framework-free.
 *
 * The one piece of shared plumbing echo-suppression needs is the
 * `markFollowing`/`consumeFollowing` pair below: a module-level marker the
 * listener sets before it navigates in response to an incoming event, so the
 * publisher-side effect can tell a *followed* context change apart from a
 * user-initiated one and not rebroadcast it (which would ping-pong across
 * tabs). Everything else in this file is side-effect-free apart from the
 * channel it owns.
 */

/** BroadcastChannel name — the local stand-in for a FHIRcast hub endpoint. */
export const FHIRCAST_CHANNEL = 'spier-fhircast'

/**
 * The FHIRcast "topic" — in production this is the opaque session id handed out
 * at subscription time that scopes events to one user's set of apps. A single
 * fixed value is fine for the demo (one simulated session).
 */
export const FHIRCAST_TOPIC = 'spier-demo-session'

/** `hub.event` value for a patient-open context change (FHIRcast STU3). */
export const PATIENT_OPEN_EVENT = 'patient-open'

/** One entry in a FHIRcast event's `context` array. */
export interface FhircastContextItem {
  key: string
  resource?: Record<string, unknown>
  reference?: { reference: string }
}

/**
 * A FHIRcast STU3 event notification — the JSON a hub POSTs/pushes to a
 * subscriber. `event.context` carries the FHIR resources now in context.
 */
export interface FhircastEvent {
  timestamp: string
  id: string
  event: {
    'hub.topic': string
    'hub.event': string
    context: FhircastContextItem[]
  }
}

/** Minimal patient identity needed to open a chart in the receiving tab. */
export interface PatientOpenPayload {
  patientId: string
  mrn?: string
  displayName?: string
}

/**
 * The MRN namespace SPiER's synthetic patients use. Exported because
 * `smartPatient.ts` must pick the same identifier out of a Patient read back
 * from a server — two spellings of this string is exactly what
 * `npm run check:patients` exists to catch.
 */
export const MRN_SYSTEM = 'http://thespierproject.org/fhir/identifier/mrn'

/**
 * Build the anchor Patient resource carried in the event context. Kept minimal
 * — a FHIRcast context resource only needs enough to identify the patient, and
 * the receiving app resolves the full record itself from its own data source.
 */
function buildContextPatient(payload: PatientOpenPayload): Record<string, unknown> {
  const patient: Record<string, unknown> = {
    resourceType: 'Patient',
    id: payload.patientId,
  }
  if (payload.mrn) {
    patient.identifier = [{ system: MRN_SYSTEM, value: payload.mrn }]
  }
  if (payload.displayName) {
    const [given, ...familyParts] = payload.displayName.split(' ')
    patient.name = [{ given: [given ?? ''], family: familyParts.join(' ') }]
  }
  return patient
}

/**
 * Construct a well-formed FHIRcast STU3 `patient-open` event notification for
 * the given patient. Pure — no side effects, so it's safe to build one just to
 * show its JSON in the UI.
 */
export function buildPatientOpenEvent(
  payload: PatientOpenPayload,
  timestamp: string,
  /** The live session topic; falls back to the demo's fixed one. */
  topic: string = FHIRCAST_TOPIC,
): FhircastEvent {
  return {
    timestamp,
    id: makeId(),
    event: {
      'hub.topic': topic,
      'hub.event': PATIENT_OPEN_EVENT,
      context: [{ key: 'patient', resource: buildContextPatient(payload) }],
    },
  }
}

/**
 * Extract the patient-open payload from an event notification, or null if it
 * isn't a patient-open event with a resolvable patient in context. Tolerant of
 * arbitrary `unknown` input since it parses messages off the wire.
 */
export function parsePatientOpen(data: unknown): PatientOpenPayload | null {
  if (!data || typeof data !== 'object') return null
  const evt = (data as FhircastEvent).event
  if (!evt || evt['hub.event'] !== PATIENT_OPEN_EVENT || !Array.isArray(evt.context)) {
    return null
  }
  const patientCtx = evt.context.find(c => c && c.key === 'patient')
  const resource = patientCtx?.resource
  if (!resource || typeof resource !== 'object') return null

  const patientId = (resource as { id?: unknown }).id
  if (typeof patientId !== 'string' || patientId.length === 0) return null

  const identifiers = (resource as { identifier?: Array<{ system?: string; value?: string }> })
    .identifier
  const mrn = identifiers?.find(i => i?.system === MRN_SYSTEM)?.value

  const nameEntry = (resource as { name?: Array<{ given?: string[]; family?: string }> }).name?.[0]
  const displayName = nameEntry
    ? [nameEntry.given?.join(' '), nameEntry.family].filter(Boolean).join(' ').trim() || undefined
    : undefined

  return { patientId, mrn, displayName }
}

// --- Echo suppression: the "programmatic follow" marker ---------------------
//
// When a tab follows an incoming event, its listener navigates, which changes
// the URL → the active patient → and would fire the publish effect again,
// rebroadcasting the very event it just received (an infinite cross-tab loop).
// To break it, the listener marks the patient it is *about* to follow to; the
// publish effect consumes that marker and skips publishing for that activation.
//
// This is an id + timestamp guard, not a timer: it is robust to arbitrary delay
// between navigate() and the resulting activePatientId change (a few React
// ticks, never seconds). The policy (when to follow, when to publish) still
// lives in React; this is only the shared one-bit signal between the two.

interface FollowMark {
  patientId: string
  at: number
}

let followMark: FollowMark | null = null

// Generous upper bound on the URL→context→effect chain. Well beyond the handful
// of React ticks it actually takes, but short enough that a genuine, much-later
// re-selection of the same patient is never mistaken for a stale follow.
export const FOLLOW_WINDOW_MS = 5_000

/**
 * Record that the app is about to programmatically navigate to `patientId` in
 * response to an incoming FHIRcast event. Call immediately before navigating.
 */
export function markFollowing(patientId: string, now: number): void {
  followMark = { patientId, at: now }
}

/**
 * True if `patientId` matches an outstanding, fresh follow marker — i.e. this
 * activation was caused by an incoming event and must NOT be rebroadcast. Any
 * marker for this id is cleared (whether fresh or stale), so a later genuine
 * re-selection of the same patient publishes normally.
 */
export function consumeFollowing(patientId: string, now: number): boolean {
  if (!followMark || followMark.patientId !== patientId) return false
  const fresh = now - followMark.at <= FOLLOW_WINDOW_MS
  followMark = null
  return fresh
}

/** Inputs to {@link shouldPublishOnActivation} — all plain values, no React. */
export interface ActivationPublishInput {
  /** The chart's newly-active patient id (null = blank / no patient). */
  activePatientId: string | null
  /** Under a live SMART session the connected EHR owns context — never publish. */
  isSmartConnected: boolean
  /** The last id this tab already broadcast, to avoid rebroadcasting it. */
  lastPublishedId: string | null
  /** Current time in ms (passed in for testability and marker freshness). */
  now: number
}

/**
 * Decide whether a change in the chart's active patient should broadcast a
 * `patient-open` event. Returns false — without disturbing the follow marker —
 * when SMART owns context, there is no patient, or this patient was already
 * broadcast. Otherwise it consults (and consumes) the follow marker: a followed
 * activation returns false (echo suppressed), a user-initiated one returns
 * true. Kept pure/framework-free so the publish policy is unit-testable.
 */
export function shouldPublishOnActivation({
  activePatientId,
  isSmartConnected,
  lastPublishedId,
  now,
}: ActivationPublishInput): boolean {
  if (isSmartConnected) return false
  if (activePatientId === null) return false
  if (activePatientId === lastPublishedId) return false
  if (consumeFollowing(activePatientId, now)) return false
  return true
}

// ── Transport ───────────────────────────────────────────────────────────────
//
// Everything above is pure: it builds and parses FHIRcast event notifications
// and decides when to publish. What carries them is a separate concern, and
// step 6 is the reason it became one.
//
// ⚠️ **Two transports, and the difference is WHO is talking — not how.** That
// distinction drives a policy decision in `FhircastListener`, so it is modelled
// here rather than left implicit:
//
//   - `broadcast` — a `BroadcastChannel` between tabs of THIS app. A simulation:
//     no hub exists, and the "other app" is another copy of us. Same-origin by
//     construction, and it cannot cross into a host chart.
//   - `hub` — a real WebSocket subscription to a FHIRcast hub the connected EHR
//     told us about, at the EHR's own origin. When this is live, an incoming
//     `patient-open` is the EHR reporting its own context change, which is a
//     completely different claim from another SPiER tab doing so.
//
// The old module header said this file "says same-origin and will not cross the
// boundary", which the panel plan §6 listed as the thing FHIRcast would have to
// leave behind. This is that.

export type FhircastTransportKind = 'broadcast' | 'hub'

interface Transport {
  kind: FhircastTransportKind
  publish(event: FhircastEvent): boolean
  subscribe(handler: (event: FhircastEvent) => void): () => void
  close(): void
}

/** Which transport is live. Read by the React listener to pick its policy. */
export function activeTransportKind(): FhircastTransportKind {
  return hubTransport ? 'hub' : 'broadcast'
}

// ── BroadcastChannel (the same-origin simulation) ───────────────────────────
// One channel per document, opened lazily so importing this module has no
// side effects (and so it degrades gracefully where BroadcastChannel is
// unavailable, e.g. older test environments).
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(FHIRCAST_CHANNEL)
  return channel
}

/** The BroadcastChannel transport. Note it does NOT echo to the posting document. */
function broadcastTransport(): Transport | null {
  const ch = getChannel()
  if (!ch) return null
  return {
    kind: 'broadcast',
    publish: (event) => { ch.postMessage(event); return true },
    subscribe: (handler) => {
      const listener = (e: MessageEvent) => handler(e.data as FhircastEvent)
      ch.addEventListener('message', listener)
      return () => ch.removeEventListener('message', listener)
    },
    close: () => {},
  }
}

// ── WebSocket hub (the real thing, cross-origin) ────────────────────────────

/** Where the connected EHR's hub lives, from the SMART token response. */
export interface HubConfig {
  /** The hub's base URL — FHIRcast `hub.url`. */
  url: string
  /** The session topic — FHIRcast `hub.topic`. Scopes events to this session. */
  topic: string
}

let hubTransport: Transport | null = null
let hubConfig: HubConfig | null = null

/** The live hub configuration, or null when only the simulation is running. */
export function currentHub(): HubConfig | null {
  return hubConfig
}

/**
 * Subscribe to a real FHIRcast hub and make it the active transport.
 *
 * The subscription is the spec's: `POST {hub.url}` form-encoded with
 * `hub.channel.type=websocket`, `hub.mode=subscribe`, `hub.topic` and
 * `hub.events`, answered with a `hub.channel.endpoint` to connect a WebSocket
 * to. We do not invent a shortcut — a hub that handed out a socket URL without a
 * subscription request would not be one an EHR could stand in for.
 *
 * Idempotent for the same topic, so a re-render cannot open a second socket.
 * Returns false when the hub refuses or is unreachable, and the BroadcastChannel
 * simulation stays in place — an app that loses its hub should degrade to no
 * cross-app context rather than to a broken one.
 */
export async function configureFhircastHub(
  config: HubConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (hubConfig && hubConfig.url === config.url && hubConfig.topic === config.topic) return true
  closeFhircastHub()

  let endpoint: string
  try {
    const body = new URLSearchParams({
      'hub.channel.type': 'websocket',
      'hub.mode': 'subscribe',
      'hub.topic': config.topic,
      'hub.events': PATIENT_OPEN_EVENT,
    })
    const res = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return false
    const json = (await res.json()) as Record<string, unknown>
    const advertised = json['hub.channel.endpoint']
    if (typeof advertised !== 'string' || !advertised) return false
    endpoint = advertised
  } catch {
    return false
  }

  if (typeof WebSocket === 'undefined') return false
  const socket = new WebSocket(endpoint)

  socket.addEventListener('message', (e: MessageEvent) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(e.data))
    } catch {
      return
    }
    const evt = parsed as FhircastEvent
    // ⚠️ Topic check, and it is not ceremony. The topic is what scopes a
    // FHIRcast session; a hub that mixed topics would leak one clinician's
    // context into another's app, and a client that ignored the field would not
    // notice. Cheap to check, so check it.
    if (evt?.event?.['hub.topic'] !== config.topic) return
    // The subscriber ACK the spec asks for. Sent before dispatch so a handler
    // that throws cannot leave the hub waiting.
    if (typeof evt.id === 'string') {
      try {
        socket.send(JSON.stringify({ id: evt.id, status: 'ok' }))
      } catch { /* socket already closing — nothing useful to do */ }
    }
    dispatch(evt, 'hub')
  })

  hubConfig = config
  hubTransport = {
    kind: 'hub',
    publish: (event) => {
      // ⚠️ Published to the HUB over HTTP, not down our own socket. A hub relays
      // to *other* subscribers; echoing to the publisher is what the follow
      // marker exists to survive, and doing it over the socket would also make
      // this app the source of truth for fan-out, which it is not.
      void fetchImpl(`${config.url.replace(/\/+$/, '')}/${encodeURIComponent(config.topic)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {})
      return true
    },
    // Unused: subscribers register with the module (see the public API below),
    // and this transport pushes into that set from its socket handler. Kept on
    // the interface because the BroadcastChannel transport genuinely needs it.
    subscribe: () => () => {},
    close: () => {
      try { socket.close() } catch { /* already closed */ }
    },
  }
  return true
}

/** Drop the hub subscription and fall back to the same-origin simulation. */
export function closeFhircastHub(): void {
  hubTransport?.close()
  hubTransport = null
  hubConfig = null
}

// ── The public API, transport-agnostic ──────────────────────────────────────
//
// ⚠️ **Subscribers register with THIS module, not with a transport, and that is a
// correctness requirement rather than a nicety.** The hub is configured during
// the SMART redirect — which happens *after* `FhircastListener` has mounted and
// subscribed. A `subscribePatientOpen` that bound to whichever transport existed
// at call time would therefore attach to the BroadcastChannel and never see a
// single hub event, while every part of the wiring looked correct. Both
// transports feed one subscriber set instead, so a hub that arrives later starts
// delivering to handlers already registered.

type Subscriber = (
  payload: PatientOpenPayload,
  event: FhircastEvent,
  via: FhircastTransportKind,
) => void

const subscribers = new Set<Subscriber>()

function dispatch(event: FhircastEvent, via: FhircastTransportKind): void {
  const payload = parsePatientOpen(event)
  if (!payload) return
  for (const subscriber of subscribers) subscriber(payload, event, via)
}

/** Lazily attach the BroadcastChannel feed. Idempotent. */
let broadcastAttached = false
function attachBroadcast(): void {
  if (broadcastAttached) return
  const transport = broadcastTransport()
  if (!transport) return
  broadcastAttached = true
  transport.subscribe(event => dispatch(event, 'broadcast'))
}

/**
 * Publish a `patient-open` event. Returns the exact event that was sent (so a
 * caller can display it), or null if no transport is available.
 *
 * Goes to the hub when one is subscribed, otherwise to the BroadcastChannel —
 * never both, because two copies of one context change is not a truer statement
 * of it.
 */
export function publishPatientOpen(
  payload: PatientOpenPayload,
  timestamp: string,
): FhircastEvent | null {
  const evt = buildPatientOpenEvent(payload, timestamp, currentHub()?.topic)
  const transport = hubTransport ?? broadcastTransport()
  if (!transport) return null
  return transport.publish(evt) ? evt : null
}

/**
 * Subscribe to incoming `patient-open` events. The handler receives the parsed
 * payload, the raw event (for display/inspection), and **which transport it
 * arrived on** — the last of which decides policy, not presentation.
 *
 * An event from the connected EHR's hub is that EHR reporting its own context
 * change. An event from the BroadcastChannel is another tab of this app
 * simulating one. `FhircastListener` treats them differently and has to.
 */
export function subscribePatientOpen(handler: Subscriber): () => void {
  attachBroadcast()
  subscribers.add(handler)
  return () => { subscribers.delete(handler) }
}
