#!/usr/bin/env node
/**
 * `TOOL_VIEWS` and the route tables that render it agree — in EVERY app.
 *
 * ── Why this is a gate and not a test any more ─────────────────────────────
 *
 * The 18 instrument fillers and 11 workflow recorders are ONE definition
 * rendered by two route families: the clinician's `/patient/assessments/*` and
 * `/patient/workflow/*` paths, and the guide's `/guide/tools/:slug/try`.
 * CLAUDE.md states the rule and why — *"two copies drift on a `persistName` and
 * the guide then documents a resource the app does not write."*
 *
 * It used to be checked by `toolViews.test.ts`, which sat beside the map and
 * read `../App.tsx` by relative path. That worked while the map and the route
 * table were in one tree. The map now lives in `packages/tool-views`, and the
 * `apps/` split turns the single route table into one per app — so a relative
 * `../App.tsx` is both wrong and, worse, **the wrong shape**: it can only ever
 * check one table, and the invariant is now *every* table.
 *
 * So the app roots come from `lib/app-roots.mjs`, and this walks all of them.
 * A second app's route table is checked the day it is declared, and PR #546's
 * hard failure means it cannot be declared quietly.
 *
 * ── Reads both files as TEXT, deliberately ─────────────────────────────────
 *
 * Importing `toolViews.tsx` pulls in the questionnaire registry, the care-plan
 * mappers and the whole tool catalog — which means the generated FHIR tree,
 * which means a 30-second SUSHI compile before this could answer. The question
 * is purely structural: do two lists of string literals agree.
 * `lib/route-table.mjs` makes the same trade for the same reason.
 *
 * ── What it cannot see ─────────────────────────────────────────────────────
 *
 * ⚠️ **That the view is the RIGHT one.** A route may look up a key that exists
 * and render a recorder for a different instrument; the strings agree and this
 * says nothing. `check:outputs` is what ties a slug to what it actually emits.
 *
 * ⚠️ **A route table that renders no tool views at all.** An app that simply
 * does not offer them is legitimate — the population dashboard is one — so a
 * table with zero lookups is skipped rather than failed, and the count is
 * printed per app so a table that SILENTLY stopped matching is visible. The
 * floor below is on the total across all apps, which cannot be zero while any
 * app renders a recorder.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { APP_ROOTS, appRootFloors, REPO_ROOT } from './lib/app-roots.mjs'
import { reportFloors } from '../../scripts/lib/floors.mjs'

const MAP = join(REPO_ROOT, 'packages/tool-views/src/data/toolViews.tsx')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }
const rel = (p) => relative(REPO_ROOT, p)

if (!existsSync(MAP)) {
  console.error(`✗ ${rel(MAP)} does not exist — this gate reads that map as text. It has moved; teach this gate where.`)
  process.exit(1)
}
const mapSrc = readFileSync(MAP, 'utf8')

/** Every key defined in the TOOL_VIEWS object literal. */
function definedKeys() {
  const start = mapSrc.indexOf('export const TOOL_VIEWS')
  const end = mapSrc.indexOf('/** Is `slug` something')
  if (start < 0 || end < 0 || end <= start) {
    fail(
      `${rel(MAP)}: could not locate the TOOL_VIEWS object literal. This gate reads it as text, ` +
        'so a changed shape makes every comparison below pass over an empty list — fix the reader, not the callers.',
    )
    return []
  }
  // Keys are quoted and start a line; the values are JSX containing colons, so
  // anchoring to the line start is what keeps this from matching inside one.
  return [...mapSrc.slice(start, end).matchAll(/^\s{2}'([\w-]+)':/gm)].map((m) => m[1])
}

/** Every `<Route path="assessments/x" element={TOOL_VIEWS['y']} />` in one app. */
function routeLookups(appSrc) {
  const re = /<Route path="(assessments|workflow)\/([\w-]+)" element=\{TOOL_VIEWS\['([\w-]+)'\]\} \/>/g
  return [...appSrc.matchAll(re)].map((m) => ({ path: `${m[1]}/${m[2]}`, key: m[3] }))
}

const defined = definedKeys()
const definedSet = new Set(defined)

// ── Per-app: every key a route looks up is defined, and keyed by its slug ────
let totalLookups = 0
const routedAnywhere = new Set()
const perApp = []

for (const root of APP_ROOTS) {
  const app = join(root.dir, 'App.tsx')
  if (!existsSync(app)) {
    fail(`${root.source}: no App.tsx — a declared app root with no route table cannot be checked, and this gate would pass over it`)
    continue
  }
  const lookups = routeLookups(readFileSync(app, 'utf8'))
  totalLookups += lookups.length
  perApp.push(`${root.source} ${lookups.length}`)

  for (const r of lookups) {
    routedAnywhere.add(r.key)
    if (!definedSet.has(r.key)) {
      fail(`${root.source}/App.tsx routes "${r.path}" to TOOL_VIEWS['${r.key}'], which ${rel(MAP)} does not define — that route renders a blank page`)
    }
    // The guide's try route is /guide/tools/<slug>/try, and <slug> is this
    // segment. A key that did not match its route's last segment would give the
    // clinician a working form and the implementer "no such tool".
    if (r.path.split('/')[1] !== r.key) {
      fail(`${root.source}/App.tsx routes "${r.path}" to TOOL_VIEWS['${r.key}'] — the key must equal the route's last segment, or /guide/tools/${r.path.split('/')[1]}/try finds no such tool`)
    }
  }
}

// ── Across all apps: no view that nothing renders, and no key defined twice ──
for (const k of defined) {
  if (!routedAnywhere.has(k)) {
    fail(`${rel(MAP)} defines '${k}', which NO app's route table renders — either a dead definition or a route deleted without its element`)
  }
}
const dupes = defined.filter((k, i) => defined.indexOf(k) !== i)
if (dupes.length) fail(`${rel(MAP)} defines these keys more than once: ${[...new Set(dupes)].join(', ')}`)

// ── The guard that makes a slug from the URL safe to look up ────────────────
if (!mapSrc.includes('Object.prototype.hasOwnProperty.call(TOOL_VIEWS, slug)')) {
  fail(`${rel(MAP)}: isToolViewSlug must use Object.prototype.hasOwnProperty.call — a bare \`slug in TOOL_VIEWS\` answers yes for 'toString' and hands ToolTryIt a function to render`)
}
if (/return\s+slug\s+in\s+TOOL_VIEWS/.test(mapSrc)) {
  fail(`${rel(MAP)}: isToolViewSlug uses \`slug in TOOL_VIEWS\`, which is true for inherited Object properties`)
}

reportFloors(
  [
    ...appRootFloors(),
    { source: 'toolViews.tsx', dimension: 'view(s) defined', actual: defined.length, floor: 14 },
    { source: 'app route tables', dimension: 'TOOL_VIEWS lookup(s)', actual: totalLookups, floor: 14 },
  ],
  fail,
)

if (failures) {
  console.error(`\ntool-view-routes check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ tool-view routes: ${defined.length} view(s) defined in ${rel(MAP)}, ` +
    `${totalLookups} lookup(s) across ${APP_ROOTS.length} app route table(s) (${perApp.join(', ')}), all resolving both ways`,
)
