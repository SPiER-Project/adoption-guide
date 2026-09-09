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
 * Returns `{ paths, redirects }` — `paths` is every registered pattern
 * (including `:params` and the `*` catch-all as written), `redirects` is the
 * subset whose element is a `<Navigate>`. A launch path that resolves only to a
 * redirect still resolves, which is what keeps compatibility redirects from
 * reading as failures.
 */
export function readRouteTable(file = APP_TSX) {
  const src = readFileSync(file, 'utf8')
  const paths = new Set()
  const redirects = new Set()
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
      if (/element=\{<Navigate\b/.test(attrs)) redirects.add(full)
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
  return { paths, redirects }
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
