/**
 * Drift guard: the runtime CarePlan mapper vs the declared FHIR transformation.
 *
 * `ig/input/resources/maps/StanleyBrownQRToCarePlan.fml` declares how a
 * Stanley-Brown Safety Plan QuestionnaireResponse becomes a CarePlan, and
 * `SPiERDocumentSafetyActionsStage`'s `administer-stanley-brown` action points
 * at it via `PlanDefinition.action.transform` (issue #229). This file
 * (`generateCarePlan`) is the executable implementation the demo actually runs.
 * The FHIR must describe what the TypeScript does — same arrangement as the
 * Stage-8 measure engine under #212.
 *
 * Both sides are compared against one committed golden CarePlan:
 *
 *   TS side (here, offline, in `npm run verify`)
 *     generateCarePlan(fixture QR) === careplan-expected.json
 *
 *   FML side (`node scripts/check-fml.mjs --tx …`, needs Java + a terminology
 *   server, so it runs in `fml-validate.yml` rather than in `verify`)
 *     validator transform(fixture QR) === careplan-expected.json
 *
 * Change the transformation and you must change both, or one of these goes red.
 *
 * ⚠️ `normalizeCarePlan` below duplicates `scripts/lib/careplan-parity.mjs`.
 * `tsconfig.app.json` includes only `src/`, so this test cannot import that
 * module. That file carries the full rationale for every excluded field —
 * `id`, `note`, `subject` and `coding.display` — and the two copies must be
 * edited together.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateCarePlan } from '@spier/core/lib/carePlanMappers/stanleyBrown'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'

// Paths are relative to `web/`, which is vitest's cwd.
const FIXTURE_QR = '../scripts/fixtures/stanley-brown/questionnaireresponse.json'
const GOLDEN_CARE_PLAN = '../scripts/fixtures/stanley-brown/careplan-expected.json'

type Json = Record<string, unknown>

function stripDisplays(node: unknown): void {
  if (Array.isArray(node)) {
    for (const child of node) stripDisplays(child)
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (key === 'coding' && Array.isArray(value)) {
      for (const coding of value) {
        if (coding && typeof coding === 'object') delete (coding as Json).display
      }
    }
    stripDisplays(value)
  }
}

function sortKeys(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sortKeys)
  if (node === null || typeof node !== 'object') return node
  const source = node as Json
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map(key => [key, sortKeys(source[key])]),
  )
}

/** Mirror of `normalizeCarePlan` in scripts/lib/careplan-parity.mjs. */
function normalizeCarePlan(carePlan: Json): unknown {
  const clone = structuredClone(carePlan)
  delete clone.id
  delete clone.note
  delete clone.subject
  stripDisplays(clone)
  return sortKeys(clone)
}

describe('Stanley-Brown CarePlan parity with StanleyBrownQRToCarePlan.fml', () => {
  it('produces the same CarePlan the declared StructureMap does', () => {
    const questionnaireResponse = JSON.parse(
      readFileSync(FIXTURE_QR, 'utf8'),
    ) as QuestionnaireResponseResource
    const golden = JSON.parse(readFileSync(GOLDEN_CARE_PLAN, 'utf8')) as Json

    const { resource } = generateCarePlan(questionnaireResponse)

    expect(normalizeCarePlan(resource as unknown as Json)).toEqual(sortKeys(golden))
  })

  it('still emits the two demo-only fields the map deliberately omits', () => {
    // If either of these ever disappears, the exclusion list in
    // scripts/lib/careplan-parity.mjs is describing a difference that no longer
    // exists and should be narrowed.
    const questionnaireResponse = JSON.parse(
      readFileSync(FIXTURE_QR, 'utf8'),
    ) as QuestionnaireResponseResource
    const { resource } = generateCarePlan(questionnaireResponse)

    expect(resource.id).toMatch(/^stanley-brown-safety-plan-\d+$/)
    const note = resource.note as Array<{ text?: string }> | undefined
    expect(note?.[0]?.text).toContain('DEMO ONLY')
  })
})
