/**
 * The FHIR-shaped pieces every route module reaches for: the media type, an
 * OperationOutcome, the base URL, a searchset Bundle, and the merged view of
 * fixtures plus writes that read and search both serve from.
 */
import { HELD_RESOURCES, type MockResource } from './fixtures'
import { storeFor } from './store'
import { envOf, type Env } from './env'

export const FHIR_JSON = 'application/fhir+json'

export function fhirBase(url: string): string {
  return `${new URL(url).origin}/fhir`
}

export function operationOutcome(severity: 'error' | 'warning', code: string, diagnostics: string) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  }
}

/**
 * Everything this server can serve for a patient: the fixtures plus anything
 * written since.
 *
 * ⚠️ Written resources come LAST. `applySearch` preserves order and the app
 * renders newest-last lists, so appending is what makes a just-submitted
 * instrument appear where a clinician expects it. It also means a write cannot
 * displace a fixture, which keeps the demo re-runnable.
 */
export async function servableFor(c: { env?: Env }): Promise<MockResource[]> {
  const store = storeFor(envOf(c))
  if (!store) return HELD_RESOURCES.map(h => h.resource)
  const written = await store.list()
  if (written.length === 0) return HELD_RESOURCES.map(h => h.resource)

  // ⚠️ Keyed by `Type/id`, with the written version REPLACING a fixture of the
  // same id — not appended beside it. The app closing an episode it read out of
  // the fixtures PUTs the fixture's own id, because that id IS the server's id
  // here; concatenating would return both versions and the chart would show the
  // episode as open and closed at once. Insertion order is preserved so a
  // just-written resource still lands after the fixtures.
  const byKey = new Map<string, MockResource>()
  for (const { resource } of HELD_RESOURCES) {
    byKey.set(`${resource.resourceType}/${String(resource.id)}`, resource)
  }
  for (const { resource } of written) {
    byKey.set(`${resource.resourceType}/${String(resource.id)}`, resource)
  }
  return [...byKey.values()]
}

/**
 * A searchset Bundle, which is what `client.request(url, { flat: true })`
 * unwraps. ⚠️ No `link` entry: `pageLimit: 0` means fhirclient follows every
 * `next` it is given, so emitting a link this server cannot serve would loop
 * the client rather than fail it.
 */
export function searchset(resources: MockResource[], base: string) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map(resource => ({
      fullUrl: `${base}/${resource.resourceType}/${resource.id}`,
      resource,
      search: { mode: 'match' },
    })),
  }
}

