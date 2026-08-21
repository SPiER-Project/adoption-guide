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

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..')
const SRC = join(webRoot, 'src')

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
  const appSrc = readFileSync(join(SRC, 'App.tsx'), 'utf8')
  const entries = ['pages/AdoptionGuide.tsx']
  for (const p of paths) {
    const m = appSrc.match(new RegExp(`<Route path="${p}" element=\\{<(\\w+)\\s*/>\\}`))
    if (!m) {
      fail(`App.tsx: no route element found for guide section "${p}" — this gate reads the route table to find the section's component`)
      continue
    }
    entries.push(`pages/${m[1]}.tsx`)
  }
  return entries
}

function resolveSpec(spec, fromFile) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(fromFile), spec)
  for (const cand of [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand)) return cand
  }
  return null
}

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

if (failures) {
  console.error(`\nguide-boundary check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ guide boundary: ${entries.length} guide page(s), ${seen.size} module(s) reachable from them, ` +
    `none reading patient fixtures or a data source`,
)
