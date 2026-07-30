#!/usr/bin/env node
/**
 * Anti-drift check for the STAGE-8 MEASURE LAYER.
 *
 * The measures exist in two places that must agree:
 *
 *   - generated FHIR (web/src/data/fhir/Measure-*.json, from FSH in
 *     ig/input/fsh/measure-and-share.fsh) — the published definitions
 *   - web/src/lib/measures.ts — the executable reference implementation
 *
 * The engine already reads the measure WIRING from the generated JSON, so
 * groups and populations cannot drift. What can drift is the CRITERIA: a
 * `criteria.expression` in FSH names a definition, and the engine has to have a
 * function under exactly that name. A mismatch is a runtime throw on a page
 * nobody may visit in review, so it is worth a build gate.
 *
 * This matters more than usual here because NOTHING COMPILES THE CQL. The CQL
 * at ig/drafts/SPiERSuicideSaferCareMeasures.cql is documentation; measures.ts
 * is the only tested implementation. This check is what keeps the published
 * Measures and that implementation honest about each other.
 *
 * Asserts:
 *
 *   A. every `criteria.expression` referenced by any Measure has an
 *      implementation in the CRITERIA map in measures.ts
 *   B. no orphan implementations — every CRITERIA key is referenced by some
 *      Measure (an unreferenced criterion is dead code or a rename that only
 *      landed on one side)
 *   C. every Measure group carries a code from the SPiER measure-group
 *      CodeSystem, since that code is how a MeasureReport group is matched back
 *      to its definition (the IG Publisher errors without it)
 *   D. every group defines at least a denominator and a numerator, and every
 *      population code is a real measure-population code
 *   E. every group code is declared in the spier-measure-group CodeSystem
 *
 * Requires `npm run copy-fhir` to have run (reads web/src/data/fhir/).
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const fhirDir = join(webRoot, 'src/data/fhir')
const enginePath = join(webRoot, 'src/lib/measures.ts')

const MEASURE_POPULATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/measure-population'
const GROUP_CODE_SYSTEM = 'http://spier.org/CodeSystem/spier-measure-group'
const VALID_POPULATIONS = new Set([
  'initial-population',
  'numerator',
  'numerator-exclusion',
  'denominator',
  'denominator-exclusion',
  'denominator-exception',
  'measure-population',
  'measure-population-exclusion',
  'measure-observation',
])

let failures = 0
function fail(msg) {
  console.error(`✗ ${msg}`)
  failures++
}

// ─── Load the generated Measures ─────────────────────────────

let entries
try {
  entries = readdirSync(fhirDir)
} catch {
  console.error(
    `[check:measures] ${fhirDir} not found — run \`npm run copy-fhir\` first.`,
  )
  process.exit(1)
}

const measures = []
for (const name of entries) {
  if (!name.startsWith('Measure-') || !name.endsWith('.json')) continue
  const doc = JSON.parse(readFileSync(join(fhirDir, name), 'utf8'))
  if (doc.resourceType === 'Measure') measures.push(doc)
}

if (measures.length === 0) {
  console.error('[check:measures] no Measure resources found — did the FSH compile?')
  process.exit(1)
}

// ─── Load the group-code CodeSystem ──────────────────────────

const groupCodes = new Set()
for (const name of entries) {
  if (!name.endsWith('.json') || !name.startsWith('CodeSystem-')) continue
  const doc = JSON.parse(readFileSync(join(fhirDir, name), 'utf8'))
  if (doc.url !== GROUP_CODE_SYSTEM) continue
  for (const c of doc.concept ?? []) groupCodes.add(c.code)
}
if (groupCodes.size === 0) {
  fail(`no CodeSystem found for ${GROUP_CODE_SYSTEM} — group codes cannot be validated`)
}

// ─── Collect referenced criteria + validate group/population shape ───

const referenced = new Set()
let groupCount = 0

for (const m of measures) {
  for (const g of m.group ?? []) {
    groupCount++
    const label = `${m.id}/${g.id ?? 'unnamed-group'}`

    // C + E: the group code is the report ↔ measure join key.
    const coding = (g.code?.coding ?? []).find(c => c.system === GROUP_CODE_SYSTEM)
    if (!coding?.code) {
      fail(
        `${label}: no group code from ${GROUP_CODE_SYSTEM}. A MeasureReport group is matched to its Measure group by code, so without one the report cannot be validated.`,
      )
    } else if (groupCodes.size && !groupCodes.has(coding.code)) {
      fail(`${label}: group code "${coding.code}" is not declared in the spier-measure-group CodeSystem`)
    }

    const populations = new Set()
    for (const p of g.population ?? []) {
      const code = (p.code?.coding ?? []).find(c => c.system === MEASURE_POPULATION_SYSTEM)?.code
      if (!code) {
        fail(`${label}: a population has no code from ${MEASURE_POPULATION_SYSTEM}`)
        continue
      }
      if (!VALID_POPULATIONS.has(code)) {
        fail(`${label}: "${code}" is not a valid measure-population code`)
      }
      populations.add(code)

      const expr = p.criteria?.expression
      if (!expr) {
        fail(`${label}/${code}: population has no criteria.expression`)
        continue
      }
      referenced.add(expr)
    }

    // D: a proportion measure without both is not computable.
    for (const required of ['denominator', 'numerator']) {
      if (!populations.has(required)) {
        fail(`${label}: missing a ${required} population`)
      }
    }
  }
}

// ─── Extract implemented criteria from the engine ────────────
// Parsing the source rather than importing it: measures.ts uses Vite's
// import.meta.glob, which plain node cannot resolve.

const engineSrc = readFileSync(enginePath, 'utf8')
const criteriaBlockStart = engineSrc.indexOf('const CRITERIA: Record<string, (ctx: Ctx) => boolean> = {')
if (criteriaBlockStart === -1) {
  console.error(
    '[check:measures] could not locate the CRITERIA map in measures.ts. If it was renamed or retyped, update this script — do not delete the check.',
  )
  process.exit(1)
}
// The map ends at the first line that closes it at column 0.
const afterStart = engineSrc.slice(criteriaBlockStart)
const blockEnd = afterStart.indexOf('\n}\n')
const criteriaBlock = afterStart.slice(0, blockEnd === -1 ? undefined : blockEnd)

const implemented = new Set()
for (const match of criteriaBlock.matchAll(/^\s{2}'([^']+)':/gm)) {
  implemented.add(match[1])
}

if (implemented.size === 0) {
  console.error('[check:measures] parsed zero criteria out of measures.ts — the parser is broken, not the code.')
  process.exit(1)
}

// ─── A: every referenced criterion is implemented ────────────

for (const expr of [...referenced].sort()) {
  if (!implemented.has(expr)) {
    fail(
      `criterion "${expr}" is referenced by a Measure but has no implementation in measures.ts (the engine throws at evaluation time)`,
    )
  }
}

// ─── B: no orphan implementations ────────────────────────────

for (const expr of [...implemented].sort()) {
  if (!referenced.has(expr)) {
    fail(
      `criterion "${expr}" is implemented in measures.ts but no Measure references it — dead code, or a rename that only landed on one side`,
    )
  }
}

console.log(
  `✓ measures: ${measures.length} Measure(s), ${groupCount} group(s), ${referenced.size} criterion reference(s) matched against ${implemented.size} implementation(s)`,
)

if (failures) {
  console.error(`\nmeasure drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nmeasure drift check passed.')
