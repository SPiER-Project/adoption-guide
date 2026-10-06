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
 *      same normalized body fails. That is the exact shape the audit found: a
 *      helper copied whole, name and all.
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
 * "Normalized" means read by the TypeScript parser and scanner: comments and
 * whitespace are trivia, and every name the function BINDS itself — its
 * parameters and its locals — is renamed to its position (`$0`, `$1`, …).
 * ⚠️ The first version compared text, so renaming one parameter defeated rule
 * 2 (`unreachedStreak(communications)` copied as `countUnreached(comms)` passed,
 * 2026-10-06). Names the function does not bind — a property, an import, a
 * global — are kept, so `a.find(x)` and `a.filter(x)` stay different.
 *
 * What it parses: every top-level `function` declaration and every top-level
 * `const name = …` whose value is an arrow or function expression — block body
 * OR expression body. ⚠️ The regex version required `=> {`, so an identical
 * `const f = (x) => x.y` in two files passed.
 *
 * Files are the TRACKED tree plus untracked files git does not ignore, so a
 * copy in a file not yet `git add`ed is seen locally, not first in CI.
 *
 * Scope is `{apps,packages,services}/<name>/src`. `scripts/` is NOT scanned:
 * it holds live copies (`walkExt`, `relRepo` and `REPO_ROOT` in both
 * `lib/app-roots.mjs` and `lib/style-roots.mjs`; `walkJson` in two gates) whose
 * consolidation is its own change.
 *
 * What it cannot see: a copy whose body was edited after copying (that is a
 * fork, and only a reader can tell a fork from a variant); a copied fragment
 * inside a larger function; a method or an arrow assigned to a property.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

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
// the whole list has no such edge, and the rule-4 floor is what would have
// caught the next edge of this kind.
const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: root, encoding: 'utf8' })
  .trim().split('\n')
  .filter((f) => /^(apps|packages|services)\/[^/]+\/src\/.*\.tsx?$/.test(f))
  .filter((f) => !/\.test\.tsx?$|\.d\.ts$|__fixtures__\/|\/dist\//.test(f))

/** Every name `fn` binds itself: parameters, locals, nested function names, catch variables. */
function boundNames(fn) {
  const names = new Set()
  const add = (n) => {
    if (!n) return
    if (ts.isIdentifier(n)) names.add(n.text)
    else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) {
      for (const el of n.elements) if (!ts.isOmittedExpression(el)) add(el.name)
    }
  }
  const visit = (node) => {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isBindingElement(node) ||
        (ts.isFunctionDeclaration(node) && node !== fn)) {
      add(node.name)
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(fn, visit)
  return names
}

/** Is this identifier a NAME position (a property or key), not a reference? */
function isPropertyName(id) {
  const p = id.parent
  return (
    (ts.isPropertyAccessExpression(p) && p.name === id) ||
    ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) ||
      ts.isPropertyDeclaration(p) || ts.isJsxAttribute(p)) && p.name === id) ||
    (ts.isBindingElement(p) && p.propertyName === id) ||
    ts.isQualifiedName(p)
  )
}

/**
 * The function's parameters and body as one canonical string: tokens only, and
 * every bound name replaced by the order it first appears in.
 */
function canonical(fn, sf, text) {
  const bound = boundNames(fn)
  const rename = new Map()  // start offset → canonical name
  const order = new Map()   // bound name → $n
  const visit = (node) => {
    if (ts.isIdentifier(node) && bound.has(node.text) && !isPropertyName(node)) {
      if (!order.has(node.text)) order.set(node.text, `$${order.size}`)
      rename.set(node.getStart(sf), order.get(node.text))
    }
    ts.forEachChild(node, visit)
  }
  // The name of the function itself is not part of its body.
  for (const p of fn.parameters) visit(p)
  if (fn.type) visit(fn.type)
  if (fn.body) visit(fn.body)

  const start = fn.parameters.pos
  const end = fn.end
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, sf.languageVariant, text)
  scanner.setTextPos(start)
  const out = []
  for (let tok = scanner.scan(); tok !== ts.SyntaxKind.EndOfFileToken && scanner.getTokenStart() < end; tok = scanner.scan()) {
    const at = scanner.getTokenStart()
    if (tok === ts.SyntaxKind.Identifier && rename.has(at)) out.push(rename.get(at))
    else out.push(scanner.getTokenText())
  }
  return out.join(' ')
}

/** Every top-level function in one file: `{ name, fn }`. */
function topLevelFunctions(sf) {
  const out = []
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) out.push({ name: st.name.text, fn: st })
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const init = d.initializer
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          out.push({ name: d.name.text, fn: init })
        }
      }
    }
  }
  return out
}

const byName = new Map()   // name -> [{file, body}]
const byBody = new Map()   // body -> [{file, name}]
let parsed = 0
const filesWithFns = new Set()
const areas = new Set()

for (const f of files) {
  let text
  try { text = readFileSync(resolve(root, f), 'utf8') } catch { continue } // deleted but not yet staged
  const kind = f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, kind)
  for (const { name, fn } of topLevelFunctions(sf)) {
    const body = canonical(fn, sf, text)
    const lines = fn.body.getText(sf).split('\n').filter((l) => l.trim()).length
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
    fail(`ALLOWED names \`${name}\` as a deliberate same-name pair, but its ${defs.length} definitions are now identical — merge them, and delete the entry`)
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
