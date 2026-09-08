#!/usr/bin/env node
/**
 * check:template — the page template is one template.
 *
 * Every route under the app shell renders into `.app-shell__body`, which pads
 * the page. Nothing else may: a page that pads its own root indents its content
 * relative to every other page, for a reason invisible from the page itself.
 * That is precisely what had happened — the Population view added
 * `padding: var(--space-6)` to its root and the Adoption Guide padded both its
 * header band and each sub-page container, so those two lenses started 24px
 * further in than Overview and the Patient Chart. Along the way each of the four
 * lenses grew its own title block: four class prefixes, two title colors, and
 * one eyebrow style per page.
 *
 * So this gate asserts the two invariants that keep it from happening again:
 * one header implementation, and one owner of the page inset.
 *
 * Two families are covered, and they are found in different ways. The lenses
 * (src/pages) are a declared allowlist, because which pages own a header is a
 * decision. The form views (src/components — every assessment and workflow
 * recorder) are *derived* from the form layout they render, because "is this a
 * drill-in page" is a fact about the markup, and deriving it means a new view is
 * covered without anyone remembering to list it.
 *
 * It reads source text — no bundler, no DOM. That buys it a place in `verify`
 * (offline, sub-second) at the cost of the limits called out on RULE 4 below.
 *
 * ⚠️ Plant a defect and watch it fail before trusting it. `npm run check:template`
 * should go red for each of: adding `padding` to `.population-view`, giving a
 * guide sub-page its own `<h2>`, hand-rolling a `page-header__title` outside
 * PageHeader.tsx, and adding `<PageHeader>` to a page not in LENSES.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAGES_DIR = join(ROOT, 'src/pages')
const SRC_DIR = join(ROOT, 'src')
const HEADER_TSX = 'src/components/PageHeader.tsx'
// Paths are relative to src/, since the CSS walk covers all of it (App.css and
// index.css included) rather than src/css/ alone.
const HEADER_CSS = 'css/PageHeader.css'

/**
 * The pages that own a page header, and why only these.
 *
 * An allowlist rather than a count, and checked in both directions: a lens that
 * loses its header fails, and a page that grows one without being listed here
 * fails too. The second half is the one that matters — the guide's nine
 * sub-pages render *inside* AdoptionGuide's header, so a sub-page adding its own
 * would put two page titles on one page, which is how the guide's header came to
 * be a special case the first time.
 */
/**
 * The sanctioned owners of a page inset, with the reason each is allowed one.
 *
 * `.app-shell__body` was the *sole* owner until the SMART panel landed
 * (embedded-panel-smart-launch.md §3, which requires this be declared here
 * rather than worked around — "the panel becomes the place template drift
 * lives" otherwise). Two shells legitimately pad their own body because they
 * are two chromes for the same routes; what must stay forbidden is a *page*
 * padding itself, which is RULE 4b below and is unchanged.
 *
 * Adding a third entry should feel expensive. Two is a chrome decision; three
 * is drift.
 */
const INSET_OWNERS = {
  '.app-shell__body': 'AppShell — the standalone demo chrome',
  '.panel-shell__body': 'PanelShell — the embedded SMART activity chrome (tighter inset; the panel reclaims vertical space)',
}

const LENSES = {
  'Overview.tsx': 'the front door: brand eyebrow + the project tagline as title',
  'AdoptionGuide.tsx': 'the /guide layout — renders the header for all nine sub-pages',
  'PopulationView.tsx': 'the Population lens\u2019s index page; its eyebrow names the project rather than a section',
  // Added in step D (#391), when Measures moved out of the Adoption Guide to the
  // EHR side. It is a sub-page of the Population lens, but that lens has no
  // layout component to render a header for it the way AdoptionGuide does for
  // its sections \u2014 so this page owns its own, like the caseload beside it.
  'MeasureDashboard.tsx': 'the Population lens\u2019s second page; the lens has no header-rendering layout',
  'PatientChart.tsx': 'the Patient View lens; eyebrow names the lens, title the page',
  // Added in Phase 4 of docs/plans/suicide-safer-care-pathway.md, when the
  // published protocol had to be reachable from the embedded SMART panel. Same
  // situation as MeasureDashboard above — a second page of a lens that has no
  // layout component to render a header for it — with one extra reason: in
  // panel chrome there is no sidebar, so the header's `up` back to the chart is
  // the page's only way out.
  'PathwayProtocol.tsx': 'the Patient View lens’s protocol page; the lens has no header-rendering layout, and in the panel its `up` is the only exit',
}

const errors = []
const fail = msg => errors.push(msg)

// ── Source scraping ────────────────────────────────────────────────────────────

const pageFiles = readdirSync(PAGES_DIR)
  .filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  .sort()

if (pageFiles.length === 0) fail('no page modules found under src/pages — nothing was checked')

/** The classes on the root element of the component this file is named for. */
function rootClasses(file, src) {
  const component = file.replace(/\.tsx$/, '')
  const declared = src.indexOf(`export function ${component}(`)
  if (declared === -1) {
    // Not fatal to the app, but fatal to this gate: without the root element it
    // cannot tell whether the page pads itself, and a check that cannot see its
    // subject must not report success.
    fail(`${file}: no \`export function ${component}(\` — cannot locate the page root`)
    return []
  }
  const match = /className="([^"]+)"/.exec(src.slice(declared))
  if (!match) {
    fail(`${file}: no literal className on the root element — cannot locate the page root`)
    return []
  }
  return match[1].trim().split(/\s+/)
}

/** The classes on the element that wraps an `<Outlet />`, if the page is a layout. */
function outletWrapperClasses(src) {
  const at = src.indexOf('<Outlet')
  if (at === -1) return []
  const before = src.slice(0, at)
  const last = before.lastIndexOf('className="')
  if (last === -1) return []
  const match = /className="([^"]+)"/.exec(before.slice(last))
  return match ? match[1].trim().split(/\s+/) : []
}

/** Page-root and layout-wrapper classes: the containers the shell's inset owns. */
const containers = new Map() // class → the file that declares it

/**
 * The same containers, kept apart by role, because RULE 5 asks a different
 * question of each: a page root that owns its header owns its width too, and
 * everything else must inherit one.
 */
const pageRoots = [] // { file, classes, ownsHeader }
const outletWrappers = [] // { file, classes }

/** Rules every templated page obeys, whichever family it belongs to. */
function checkSharedRules(file, src) {
  // RULE 1 — one header implementation. The markup lives in PageHeader.tsx, so
  // nowhere else may name its classes; a hand-rolled copy is how a "variant"
  // gets in without touching the component.
  //
  // Matched inside `className=` only, and with no trailing `\b`: the first
  // version of this rule used `/\bpage-header\b/` and a planted
  // `className="page-header__title"` sailed straight through it, because `_` is
  // a word character so there is no boundary after "header".
  if (/className=(?:"[^"]*|\{[^}]*)page-header/.test(src)) {
    fail(`${file}: uses a \`page-header\` class directly — render <PageHeader> instead (${HEADER_TSX} owns that markup)`)
  }

  // RULE 2 — the page title is the template's. PageHeader renders the page's
  // only <h2>; a page-level <h2> is either a second title or a section heading
  // at the wrong level.
  const h2 = /<h2[\s>]/.exec(src)
  if (h2) {
    const line = src.slice(0, h2.index).split('\n').length
    fail(`${file}:${line}: renders a raw <h2> — the page title comes from <PageHeader>; section headings start at <h3>`)
  }
}

for (const file of pageFiles) {
  const src = readFileSync(join(PAGES_DIR, file), 'utf8')
  checkSharedRules(file, src)

  // RULE 3 — exactly the declared lenses render a header.
  const rendersHeader = /<PageHeader\b/.test(src)
  const isLens = Object.hasOwn(LENSES, file)
  if (rendersHeader && !isLens) {
    fail(`${file}: renders <PageHeader> but is not in LENSES — a guide sub-page inherits its header from AdoptionGuide; add it to LENSES with a reason if this is really a new lens`)
  }
  if (isLens && !rendersHeader) {
    fail(`${file}: is declared a lens (${LENSES[file]}) but renders no <PageHeader>`)
  }

  const roots = rootClasses(file, src)
  const outlets = outletWrapperClasses(src)
  if (roots.length > 0) pageRoots.push({ file, classes: roots, ownsHeader: rendersHeader })
  if (outlets.length > 0) outletWrappers.push({ file, classes: outlets })

  for (const cls of [...roots, ...outlets]) {
    containers.set(cls, file)
  }
}

for (const file of Object.keys(LENSES)) {
  if (!pageFiles.includes(file)) fail(`LENSES names ${file}, which no longer exists under src/pages`)
}

// ── The form views ────────────────────────────────────────────────────────────
//
// The drill-in pages under the Patient View lens — every assessment and every
// workflow recorder — live in src/components rather than src/pages, because the
// routes point straight at them. They are recognized by the layout they render
// (`.form-wrapper`, the card-beside-debug-sidebar row) rather than by a list:
// membership is *derived*, so a thirteenth view is covered the day it is written
// and there is no allowlist to forget to add it to.
//
// All twelve used to render a `.breadcrumb` trail above a card whose header held
// the page title — a second trail implementation and a third place a title could
// live. RULE 4 says a view that uses the form layout must sit in a `.form-view`
// root and take its header from the template.
const COMPONENTS_DIR = join(ROOT, 'src/components')
const FORM_LAYOUT = 'form-wrapper'
const FORM_ROOT = 'form-view'

const formViews = readdirSync(COMPONENTS_DIR)
  .filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
  .filter(f => readFileSync(join(COMPONENTS_DIR, f), 'utf8').includes(`className="${FORM_LAYOUT}"`))
  .sort()

if (formViews.length === 0) {
  fail(`no form views found (nothing renders className="${FORM_LAYOUT}") — either they were renamed, in which case fix this check, or nothing here was verified`)
}

for (const file of formViews) {
  const src = readFileSync(join(COMPONENTS_DIR, file), 'utf8')
  checkSharedRules(file, src)

  const roots = rootClasses(file, src)
  if (!roots.includes(FORM_ROOT)) {
    fail(`${file}: renders the form layout but its root is \`${roots.join(' ') || '(none)'}\` — a form view's root is \`${FORM_ROOT}\`, so the header can sit above the layout instead of becoming a flex item in it`)
  }
  if (!/<PageHeader\b/.test(src)) {
    fail(`${file}: is a form view but renders no <PageHeader> — every drill-in page states where it is and how to get back out`)
  }

  pageRoots.push({ file, classes: roots, ownsHeader: /<PageHeader\b/.test(src) })
  for (const cls of roots) containers.set(cls, file)
}

// ── CSS walking ───────────────────────────────────────────────────────────────

/**
 * Yields every style rule, descending into @media / @supports blocks. `nested`
 * marks a rule that only applies under a condition — which matters for RULE 4a:
 * `.app-shell__body` also gets a padding inside a `max-width: 768px` query, and
 * counting that as proof would leave the desktop inset unguarded.
 */
function* styleRules(css, offset = 0, nested = false) {
  // Comments are blanked rather than removed, so reported line numbers still
  // match the file on disk.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  let depth = 0
  let start = 0
  let blockStart = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      if (depth === 0) blockStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        // `start` sits just past the previous rule's `}`, so it points at the
        // whitespace and blanked comments BEFORE this selector, not at the
        // selector. Reporting that offset put every message on the line the gap
        // began — `.overview` is on line 11 of Overview.css and was reported as
        // line 1, under a ten-line comment block. Measure the trim so the line
        // number names the rule someone has to go and edit.
        const raw = text.slice(start, blockStart)
        const prelude = raw.trim()
        const preludeAt = start + (raw.length - raw.trimStart().length)
        const body = text.slice(blockStart + 1, i)
        if (prelude.startsWith('@')) {
          if (/^@(media|supports|layer|container)/.test(prelude)) {
            const conditional = !/^@layer/.test(prelude)
            yield* styleRules(body, offset + blockStart + 1, nested || conditional)
          }
        } else if (prelude) {
          yield { selector: prelude, body, index: offset + preludeAt, nested }
        }
        start = i + 1
      }
    }
  }
}

const PADDING = /(^|[;{\s])padding(-(top|right|bottom|left|inline|block)(-(start|end))?)?\s*:/
/** A width ceiling, in either the physical or the logical spelling. */
const MAX_WIDTH = /(^|[;{\s])max-(width|inline-size)\s*:\s*([^;}]+)/g
/** The whole page-width vocabulary. A third value is drift, not a third option. */
const PAGE_WIDTHS = ['var(--page-width-prose)', 'var(--page-width-wide)']
/**
 * An auto inline margin, in every spelling that centres a block: the shorthand
 * with two or more values (`margin: 0 auto`), the logical pair, and the two
 * physical longhands. `margin: auto` alone counts too.
 */
const AUTO_INLINE_MARGIN =
  /(^|[;{\s])margin(-(inline|left|right))?(-(start|end))?\s*:\s*([^;}]*\bauto\b[^;}]*)/
/** The element the shell centres: whatever page root renders into the body. */
const CENTERING_OWNER = '.app-shell__body > *'
const lineOf = (src, index) => src.slice(0, index).split('\n').length

/**
 * Every stylesheet under src/, not just src/css/.
 *
 * This walked `src/css/*.css` alone at first, and a planted
 * `.form-view { padding: … }` — padding on a page root, the exact defect RULE 4b
 * exists for — passed green, because `.form-view` is declared in `src/App.css`
 * and App.css and index.css sit *beside* that directory rather than in it. Two
 * of the app's largest stylesheets were never read.
 */
function cssFilesUnder(dir, prefix = '') {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...cssFilesUnder(join(dir, entry.name), rel))
    else if (entry.name.endsWith('.css')) out.push(rel)
  }
  return out
}

const cssFiles = cssFilesUnder(SRC_DIR)
/** Which declared inset owners were actually found padding, unconditionally. */
const padsFound = new Set()
/** Where the shell's centring rule was found, for RULE 6. */
let centeringAt = null
/** class → where it sets an auto inline margin on itself. RULE 6 reads this. */
const selfCentered = new Map()

/**
 * class → the unconditional `max-width` values declared straight on it, with
 * where. RULE 5 reads this; only unconditional rules land here, for the same
 * reason RULE 4a ignores nested ones — a value that applies at one breakpoint
 * says nothing about the width the page renders at. The cost is stated on
 * RULE 5.
 */
const rootWidths = new Map()

for (const file of cssFiles) {
  const src = readFileSync(join(SRC_DIR, file), 'utf8')
  for (const rule of styleRules(src)) {
    const selectors = rule.selector.split(',').map(s => s.trim())
    const pads = PADDING.test(rule.body)
    const centers = AUTO_INLINE_MARGIN.test(rule.body)
    const at = `${file}:${lineOf(src, rule.index)}`

    for (const selector of selectors) {
      // RULE 4a — the shell really does pad the page, unconditionally. Without
      // this, every check below could pass while nothing padded anything: a
      // green gate over an app with no page inset at all.
      if (Object.hasOwn(INSET_OWNERS, selector) && pads && !rule.nested) padsFound.add(selector)

      // Gather for RULE 6 — the shell centres the page column, unconditionally.
      if (selector.replace(/\s+/g, ' ') === CENTERING_OWNER && centers && !rule.nested) {
        centeringAt = at
      }

      // Gather for RULE 5: a `max-width` set straight on a single class, not on
      // one of its descendants — `.foo .bar` styles the child, and a page's
      // *content* is free to cap its own measure (that is what
      // `--measure-prose` is for).
      const bare = /^\.([A-Za-z0-9_-]+)$/.exec(selector)
      if (bare && !rule.nested) {
        for (const m of rule.body.matchAll(MAX_WIDTH)) {
          if (!rootWidths.has(bare[1])) rootWidths.set(bare[1], [])
          rootWidths.get(bare[1]).push({ value: m[3].trim(), at })
        }
        if (centers && !selfCentered.has(bare[1])) selfCentered.set(bare[1], at)
      }

      // RULE 1 (CSS half) — no page-header rules outside PageHeader.css, so a
      // per-page override cannot reintroduce a variant from the stylesheet side.
      // No trailing `\b`, for the same reason as the TSX half above: it would
      // miss `.page-header__title`, since `_` is a word character. A planted
      // `.population-view .page-header__title { color: … }` — a per-page
      // override of the shared header, exactly what this forbids — passed green
      // until the boundary came off.
      if (/\.page-header/.test(selector) && file !== HEADER_CSS) {
        fail(`${at}: \`${selector}\` styles the shared header from outside ${HEADER_CSS} — the template has no per-page variants`)
      }

      if (!pads) continue

      // RULE 4b — no page root or layout wrapper pads itself, and neither do its
      // direct children as a group. `.app-shell__body` is the one owner.
      //
      // Limit, stated plainly: this sees the containers it can scrape from the
      // JSX (page roots, outlet wrappers) and their `> *` children. Padding
      // introduced on some *intermediate* wrapper inside a page is invisible to
      // it — that is a real hole, and the reason the comment in PageHeader.css
      // spells out where the inset comes from.
      for (const [cls, owner] of containers) {
        const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const self = new RegExp(`^\\.${escaped}$`)
        const kids = new RegExp(`^\\.${escaped}\\s*>`)
        if (self.test(selector)) {
          fail(`${at}: \`${selector}\` pads a page root (${owner}) — .app-shell__body owns the page inset`)
        } else if (kids.test(selector)) {
          fail(`${at}: \`${selector}\` pads the direct children of a page container (${owner}) — .app-shell__body owns the page inset`)
        }
      }
    }
  }
}

for (const [selector, owner] of Object.entries(INSET_OWNERS)) {
  if (!padsFound.has(selector)) {
    fail(
      `no unconditional \`${selector} { padding: … }\` rule found (${owner}) — ` +
        'a declared inset owner that pads nothing means that chrome has no page ' +
        'inset at all, and the checks above are vacuous for it',
    )
  }
}

// ── RULE 5 — one owner of the page width ──────────────────────────────────────
//
// The sibling of RULE 4, and it exists for the same defect one property over.
// `.app-shell__body` owns the page inset; the question here is who owns the
// page *measure*, and the answer has to be one place per route.
//
// index.css says the vocabulary is two tokens, `--page-width-prose` and
// `--page-width-wide`. Nothing enforced that, and it had gone: seven page roots
// hardcoded pixels, four of them at values that are neither token, so the
// Adoption Guide's seven sections rendered at FIVE different widths — 1200 /
// 960 / 1200 / 1040 / 820 / 1040 / 900 — while the sidebar's pager walked a
// reader straight through them. Two mistakes were tangled together there:
//
//   a. a root declaring a width that is not one of the two tokens. `1200px` was
//      the worst of these precisely because it *looked* right: it is the value
//      of `--page-width-wide` today, so the page agreed with the template by
//      coincidence and would stop the moment the token moved.
//   b. a root declaring a width at all when it renders inside a layout that
//      already set one. `.implementation-guide` is `--page-width-wide`; a
//      sub-page that also sets a width is two owners for one number, which is
//      exactly the shape of the padding bug RULE 4 was written for.
//
// So the rule keys off header ownership, which the checks above already know
// and which is the same distinction: a page that renders its own <PageHeader>
// is the top of its own route and owns both; a page that inherits its header
// from a layout inherits the layout's width too. No second allowlist — this
// falls out of RULE 3's data.
//
// ⚠️ Limits, stated rather than discovered later. It reads unconditional rules
// only, so a `max-width` inside a media query is invisible to it (there are
// none on a page root today; RULE 4a ignores nested rules for the same reason).
// And like RULE 4b it sees the containers it can scrape from the JSX, so a
// width put on some intermediate wrapper inside a page is out of its view.
{
  const widthsOf = classes =>
    classes.flatMap(cls => (rootWidths.get(cls) ?? []).map(d => ({ cls, ...d })))

  let tokenedRoots = 0

  for (const { file, classes, ownsHeader } of pageRoots) {
    const found = widthsOf(classes)

    if (!ownsHeader) {
      // RULE 5a — a page that inherits its header inherits its width.
      for (const d of found) {
        fail(
          `${d.at}: \`.${d.cls}\` sets \`max-width: ${d.value}\` on a page root that renders no <PageHeader> (${file}) — ` +
            'it renders inside a layout that already set a width; cap the text run with `--measure-prose` if the prose needs a narrower measure',
        )
      }
      continue
    }

    // RULE 5b — a page that owns its header declares exactly one page width,
    // and it is one of the two tokens.
    if (found.length === 0) {
      fail(
        `${file}: renders <PageHeader> but no page width is declared on its root (\`${classes.map(c => `.${c}`).join(' ')}\`) — ` +
          `pick ${PAGE_WIDTHS.join(' or ')}`,
      )
      continue
    }
    if (found.length > 1) {
      fail(
        `${file}: its root declares ${found.length} page widths (${found.map(d => `.${d.cls} → ${d.value} at ${d.at}`).join('; ')}) — one root, one width`,
      )
    }
    for (const d of found) {
      if (!PAGE_WIDTHS.includes(d.value)) {
        fail(
          `${d.at}: \`.${d.cls}\` sets \`max-width: ${d.value}\` on a page root (${file}) — ` +
            `the page-width vocabulary is ${PAGE_WIDTHS.join(' and ')}, and nothing else. ` +
            'A raw length that happens to equal a token still stops tracking it',
        )
      } else {
        tokenedRoots++
      }
    }
  }

  // RULE 5c — a layout's outlet wrapper is not a second place for a width. The
  // root above it already declared one, and this is where a "just for the guide"
  // override would land.
  for (const { file, classes } of outletWrappers) {
    for (const d of widthsOf(classes)) {
      fail(
        `${d.at}: \`.${d.cls}\` sets \`max-width: ${d.value}\` on a layout's outlet wrapper (${file}) — ` +
          'the layout root owns the width; an outlet wrapper that narrows it makes the sub-pages disagree with their own header',
      )
    }
  }

  // Liveness. Every check above is satisfied by an app in which no page
  // declares a width at all, which is the #232 / #261 failure mode: a green
  // gate over nothing. If the tokens stop being used, this must go red.
  if (tokenedRoots === 0) {
    fail(
      `no page root declares ${PAGE_WIDTHS.join(' or ')} — either the tokens were renamed, in which case fix ` +
        'PAGE_WIDTHS here, or nothing about page width was verified',
    )
  }
}

// ── RULE 6 — one owner of where the page column sits ─────────────────────────
//
// The third of the same family. RULE 4 asks who owns the page inset and RULE 5
// who owns the page width; neither asked who owns the page's *horizontal
// placement*, so nothing did, and the answer was the initial value: flush left.
//
// That is not a cosmetic default. The leftover space is whatever the viewport
// has over the width token, so it grew with the screen AND differed per page —
// at 1920px a `--page-width-wide` page used 74% of the content area and a
// `--page-width-prose` page 56%, leaving a 716px void beside the front door.
// Every root was already on one of the two tokens and RULE 5 was green, so the
// app still read as "the widths are all over the place": moving from Overview
// to any other page slid the content's right edge 300px sideways instead of
// growing the column around a fixed axis.
//
// So, exactly as with the inset: one owner, and it is the shell.
//
// ⚠️ 6a is the liveness half, and it is the one that matters. Every check in
// this file is satisfied by an app that centres nothing — the #232 / #261
// failure mode — so the rule that the shell DOES centre has to be asserted
// positively, not merely left unviolated. Same shape as RULE 4a.
if (!centeringAt) {
  fail(
    `no unconditional \`${CENTERING_OWNER} { margin-inline: auto }\` rule found — ` +
      'the shell is what centres the page column (AppShell.css). Without it every page ' +
      'is flush left and the space left over piles up on the right, differently per ' +
      'width token; nothing else in this gate would notice',
  )
}

// 6b — and no page root or layout wrapper centres itself. The shell already
// does it for all of them, so a root that repeats it is the double-ownership
// RULE 4b and RULE 5c each forbid one property over: six of seven agreeing is a
// disagreement nobody can see.
for (const [cls, owner] of containers) {
  const at = selfCentered.get(cls)
  if (at) {
    fail(
      `${at}: \`.${cls}\` centres itself with an auto inline margin (${owner}) — ` +
        `${CENTERING_OWNER} already centres every page root; one owner of where the column sits`,
    )
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\n✗ page template: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`)
  for (const e of errors) console.error(`  • ${e}`)
  console.error('\n  See web/src/components/PageHeader.tsx for what the template is and why.\n')
  process.exit(1)
}

console.log(
  `✓ page template: ${pageFiles.length} pages (${Object.keys(LENSES).length} lens headers), ` +
    `${formViews.length} form views, ` +
    `${Object.keys(INSET_OWNERS).length} inset owners, ` +
    `${pageRoots.length} page roots (${pageRoots.filter(r => r.ownsHeader).length} owning a page width), ` +
    `${containers.size} containers checked against ${cssFiles.length} stylesheets`,
)
