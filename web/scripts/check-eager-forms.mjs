#!/usr/bin/env node
/**
 * The hand-authored Questionnaire JSON must not be reachable by STATIC imports
 * from an app's entry module.
 *
 * ## What this is defending
 *
 * The 18 Questionnaires under `ig/input/resources/questionnaires/` are 166.8 KB raw / ~24 KB gzip.
 * They belong in the lazy assessment chunk, which is the only place that renders
 * one. Until 2026-09-19 they were in the ENTRY chunk of both build surfaces —
 * including the clinical one an EHR frames — and every visitor paid for them
 * whether or not they ever opened a form.
 *
 * ⚠️ **Every view component was already `lazy()` when that was true.** Laziness
 * of the component is not the property that matters: `toolViews.tsx` builds its
 * 29 entries as JSX elements at module scope, and `App.tsx` imports that map
 * statically, so anything an ENTRY HOLDS is eager even when what it renders is
 * not. That is why this gate walks static imports rather than checking for
 * `lazy(`. The measurement, and the two wrong diagnoses that preceded it, are in
 * `docs/plans/tool-bundling-audit-2026-09-19.md` §5.1.
 *
 * ## Why a module walk and not a look at `dist/`
 *
 * Reading the built entry chunk would assert the property directly, but it needs
 * a build, so it could only run in the CI build job — and `check:surface` is
 * already the cautionary tale there: it asserts both `dist` directories exist,
 * not that they are fresh, so it once reported a clean surface over output from
 * a build that had just failed. This walk is offline, runs inside `verify`, and
 * fails on the import that causes the regression rather than on its consequence.
 *
 * What it therefore CANNOT see: a form pulled in by something other than a
 * static specifier — an `import.meta.glob` over `ig/input/resources/questionnaires/`, or a bundler
 * config that forces a module into the entry chunk. Neither exists today; both
 * would show up as the entry chunk growing by ~24 KB gzip with this gate green.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_ROOTS } from './lib/app-roots.mjs'
import { resolveImport, spierPackageRoots } from './lib/module-graph.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(here, '..')
const REPO_ROOT = resolve(WEB_ROOT, '..')
const FORMS_DIR = join(REPO_ROOT, 'ig/input/resources/questionnaires')
const rel = (p) => relative(REPO_ROOT, p)

let failed = false
function fail(msg) {
  console.error(`✗ ${msg}`)
  failed = true
}

/**
 * STATIC import specifiers only — `import … from 'x'`, bare `import 'x'`, and
 * `export … from 'x'`. Deliberately NOT `lib/module-graph.mjs`'s
 * `importSpecifiers`, whose pattern has an optional `\(` and so also matches
 * `import('x')`. Following a dynamic import here would report every lazily
 * loaded form as eager, which is the opposite of the question.
 */
function staticSpecifiers(src) {
  const out = []
  // ⚠️ **Line comments are stripped BEFORE block comments, and the order is not
  // cosmetic.** App.tsx's own comments say things like "the clinician's
  // /patient/* paths", and `/*` inside a line comment opens a block comment that
  // a later `*/` closes — swallowing every import in between. Stripping blocks
  // first made this gate walk 104 modules while missing the ONE static import it
  // exists to police (`@spier/tool-views/data/toolViews`), and it passed the
  // planted defect. Line comments first; then blocks.
  const code = src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  // Anchored to a line start, so a commented-out import cannot match even if the
  // stripping above misses it. A static import is always at a line start in this
  // codebase; an indented one inside a block would be a syntax error.
  for (const m of code.matchAll(/^[ \t]*import\s+[^;'"]*?from\s*['"]([^'"]+)['"]/gm)) out.push(m[1])
  for (const m of code.matchAll(/^[ \t]*import\s*['"]([^'"]+)['"]/gm)) out.push(m[1])
  for (const m of code.matchAll(/^[ \t]*export\s+[^;'"]*?from\s*['"]([^'"]+)['"]/gm)) out.push(m[1])
  return out
}

const packageRoots = spierPackageRoots(REPO_ROOT)

/** Walk static imports from `entry`, returning every module reached and its path back. */
function staticClosure(entry) {
  const parent = new Map([[entry, null]])
  const queue = [entry]
  while (queue.length) {
    const file = queue.shift()
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (file.endsWith('.json')) continue // a resource is a leaf
    for (const spec of staticSpecifiers(src)) {
      const target = resolveImport(spec, file, REPO_ROOT, packageRoots)
      if (!target || parent.has(target)) continue
      parent.set(target, file)
      queue.push(target)
    }
  }
  return parent
}

function chain(parent, file) {
  const out = []
  for (let c = file; c; c = parent.get(c)) out.unshift(rel(c))
  return out
}

// ---------------------------------------------------------------------------

const entries = []
for (const root of APP_ROOTS) {
  for (const name of ['main.tsx', 'App.tsx']) {
    const p = join(root.dir, name)
    if (existsSync(p)) entries.push({ root: root.source, file: p })
  }
}

// A "found nothing" run must not pass. APP_ROOTS is derived, so a root list that
// loses its rows would otherwise make this gate report a clean app it never
// opened — the exact silent-pass this repo keeps rediscovering.
if (entries.length === 0) {
  fail(
    'found no app entry module (src/main.tsx or src/App.tsx) under any root in ' +
      'scripts/lib/app-roots.mjs — this gate checked nothing',
  )
}

let reachedTotal = 0
for (const { root, file } of entries) {
  const parent = staticClosure(file)
  reachedTotal += parent.size
  const forms = [...parent.keys()].filter(
    (p) => p.startsWith(FORMS_DIR + '/') && p.endsWith('.json'),
  )
  for (const form of forms) {
    fail(
      `${rel(form)} is reachable by STATIC imports from ${rel(file)} — it will compile into ` +
        `the ENTRY chunk of the ${root} surface, not the lazy assessment chunk.\n` +
        `    ${chain(parent, form).join('\n      → ')}\n` +
        `    Pass the Questionnaire's canonical URL and resolve it inside a lazy component ` +
        `(see QuestionnaireView's questionnaireUrl prop), rather than importing the resource.`,
    )
  }
  console.log(
    `  scanned ${root}: ${parent.size} module(s) reachable by static import from ${rel(file)}`,
  )
}

// The walk producing almost nothing means the resolver stopped following, not
// that the app is small. Floor is roughly half the real count, per
// scripts/lib/floors.mjs rule 2.
const FLOOR = 60
if (!failed && reachedTotal < FLOOR) {
  fail(
    `only ${reachedTotal} module(s) reached across ${entries.length} entry module(s) (floor ${FLOOR}) — ` +
      'the static-import walk stopped early, so a form could be eager without this gate seeing it',
  )
}

// The forms must exist to be found; an empty ig/input/resources/questionnaires/ would make every
// assertion above vacuously true.
function countForms(dir) {
  let n = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) n += countForms(p)
    else if (p.endsWith('.json')) n += 1
  }
  return n
}
const FORM_FLOOR = 18
const formCount = existsSync(FORMS_DIR) ? countForms(FORMS_DIR) : 0
if (formCount < FORM_FLOOR) {
  fail(
    `found ${formCount} JSON file(s) under ${rel(FORMS_DIR)} (floor ${FORM_FLOOR}) — ` +
      'there is nothing for this gate to find eager, so it verified nothing',
  )
}
console.log(`  scanned ${rel(FORMS_DIR)}: ${formCount} resource JSON file(s) (floor ${FORM_FLOOR})`)

if (failed) {
  console.error('\neager-forms check FAILED.')
  process.exit(1)
}
console.log(
  `✓ eager forms: the hand-authored Questionnaire JSON is not statically reachable from ` +
    `${entries.length} app entry module(s) — it stays in the lazy assessment chunk`,
)
