import { makeId } from './id'

/**
 * FHIRcast (STU3) patient-open events over a same-origin BroadcastChannel.
 *
 * A real FHIRcast deployment has a *hub* that relays context-change events to
 * every subscribed app over WebSocket (or server-sent events). Here there is
 * no hub: two browser tabs of this same app (one showing the population
 * worklist, one showing a patient chart) stand in for two subscribed apps, and
 * a `BroadcastChannel` stands in for the hub's fan-out. The important part —
 * and the reason this is more than a `localStorage` ping — is that the payload
 * on the wire is a real FHIRcast **event notification**, so it can be
 * inspected and it maps 1:1 onto what a production hub would deliver.
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

const MRN_SYSTEM = 'http://hospital.example.org/mrn'

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
): FhircastEvent {
  return {
    timestamp,
    id: makeId(),
    event: {
      'hub.topic': FHIRCAST_TOPIC,
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

// One channel per document, opened lazily so importing this module has no
// side effects (and so it degrades gracefully where BroadcastChannel is
// unavailable, e.g. older test environments).
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(FHIRCAST_CHANNEL)
  return channel
}

/**
 * Publish a `patient-open` event to the other tabs. Returns the exact event
 * that was sent (so a caller can display it), or null if BroadcastChannel is
 * unavailable. Note BroadcastChannel does not echo to the posting document —
 * only *other* tabs receive it, which is exactly the semantics we want.
 */
export function publishPatientOpen(
  payload: PatientOpenPayload,
  timestamp: string,
): FhircastEvent | null {
  const evt = buildPatientOpenEvent(payload, timestamp)
  const ch = getChannel()
  if (!ch) return null
  ch.postMessage(evt)
  return evt
}

/**
 * Subscribe to incoming `patient-open` events. The handler receives the parsed
 * payload plus the raw event (for display/inspection). Returns an unsubscribe
 * function. No-op (returns a no-op cleanup) where BroadcastChannel is missing.
 */
export function subscribePatientOpen(
  handler: (payload: PatientOpenPayload, event: FhircastEvent) => void,
): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const listener = (e: MessageEvent) => {
    const payload = parsePatientOpen(e.data)
    if (payload) handler(payload, e.data as FhircastEvent)
  }
  ch.addEventListener('message', listener)
  return () => ch.removeEventListener('message', listener)
}
