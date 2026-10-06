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
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from './jsx-comments.mjs'
import { APP_ROOTS, appRoot } from './app-roots.mjs'

/**
 * Every app's route table.
 *
 * ⚠️ **There are TWO now, and a default of "the first one" would be a gate
 * quietly checking half the product.** So the default is the UNION: a path
 * "resolves against the route table" when some app registers it, which is what
 * the catalog's launch paths and the compatibility redirects actually mean —
 * a published URL has to work *somewhere*. A caller that means one specific
 * app passes that app's file, and `check-catalog-integrity` does exactly that
 * for the guide's sections.
 */
const APP_TSX_FILES = APP_ROOTS.map((r) => join(r.dir, 'App.tsx')).filter((f) => existsSync(f))
export const appTsx = (source) => join(appRoot(source), 'App.tsx')
const APP_TSX = APP_TSX_FILES[0]

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
 * `readRouteTable` returns `{ paths, redirects, redirectTargets, unreadRedirects }`
 * — `paths` is every registered
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
 * so it is reported as unresolvable rather than guessed at. `unreadRedirects` is
 * every redirect whose `<Navigate>` has no literal `to` this reader can read —
 * a caller must fail on it, not skip it.
 */
/**
 * The union of every app's route table — see APP_TSX_FILES.
 *
 * Same shape as `readRouteTable`, with the sets and lists merged, so every
 * caller that already knew how to read one table reads all of them unchanged.
 */
export function readAllRouteTables() {
  const paths = new Set()
  const redirects = new Set()
  for (const f of APP_TSX_FILES) {
    const table = readRouteTable(f)
    for (const p of table.paths) paths.add(p)
    for (const r of table.redirects) redirects.add(r)
  }
  // ⚠️ No merged `redirectTargets`: "does this redirect land somewhere" is a
  // PER-APP question (a guide redirect into /settings resolves in the union and
  // strands the reader in the guide), and check:surface-links RULE 2 asks it
  // per app. The union version lived in check:catalog until 2026-10-06.
  return { paths, redirects }
}

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
 * Split out from `readRouteTable`, which blanks the comments first.
 */
function scanRoutes(src) {
  const paths = new Set()
  const redirects = new Set()
  /** Registered redirect path → where its <Navigate> sends the reader. */
  const redirectTargets = new Map()
  /** Registered redirect paths whose `<Navigate>` target this reader could not read. */
  const unreadRedirects = new Set()
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
    const own = literalAttr(attrs, 'path')
    if (own === undefined && /\spath=/.test(attrs)) {
      throw new Error(
        `route-table: a <Route> at offset ${open} declares a path this reader cannot read ` +
          `(${attrs.match(/\spath=\S*/)[0]}). Write it as a string literal — a route this ` +
          'scanner skips is a route every caller treats as absent.',
      )
    }
    const isIndex = /\sindex(\s|$|=)/.test(attrs)
    // An index route registers its parent's path, not a path of its own.
    const full = own !== undefined ? joinPaths(parent, own) : isIndex ? parent : parent

    if (own !== undefined || isIndex) {
      paths.add(full)
      // ⚠️ Any whitespace before `<Navigate`, and `to` in any position and any
      // literal form. The first version required `element={<Navigate to="…"`
      // exactly, so `<Navigate replace to="/x" />` or `element={ <Navigate … /> }`
      // was not a redirect at all and its target was never checked.
      const navAt = attrs.search(/element=\{\s*<Navigate\b/)
      if (navAt !== -1) {
        redirects.add(full)
        const to = literalAttr(attrs.slice(navAt), 'to')
        if (to === undefined) unreadRedirects.add(full)
        else {
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
  return { paths, redirects, redirectTargets, unreadRedirects }
}

/**
 * A JSX attribute's value when it is a literal — `a="x"`, `a='x'`, `a={"x"}`,
 * `a={'x'}` or a template with no substitution, `` a={`x`} ``. `undefined`
 * when the attribute is absent or computed.
 */
function literalAttr(text, name) {
  const m = text.match(
    new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|\\{\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)\\s*\\})`),
  )
  return m?.slice(1).find((v) => v !== undefined)
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
 * Which paths each APP registers.
 *
 * ⚠️ **This used to scan `App.tsx` for `{IS_DEMO && (…)}` regions**, because
 * one route table served both surfaces and the clinical one was "whatever is
 * left when the blocks fold away". There are two tables now, so the question
 * answers itself: a path is guide-only when the guide's table has it and the
 * clinical app's does not. The region scanner, its paren matching and its two
 * IS_DEMO forms are all gone — the axis is a directory now, not a conditional.
 *
 * ⚠️ **The self-checks stay, and they are the reason this is not just a set
 * difference inline at the call site.** Every rule built on this has the shape
 * "X must be in `clinical`", so a bug that returned the whole union as clinical
 * would pass everything while checking nothing. The two anchors below are cheap
 * and fail loudly.
 */
export function readSurfaceRoutes() {
  const guide = readRouteTable(appTsx('apps/guide/src'))
  const clin = readRouteTable(appTsx('apps/clinical/src'))

  const demoOnly = new Set([...guide.paths].filter((p) => !clin.paths.has(p)))
  const clinical = new Set(clin.paths)

  if (!demoOnly.has('/guide/cds-service')) {
    throw new Error(
      'route-table: /guide/cds-service did not come back guide-only. The two route tables are ' +
        'no longer being read as two, and every surface rule built on this would now pass ' +
        'while checking nothing — fix the reader, not the caller.',
    )
  }
  if (!clinical.has('/patient/record')) {
    throw new Error(
      'route-table: /patient/record did not come back clinical. The clinical table is not ' +
        'being read, and real clinical routes would be reported unreachable.',
    )
  }
  return {
    // Each app's own table, whole, for a rule that runs per surface. The
    // top-level union / `clinical` / `demoOnly` sets this used to return had no
    // reader left; `demoOnly` and `clinical` survive above as the self-checks.
    byApp: {
      clinical: { source: 'apps/clinical/src', paths: clinical, redirects: clin.redirects, redirectTargets: clin.redirectTargets, unreadRedirects: clin.unreadRedirects },
      guide: { source: 'apps/guide/src', paths: new Set(guide.paths), redirects: guide.redirects, redirectTargets: guide.redirectTargets, unreadRedirects: guide.unreadRedirects },
    },
  }
}

/**
 * ⚠️ `demoOnlyRegions` lived here: it paren-matched every `{IS_DEMO && (…)}`
 * block in a shared `App.tsx`, skipping quoted strings so an `aria-label` with
 * a bracket in it could not end a region early. It is deleted with the flag —
 * there is one route table per app now, and "which surface is this route on" is
 * answered by which file it is in. Kept as a note because the paren-matching
 * was subtle and someone may look for it.
 */
