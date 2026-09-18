/**
 * Which URL paths `App.tsx` actually registers.
 *
 * Written for `check:catalog`, which had a hole worth naming: the catalog's 42
 * `launchActions` each carry a `path`, and until 2026-09-09 **nothing checked
 * that any of them resolved to a route.** `check-catalog-integrity.mjs` asserted
 * only that a tool *has* a launch action (its `/launchActions:\s*\[\s*\{/` test),
 * so a renamed route left a button that navigates to the catch-all — green
 * verify, green tests, dead button. That is exactly the failure a re-addressing
 * produces, which is why the reader landed before the re-addressing did.
 *
 * ── Why this parses JSX instead of importing the routes ────────────────────
 *
 * The route table is JSX in a `.tsx` file, not data: there is nothing to import
 * from a plain-Node gate. Rendering it would need React, a DOM, and every lazy
 * chunk's provider — for a question that is purely structural.
 *
 * ⚠️ **It is a real scanner, not a regex over `path="…"`, and it has to be.**
 * Two properties defeat the one-line version:
 *
 *   1. **Routes nest.** `<Route path="/patient">` wraps `<Route path="chart">`,
 *      so the registered path is `/patient/chart` and neither half appears
 *      whole anywhere in the file.
 *   2. **Attribute values contain `>`.** `element={<Navigate to="/x" replace />}`
 *      means "scan forward to the first `>`" finds the end of the *Navigate*
 *      tag, not the Route's. So the scan tracks brace depth and quote state and
 *      ends the tag on a `>` at depth 0 outside quotes.
 *
 * Reading nothing is a THROW, for the reason `stage-codes.mjs` and
 * `vite-alias.mjs` throw: a gate handed `[]` reports green having checked
 * nothing (#232 / #261). A parser that silently stopped understanding the route
 * table would make this gate pass for every path in the catalog.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from '../../../scripts/lib/jsx-comments.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const APP_TSX = resolve(here, '../../src/App.tsx')

/** Join a parent route path with a child's, the way React Router does. */
function joinPaths(parent, child) {
  if (child.startsWith('/')) return child
  if (!parent) return `/${child}`
  return `${parent.replace(/\/$/, '')}/${child}`
}

/**
 * Read one JSX tag starting at `<Route`, returning its attribute text and
 * whether it self-closes. `i` points at the `<`.
 */
function readTag(src, i) {
  let depth = 0
  let quote = null
  for (let j = i + 1; j < src.length; j++) {
    const ch = src[j]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) {
      const selfClosing = src[j - 1] === '/'
      return { attrs: src.slice(i, selfClosing ? j - 1 : j), end: j, selfClosing }
    }
  }
  throw new Error(`route-table: unterminated <Route at offset ${i} of App.tsx`)
}

/**
 * Every path `App.tsx` registers, fully composed through nesting.
 *
 * Returns `{ paths, redirects, redirectTargets }` — `paths` is every registered
 * pattern (including `:params` and the `*` catch-all as written), `redirects` is
 * the subset whose element is a `<Navigate>`. A launch path that resolves only
 * to a redirect still resolves, which is what keeps compatibility redirects from
 * reading as failures.
 *
 * `redirectTargets` maps each redirect's registered path to where it sends the
 * reader, so a caller can ask the OTHER half of the question. Added 2026-09-15,
 * when Tool Configuration moved to `/settings` and the guide kept
 * `/guide/tool-configuration` as a compatibility redirect: `redirects` alone
 * says a published path still resolves, and says nothing about whether it
 * resolves to anywhere. The repo keeps ten-odd such redirects precisely because
 * their paths were published — a rotted target is a 404 for exactly the reader
 * the redirect was kept for.
 *
 * A relative `to` is joined against the redirect's PARENT, which is correct for
 * the index routes that use one (`<Route index element={<Navigate to="pathway"/>}>`
 * under `/guide` → `/guide/pathway`) and is the only relative form in the table.
 * A relative `to` on a non-index route would resolve differently in React Router,
 * so it is reported as unresolvable rather than guessed at.
 */
export function readRouteTable(file = APP_TSX) {
  // ⚠️ Comments blanked before scanning. Without this, a comment quoting
  // `<Route …>` — App.tsx has one — parses as a real unclosed route and
  // mis-nests everything after it, silently. See scripts/lib/jsx-comments.mjs
  // for the eleven phantom paths that produced.
  return scanRoutes(stripComments(readFileSync(file, 'utf8')))
}

/**
 * The scan itself, over source whose comments are already blanked.
 *
 * Split out from `readRouteTable` so `readSurfaceRoutes` can run it over the
 * SAME string it computes `IS_DEMO` regions from — the two have to agree on
 * character offsets, and re-reading the file to get a second copy is exactly
 * how they would stop agreeing.
 */
function scanRoutes(src) {
  const paths = new Set()
  const redirects = new Set()
  /** Registered redirect path → where its <Navigate> sends the reader. */
  const redirectTargets = new Map()
  /**
   * Registered path → the offset of every `<Route` tag that registers it.
   *
   * A LIST, not a single offset, because a path is legitimately registered
   * twice: `{IS_DEMO ? (<Route path="/" …/>) : (<Route path="/" …/>)}` gives `/`
   * one registration per surface. Collapsing that to one offset would make the
   * path look demo-only or clinical-only depending on which branch won the
   * assignment, which is the opposite of what the ternary means.
   */
  const offsets = new Map()
  /** Stack of enclosing route paths; '' for a layout route with no path. */
  const stack = []

  let i = 0
  while (i < src.length) {
    const open = src.indexOf('<Route', i)
    const close = src.indexOf('</Route>', i)

    if (open === -1 && close === -1) break
    if (close !== -1 && (open === -1 || close < open)) {
      stack.pop()
      i = close + '</Route>'.length
      continue
    }

    const { attrs, end, selfClosing } = readTag(src, open)
    const parent = stack.length ? stack[stack.length - 1] : ''
    const own = attrs.match(/\spath="([^"]*)"/)?.[1]
    const isIndex = /\sindex(\s|$|=)/.test(attrs)
    // An index route registers its parent's path, not a path of its own.
    const full = own !== undefined ? joinPaths(parent, own) : isIndex ? parent : parent

    if (own !== undefined || isIndex) {
      paths.add(full)
      offsets.set(full, [...(offsets.get(full) ?? []), open])
      if (/element=\{<Navigate\b/.test(attrs)) {
        redirects.add(full)
        const to = attrs.match(/<Navigate\s+to="([^"]*)"/)?.[1]
        if (to !== undefined) {
          // Relative only on an index route, where the parent IS the current
          // path; anything else is left as written so the caller reports it
          // rather than this function inventing a resolution for it.
          redirectTargets.set(full, to.startsWith('/') || !isIndex ? to : joinPaths(parent, to))
        }
      }
    }
    if (!selfClosing) stack.push(own !== undefined ? full : parent)
    i = end + 1
  }

  if (paths.size === 0) {
    throw new Error(
      'route-table: parsed no routes out of App.tsx. The scanner has stopped ' +
        'understanding the route table, and every caller would now pass while ' +
        'checking nothing — fix the parser rather than the caller.',
    )
  }
  return { paths, redirects, redirectTargets, offsets }
}

/**
 * Does `path` resolve against the table?
 *
 * Exact match first, then a segment-wise match so a launch path lands on a
 * `:param` route (`/patient/record/patient-001` → `/patient/record/:patientId`).
 * Deliberately does NOT treat the `*` catch-all as a match: landing on the
 * catch-all is precisely the dead-button failure this exists to catch.
 */
export function routeResolves(path, paths) {
  if (paths.has(path)) return true
  const want = path.split('/').filter(Boolean)
  for (const pattern of paths) {
    if (pattern === '*' || pattern === '/') continue
    const have = pattern.split('/').filter(Boolean)
    if (have.length !== want.length) continue
    if (have.every((seg, n) => seg.startsWith(':') || seg === want[n])) return true
  }
  return false
}

/**
 * Which paths each BUILD SURFACE registers (`src/lib/surface.ts`).
 *
 * ⚠️ **The clinical surface is not a subset anyone maintains by hand — it is
 * whatever is left when the `IS_DEMO` blocks fold away**, and that is the only
 * honest way to compute it. `VITE_SURFACE=clinical` makes `IS_DEMO` a literal
 * `false`, so the bundler deletes `{IS_DEMO && (…)}` outright; a route inside
 * one is not registered, and a link to it lands on the `*` catch-all.
 *
 * Two forms carry the axis in `App.tsx` and they mean different things:
 *
 *   `{IS_DEMO && (<>…</>)}`     routes that exist on the demo surface ALONE
 *   `{IS_DEMO ? (A) : (B)}`     the SAME path, registered either way, with a
 *                               different element per surface
 *
 * So a path is demo-only when **every** registration of it sits inside an
 * `IS_DEMO &&` region. The ternaries register `/`, `/patient/chart` and
 * `/population` on both surfaces with different redirect targets, and treating
 * either branch as demo-only would report three paths as unreachable that a
 * clinician reaches on every launch.
 */
export function readSurfaceRoutes(file = APP_TSX) {
  const src = stripComments(readFileSync(file, 'utf8'))
  const { paths, redirects, redirectTargets, offsets } = scanRoutes(src)
  const regions = demoOnlyRegions(src)

  const demoOnly = new Set()
  for (const [path, regs] of offsets) {
    if (regs.every((at) => regions.some(([from, to]) => at >= from && at < to))) demoOnly.add(path)
  }
  const clinical = new Set([...paths].filter((p) => !demoOnly.has(p)))

  // ⚠️ Self-check, for the reason `scanRoutes` throws on an empty read: every
  // rule built on this is of the form "X must be in `clinical`", so a bug that
  // returned the whole table as clinical would pass everything while checking
  // nothing. These two anchors are cheap and they fail loudly.
  if (!demoOnly.has('/guide/cds-service')) {
    throw new Error(
      'route-table: /guide/cds-service did not come back demo-only. The IS_DEMO region ' +
        'scanner has stopped understanding App.tsx, and every surface rule built on this ' +
        'would now pass while checking nothing — fix the scanner, not the caller.',
    )
  }
  if (!clinical.has('/patient/record')) {
    throw new Error(
      'route-table: /patient/record did not come back clinical. The IS_DEMO region scanner ' +
        'is over-claiming, and real clinical routes would be reported unreachable.',
    )
  }
  return { paths, clinical, demoOnly, redirects, redirectTargets }
}

/**
 * Character ranges of every `{IS_DEMO && (…)}` block.
 *
 * Paren-matched from the `(`, skipping quoted strings, because an attribute
 * legitimately contains a paren — `aria-label="Tools (opens in a new tab)"` —
 * and counting those would close the region early and leak demo routes into the
 * clinical set. Comments are already blanked by the caller.
 */
function demoOnlyRegions(src) {
  const regions = []
  const re = /\{\s*IS_DEMO\s*&&\s*\(/g
  let m
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('(', m.index)
    let depth = 0
    let quote = null
    for (let i = open; i < src.length; i++) {
      const ch = src[i]
      if (quote) {
        if (ch === '\\') i++
        else if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) { regions.push([open, i]); break }
      }
    }
  }
  return regions
}
