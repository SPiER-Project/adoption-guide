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
 * Scans TypeScript under web/src and services/
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
// dimension: each vocabulary has to prove its own liveness.
//
// A floor proves *liveness*, not completeness. It answers "did this scan still
// look at this vocabulary in this source", and nothing more — a legitimate edit
// removing codes is allowed to lower the count. So the convention is roughly
// HALF the real count, rounded down: high enough that a dead or rerouted scan
// cannot clear it, low enough that ordinary refactors do not trip it.
//
// That convention has to be re-checked when a source grows, because nothing
// re-checks it on its own. #43 doubled the manifest's SNOMED inventory from 10
// codings to 20 while its floor sat at 5, quietly dropping that floor from ~50%
// of the real count to 25% (issue #232).
//
// ─── docs/terminology-manifest.json, and why it is gone ──────
//
// #261 removed it. It was a hand-maintained JSON inventory of 20 distinct
// codings, scanned here as a third source. Every one of those 20 was verified
// to also live in `ig/` or `FHIR-Resources/` — where `validate-fhir.mjs --tx`
// checks them at RESOURCE level (binding, context, cardinality, and the
// display), which is strictly stronger than the code+display check here. So it
// was a shadow copy, not independent coverage, and a second place to forget to
// update.
//
// Losing a source does cost something, and it is worth naming: SCAN now has one
// entry with non-zero floors instead of two. But the manifest was never
// corroboration — re-read the total-floor paragraph above and note that the
// manifest is what *masked* a completely dead TypeScript scan. Its presence was
// a hazard the per-source floors had to work around, and per-source-per-family
// floors on web/src still fail loudly if the extractor breaks or the path moves.
//
// Counts at the time of writing, 2026-08-10, after #261 brought the data
// dictionary (web/src/data/catalog/dataElements.ts) inside the scan — it had
// been invisible because it spelled its system `codeSystem: 'LOINC'` rather
// than as a URL, so ~70 codings on the page an implementer is most likely to
// copy from had never been checked at all:
//
//   web/src    loinc 69 / snomed 15 / tho 25
//
// Re-checked 2026-08-12 after #230 added the C-SSRS full-form and screener item
// codes to the fallback dispatcher:
//
//   web/src    loinc 98 / snomed 19 / tho 25
//
// The LOINC floor moved 34 → 49 to stay near the ~50% convention. It is bumped
// here, in the same change that grew the source, precisely because nothing
// re-checks a floor on its own — #232 is what a floor left behind by a growing
// inventory looks like (5 against 20, i.e. a quarter, with nothing going red).
// SNOMED's 19 against 7 is the next one drifting; it is left alone here only
// because this change did not grow it (both new codes were already present).
//
// The run prints the live count next to each floor on every invocation, so the
// figures above are checkable against any recent nightly log rather than taken
// on trust.
const SCAN = [
  // snomed raised 7 -> 9 (#330): the live count had grown to 19 while the floor
  // stayed at 7, leaving 12 codings able to fall out of the scan unnoticed —
  // the #232 failure mode. LOINC was already at half (49/98) because #323 moved
  // it in step with the C-SSRS codes it added; SNOMED grew in the same window
  // without its floor following.
  { path: 'web/src', exts: ['.ts', '.tsx'], minCodings: { loinc: 49, snomed: 9, tho: 12 } },
  // ─── Deliberately OVERLAPS web/src above ───────────────────
  //
  // Two independent contributors sit inside web/src — the runtime mappers
  // (web/src/lib) and the data dictionary (this path) — and a whole-tree floor
  // cannot tell them apart. #261 proved that with a break-test: reverting the
  // dictionary to its old un-gated shape drops web/src LOINC from 69 to 41,
  // which still clears a floor of 34, so the run stayed GREEN while ~28 codings
  // silently left the scan. That is the same "one half masks the other" hole
  // #236 found when THO was added, one level further down.
  //
  // Overlapping scans are safe: `found` is keyed by system|code|display so a
  // coding seen twice collapses to one entry (gaining a second path in `files`),
  // and `perSource` is tallied per entry. The cost is one extra tree walk; the
  // benefit is that the dictionary has to prove its own liveness.
  //
  // Counts 2026-08-10: loinc 35 / snomed 3 / tho 14. Note the catalog directory
  // is not only the dictionary — the THO codings are all from
  // tool-ui-metadata.ts, and dataElements.ts contributes none. (The two
  // terminology.hl7.org literals inside `systemLabel()` are prefix tests, not
  // codings, and are correctly skipped: their enclosing block has no `system`
  // field for the extractor to match.)
  {
    path: 'web/src/data/catalog',
    exts: ['.ts', '.tsx'],
    minCodings: { loinc: 17, snomed: 1, tho: 7 },
  },
  // Real zeros, verified rather than assumed. The Worker reuses the web catalog
  // instead of restating codes; its only two LOINC literals are in
  // services/cds-hooks/src/service.test.ts, where `code` is bound to a *variable*
  // rather than a string — which cannot be checked statically and so is counted
  // under "not validated" below, not here.
  //
  // A floor of 0 cannot fail, so this entry contributes no protection against a
  // broken extractor; web/src is what provides that. It stays in SCAN so that
  // terminology added to the Worker later is covered from day one.
  { path: 'services', exts: ['.ts'], minCodings: { loinc: 0, snomed: 0, tho: 0 } },
]

// The contract between EXTERNAL_FAMILIES and SCAN, enforced rather than asked for.
//
// The starvation guard below is driven by the declared floors, which is what makes
// *deleting* a family from EXTERNAL_FAMILIES fail loudly (see the comment there).
// The opposite direction had no such protection: a family could be ADDED, scanned,
// and counted, with no SCAN entry declaring a floor for it — so nothing asserted it
// stayed alive, and the day its extraction broke the run would still be green. That
// was written down as an instruction to the next editor, in this file and in
// CLAUDE.md, which is the weakest form a load-bearing invariant can take. Checking
// both directions here costs one loop and removes the chance to forget.
const undeclared = SCAN.flatMap(e =>
  EXTERNAL_FAMILIES.filter(f => typeof e.minCodings[f.name] !== 'number')
    .map(f => `${e.path} declares no floor for the '${f.name}' family`))
if (undeclared.length) {
  for (const line of undeclared) console.error(`✗ ${line}`)
  console.error('  Every family in EXTERNAL_FAMILIES needs a floor in every SCAN entry —')
  console.error('  a real zero is declared as 0, never left out. Without one, that family')
  console.error('  is scanned with nothing asserting the scan still works.')
  process.exit(1)
}

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
      // A system matched by the union regex must anchor-match exactly one family.
      // If a future pattern breaks that (one family matching a prefix of another,
      // say), the miscount would land under the key `undefined` and every real
      // family would look starved — or worse, not. Fail on the ambiguity instead.
      const family = familyOf(system)
      if (!family) {
        console.error(`✗ ${rel}: '${system}' matched an external family pattern but no single family.`)
        console.error('  EXTERNAL_FAMILIES patterns must be mutually exclusive and individually anchorable.')
        process.exit(1)
      }
      sourceCount[family]++
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
