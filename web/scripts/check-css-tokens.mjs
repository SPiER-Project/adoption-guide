#!/usr/bin/env node
/**
 * Anti-drift check for DESIGN TOKEN REFERENCES in the app's stylesheets.
 *
 * `lint:css` enforces that every colour / size / shadow declaration uses a
 * token — `scale-unlimited/declaration-strict-value` with `/^var\(--/` in
 * `ignoreValues`. It does not, and cannot, check that the token *exists*:
 * anything spelled `var(--…)` satisfies the rule. So `color:
 * var(--totally-made-up)` passes `lint:css`, passes `tsc`, and ships. The
 * browser drops the invalid value, which usually reads as an inherited colour
 * rather than as an error — the failure is silent at every stage (issue #280,
 * found while building the Stage 5-8 dictionary rows: `--border-subtle` and
 * `--surface-raised` were both reached for, neither exists, `lint:css` was
 * green).
 *
 * `src/index.css` is in stylelint's `ignoreFiles` (it is where raw values are
 * allowed to live), so the definitions file itself is not linted at all. This
 * check reads it, and checks its internal `var()` uses too.
 *
 * What counts as a definition:
 *   1. A custom-property declaration in any `.css` file under `src` — not just
 *      the `:root` block, because tokens are also defined inside media queries
 *      and `[data-theme]` overrides. By convention they all live in
 *      `src/index.css`; this check does not enforce that, it only resolves
 *      references.
 *   2. A property set from TypeScript at runtime. `--patient-banner-height` is
 *      published by `components/PatientBanner.tsx` via
 *      `documentElement.style.setProperty` and deliberately has no CSS
 *      definition. Those are SCRAPED from the source rather than allowlisted
 *      here, so the exemption cannot outlive the code that earns it.
 *
 * A use with a fallback — `var(--x, 1rem)` — FAILS like any other if `--x` is
 * undefined. That is a deliberate call: the fallback keeps the page rendering,
 * which is exactly what makes a typo invisible, and every reference in this
 * repo that is intentionally undefined in CSS is set from TypeScript and so is
 * already covered by rule 2 above. The failure message says when a fallback is
 * present, because that changes how the bug looks in a browser, not whether it
 * is one. The nested token in `var(--a, var(--b))` is checked as well.
 *
 * Not checked, deliberately: tokens that are defined but never used. 116
 * defined vs 112 used on main is not a defect — an unused token may be a
 * deliberate palette entry. Failing the build on those is a separate decision
 * nobody has made.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const srcDir = join(webRoot, 'src')
const tokenFile = join(srcDir, 'index.css')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

/**
 * Blank out `/* … *\/` comments while preserving every newline and column, so
 * reported line numbers stay true. Commented-out CSS is not live CSS: a
 * `var(--retired-token)` inside a comment must not fail the gate, and prose
 * inside a comment must not register as a definition.
 */
const stripComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const walk = (dir, ext) => {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, ext))
    else if (ext.some((e) => entry.endsWith(e))) out.push(full)
  }
  return out
}

const rel = (p) => relative(webRoot, p)

// ---- definitions: custom properties declared in CSS ---------------------------
const cssFiles = walk(srcDir, ['.css'])
if (!cssFiles.includes(tokenFile)) {
  // The scan is keyed on this file existing where it is expected. If it moves,
  // every token would read as undefined — but a rename that also moved the
  // uses would leave the check quietly passing over nothing.
  console.error(`✗ token definitions file not found: ${rel(tokenFile)}`)
  process.exit(1)
}

const defined = new Map() // token -> Set of files defining it
for (const file of cssFiles) {
  const css = stripComments(readFileSync(file, 'utf8'))
  for (const m of css.matchAll(/(?:^|[;{])\s*(--[A-Za-z0-9_-]+)\s*:/gm)) {
    if (!defined.has(m[1])) defined.set(m[1], new Set())
    defined.get(m[1]).add(rel(file))
  }
}

// ---- definitions: custom properties set from TypeScript at runtime ------------
// Matched over whole-file text rather than per line, because the call is often
// wrapped across lines by the formatter.
const tsFiles = walk(srcDir, ['.ts', '.tsx'])
const runtimeSet = new Map() // token -> Set of files setting it
for (const file of tsFiles) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)/g)) {
    if (!runtimeSet.has(m[1])) runtimeSet.set(m[1], new Set())
    runtimeSet.get(m[1]).add(rel(file))
  }
}

// ---- uses: every var() reference in every stylesheet -------------------------
const uses = new Map() // token -> [{ file, line, hasFallback }]
let useCount = 0
for (const file of cssFiles) {
  const css = stripComments(readFileSync(file, 'utf8'))
  for (const m of css.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,?)/g)) {
    const line = css.slice(0, m.index).split('\n').length
    if (!uses.has(m[1])) uses.set(m[1], [])
    uses.get(m[1]).push({ file: rel(file), line, hasFallback: m[2] === ',' })
    useCount++
  }
}

console.log(
  `tokens: ${defined.size} defined in ${cssFiles.length} stylesheet(s), ` +
  `${runtimeSet.size} set from TypeScript, ` +
  `${uses.size} distinct referenced (${useCount} reference(s))`,
)
for (const [token, files] of [...runtimeSet].sort()) {
  console.log(`  runtime-set: ${token} (${[...files].join(', ')})`)
}

// A scan that finds nothing passes vacuously. Both halves have to have found
// something for a green result to mean anything.
if (defined.size === 0) {
  console.error(`✗ no token definitions parsed from ${cssFiles.length} stylesheet(s) — the scan is broken, not clean`)
  process.exit(1)
}
if (uses.size === 0) {
  console.error('✗ no var() references parsed — the scan is broken, not clean')
  process.exit(1)
}

// ---- the check ---------------------------------------------------------------
for (const [token, sites] of [...uses].sort()) {
  if (defined.has(token) || runtimeSet.has(token)) continue
  const where = sites
    .map((s) => `${s.file}:${s.line}${s.hasFallback ? ' (has a fallback — renders, but the token is still undefined)' : ''}`)
    .join('\n    ')
  fail(`var(${token}) is not defined in any stylesheet and is not set from TypeScript:\n    ${where}`)
}

if (failures) {
  console.error(`\ncss-token check FAILED (${failures} undefined token(s)).`)
  console.error('Define the token in web/src/index.css, or fix the reference to an existing one.')
  process.exit(1)
}
console.log('\ncss-token check passed.')
