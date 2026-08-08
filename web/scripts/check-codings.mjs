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
 * for object literals carrying an external system (LOINC, SNOMED CT, or any HL7
 * terminology.hl7.org CodeSystem), then asks a terminology server to confirm each
 * `code` exists and — where a `display` is written — that the display is one the
 * code actually allows.
 *
 * Known blind spot, stated so it is not mistaken for coverage: a `display` built
 * from a template literal cannot be read statically, so it is checked as
 * code-only. That is why the #236 fix moved those phrases to
 * `CodeableConcept.text` and left a fixed, checkable `display` behind, rather
 * than trying to teach this scanner to evaluate TypeScript.
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

/**
 * Which systems count as "external" — i.e. published by someone other than SPiER,
 * so the display is theirs to decide and ours to copy exactly.
 *
 * `http://terminology.hl7.org/CodeSystem/…` is matched as a family rather than
 * listed code system by code system. HL7's THO covers dozens of small vocabularies
 * (v3-ObservationInterpretation, observation-category, flag-category,
 * condition-clinical, v3-ParticipationMode, …) and SPiER reaches for a new one
 * every time a stage adds a resource type. An explicit list would have to be
 * extended by hand on each of those, and the one nobody remembered to add is
 * exactly the one that would drift.
 *
 * Widened in #236. Before that this was LOINC + SNOMED only, and the whole
 * v3-ObservationInterpretation family went unchecked — which is how ~33 mapper
 * sites came to write a free-text summary ("Moderate depression (score 12/27)")
 * into `Coding.display` for code `H`, whose display HL7 publishes as "High".
 * The same defect class as #220, invisible for the same reason: no gate read it.
 */
const EXTERNAL_FAMILIES = [
  { name: 'loinc', pattern: 'http:\\/\\/loinc\\.org' },
  { name: 'snomed', pattern: 'http:\\/\\/snomed\\.info\\/sct' },
  { name: 'tho', pattern: 'http:\\/\\/terminology\\.hl7\\.org\\/CodeSystem\\/[A-Za-z0-9._-]+' },
]

const EXTERNAL_SYSTEM_RE = new RegExp(EXTERNAL_FAMILIES.map(f => f.pattern).join('|'), 'g')

const familyOf = system =>
  EXTERNAL_FAMILIES.find(f => new RegExp(`^(?:${f.pattern})$`).test(system))?.name

// Scanned trees. FHIR-Resources/ and ig/ are excluded on purpose — validate-fhir.mjs
// --tx covers those, and double-reporting would make this output harder to act on.
//
// `minCodings` is a floor per source AND per vocabulary family: if a source
// yields fewer than this, the extractor is assumed broken (or the path moved) and
// the run fails rather than reporting a pass on a scan that inspected almost
// nothing.
//
// The floor MUST NOT be a single total. A global floor was the first version of
// this guard, and testing it found the hole: deleting both TypeScript paths still
// left exactly enough codings in terminology-manifest.json to clear a total-based
// floor, so a completely dead TS scan reported success. That is the precise
// failure mode this script exists to prevent, reproduced in the guard meant to
// prevent it.
//
// #236 found the same hole one level down. Widening to THO doubled web/src from
// 50 codings to 100, so a *per-source* floor of 15 would have been cleared by
// either half alone — dropping the THO branch from EXTERNAL_FAMILIES entirely
// would still have reported a healthy 50 and a green run. Hence the family
// dimension: each vocabulary has to prove its own liveness. Floors are set well
// under the real counts at time of writing (web/src loinc 40 / snomed 11 / tho 23;
// manifest loinc 8 / snomed 10) so ordinary refactors do not trip them.
const SCAN = [
  { path: 'web/src', exts: ['.ts', '.tsx'], minCodings: { loinc: 20, snomed: 5, tho: 10 } },
  // Real zeros, verified rather than assumed. The Worker reuses the web catalog
  // instead of restating codes; its only two LOINC literals are in
  // services/cds-hooks/src/service.test.ts, where `code` is bound to a *variable*
  // rather than a string — which cannot be checked statically and so is counted
  // under "not validated" below, not here.
  //
  // A floor of 0 cannot fail, so this entry contributes no protection against a
  // broken extractor; web/src and the manifest are what provide that. It stays in
  // SCAN so that terminology added to the Worker later is covered from day one.
  { path: 'services', exts: ['.ts'], minCodings: { loinc: 0, snomed: 0, tho: 0 } },
  // The manifest is a LOINC/SNOMED inventory; it names no THO code, so that floor
  // is 0 here for the same "verified real zero" reason as `services`.
  { path: 'docs/terminology-manifest.json', exts: ['.json'], minCodings: { loinc: 4, snomed: 5, tho: 0 } },
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
const perSource = new Map() // SCAN path -> { [family]: count of codings extracted }

for (const entry of SCAN) {
  const sourceCount = Object.fromEntries(EXTERNAL_FAMILIES.map(f => [f.name, 0]))
  for (const file of walkFiles(entry)) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(root, file)
    for (const m of text.matchAll(EXTERNAL_SYSTEM_RE)) {
      const system = m[0]
      const at = m.index
      systemLiteralHits++
      const obj = enclosingObject(text, at)
      if (!obj) continue
      // The object must actually name this system — guards against a literal that
      // merely sits inside some larger unrelated object.
      if (field(obj, 'system') !== system) continue
      const code = field(obj, 'code')
      if (!code) { noCodeSites.push(`${rel} (${system}, no sibling code)`); continue }
      sourceCount[familyOf(system)]++
      const display = field(obj, 'display')
      const key = `${system}|${code}|${display ?? ''}`
      if (!found.has(key)) found.set(key, { system, code, display, files: new Set() })
      found.get(key).files.add(rel)
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
  const counts = perSource.get(entry.path)
  const parts = Object.entries(entry.minCodings)
    .map(([family, floor]) => `${family} ${counts[family] ?? 0} (floor ${floor})`)
  console.log(`scanned ${entry.path}: ${parts.join(', ')}`)
}
console.log(`found ${codings.length} distinct external coding(s) from ${systemLiteralHits} system literal(s)\n`)

// Guard 1: a source that yields almost nothing must never look like a pass. Checked
// per source AND per vocabulary family, so neither a healthy source nor a healthy
// vocabulary can mask a dead one — see the SCAN comment.
//
// The loop is driven by the declared floors in SCAN, NOT by EXTERNAL_FAMILIES.
// That distinction is the whole guard, and getting it wrong was this check's third
// silent pass: with `EXTERNAL_FAMILIES.filter(…)`, deleting the THO family deleted
// its floor along with it, so the edit the guard exists to catch made the guard
// stop looking. Reading the floors instead means an undeclared family scores 0
// against a floor that is still there, and the run fails. Adding a family to
// EXTERNAL_FAMILIES therefore also means adding its floor to every SCAN entry.
const starved = SCAN.flatMap(e =>
  Object.entries(e.minCodings)
    .filter(([family, floor]) => (perSource.get(e.path)[family] ?? 0) < floor)
    .map(([family, floor]) => ({ path: e.path, family, got: perSource.get(e.path)[family] ?? 0, want: floor })),
)
if (starved.length) {
  for (const s of starved) {
    console.error(`✗ ${s.path} yielded ${s.got} ${s.family} coding(s), expected at least ${s.want}.`)
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
