/**
 * demoStore — the Durable Object class, and nothing else.
 *
 * ⚠️ **Separate from `store.ts` for one concrete reason: `cloudflare:workers` is
 * not resolvable outside the Workers runtime.** `store.ts` is imported by
 * `app.ts`, which every unit test drives directly under plain Node — so a
 * runtime-only import there fails the whole suite with "Failed to load url
 * cloudflare:workers", which reads as a missing file rather than a missing
 * runtime. `store.ts` now imports this file with `import type` only, which
 * esbuild erases, so the tests never reach it. The alternative was a shim alias
 * (the pattern `vite.config.ts` uses for `fhirpath/fhir-context/r5`), and that
 * would have been a shim standing in for the one class whose behaviour actually
 * matters here.
 *
 * The interface it implements, the id scheme, and why the profile lives in here
 * are all documented in `store.ts` — this file is the runtime binding, not the
 * design.
 */
import { DurableObject } from 'cloudflare:workers'
import type { CapabilityProfile } from './capability'
import type { DemoState, StoredWrite } from './store'
import type { MockResource } from './fixtures'

/** Storage keys. `seq` is the id counter; writes are `w:<zero-padded seq>`. */
const SEQ_KEY = 'seq'
const WRITE_PREFIX = 'w:'
const PROFILE_KEY = 'profile'

/** Zero-padded so `storage.list()`'s lexicographic order is insertion order. */
function writeKey(seq: number): string {
  return `${WRITE_PREFIX}${String(seq).padStart(9, '0')}`
}

export class DemoStore extends DurableObject implements DemoState {
  async add(patientId: string, resource: MockResource): Promise<MockResource> {
    const seq = ((await this.ctx.storage.get<number>(SEQ_KEY)) ?? 0) + 1
    const stored: MockResource = { ...resource, id: `srv-${seq}` }
    // Both writes in one block so a crash cannot leave the counter ahead of the
    // data (which would silently skip an id) or behind it (which would collide).
    await this.ctx.storage.put({ [SEQ_KEY]: seq, [writeKey(seq)]: { patientId, resource: stored } })
    return stored
  }

  async upsert(patientId: string, resource: MockResource): Promise<MockResource> {
    const entries = await this.ctx.storage.list<StoredWrite>({ prefix: WRITE_PREFIX })
    for (const [key, value] of entries) {
      if (value.resource.resourceType === resource.resourceType && value.resource.id === resource.id) {
        await this.ctx.storage.put(key, { patientId, resource })
        return resource
      }
    }
    // First write of this id: append it, but keep the CLIENT's id rather than
    // minting one. That is what update-as-create means, and it is what lets the
    // next PUT for the same id find this entry.
    const seq = ((await this.ctx.storage.get<number>(SEQ_KEY)) ?? 0) + 1
    await this.ctx.storage.put({ [SEQ_KEY]: seq, [writeKey(seq)]: { patientId, resource } })
    return resource
  }

  async list(): Promise<StoredWrite[]> {
    const entries = await this.ctx.storage.list<StoredWrite>({ prefix: WRITE_PREFIX })
    return [...entries.values()]
  }

  async reset(): Promise<number> {
    const keys = [...(await this.ctx.storage.list({ prefix: WRITE_PREFIX })).keys()]
    await this.ctx.storage.delete(keys)
    // ⚠️ The counter is NOT reset. Reusing `srv-1` after a reset would let a
    // stale reference from the previous run resolve to a different resource —
    // the kind of thing that makes a demo look haunted. Ids stay unique for the
    // lifetime of the store.
    return keys.length
  }

  async getProfile(): Promise<CapabilityProfile | null> {
    return (await this.ctx.storage.get<CapabilityProfile>(PROFILE_KEY)) ?? null
  }

  async setProfile(profile: CapabilityProfile): Promise<void> {
    // Deliberately NOT cleared by reset(): "reset the demo data" and "put the
    // server back to full capability" are different intentions, and a reset that
    // silently re-armed the ladder would undo the degradation the presenter just
    // set up.
    await this.ctx.storage.put(PROFILE_KEY, profile)
  }
}
