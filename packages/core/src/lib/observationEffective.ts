/**
 * `Observation.effectiveDateTime`, or the start of an `effectivePeriod`, when
 * the resource has either.
 *
 * Was three private helpers — `effectiveOf` in cdsHooks/problemListCard.ts and
 * lethalMeans.ts, `observationEffective` in measures.ts — two of them reading
 * the period start and one not, which is the kind of difference nobody meant
 * (C3 of the 2026-09-20 audit).
 */
import type { ObservationResource } from '../types/fhir'

export function observationEffective(o: ObservationResource): string | undefined {
  const r = o as { effectiveDateTime?: string; effectivePeriod?: { start?: string } }
  return r.effectiveDateTime ?? r.effectivePeriod?.start
}
