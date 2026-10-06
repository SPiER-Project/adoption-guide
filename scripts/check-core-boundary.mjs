#!/usr/bin/env node
/**
 * packages/core must stay React-free and DOM-free.
 *
 * This is the constraint that makes the boundary worth drawing at all. §4 of
 * docs/plans/repo-and-package-boundaries.md: the point of declaring `core` is
 * that its independence from the app becomes *enforceable* rather than merely
 * true today — two Workers and (eventually) other consumers import it, and none
 * of them has a `window`.
 *
 * Why a drift-check rather than an eslint rule: this predates the tooling
 * hoist, when `eslint .` ran from `web/` and could not see `packages/`. ESLint
 * now runs from the repo root over `packages/core` too, so a scoped
 * `no-restricted-globals` / `no-restricted-imports` block is the natural
 * successor — and the stronger one is the type system: core's tsconfig still
 * includes the DOM lib (a follow-up; see docs/internals/web-gates.md).
 *
 * RULES
 *   1. No `.tsx` in core — a component belongs in an app.
 *   2. No import of a React package: `react` and every `react/…` subpath
 *      (`react/jsx-runtime`), `react-dom`, `react-router(-dom)`, and the repo's
 *      own React packages — `@spier/ui`, `@spier/app-shell`, `@spier/tool-views`
 *      — by alias OR by a relative path into them, or into `apps/`.
 *   3. No touch of a DOM global (`window`, `document`, `localStorage`, …),
 *      bare or through a host object — `globalThis.localStorage`,
 *      `self.document`, `window.navigator`, `globalThis['localStorage']`.
 *      ⚠️ The first version skipped any match preceded by a dot (so
 *      `opts.window` was not a use), which exempted `globalThis.X` by
 *      construction; planted green on 2026-10-06.
 *   4. A FEATURE-DETECTED use is allowed, and the waiver is PER USE: a use
 *      passes when `typeof X === 'undefined'` (or `!==`) appears in the same
 *      enclosing function, or — at module scope — the same statement. The first
 *      version waived every use of X in the whole FILE once a guard appeared
 *      anywhere in it, so an unguarded `new BroadcastChannel(…)` beside
 *      `fhircast.ts`'s guarded one passed.
 *
 * The scan is the TypeScript parser over each file: comments and strings are
 * not code, property names (`opts.window`) and declarations of a local with a
 * DOM name are not uses, and type positions (`InstanceType<typeof X>`) erase.
 *
 * ⚠️ **What it cannot see**: a DOM global reached through an alias it did not
 * write (`const g = globalThis; g.localStorage`), and DOM types in signatures
 * (they erase). Removing `DOM` from core's `lib` would close both.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { reportFloors } from './lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const coreSrc = join(root, 'packages/core/src')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

// Bare module specifiers core may not depend on, and the DOM globals it may not
// touch. Both lists are deliberately short: this gate answers one question.
const FORBIDDEN_MODULES = [
  /^react(\/.*)?$/,
  /^react-dom(\/.*)?$/,
  /^react-router(-dom)?(\/.*)?$/,
  /^@spier\/(ui|app-shell|tool-views)(\/.*)?$/,
]
/** Repo trees that are React by definition — a relative import into one is rule 2 too. */
const REACT_TREES = ['packages/ui/', 'packages/app-shell/', 'packages/tool-views/', 'apps/'].map((t) => join(root, t))
// `alert` is deliberately NOT here: `RiskAlert` values are named `alert`
// throughout the mappers, so `alert.interpretation` is a local property access.
// The gate flagged 16 of those on its first run — a rule that cries wolf on the
// domain vocabulary gets switched off, and it was never the valuable entry.
const FORBIDDEN_GLOBALS = new Set([
  'window', 'document', 'localStorage', 'sessionStorage', 'navigator',
  'BroadcastChannel', 'HTMLElement',
])
/** Objects through which a global is reached as a property. */
const HOSTS = new Set(['globalThis', 'self', 'window'])

const files = [...walk(coreSrc)]
const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

// A check that reads nothing must fail, not pass (#232 / #261). If core is moved
// or renamed, this gate must go red rather than certify an empty directory.
if (tsFiles.length === 0) {
  console.error(`✗ no TypeScript found under ${coreSrc} — this gate reads that tree, so an empty read would certify nothing.`)
  process.exit(1)
}

// RULE 1
for (const f of tsFiles.filter((f) => f.endsWith('.tsx'))) {
  fail(`${relative(root, f)}: .tsx in packages/core — a component belongs in an app, not the domain layer`)
}

/** Names the file declares itself — a local `document` is not the DOM's. */
function localNames(sf) {
  const names = new Set()
  const add = (n) => {
    if (!n) return
    if (ts.isIdentifier(n)) names.add(n.text)
    else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) {
      for (const el of n.elements) if (!ts.isOmittedExpression(el)) add(el.name)
    }
  }
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) ||
        ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isImportSpecifier(node) ||
        ts.isImportClause(node) || ts.isNamespaceImport(node)) {
      add(node.name)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return names
}

/** The node a guard must share with a use: its function, or its top-level statement. */
function guardScope(node, sf) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionLike(n)) return n
    if (n.parent === sf) return n
  }
  return sf
}

const guardRe = (g) => new RegExp(`typeof\\s+(?:(?:globalThis|self|window)\\s*\\.\\s*)?${g}\\s*[!=]==?\\s*['"]undefined['"]`)

let detected = 0
for (const f of tsFiles) {
  const rel = relative(root, f)
  const src = readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const locals = localNames(sf)
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const use = (g, node) => {
    if (guardRe(g).test(guardScope(node, sf).getText(sf))) { detected++; return }
    fail(
      `${rel}:${lineOf(node)}: touches \`${g}\` unguarded — packages/core must run in a Worker as well as a ` +
        `browser. Either drop it, or feature-detect it (\`typeof ${g} === 'undefined'\`) in the same function, ` +
        `the way lib/fhircast.ts does.`,
    )
  }

  const visit = (node) => {
    // RULE 2 — every static, type-only and dynamic import, plus `export … from`.
    let spec = null
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)) {
      spec = node.moduleSpecifier.text
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
               node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      spec = node.arguments[0].text
    }
    if (spec !== null) {
      const intoReactTree = spec.startsWith('.') && REACT_TREES.some((t) => resolve(dirname(f), spec).startsWith(t))
      if (FORBIDDEN_MODULES.some((re) => re.test(spec)) || intoReactTree) {
        fail(`${rel}:${lineOf(node)}: imports "${spec}" — packages/core is consumed by two Workers, which have no DOM and no React`)
      }
    }

    // RULE 3 — `globalThis['localStorage']`
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && HOSTS.has(node.expression.text) &&
        ts.isStringLiteralLike(node.argumentExpression) && FORBIDDEN_GLOBALS.has(node.argumentExpression.text)) {
      use(node.argumentExpression.text, node)
    }

    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
      const p = node.parent
      const g = node.text
      if (ts.isPropertyAccessExpression(p) && p.name === node) {
        // `opts.window` is a property; `globalThis.window` / `self.document` is the global.
        if (ts.isIdentifier(p.expression) && HOSTS.has(p.expression.text)) use(g, node)
      } else if (
        ts.isTypeOfExpression(p) || // the guard itself
        ts.isTypeQueryNode(p) || ts.isTypeReferenceNode(p) || ts.isQualifiedName(p) || // type positions erase
        ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) ||
          ts.isMethodDeclaration(p) || ts.isMethodSignature(p)) && p.name === node) || // a key, not a use
        locals.has(g) // a local that happens to share the name
      ) {
        // not a DOM use
      } else {
        use(g, node)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

// The whole claim of this gate is "every file in packages/core is React-free".
// Scanning three files and saying so is the failure mode; the floor is what makes
// the sentence mean something.
reportFloors([
  { source: 'packages/core/src', dimension: 'file(s) scanned', actual: files.length, floor: 56 },
], fail)

if (failures) {
  console.error(`\ncore-boundary check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ core boundary: ${tsFiles.length} file(s) in packages/core are React-free and DOM-free ` +
    `(${FORBIDDEN_GLOBALS.size} globals and ${FORBIDDEN_MODULES.length} module patterns checked; ` +
      `${detected} feature-detected use(s) allowed, each guarded in its own scope)`,
)
