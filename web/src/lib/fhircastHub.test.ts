/**
 * The hub transport — panel step 6.
 *
 * `fhircast.test.ts` covers the pure half (event building, parsing, the publish
 * policy, echo suppression). This covers what step 6 added: subscribing to a real
 * hub, and the fact that an event's *transport* travels with it.
 *
 * ⚠️ **The property most worth pinning is the one that has no symptom.** The hub
 * is configured during the SMART redirect, which happens AFTER `FhircastListener`
 * has mounted and subscribed. A `subscribePatientOpen` that bound to whichever
 * transport existed at call time would attach to the BroadcastChannel and never
 * deliver a single hub event — with every other part of the wiring correct, and
 * nothing failing. The "delivers to a handler registered before the hub existed"
 * case below is that, and it fails if the fan-in is undone.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  activeTransportKind,
  buildPatientOpenEvent,
  closeFhircastHub,
  configureFhircastHub,
  currentHub,
  publishPatientOpen,
  subscribePatientOpen,
  type FhircastEvent,
} from './fhircast'

const HUB_URL = 'https://ehr.example/fhircast'
const TOPIC = 'host-abc'
const ENDPOINT = 'wss://ehr.example/fhircast/ws?topic=host-abc'

/** A WebSocket stand-in that lets a test push frames at the client. */
class FakeSocket {
  static last: FakeSocket | null = null
  readonly sent: string[] = []
  private listeners = new Map<string, Set<(e: unknown) => void>>()
  closed = false

  readonly url: string

  // Not a parameter property: `erasableSyntaxOnly` (tsconfig) rejects those,
  // because they are TypeScript that emits runtime code.
  constructor(url: string) {
    this.url = url
    FakeSocket.last = this
  }

  addEventListener(type: string, fn: (e: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  send(data: string) { this.sent.push(data) }
  close() { this.closed = true }

  /** Deliver a frame as the hub would. */
  receive(payload: unknown) {
    for (const fn of this.listeners.get('message') ?? []) {
      fn({ data: JSON.stringify(payload) })
    }
  }
}

/** A fetch that answers the subscription and records notification POSTs. */
function hubFetch(overrides: { endpoint?: string | null; ok?: boolean } = {}) {
  const calls: Array<{ url: string; body: string; method: string }> = []
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, body: String(init?.body ?? ''), method: init?.method ?? 'GET' })
    if (overrides.ok === false) return new Response('no', { status: 500 })
    const endpoint = overrides.endpoint === undefined ? ENDPOINT : overrides.endpoint
    return new Response(
      JSON.stringify({ 'hub.channel.endpoint': endpoint, 'hub.topic': TOPIC }),
      { status: 202, headers: { 'content-type': 'application/json' } },
    )
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

beforeEach(() => {
  FakeSocket.last = null
  vi.stubGlobal('WebSocket', FakeSocket)
})

afterEach(() => {
  closeFhircastHub()
  vi.unstubAllGlobals()
})

describe('configureFhircastHub — the subscription request', () => {
  it('POSTs the spec’s form fields and connects to the advertised endpoint', async () => {
    const { impl, calls } = hubFetch()
    expect(await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)).toBe(true)

    expect(calls[0].url).toBe(HUB_URL)
    expect(calls[0].method).toBe('POST')
    const form = new URLSearchParams(calls[0].body)
    expect(form.get('hub.channel.type')).toBe('websocket')
    expect(form.get('hub.mode')).toBe('subscribe')
    expect(form.get('hub.topic')).toBe(TOPIC)
    expect(form.get('hub.events')).toBe('patient-open')

    expect(FakeSocket.last?.url).toBe(ENDPOINT)
    expect(activeTransportKind()).toBe('hub')
    expect(currentHub()).toEqual({ url: HUB_URL, topic: TOPIC })
  })

  it('stays on the simulation when the hub refuses', async () => {
    // ⚠️ Degrades to "no cross-app context", never to a broken chart. An app that
    // threw here would fail the whole SMART redirect over an optional feature.
    const { impl } = hubFetch({ ok: false })
    expect(await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)).toBe(false)
    expect(activeTransportKind()).toBe('broadcast')
    expect(currentHub()).toBeNull()
  })

  it('stays on the simulation when the hub advertises no channel', async () => {
    const { impl } = hubFetch({ endpoint: null })
    expect(await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)).toBe(false)
    expect(activeTransportKind()).toBe('broadcast')
  })

  it('is idempotent for the same session, so a re-render cannot open two sockets', async () => {
    const { impl, calls } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    const first = FakeSocket.last
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    expect(calls.length).toBe(1)
    expect(FakeSocket.last).toBe(first)
  })

  it('resubscribes for a different topic, and drops the old socket', async () => {
    const { impl } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    const first = FakeSocket.last!
    await configureFhircastHub({ url: HUB_URL, topic: 'other-topic' }, impl)
    expect(first.closed).toBe(true)
    expect(FakeSocket.last).not.toBe(first)
  })
})

describe('receiving from the hub', () => {
  const event = (topic: string): FhircastEvent =>
    buildPatientOpenEvent({ patientId: 'patient-012', displayName: 'Ana Ruiz' }, '2026-08-20T12:00:00Z', topic)

  it('delivers to a handler registered BEFORE the hub existed', async () => {
    // ⚠️ The load-bearing case — see the file header. This is the real ordering:
    // the listener mounts on app start, the hub arrives at /redirect.
    const seen: Array<{ id: string; via: string }> = []
    const unsubscribe = subscribePatientOpen((payload, _evt, via) => {
      seen.push({ id: payload.patientId, via })
    })

    const { impl } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    FakeSocket.last!.receive(event(TOPIC))

    expect(seen).toEqual([{ id: 'patient-012', via: 'hub' }])
    unsubscribe()
  })

  it('ignores an event for another topic', async () => {
    // The topic is what scopes a FHIRcast session; a client that ignored the
    // field would happily consume another clinician's context.
    const seen: string[] = []
    const unsubscribe = subscribePatientOpen(payload => seen.push(payload.patientId))
    const { impl } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    FakeSocket.last!.receive(event('someone-elses-session'))
    expect(seen).toEqual([])
    unsubscribe()
  })

  it('ACKs what it received, as a subscriber is asked to', async () => {
    const { impl } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    const evt = event(TOPIC)
    FakeSocket.last!.receive(evt)
    expect(FakeSocket.last!.sent.map(s => JSON.parse(s))).toEqual([{ id: evt.id, status: 'ok' }])
  })

  it('survives a frame that is not JSON', async () => {
    const { impl } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    const socket = FakeSocket.last!
    // The hub's own subscription-confirmation frame is not an event notification.
    expect(() => socket.receive({ 'hub.mode': 'subscribe', 'hub.topic': TOPIC })).not.toThrow()
  })
})

describe('publishing through the hub', () => {
  it('POSTs to the hub’s notification endpoint, not down the socket', async () => {
    // ⚠️ A hub relays to its subscribers; it is not a peer. Publishing over our
    // own socket would make this app responsible for fan-out, which it is not.
    const { impl, calls } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    const socket = FakeSocket.last!

    const event = publishPatientOpen({ patientId: 'patient-011' }, '2026-08-20T12:00:00Z')
    expect(event?.event['hub.topic']).toBe(TOPIC)
    expect(socket.sent).toEqual([])

    const post = calls.find(c => c.url.includes(encodeURIComponent(TOPIC)))
    expect(post).toBeDefined()
    expect(post!.method).toBe('POST')
    expect(JSON.parse(post!.body).event['hub.event']).toBe('patient-open')
  })

  it('stamps the live session topic rather than the demo default', async () => {
    // Two apps on different topics are in different sessions; publishing the
    // fixed demo topic would put this one in neither.
    const { impl } = hubFetch()
    await configureFhircastHub({ url: HUB_URL, topic: TOPIC }, impl)
    expect(publishPatientOpen({ patientId: 'p' }, 'now')?.event['hub.topic']).toBe(TOPIC)
    closeFhircastHub()
    expect(publishPatientOpen({ patientId: 'p' }, 'now')?.event['hub.topic']).toBe('spier-demo-session')
  })
})
