#!/usr/bin/env node
/**
 * The Adoption Guide holds no patient data.
 *
 * Step D (#391) moved the measure dashboard out of `/guide/*` to the EHR side,
 * on the reasoning that the guide explains and configures the pathway while the
 * caseload lives where a caseload would live. That is an easy property to
 * re-break: one `import registryPatients from '@spier/demo-population'` in a
 * guide module and it is gone, with nothing to notice.
 *
 * RULES
 *   1. Nothing the guide APP reaches — walked from `apps/guide/src/main.tsx`,
 *      every import kind, through every package — is a file under
 *      `packages/demo-population/` or the registry-wide `useRegistrySlices`.
 *   2. Nothing the guide's PAGES reach (the layout plus every section's
 *      component, derived from `guideSections.ts` and the route table) is a
 *      concrete data source (`*DataSource.ts`). See "the data-source half".
 *   3. Every `@spier/…` or relative import on the way resolves; an import the
 *      walk cannot follow is a module it never read, and fails.
 *
 * ⚠️ **Both rules match the RESOLVED file, not the specifier text.** The first
 * version tested `/@spier\/demo-population/` against what was written, so a
 * relative `../../../../packages/demo-population/src/patients.json` walked
 * straight into the fixtures and passed; and it started from the guide's
 * PAGES only, so the same import in `App.tsx` passed too. Both were planted
 * green on 2026-10-06 — as was a whole patient's scenario shipped in the guide
 * bundle, which `check:surface` did not see either.
 *
 * ⚠️ **The data-source half stays page-scoped, and that is a known limit rather
 * than a loosening.** The guide app mounts `PatientProvider` (App.tsx), which
 * constructs the UNSEEDED `localDataSource` its fillers write into
 * (docs/internals/repo-layout.md) — so "the app reaches no data source" is false
 * by design today, while "no guide PAGE reaches one" is the rule this gate has
 * always held. Rule 1 is what keeps that local store empty.
 *
 * What counts as patient DATA rather than patient CONTEXT is the line that
 * matters: `usePatient()` for `activePatientId` is fine and is used by Tool
 * Configuration to build a link into the Patient lens.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { appRoot, appRootFloors } from './lib/app-roots.mjs'
import { chainTo, createResolver, walkGraph } from './lib/module-graph.mjs'
import { reportFloors } from './lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const SRC = appRoot('apps/guide/src')
const MAIN = join(SRC, 'main.tsx')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

const DEMO_POPULATION = join(root, 'packages/demo-population') + '/'
/** Rule 1, over the whole app: patient fixtures and registry reads. */
const PATIENT_DATA = [
  { test: (f) => f.startsWith(DEMO_POPULATION), why: 'the demo patient fixtures' },
  { test: (f) => /^useRegistrySlices\.tsx?$/.test(basename(f)), why: 'a registry-wide slice read' },
]
/** Rule 2, over the guide's pages. */
const DATA_SOURCE = { test: (f) => /DataSource\.tsx?$/.test(basename(f)), why: 'a concrete data source' }

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

const resolveImport = await createResolver(root)
const trail = (reached, file) => chainTo(reached, file).map((f) => relative(root, f)).join(' → ')

function report(reached, unresolved, rules) {
  for (const u of unresolved) {
    fail(`${relative(root, u.from)} imports "${u.spec}", which resolves to no file — this walk cannot follow it, so whatever it reaches is unchecked`)
  }
  for (const file of reached.keys()) {
    const hit = rules.find((r) => r.test(file))
    if (!hit) continue
    // Name where the guide ENTERS the forbidden tree, not every file inside it.
    const parent = reached.get(file)
    if (parent && hit.test(parent)) continue
    fail(
      `the Adoption Guide reaches ${hit.why}: ${relative(root, file)}\n` +
        `    via ${trail(reached, file)}\n` +
        '    The guide explains and configures the pathway; the caseload lives on the EHR side (#391).',
    )
  }
}

// ── RULE 1 (and 3): the whole app ───────────────────────────────────────────
if (!existsSync(MAIN)) fail(`${relative(root, MAIN)} does not exist — this gate walks the guide app from it`)
const app = existsSync(MAIN) ? walkGraph([MAIN], resolveImport) : { reached: new Map(), unresolved: [] }
report(app.reached, app.unresolved, PATIENT_DATA)

// ── RULE 2: the guide's pages ───────────────────────────────────────────────
const entries = guideEntryPoints()
const pageFiles = []
for (const e of entries) {
  const p = join(SRC, e)
  if (existsSync(p)) pageFiles.push(p)
  else fail(`guide entry point ${e} does not exist`)
}
if (pageFiles.length === 0 && failures === 0) {
  fail('no guide entry points resolved — refusing to report a clean guide having read nothing')
}
const pages = walkGraph(pageFiles, resolveImport)
// Unresolved imports and patient data are reported once, by the app walk —
// every page is in it.
report(pages.reached, [], [DATA_SOURCE])

// ── Liveness ────────────────────────────────────────────────────────────────
//
// ⚠️ Each dimension is collapsible without the directory going anywhere: the
// entry points come from parsing guideSections.ts and App.tsx, the reach from
// the import walk. Either can narrow to almost nothing and still print a ✓.
reportFloors(
  [
    ...appRootFloors(),
    { source: 'guide entry points', dimension: 'guide page(s)', actual: entries.length, floor: 4 },
    { source: 'guide page graph', dimension: 'module(s) reached', actual: pages.reached.size, floor: 75 },
    { source: 'guide app graph', dimension: 'module(s) reached from main.tsx', actual: app.reached.size, floor: 120 },
  ],
  fail,
)

if (failures) {
  console.error(`\nguide-boundary check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ guide boundary: ${app.reached.size} module(s) reachable from the guide app, none reading patient fixtures; ` +
    `${entries.length} guide page(s) reaching ${pages.reached.size} module(s), none reading a data source`,
)
