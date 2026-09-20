#!/usr/bin/env node
/**
 * No function is defined twice.
 *
 * The 2026-09-20 audit found `displayFor` byte-identical in FOUR modules,
 * `stageTag` in FIVE (four identical and one that had drifted — a hand-typed
 * display where the others read a constant), `effectiveOf` in two (one reading
 * `effectivePeriod.start`, one not), `toggle` in two views and `InclusionBadge`
 * in both apps. None of it was found by a tool: each stage's builders were
 * written in their own PR and copied the neighbour's helpers, and nothing read
 * across files. This does.
 *
 * RULES
 *   1. A function NAME defined in two or more non-test source files with the
 *      same normalized body (comments and whitespace removed, parameters
 *      included) fails. That is the exact shape the audit found: a helper
 *      copied whole, name and all.
 *   2. A normalized body of at least MIN_BODY_LINES lines that appears under
 *      DIFFERENT names in two or more files fails too — a copy that was renamed
 *      is still a copy. Short bodies are exempt from this rule only: a one-line
 *      `return x?.y` legitimately recurs under many names.
 *   3. Deliberate pairs are named in ALLOWED with the reason — never a count.
 *      The two `describeError`s (app-shell and writeback) are the model: same
 *      name, DIFFERENT bodies on purpose, documented in each; they do not fire
 *      rule 1 because the bodies differ, and are listed here so the next reader
 *      knows the difference is intended.
 *   4. FLOOR: at least MIN_FUNCTIONS functions parsed across at least MIN_FILES
 *      files, with at least one from each of apps/, packages/ and services/. A
 *      parser that reads nothing must not report ✓.
 *
 * What it cannot see: a copy whose body was edited after copying (that is a
 * fork, and only a reader can tell a fork from a variant); a copied fragment
 * inside a larger function; and a duplicated *arrow* assigned to a property
 * rather than a top-level binding. Top-level `function` declarations and
 * top-level `const name = (…) => {…}` are what it parses.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIN_BODY_LINES = 5
const MIN_FUNCTIONS = 300
const MIN_FILES = 120

/** `name` → reason a same-named function may exist in more than one file. */
const ALLOWED = new Map(Object.entries({
  describeError: 'app-shell/lib/describeError.ts and core/lib/writeback/execute.ts differ ON PURPOSE (banner vs scorecard rendering) and each says so; listed so nobody "fixes" it',
  Sidebar: 'apps/guide and apps/clinical each own their chrome since the apps/ split (#552); the two Sidebars are different components that share a name',
  AppRoutes: 'one route table per app, by design — see docs/internals/surfaces-and-routing.md',
}))

const failures = []
const fail = (m) => failures.push(m)

// Every non-test source module under an app, package or service `src/`.
// ⚠️ A `git ls-files` GLOB was tried first and silently skipped the top-level
// files of each `src/` (`App.tsx`, `index.ts`): git's `**` needs `:(glob)`
// magic, and without it `src/**/*.tsx` demands a subdirectory. A regex over
// the whole tracked list has no such edge, and the rule-4 floor is what would
// have caught the next edge of this kind.
const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).trim().split('\n')
  .filter((f) => /^(apps|packages|services)\/[^/]+\/src\/.*\.tsx?$/.test(f))
  .filter((f) => !/\.test\.tsx?$|\.d\.ts$|__fixtures__\/|\/dist\//.test(f))

const normalize = (s) => s.replace(/\s+/g, ' ').trim()

/**
 * Remove line and block comments, reading the file as a scanner so that a
 * comment opener inside a string is left alone. (This docblock cannot spell
 * the block-comment terminator, for the obvious reason.)
 *
 * ⚠️ The first version was two regexes, and the `/patient/` wildcard Route
 * path in both App.tsx files — slash, star, quote — opened a "block comment"
 * that ran to the next real terminator and deleted every function head in
 * between. The same trap is on record
 * for `check:eager-forms`, whose first version stripped comments the same way
 * and walked 104 modules while missing the one import it policed. Strings end
 * at a newline here on purpose: a `"` in JSX prose (`the "guide" page`) then
 * costs at most the rest of its line, not the rest of the file.
 */
function stripComments(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; continue }
    if (ch === '/' && next === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; continue }
    if (opensString(text, i)) {
      const q = ch
      out += ch
      i++
      while (i < text.length && text[i] !== q) {
        if (text[i] === '\\') { out += text[i] + (text[i + 1] ?? ''); i += 2; continue }
        if (q !== '`' && text[i] === '\n') break
        out += text[i]
        i++
      }
      if (i < text.length && text[i] === q) { out += q; i++ }
      continue
    }
    out += ch
    i++
  }
  return out
}

/**
 * Does the character at `i` open a string? A quote right after a word character
 * is an apostrophe in JSX text (`SPiER's`, `don't`), not a delimiter. ⚠️ Without
 * this both `App.tsx` files failed to parse at all — their JSX prose swallowed
 * the rest of the file as one "string" — and the two route tables silently left
 * the scan, which the ALLOWED-entry liveness check was the first to notice.
 */
function opensString(text, i) {
  const ch = text[i]
  if (ch === '`') return true
  if (ch !== '"' && ch !== "'") return false
  return !/[A-Za-z0-9_)\]]/.test(text[i - 1] ?? '')
}

/** Index of the `}` matching the `{` at `open`, respecting strings and template literals. */
function matchBrace(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (opensString(text, i)) {
      const q = ch
      i++
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; else if (q !== '`' && text[i] === '\n') break; if (q === '`' && text[i] === '$' && text[i + 1] === '{') { i = matchBrace(text, i + 1) } i++ }
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

/** Index of the `)` matching the `(` at `open`, skipping nested brackets and strings. */
function matchParen(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (opensString(text, i)) { const q = ch; i++; while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; else if (q !== '`' && text[i] === '\n') break; i++ } continue }
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') { depth--; if (depth === 0) return i }
  }
  return -1
}

const HEAD = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*(<[^>\n]*>)?\s*\(|^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=>\n]+)?=>\s*\{/gm

const byName = new Map()   // name -> [{file, body}]
const byBody = new Map()   // body -> [{file, name}]
let parsed = 0
const filesWithFns = new Set()
const areas = new Set()

for (const f of files) {
  const text = stripComments(readFileSync(resolve(root, f), 'utf8'))
  for (const m of text.matchAll(HEAD)) {
    const name = m[1] ?? m[3]
    const paramsStart = m.index + m[0].indexOf('(')
    let open
    if (m[0].endsWith('{')) {
      open = m.index + m[0].length - 1 // an arrow: HEAD consumed through `=> {`
    } else {
      // A declaration: `function f({ a, b }: P): R {` — the first `{` after the
      // head is the destructuring pattern, not the body. Match the parameter
      // list's parentheses first, then take the first `{` after `)`. ⚠️ The
      // first version did not, and reported the two apps' Sidebars (239 and
      // 73 lines) as byte-identical because both begin `({ isOpen, onClose }`.
      const paramsEnd = matchParen(text, paramsStart)
      if (paramsEnd < 0) continue
      open = text.indexOf('{', paramsEnd)
    }
    if (open < 0) continue
    const close = matchBrace(text, open)
    if (process.env.DUPES_DEBUG && f.includes(process.env.DUPES_DEBUG)) console.error(`[dupes] ${f}: ${name} params@${paramsStart} open@${open} close@${close}`)
    if (close < 0) continue
    const body = normalize(text.slice(paramsStart, close + 1))
    const lines = text.slice(open, close + 1).split('\n').filter((l) => l.trim()).length
    parsed++
    filesWithFns.add(f)
    areas.add(f.split('/')[0])
    ;(byName.get(name) ?? byName.set(name, []).get(name)).push({ file: f, body, lines })
    ;(byBody.get(body) ?? byBody.set(body, []).get(body)).push({ file: f, name, lines })
  }
}

// Rule 1 — same name, same body, different files
for (const [name, defs] of byName) {
  const groups = new Map()
  for (const d of defs) (groups.get(d.body) ?? groups.set(d.body, new Set()).get(d.body)).add(d.file)
  for (const [, filesFor] of groups) {
    if (filesFor.size < 2) continue
    if (ALLOWED.has(name)) continue
    fail(`\`${name}\` is defined identically in ${filesFor.size} files — define it once and import it:\n      ${[...filesFor].join('\n      ')}`)
  }
  // an ALLOWED name whose bodies are now identical no longer needs the entry
  if (ALLOWED.has(name) && groups.size === 1 && defs.length > 1) {
    fail(`ALLOWED names \`${name}\` as a deliberate same-name pair, but its ${defs.length} definitions are now byte-identical — merge them, and delete the entry`)
  }
}
// an ALLOWED name that no longer exists twice is a stale entry
for (const [name] of ALLOWED) {
  const defs = byName.get(name) ?? []
  if (new Set(defs.map((d) => d.file)).size < 2) fail(`ALLOWED entry \`${name}\` no longer names a function defined in two files — delete it`)
}

// Rule 2 — same body under different names
for (const [, defs] of byBody) {
  const filesFor = new Set(defs.map((d) => d.file))
  const names = new Set(defs.map((d) => d.name))
  if (filesFor.size < 2 || names.size < 2) continue
  if (defs[0].lines < MIN_BODY_LINES) continue
  fail(`the same ${defs[0].lines}-line body is defined under different names (${[...names].join(', ')}) in:\n      ${defs.map((d) => `${d.file} (${d.name})`).join('\n      ')}`)
}

// Rule 4 — floor
if (parsed < MIN_FUNCTIONS) fail(`parsed only ${parsed} functions (floor ${MIN_FUNCTIONS}) — the parser or the file list is broken, not the code`)
if (filesWithFns.size < MIN_FILES) fail(`functions found in only ${filesWithFns.size} files (floor ${MIN_FILES})`)
for (const a of ['apps', 'packages', 'services']) if (!areas.has(a)) fail(`no function parsed under ${a}/ — the scan is not reaching it`)

const summary = `check-duplicate-code: ${parsed} functions in ${filesWithFns.size} files, ${byName.size} distinct names, ${ALLOWED.size} deliberate pairs`
if (failures.length) {
  console.error(`✗ ${summary}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ ${summary} — no function is defined twice`)
