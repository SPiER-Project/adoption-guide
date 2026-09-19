#!/usr/bin/env node
/**
 * Anti-drift check for DEAD CLASS SELECTORS in the app's stylesheets.
 *
 * A component is deleted or redesigned, its TSX goes, and its CSS stays —
 * nothing fails, because no gate reads CSS *and* TSX together. `lint:css`
 * checks a rule's values, `check:tokens` checks that its tokens exist, and
 * neither can ask whether anything renders the class. On 2026-09-15 the
 * maintainability audit found 148 of 980 class selectors referenced by
 * nothing: 92 of the ~135 in `App.css` (the Screenings tab, the old CarePlan
 * tab, the old Encounters timeline, `.tool-card`, `.btn-primary` — whole
 * features whose TSX had been gone for months) and 35 of the 45 in
 * `css/Dashboard.css`, a file named for a page that no longer existed. Dead CSS
 * is not free: it is where a new author copies a padding from, and it is why
 * `.encounters-note` was defined twice with different margins.
 *
 * The rule: every `.class` that appears in SELECTOR position in any
 * `src/**\/*.css` must be referenced somewhere that can put it on an element.
 *
 * What counts as a reference:
 *   1. The class name as a literal, bounded by non-name characters, anywhere
 *      in a non-test `.ts`/`.tsx` under `src`, or in `index.html`. Bounded,
 *      because a substring match let `.encounter-card` hide behind
 *      `encounter-card-divider`.
 *   2. A BEM modifier built at runtime: `.pill--acute` is live if the source
 *      has a template `` `pill--${…}` ``, and `.rubric-select--level-2` if it
 *      has `` `rubric-select--level-${…}` `` — the class extends a literal
 *      prefix that runs through a `--` seam to an interpolation. Only the
 *      `--` seam is recognised; that is the repo's modifier convention, and
 *      it is the only string-building form the codebase uses for class names.
 *      A modifier built any other way reads as dead, and the fix is to write
 *      it the conventional way, not to widen this rule.
 *   3. A class the `@formbox/renderer` emits, which the app overrides under
 *      `.form-card` (`.pon106y`, `.b1fzc7cb`, …). Those never appear in TSX.
 *      They are SCRAPED from the installed `@formbox/hs-theme` stylesheet
 *      rather than allowlisted here, so if formbox re-hashes its classes on an
 *      upgrade the overrides go dead and this gate says so — which is exactly
 *      the defect that would have shipped: the buttons silently reverting to
 *      the vendor look.
 *
 * ⚠️ What this cannot see:
 *   - A class that is referenced but whose element never renders (a branch
 *     that is always false). That is a TSX question, not a CSS one.
 *   - A class defined in two files where import order decides the winner
 *     (`.encounters-note` was). Both copies are "referenced". A separate rule
 *     would be needed to forbid the duplicate definition.
 *   - A class referenced only in a test. Tests are excluded from the blob
 *     deliberately: a test asserting on a class does not render it.
 *   - A class named only in a TS comment: also excluded (comments are
 *     blanked before the scan), for the same reason.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { allStyleFiles, relRepo, styleRootFloors, WEB_ROOT as webRoot } from './lib/style-roots.mjs'
import { reportFloors } from '../../scripts/lib/floors.mjs'

const indexHtml = join(webRoot, 'index.html')
// The renderer's theme, which defines every class the renderer emits.
const vendorThemeCss = join(webRoot, 'node_modules', '@formbox', 'hs-theme', 'dist', 'index.css')

// A scan that finds nothing passes vacuously; these are the smallest inputs a
// real run has had, rounded well down. If one trips, the scan is broken.
const FLOOR_CSS_FILES = 10
const FLOOR_CLASSES = 300
const FLOOR_TS_FILES = 40

const rel = relRepo

/** Blank a span while preserving every newline, so line numbers stay true. */
const blank = (s) => s.replace(/[^\n]/g, ' ')

/**
 * Reduce a stylesheet to its SELECTOR text: comments blanked, every
 * declaration block `{ … }` blanked (one pass — declaration blocks never
 * contain braces, and one pass keeps the selectors inside `@media` blocks),
 * quoted strings blanked (an attribute selector like `[href$=".pdf"]` would
 * otherwise read as a class). Positions are preserved throughout.
 */
const selectorText = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\{[^{}]*\}/g, (m) => `{${blank(m.slice(1, -1))}}`)
    .replace(/"[^"\n]*"|'[^'\n]*'/g, blank)

// ---- selectors: every class in selector position, with its first site --------
const cssFiles = allStyleFiles(['.css'])
const sites = new Map() // class -> [{ file, line }]
for (const file of cssFiles) {
  const text = selectorText(readFileSync(file, 'utf8'))
  for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    const line = text.slice(0, m.index).split('\n').length
    if (!sites.has(m[1])) sites.set(m[1], [])
    sites.get(m[1]).push({ file: rel(file), line })
  }
}

// ---- references: source that can put a class on an element -------------------
const tsFiles = allStyleFiles(['.ts', '.tsx']).filter((f) => !/\.test\.tsx?$/.test(f))
/**
 * Comments are not references. A class named in a TS doc comment ("see
 * .risk-pill") kept `.risk-pill` alive in a `:has()` selector for a whole
 * commit after the component stopped rendering it. Block comments and
 * whole-line `//` comments are blanked; a trailing `// …` after code is left
 * alone so a `'https://…'` string literal is never mistaken for one.
 */
const stripTsComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank)
let blob = tsFiles.map((f) => stripTsComments(readFileSync(f, 'utf8'))).join('\n')
if (existsSync(indexHtml)) blob += '\n' + readFileSync(indexHtml, 'utf8')

if (!existsSync(vendorThemeCss)) {
  console.error(`✗ renderer theme not found at ${rel(vendorThemeCss)} — run npm install; the formbox overrides cannot be checked without it`)
  process.exit(1)
}
const vendorClasses = new Set(
  [...selectorText(readFileSync(vendorThemeCss, 'utf8')).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]),
)

console.log(
  `css-dead: ${sites.size} distinct class selector(s) in ${cssFiles.length} stylesheet(s); ` +
  `references read from ${tsFiles.length} source file(s)` +
  `${existsSync(indexHtml) ? ' + index.html' : ''}; ` +
  `${vendorClasses.size} renderer class(es) scraped from ${rel(vendorThemeCss)}`,
)

if (cssFiles.length < FLOOR_CSS_FILES) { console.error(`✗ only ${cssFiles.length} stylesheet(s) found (floor ${FLOOR_CSS_FILES}) — the scan is broken, not clean`); process.exit(1) }
if (sites.size < FLOOR_CLASSES) { console.error(`✗ only ${sites.size} class selector(s) parsed (floor ${FLOOR_CLASSES}) — the scan is broken, not clean`); process.exit(1) }
if (tsFiles.length < FLOOR_TS_FILES) { console.error(`✗ only ${tsFiles.length} source file(s) found (floor ${FLOOR_TS_FILES}) — the scan is broken, not clean`); process.exit(1) }
if (vendorClasses.size === 0) { console.error('✗ no classes parsed from the renderer theme — the scan is broken, not clean'); process.exit(1) }

// ---- the check ---------------------------------------------------------------
// A reference is the name bounded on both sides by something that cannot be
// part of a class name — a quote, a space, a backtick, `${`. Plain
// `includes()` would let `.encounter-card` pass as live on the strength of
// `encounter-card-divider`, and `.tool-card` on `stage-tool-card`, which is
// exactly how the audit's two largest dead families had hidden.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
const bounded = (needle) => new RegExp(`(^|[^\\w-])${escapeRe(needle)}(?![\\w-])`).test(blob)
// Every modifier the source BUILDS: the literal prefix of a template that
// runs from a class root through its `--` seam up to the first `${`. That is
// `pill--` for `` `pill--${level}` `` and `rubric-select--level-` for
// `` `rubric-select--level-${n}` ``. A class is live if it extends one of
// these prefixes. Collected once, from the source, so the exemption cannot
// outlive the template that earns it.
const builtPrefixes = [...blob.matchAll(/(?:^|[^\w-])([A-Za-z_][\w-]*--[\w-]*)\$\{/g)].map((m) => m[1])
const isLive = (name) => {
  if (bounded(name)) return true
  if (name.includes('--') && builtPrefixes.some((p) => name.startsWith(p))) return true
  return vendorClasses.has(name)
}

const dead = new Map() // file -> [{ line, name }]
let deadCount = 0
for (const [name, where] of sites) {
  if (isLive(name)) continue
  deadCount++
  for (const { file, line } of where) {
    if (!dead.has(file)) dead.set(file, [])
    dead.get(file).push({ line, name })
  }
}

let floorFailures = 0
const fail = (m) => { console.error(`✗ ${m}`); floorFailures++ }
// ⚠️ **Per ROOT, not a total.** The global floors above were what this gate had
// when `packages/ui` was carved out of `web/src` on 2026-09-19, and 31
// stylesheets cleared them comfortably while NINE were missing — the gate
// reported ✓ over three-quarters of the CSS, and `check:template` did the same.
// Only a per-root floor can see a whole tree stop being read, which is exactly
// what a package extraction produces. Same rule as scripts/lib/floors.mjs.
reportFloors(styleRootFloors({ css: true, src: true }), fail)

if (floorFailures) {
  console.error(`\ncss-dead check FAILED (${floorFailures} coverage floor(s) breached).`)
  process.exit(1)
}

if (deadCount) {
  for (const [file, list] of [...dead].sort()) {
    const names = new Set(list.map((d) => d.name))
    console.error(`\n✗ ${file}: ${names.size} class selector(s) referenced by nothing`)
    for (const { line, name } of list.sort((a, b) => a.line - b.line)) console.error(`    ${file}:${line}  .${name}`)
  }
  console.error(`\ncss-dead check FAILED (${deadCount} dead class selector(s)).`)
  console.error('Delete the rule, or reference the class from the component that should own it.')
  console.error('A class built at runtime is recognised only as a `root--…${…}` template — the literal prefix through the `--` seam.')
  process.exit(1)
}
console.log('\ncss-dead check passed.')
