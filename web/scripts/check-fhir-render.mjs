#!/usr/bin/env node
/**
 * A component that dumps a resource must have asked whether it may.
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 *
 * The clinician-facing app shows no raw FHIR (2026-09-17). The invariant lives
 * in `src/context/InspectContext.ts` — inspection is ON inside `/guide` and OFF
 * everywhere else — and `FhirJsonViewer` / `CodeDrawer` self-gate on it, so a
 * new call site gets the clinician's answer by default.
 *
 * ⚠️ **The leaf gate only covers components that go THROUGH the leaf.**
 * `CarePlanDisplay` renders its own `<pre>{JSON.stringify(carePlan.resource)}</pre>`
 * plus a "Download CarePlan JSON" button. It bypassed both components, so the
 * inventory in `docs/plans/production-clinical-surface.md` — built by listing
 * `FhirJsonViewer`'s call sites — did not contain it. It was found by grepping
 * `JSON.stringify` across `web/src`, one commit before shipping. Nothing stopped
 * the next component doing the same thing.
 *
 * So the list is derived here instead of written down there.
 *
 * ── Why the rule is FILE-LOCAL and not "reachable from a clinician route" ───
 *
 * The obvious shape — walk the non-guide routes transitively, the way
 * `check-guide-boundary.mjs` walks the guide's, and fail on a dump in anything
 * reachable — does not work, and the reason is worth stating because it is the
 * same reason `InspectContext` is a context rather than a prop. The components
 * that render FHIR are reached from BOTH surfaces: `QuestionnaireView`,
 * `WorkflowForm`, `CarePlanDisplay` and `FhirJsonViewer` itself are one
 * implementation each, rendered by `/patient/assessments/*` and by
 * `/guide/tools/:slug/try`. A reachability walk from the clinician routes
 * reaches every one of them, including the leaf whose whole job is the dump. It
 * cannot separate the two audiences, because the audience is not a property of
 * the module graph — it is a property of the render, which is exactly what the
 * context carries.
 *
 * What IS checkable per file: did this file ask? `useInspect()` in the same file
 * is the question being asked. The gate does not, and cannot, check that the
 * answer is used correctly.
 *
 * ── What it cannot see ──────────────────────────────────────────────────────
 *
 *  1. **Whether the guard actually guards.** `CarePlanDisplay` holds three
 *     separate `inspect &&` expressions; a file that calls `useInspect()` and
 *     ignores it passes. This is a "did you think about it" gate, not a proof.
 *  2. **A dump built somewhere else.** A `.ts` helper returning pretty-printed
 *     JSON, rendered by a `.tsx` that never writes `JSON.stringify`, is
 *     invisible. Only `.tsx` is scanned: a `.ts` module cannot render, so
 *     scanning it would buy nothing for this invariant and would charge an
 *     allowlist entry for every `localStorage.setItem(k, JSON.stringify(v))`.
 *  3. **Rendering a resource without serializing it.** A table of
 *     `Object.entries(resource)`, a `<code>{obs.code.coding[0].code}</code>`, a
 *     syntax highlighter fed a resource — all read as raw FHIR to a clinician
 *     and none of them match either pattern here.
 *  4. **FHIR vocabulary in prose.** Every workflow recorder's lede says
 *     "Records a <strong>Communication</strong> tagged to the …" and that text
 *     renders on the clinician's route today. Whether that is a defect is a
 *     design decision nobody has made; see
 *     `docs/internals/tool-views.md` §4. A gate must not decide it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { stripComments } from '../../scripts/lib/jsx-comments.mjs'
import { reportFloors } from '../../scripts/lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../src')
const root = resolve(here, '../..')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

/**
 * Files that match a pattern below and are NOT a resource view.
 *
 * Every entry is a claim with a reason, in the shape `check-prose-measure.mjs`
 * and the `PENDING_TX` allowlist use: the point of a named exemption is that
 * someone had to write the sentence. An entry whose reason stops being true is
 * a defect the gate can no longer see, so keep them specific — "not a render"
 * is not a reason, "writes to localStorage and returns nothing" is.
 */
const NOT_A_RESOURCE_VIEW = {
  'context/ToolConfigProvider.tsx':
    'serializes the tool-enablement preset INTO localStorage. Nothing is rendered, and the value is a settings object rather than a resource.',
  'components/PathwayView.tsx':
    'the <pre> holds a CQL/pathway ERROR STRING, not a resource. The resources this view does show go through FhirJsonViewer, which gates itself.',
  'pages/CdsServiceGuide.tsx':
    'a guide page: the <pre> blocks are the curl invocations and the hook payload an implementer copies. Inspection is on for this whole surface by definition, so asking it again would be noise.',
}

/** Every non-test .tsx under web/src, as paths relative to it. */
function sources(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { sources(p, out); continue }
    if (!name.endsWith('.tsx') || name.includes('.test.')) continue
    out.push(relative(SRC, p))
  }
  return out
}

/**
 * The two ways this repo has actually put a resource on screen.
 *
 * `JSON.stringify` covers both the dump and the download — `CarePlanDisplay`'s
 * `new Blob([JSON.stringify(…)])` is the same affordance pointed at a file.
 */
const PATTERNS = [
  {
    name: 'JSON.stringify',
    re: /JSON\.stringify\s*\(/g,
    what: 'serializes an object to JSON',
  },
  {
    name: '<pre>',
    re: /<pre[\s>]/g,
    what: 'renders a <pre> block — the raw-dump affordance',
  },
]

const files = sources()
if (files.length === 0) {
  // The #500 lesson: a gate handed an empty tree reports green having read
  // nothing. Refuse rather than congratulate.
  throw new Error('check-fhir-render: found no .tsx under web/src — the scan is broken, not the code')
}

const counts = Object.fromEntries(PATTERNS.map((p) => [p.name, 0]))
let guarded = 0
let exempted = 0

for (const rel of files) {
  // ⚠️ Comments blanked first. `CarePlanDisplay`'s own header comment names
  // both `JSON.stringify` and `<pre>`, and `CodeDrawer`'s names `<pre>` while
  // rendering none — a raw scan would be reading prose about the rule as
  // instances of it. Same reason `check-css-dead` blanks them.
  const src = stripComments(readFileSync(join(SRC, rel), 'utf8'))
  const hits = PATTERNS.filter((p) => { p.re.lastIndex = 0; return p.re.test(src) })
  for (const p of hits) {
    p.re.lastIndex = 0
    counts[p.name] += [...src.matchAll(p.re)].length
  }
  if (hits.length === 0) continue

  const asks = /\buseInspect\s*\(/.test(src)
  const exempt = NOT_A_RESOURCE_VIEW[rel]

  if (asks) { guarded++; continue }
  if (exempt) { exempted++; continue }

  fail(
    `${relative(root, join(SRC, rel))} ${hits.map((h) => h.what).join(' and ')}, ` +
      `but never calls useInspect().\n` +
      `    Raw FHIR belongs in the Adoption Guide and nowhere else — see src/context/InspectContext.ts.\n` +
      `    Either gate the output on useInspect(), render it through <FhirJsonViewer>, or add an entry to\n` +
      `    NOT_A_RESOURCE_VIEW in ${relative(root, join(here, 'check-fhir-render.mjs'))} saying why this is not a resource view.`,
  )
}

// An allowlist entry for a file that no longer matches is a rule nobody is
// getting, and it is how an exemption outlives its reason.
for (const rel of Object.keys(NOT_A_RESOURCE_VIEW)) {
  if (!files.includes(rel)) {
    fail(`NOT_A_RESOURCE_VIEW names ${rel}, which is not a non-test .tsx under web/src — delete the entry or fix the path`)
    continue
  }
  const src = stripComments(readFileSync(join(SRC, rel), 'utf8'))
  if (!PATTERNS.some((p) => { p.re.lastIndex = 0; return p.re.test(src) })) {
    fail(`NOT_A_RESOURCE_VIEW exempts ${rel}, but it no longer serializes or renders a <pre> — delete the entry`)
  }
}

// ⚠️ The site floors are weak BY CONSTRUCTION and the file floor is the
// load-bearing one. The whole point of the invariant is that the inventory
// stays tiny: three JSON.stringify sites is a healthy number, so "half, rounded
// down" lands at 1 and proves almost nothing on its own. What a rerouted or
// dead scan actually shows up in is the file count.
const floorsHeld = reportFloors(
  [
    { source: 'web/src', dimension: 'non-test .tsx scanned', actual: files.length, floor: 38 },
    { source: 'web/src', dimension: 'JSON.stringify site(s)', actual: counts['JSON.stringify'], floor: 2 },
    { source: 'web/src', dimension: '<pre> site(s)', actual: counts['<pre>'], floor: 2 },
  ],
  fail,
)

if (failures) {
  console.error(`\nfhir-render check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ raw-FHIR rendering: ${files.length} component(s) scanned, ` +
    `${guarded} that serialize or dump ask useInspect(), ${exempted} exempt with a reason` +
    (floorsHeld ? '' : ' (floors short)'),
)
