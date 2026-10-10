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
 * `no-restricted-globals` / `no-restricted-properties` block now covers the
 * plain names at edit time (eslint.config.js), and core's tsconfig has no DOM
 * lib since 2026-10-07. Neither replaces this gate: @types/node declares
 * `localStorage` and `navigator`, so they compile, and the feature-detection
 * waiver below is a rule eslint cannot express.
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
 *   5. A HOST is `globalThis`, `self`, `window` — or any name bound to one,
 *      to a fixed point: `const g = globalThis`, `const h = g`, `g = self`,
 *      `(g = globalThis) => …`. Casts and parentheses around a host are seen
 *      through (`(globalThis as T).document`), and `const { localStorage } =
 *      globalThis` is a use of `localStorage`, renamed or not. A guard may name
 *      the alias (`typeof g.localStorage === 'undefined'`).
 *      ⚠️ Until 2026-10-07 only a host IDENTIFIER counted, and seven forms —
 *      alias, alias of an alias, cast, destructure, element access on an alias,
 *      default parameter, assigned alias — passed tsc (Node declares
 *      `localStorage`), eslint AND this gate. All seven are planted red now.
 *
 * The scan is the TypeScript parser over each file: comments and strings are
 * not code, property names (`opts.window`) and declarations of a local with a
 * DOM name are not uses, and type positions (`InstanceType<typeof X>`) erase.
 *
 *   6. A host may not ESCAPE. It may be read from (`.x`, `['literal']`),
 *      feature-detected, compared with `===`, or bound to an unexported alias or
 *      a destructuring — nothing else. Passed to a call (`Reflect.get(globalThis,
 *      'localStorage')`), returned (`() => globalThis`), stored in an object or
 *      array, spread or exported, it is a handle on every global that no rule can
 *      follow, so it fails where it LEAVES: that is what catches
 *      `o.g.localStorage` and `getGlobal().document`, whose use sites carry no
 *      host. `globalThis.self` / `.window` / `.globalThis` are the host again.
 *   7. A host indexed by a COMPUTED key (`globalThis[name]`) fails: only a
 *      literal key names something this gate can check. And `eval(…)` /
 *      `Function(…)` fail outright — code built from a string reaches any global.
 *      ⚠️ Rules 6 and 7 closed the four forms rule 5's first version listed as
 *      unseen (2026-10-07); all planted red, none present in core.
 *
 * ⚠️ **What it cannot see**: a global object handed IN from outside core — a
 * parameter typed `typeof globalThis` that an app fills with `globalThis` is,
 * inside core, an ordinary parameter (and passing what core needs as a
 * parameter is the recommended fix, so the gate cannot forbid the shape). Nor a
 * host returned by a dependency outside the repo. DOM types in signatures are a
 * compile error, not this gate's: core's `lib` has no DOM since 2026-10-07.
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

/** Strip what does not change which object an expression is: `(x)`, `x as T`, `x satisfies T`, `x!`, `<T>x`. */
function unwrap(e) {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) ||
         ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression
  return e
}

/**
 * Every name in the file that holds a host object — `const g = globalThis`,
 * `h = g`, `(g = self) => …` — resolved to a fixed point, so an alias of an
 * alias counts. ⚠️ By NAME, file-wide: a host alias shadowed by an unrelated
 * local of the same name in another scope is over-counted, which can only make
 * the gate stricter.
 */
function hostAliases(sf) {
  const hosts = new Set(HOSTS)
  const pairs = [] // [name, initializer]
  const visit = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isIdentifier(node.name) && node.initializer) {
      pairs.push([node.name.text, node.initializer])
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
               ts.isIdentifier(node.left)) {
      pairs.push([node.left.text, node.right])
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  for (let grew = true; grew;) {
    grew = false
    for (const [name, init] of pairs) {
      const e = unwrap(init)
      if (!hosts.has(name) && ts.isIdentifier(e) && hosts.has(e.text)) { hosts.add(name); grew = true }
    }
  }
  return hosts
}

const escapeRe = (t) => t.replace(/[$]/g, '\\$&')
const guardRe = (g, hosts) => new RegExp(
  `typeof\\s+(?:(?:${[...hosts].map(escapeRe).join('|')})\\s*\\.\\s*)?${g}\\s*[!=]==?\\s*['"]undefined['"]`,
)

/** Wrappers that do not change which object an expression is (see `unwrap`). */
const isWrapper = (n) => n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) ||
  ts.isNonNullExpression(n) || ts.isTypeAssertionExpression(n))

/** Is this host identifier in a VALUE position — not a declared name, a key, or a type? */
function isHostValue(id) {
  const p = id.parent
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) ||
       ts.isFunctionDeclaration(p) || ts.isImportSpecifier(p) || ts.isImportClause(p)) && p.name === id) return false
  if (ts.isBindingElement(p) && p.propertyName === id) return false
  if ((ts.isPropertyAccessExpression(p) && p.name === id) ||
      ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) ||
        ts.isMethodDeclaration(p)) && p.name === id)) return false
  if (ts.isTypeQueryNode(p) || ts.isTypeReferenceNode(p) || ts.isQualifiedName(p)) return false
  return true
}

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
])

/** Why the host expression `child` escapes into `parent`, or null when it does not. */
function hostEscape(child, parent) {
  if (ts.isPropertyAccessExpression(parent) && parent.expression === child) return null
  if (ts.isElementAccessExpression(parent) && parent.expression === child) {
    // RULE 7 — a computed key can name any global; only a literal can be checked.
    const k = parent.argumentExpression
    return ts.isStringLiteralLike(k) || ts.isNumericLiteral(k) ? null : 'is indexed by a computed key'
  }
  if (ts.isTypeOfExpression(parent)) return null
  if (ts.isBinaryExpression(parent) && EQUALITY.has(parent.operatorToken.kind)) return null
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    if (parent.left === child) return null // `g = …` rebinds the alias
    return ts.isIdentifier(parent.left) ? null : 'is stored in a property'
  }
  if (ts.isParameter(parent) && parent.initializer === child) return null
  if (ts.isVariableDeclaration(parent) && parent.initializer === child) {
    const exported = ts.getCombinedModifierFlags(parent) & ts.ModifierFlags.Export
    return exported ? 'is exported' : null
  }
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    return parent.expression === child ? 'is called' : 'is passed to a call'
  }
  if (ts.isReturnStatement(parent) || ts.isArrowFunction(parent)) return 'is returned'
  if (ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent) ||
      ts.isArrayLiteralExpression(parent) || ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent)) {
    return 'is stored in an object or array'
  }
  if (ts.isExportSpecifier(parent) || ts.isExportAssignment(parent)) return 'is exported'
  return `escapes into a ${ts.SyntaxKind[parent.kind]}`
}

let detected = 0
for (const f of tsFiles) {
  const rel = relative(root, f)
  const src = readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const locals = localNames(sf)
  const hosts = hostAliases(sf)
  /** Is `e` a host object — `globalThis`, `self`, `window`, or an alias of one, however cast? */
  const isHost = (e) => {
    const u = unwrap(e)
    if (ts.isIdentifier(u)) return hosts.has(u.text)
    // `globalThis.self`, `self.window`, `globalThis.globalThis` are the host again.
    return ts.isPropertyAccessExpression(u) && HOSTS.has(u.name.text) && isHost(u.expression)
  }
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

  const use = (g, node) => {
    if (guardRe(g, hosts).test(guardScope(node, sf).getText(sf))) { detected++; return }
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

    // RULE 3 — `globalThis['localStorage']`, on a host or an alias of one
    if (ts.isElementAccessExpression(node) && isHost(node.expression) &&
        ts.isStringLiteralLike(node.argumentExpression) && FORBIDDEN_GLOBALS.has(node.argumentExpression.text)) {
      use(node.argumentExpression.text, node)
    }

    // RULE 3 — `const { localStorage } = globalThis` (renamed or not) takes the
    // global out under a LOCAL name, which the bare-identifier branch below then
    // reads as "a local that happens to share the name". The destructuring is
    // the use.
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && isHost(node.initializer)) {
      for (const el of node.name.elements) {
        const key = el.propertyName ?? el.name
        if (ts.isIdentifier(key) && FORBIDDEN_GLOBALS.has(key.text)) use(key.text, el)
      }
    }

    // RULE 6 — a host may not ESCAPE. It may be read from (`.x`, `['x']`),
    // feature-detected, compared, or bound to an unexported alias or a
    // destructuring; nothing else. Passed to a call (`Reflect.get(globalThis,
    // 'localStorage')`), returned, stored in an object or array, spread or
    // exported, it is a handle on every global that no rule here can follow —
    // the property (`o.g.localStorage`) and call-return (`getGlobal().document`)
    // forms are caught where the host leaves, not where it is used.
    if (ts.isIdentifier(node) && hosts.has(node.text) && isHostValue(node)) {
      let child = node
      while (isWrapper(child.parent)) child = child.parent
      const why = hostEscape(child, child.parent)
      if (why) {
        fail(
          `${rel}:${lineOf(node)}: \`${node.text}\` ${why} — packages/core may read a named global off the ` +
            'global object, never hand the object itself on. Take what you need as a parameter from the app.',
        )
      }
    }

    // `eval` / `Function` rebuild the global object from a string, past every rule above.
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ts.isIdentifier(node.expression) &&
        (node.expression.text === 'eval' || node.expression.text === 'Function') && !locals.has(node.expression.text)) {
      fail(`${rel}:${lineOf(node)}: \`${node.expression.text}(…)\` in packages/core — code built from a string can reach any global, and this gate cannot read it`)
    }

    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
      const p = node.parent
      const g = node.text
      if (ts.isPropertyAccessExpression(p) && p.name === node) {
        // `opts.window` is a property; `globalThis.window` / `self.document` is the
        // global — and so is `g.document` once `const g = globalThis`, and
        // `(globalThis as T).document`.
        if (isHost(p.expression)) use(g, node)
      } else if (ts.isBindingElement(p) && p.propertyName === node) {
        // the key of `{ localStorage: ls }` — RULE 3's destructuring branch decides
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
