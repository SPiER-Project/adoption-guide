/**
 * validate — the mock's opinion on an incoming write, which is deliberately
 * NOT its own opinion.
 *
 * ⚠️ **This file is a condition of the mock existing at all.** The panel plan §1
 * reverses an earlier "do not write your own mock FHIR server" decision, whose
 * argument was not about effort:
 *
 *   > a mock we write will be lenient, and leniency here attacks SPiER's
 *   > strongest claim.
 *
 * A lenient server accepts a wrong `patientRefField`, a missing required slice,
 * a `Coding.display` that does not match its CodeSystem — and the demo looks
 * *better* while proving *less*, invisibly from inside. Guardrail 1 is therefore
 * that the mock validates writes **reusing the profile checks in
 * `check-scenario-resources.mjs` rather than inventing a second, laxer opinion**,
 * and guardrail 2 is that somebody watches it reject something before it is
 * trusted (`validate.test.ts` plants six).
 *
 * So the rules are not here. They are in
 * [`packages/core/fhir-resource-rules.mjs`](../../../packages/core/fhir-resource-rules.mjs),
 * shared verbatim with that gate. This file only supplies the data the rules
 * need and turns their output into an OperationOutcome.
 *
 * ── Why a Worker can share a Node gate's rules ──────────────────────────────
 *
 * The README used to say the mock's validation would have to be *"a port of
 * check-scenario-resources.mjs, not a reuse of it (that script is Node reading
 * StructureDefinitions off a filesystem)"*. True of the script, false of the
 * rules: they need the conformance resources only as **data**, and
 * `import.meta.glob` inlines them at build time exactly as it already inlines
 * the Patients. The filesystem was the script's problem, not the rule set's.
 *
 * ── What this does NOT check ────────────────────────────────────────────────
 *
 * Base cardinalities beyond the rules' hand-listed table, invariants, extension
 * context, slicing, reference target types, and external terminology (LOINC /
 * SNOMED displays). A resource this accepts is **not** thereby conformant, and
 * an accepted write is not evidence of interoperability — §1 guardrail 3. The
 * HL7 validator and the nightly terminology gate cover those, over the artifacts
 * in the repo rather than over live traffic.
 */
import {
  assertUsableIndex,
  buildConformanceIndex,
  validateResource,
  type ConformanceIndex,
  type FhirDoc,
} from '../../../packages/core/fhir-resource-rules.mjs'

/**
 * Every generated conformance resource, inlined by Vite.
 *
 * The same glob shape `fixtures.ts` uses for the Patients, and the same failure
 * mode if `copy-fhir` has not run: nothing loads. `assertUsableIndex` below
 * turns that into a startup crash rather than a validator that accepts
 * everything.
 */
const conformanceModules = import.meta.glob<FhirDoc>(
  '../../../packages/fhir-artifacts/generated/{StructureDefinition,ValueSet,CodeSystem}-*.json',
  { eager: true, import: 'default' },
)

// The 14 Patients come from packages/demo-population, not the IG's output: step
// E2 (#392) moved them out, because nothing in the IG referenced them and a fake
// EHR's roster should not depend on a SUSHI compile. They feed the SAME index —
// `assertUsableIndex` requires both halves, and the write rules resolve `subject`
// references against its `patientIds`.
const patientModules = import.meta.glob<FhirDoc>(
  '../../../packages/demo-population/src/patients/patient-*.json',
  { eager: true, import: 'default' },
)

export const CONFORMANCE: ConformanceIndex = buildConformanceIndex([
  ...Object.values(conformanceModules),
  ...Object.values(patientModules),
])

// ⚠️ At module load, not per request. An empty index makes every profile-derived
// rule report nothing, so `POST /fhir/{Type}` would accept anything and look
// like a working server — the #232 / #261 silent-pass shape, in the one place
// this service is supposed to be strict. Failing to boot is the correct
// response, and the message names the fix.
assertUsableIndex(CONFORMANCE, 'run `npm run copy-fhir -- --force` in web/')

/** One problem, in the shape an OperationOutcome issue wants. */
export interface ValidationProblem {
  severity: 'error'
  code: 'invalid'
  diagnostics: string
}

/**
 * Validate an incoming resource for `patientId`.
 *
 * `expectedType` is the type from the request path, so a body whose
 * `resourceType` disagrees with the URL is itself a problem — the rules report
 * that, this function does not special-case it.
 */
export function validateWrite(
  resource: unknown,
  { expectedType, patientId }: { expectedType: string; patientId: string },
): ValidationProblem[] {
  const problems = validateResource(resource, {
    expectedType,
    patientId,
    where: `POST /fhir/${expectedType}`,
    index: CONFORMANCE,
  })
  return problems.map(diagnostics => ({ severity: 'error', code: 'invalid', diagnostics }))
}

/**
 * The rules require an `id` (the scenario gate needs one because
 * `localDataSource` upserts by id) — but a **create** must not carry one, and
 * `SmartDataSource.toCreatePayload` strips it deliberately, because "servers
 * reject or ignore a client-supplied `id` on create".
 *
 * ⚠️ Those two correct rules contradict each other on this path, and resolving
 * it the other way would have been silent: leaving the rule in place makes the
 * mock reject **every** well-behaved create with "no id", so the first fix that
 * comes to mind is to relax the rules — which is exactly the leniency guardrail
 * 1 forbids, and it would then also stop gating the scenarios.
 *
 * So the id is supplied here, before validation, as the id the server is about
 * to assign. That keeps one rule set, keeps the scenario gate strict, and makes
 * the mock behave like a server: it is the server's id, not the client's.
 */
export function withAssignedId<T extends { id?: string }>(resource: T, id: string): T {
  return { ...resource, id }
}
