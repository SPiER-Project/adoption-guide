#!/usr/bin/env node
/**
 * check:template — the page template is one template.
 *
 * Every route under the EHR shell renders into `.ehr-content-body`, which pads
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
const CSS_DIR = join(ROOT, 'src/css')
const HEADER_TSX = 'src/components/PageHeader.tsx'
const HEADER_CSS = 'PageHeader.css'

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
const LENSES = {
  'Overview.tsx': 'the front door: brand eyebrow + the project tagline as title',
  'AdoptionGuide.tsx': 'the /guide layout — renders the header for all nine sub-pages',
  'PopulationView.tsx': 'single-page lens, so its eyebrow names the project rather than a section',
  'PatientChart.tsx': 'the Patient View lens; eyebrow names the lens, title the page',
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

for (const file of pageFiles) {
  const src = readFileSync(join(PAGES_DIR, file), 'utf8')

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

  // RULE 3 — exactly the declared lenses render a header.
  const rendersHeader = /<PageHeader\b/.test(src)
  const isLens = Object.hasOwn(LENSES, file)
  if (rendersHeader && !isLens) {
    fail(`${file}: renders <PageHeader> but is not in LENSES — a guide sub-page inherits its header from AdoptionGuide; add it to LENSES with a reason if this is really a new lens`)
  }
  if (isLens && !rendersHeader) {
    fail(`${file}: is declared a lens (${LENSES[file]}) but renders no <PageHeader>`)
  }

  for (const cls of [...rootClasses(file, src), ...outletWrapperClasses(src)]) {
    containers.set(cls, file)
  }
}

for (const file of Object.keys(LENSES)) {
  if (!pageFiles.includes(file)) fail(`LENSES names ${file}, which no longer exists under src/pages`)
}

// ── CSS walking ───────────────────────────────────────────────────────────────

/**
 * Yields every style rule, descending into @media / @supports blocks. `nested`
 * marks a rule that only applies under a condition — which matters for RULE 4a:
 * `.ehr-content-body` also gets a padding inside a `max-width: 768px` query, and
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
        const prelude = text.slice(start, blockStart).trim()
        const body = text.slice(blockStart + 1, i)
        if (prelude.startsWith('@')) {
          if (/^@(media|supports|layer|container)/.test(prelude)) {
            const conditional = !/^@layer/.test(prelude)
            yield* styleRules(body, offset + blockStart + 1, nested || conditional)
          }
        } else if (prelude) {
          yield { selector: prelude, body, index: offset + start, nested }
        }
        start = i + 1
      }
    }
  }
}

const PADDING = /(^|[;{\s])padding(-(top|right|bottom|left|inline|block)(-(start|end))?)?\s*:/
const lineOf = (src, index) => src.slice(0, index).split('\n').length

const cssFiles = readdirSync(CSS_DIR).filter(f => f.endsWith('.css')).sort()
let shellPadsThePage = false

for (const file of cssFiles) {
  const src = readFileSync(join(CSS_DIR, file), 'utf8')
  for (const rule of styleRules(src)) {
    const selectors = rule.selector.split(',').map(s => s.trim())
    const pads = PADDING.test(rule.body)
    const at = `${file}:${lineOf(src, rule.index)}`

    for (const selector of selectors) {
      // RULE 4a — the shell really does pad the page, unconditionally. Without
      // this, every check below could pass while nothing padded anything: a
      // green gate over an app with no page inset at all.
      if (selector === '.ehr-content-body' && pads && !rule.nested) shellPadsThePage = true

      // RULE 1 (CSS half) — no page-header rules outside PageHeader.css, so a
      // per-page override cannot reintroduce a variant from the stylesheet side.
      if (/\.page-header\b/.test(selector) && file !== HEADER_CSS) {
        fail(`${at}: \`${selector}\` styles the shared header from outside ${HEADER_CSS} — the template has no per-page variants`)
      }

      if (!pads) continue

      // RULE 4b — no page root or layout wrapper pads itself, and neither do its
      // direct children as a group. `.ehr-content-body` is the one owner.
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
          fail(`${at}: \`${selector}\` pads a page root (${owner}) — .ehr-content-body owns the page inset`)
        } else if (kids.test(selector)) {
          fail(`${at}: \`${selector}\` pads the direct children of a page container (${owner}) — .ehr-content-body owns the page inset`)
        }
      }
    }
  }
}

if (!shellPadsThePage) {
  fail('no unconditional `.ehr-content-body { padding: … }` rule found — the shell must own the page inset, or the checks above are vacuous')
}

// ── Report ────────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\n✗ page template: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`)
  for (const e of errors) console.error(`  • ${e}`)
  console.error('\n  See web/src/components/PageHeader.tsx for what the template is and why.\n')
  process.exit(1)
}

console.log(
  `✓ page template: ${pageFiles.length} pages, ${Object.keys(LENSES).length} lens headers, ` +
    `${containers.size} containers checked against ${cssFiles.length} stylesheets`,
)
