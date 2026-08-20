/**
 * fhircastHub — the FHIRcast hub Durable Object, and nothing else.
 *
 * ⚠️ Separate from `fhircastProtocol.ts` because `cloudflare:workers` is not
 * resolvable outside the Workers runtime, and `app.ts` needs the protocol
 * helpers as values under plain Node. Same split, same reason, as
 * `demoStore.ts` / `store.ts` — see that file's header.
 *
 * What this hub implements and what it deliberately does not is documented in
 * `fhircastProtocol.ts`; this file is the runtime, not the design.
 */
import { DurableObject } from 'cloudflare:workers'
import type { HubNotification, SocketMeta } from './fhircastProtocol'

export class FhircastHub extends DurableObject {
  /**
   * Fan-out counters for the control surface.
   *
   * ⚠️ **In memory, so they reset when the object hibernates — and the sockets do
   * NOT.** Observed while verifying step 6: `sockets: 2` with `sent: 0` moments
   * after two notifications had demonstrably been delivered and ACKed. That is
   * hibernation working as designed (the point of `acceptWebSocket` is that
   * sockets outlive the instance) and it makes these two numbers mean "since this
   * instance last woke", not "this session". Read them live, during a demo;
   * `sockets` and `topics` are the trustworthy fields because they are derived
   * from `getWebSockets()` rather than accumulated.
   *
   * Left in memory rather than moved to storage on purpose: a durable counter
   * would be truthful and would also make every notification a storage write, and
   * nothing here needs an audit trail.
   */
  private sent = 0
  private acked = 0

  /**
   * The WebSocket upgrade.
   *
   * ⚠️ **`fetch`, not an RPC method, and that is forced rather than stylistic.**
   * A `WebSocket` cannot cross the RPC boundary, so the Worker hands the whole
   * *request* to the stub and the upgrade happens in here. Trying it as
   * `stub.connect(topic)` returning a `Response` with a `webSocket` compiles and
   * fails at runtime.
   *
   * ⚠️ `acceptWebSocket` (the hibernatable API), not `server.accept()`. A demo hub
   * sits idle between clicks, and hibernation keeps sockets alive across
   * eviction — with `accept()` the DO must stay resident or every subscriber
   * silently drops. The attachment is what survives hibernation, so the topic has
   * to live there rather than in a field.
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const topic = url.searchParams.get('topic')
    if (!topic) return new Response('topic is required', { status: 400 })
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected a websocket upgrade', { status: 426 })
    }
    const events = (url.searchParams.get('events') ?? '').split(',').filter(Boolean)

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ topic, events } satisfies SocketMeta)
    // A confirmation frame, so a client can tell "connected" from "connected and
    // subscribed" — the spec's handshake confirmation, minimally.
    server.send(JSON.stringify({
      'hub.topic': topic,
      'hub.events': events.join(','),
      'hub.mode': 'subscribe',
    }))
    return new Response(null, { status: 101, webSocket: client })
  }

  /**
   * Fan a notification out to every socket subscribed to its topic. Returns how
   * many it went to.
   *
   * ⚠️ **No publisher exclusion, because there is no publisher socket.** Apps
   * publish by POSTing to the hub's notification endpoint (the spec's shape, and
   * what `fhircast.ts` does), so a publish never arrives on a socket and there is
   * nothing to exclude. It also means a subscriber that publishes DOES receive
   * its own notification back — which the app's follow-marker guard already
   * survives, and which is honest: a hub cannot tell which of its subscribers a
   * POST came from.
   */
  publish(topic: string, notification: HubNotification): number {
    const body = JSON.stringify(notification)
    let delivered = 0
    for (const socket of this.ctx.getWebSockets()) {
      const meta = socket.deserializeAttachment() as SocketMeta | null
      if (meta?.topic !== topic) continue
      try {
        socket.send(body)
        delivered += 1
      } catch {
        // A socket that has gone away is not an error worth failing a publish
        // for; the next `getWebSockets()` will not include it.
      }
    }
    this.sent += delivered
    return delivered
  }

  /** Read subscriber ACKs. Nothing else a client sends is meaningful here. */
  override async webSocketMessage(_socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    try {
      const parsed = JSON.parse(message) as { id?: unknown; status?: unknown }
      if (typeof parsed?.id === 'string' && parsed.status === 'ok') this.acked += 1
    } catch {
      // Not JSON, not an ACK. A real hub would ignore it too.
    }
  }

  /** Live fan-out stats, for the mock's control surface. */
  async stats(): Promise<{ sockets: number; topics: string[]; sent: number; acked: number }> {
    const sockets = this.ctx.getWebSockets()
    const topics = new Set<string>()
    for (const socket of sockets) {
      const meta = socket.deserializeAttachment() as SocketMeta | null
      if (meta?.topic) topics.add(meta.topic)
    }
    return { sockets: sockets.length, topics: [...topics].sort(), sent: this.sent, acked: this.acked }
  }

  /** Close every socket on a topic — `hub.mode=unsubscribe`. */
  async unsubscribe(topic: string): Promise<number> {
    let closed = 0
    for (const socket of this.ctx.getWebSockets()) {
      const meta = socket.deserializeAttachment() as SocketMeta | null
      if (meta?.topic !== topic) continue
      try {
        socket.close(1000, 'unsubscribed')
        closed += 1
      } catch { /* already gone */ }
    }
    return closed
  }
}
