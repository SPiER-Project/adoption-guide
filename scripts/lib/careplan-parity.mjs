/**
 * The comparable shape of a Stanley-Brown safety-plan CarePlan.
 *
 * `StanleyBrownQRToCarePlan.fml` (declarative, executed by the HL7 validator)
 * and `packages/core/src/lib/carePlanMappers/stanleyBrown.ts` (executable, runs in the
 * demo app) are two implementations of one transformation. Both are compared
 * against the same golden file, `scripts/fixtures/stanley-brown/
 * careplan-expected.json`, so either one drifting turns a gate red:
 *
 *   FML side  → scripts/check-fml.mjs            (needs Java + a tx server; CI)
 *   TS side   → stanleyBrown.parity.test.ts      (offline; npm run verify)
 *
 * ⚠️ The TypeScript side re-implements `normalizeCarePlan` in
 * `web/src/lib/carePlanMappers/stanleyBrown.parity.test.ts`, because
 * `tsconfig.app.json` includes only `src/` and cannot import this module. The
 * two copies are kept honest by both being measured against the one golden
 * file — if they stop agreeing on what to strip, one side stops matching. Edit
 * them together.
 *
 * ─── What is excluded, and why ──────────────────────────────────────────────
 *
 * `id`       The runtime stamps `stanley-brown-safety-plan-<epoch ms>`, which
 *            is neither reproducible nor the map's business — resource
 *            identity is assigned by whatever server accepts the CarePlan.
 *
 * `note`     The runtime attaches a DEMO-ONLY banner saying nothing was
 *            persisted. That is a statement about SPiER's demo, not about a
 *            safety plan, so the map does not declare it.
 *
 * `subject`  A genuine divergence, not a cosmetic one. The map carries
 *            `QuestionnaireResponse.subject` through, which is what a real
 *            implementation must do. The demo app substitutes a fixed
 *            `Patient/demo-patient` reference because it deliberately holds no
 *            patient. Excluded so the guard tracks the transformation rather
 *            than the demo's privacy posture — but a partner lifting the
 *            TypeScript must fix this, and the map is the spec that says so.
 *
 * `coding.display`
 *            The validator's transform engine looks displays up from the
 *            terminology server and rewrites them (SNOMED 735324008 comes back
 *            as "Treatment escalation plan", not the map's
 *            "Treatment escalation plan (record artifact)"), and it fills in
 *            displays for the SPiER-local section codes that neither side
 *            declares. Comparing them would assert tx-server behaviour, not
 *            SPiER's. System and code are compared.
 */

/** Human-readable list for the gate's summary line. */
export const PARITY_EXCLUSIONS = ['id', 'note', 'subject', 'coding.display']

/**
 * Strip the fields listed in `PARITY_EXCLUSIONS` and return a stable-ordered
 * clone suitable for exact string comparison.
 *
 * @param {Record<string, unknown>} carePlan
 * @returns {Record<string, unknown>}
 */
export function normalizeCarePlan(carePlan) {
  const clone = structuredClone(carePlan)
  delete clone.id
  delete clone.note
  delete clone.subject
  stripDisplays(clone)
  return sortKeys(clone)
}

/** @param {unknown} node */
function stripDisplays(node) {
  if (Array.isArray(node)) {
    for (const child of node) stripDisplays(child)
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (key === 'coding' && Array.isArray(value)) {
      for (const coding of value) {
        if (coding && typeof coding === 'object') delete coding.display
      }
    }
    stripDisplays(value)
  }
}

/**
 * Recursively sort object keys. The two producers emit the same fields in
 * different orders (the validator serialises FHIR element order; the
 * TypeScript emits literal order), and neither order is meaningful.
 *
 * @param {unknown} node
 * @returns {unknown}
 */
function sortKeys(node) {
  if (Array.isArray(node)) return node.map(sortKeys)
  if (node === null || typeof node !== 'object') return node
  return Object.fromEntries(
    Object.keys(node)
      .sort()
      .map((key) => [key, sortKeys(node[key])]),
  )
}
