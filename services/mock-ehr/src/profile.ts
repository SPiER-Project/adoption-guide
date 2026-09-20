/**
 * The live capability profile — the degradation switch's state.
 *
 * Two layers, and the order they are read in is the fix rather than a
 * preference: see `liveProfile`. Split out of app.ts so the FHIR routes (which
 * read it) and the admin routes (which write it) import one module rather than
 * each other.
 */
import { isCapabilityProfile, type CapabilityProfile } from './capability'
import { storeFor } from './store'
import { envOf, type Env } from './env'

// The live profile, in module memory. Per-isolate and non-durable by design — see capability.ts.
let activeProfile: CapabilityProfile | null = null

export function getProfile(env: Env = {}): CapabilityProfile {
  if (activeProfile) return activeProfile
  return isCapabilityProfile(env.MOCK_CAPABILITY_PROFILE) ? env.MOCK_CAPABILITY_PROFILE : 'full'
}

export function setProfile(profile: CapabilityProfile): void {
  activeProfile = profile
}

/** Test seam: forget the runtime override so each test starts from the env. */
export function resetProfile(): void {
  activeProfile = null
}

/**
 * The profile this request should answer with.
 *
 * ⚠️ **The durable value wins, and that ordering is the fix, not a preference.**
 * `getProfile` above reads module memory, which is per-isolate: an operator flips
 * the profile in whichever isolate served the control page, and the panel then
 * reads `/metadata` from whichever serves that — so the presenter says "this EHR
 * refuses Observations" while the panel is told it accepts them. Every local test
 * passes because `wrangler dev` runs one isolate. The module value survives as
 * the fallback for unit tests (no binding) and for a first request that precedes
 * any switch.
 */
export async function liveProfile(c: { env?: Env }): Promise<CapabilityProfile> {
  const store = storeFor(envOf(c))
  const stored = await store?.getProfile()
  return stored ?? getProfile(envOf(c))
}

