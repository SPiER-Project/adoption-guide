/**
 * store — where written resources live, so a read reflects a write.
 *
 * Panel step 4. Until now this server was read-only: the fixtures were the whole
 * dataset and every request saw the same thing. A writeback demo needs the
 * opposite property — submit an instrument in the panel, and the chart it
 * reloads has to show what was just written, or the ladder's report is a claim
 * the server does not corroborate.
 *
 * ── Why a Durable Object and not module state ───────────────────────────────
 *
 * Cloudflare runs many isolates, so a POST and the GET that follows it can land
 * in different ones. Module state would make a written resource appear and
 * disappear depending on which isolate answered — worse than not persisting at
 * all, because it looks like a bug in SPiER rather than a missing feature. A
 * Durable Object is the smallest thing with one home for the data.
 *
 * ⚠️ **The capability profile moved in here too, and that was a correctness fix
 * rather than tidying.** `capability.ts` still describes it as module-local and
 * per-isolate, which was defensible while it was only a knob with a good
 * default. It is not defensible for the degradation demo: the operator flips the
 * profile in whichever isolate answers `/`, and the panel then reads `/metadata`
 * from whichever answers that — so the presenter says "this EHR cannot write
 * Observations" while the panel is told it can. Every local test passes, because
 * `wrangler dev` runs one isolate. See `DemoState.getProfile`.
 *
 * ⚠️ **One store, not one per session.** The plan says "keep writes in KV or a
 * Durable Object under a session key"; this uses a single instance named `demo`.
 * The mock has no session identity to key on — the access token is patient-bound
 * and carries nothing else — and inventing one would be plumbing in service of a
 * property no demo needs. The consequence is real and worth stating: two people
 * demonstrating at once share written resources. **Reset** is the mitigation, and
 * it is one click.
 *
 * ── The ids are server-minted, and that is load-bearing ─────────────────────
 *
 * `srv-N`, from a counter in the store — deliberately unlike anything a client
 * would produce. `SmartDataSource.toCreatePayload` strips the client's `id`
 * before POSTing, and `executeWritePlan` then remaps
 * `QuestionnaireResponse/<client id>` to the server's id inside
 * `Observation.derivedFrom` and `Condition.evidence`. If this server echoed the
 * client's id back, that remap would be a no-op and the provenance bug it exists
 * to prevent would be untestable here. Assigning a visibly different id is what
 * makes the demo exercise it.
 */
import type { MockResource } from './fixtures'
import type { CapabilityProfile } from './capability'
// Type-only: see the header of demoStore.ts for why this must never become a
// value import.
import type { DemoStore } from './demoStore'

/** A resource this server was given, with the patient it was written for. */
export interface StoredWrite {
  patientId: string
  resource: MockResource
}

/**
 * The demo's durable state. Both the Durable Object and the in-memory test
 * double implement exactly this, so a test cannot exercise a shape the deployed
 * path does not have.
 */
export interface DemoState {
  /** Persist a resource under a freshly minted server id; returns what was stored. */
  add(patientId: string, resource: MockResource): Promise<MockResource>
  /**
   * Write a resource under the id the CLIENT chose, replacing any existing one
   * with that `Type/id` — FHIR update-as-create.
   *
   * ⚠️ Not a variant of `add` for tidiness: the app needs both, and for opposite
   * reasons. `SmartDataSource.saveArtifact` POSTs appended resources (a new
   * Observation is a new fact) and PUTs the *lifecycle* ones — an episode is
   * opened then closed, a flag raised then cleared, a task created then
   * completed. Appending each transition would leave the superseded version on
   * the server, so a closed episode still reads as open. Convergence on one
   * resource is the property; keeping the client id is how it is achieved.
   */
  upsert(patientId: string, resource: MockResource): Promise<MockResource>
  /** Everything written so far, oldest first. */
  list(): Promise<StoredWrite[]>
  /** Forget every write. Returns how many were discarded. */
  reset(): Promise<number>
  /**
   * The advertised capability profile, or null if never set here.
   *
   * ⚠️ **This had to become durable for the degradation demo to be honest.**
   * `capability.ts` holds the active profile in module memory, which is
   * per-isolate — fine for a knob whose default is right, and NOT fine for this
   * one: Cloudflare runs many isolates, so an operator flips the profile in one
   * and the panel then reads `/metadata` from another that never heard about it.
   * The demo would show the full ladder while the presenter says it is degraded.
   * Locally, with a single isolate, it looks like it works.
   */
  getProfile(): Promise<CapabilityProfile | null>
  setProfile(profile: CapabilityProfile): Promise<void>
}

/**
 * The single store instance.
 *
 * ⚠️ Returns null when the binding is absent, rather than falling back to
 * something that works. A memory fallback here would make a misconfigured deploy
 * behave *almost* correctly — writes accepted, reads inconsistent between
 * isolates — which is the hardest failure to diagnose from a demo. The caller
 * turns null into a 503 that says what is wrong.
 */
export function storeFor(env: { DEMO_STORE?: DurableObjectNamespace<DemoStore> }): DemoState | null {
  if (!env.DEMO_STORE) return null
  return env.DEMO_STORE.get(env.DEMO_STORE.idFromName('demo'))
}

/**
 * In-memory store for tests, implementing the same interface.
 *
 * The id sequence matches the Durable Object's (`srv-1`, `srv-2`, …) because
 * tests assert on it: an id shaped like the client's would let a broken
 * `derivedFrom` remap pass.
 */
export function memoryStore(): DemoState {
  const writes: StoredWrite[] = []
  let seq = 0
  let profile: CapabilityProfile | null = null
  return {
    getProfile: async () => profile,
    setProfile: async (next) => { profile = next },
    add: async (patientId, resource) => {
      seq += 1
      const stored: MockResource = { ...resource, id: `srv-${seq}` }
      writes.push({ patientId, resource: stored })
      return stored
    },
    upsert: async (patientId, resource) => {
      const at = writes.findIndex(
        w => w.resource.resourceType === resource.resourceType && w.resource.id === resource.id,
      )
      if (at >= 0) writes[at] = { patientId, resource }
      else writes.push({ patientId, resource })
      return resource
    },
    list: async () => [...writes],
    reset: async () => {
      const n = writes.length
      writes.length = 0
      return n
    },
  }
}
