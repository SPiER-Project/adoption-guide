/**
 * The prefetch this host attaches to a CDS Hooks invocation.
 *
 * ⚠️ **Without it the service evaluates a fixture, not the chart.** The
 * discovery document `services/cds` publishes asks for
 * `QuestionnaireResponse?patient={{context.patientId}}&status=completed&_sort=-authored`
 * under the key `questionnaireResponses`, and its live path derives risk and
 * the pathway stage from whatever arrives there. This host invoked it with
 * context only, so the service fell to its documented fallback — the bundled
 * population scenario for that patient id — and the card on the chart page and
 * the card in the panel could disagree about the same patient the moment
 * anything was written. Brad's rule (2026-09-21): the card suggests the step
 * the chart data suggests. This is how the chart data gets there.
 *
 * ⚠️ **Both halves of the chart, or it is still a fixture.** A patient's
 * responses live in two places on this server: the scenario fixtures
 * (`fixtures.ts`, loaded at module start) and the Durable Object's writes
 * (`store.ts`, everything the panel has submitted). Sending only the fixtures
 * would reproduce the defect with extra steps — the panel submits a screen, the
 * chart's card carries on recommending it.
 *
 * ⚠️ **A searchset Bundle, because that is what a CDS client returns for a
 * query prefetch.** The service tolerates a bare resource or an array so
 * hand-built test payloads work; sending one of those from the real client
 * would leave the Bundle path — the one every other CDS client exercises —
 * covered by nothing.
 */
import { HELD_RESOURCES, type MockResource } from './fixtures'
import type { DemoState } from './store'

/** A FHIR searchset Bundle, as much of one as a prefetch needs. */
export interface SearchsetBundle {
  resourceType: 'Bundle'
  type: 'searchset'
  total: number
  entry: Array<{ fullUrl?: string; resource: MockResource }>
}

/** The prefetch key the service's discovery document declares. */
export const QR_PREFETCH_KEY = 'questionnaireResponses'

const isCompletedQr = (r: MockResource): boolean =>
  r.resourceType === 'QuestionnaireResponse' && r.status === 'completed'

/**
 * `authored` descending — the `_sort=-authored` the prefetch template asks for.
 *
 * ⚠️ Not cosmetic. The mappers run over the set in order and the pathway is
 * derived from the result, so "newest first" is part of what the template
 * requested and not this host's idea of a nice presentation. A response with no
 * `authored` sorts last rather than throwing: `fixtures.ts` already refuses to
 * load a scenario response without one, and a WRITTEN response is the app's to
 * stamp.
 */
function newestFirst(a: MockResource, b: MockResource): number {
  const left = typeof a.authored === 'string' ? a.authored : ''
  const right = typeof b.authored === 'string' ? b.authored : ''
  if (left === right) return 0
  if (!left) return 1
  if (!right) return -1
  return left < right ? 1 : -1
}

/**
 * Every completed QuestionnaireResponse this server holds for `patientId`,
 * fixtures and writes together, as a searchset Bundle.
 *
 * `fhirBase` is this host's own FHIR base, used for `Bundle.entry.fullUrl` —
 * the absolute identity of each resource, which is what a real client's
 * searchset carries. Omitted when a resource has no id, which nothing written
 * or held here should be.
 */
export async function questionnaireResponseBundle(
  patientId: string,
  store: DemoState | null,
  fhirBase: string,
): Promise<SearchsetBundle> {
  const held = HELD_RESOURCES
    .filter(h => h.patientId === patientId && isCompletedQr(h.resource))
    .map(h => h.resource)

  const written = store
    ? (await store.list())
      .filter(w => w.patientId === patientId && isCompletedQr(w.resource))
      .map(w => w.resource)
    : []

  // ⚠️ Written LAST, so a write that shadows a fixture at the same id wins the
  // de-duplication below. `DemoState.upsert` exists precisely because the app
  // converges lifecycle resources on one id rather than appending versions, and
  // a prefetch that carried both copies would hand the service a superseded
  // answer beside its replacement.
  const byKey = new Map<string, MockResource>()
  for (const resource of [...held, ...written]) {
    byKey.set(`QuestionnaireResponse/${String(resource.id ?? '')}`, resource)
  }

  const resources = [...byKey.values()].sort(newestFirst)
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map(resource => ({
      ...(resource.id ? { fullUrl: `${fhirBase}/QuestionnaireResponse/${String(resource.id)}` } : {}),
      resource,
    })),
  }
}
