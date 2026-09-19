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
 * The guide-boundary number is the one that matters. That gate's whole claim is
 * *"the Adoption Guide holds no patient data, checked TRANSITIVELY"* — and a
 * `@spier/…` import is exactly how a guide page would reach a fixture now. It
 * would have reported a clean guide having never opened the tool views.
 *
 * So the resolver is declared once, here, and understands both forms. Adding a
 * package alias means adding it in one place rather than in every walker.
 *
 * ⚠️ **The mapping is derived from the filesystem, not typed.** `@spier/<pkg>/…`
 * resolves to `packages/<pkg>/src/…` when that directory exists. A new package
 * is followed the day it is created; a typo in a specifier resolves to nothing
 * and is reported by the caller's own "unresolved" handling rather than being
 * silently skipped as a bare npm import would be.
 */
import { existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

/** `@spier/<pkg>` → `packages/<pkg>/src`, read off the filesystem. */
export function spierPackageRoots(repoRoot) {
  const out = new Map()
  const dir = join(repoRoot, 'packages')
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir).sort()) {
    const src = join(dir, name, 'src')
    if (existsSync(src) && statSync(src).isDirectory()) out.set(`@spier/${name}/`, src)
  }
  return out
}

/**
 * Resolve one import specifier to a file on disk, or `null`.
 *
 * Handles relative specifiers and `@spier/<pkg>/<path>`. A bare npm specifier
 * (`react`, `lucide-react`) resolves to `null` by design — those are not part
 * of this repo's graph and following them would walk `node_modules`.
 *
 * @param {string} spec the specifier as written
 * @param {string} fromFile the importing file's absolute path
 * @param {string} repoRoot
 * @param {Map<string,string>} [packageRoots] from `spierPackageRoots`, hoisted by the caller
 */
export function resolveImport(spec, fromFile, repoRoot, packageRoots) {
  const roots = packageRoots ?? spierPackageRoots(repoRoot)
  let base = null
  if (spec.startsWith('.')) {
    base = resolve(dirname(fromFile), spec)
  } else {
    for (const [prefix, dir] of roots) {
      if (spec.startsWith(prefix)) { base = join(dir, spec.slice(prefix.length)); break }
    }
  }
  if (base === null) return null
  for (const e of EXTS) {
    const c = base + e
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

/** Every import specifier in a source text, in source order. */
export function importSpecifiers(src) {
  return [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
}
