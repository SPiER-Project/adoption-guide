/**
 * Walking the app's import graph across package boundaries.
 *
 * ⚠️ **This exists because two gates went quietly smaller the moment a package
 * appeared between them and what they were checking.** `check-guide-boundary`
 * and `check-surface-links` each carried their own `resolveSpec`, and each one
 * resolved **relative specifiers only**:
 *
 *     if (!spec.startsWith('.')) return null
 *
 * That was correct while every module the walk cared about lived in `web/src`.
 * When the 29 tool views moved to `packages/tool-views` and their importers
 * started saying `@spier/tool-views/components/WorkflowForm`, the walk simply
 * stopped at the boundary — and **both gates passed**:
 *
 *     check:guide-boundary   47 modules reached  →  20   ✓ passed (floor 20, by equality)
 *     check:surface-links    89 modules reached  →  61   ✓ passed
 *
 * So the resolver is declared once, here, and the three walkers
 * (`check:guide-boundary`, `check:surface-links`, `check:eager-forms`) share it.
 *
 * ── The aliases are READ from vite.config.ts, not derived or typed ───────────
 *
 * ⚠️ The second version mapped `@spier/<pkg>/…` to `packages/<pkg>/src/…`
 * "off the filesystem" — which silently resolved NOTHING for the two aliases
 * that do not follow that shape (`@spier/fhir-artifacts/` → the package root,
 * bare `@spier/demo-population` → its `index.ts`), and its callers dropped a
 * `null` without a word. Its header claimed the opposite. The aliases now come
 * from Vite's own resolved config (`resolveConfig`, ~50 ms, offline), so the
 * walk resolves exactly what the bundler resolves.
 *
 * ── Unresolved is a FAILURE, not a leaf ──────────────────────────────────────
 *
 * A bare npm specifier (`react`) is external and not followed. Anything else —
 * a relative path or an `@spier/…` specifier — that resolves to no file is
 * returned as `unresolved`, and every walker fails on it: a dropped edge is a
 * module the gate never read. A query (`?raw`, `?url`) is stripped first — the
 * file it names IS imported, and `…/asq-questionnaire.json?raw` reached the
 * entry chunk with `check:eager-forms` green before this.
 *
 * ── Specifiers come from the TypeScript parser ──────────────────────────────
 *
 * Not a regex over the text: comments, strings that merely look like imports,
 * and the static/dynamic/type-only distinction are all the parser's job.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import { resolveConfig } from 'vite'

const EXTS = ['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx']

/**
 * A resolver over vite.config.ts's aliases.
 *
 * Returns `(spec, fromFile) => { kind: 'file', path } | { kind: 'external' } |
 * { kind: 'unresolved' }`.
 *
 * @param {string} repoRoot
 */
export async function createResolver(repoRoot) {
  const config = await resolveConfig(
    { configFile: join(repoRoot, 'vite.config.ts'), logLevel: 'silent' },
    'build',
  )
  const aliases = config.resolve.alias.filter((a) => !String(a.find).includes('@vite'))
  // The read must have produced the package aliases, or every `@spier/…`
  // import below would come back unresolved — loudly, but for the wrong reason.
  if (!aliases.some((a) => a.find === '@spier/core')) {
    throw new Error('module-graph: vite.config.ts produced no `@spier/core` alias — the alias read is broken')
  }
  const nodeModules = join(repoRoot, 'node_modules') + '/'

  /** Rollup's alias match: a RegExp tests, a string matches whole or as a `/` prefix. */
  const aliasFor = (spec) =>
    aliases.find((a) =>
      a.find instanceof RegExp ? a.find.test(spec) : spec === a.find || spec.startsWith(`${a.find}/`),
    )

  return function resolveImport(spec, fromFile) {
    const clean = spec.replace(/[?#].*$/, '')
    let base = null
    if (clean.startsWith('.')) {
      base = resolve(dirname(fromFile), clean)
    } else {
      const alias = aliasFor(clean)
      if (alias) base = clean.replace(alias.find, alias.replacement)
      else if (clean.startsWith('@spier/')) return { kind: 'unresolved' }
      else return { kind: 'external' }
    }
    if (base.startsWith(nodeModules)) return { kind: 'external' }
    const candidates = EXTS.map((e) => base + e)
    if (/\.js$/.test(base)) candidates.push(base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'))
    for (const c of candidates) {
      if (existsSync(c) && statSync(c).isFile()) return { kind: 'file', path: c }
    }
    return { kind: 'unresolved' }
  }
}

const SCRIPT_KIND = { '.ts': ts.ScriptKind.TS, '.tsx': ts.ScriptKind.TSX, '.mts': ts.ScriptKind.TS, '.mjs': ts.ScriptKind.JS, '.js': ts.ScriptKind.JS }

/**
 * Every import in one module, from the parser.
 *
 * `kind` is `static` (an `import`/`export … from` that survives compilation),
 * `type` (`import type` / `export type`, erased — it puts nothing in a bundle)
 * or `dynamic` (`import('x')`). Non-script files (JSON, CSS) have none.
 *
 * @param {string} file
 * @param {string} [src]
 * @returns {{ spec: string, kind: 'static' | 'type' | 'dynamic' }[]}
 */
export function importsOf(file, src = readFileSync(file, 'utf8')) {
  const ext = file.slice(file.lastIndexOf('.'))
  const scriptKind = SCRIPT_KIND[ext]
  if (scriptKind === undefined) return []
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, scriptKind)
  const out = []
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, kind: node.importClause?.isTypeOnly ? 'type' : 'static' })
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, kind: node.isTypeOnly ? 'type' : 'static' })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      out.push({ spec: node.arguments[0].text, kind: 'dynamic' })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/**
 * Walk the graph from `entries`, following the import kinds in `follow`.
 *
 * Returns `reached` (file → the file that first imported it, `null` for an
 * entry) and `unresolved` (every `{ from, spec }` that named a repo module and
 * resolved to none). A caller MUST fail on a non-empty `unresolved`.
 *
 * @param {string[]} entries absolute paths
 * @param {(spec: string, from: string) => { kind: string, path?: string }} resolveImport
 * @param {{ follow?: Set<string>, skip?: (path: string) => boolean }} [opts]
 */
export function walkGraph(entries, resolveImport, opts = {}) {
  const follow = opts.follow ?? new Set(['static', 'type', 'dynamic'])
  const skip = opts.skip ?? (() => false)
  const reached = new Map(entries.map((e) => [e, null]))
  const unresolved = []
  const queue = [...entries]
  while (queue.length) {
    const file = queue.shift()
    for (const { spec, kind } of importsOf(file)) {
      if (!follow.has(kind)) continue
      const r = resolveImport(spec, file)
      if (r.kind === 'unresolved') { unresolved.push({ from: file, spec }); continue }
      if (r.kind !== 'file' || reached.has(r.path) || skip(r.path)) continue
      reached.set(r.path, file)
      queue.push(r.path)
    }
  }
  return { reached, unresolved }
}

/** The import chain from an entry to `file`, entry first. */
export function chainTo(reached, file) {
  const out = []
  for (let c = file; c; c = reached.get(c)) out.unshift(c)
  return out
}
