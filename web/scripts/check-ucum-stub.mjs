#!/usr/bin/env node
/**
 * check:ucum — the UCUM shim is still safe to ship.
 *
 * vite.config.ts aliases `@lhncbc/ucum-lhc` to a shim (web/src/shims/ucum-lhc.ts),
 * which drops 557KB raw / 117KB gzip — 30% of the chunk every assessment route
 * loads — on the strength of one claim: nothing in SPiER ever needs a UCUM unit
 * conversion. That claim is true today and nothing in the build enforces it, so
 * this does.
 *
 * Three ways it can stop being true, one rule each:
 *
 *  RULE 1  the alias and the shim exist together, or neither does
 *  RULE 2  no Questionnaire the app renders uses quantities
 *  RULE 3  the shim still covers every UCUM method its consumers call — derived
 *          from the installed `fhirpath` and `@formbox/renderer`, not a list
 *          maintained here, so a dependency upgrade that reaches for a new UCUM
 *          method fails this gate instead of throwing on a form
 *
 * ⚠️ Plant a defect and watch it fail before trusting it. It should go red for
 * each of: a `"type": "quantity"` item in any Questionnaire, an `answerQuantity`
 * or `valueQuantity` inside one, a `toQuantity()` in a FHIRPath expression,
 * deleting the alias while keeping the shim, and removing a method from the shim.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(WEB, '..')
const QUESTIONNAIRE_DIR = join(REPO, 'FHIR-Resources')
const VITE_CONFIG = join(WEB, 'vite.config.ts')
const SHIM = join(WEB, 'src/shims/ucum-lhc.ts')
const PACKAGE = '@lhncbc/ucum-lhc'

const errors = []
const fail = msg => errors.push(msg)

// ── RULE 1 — alias and shim travel together ───────────────────────────────────

const viteConfig = readFileSync(VITE_CONFIG, 'utf8')
const aliased = new RegExp(`['"]${PACKAGE}['"]\\s*:`).test(viteConfig)
const shimExists = existsSync(SHIM)

if (!aliased && !shimExists) {
  // Legitimate end state: someone decided to ship the real library again.
  console.log(`✓ ucum: ${PACKAGE} is not stubbed — nothing to guard`)
  process.exit(0)
}
if (aliased && !shimExists) {
  fail(`vite.config.ts aliases ${PACKAGE} but ${SHIM.replace(REPO + '/', '')} does not exist`)
}
if (!aliased && shimExists) {
  fail(
    `${SHIM.replace(REPO + '/', '')} exists but vite.config.ts no longer aliases ${PACKAGE} — ` +
      'a dead shim, and the real library is being bundled again. Delete the shim, or restore the alias.',
  )
}

// Everything below tests the shimmed build, so stop if we are not in one.
if (errors.length > 0) report()

const shimSrc = readFileSync(SHIM, 'utf8')

// ── RULE 2 — no quantities in the Questionnaires the app renders ──────────────
//
// Scoped to FHIR-Resources, because that is what the renderer is handed
// (App.tsx imports these JSON files directly). Quantities elsewhere in the repo
// — Observation.valueQuantity in the population scenarios, say — never pass
// through fhirpath or the renderer, so they are none of this gate's business.

const questionnaires = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith('.json')) {
      let parsed
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        continue // not this gate's problem; validate-fhir.mjs reports malformed JSON
      }
      if (parsed?.resourceType === 'Questionnaire') questionnaires.push({ path, resource: parsed })
    }
  }
}
walk(QUESTIONNAIRE_DIR)

if (questionnaires.length === 0) {
  fail(`no Questionnaires found under ${QUESTIONNAIRE_DIR.replace(REPO + '/', '')} — nothing was checked`)
}

/** Every FHIRPath expression string anywhere in a resource, with its item path. */
function* walkItems(items, trail = []) {
  for (const item of items ?? []) {
    const here = [...trail, item.linkId ?? '(no linkId)']
    yield { item, path: here.join(' › ') }
    yield* walkItems(item.item, here)
  }
}

// UCUM literal syntax in FHIRPath is a number beside a quoted unit (`5 'mg'`),
// and the conversion functions name themselves. What this cannot see is an
// expression comparing two Quantity *values* pulled from the data — but such an
// expression needs a quantity item to read from, which RULE 2's type check
// already refuses.
const QUANTITY_FHIRPATH = /\btoQuantity\s*\(|\bconvertsToQuantity\s*\(|\d\s*'[^']+'/
let itemsChecked = 0
let expressionsChecked = 0

for (const { path, resource } of questionnaires) {
  const rel = path.replace(REPO + '/', '')
  const raw = JSON.stringify(resource)

  // Quantity-typed values anywhere in the Questionnaire: enableWhen.answerQuantity,
  // initial.valueQuantity, and the minValue/maxValue extensions.
  for (const key of ['answerQuantity', 'valueQuantity']) {
    if (raw.includes(`"${key}"`)) {
      fail(`${rel}: uses ${key} — the UCUM shim cannot compare quantities (see check:ucum)`)
    }
  }

  for (const { item, path: itemPath } of walkItems(resource.item)) {
    itemsChecked++
    if (item.type === 'quantity') {
      fail(`${rel}: item ${itemPath} is type \`quantity\` — the UCUM shim cannot convert units (see check:ucum)`)
    }
    for (const ext of item.extension ?? []) {
      const expr = ext.valueExpression?.expression
      if (typeof expr !== 'string') continue
      expressionsChecked++
      if (QUANTITY_FHIRPATH.test(expr)) {
        fail(`${rel}: item ${itemPath} has a FHIRPath expression over quantities: \`${expr}\``)
      }
    }
  }
}

// ── RULE 3 — the shim covers what its consumers actually call ─────────────────
//
// Derived, not declared. fhirpath binds the instance to `ucumUtils` and calls
// methods on it; the renderer's published bundle calls them on its own lazily
// built instance. Read both and require the shim to implement each name.

const CONSUMERS = [
  {
    label: 'fhirpath',
    dir: join(WEB, 'node_modules/fhirpath/src'),
    pattern: /ucumUtils\.([A-Za-z_]\w*)\s*\(/g,
    floor: 3, // convertUnitTo, convertToBaseUnits, getSpecifiedUnit as of 4.8.5
  },
  {
    label: '@formbox/renderer',
    dir: join(WEB, 'node_modules/@formbox/renderer/dist'),
    // The published bundle is minified, so the instance is a one-letter name:
    // match the call shape rather than the receiver, and intersect with the
    // methods UcumLhcUtils actually has (below).
    pattern: /\w+\(\)\.([A-Za-z_]\w*)\(/g,
    floor: 1, // convertUnitTo
  },
]

// The real library's surface, so the renderer's minified sweep above cannot
// mistake an unrelated `foo().bar()` for a UCUM call. Sourced from ucum-lhc's
// own UcumLhcUtils and deliberately over-inclusive: a name here that no one
// calls costs nothing, while a missed name is what RULE 3 exists to catch.
const UCUM_METHODS = new Set([
  'convertUnitTo',
  'convertToBaseUnits',
  'getSpecifiedUnit',
  'validateUnitString',
  'commensurablesList',
  'checkSynonyms',
  'convertToBaseUnitsFrom',
  'getSynonyms',
])

for (const { label, dir, pattern, floor } of CONSUMERS) {
  if (!existsSync(dir)) {
    fail(`${label} is not installed (${dir.replace(WEB + '/', '')}) — run npm ci; this check cannot verify the shim without it`)
    continue
  }
  const called = new Set()
  const files = []
  const collect = d => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) collect(p)
      else if (entry.name.endsWith('.js')) files.push(p)
    }
  }
  collect(dir)
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      if (UCUM_METHODS.has(match[1])) called.add(match[1])
    }
  }
  if (called.size < floor) {
    fail(
      `${label}: found ${called.size} UCUM method call(s), expected at least ${floor} — ` +
        'the scan pattern has probably stopped matching after an upgrade, so it is no longer ' +
        'checking anything. Fix the pattern rather than lowering the floor.',
    )
  }
  for (const method of [...called].sort()) {
    // `name(): never` or `name = ` — the shim declares plain methods today.
    if (!new RegExp(`\\b${method}\\s*[(=]`).test(shimSrc)) {
      fail(`${label} calls UcumLhcUtils.${method}(), which the shim does not implement — add it to src/shims/ucum-lhc.ts`)
    }
  }
  console.log(`  ${label}: ${[...called].sort().join(', ')}`)
}

// fhirpath calls this one statically, at import time, and it must not throw.
if (!/static\s+getInstance\s*\(/.test(shimSrc)) {
  fail('the shim has no static getInstance() — fhirpath calls it at module scope, so every form would fail to render')
}

report()

function report() {
  if (errors.length > 0) {
    console.error(`\n✗ ucum shim: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`)
    for (const e of errors) console.error(`  • ${e}`)
    console.error('\n  See web/src/shims/ucum-lhc.ts for what the shim is and why.\n')
    process.exit(1)
  }
  console.log(
    `✓ ucum: shim active, ${questionnaires.length} Questionnaires / ${itemsChecked} items / ` +
      `${expressionsChecked} expression(s) free of quantities`,
  )
}
