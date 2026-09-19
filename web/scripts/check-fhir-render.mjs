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
 *  4. Prose was a fourth until 2026-09-17, when Brad settled it — the recorder
 *     describes the ACT, the wire format goes in `fhirNote`. That is RULE 3,
 *     which does not share these blind spots because it does not share the
 *     mechanism: it parses.
 *
 * ── RULE 3: the recorders' prose ────────────────────────────────────────────
 *
 * Every workflow recorder's lede used to open "Records a
 * <strong>Communication</strong> tagged to the …", and `WorkflowForm` renders
 * the lede through `PageHeader` unconditionally, on `/patient/workflow/*`. So
 * the clean-clinical-surface pass removed the JSON and left the wire format in
 * the prose beside it. Three recorders went further, naming an extension or a
 * `CarePlan/{id}` reference in field help a clinician reads while filling in
 * the form.
 *
 * ⚠️ **A text scan cannot do this one, and shipping one that looked like it
 * could would be worse than nothing.** `Appointment` is a resource type in
 * `<strong>Appointment</strong>`, an identifier in `AppointmentResource`, and a
 * reference prefix in `` `Appointment/${a.id}` `` — one token, three meanings,
 * and only the first is prose. So RULE 3 parses the file with TypeScript's own
 * parser and reads **JSXText nodes only**: what is actually rendered as words.
 * Identifiers, imports, template literals and string attributes are invisible
 * to it by construction, which is why `draftTitle="Live FHIR Communication"`
 * needs no exemption.
 *
 * The one carve-out is the `fhirNote={…}` attribute, whose entire subtree is
 * skipped — that is the implementer's half, it renders inside `CodeDrawer`, and
 * `CodeDrawer` is gated by `useInspect()`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { stripComments } from '../../scripts/lib/jsx-comments.mjs'
import { reportFloors } from '../../scripts/lib/floors.mjs'
import { appRoot, appRootFloors } from './lib/app-roots.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = appRoot('web/src')
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

// ── RULE 3 — a recorder's prose describes the act, not the resource ────────

/**
 * The words that mean "this is the wire format". Resource types SPiER actually
 * writes or reads, plus the two shapes a clinician has no use for: a
 * `SPiER…`-prefixed profile name and an `Element.path`.
 *
 * ⚠️ Matched against JSXText ONLY, so `AppointmentResource` and
 * `` `Appointment/${id}` `` never reach this list. See the header.
 */
const RESOURCE_TYPES = [
  'Communication', 'ServiceRequest', 'DocumentReference', 'Appointment', 'Consent',
  'Task', 'Procedure', 'Observation', 'EpisodeOfCare', 'Flag', 'CarePlan',
  'QuestionnaireResponse', 'Questionnaire', 'Encounter', 'DiagnosticReport',
]
const PROSE_PATTERNS = [
  { name: 'a FHIR resource type', re: new RegExp(`\\b(${RESOURCE_TYPES.join('|')})\\b`, 'g') },
  { name: 'a SPiER profile name', re: /\bSPiER[A-Z]\w+/g },
  { name: 'a FHIR element path', re: new RegExp(`\\b(?:${RESOURCE_TYPES.join('|')})\\.[a-z]\\w*`, 'g') },
]

/**
 * JSX text rendered by `file`, and every `<code>` it renders, both excluding
 * anything inside a `fhirNote={…}`.
 *
 * ⚠️ **`<code>` is its own rule because a word list cannot do it.** The leaks
 * the audit found were `caring-contact-opt-out`, `episode-trigger` and a
 * `CarePlan/{id}` reference in field help — an extension id is a kebab-case
 * slug, and nothing distinguishes one from "no-show follow-up" or "care-gap" by
 * spelling. What DOES distinguish them is the element: a recorder reaching for
 * `<code>` is quoting an identifier at the reader, and a clinician filling in a
 * form has no identifier to be shown. So the rule is the tag, not the text.
 */
function renderedText(file, src) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  /** @type {{text: string, line: number}[]} */
  const out = []
  /** @type {number[]} */
  const codeTags = []
  let sawJsx = false
  const walk = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) sawJsx = true
    // The implementer's half. Skipped whole: its subtree renders inside
    // CodeDrawer, which returns null unless useInspect() says otherwise.
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'fhirNote') return
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'code') {
      codeTags.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1)
    }
    if (ts.isJsxText(node)) {
      const text = node.getText(sf)
      if (text.trim()) {
        out.push({ text, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 })
      }
      return
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  return { runs: out, codeTags, sawJsx }
}

/** Files that render <WorkflowForm> — the recorder views, derived not listed. */
const recorders = files.filter((rel) =>
  /<WorkflowForm[\s>]/.test(stripComments(readFileSync(join(SRC, rel), 'utf8'))),
)
if (recorders.length === 0) {
  throw new Error(
    'check-fhir-render: no file renders <WorkflowForm> — RULE 3 derives the recorder views from ' +
      'that, so it would now check nothing. Fix the detection rather than the rule.',
  )
}

let proseRuns = 0
for (const rel of recorders) {
  const src = stripComments(readFileSync(join(SRC, rel), 'utf8'))
  const { runs, codeTags, sawJsx } = renderedText(rel, src)
  if (!sawJsx) {
    fail(`${rel} renders <WorkflowForm> but the parser found no JSX in it — RULE 3 has stopped reading this file`)
    continue
  }
  proseRuns += runs.length
  for (const line of codeTags) {
    fail(
      `${relative(root, join(SRC, rel))}:${line}: the clinician reads a <code> — an extension id, a\n` +
        `    reference or an element path, quoted at someone who has no identifier to be shown.\n` +
        `    Move it into WorkflowForm's fhirNote={…}, or say the thing in words.`,
    )
  }
  for (const run of runs) {
    for (const p of PROSE_PATTERNS) {
      p.re.lastIndex = 0
      const hits = [...new Set([...run.text.matchAll(p.re)].map((m) => m[0]))]
      if (hits.length === 0) continue
      fail(
        `${relative(root, join(SRC, rel))}:${run.line}: the clinician reads ${p.name} — ${hits.map((h) => `"${h}"`).join(', ')}\n` +
          `    A recorder describes the ACT, not the resource (Brad, 2026-09-17). The lede and every\n` +
          `    field label, help string and notice render on /patient/workflow/* with no inspection gate.\n` +
          `    Move the wire format into WorkflowForm's fhirNote={…}, which renders inside the CodeDrawer.`,
      )
    }
  }
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
    ...appRootFloors(),
    { source: 'web/src', dimension: 'non-test .tsx scanned', actual: files.length, floor: 38 },
    { source: 'web/src', dimension: 'JSON.stringify site(s)', actual: counts['JSON.stringify'], floor: 2 },
    { source: 'web/src', dimension: '<pre> site(s)', actual: counts['<pre>'], floor: 2 },
    { source: 'recorder views', dimension: 'view(s) rendering <WorkflowForm>', actual: recorders.length, floor: 5 },
    { source: 'recorder views', dimension: 'JSX text run(s) read', actual: proseRuns, floor: 90 },
  ],
  fail,
)

if (failures) {
  console.error(`\nfhir-render check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ raw-FHIR rendering: ${files.length} component(s) scanned, ` +
    `${guarded} that serialize or dump ask useInspect(), ${exempted} exempt with a reason; ` +
    `${recorders.length} recorder view(s), ${proseRuns} JSX text run(s) free of the wire format` +
    (floorsHeld ? '' : ' (floors short)'),
)
