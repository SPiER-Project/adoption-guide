#!/usr/bin/env node
/**
 * Anti-drift check for external terminology written into *code* rather than into
 * a FHIR resource.
 *
 * ─── The gap this closes ─────────────────────────────────────
 *
 * SPiER validates FHIR resources three ways (see CLAUDE.md): `fsh-sushi` for FSH
 * syntax, `scripts/validate-fhir.mjs` for resource-level conformance, and the IG
 * Publisher for invariants and external terminology. None of them looks at
 * TypeScript.
 *
 * That matters because the observation and CarePlan mappers build codings from
 * hand-written literals, and those literals land in `Observation.code.coding` and
 * `CarePlan.activity.detail.code` on every generated resource at runtime. A wrong
 * `display` there is a wrong display on real output, but no gate ever saw it.
 *
 * Issue #220 is what this gap cost: seven fabricated/misused LOINC codes lived in
 * the mappers and the data-element catalog for months. Fixing it also turned up
 * three *additional* drifted displays that existed only in TypeScript and would
 * have survived any amount of resource validation — including
 * `44260-8 "Thoughts that you would be better off dead or of hurting yourself"`,
 * which drops LOINC's ", or … in some way in last 2 weeks [Reported.PHQ]".
 *
 * ─── What it does ────────────────────────────────────────────
 *
 * Scans TypeScript under web/src and services/ plus docs/terminology-manifest.json
 * for object literals carrying an external system (LOINC or SNOMED CT), then asks
 * a terminology server to confirm each `code` exists and — where a `display` is
 * written — that the display is one the code actually allows.
 *
 * It deliberately does NOT scan FHIR-Resources/ or ig/: those are resources, and
 * `node scripts/validate-fhir.mjs --tx <server>` already covers them. The nightly
 * workflow runs both.
 *
 * ─── Why it is not in `npm run verify` ───────────────────────
 *
 * It needs a terminology server, so it cannot be offline-reproducible the way the
 * other seven drift checks are. It runs nightly instead
 * (.github/workflows/terminology-nightly.yml), which is also why every failure
 * mode below exits non-zero rather than warning: a nightly check nobody watches
 * has to be loud.
 *
 * Usage:
 *   node web/scripts/check-codings.mjs                        # default server
 *   node web/scripts/check-codings.mjs --tx https://tx.fhir.org
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..') // repo root

const EXTERNAL_SYSTEMS = new Set(['http://loinc.org', 'http://snomed.info/sct'])

// Scanned trees. FHIR-Resources/ and ig/ are excluded on purpose — validate-fhir.mjs
// --tx covers those, and double-reporting would make this output harder to act on.
//
// `minCodings` is a per-source floor: if a source yields fewer than this, the
// extractor is assumed broken (or the path moved) and the run fails rather than
// reporting a pass on a scan that inspected almost nothing.
//
// The floor MUST be per-source, not a single total. A global floor was the first
// version of this guard, and testing it found the hole: deleting both TypeScript
// paths still left exactly enough codings in terminology-manifest.json to clear a
// total-based floor, so a completely dead TS scan reported success. That is the
// precise failure mode this script exists to prevent, reproduced in the guard
// meant to prevent it. Floors are set well under the real counts at time of
// writing (web/src 62 system literals, services 2, manifest 18) so ordinary
// refactors do not trip them.
const SCAN = [
  { path: 'web/src', exts: ['.ts', '.tsx'], minCodings: 15 },
  // A real zero, verified rather than assumed. The Worker reuses the web catalog
  // instead of restating codes; its only two LOINC literals are in
  // services/cds-hooks/src/service.test.ts, where `code` is bound to a *variable*
  // rather than a string — which cannot be checked statically and so is counted
  // under "not validated" below, not here.
  //
  // A floor of 0 cannot fail, so this entry contributes no protection against a
  // broken extractor; web/src and the manifest are what provide that. It stays in
  // SCAN so that terminology added to the Worker later is covered from day one.
  { path: 'services', exts: ['.ts'], minCodings: 0 },
  { path: 'docs/terminology-manifest.json', exts: ['.json'], minCodings: 5 },
]

const args = process.argv.slice(2)
const txIndex = args.indexOf('--tx')
const TX = txIndex !== -1 && args[txIndex + 1] ? args[txIndex + 1] : 'https://tx.fhir.org'

// ─── Extraction ───────────────────────────────────────────────

function walkFiles(entry) {
  const abs = join(root, entry.path)
  if (!existsSync(abs)) return []
  if (statSync(abs).isFile()) return [abs]
  const out = []
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const child = join(abs, name)
    const st = statSync(child)
    if (st.isDirectory()) out.push(...walkFiles({ path: relative(root, child), exts: entry.exts }))
    else if (entry.exts.some(e => name.endsWith(e))) out.push(child)
  }
  return out
}

/**
 * Find the object literal enclosing `index` and return its source text.
 *
 * Scanning braces rather than matching a fixed `system, code, display` field order
 * is the point: the repo writes codings several ways (mapper tables, catalog
 * entries, nested `coding: [{ … }]`), and an order-sensitive regex would silently
 * skip the variants it did not anticipate — which is exactly the failure this
 * script exists to prevent.
 */
function enclosingObject(text, index) {
  let depth = 0
  let start = -1
  for (let i = index; i >= 0; i--) {
    const ch = text[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth === 0) { start = i; break }
      depth--
    }
  }
  if (start === -1) return null
  depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

const field = (objText, name) => {
  const m = objText.match(new RegExp(`['"]?${name}['"]?\\s*:\\s*['"]([^'"]*)['"]`))
  return m ? m[1] : undefined
}

const found = new Map() // key -> {system, code, display, files:Set}
let systemLiteralHits = 0
const noCodeSites = []
const perSource = new Map() // SCAN path -> count of codings extracted

for (const entry of SCAN) {
  let sourceCount = 0
  for (const file of walkFiles(entry)) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(root, file)
    for (const system of EXTERNAL_SYSTEMS) {
      let from = 0
      for (;;) {
        const at = text.indexOf(system, from)
        if (at === -1) break
        from = at + system.length
        systemLiteralHits++
        const obj = enclosingObject(text, at)
        if (!obj) continue
        // The object must actually name this system — guards against a literal that
        // merely sits inside some larger unrelated object.
        if (field(obj, 'system') !== system) continue
        const code = field(obj, 'code')
        if (!code) { noCodeSites.push(`${rel} (${system}, no sibling code)`); continue }
        sourceCount++
        const display = field(obj, 'display')
        const key = `${system}|${code}|${display ?? ''}`
        if (!found.has(key)) found.set(key, { system, code, display, files: new Set() })
        found.get(key).files.add(rel)
      }
    }
  }
  perSource.set(entry.path, sourceCount)
}

// ─── Validation ───────────────────────────────────────────────

async function validateCode({ system, code, display }) {
  const url = new URL('/r4/CodeSystem/$validate-code', TX)
  url.searchParams.set('url', system)
  url.searchParams.set('code', code)
  if (display !== undefined) url.searchParams.set('display', display)

  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/fhir+json' } })
      const body = await res.json()
      if (body.resourceType === 'OperationOutcome') {
        // The server understood the request and is telling us it went wrong. That is
        // an infrastructure answer, not "the code is bad" — treat it as unreachable
        // so a misconfigured server can never read as a clean bill of health.
        throw new Error(body.issue?.[0]?.diagnostics ?? 'OperationOutcome from server')
      }
      const p = Object.fromEntries((body.parameter ?? []).map(x => [x.name, x.valueBoolean ?? x.valueString]))
      if (typeof p.result !== 'boolean') throw new Error('response carried no boolean `result`')
      return { ok: p.result, message: p.message, serverDisplay: p.display }
    } catch (err) {
      lastErr = err
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { unreachable: true, message: String(lastErr?.message ?? lastErr) }
}

const codings = [...found.values()].sort((a, b) =>
  a.system.localeCompare(b.system) || a.code.localeCompare(b.code) || String(a.display).localeCompare(String(b.display)))

console.log(`terminology server: ${TX}`)
for (const entry of SCAN) {
  console.log(`scanned ${entry.path}: ${perSource.get(entry.path)} coding(s) (floor ${entry.minCodings})`)
}
console.log(`found ${codings.length} distinct external coding(s) from ${systemLiteralHits} system literal(s)\n`)

// Guard 1: a source that yields almost nothing must never look like a pass. Checked
// per source so a healthy source can never mask a dead one — see the SCAN comment.
const starved = SCAN.filter(e => perSource.get(e.path) < e.minCodings)
if (starved.length) {
  for (const e of starved) {
    console.error(`✗ ${e.path} yielded ${perSource.get(e.path)} coding(s), expected at least ${e.minCodings}.`)
  }
  console.error('  The extractor is probably broken, or a scanned path moved.')
  console.error('  Refusing to report success on a scan that inspected almost nothing.')
  process.exit(1)
}

const drift = []
const unreachable = []

for (const coding of codings) {
  const r = await validateCode(coding)
  const label = `${coding.code}${coding.display === undefined ? ' (code only)' : ` "${coding.display}"`}`
  if (r.unreachable) {
    unreachable.push({ coding, ...r })
    console.error(`? ${label} — server unreachable: ${r.message}`)
  } else if (!r.ok) {
    drift.push({ coding, ...r })
    console.error(`✗ ${label}`)
    console.error(`    → ${(r.message ?? '').trim()}`)
    console.error(`    in ${[...coding.files].join(', ')}`)
  } else {
    console.log(`✓ ${label}`)
  }
  await new Promise(r => setTimeout(r, 200))
}

// Stated explicitly rather than left implicit: this is the script's known blind
// spot. A coding whose `code` comes from a variable or template cannot be checked
// without evaluating the program, so it is reported as uncovered instead of being
// quietly folded into the pass. If this number climbs, static coverage is falling.
if (noCodeSites.length) {
  console.log(`\nnote: ${noCodeSites.length} system literal(s) not statically checkable — no literal sibling \`code\``)
  console.log('      (system constants, comparisons, or a code bound to a variable):')
  for (const site of [...new Set(noCodeSites)].sort()) console.log(`        ${site}`)
}

console.log('')

// Guard 2: never let an unreachable server read as clean. Without this the check
// would pass loudest exactly when it verified least.
if (unreachable.length) {
  console.error(`✗ ${unreachable.length} coding(s) could not be checked — ${TX} unreachable or erroring.`)
  console.error('  Treated as failure: a check that verified nothing must not report success.')
  process.exit(1)
}

if (drift.length) {
  console.error(`✗ ${drift.length} coding(s) drift from ${TX}.`)
  console.error('  Fix the literal in code — do not change the expectation here.')
  process.exit(1)
}

console.log(`✓ all ${codings.length} external coding(s) match ${TX}`)
