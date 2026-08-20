/**
 * A `FHIRCAST_HUB` binding for tests.
 *
 * ⚠️ **Unlike `fakeStore`, this one really is a second implementation, and it has
 * to be.** The store's fake wraps `memoryStore()` — the same `DemoState` the
 * Durable Object implements, so the interface forces them to agree. The hub
 * cannot work that way: its whole job is `WebSocketPair` /
 * `ctx.acceptWebSocket` / `ctx.getWebSockets()`, none of which exist outside the
 * Workers runtime. There is no shared implementation to point at.
 *
 * So what these tests can and cannot show is worth being blunt about:
 *
 *   - **Can**: the HTTP surface — subscription validation, the endpoint URL the
 *     hub advertises, the topic-mismatch refusal, the 503 when unbound, and that
 *     `app.ts` calls the hub with the arguments it should.
 *   - **Cannot**: fan-out, hibernation, ACK counting, or topic isolation between
 *     real sockets. Those are the hub's actual behaviour and they are checked in
 *     a browser against `wrangler dev` and the deployed Worker — see the plan's
 *     §6.2. A green suite here is not evidence that context crosses.
 *
 * The recorded calls are the point: they let a test assert the *contract* between
 * `app.ts` and the hub without pretending to implement the hub.
 */
import type { FhircastHub } from '../fhircastHub'
import type { HubNotification } from '../fhircastProtocol'

export interface RecordedPublish {
  topic: string
  notification: HubNotification
}

export interface FakeHubBinding {
  FHIRCAST_HUB: DurableObjectNamespace<FhircastHub>
  /** Every publish the app asked for, in order. */
  published: RecordedPublish[]
  /** Every topic the app asked to unsubscribe. */
  unsubscribed: string[]
  /** Requests handed to the DO's `fetch` (the WebSocket upgrade path). */
  fetched: string[]
  /** What `stats()` should return. */
  stats: { sockets: number; topics: string[]; sent: number; acked: number }
  /** How many subscribers the next publish should claim to have reached. */
  deliverTo: number
}

export function fakeHub(): FakeHubBinding {
  const binding: FakeHubBinding = {
    FHIRCAST_HUB: null as unknown as DurableObjectNamespace<FhircastHub>,
    published: [],
    unsubscribed: [],
    fetched: [],
    stats: { sockets: 0, topics: [], sent: 0, acked: 0 },
    deliverTo: 0,
  }

  const stub = {
    publish: async (topic: string, notification: HubNotification) => {
      binding.published.push({ topic, notification })
      return binding.deliverTo
    },
    unsubscribe: async (topic: string) => {
      binding.unsubscribed.push(topic)
      return 1
    },
    stats: async () => binding.stats,
    fetch: async (request: Request) => {
      binding.fetched.push(request.url)
      // 101 cannot be constructed outside the runtime, so stand in with a 200.
      // A test asserting the status would be asserting this fixture.
      return new Response('would upgrade', { status: 200 })
    },
  }

  // Same single cast, for the same reason, as fakeStore — see its comment.
  binding.FHIRCAST_HUB = {
    idFromName: () => ({ toString: () => 'hub' }),
    get: () => stub,
  } as unknown as DurableObjectNamespace<FhircastHub>

  return binding
}
