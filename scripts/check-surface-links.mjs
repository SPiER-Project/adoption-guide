#!/usr/bin/env node
/**
 * Every in-app link on EACH surface must resolve on that surface's own route table.
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
 * ── The second defect, from the other direction (2026-09-20) ──────────────
 *
 * This gate walked ONLY the clinical app. When the apps split (2026-09-19) the
 * guide lost every `/patient/*`, `/population/*` and `/settings` route, and
 * every link into them — 33 launch buttons on Tools, 34 rows on Adoption
 * Readiness, "View in chart" after every submit, a recorder's cross-links, the
 * try page's own up-link, seven redirects — fell to the guide's catch-all and
 * landed the reader on the Overview. Same silence, same plausibility, and this
 * gate printed a confident ✓ over it because the guide was not its subject.
 * `docs/internals/surfaces-and-routing.md` had recorded the hole in one
 * sentence ("that class needs a grep"); the grep was pointed at one surface.
 * So it now walks both, from each app's own App.tsx, against each app's own
 * routes. The audit that found it: docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md §1.1.
 *
 * ── Why no other gate saw either ──────────────────────────────────────────
 *
 * `check:surface` reads the two BUNDLES and asserts that demo-only pages and
 * the 14 demo patients are absent from the clinical one. It is about what is
 * COMPILED IN, and a link is not: `PatientPathway` legitimately ships on both
 * surfaces. `check:catalog` resolves the catalog's launch paths, the SMART
 * landing route and every `<Navigate>` target — but against the UNION of both
 * apps' tables (`readAllRouteTables`), so a guide redirect into `/settings`
 * resolves there and always would have.
 *
 * ── What it checks, per surface ───────────────────────────────────────────
 *
 * RULE 1  Every literal navigation target in a module reachable from that
 *         app's App.tsx resolves against that app's routes. Five forms:
 *         `to="…"`, `navigate('…')`, the object property `to: '…'`, any
 *         object property ending in `href`/`Href` whose value is an absolute
 *         path — see the note on the fourth below — and the content modules'
 *         inline `[text](/route)` markup, see the note on the fifth.
 * RULE 2  Every `<Navigate>` registered in that app points at a path that
 *         resolves there — a redirect that strands the reader is the same
 *         defect one level up. A redirect whose destination is the OTHER app
 *         is not a `<Navigate>` at all: it is a cross-origin hop
 *         (`apps/guide/src/components/ClinicalRedirect.tsx`), which this rule
 *         does not read and the router never sees.
 *
 * ── The shared views, and why the fourth form exists ──────────────────────
 *
 * The 29 tool views in `packages/tool-views` are reached from BOTH apps, so a
 * route literal inside one is right on one surface and wrong on the other by
 * construction — no rule over the module can say which. The fix is that they
 * hold none: each app declares its routes for them in a `SurfaceLinks` object
 * (`apps/clinical/src/surfaceLinks.ts`, `apps/guide/src/data/surfaceLinks.ts`)
 * whose properties are `href: '/patient/record'`, `chartHref: '…'`,
 * `registryHref: '…'`. Those literals live in the app whose table they must
 * resolve against — which is exactly where this walk finds them, provided it
 * reads that property form. Without it the three most important literals on
 * the clinical surface would be invisible again, which is how the `to:` form
 * came to be added the first time.
 *
 * ── The content modules, and why the fifth form exists ───────────────────
 *
 * ⚠️ **The Overview's links moved out of this gate's reach once already.** The
 * front door carried them as lens cards with an `href:` property, which the
 * fourth form reads; the 2026-09-20 rewrite replaced those cards with three
 * reader "doors" whose links are written in `content/overview.ts`'s inline
 * markup — `[Care Pathway](/guide/pathway)` — inside an ordinary string. A
 * planted `/guide/pathwayy` passed this gate green. Those five links are the
 * only navigation on the page a first-time reader is offered, so they are
 * exactly the ones that must not rot.
 *
 * The form is narrow on purpose: it captures a target only when the href
 * begins with `/`, so `](ig)`, an `https://` URL and an array index followed
 * by a call all fail to match rather than being collected and filtered later.
 *
 * ── What it cannot see ────────────────────────────────────────────────────
 *
 * ⚠️ **A computed target.** `navigate(somePath)`, `` to={`/patient/${id}`} ``
 * and the guide's forty tool links (`/guide/tools/${tool.id}`, built in
 * `apps/guide/src/data/toolForms.ts`) carry no literal to check. The tool
 * route exists, `check:tool-view-routes` pins the form slugs and
 * `PatientJourney.test.tsx` asserts one link per catalogued tool — an argument
 * rather than a fact this gate establishes. A literal is the common case and
 * the one that regressed, twice.
 *
 * ⚠️ **A relative target** (`to="caseload"`) resolves against the rendering
 * route, which is not knowable from the file. Skipped deliberately, and counted
 * so the summary says how many.
 *
 * ⚠️ **`href="…"` ATTRIBUTES are not scanned, deliberately.** An `href`
 * attribute in these apps is either an external URL (`PROJECT_LINKS`, the mock
 * EHR) or a path the WORKER serves and the router never sees — `IG.href` is
 * `${BASE_URL}ig/`, four thousand files of rendered IG. Resolving those against
 * a route table would report the Implementation Guide as a broken link on
 * both surfaces. The property FORM is scanned (above) and is safe for the same
 * reason the attribute is not: a template literal or an `https://` string does
 * not start with `/` and is skipped.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readSurfaceRoutes, routeResolves } from './lib/route-table.mjs'
import { stripComments } from './lib/jsx-comments.mjs'
import { appRoot, appRootFloors, REPO_ROOT } from './lib/app-roots.mjs'
import { resolveImport, spierPackageRoots } from './lib/module-graph.mjs'
import { reportFloors } from './lib/floors.mjs'

let failures = 0
function fail(msg) {
  console.error(`✗ ${msg}`)
  failures++
}

const { byApp } = readSurfaceRoutes()

// ⚠️ Resolves `@spier/<pkg>/…` too — a relative-only resolver stopped this walk
// at packages/tool-views and the reach fell from 89 modules to 61 with the gate
// still green. See lib/module-graph.mjs.
const PACKAGE_ROOTS = spierPackageRoots(REPO_ROOT)
const resolveSpec = (spec, fromFile) => resolveImport(spec, fromFile, REPO_ROOT, PACKAGE_ROOTS)

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

/**
 * The two surfaces, each with the words its failure message needs. `landing`
 * is where that app's `*` catch-all puts a reader, so the message can say what
 * the defect looks like rather than what the router did.
 */
const SURFACES = [
  {
    id: 'clinical',
    other: 'guide',
    reader: 'a clinician',
    landing: 'the patient record',
    // Floors from the first green run after the apps split; a narrowing of the
    // walk, the route parser or the target scanner shows up as a drop below.
    floors: { modules: 105, routes: 20, targets: 13 },
  },
  {
    id: 'guide',
    other: 'clinical',
    reader: 'a reader of the guide',
    landing: 'the Overview',
    // From this gate's first run over the guide (2026-09-20): 206 modules, 37
    // routes, 25 absolute targets. Set below those so a lazy page being folded
    // into the walk or a route being added does not move them, and a collapse
    // of the reach does.
    floors: { modules: 150, routes: 30, targets: 18 },
  },
]

/**
 * Every module the app reaches from its App.tsx, with the import trail that
 * reached it.
 *
 * Walked from App.tsx rather than from the routes' components, because the
 * shell is a LAYOUT route (`<Route element={<Shell/>}>`) with no `path` —
 * starting from paths would miss `Shell`, `AppShell` and `Sidebar`, and the
 * sidebar is the single most likely place for a cross-surface link to sit.
 * There is nothing to skip: a page an app does not import is not in that app's
 * graph at all, so the walk is the whole surface by construction.
 */
function reach(src, app) {
  const seen = new Map()
  const stack = [[app, ['App.tsx']]]
  while (stack.length) {
    const [file, trail] = stack.pop()
    if (seen.has(file)) continue
    seen.set(file, trail)
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const next = resolveSpec(m[1], file)
      if (next && !next.includes('.test.')) stack.push([next, [...trail, relative(src, next)]])
    }
  }
  return seen
}

/** Every literal navigation target in one module's source — the five forms. */
function targetsIn(text) {
  return [
    ...[...text.matchAll(/\bto=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...text.matchAll(/\bnavigate\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    // ⚠️ **The object-property form, and leaving it out made this gate miss the
    // four links that matter most.** `Sidebar` builds the CLINICAL nav —
    // Patient record, Caseload, Measures, Settings — as an array of
    // `{ to: '/…', label }` mapped into `<NavLink to={item.to}>`, so no `to="…"`
    // attribute exists to match. The first green run of this gate checked 19
    // targets and not one of them was the clinical sidebar.
    ...[...text.matchAll(/\bto:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    // The `SurfaceLinks` form — `href:`, `chartHref:`, `registryHref:` — and
    // the Overview's lens cards. See the header for why this is scanned and
    // the `href="…"` attribute is not.
    ...[...text.matchAll(/\b\w*[hH]ref:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    // The content modules' inline markup — `[Care Pathway](/guide/pathway)` in
    // a plain string, rendered by `content/renderInline.tsx`. See the header
    // for the regression that made this form necessary, and for why it matches
    // only an href that starts with `/`.
    ...[...text.matchAll(/\[[^\]\n]+\]\((\/[^)\s]*)\)/g)].map((m) => m[1]),
  ]
}

const summaries = []
for (const surface of SURFACES) {
  const table = byApp[surface.id]
  const otherTable = byApp[surface.other]
  const src = appRoot(table.source)
  const app = join(src, 'App.tsx')
  const seen = reach(src, app)

  // ── RULE 1 ────────────────────────────────────────────────────────────────
  let checked = 0
  let skipped = 0
  for (const [file, trail] of seen) {
    if (file === app) continue // RULE 2 owns the route table itself
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const t of targetsIn(text)) {
      if (!t.startsWith('/')) { skipped++; continue }
      checked++
      const path = routePart(t)
      if (routeResolves(path, table.paths)) continue
      const why = routeResolves(path, otherTable.paths)
        ? `"${t}" is a route of apps/${surface.other}, which is another origin since the apps split`
        : `"${t}" resolves to no route on either surface`
      fail(
        `${relative(REPO_ROOT, file)} navigates to a path ${surface.reader} cannot reach: ${why}.\n` +
          `    reached from ${trail.join(' → ')}\n` +
          `    A missing route falls to the \`*\` catch-all, which redirects to \`/\` — so this does ` +
          `not 404, it silently returns the reader to ${surface.landing}.\n` +
          `    Point it at a route apps/${surface.id} registers, or — if the view is shared — read it ` +
          'from SurfaceLinksContext so each app supplies its own.',
      )
    }
  }
  if (checked === 0) {
    fail(
      `no absolute navigation targets were read from any ${surface.id} module, so RULE 1 verified ` +
        'nothing there. The link scanner has stopped matching its four forms.',
    )
  }

  // ── RULE 2 ────────────────────────────────────────────────────────────────
  let redirectsChecked = 0
  for (const from of table.redirects) {
    const to = table.redirectTargets.get(from)
    if (to === undefined || !to.startsWith('/')) continue
    redirectsChecked++
    if (routeResolves(routePart(to), table.paths)) continue
    fail(
      `apps/${surface.id}/src/App.tsx: the redirect at "${from}" sends the reader to "${to}", ` +
        `which does not resolve in this app — ${surface.reader} following it lands on the catch-all. ` +
        `If the destination is the other app's, it is a cross-origin hop, not a <Navigate>.`,
    )
  }
  if (redirectsChecked === 0) {
    fail(`no ${surface.id} redirects were read, so RULE 2 verified nothing there.`)
  }

  // ── Liveness ──────────────────────────────────────────────────────────────
  //
  // ⚠️ Three collapsible dimensions per surface. The reach is a regex walk from
  // App.tsx, the route set is parsed out of the same file, and the targets are
  // literals scraped from the modules — a narrowing in any one of them leaves
  // this printing a confident ✓ over a fraction of the surface. The
  // `checked === 0` guards above cover the collapse-to-nothing cases; these
  // cover the collapse-to-a-few.
  reportFloors(
    [
      { source: `${surface.id} import graph`, dimension: 'module(s) reached', actual: seen.size, floor: surface.floors.modules },
      { source: `${surface.id} route table`, dimension: 'route(s)', actual: table.paths.size, floor: surface.floors.routes },
      { source: `${surface.id} import graph`, dimension: 'absolute link target(s)', actual: checked, floor: surface.floors.targets },
    ],
    fail,
  )

  summaries.push(
    `${surface.id}: ${seen.size} module(s) reached, ${checked} absolute target(s) and ` +
      `${redirectsChecked} redirect(s) resolve against ${table.paths.size} route(s) ` +
      `(${skipped} relative/external target(s) skipped)`,
  )
}

reportFloors(appRootFloors(), fail)

if (failures) {
  console.error(`\nsurface-links check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(`✓ surface links — ${summaries.join('; ')}.`)
