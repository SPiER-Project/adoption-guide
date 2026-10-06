#!/usr/bin/env node
/**
 * Anti-drift check for the SDC observationExtract contract.
 *
 * The screening Questionnaires DECLARE which items yield Observations via the
 * SDC `sdc-questionnaire-observationExtract` extension; the per-instrument
 * mappers (packages/core/src/lib/observationMappers/*) are the reference
 * IMPLEMENTATION of that contract. The two can silently drift. For EVERY
 * Questionnaire in the mapper registry, this script builds a response answering
 * every item (the way the app's own form shapes one —
 * `buildNativeQuestionnaireResponse`), RUNS the mapper on it through
 * lib/load-core.mjs, and asserts:
 *
 *   1. every item declaring observationExtract also carries a `code`
 *      (otherwise the extracted Observation would have no Observation.code);
 *   2. every declared extract code is a code the mapper actually EMITS as an
 *      Observation.code — a mapper that renamed or dropped one fails;
 *   3. every Observation the mapper emits under the code of one of that
 *      Questionnaire's items is declared — unless it is in COMPUTED, with the
 *      reason it is derived rather than extracted;
 *   4. a Questionnaire-level observationExtract counts: SDC applies it to every
 *      descendant item (an item-level `false` overrides), so it declares every
 *      coded item, and rule 2 then holds it to what the mapper emits.
 *
 * ⚠️ **Rule 2 compared against a hand list until 2026-10-06, not the mapper.**
 * `EXPECTED` mapped each Questionnaire path to "the codes its mapper emits",
 * kept in sync by hand. Changing `phq9.ts` to emit `44261-7` left both the
 * Questionnaire and EXPECTED saying `44261-6`, and the gate passed. Running the
 * mapper removes the copy; the only list left is COMPUTED, which records a
 * judgement rather than restating a value.
 *
 * ⚠️ **Rule 3 is what the old "every mapper's Questionnaire is classified" rule
 * was for.** Four mappers once emitted per-item Observations from Questionnaires
 * declaring none, and nothing opened those files. The set checked here is the
 * registry itself, so a fifteenth mapper is run the day it is registered, and a
 * literal per-item Observation from an undeclaring Questionnaire is rule 3's
 * failure — it no longer depends on someone having listed the file.
 *
 * ⚠️ **Rule 4 is the shape the item-only walk could not see.** A root-level
 * `observationExtract: true` on the C-SSRS full form (whose mapper emits only a
 * computed tier) was green, while `$extract` would have produced an Observation
 * for every one of its coded items.
 *
 * What it still cannot see: whether a declared extraction is the RIGHT one —
 * `camsSectionA`'s seventh Observation re-codes the `6-score` answer under LOINC
 * 93374-7 and is deliberately undeclared, because `$extract` yields ONE
 * Observation per item; that is a judgement, and it is not an item code, so
 * rule 3 does not reach it. And an item the synthetic response cannot answer (a
 * type `buildNativeQuestionnaireResponse` does not build) is not exercised —
 * which rule 2 reports as declared-but-not-emitted rather than skipping.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { loadCore } from './lib/load-core.mjs'
import { reportFloors } from './lib/floors.mjs'
import { endorseAll, respond } from './lib/mapper-probes.mjs'

const EXTRACT_URL =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract'

/**
 * Observations a mapper emits under the code of one of its Questionnaire's items
 * WITHOUT that item declaring observationExtract — because the value is derived
 * from several answers or re-scored, not the answer itself. Keyed by
 * version-stripped canonical, then by code. An entry must be emitted and must
 * not be declared, or it fails as stale.
 */
const COMPUTED = {
  'http://thespierproject.org/fhir/Questionnaire/PHQ-9': {
    '44260-8': 'item 9 re-scored as its 0–3 ordinal (valueInteger) — the suicide-risk gateway, not the coded answer',
  },
  'http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool': {
    '93374-7': 'the composite disposition, derived from q1–q5 (and q5 acuity), not the result-category answer',
  },
  'http://thespierproject.org/fhir/Questionnaire/PSS-3': {
    '93374-7': 'the screen result, derived from the three screening items and the attempt recency',
  },
  'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener': {
    '93374-7': 'the risk level, computed by the published C-SSRS triage ladder over q1–q6',
  },
  'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Since-Last-Contact': {
    '93374-7': 'the risk level, computed by the published C-SSRS triage ladder over the six items',
  },
  'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Pediatric': {
    '93374-7': 'the risk level, computed by the published C-SSRS triage ladder over q1–q6',
  },
}

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

const [mappers, registry, native] = await loadCore([
  '@spier/core/lib/observationMappers',
  '@spier/core/data/questionnaires',
  '@spier/core/lib/nativeQuestionnaireResponse',
])

const mapped = Object.entries(mappers.MAPPER_BY_QUESTIONNAIRE_URL)
if (mapped.length === 0) fail('the mapper registry is empty — a registry with nothing in it is not a pass')

const extractFlag = (node) =>
  (node.extension ?? []).find((e) => e.url === EXTRACT_URL && typeof e.valueBoolean === 'boolean')?.valueBoolean

/** Every item with its EFFECTIVE observationExtract (SDC inheritance: nearest ancestor-or-self wins). */
function* itemsWithExtract(items, inherited) {
  for (const item of items ?? []) {
    const own = extractFlag(item)
    const effective = own ?? inherited
    yield { item, extract: effective === true }
    yield* itemsWithExtract(item.item, effective)
  }
}

const strip = (canonical) => canonical.split('|')[0]
let declaredChecked = 0
let questionnairesRun = 0

for (const [canonical, mapper] of mapped) {
  const q = registry.QUESTIONNAIRE_BY_URL[canonical]
  if (!q) {
    fail(`observationMappers/index.ts maps "${canonical}", which QUESTIONNAIRE_BY_URL does not hold — check:catalog owns that relation; this gate needs the Questionnaire to run the mapper`)
    continue
  }
  const label = canonical.split('/').pop()
  const rootExtract = extractFlag(q)

  // Rules 1 + 4 — what the Questionnaire declares, with SDC inheritance.
  const declared = new Map() // code -> linkId
  const itemCode = new Map() // every item's first code -> linkId
  for (const { item, extract } of itemsWithExtract(q.item, rootExtract)) {
    const code = item.code?.[0]?.code
    if (code) itemCode.set(code, item.linkId)
    if (!extract) continue
    if (item.type === 'group' || item.type === 'display') {
      // Inherited onto a container: not an extraction of its own.
      if (extractFlag(item) === true) fail(`${label}: ${item.type} item "${item.linkId}" declares observationExtract — only an answered item can be extracted`)
      continue
    }
    if (!code) {
      if (extractFlag(item) === true) fail(`${label}: item "${item.linkId}" declares observationExtract but has no code`)
      else fail(`${label}: item "${item.linkId}" inherits observationExtract from the Questionnaire root but has no code — an extracted Observation would have no Observation.code`)
      continue
    }
    declared.set(code, item.linkId)
  }

  // Run the mapper on a response that answers everything.
  let result
  try {
    // Every item endorsed (lib/mapper-probes.mjs), so a mapper that emits an
    // item's Observation only on a positive answer still emits it.
    result = mapper(respond(native, q, endorseAll(q, native)))
  } catch (e) {
    fail(`${label}: could not build or map a fully-answered response — ${e.message}`)
    continue
  }
  questionnairesRun++
  const emitted = new Set(
    (result?.observations ?? []).flatMap((o) => (o.code?.coding ?? []).map((c) => c.code)).filter(Boolean),
  )
  const computed = COMPUTED[strip(canonical)] ?? {}

  // Rule 2 — declared ⊆ emitted.
  for (const [code, linkId] of declared) {
    declaredChecked++
    if (!emitted.has(code)) {
      fail(`${label}: item "${linkId}" declares observationExtract with code ${code}, but the mapper emits no Observation with that code (emits: ${[...emitted].join(', ') || 'none'})` +
        (rootExtract === true ? ' — the Questionnaire-level observationExtract declares every coded item' : ''))
    }
    if (code in computed) fail(`${label}: COMPUTED lists ${code}, but item "${linkId}" declares it extracted — it cannot be both`)
  }

  // Rule 3 — an emitted Observation under an item's code is declared, or COMPUTED.
  for (const code of emitted) {
    if (!itemCode.has(code) || declared.has(code) || code in computed) continue
    fail(`${label}: the mapper emits an Observation coded ${code}, item "${itemCode.get(code)}"'s code, which does not declare observationExtract. If the Observation's value IS that answer, declare it; if it is derived, add it to COMPUTED with the reason.`)
  }
  for (const code of Object.keys(computed)) {
    if (!emitted.has(code)) fail(`${label}: COMPUTED lists ${code}, which the mapper no longer emits — delete the entry`)
  }

  console.log(`✓ ${label}: ${declared.size} declared extract(s) emitted; ${emitted.size} emitted code(s) accounted for`)
}

for (const canonical of Object.keys(COMPUTED)) {
  if (!mappers.MAPPER_BY_QUESTIONNAIRE_URL[canonical]) fail(`COMPUTED names ${canonical}, which no mapper serves — delete the entry`)
}

reportFloors([
  { source: 'observationMappers registry', dimension: 'Questionnaire(s) run', actual: questionnairesRun, floor: 7 },
  { source: 'observationMappers registry', dimension: 'declared extract(s) checked', actual: declaredChecked, floor: 24 },
], fail)

if (failures) {
  console.error(`\nobservationExtract drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nobservationExtract drift check passed.')
