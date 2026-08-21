/**
 * capability — read a FHIR server's CapabilityStatement and distill which
 * resource types it can `create`, so the ladder attempts only supported
 * discrete tiers (and falls back to the Tier-0 floor otherwise).
 *
 * The parser is deliberately defensive: a real sandbox's `/metadata` can be
 * huge, partial, or shaped oddly. Anything we can't read as an explicit
 * `create` interaction is treated as unsupported — the ladder degrades, it
 * never assumes.
 */
import type { ServerCapabilities } from './types'

/** Minimal shape of the bits of a CapabilityStatement we read. */
interface CapabilityStatementLike {
  resourceType?: string
  rest?: Array<{
    mode?: string
    resource?: Array<{
      type?: string
      interaction?: Array<{ code?: string }>
    }>
  }>
}

/**
 * Parse a CapabilityStatement into `{ [resourceType]: { create } }`.
 *
 * Scans every `rest` entry (not just `mode: 'server'` — some sandboxes omit or
 * mislabel the mode) and marks a resource type creatable when it lists a
 * `create` interaction. Tolerates a missing/malformed `rest`, resources with no
 * `type` or no `interaction` array, and a non-CapabilityStatement body — all
 * yield no capabilities rather than throwing.
 */
export function parseCapabilityStatement(cs: unknown): ServerCapabilities {
  const caps: ServerCapabilities = {}
  const statement = cs as CapabilityStatementLike | null
  const rest = statement?.rest
  if (!Array.isArray(rest)) return caps

  for (const entry of rest) {
    const resources = entry?.resource
    if (!Array.isArray(resources)) continue
    for (const res of resources) {
      const type = res?.type
      if (typeof type !== 'string' || !type) continue
      const interactions = Array.isArray(res.interaction) ? res.interaction : []
      const canCreate = interactions.some(i => i?.code === 'create')
      // A resource may appear once per rest entry; OR the flags so a later
      // entry can only ever add support, never remove it.
      caps[type] = { create: caps[type]?.create || canCreate }
    }
  }
  return caps
}

/** True when the server advertises `create` for `resourceType`. */
export function canCreate(caps: ServerCapabilities, resourceType: string): boolean {
  return caps[resourceType]?.create === true
}

/**
 * Fetch + parse the server's CapabilityStatement. `baseUrl` is the FHIR base
 * (e.g. fhirclient's `client.state.serverUrl`); the trailing slash is
 * normalized. `fetchImpl` is injectable for tests. Network/parse failures
 * resolve to empty capabilities (the ladder then relies on the Tier-0 floor)
 * rather than rejecting — probing is best-effort.
 */
export async function fetchCapabilities(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ServerCapabilities> {
  try {
    const base = baseUrl.replace(/\/+$/, '')
    const res = await fetchImpl(`${base}/metadata`, {
      headers: { accept: 'application/fhir+json' },
    })
    if (!res.ok) return {}
    return parseCapabilityStatement(await res.json())
  } catch {
    return {}
  }
}
