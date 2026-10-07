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
 *      The per-app `Sidebar`s are the model: same name, different components
 *      on purpose; listed here so the next reader knows the pairing is
 *      intended. (The two `describeError`s were the first model; app-shell's
 *      went on 2026-10-07, when the launch pages stopped printing it.)
 *   4. FLOOR: at least MIN_FUNCTIONS functions parsed across at least MIN_FILES
 *      files, with at least one from each of apps/, packages/, services/ and
 *      scripts/. A parser that reads nothing must not report ✓.
 *   5. A gate's own ENTRY file (`scripts/*.mjs`, not `scripts/lib/`) may define a
 *      function that WRITES that file's top-level state — the `fail` that pushes
 *      onto, or increments, its own failure count. Forty scripts had one, many
 *      byte-identical, and "define it once and import it" cannot apply to a
 *      closure over your own module. Everywhere else a stateful copy (a memoised
 *      loader, a cache) IS importable, so it is still compared. The skipped
 *      count is printed.
 *
 * "Normalized" means read by the TypeScript parser and scanner: comments and
 * whitespace are trivia, and every name the function BINDS itself — its
 * parameters and its locals — is renamed to its position (`$0`, `$1`, …).
 * ⚠️ The first version compared text, so renaming one parameter defeated rule
 * 2 (`unreachedStreak(communications)` copied as `countUnreached(comms)` passed,
 * 2026-10-06). Names the function does not bind — a property, an import, a
 * global — are kept, so `a.find(x)` and `a.filter(x)` stay different.
 * A recursive call to the function's own name becomes `$self`, so a renamed
 * copy of a recursive walker is still the same body.
 *
 * What it parses: every top-level `function` declaration and every top-level
 * `const name = …` whose value is an arrow or function expression — block body
 * OR expression body. ⚠️ The regex version required `=> {`, so an identical
 * `const f = (x) => x.y` in two files passed.
 *
 * Files are the TRACKED tree plus untracked files git does not ignore, so a
 * copy in a file not yet `git add`ed is seen locally, not first in CI.
 *
 * Scope is `{apps,packages,services}/<name>/src` and, since 2026-10-07,
 * `scripts/` (`.mjs` / `.js`). Bringing `scripts/` in found 14 copied helpers —
 * `walkExt` / `relRepo` / `REPO_ROOT` in both root libs, `walkJson`,
 * `stripComments`, `stripVersion`, `argValue`, a `rel` in six gates — now in
 * `lib/repo.mjs`, `lib/text.mjs` and `lib/cli.mjs`.
 *
 * ⚠️ It also found two holes in the tokenizer below, both closed the same day.
 * The scanner has no parse context, so (a) a regex was read as code, and the
 * `\//` ending `/\/\*…\*\//g` opened a LINE COMMENT that hid the rest of the
 * line — two different comment strippers compared EQUAL; and (b) after a
 * template literal's first `${…}` the closing backtick opened a NEW template that
 * ran past the function into the rest of the file — so two IDENTICAL functions
 * holding `\`✗ ${msg}\`` compared different, and thirteen byte-identical copies
 * passed. Literals are now taken whole from the AST.
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
  .filter((f) => /^(apps|packages|services)\/[^/]+\/src\/.*\.tsx?$/.test(f) || /^scripts\/.*\.m?js$/.test(f))
  .filter((f) => !/\.test\.(tsx?|mjs)$|\.d\.ts$|__fixtures__\/|\/dist\//.test(f))

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
function canonical(fn, sf, text, selfName) {
  const bound = boundNames(fn)
  const rename = new Map()  // start offset → canonical name
  const order = new Map()   // bound name → $n
  // ⚠️ Literals the raw scanner cannot read on its own: it has no parse context,
  // so a regex is a `/` token followed by its body read as code — and the `\//`
  // that ends `/\/\*…\*\//g` opens a LINE COMMENT, hiding the rest of the line.
  // Two different one-line comment strippers compared equal that way (2026-10-07).
  // The same goes for a template literal's text after its first `${`. Each such
  // literal is taken whole from the AST instead: start offset → its end.
  const literals = new Map()
  const visit = (node) => {
    if (ts.isIdentifier(node) && bound.has(node.text) && !isPropertyName(node)) {
      if (!order.has(node.text)) order.set(node.text, `$${order.size}`)
      rename.set(node.getStart(sf), order.get(node.text))
    } else if (ts.isIdentifier(node) && node.text === selfName && !isPropertyName(node)) {
      // A recursive call names the function itself: a renamed copy of a
      // recursive walker differed only there, and passed rule 2 (2026-10-07).
      rename.set(node.getStart(sf), '$self')
    }
    if (ts.isRegularExpressionLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      literals.set(node.getStart(sf), node.end)
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
    if (literals.has(at)) {
      out.push(text.slice(at, literals.get(at)))
      scanner.setTextPos(literals.get(at))
    } else if (tok === ts.SyntaxKind.Identifier && rename.has(at)) out.push(rename.get(at))
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

/** Every name declared at the top level of `sf` (variables, functions, classes). */
function topLevelNames(sf) {
  const names = new Set()
  const add = (n) => {
    if (!n) return
    if (ts.isIdentifier(n)) names.add(n.text)
    else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) {
      for (const el of n.elements) if (!ts.isOmittedExpression(el)) add(el.name)
    }
  }
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) add(d.name)
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) add(st.name)
  }
  return names
}

const MUTATORS = new Set(['push', 'unshift', 'splice', 'set', 'add', 'delete', 'clear'])
const ASSIGNMENTS = new Set([
  ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken,
])

/**
 * Does `fn` WRITE a binding its own file declares at the top level — assign
 * it, increment it, or push / set / add onto it? Such a function is that
 * file's state, not a helper: two files' `fail = (m) => failures.push(m)` are
 * identical text over two different arrays, and the gate's remedy, "define it
 * once and import it", is not available for a closure over your own module.
 * A function that only READS module state is still compared, and the skip
 * applies to a gate's entry file only (see its call site).
 */
function writesModuleState(fn, topNames) {
  const bound = boundNames(fn)
  const isModuleBinding = (e) => ts.isIdentifier(e) && topNames.has(e.text) && !bound.has(e.text)
  let writes = false
  const visit = (node) => {
    if (writes) return
    if (ts.isBinaryExpression(node) && ASSIGNMENTS.has(node.operatorToken.kind) && isModuleBinding(node.left)) writes = true
    else if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
             (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
             isModuleBinding(node.operand)) writes = true
    else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
             MUTATORS.has(node.expression.name.text) && isModuleBinding(node.expression.expression)) writes = true
    else ts.forEachChild(node, visit)
  }
  if (fn.body) visit(fn.body)
  return writes
}

const byName = new Map()   // name -> [{file, body}]
const byBody = new Map()   // body -> [{file, name}]
let parsed = 0
let stateWriters = 0 // skipped: they write their own file's top-level state
const filesWithFns = new Set()
const areas = new Set()

for (const f of files) {
  let text
  try { text = readFileSync(resolve(root, f), 'utf8') } catch { continue } // deleted but not yet staged
  const kind = f.endsWith('.tsx') ? ts.ScriptKind.TSX : /\.m?js$/.test(f) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, kind)
  const topNames = topLevelNames(sf)
  // Only a gate's own entry file: each is its own process, so its failure
  // counter is its own. A stateful helper in scripts/lib or any src/ tree (a
  // memoised loader, a cache) IS importable, and stays compared.
  const isScriptEntry = /^scripts\/[^/]+\.m?js$/.test(f)
  for (const { name, fn } of topLevelFunctions(sf)) {
    if (isScriptEntry && writesModuleState(fn, topNames)) { stateWriters++; continue }
    const body = canonical(fn, sf, text, name)
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
for (const a of ['apps', 'packages', 'services', 'scripts']) if (!areas.has(a)) fail(`no function parsed under ${a}/ — the scan is not reaching it`)

const summary = `check-duplicate-code: ${parsed} functions in ${filesWithFns.size} files, ${byName.size} distinct names, ${ALLOWED.size} deliberate pairs, ${stateWriters} module-state writers skipped`
if (failures.length) {
  console.error(`✗ ${summary}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ ${summary} — no function is defined twice`)
