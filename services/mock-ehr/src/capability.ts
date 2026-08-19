/**
 * capability — what this server says it can do, and the switch that changes it.
 *
 * `/metadata` is the smallest endpoint here and the most load-bearing one. The
 * panel's writeback ladder reads it through `parseCapabilityStatement`
 * (web/src/lib/writeback/capability.ts) and attempts only the tiers the server
 * advertises `create` for; anything unreadable yields NO capabilities and the
 * ladder degrades to its Tier-0 floor. So the CapabilityStatement is the input
 * that decides how far the ladder climbs — which is exactly why the advertised
 * set is switchable at runtime rather than baked in.
 *
 * That switch is the capability-degradation demo. Flip the profile, relaunch
 * the panel, submit the same instrument, and the scorecard shows Tier 2 as
 * `unsupported` and the DocumentReference floor firing in its place — the
 * behaviour an integration lead is being asked to believe, performed rather
 * than described.
 *
 * ⚠️ The active profile lives in module memory, so it is per-isolate and does
 * not survive a cold start. That is honest for a demo — flip it, then launch —
 * but it means the switch is NOT a durable setting. Making it durable (KV or a
 * Durable Object) is a later step; the seam that would have been expensive to
 * retrofit is this module, not its storage.
 */

/** The four advertised postures, ordered most to least capable. */
export const CAPABILITY_PROFILES = ['full', 'no-observation', 'documents-only', 'read-only'] as const
export type CapabilityProfile = typeof CAPABILITY_PROFILES[number]

export function isCapabilityProfile(value: unknown): value is CapabilityProfile {
  return typeof value === 'string' && (CAPABILITY_PROFILES as readonly string[]).includes(value)
}

/** Which types each profile advertises `create` for. Reads are never withheld. */
const CREATABLE: Record<CapabilityProfile, string[]> = {
  // A modern EHR: every ladder tier lands, including the opt-in Tier 3.
  full: ['QuestionnaireResponse', 'Observation', 'Condition', 'DocumentReference'],
  // The interesting middle: discrete capture lands, derived extraction does
  // not. Tier 2 reports `unsupported` and the floor carries the data instead.
  'no-observation': ['QuestionnaireResponse', 'DocumentReference'],
  // The least capable EHR that is still useful: only the Tier-0 floor lands.
  'documents-only': ['DocumentReference'],
  // Nothing may be written. Every tier reports `unsupported`.
  'read-only': [],
}

/** One-line description of each profile, for the control page and the API. */
export const PROFILE_DESCRIPTIONS: Record<CapabilityProfile, string> = {
  full: 'Creates QuestionnaireResponse, Observation, Condition and DocumentReference — every ladder tier lands.',
  'no-observation': 'No Observation create: Tier 2 reports unsupported and the DocumentReference floor carries it.',
  'documents-only': 'Only DocumentReference create: Tiers 1–3 unsupported, the floor is the whole writeback.',
  'read-only': 'No creates at all: the ladder attempts nothing and says so.',
}

/** Types the ladder may try to write, whether or not this server holds any. */
const WRITABLE_TYPES = ['QuestionnaireResponse', 'Observation', 'Condition', 'DocumentReference']

export function creatableTypes(profile: CapabilityProfile): string[] {
  return CREATABLE[profile]
}

/**
 * Build the CapabilityStatement for a profile. `readableTypes` is what this
 * server actually holds (from the fixtures), so the advertised read surface
 * cannot drift from the served one.
 */
export function buildCapabilityStatement(
  profile: CapabilityProfile,
  readableTypes: string[],
  fhirBaseUrl: string,
): Record<string, unknown> {
  const creatable = new Set(creatableTypes(profile))
  const types = [...new Set([...readableTypes, ...WRITABLE_TYPES])].sort()
  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    // Fixed rather than "now": a CapabilityStatement that changes on every
    // request is noise in a diff and defeats caching comparisons in a demo.
    date: '2026-08-18',
    publisher: 'SPiER — mock EHR (demonstration only)',
    kind: 'instance',
    implementation: {
      description:
        'SPiER mock EHR. Serves the project’s own synthetic population scenarios. '
        + 'NOT a conformance target and never evidence of interoperability — that claim is '
        + 'only ever made against a public sandbox we do not control.',
      url: fhirBaseUrl,
    },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json'],
    rest: [
      {
        mode: 'server',
        documentation: `Capability profile: ${profile}. ${PROFILE_DESCRIPTIONS[profile]}`,
        security: {
          // Step 1 is an open read API on purpose; SMART authorize/token is step 2.
          description: 'Open (no authorization) — this is the step-1 read API.',
        },
        resource: types.map(type => ({
          type,
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
            ...(creatable.has(type) ? [{ code: 'create' }] : []),
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
            ...(type === 'Observation' ? [{ name: 'category', type: 'token' }] : []),
          ],
        })),
      },
    ],
  }
}
