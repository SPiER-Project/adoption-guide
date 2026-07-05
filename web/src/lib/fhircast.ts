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
 * Deliberately one-way and v1-scoped: this module only *models* the
 * `patient-open` event. The receiving side's guardrails (only follow while on
 * a chart route, ignore under a live SMART session) live in the React
 * listener, not here — this file stays framework-free and side-effect-free
 * apart from the channel it owns.
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
