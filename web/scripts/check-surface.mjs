#!/usr/bin/env node
/**
 * The clinical surface is clean — asserted from the BUILD OUTPUT.
 *
 * `VITE_SURFACE=clinical` (src/lib/surface.ts) is supposed to produce a build
 * with no guide route registered and no synthetic patient compiled in
 * (docs/plans/surfaces-and-distribution.md §3). That is a property of the
 * emitted bundle, not of the source: a `IS_DEMO && …` block that the bundler
 * did not fold, or an alias that did not switch, ships the guide and fourteen
 * fake patients into a client's EHR with every source gate green. So this
 * reads `dist/` (demo) and `dist-clinical/` and compares them.
 *
 * Every marker is DERIVED from the source that defines it — the demo-only
 * page names from the guide sections' route elements (NOT from the guards
 * themselves; see below), the two
 * demo-only route roots (`/guide`, `/overview`), the patients' display names
 * from packages/demo-population — never typed here. Names, not ids: the app
 * itself spells `patient-001` in a localStorage migration and `patient-011`
 * as the demo default, so an id proves nothing about scenario data, while
 * "Jane Doe" appears nowhere but the fixtures. And the guide's section
 * segments (`pathway`, `tools`) are route segments under /patient too, so
 * the root literals are the markers, and the page chunks cover the sections. And every marker is checked
 * BOTH ways: absent from the clinical bundle AND present in the demo bundle.
 * The second half is what makes the first mean anything: a marker the demo
 * build does not contain either is a marker that has stopped matching, and
 * this gate says so instead of reporting a clean clinical build over it
 * (§3 "Phase C is the part that will be got wrong").
 *
 * ⚠️ Both builds must exist. This gate never builds them itself (a build is
 * the slowest thing in CI and belongs to the build job), and it FAILS — does
 * not skip — when either directory is missing. `npm run build` and
 * `npm run build:clinical` produce them.
 *
 * Proven red on 2026-09-15 by pointing the clinical alias back at the real
 * package (14 patient ids appeared) and by removing one `IS_DEMO ?` guard
 * (the page's chunk appeared) — see the commit that added this gate.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const repoRoot = resolve(webRoot, '..')
const DEMO_DIST = join(webRoot, 'dist')
const CLINICAL_DIST = join(webRoot, 'dist-clinical')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }
const rel = (p) => relative(webRoot, p)

for (const [name, dir] of [['demo', DEMO_DIST], ['clinical', CLINICAL_DIST]]) {
  if (!existsSync(dir)) {
    console.error(`✗ no ${name} build at ${rel(dir)} — run \`npm run build\` and \`npm run build:clinical\` first. This gate reads the output; it does not produce it, and it does not pass without it.`)
    process.exit(1)
  }
}

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
const bundle = (dir) => {
  const files = walk(dir).filter((f) => /\.(js|html)$/.test(f))
  return { files, text: files.map((f) => readFileSync(f, 'utf8')).join('\n'), names: files.map((f) => relative(dir, f)) }
}
const demo = bundle(DEMO_DIST)
const clinical = bundle(CLINICAL_DIST)

// Floors: a dist with a handful of files is a broken build, not a small one.
const FLOOR_FILES = 20
if (demo.files.length < FLOOR_FILES) fail(`demo build has only ${demo.files.length} js/html file(s) (floor ${FLOOR_FILES}) — the build is broken, not clean`)
if (clinical.files.length < FLOOR_FILES / 2) fail(`clinical build has only ${clinical.files.length} js/html file(s) (floor ${FLOOR_FILES / 2}) — the build is broken, not clean`)

// ---- markers, derived ----------------------------------------------------------
const appSrc = readFileSync(join(webRoot, 'src/App.tsx'), 'utf8')

// The demo-only pages are the GUIDE's pages plus the Overview and the guide
// layout — derived from data/guideSections.ts and the route table, the way
// check:guide-boundary derives its page set. ⚠️ NOT from the `IS_DEMO ? lazy(`
// declarations: the first version of this gate did that, and a page that lost
// its guard dropped out of the list it was checked against, so the planted
// defect passed. The list must come from something the defect cannot change.
const sectionsSrc = readFileSync(join(webRoot, 'src/data/guideSections.ts'), 'utf8')
const sectionPaths = [...sectionsSrc.matchAll(/\{\s*path:\s*'([^']+)'/g)].map((m) => m[1])
if (sectionPaths.length < 5) fail(`only ${sectionPaths.length} guide section path(s) parsed from guideSections.ts (floor 5)`)
const elementFor = (path) => appSrc.match(new RegExp(`<Route path="${path}" element=\\{<(\\w+)\\s*/>\\}`))?.[1]
const demoOnlyPages = [...new Set(
  [...sectionPaths.map(elementFor), elementFor('/overview'), elementFor('/guide')].filter(Boolean),
)]
if (demoOnlyPages.length < 5) fail(`only ${demoOnlyPages.length} demo-only page element(s) resolved from the route table (floor 5) — the \`<Route path="x" element={<Comp />}>\` shape has changed; teach this gate the new one`)

// Source-level half: every one of them must be declared behind the guard.
// The bundle check below is what proves the guard folded; this is what names
// the line to fix when it did not.
for (const page of demoOnlyPages) {
  if (!new RegExp(`^const ${page} = IS_DEMO \\? lazy\\(`, 'm').test(appSrc)) {
    fail(`${page} is a demo-only page but App.tsx does not declare it \`IS_DEMO ? lazy(…) : NotOnThisSurface\` — its chunk will ship on the clinical surface`)
  }
}

// The two route roots that exist on the demo surface only, as the router sees
// them. Taken from App.tsx so a renamed root fails here rather than matching
// nothing.
const guideRoots = ['/guide', '/overview'].filter((r) => appSrc.includes(`path="${r}"`))
if (guideRoots.length !== 2) fail(`expected App.tsx to register both "/guide" and "/overview" (found ${guideRoots.join(', ') || 'neither'}) — the demo-only roots have moved; teach this gate`)

const patientsJson = JSON.parse(readFileSync(join(repoRoot, 'packages/demo-population/src/patients.json'), 'utf8'))
const patientNames = [...new Set(patientsJson.map((p) => p.displayName).filter(Boolean))]
if (patientNames.length < 10) fail(`only ${patientNames.length} demo patient name(s) parsed from patients.json (floor 10)`)

console.log(
  `surface: demo ${demo.files.length} file(s), clinical ${clinical.files.length} file(s); ` +
  `${demoOnlyPages.length} demo-only page(s), ${guideRoots.length} demo-only route root(s), ${patientNames.length} patient name(s) to check`,
)

// ---- the check: absent from clinical, present in demo -----------------------------
const bothWays = (label, present, absent) => {
  if (!present) fail(`${label}: not found in the DEMO build either — this marker has stopped matching, so a clean clinical build would prove nothing`)
  if (absent) fail(`${label}: present in the CLINICAL build`)
}
for (const page of demoOnlyPages) {
  const chunk = (b) => b.names.some((n) => new RegExp(`(^|/)${page}-[\\w-]+\\.js$`).test(n))
  bothWays(`demo-only page chunk ${page}-*.js`, chunk(demo), chunk(clinical))
}
for (const r of guideRoots) {
  const lit = (b) => b.text.includes(`"${r}"`)
  bothWays(`demo-only route root "${r}"`, lit(demo), lit(clinical))
}
for (const name of patientNames) {
  const lit = (b) => b.text.includes(`"${name}"`)
  bothWays(`demo patient "${name}"`, lit(demo), lit(clinical))
}

if (failures) {
  console.error(`\nclinical-surface check FAILED (${failures} problem(s)).`)
  process.exit(1)
}
console.log(`\nclinical-surface check passed: ${demoOnlyPages.length} pages, ${guideRoots.length} route roots and ${patientNames.length} patients are in the demo build and none is in the clinical build.`)
