/**
 * The trees the CSS and page-template gates read.
 *
 * ⚠️ **This module exists because four gates went green while dropping a
 * quarter of their input.** `packages/ui` was carved out of `web/src` on
 * 2026-09-19, taking eight components, their stylesheets and the token sheet
 * with it. Every one of those gates walked `web/src` and only `web/src`:
 *
 *   check:css-dead   40 stylesheets, 778 selectors, 122 sources  →  31 / 715 / 113   ✓ passed
 *   check:template   40 stylesheets                              →  31              ✓ passed
 *
 * Both reported success. `check:tokens` and `check:prose` failed loudly instead,
 * and only because the specific FILE they name by path had moved — had the token
 * sheet stayed put they would have passed too, checking three-quarters of the
 * CSS and saying so.
 *
 * So the roots are declared ONCE, here, and every consumer takes all of them.
 * Adding a tree means adding it here and nowhere else.
 *
 * ⚠️ **The floors are PER ROOT, and that is the whole point.** A global floor is
 * what these gates already had — `FLOOR_CSS_FILES = 10` in check-css-dead —
 * and 31 stylesheets cleared it comfortably while nine were missing. Only a
 * per-root floor can see a whole tree stop being read, which is the accident a
 * package extraction actually produces. Same rule, and the same reasoning, as
 * `scripts/lib/floors.mjs` and the per-source floors in `check-codings.mjs`.
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const WEB_ROOT = resolve(here, '../..')
export const REPO_ROOT = resolve(WEB_ROOT, '..')

/**
 * Every tree that holds app CSS or the components that reference it.
 *
 * `floorCss` / `floorSrc` are the smallest each has really produced, rounded
 * well down — they answer "is this root still being read at all", not "is it
 * the right size".
 */
export const STYLE_ROOTS = [
  { source: 'web/src', dir: join(WEB_ROOT, 'src'), floorCss: 14, floorSrc: 42 },
  { source: 'packages/ui/src', dir: join(REPO_ROOT, 'packages/ui/src'), floorCss: 6, floorSrc: 6 },
  { source: 'packages/tool-views/src', dir: join(REPO_ROOT, 'packages/tool-views/src'), floorCss: 1, floorSrc: 12 },
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

/** Every file with one of `exts`, across every declared root. */
export const allStyleFiles = (exts) => STYLE_ROOTS.flatMap((r) => walkExt(r.dir, exts))

/**
 * Every stylesheet in the repo that a declared root ought to cover.
 *
 * ⚠️ **This exists because the floors could not see their own list being
 * shortened.** Planting "drop packages/ui from STYLE_ROOTS" left `check:css-dead`
 * and `check:template` GREEN: removing the root removed its floor entry with it,
 * so nothing was left to come up short. The floors answer "is this declared root
 * still producing files"; they cannot answer "is a root missing", because the
 * question is asked of the very list the defect edited.
 *
 * So this asks the FILESYSTEM instead — the one input a change to STYLE_ROOTS
 * cannot alter. Exactly the lesson `check-surface.mjs` records about deriving
 * its page list from the route table rather than from the guards it was
 * checking: *the list must come from something the defect cannot change.*
 */
function uncoveredStylesheets() {
  const candidates = [join(WEB_ROOT, 'src')]
  const pkgDir = join(REPO_ROOT, 'packages')
  if (existsSync(pkgDir)) {
    for (const entry of readdirSync(pkgDir)) {
      const src = join(pkgDir, entry, 'src')
      if (existsSync(src) && statSync(src).isDirectory()) candidates.push(src)
    }
  }
  const covered = STYLE_ROOTS.map((r) => r.dir)
  const out = []
  for (const dir of candidates) {
    for (const css of walkExt(dir, ['.css'])) {
      if (!covered.some((c) => css.startsWith(c + '/'))) out.push(css)
    }
  }
  return out
}

/**
 * Floor entries for `reportFloors`, one pair per root. A gate that reads only
 * CSS passes `{ css: true, src: false }`.
 *
 * ⚠️ Also fails outright on a stylesheet no declared root covers — see
 * `uncoveredStylesheets`. That check is not a floor and cannot be one.
 */
export function styleRootFloors({ css = true, src = true } = {}) {
  const orphans = uncoveredStylesheets()
  if (orphans.length > 0) {
    console.error(
      `\u2717 ${orphans.length} stylesheet(s) are in the repo but under no declared style root — ` +
        'this gate would silently never read them. Add the tree to STYLE_ROOTS in ' +
        'web/scripts/lib/style-roots.mjs:\n    ' +
        orphans.map(relRepo).join('\n    '),
    )
    process.exit(1)
  }
  const entries = []
  for (const root of STYLE_ROOTS) {
    if (css) {
      entries.push({
        source: root.source,
        dimension: 'stylesheet(s)',
        actual: walkExt(root.dir, ['.css']).length,
        floor: root.floorCss,
      })
    }
    if (src) {
      entries.push({
        source: root.source,
        dimension: 'source file(s)',
        actual: walkExt(root.dir, ['.ts', '.tsx']).filter((f) => !/\.test\.tsx?$/.test(f)).length,
        floor: root.floorSrc,
      })
    }
  }
  return entries
}
