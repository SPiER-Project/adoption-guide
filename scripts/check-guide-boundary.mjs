#!/usr/bin/env node
/**
 * The Adoption Guide holds no patient data.
 *
 * Step D (#391) moved the measure dashboard out of `/guide/*` to the EHR side,
 * on the reasoning that the guide explains and configures the pathway while the
 * caseload lives where a caseload would live. That is an easy property to
 * re-break: one `import registryPatients from '@spier/demo-population'` in a
 * guide page and it is gone, with nothing to notice.
 *
 * The check walks the guide's page components TRANSITIVELY through `web/src`, so
 * it also catches a guide page importing a component that reads fixtures — the
 * shallow version of this rule would have missed that, which is the difference
 * between a gate and a comment.
 *
 * What counts as patient DATA rather than patient CONTEXT is the line that
 * matters: `usePatient()` for `activePatientId` is fine and is used by Tool
 * Configuration to build a link into the Patient lens. Reading fixtures or a
 * data source is not.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { appRoot, appRootFloors } from './lib/app-roots.mjs'
import { resolveImport, spierPackageRoots } from './lib/module-graph.mjs'
import { reportFloors } from './lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const SRC = appRoot('apps/guide/src')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

// Forbidden inside the guide's reachable graph. Patterns, not paths, so a move
// does not silently disarm them.
const FORBIDDEN = [
  { re: /@spier\/demo-population/, why: 'the demo patient fixtures' },
  { re: /dataSource\/localDataSource/, why: 'a concrete data source' },
  { re: /dataSource\/smartDataSource/, why: 'a concrete data source' },
  { re: /useRegistrySlices/, why: 'a registry-wide slice read' },
]

/** The guide's own pages: the layout plus every section's component. */
function guideEntryPoints() {
  const sectionsSrc = readFileSync(join(SRC, 'data/guideSections.ts'), 'utf8')
  const paths = [...sectionsSrc.matchAll(/\{\s*path:\s*'([^']+)'/g)].map((m) => m[1])
  if (paths.length === 0) {
    fail('guideSections.ts: no sections parsed — this gate derives the guide from that list, so an empty read would check nothing')
    return []
  }
  // Section path → component, read off App.tsx's own route table rather than a
  // second hand-kept mapping.
  //
  // ⚠️ Two spellings of a guide route, both accepted. A section and most
  // subsections nest under the `/guide` layout as `path="tools/readiness"`;
  // the tool page (`tools/:toolRef`, 2026-09-20) is a SIBLING of the layout
  // because it draws its own header, so it is `path="/guide/tools/:toolRef"`.
  // A regex that read only the relative form reported "no route element found"
  // for it — which is the right failure for an undeclared page and the wrong
  // one for a declared sibling — so the optional `/guide/` prefix is what lets
  // a sibling be declared here and WALKED rather than left off the list.
  const appSrc = readFileSync(join(SRC, 'App.tsx'), 'utf8')
  const entries = ['pages/AdoptionGuide.tsx']
  for (const p of paths) {
    const m = appSrc.match(new RegExp(`<Route path="(?:/guide/)?${p}" element=\\{<(\\w+)\\s*/>\\}`))
    if (!m) {
      fail(`App.tsx: no route element found for guide section "${p}" — this gate reads the route table to find the section's component`)
      continue
    }
    entries.push(`pages/${m[1]}.tsx`)
  }
  return entries
}

// ⚠️ Resolves `@spier/<pkg>/…` as well as relative specifiers, and that is
// load-bearing rather than a convenience. When the tool views moved into
// packages/tool-views, a relative-only resolver stopped this walk at the
// package boundary and the graph fell from 47 modules to 20 — while the gate
// still printed ✓. See lib/module-graph.mjs.
const PACKAGE_ROOTS = spierPackageRoots(root)
const resolveSpec = (spec, fromFile) => resolveImport(spec, fromFile, root, PACKAGE_ROOTS)

const entries = guideEntryPoints()
const seen = new Set()
const stack = []
for (const e of entries) {
  const p = join(SRC, e)
  if (existsSync(p)) stack.push([p, [e]])
  else fail(`guide entry point ${e} does not exist`)
}
if (stack.length === 0 && failures === 0) {
  fail('no guide entry points resolved — refusing to report a clean guide having read nothing')
}

while (stack.length) {
  const [file, trail] = stack.pop()
  if (seen.has(file)) continue
  seen.add(file)
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    const hit = FORBIDDEN.find((f) => f.re.test(spec))
    if (hit) {
      fail(
        `the Adoption Guide reaches ${hit.why}: "${spec}" in ${relative(root, file)}\n` +
          `    via ${trail.join(' → ')}\n` +
          `    The guide explains and configures the pathway; the caseload lives on the EHR side (#391).`,
      )
    }
    const next = resolveSpec(spec, file)
    if (next) stack.push([next, [...trail, relative(SRC, next)]])
  }
}

// ── Liveness ────────────────────────────────────────────────────────────────
//
// ⚠️ This gate had NO floor, and its two real dimensions are both collapsible
// without the directory going anywhere. The entry points come from parsing
// guideSections.ts and App.tsx; the reach comes from a regex over relative
// import specifiers. Either can narrow to almost nothing and still print a ✓ —
// "1 guide page, 2 modules reachable, none reading patient fixtures" is a true
// sentence about a check that inspected nothing. The zero cases are already
// guarded above; these catch the partial ones, which is the likelier accident.
reportFloors(
  [
    ...appRootFloors(),
    { source: 'guide entry points', dimension: 'guide page(s)', actual: entries.length, floor: 4 },
    { source: 'guide import graph', dimension: 'module(s) reached', actual: seen.size, floor: 75 },
  ],
  fail,
)

if (failures) {
  console.error(`\nguide-boundary check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ guide boundary: ${entries.length} guide page(s), ${seen.size} module(s) reachable from them, ` +
    `none reading patient fixtures or a data source`,
)
