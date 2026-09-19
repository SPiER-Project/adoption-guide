/**
 * The application source trees the `.ts`/`.tsx` gates read.
 *
 * ⚠️ **This is `style-roots.mjs`'s rule, applied one tree over and BEFORE the
 * accident rather than after it.** That module exists because `packages/ui` was
 * carved out of `web/src` on 2026-09-19 and four CSS gates went green while
 * dropping a quarter of their input. The `apps/` split
 * (`docs/plans/repo-and-package-boundaries.md`) is the same move at roughly ten
 * times the scale: `web/src` becomes `apps/guide/src` and `apps/clinical/src`,
 * and **every gate that walks an app tree by path would read one of two, or
 * none, and say ✓.**
 *
 * Eight gates hardcoded `web/src`. They are wired here instead, so adding a
 * tree means adding it in one place.
 *
 * ── Why the discovery rule is an ENTRY MODULE ──────────────────────────────
 *
 * The floors below prove a declared root is still producing files. They cannot
 * prove a root is *missing*, because the question would be asked of the very
 * list the defect edited — `style-roots.mjs` records planting exactly that and
 * watching two gates stay green. So the second half asks the FILESYSTEM.
 *
 * What it looks for is `src/main.tsx` or `src/App.tsx`: an application has an
 * entry module by construction, and someone standing up `apps/guide/` cannot
 * avoid writing one. That is the property the check needs — *the list must come
 * from something the defect cannot change* — and it is why this does not simply
 * glob every `src` directory it finds. `packages/core/src` and `packages/ui/src` hold plenty of `.ts`
 * and `.tsx` and are legitimately not app trees; a glob would either drag them
 * in or need an exclusion list, and an exclusion list is one more thing a move
 * can quietly edit.
 *
 * ⚠️ So a new app whose entry module exists but whose root is undeclared is a
 * HARD FAILURE, not a floor. It fires the moment `apps/guide/src/App.tsx` is
 * written, which is exactly when it is cheap to act on.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const WEB_ROOT = resolve(here, '../..')
export const REPO_ROOT = resolve(WEB_ROOT, '..')

/**
 * Every tree holding application source.
 *
 * `floorSrc` is roughly half the real count, rounded well down, per
 * `scripts/lib/floors.mjs` rule 2 — it answers "is this root still being read
 * at all", never "is it the right size".
 */
export const APP_ROOTS = [
  { source: 'web/src', dir: join(WEB_ROOT, 'src'), floorSrc: 42 },
]

/** Repo-relative, so a message names a file the same way whichever tree it is in. */
export const relRepo = (p) => relative(REPO_ROOT, p)

export function walkExt(dir, exts) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkExt(full, exts))
    else if (exts.some((e) => full.endsWith(e))) out.push(full)
  }
  return out
}

const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f)

/** Every non-test `.ts`/`.tsx` across every declared root. */
export const allAppFiles = () =>
  APP_ROOTS.flatMap((r) => walkExt(r.dir, ['.ts', '.tsx'])).filter((f) => !isTest(f))

/** The single root a gate should read when it only knows how to read one. */
export function appRoot(source) {
  const root = APP_ROOTS.find((r) => r.source === source)
  if (!root) {
    throw new Error(
      `app-roots: no declared root named "${source}". Declared: ${APP_ROOTS.map((r) => r.source).join(', ')}`,
    )
  }
  return root.dir
}

/**
 * App trees the filesystem has and `APP_ROOTS` does not name.
 *
 * Candidate parents are `web/` and every `apps/*` — the two places an app can
 * live under the target layout. A directory qualifies as an app tree when it
 * holds an entry module; see the header for why that, and not a bare `src` glob.
 */
function undeclaredAppTrees() {
  const ENTRY = ['main.tsx', 'App.tsx']
  const candidates = [join(WEB_ROOT, 'src')]
  const appsDir = join(REPO_ROOT, 'apps')
  if (existsSync(appsDir)) {
    for (const entry of readdirSync(appsDir).sort()) {
      const src = join(appsDir, entry, 'src')
      if (existsSync(src) && statSync(src).isDirectory()) candidates.push(src)
    }
  }
  const declared = APP_ROOTS.map((r) => r.dir)
  return candidates.filter(
    (dir) => ENTRY.some((e) => existsSync(join(dir, e))) && !declared.includes(dir),
  )
}

/**
 * Floor entries for `reportFloors`, one per declared root.
 *
 * ⚠️ Also fails outright on an app tree no root names — see
 * `undeclaredAppTrees`. That check is not a floor and cannot be one.
 */
export function appRootFloors() {
  const orphans = undeclaredAppTrees()
  if (orphans.length > 0) {
    console.error(
      `✗ ${orphans.length} application source tree(s) exist but are declared in no app root — ` +
        'every gate wired to this module would silently never read them. Add each to APP_ROOTS in ' +
        'web/scripts/lib/app-roots.mjs:\n    ' +
        orphans.map(relRepo).join('\n    '),
    )
    process.exit(1)
  }
  return APP_ROOTS.map((root) => ({
    source: root.source,
    dimension: 'app source file(s)',
    actual: walkExt(root.dir, ['.ts', '.tsx']).filter((f) => !isTest(f)).length,
    floor: root.floorSrc,
  }))
}
