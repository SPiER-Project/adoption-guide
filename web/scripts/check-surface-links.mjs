#!/usr/bin/env node
/**
 * Every in-app link a CLINICIAN can reach must resolve on the clinical surface.
 *
 * ── The defect this was written from ──────────────────────────────────────
 *
 * `PatientPathway` — the chart's pathway rail, the clinician's primary screen —
 * rendered `<Link to="/guide/cds-service">also served over the wire</Link>`,
 * ungated. `/guide/*` is registered inside `{IS_DEMO && (…)}`, so on the
 * clinical surface that route does not exist and the link falls to the `*`
 * catch-all, which is `<Navigate to="/" replace/>` → `/patient/record`.
 *
 * ⚠️ **It does not 404. It bounces the clinician back to the chart they were
 * already on, with no error.** Silent and plausible, which is the failure mode
 * this repo's gates exist to catch — and it shipped with the surface axis and
 * survived three days of work on top of it.
 *
 * ── Why no existing gate saw it ───────────────────────────────────────────
 *
 * `check:surface` reads the two BUNDLES and asserts that demo-only pages and
 * the 14 demo patients are absent from the clinical one. It is about what is
 * COMPILED IN, and the link is not: `PatientPathway` legitimately ships on both
 * surfaces. `check:catalog` resolves the catalog's 36 launch paths, the SMART
 * landing route and every `<Navigate>` target — but against the WHOLE route
 * table, which contains `/guide/cds-service`, so the link resolves and always
 * would have. CLAUDE.md names this exact hole: *"a path that resolves but now
 * lands on the explainer rather than the app — that class needs a grep."*
 * This is that grep, made total.
 *
 * ── What it checks ────────────────────────────────────────────────────────
 *
 * RULE 1  Every literal `to="…"` / `navigate('…')` in a module reachable from
 *         App.tsx on the clinical surface resolves against the clinical routes.
 * RULE 2  Every `<Navigate>` registered on the clinical surface points at a
 *         path that resolves there — a redirect that strands a clinician is the
 *         same defect one level up.
 *
 * ── What it cannot see ────────────────────────────────────────────────────
 *
 * ⚠️ **A computed target.** `navigate(somePath)` and `` to={`/patient/${id}`} ``
 * carry no literal to check. `ToolDetail` builds `/guide/tools/${slug}/try` that
 * way and is invisible here — it is safe only because its one caller is a guide
 * page, which is an argument recorded in CLAUDE.md rather than a fact this gate
 * establishes. A literal is the common case and the one that regressed.
 *
 * ⚠️ **A relative target** (`to="caseload"`) resolves against the rendering
 * route, which is not knowable from the file. Skipped deliberately, and counted
 * so the summary says how many.
 *
 * ⚠️ **`href` is not scanned, deliberately.** An `href` in this app is either an
 * external URL (`PROJECT_LINKS`, the mock EHR) or a path the WORKER serves and
 * the router never sees — `IG.href` is `${BASE_URL}ig/`, four thousand files of
 * rendered IG. Resolving those against the route table would report the
 * Implementation Guide as a broken link on both surfaces.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { readSurfaceRoutes, routeResolves } from './lib/route-table.mjs'
import { stripComments } from '../../scripts/lib/jsx-comments.mjs'
import { appRoot, appRootFloors, REPO_ROOT } from './lib/app-roots.mjs'
import { resolveImport, spierPackageRoots } from './lib/module-graph.mjs'
import { reportFloors } from '../../scripts/lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(here, '..')
const SRC = appRoot('web/src')
const APP = join(SRC, 'App.tsx')

let failures = 0
function fail(msg) {
  console.error(`✗ ${msg}`)
  failures++
}

const { clinical, demoOnly, redirects, redirectTargets } = readSurfaceRoutes()

// ── Which modules the clinical bundle actually reaches ──────────────────────
//
// Walked from App.tsx rather than from the clinical routes' components, because
// the shell is a LAYOUT route (`<Route element={<Shell/>}>`) with no `path` —
// starting from paths would miss `Shell`, `AppShell` and `Sidebar`, and the
// sidebar is the single most likely place for a guide link to sit.
//
// The 10 demo-only pages are skipped the way the bundler skips them: their
// declaration is `IS_DEMO ? lazy(() => import(…)) : NotOnThisSurface`, so with
// `IS_DEMO` folded to false the import is unreachable and the chunk is not
// emitted — which is the property `check:surface` asserts from the bundle.
const appSrc = stripComments(readFileSync(APP, 'utf8'))
const demoOnlySpecs = new Set(
  [...appSrc.matchAll(/const\s+\w+\s*=\s*IS_DEMO\s*\?\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1]),
)
if (demoOnlySpecs.size === 0) {
  fail(
    'App.tsx: no `IS_DEMO ? lazy(() => import(…))` declarations parsed. Every demo-only page ' +
      'would then be walked as clinical and this gate would report links that a clinician ' +
      'cannot reach — fix the reader, not the callers.',
  )
}

// ⚠️ Resolves `@spier/<pkg>/…` too — a relative-only resolver stopped this walk
// at packages/tool-views and the reach fell from 89 modules to 61 with the gate
// still green. See lib/module-graph.mjs.
const PACKAGE_ROOTS = spierPackageRoots(REPO_ROOT)
const resolveSpec = (spec, fromFile) => resolveImport(spec, fromFile, REPO_ROOT, PACKAGE_ROOTS)

/** Blank `{IS_DEMO && (…)}` bodies: that JSX is not in the clinical bundle. */
function blankDemoBlocks(src) {
  const out = src.split('')
  // `{!IS_DEMO && (` is deliberately NOT matched — that block is clinical-only,
  // and its links are exactly the ones that most need resolving.
  const re = /\{\s*IS_DEMO\s*&&\s*\(/g
  let m
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('(', m.index)
    let depth = 0
    let quote = null
    for (let i = open; i < src.length; i++) {
      const ch = src[i]
      if (quote) {
        if (ch === '\\') i++
        else if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          for (let k = open; k <= i; k++) if (out[k] !== '\n') out[k] = ' '
          break
        }
      }
    }
  }
  return out.join('')
}

/**
 * The ROUTE part of a navigation target — everything before `#` or `?`.
 *
 * ⚠️ Not cosmetic: the first run of this gate reported five false positives,
 * all of the form `/patient/record#activity`. A deep link into a section of the
 * chart is one of this app's normal navigations (`useScrollToHash`), and the
 * fragment is read by the browser, never by the router. A query is the same —
 * `?new=1` is a signal `PatientBanner` sends to a route that exists. Comparing
 * the whole string against the route table makes every deep link look broken,
 * which is the kind of noise that gets a gate switched off in a week.
 */
function routePart(target) {
  return target.split(/[#?]/)[0] || '/'
}

const seen = new Map() // file → trail
const stack = [[APP, ['App.tsx']]]
while (stack.length) {
  const [file, trail] = stack.pop()
  if (seen.has(file)) continue
  seen.set(file, trail)
  const src = stripComments(readFileSync(file, 'utf8'))
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    if (file === APP && demoOnlySpecs.has(spec)) continue
    const next = resolveSpec(spec, file)
    if (next && !next.includes('.test.')) stack.push([next, [...trail, relative(SRC, next)]])
  }
}

// ── RULE 1 ──────────────────────────────────────────────────────────────────
let checked = 0
let relativeSkipped = 0
for (const [file, trail] of seen) {
  if (file === APP) continue // RULE 2 owns the route table itself
  const src = blankDemoBlocks(stripComments(readFileSync(file, 'utf8')))
  const targets = [
    ...[...src.matchAll(/\bto=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bnavigate\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    // ⚠️ **The object-property form, and leaving it out made this gate miss the
    // four links that matter most.** `Sidebar` builds the CLINICAL nav —
    // Patient record, Caseload, Measures, Settings — as an array of
    // `{ to: '/…', label }` mapped into `<NavLink to={item.to}>`, so no `to="…"`
    // attribute exists to match. The first green run of this gate checked 19
    // targets and not one of them was the clinical sidebar.
    ...[...src.matchAll(/\bto:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
  ]
  for (const t of targets) {
    if (!t.startsWith('/')) { relativeSkipped++; continue }
    checked++
    const path = routePart(t)
    if (routeResolves(path, clinical)) continue
    const why = routeResolves(path, demoOnly)
      ? `"${t}" is registered inside an \`{IS_DEMO && (…)}\` block, so the clinical build does ` +
        'not register it at all'
      : `"${t}" resolves to no route on either surface`
    fail(
      `${relative(WEB, file)} navigates to a path a clinician cannot reach: ${why}.\n` +
        `    reached from ${trail.join(' → ')}\n` +
        '    A missing route falls to the `*` catch-all, which redirects to `/` — so this does ' +
        'not 404, it silently returns the clinician to the patient record.\n' +
        '    Gate the link on IS_DEMO, or point it at a route the clinical surface registers.',
    )
  }
}

if (checked === 0) {
  fail(
    'no absolute navigation targets were read from any clinical module, so RULE 1 verified ' +
      'nothing. The link scanner has stopped matching `to="…"` / `navigate(\'…\')`.',
  )
}

// ── RULE 2 ──────────────────────────────────────────────────────────────────
let redirectsChecked = 0
for (const from of redirects) {
  if (!clinical.has(from)) continue // a demo-only redirect is unreachable there
  const to = redirectTargets.get(from)
  if (to === undefined || !to.startsWith('/')) continue
  redirectsChecked++
  if (routeResolves(routePart(to), clinical)) continue
  fail(
    `App.tsx: the redirect at "${from}" is registered on the clinical surface but sends the ` +
      `reader to "${to}", which does not resolve there — a clinician following it lands on ` +
      'the catch-all.',
  )
}
if (redirectsChecked === 0) {
  fail('no clinical redirects were read, so RULE 2 verified nothing.')
}

// ── Liveness ────────────────────────────────────────────────────────────────
//
// ⚠️ Three collapsible dimensions and no floor until now. The reach is a regex
// walk from App.tsx, the route set is parsed out of the same file, and the
// targets are literals scraped from the modules — a narrowing in any one of
// them leaves this printing a confident ✓ over a fraction of the surface. The
// `demoOnlySpecs.size === 0` and `redirectsChecked === 0` guards above cover
// the collapse-to-nothing cases; these cover the collapse-to-a-few.
reportFloors(
  [
    ...appRootFloors(),
    { source: 'clinical import graph', dimension: 'module(s) reached', actual: seen.size, floor: 105 },
    { source: 'clinical route table', dimension: 'route(s)', actual: clinical.size, floor: 20 },
    { source: 'clinical import graph', dimension: 'absolute link target(s)', actual: checked, floor: 13 },
  ],
  fail,
)

if (failures) {
  console.error(`\nsurface-links check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ surface links: ${seen.size} module(s) reachable on the clinical surface, ` +
    `${checked} absolute target(s) and ${redirectsChecked} clinical redirect(s) all resolve ` +
    `against its ${clinical.size} route(s) (${relativeSkipped} relative target(s) skipped; ` +
    `${demoOnly.size} route(s) are demo-only).`,
)
