#!/usr/bin/env node
/**
 * check:ucum — the UCUM shim is still safe to ship.
 *
 * vite.config.ts aliases `@lhncbc/ucum-lhc` to a shim (shims/ucum-lhc.ts),
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
 * or `valueQuantity` inside one, a `toQuantity()` in a FHIRPath expression —
 * on an item, in a ROOT `sdc-questionnaire-variable`, or in a
 * `questionnaire-constraint` sub-extension —
 * deleting the alias while keeping the shim, and removing a method from the shim.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasedModules } from './lib/vite-alias.mjs'
import { REPO_ROOT } from './lib/app-roots.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUESTIONNAIRE_DIR = join(REPO, 'ig/input/resources/questionnaires')
const VITE_CONFIG = join(REPO, 'vite.config.ts')
const SHIM = join(REPO_ROOT, 'shims/ucum-lhc.ts')
const PACKAGE = '@lhncbc/ucum-lhc'

const errors = []
const fail = msg => errors.push(msg)

// ── RULE 1 — alias and shim travel together ───────────────────────────────────

const viteConfig = readFileSync(VITE_CONFIG, 'utf8')
// Via the shared reader rather than a regex here: this gate's own first version
// matched only the object form, so moving vite.config.ts to the array form would
// have reported "not stubbed" and skipped every check below.
const aliased = aliasedModules(viteConfig).has(PACKAGE)
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
// Scoped to ig/input/resources/questionnaires, because that is what the renderer is handed
// (packages/core/src/data/questionnaires.ts imports these JSON files, and
// `check:catalog` holds it to every one of them). Quantities elsewhere in the repo
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
  }

  // ⚠️ EVERY expression in the resource, not `item.extension[].valueExpression`.
  // That narrower walk was this rule until 2026-10-06, and it passed a root-level
  // `sdc-questionnaire-variable` carrying `toQuantity('mg')`, and an item's
  // `questionnaire-constraint`, whose FHIRPath is a `valueString` inside an
  // `expression` SUB-extension — both of which reach fhirpath at render time.
  for (const { expr, where } of expressionsIn(resource)) {
    expressionsChecked++
    if (QUANTITY_FHIRPATH.test(expr)) {
      fail(`${rel}: ${where} is a FHIRPath expression over quantities: \`${expr}\``)
    }
  }
}

/**
 * Every expression string anywhere in a resource: an `Expression` datatype's
 * `expression` at any depth (root variables, item calculated / enableWhen /
 * answer expressions, nested toggle expressions), and an `expression`
 * sub-extension's `valueString` (questionnaire-constraint).
 */
function* expressionsIn(node, trail = 'Questionnaire') {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* expressionsIn(node[i], `${trail}[${i}]`)
    return
  }
  if (!node || typeof node !== 'object') return
  if (typeof node.expression === 'string') yield { expr: node.expression, where: trail }
  if (node.url === 'expression' && typeof node.valueString === 'string') {
    yield { expr: node.valueString, where: `${trail} (expression sub-extension)` }
  }
  const here = typeof node.linkId === 'string' ? `${trail}<${node.linkId}>` : trail
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') yield* expressionsIn(value, `${here}.${key}`)
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
    dir: join(REPO, 'node_modules/fhirpath/src'),
    pattern: /ucumUtils\.([A-Za-z_]\w*)\s*\(/g,
    floor: 3, // convertUnitTo, convertToBaseUnits, getSpecifiedUnit as of 4.8.5
  },
  {
    label: '@formbox/renderer',
    dir: join(REPO, 'node_modules/@formbox/renderer/dist'),
    // The published bundle is minified, so the instance is a one-letter name:
    // match the call shape rather than the receiver, and intersect with the
    // methods UcumLhcUtils actually has (below).
    pattern: /\w+\(\)\.([A-Za-z_]\w*)\(/g,
    floor: 1, // convertUnitTo
  },
]

// The real library's surface, so the renderer's minified sweep above cannot
// mistake an unrelated `foo().bar()` for a UCUM call. READ from the installed
// ucum-lhc's own `UcumLhcUtils` class — the alias swaps it out of the bundle, but
// fhirpath still installs it. ⚠️ This was a hand list until 2026-10-06, and it had
// drifted: it named two methods the class does not have (`getSynonyms`,
// `convertToBaseUnitsFrom`) and lacked three it does (`detectConversionType`,
// `useHTMLInMessages`, `useBraceMsgForEachString`) — a renderer upgrade calling
// any of those would have been filtered out of the sweep as "not UCUM".
const UCUM_SOURCE = join(REPO, 'node_modules/@lhncbc/ucum-lhc/source/ucumLhcUtils.js')
const UCUM_METHODS = new Set()
if (!existsSync(UCUM_SOURCE)) {
  fail(`${UCUM_SOURCE.replace(REPO + '/', '')} is not installed — RULE 3 reads the real method list from it; run npm ci`)
} else {
  const ucumSrc = readFileSync(UCUM_SOURCE, 'utf8')
  const body = /export class UcumLhcUtils\s*\{([\s\S]*?)\n\}/.exec(ucumSrc)?.[1] ?? ''
  for (const m of body.matchAll(/^ {2}([A-Za-z]\w*)\s*\(/gm)) {
    if (m[1] !== 'constructor') UCUM_METHODS.add(m[1])
  }
  // convertUnitTo, convertToBaseUnits, getSpecifiedUnit, validateUnitString,
  // commensurablesList, checkSynonyms, detectConversionType, and two message
  // toggles as of 7.1.6 — half of nine, rounded down.
  if (UCUM_METHODS.size < 4 || !UCUM_METHODS.has('convertUnitTo')) {
    fail(
      `read ${UCUM_METHODS.size} method(s) off UcumLhcUtils in ${UCUM_SOURCE.replace(REPO + '/', '')} — ` +
        'the class parse has stopped matching, so the consumer sweep below would filter out every call. ' +
        'Fix the parse; do not fall back to a hand list.',
    )
  }
}

for (const { label, dir, pattern, floor } of CONSUMERS) {
  if (!existsSync(dir)) {
    fail(`${label} is not installed (${dir.replace(REPO + '/', '')}) — run npm ci; this check cannot verify the shim without it`)
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
      fail(`${label} calls UcumLhcUtils.${method}(), which the shim does not implement — add it to shims/ucum-lhc.ts`)
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
    console.error('\n  See shims/ucum-lhc.ts for what the shim is and why.\n')
    process.exit(1)
  }
  console.log(
    `✓ ucum: shim active, ${questionnaires.length} Questionnaires / ${itemsChecked} items / ` +
      `${expressionsChecked} expression(s) free of quantities`,
  )
}
