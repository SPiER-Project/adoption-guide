/**
 * What a resource derived from a QuestionnaireResponse takes from that
 * response: its id lineage and its clinical time. Shared by the Observation and
 * CarePlan mappers, so a response and everything derived from it agree.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import type { QuestionnaireResponseResource } from '../types/fhir'

/**
 * When the answers were given — the time every result derived from them carries.
 *
 * ⚠️ **The response's own time, and the clock only as a last resort.** Every
 * mapper used to stamp `new Date()`, so a result's clinical time was whenever it
 * happened to be derived: re-deriving a chart, or importing another system's
 * responses, dated every result "now". `authored` is the answer; the server's
 * `meta.lastUpdated` is the best a response without one offers. Only a response
 * carrying neither — another system's, never one SPiER saved, which stamps
 * `authored` (useCorrelatedSave) — falls back to the moment of derivation, and
 * this is the one place that does.
 */
export function responseTime(response: QuestionnaireResponseResource): string {
  const r = response as { authored?: string; meta?: { lastUpdated?: string } }
  return r.authored ?? r.meta?.lastUpdated ?? new Date().toISOString()
}

/**
 * The id of a result derived from a response: `<response id>-<suffix>`.
 *
 * Deterministic, so deriving the same response twice yields the same ids — a
 * re-derivation finds its results instead of minting duplicates, and a result
 * names its response without reading `derivedFrom`. Ids were `<suffix>-<Date.now()>`,
 * which made every mapper a function of the clock. A response with no id falls
 * back to that, here and nowhere else.
 */
export function derivedId(response: QuestionnaireResponseResource, suffix: string): string {
  return response.id ? `${response.id}-${suffix}` : `${suffix}-${Date.now()}`
}

