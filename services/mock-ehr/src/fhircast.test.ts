/**
 * The FHIRcast hub's HTTP surface and the launch plumbing that carries a topic —
 * panel step 6.
 *
 * ⚠️ **What is NOT here: fan-out.** The hub's actual job — relaying a
 * notification to every socket on a topic and to no socket on another — needs
 * `WebSocketPair` and `ctx.acceptWebSocket`, which do not exist outside the
 * Workers runtime. See `__fixtures__/hub.ts`. Those properties were checked in a
 * browser against two origins (plan §6.2); a green run here does not show that
 * context crosses.
 *
 * What it does protect is everything that has to be right before fan-out can
 * matter: the subscription refusals, the endpoint the hub advertises, the topic
 * agreement between host and panel, and that the token response tells the app
 * where the hub is.
 */
import { describe, expect, it } from 'vitest'
import app from './app'
import { parseSubscription } from './fhircastProtocol'
import { fakeHub } from './__fixtures__/hub'
import { fakeStore } from './__fixtures__/store'
import { authHeaderFor, launchFor } from './__fixtures__/launch'

const BASE = 'https://mock-ehr.test'

function form(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString()
}

const GOOD_SUBSCRIPTION = {
  'hub.channel.type': 'websocket',
  'hub.mode': 'subscribe',
  'hub.topic': 'topic-1',
  'hub.events': 'patient-open',
}

describe('parseSubscription', () => {
  it('accepts a well-formed websocket subscription', () => {
    const parsed = parseSubscription(new URLSearchParams(GOOD_SUBSCRIPTION))
    expect(parsed).toEqual({ mode: 'subscribe', subscription: { topic: 'topic-1', events: ['patient-open'] } })
  })

  it('refuses a channel type this hub does not implement', () => {
    // ⚠️ Refused rather than coerced. An app that asked for `webhook` and
    // silently got a WebSocket would wait forever for callbacks that never come.
    const parsed = parseSubscription(new URLSearchParams({ ...GOOD_SUBSCRIPTION, 'hub.channel.type': 'webhook' }))
    expect(parsed).toHaveProperty('error')
    expect((parsed as { error: string }).error).toContain('websocket')
  })

  /** The good subscription minus one field. */
  function without(field: string): URLSearchParams {
    const params = new URLSearchParams(GOOD_SUBSCRIPTION)
    params.delete(field)
    return params
  }

  it('requires a topic, because the topic is what scopes a session', () => {
    const parsed = parseSubscription(without('hub.topic'))
    expect((parsed as { error: string }).error).toContain('hub.topic')
  })

  it('requires hub.events and rejects an unknown mode', () => {
    expect((parseSubscription(without('hub.events')) as { error: string }).error).toContain('hub.events')
    const badMode = parseSubscription(new URLSearchParams({ ...GOOD_SUBSCRIPTION, 'hub.mode': 'publish' }))
    expect((badMode as { error: string }).error).toContain('hub.mode')
  })

  it('reads unsubscribe as a mode rather than a separate endpoint', () => {
    const parsed = parseSubscription(new URLSearchParams({ ...GOOD_SUBSCRIPTION, 'hub.mode': 'unsubscribe' }))
    expect(parsed).toMatchObject({ mode: 'unsubscribe' })
  })
})

describe('POST /fhircast — the subscription request', () => {
  async function subscribe(fields: Record<string, string>, env: unknown = fakeHub()) {
    const res = await app.request(`${BASE}/fhircast`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form(fields),
    }, env as Record<string, unknown>)
    return { res, body: (await res.json()) as Record<string, string> }
  }

  it('answers 202 with a websocket endpoint on this server’s own host', async () => {
    // ⚠️ Derived from the REQUEST, not from a configured base URL. A hardcoded
    // origin is how a localhost demo hands out a production socket URL.
    const { res, body } = await subscribe(GOOD_SUBSCRIPTION)
    expect(res.status).toBe(202)
    expect(body['hub.channel.type']).toBe('websocket')
    const endpoint = new URL(body['hub.channel.endpoint'])
    expect(endpoint.protocol).toBe('wss:')
    expect(endpoint.host).toBe('mock-ehr.test')
    expect(endpoint.pathname).toBe('/fhircast/ws')
    expect(endpoint.searchParams.get('topic')).toBe('topic-1')
    expect(endpoint.searchParams.get('events')).toBe('patient-open')
  })

  it('uses ws: for an insecure origin, so a local demo can connect', async () => {
    const res = await app.request('http://localhost:8787/fhircast', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form(GOOD_SUBSCRIPTION),
    }, fakeHub() as unknown as Record<string, unknown>)
    const body = (await res.json()) as Record<string, string>
    expect(new URL(body['hub.channel.endpoint']).protocol).toBe('ws:')
  })

  it('400s a refused subscription instead of handing out a channel', async () => {
    const { res } = await subscribe({ ...GOOD_SUBSCRIPTION, 'hub.channel.type': 'webhook' })
    expect(res.status).toBe(400)
  })

  it('unsubscribe closes that topic’s sockets', async () => {
    const hub = fakeHub()
    const { res } = await subscribe({ ...GOOD_SUBSCRIPTION, 'hub.mode': 'unsubscribe' }, hub)
    expect(res.status).toBe(202)
    expect(hub.unsubscribed).toEqual(['topic-1'])
  })

  it('503s when the deployment has no hub, rather than pretending', async () => {
    const res = await app.request(`${BASE}/fhircast`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form(GOOD_SUBSCRIPTION),
    })
    expect(res.status).toBe(503)
  })

  it('preflights, because the panel subscribes cross-origin', async () => {
    // A preflight failure here looks exactly like a hub that is down.
    const res = await app.request(`${BASE}/fhircast`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://spier-adoption-guide.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    }, fakeHub() as unknown as Record<string, unknown>)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('POST /fhircast/{topic} — publishing a context change', () => {
  const notification = {
    timestamp: '2026-08-20T12:00:00Z',
    id: 'evt-1',
    event: { 'hub.topic': 'topic-1', 'hub.event': 'patient-open', context: [] },
  }

  it('hands the notification to the hub and reports the fan-out', async () => {
    const hub = fakeHub()
    hub.deliverTo = 2
    const res = await app.request(`${BASE}/fhircast/topic-1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(notification),
    }, hub as unknown as Record<string, unknown>)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ 'hub.topic': 'topic-1', delivered: 2 })
    expect(hub.published).toEqual([{ topic: 'topic-1', notification }])
  })

  it('refuses a topic mismatch in either direction', async () => {
    // ⚠️ Refused rather than resolved. Taking the URL's topic would let a
    // misaddressed event reach the wrong session; taking the body's would make
    // the URL decorative.
    const hub = fakeHub()
    const res = await app.request(`${BASE}/fhircast/topic-2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(notification),
    }, hub as unknown as Record<string, unknown>)
    expect(res.status).toBe(400)
    expect(hub.published).toEqual([])
  })

  it('400s a body that is not a notification', async () => {
    const res = await app.request(`${BASE}/fhircast/topic-1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    }, fakeHub() as unknown as Record<string, unknown>)
    expect(res.status).toBe(400)
  })
})

describe('the topic travels with the launch', () => {
  async function mint(payload: Record<string, unknown>) {
    const res = await app.request(`${BASE}/_admin/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return (await res.json()) as { topic?: string; launchUrl?: string }
  }

  it('mints a topic when the caller does not supply one', async () => {
    const body = await mint({ patient: 'patient-011' })
    expect(body.topic).toMatch(/^spier-/)
  })

  it('reuses the caller’s topic, which is how host and panel share a session', async () => {
    // ⚠️ The load-bearing one. The chart page passes ITS topic so the panel joins
    // the session the host is already in. A fresh topic per launch would give
    // each side its own session and nothing would cross — indistinguishable from
    // working until you check.
    const body = await mint({ patient: 'patient-011', topic: 'host-abc' })
    expect(body.topic).toBe('host-abc')
  })

  it('two launches with the same topic really are the same session', async () => {
    const first = await mint({ patient: 'patient-011', topic: 'host-abc' })
    const second = await mint({ patient: 'patient-012', topic: 'host-abc' })
    expect(first.topic).toBe(second.topic)
  })
})

describe('the token response tells the app where the hub is', () => {
  /** Mint a launch context the way the chart page does, then redeem it. */
  async function launchWithTopic(topic: string) {
    const minted = await app.request(`${BASE}/_admin/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patient: 'patient-011', topic }),
    })
    const { launch } = (await minted.json()) as { launch: string }
    return launchFor(BASE, { launch })
  }

  it('carries hub.url and hub.topic for a launch that has a topic', async () => {
    // FHIRcast puts these in the token response, which means the app is never
    // *configured* with a hub address — it is told one by the EHR that launched
    // it. Obtained through the real /authorize → /token flow.
    const { tokenResponse } = await launchWithTopic('host-abc')
    expect(tokenResponse['hub.topic']).toBe('host-abc')
    expect(tokenResponse['hub.url']).toBe(`${BASE}/fhircast`)
  })

  it('omits them for the standalone shortcut, which carries no launch context', async () => {
    // ⚠️ A token advertising a hub for a session that does not exist would send
    // the app subscribing to nothing. `?patient=` skips the launch context
    // entirely (see the note in smart.ts), so there is no topic to advertise.
    const { tokenResponse } = await launchFor(BASE, { patient: 'patient-011' })
    expect(tokenResponse['hub.topic']).toBeUndefined()
    expect(tokenResponse['hub.url']).toBeUndefined()
  })
})

describe('GET /_admin/fhircast', () => {
  it('reports live socket counts for the control surface', async () => {
    const hub = fakeHub()
    hub.stats = { sockets: 2, topics: ['host-abc'], sent: 5, acked: 5 }
    const res = await app.request(`${BASE}/_admin/fhircast`, {}, hub as unknown as Record<string, unknown>)
    expect(await res.json()).toEqual(hub.stats)
  })

  it('503s without a hub binding', async () => {
    const res = await app.request(`${BASE}/_admin/fhircast`)
    expect(res.status).toBe(503)
  })
})

describe('the store and the hub are independent bindings', () => {
  it('a deployment with a store but no hub still serves FHIR', async () => {
    // The two Durable Objects are separate classes on purpose; losing one must
    // not take the other down.
    const env = { ...fakeStore() } as unknown as Record<string, unknown>
    const headers = await authHeaderFor(BASE, 'patient-011')
    const res = await app.request(`${BASE}/fhir/Patient/patient-011`, { headers }, env)
    expect(res.status).toBe(200)
    const hubRes = await app.request(`${BASE}/_admin/fhircast`, {}, env)
    expect(hubRes.status).toBe(503)
  })
})
