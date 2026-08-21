/**
 * Types for `fhir-resource-rules.mjs`.
 *
 * Hand-written because the rules themselves are plain ESM: they are imported by
 * a Node CLI (`check-scenario-resources.mjs`, which needs no types) *and* by the
 * mock EHR Worker (TypeScript, `strict`, which does). Writing the module in TS
 * instead would put a build step between the gate and the rules it enforces —
 * and the gate has to run from a bare `node scripts/…` with nothing compiled.
 *
 * ⚠️ These declarations are a promise this file cannot keep on its own. Keep them
 * in step with the `export`s next door; a drifted signature here is a type error
 * in the Worker, which is the loud direction, but a signature that is merely
 * *looser* than reality would let the Worker pass something the rules cannot
 * read. `validate.test.ts` in the mock exercises the real module, so the
 * declarations are checked against behaviour rather than trusted.
 */

/** A parsed FHIR JSON document. Deliberately loose — these rules read data. */
export type FhirDoc = Record<string, unknown>

/**
 * The conformance resources the rules read, indexed by canonical URL, plus the
 * ValueSet expansion cache (kept on the index so it survives across resources).
 */
export interface ConformanceIndex {
  structureDefs: Map<string, FhirDoc>
  codeSystems: Map<string, FhirDoc>
  valueSets: Map<string, FhirDoc>
  patientIds: Set<string>
  expansionCache: Map<string, Set<string> | null>
}

export function buildConformanceIndex(docs: FhirDoc[]): ConformanceIndex

export interface ValidateOptions {
  /** The resourceType the caller expects; a mismatch is itself a problem. */
  expectedType: string
  /** The patient this resource must point at. */
  patientId: string
  /** Prefix for every message, e.g. `POST /fhir/Observation`. */
  where?: string
  index: ConformanceIndex
}

/**
 * Every problem with one resource, as human-readable strings. Empty means the
 * rules found nothing — NOT that the resource is fully conformant.
 */
export function validateResource(resource: unknown, options: ValidateOptions): string[]

/**
 * Throw unless the index holds the conformance resources the rules need. Call at
 * startup: with an empty index every profile-derived rule reports nothing, so
 * validation would green-light everything it never looked at.
 */
export function assertUsableIndex(index: ConformanceIndex, hint?: string): void

/**
 * FHIR R4 `date` | `dateTime`, per the published regexes (union, loosened only in
 * that a bare date is accepted wherever a dateTime is). Exported because the
 * scenario gate also validates a non-FHIR bucket whose dates are FHIR dates.
 */
export const FHIR_DATE_RE: RegExp

/** The resource types the rules know base-R4 facts for. */
export function knownResourceTypes(): string[]
