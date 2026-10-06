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
 *         app's App.tsx (App.tsx included) resolves against that app's routes.
 *         Five forms, read by the TypeScript parser rather than a regex: the
 *         `to` attribute, a `navigate(…)` call, the object property `to:`,
 *         any object property ending in `href`/`Href` whose value is an
 *         absolute path — see the note on the fourth below — and the content
 *         modules' inline `[text](/route)` markup, see the note on the fifth.
 *         A value is read when it is a string literal or a template with no
 *         substitution, in any quoting (`to="…"`, `to={'…'}`, `` to={`…`} ``);
 *         anything else is COMPUTED, and counted in the summary. The regex
 *         version read only `to="…"`, and `<Link to={'/patient/onfile'}>`
 *         passed (planted 2026-10-06).
 * RULE 2  Every `<Navigate>` registered in that app points at a path that
 *         resolves there — a redirect that strands the reader is the same
 *         defect one level up. A redirect whose target cannot be read, or is
 *         relative on a non-index route, FAILS rather than being skipped, and
 *         the redirect count has a floor. A redirect whose destination is the
 *         OTHER app is not a `<Navigate>` at all: it is a cross-origin hop
 *         (`apps/guide/src/components/ClinicalRedirect.tsx`), which this rule
 *         does not read and the router never sees. (`check:catalog` asked this
 *         against the UNION of both tables until 2026-10-06; this per-app rule
 *         is strictly stronger and replaced it.)
 * RULE 3  Every import on the way resolves — a module the walk cannot follow
 *         is a module whose links were never read.
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
import ts from 'typescript'
import { readSurfaceRoutes, routeResolves } from './lib/route-table.mjs'
import { appRoot, appRootFloors, REPO_ROOT } from './lib/app-roots.mjs'
import { chainTo, createResolver, walkGraph } from './lib/module-graph.mjs'
import { reportFloors } from './lib/floors.mjs'

let failures = 0
function fail(msg) {
  console.error(`✗ ${msg}`)
  failures++
}

const { byApp } = readSurfaceRoutes()

// ⚠️ Resolves every vite.config.ts alias, and FAILS on an import it cannot
// follow — a relative-only resolver once stopped this walk at
// packages/tool-views and the reach fell from 89 modules to 61 with the gate
// still green. See lib/module-graph.mjs.
const resolveImport = await createResolver(REPO_ROOT)

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
    // Redirects: 10 read on 2026-10-06, floored at roughly half.
    floors: { modules: 105, routes: 20, targets: 13, redirects: 5 },
  },
  {
    id: 'guide',
    other: 'clinical',
    reader: 'a reader of the guide',
    landing: 'the Overview',
    // From this gate's first run over the guide (2026-09-20): 206 modules, 37
    // routes, 25 absolute targets. Set below those so a lazy page being folded
    // into the walk or a route being added does not move them, and a collapse
    // of the reach does. Redirects: 12 read on 2026-10-06.
    floors: { modules: 150, routes: 30, targets: 18, redirects: 6 },
  },
]

/**
 * Every module the app reaches from its App.tsx, every import kind.
 *
 * Walked from App.tsx rather than from the routes' components, because the
 * shell is a LAYOUT route (`<Route element={<Shell/>}>`) with no `path` —
 * starting from paths would miss `Shell`, `AppShell` and `Sidebar`, and the
 * sidebar is the single most likely place for a cross-surface link to sit.
 * There is nothing to skip: a page an app does not import is not in that app's
 * graph at all, so the walk is the whole surface by construction.
 */
function reach(app) {
  return walkGraph([app], resolveImport, { skip: (p) => p.includes('.test.') })
}

const MARKUP_LINK = /\[[^\]\n]+\]\((\/[^)\s]*)\)/g

/**
 * Every navigation target in one module — the five forms — as `{ value }` for
 * a literal, or `{ computed: true }` for anything the parser cannot reduce to
 * one (a variable, a call, a template with a substitution).
 *
 * Read off the TypeScript AST, so quoting and spacing are the parser's
 * problem: `to="x"`, `to={'x'}`, `to={"x"}` and `` to={`x`} `` are one form.
 */
function targetsIn(file) {
  if (!/\.tsx?$/.test(file)) return []
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind)
  const out = []
  /** A literal's text, or `null` when the expression is computed. */
  const literal = (node) => {
    if (!node) return null
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node)) {
      return literal(node.expression)
    }
    return null
  }
  const take = (node) => {
    const v = literal(node)
    out.push(v === null ? { computed: true } : { value: v })
  }
  const nameOf = (n) => (ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : n.getText(sf))
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && nameOf(node.name) === 'to' && node.initializer) {
      take(node.initializer)
    } else if (
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      node.expression.text === 'navigate' && node.arguments[0]
    ) {
      // `navigate(-1)` is history, not a route.
      const arg = node.arguments[0]
      if (!ts.isPrefixUnaryExpression(arg) && !ts.isNumericLiteral(arg)) take(arg)
    } else if (ts.isPropertyAssignment(node)) {
      const name = nameOf(node.name)
      if (name === 'to') take(node.initializer)
      else if (/[hH]ref$/.test(name)) {
        // An `href` property is either a router path or something the router
        // never sees (`https://…`, `${BASE_URL}ig/`): only an absolute literal
        // is a route. See the header.
        const v = literal(node.initializer)
        if (v !== null && v.startsWith('/')) out.push({ value: v })
      }
    }
    // The content modules' inline markup, in any string the module holds.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      for (const m of node.text.matchAll(MARKUP_LINK)) out.push({ value: m[1] })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const summaries = []
for (const surface of SURFACES) {
  const table = byApp[surface.id]
  const otherTable = byApp[surface.other]
  const src = appRoot(table.source)
  const app = join(src, 'App.tsx')
  const { reached, unresolved } = reach(app)
  const trail = (file) => chainTo(reached, file).map((f) => relative(src, f)).join(' → ')

  // ── RULE 3 ────────────────────────────────────────────────────────────────
  for (const u of unresolved) {
    fail(
      `${relative(REPO_ROOT, u.from)} imports "${u.spec}", which resolves to no file — the ` +
        `${surface.id} walk cannot follow it, so its links are unchecked`,
    )
  }

  // ── RULE 1 ────────────────────────────────────────────────────────────────
  let checked = 0
  let skipped = 0
  let computed = 0
  for (const file of reached.keys()) {
    for (const t of targetsIn(file)) {
      if (t.computed) { computed++; continue }
      if (!t.value.startsWith('/')) { skipped++; continue }
      checked++
      const path = routePart(t.value)
      if (routeResolves(path, table.paths)) continue
      const why = routeResolves(path, otherTable.paths)
        ? `"${t.value}" is a route of apps/${surface.other}, which is another origin since the apps split`
        : `"${t.value}" resolves to no route on either surface`
      fail(
        `${relative(REPO_ROOT, file)} navigates to a path ${surface.reader} cannot reach: ${why}.\n` +
          `    reached from ${trail(file)}\n` +
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
        'nothing there. The link reader has stopped matching its five forms.',
    )
  }

  // ── RULE 2 ────────────────────────────────────────────────────────────────
  for (const from of table.unreadRedirects) {
    fail(
      `apps/${surface.id}/src/App.tsx: the redirect at "${from}" has a <Navigate> whose target this ` +
        'gate cannot read — write `to` as a string literal, or this redirect is unchecked.',
    )
  }
  let redirectsChecked = 0
  for (const [from, to] of table.redirectTargets) {
    redirectsChecked++
    if (!to.startsWith('/')) {
      fail(
        `apps/${surface.id}/src/App.tsx: the redirect at "${from}" navigates to "${to}", which is ` +
          'relative on a non-index route — React Router resolves that against the current pathname, ' +
          'so this gate cannot say where it lands. Write the target as an absolute path.',
      )
      continue
    }
    if (routeResolves(routePart(to), table.paths)) continue
    fail(
      `apps/${surface.id}/src/App.tsx: the redirect at "${from}" sends the reader to "${to}", ` +
        `which does not resolve in this app — ${surface.reader} following it lands on the catch-all. ` +
        `If the destination is the other app's, it is a cross-origin hop, not a <Navigate>.`,
    )
  }

  // ── Liveness ──────────────────────────────────────────────────────────────
  //
  // ⚠️ Four collapsible dimensions per surface. The reach is a walk from
  // App.tsx, the routes and redirects are parsed out of the same file, and the
  // targets are literals read from the modules — a narrowing in any one of
  // them leaves this printing a confident ✓ over a fraction of the surface.
  reportFloors(
    [
      { source: `${surface.id} import graph`, dimension: 'module(s) reached', actual: reached.size, floor: surface.floors.modules },
      { source: `${surface.id} route table`, dimension: 'route(s)', actual: table.paths.size, floor: surface.floors.routes },
      { source: `${surface.id} route table`, dimension: 'redirect(s) read', actual: redirectsChecked, floor: surface.floors.redirects },
      { source: `${surface.id} import graph`, dimension: 'absolute link target(s)', actual: checked, floor: surface.floors.targets },
    ],
    fail,
  )

  summaries.push(
    `${surface.id}: ${reached.size} module(s) reached, ${checked} absolute target(s) and ` +
      `${redirectsChecked} redirect(s) resolve against ${table.paths.size} route(s) ` +
      `(${skipped} relative and ${computed} computed target(s) not checked)`,
  )
}

reportFloors(appRootFloors(), fail)

if (failures) {
  console.error(`\nsurface-links check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(`✓ surface links — ${summaries.join('; ')}.`)
