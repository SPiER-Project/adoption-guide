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
const GOLDEN_CARE_PLAN = '../scripts/fixtures/stanley-brown/careplan-expected.json'

/**
 * Both QuestionnaireResponse shapes, against ONE golden — they carry identical
 * content, so any difference between them is a defect by definition.
 *
 * ⚠️ Only the legacy shape was covered here, and that is what let #419 exist:
 * the repeating contact groups are declared `type: group, repeats: true`, so a
 * conforming filler emits `item.item`, while this fixture used `answer.item` —
 * the one shape the readers could handle. Fixture and reader agreed with each
 * other and both disagreed with the Questionnaire, so parity was green while a
 * real safety plan lost all three of its contact sections.
 */
const FIXTURE_QRS = [
  ['conformant (item.item — what SPiER\'s form emits)', '../scripts/fixtures/stanley-brown/questionnaireresponse-conformant.json'],
  ['legacy (answer.item — non-conformant, still accepted)', '../scripts/fixtures/stanley-brown/questionnaireresponse.json'],
] as const

const FIXTURE_QR = FIXTURE_QRS[0][1]

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
  for (const [label, path] of FIXTURE_QRS) {
    it(`produces the same CarePlan the declared StructureMap does — ${label}`, () => {
      const questionnaireResponse = JSON.parse(
        readFileSync(path, 'utf8'),
      ) as QuestionnaireResponseResource
      const golden = JSON.parse(readFileSync(GOLDEN_CARE_PLAN, 'utf8')) as Json

      const { resource } = generateCarePlan(questionnaireResponse)

      expect(normalizeCarePlan(resource as unknown as Json)).toEqual(sortKeys(golden))
    })
  }

  it('covers both response shapes — dropping one is how #419 happened', () => {
    expect(FIXTURE_QRS).toHaveLength(2)
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
