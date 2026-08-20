/**
 * A `DEMO_STORE` binding for tests.
 *
 * The fake is a namespace whose `get()` returns the in-memory `DemoState` from
 * `store.ts` — not a second implementation. That matters: a hand-written test
 * double of a Durable Object is exactly the thing that drifts from the real one
 * and then defends the drift, so the only invented part here is the *namespace*
 * (two methods, no behaviour) and the state itself is the shared implementation
 * the interface forces to match.
 *
 * What this cannot prove: that the real Durable Object persists across isolates.
 * Nothing running under Node can. `wrangler dev` and the browser run are where
 * that was checked — see the plan's §5.1.
 */
import { memoryStore, type DemoState } from '../store'
import type { DemoStore } from '../demoStore'

export interface FakeStoreBinding {
  DEMO_STORE: DurableObjectNamespace<DemoStore>
  /** The same state the app will see, so a test can inspect it directly. */
  state: DemoState
}

/**
 * ⚠️ One cast, and it is the honest one: the real `env.DEMO_STORE.get()` returns
 * an RPC stub whose callable surface IS `DemoState` (that is what
 * `DurableObjectNamespace<DemoStore>` means), but its nominal type carries
 * Workers-runtime branding that cannot be constructed outside the runtime.
 * Casting the namespace rather than the state keeps the state fully typed.
 */
export function fakeStore(): FakeStoreBinding {
  const state = memoryStore()
  const namespace = {
    idFromName: () => ({ toString: () => 'demo' }),
    get: () => state,
  } as unknown as DurableObjectNamespace<DemoStore>
  return { DEMO_STORE: namespace, state }
}
