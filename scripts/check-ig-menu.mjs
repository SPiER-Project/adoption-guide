#!/usr/bin/env node
/**
 * IG menu gate — every `menu:` entry in sushi-config.yaml resolves to a page,
 * and `menu:` and `pages:` agree in both directions.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * A page needs BOTH blocks and they do different jobs: `menu:` makes it
 * reachable, `pages:` is what makes the publisher render it at all. The menu is
 * rendered onto EVERY page, so a menu target the publisher never renders is one
 * broken link per page: adding `Care Pathway: care-pathway.html` to `menu:`
 * alone took this IG from 0 to **1812** broken links, with `err = 0` and a green
 * SUSHI run, and the `publish` job's broken-link gate was the only thing that
 * caught it — 5 minutes of Java after a green local run. SUSHI compiles clean
 * either way, because the `.md` file genuinely exists.
 *
 * ─── History: checks A and B, retired 2026-09-16 ─────────────────────────────
 *
 * This gate began (#409/#410) as a comparison between `menu:` and a "## The
 * menu" section in how-to-read.md that restated the navigation in prose — a
 * hand-duplicated constant one layer up from code, which had drifted twice
 * (two live entries missing; a **Downloads** bullet describing a page that never
 * existed, so `/ig/downloads.html` was a 404 for the guide's whole life while
 * its own map sent readers to it). The IG cleanup removed the restatement: the
 * navigation bar is the menu, and Home's "Find what you need" table sends
 * readers by task, with every link in it resolved by check-ig-narrative's check
 * H. With no prose to compare, checks A (entry sets agree) and B (a bullet's
 * links are exactly its entry's pages) have nothing to assert and are gone. If
 * a prose restatement ever comes back, so must they — a menu described in
 * prose and defined in YAML will drift again.
 *
 * ─── Why it lives here and not in `web`'s verify ─────────────────────────────
 *
 * Both inputs are under `ig/`, like `check-sushi-output.mjs` and `check-fml.mjs`.
 * `ig.yml` triggers on `ig/**`; `web-lint.yml` does not, so a `sushi-config.yaml`-only
 * edit would leave a `web`-hosted gate idle for exactly the change that breaks it.
 * It needs no dependencies and no SUSHI compile, so it runs in milliseconds —
 * and BEFORE the compile in `ig.yml`, which is why `check-ig-narrative.mjs`
 * (checks E–H over the page PROSE, two of which need `fsh-generated/`) is a
 * separate script sharing this one's parsers through `lib/ig-config.mjs`.
 *
 * ─── What it asserts ─────────────────────────────────────────────────────────
 *
 *   C. Every `menu:` target resolves to a real `input/pagecontent/<name>.md`, or
 *      is a page the IG Publisher generates (allowlist with reasons, below).
 *      This is what stops a drift being "fixed" in the wrong direction — adding
 *      `Downloads: downloads.html` to `menu:` would ship a broken link.
 *   D. `menu:` and `pages:` agree, in BOTH directions. The reverse direction is
 *      the milder defect of the same shape — a page the publisher renders that
 *      nothing navigates to (`UNLISTED_PAGES` is the allowlist, empty today).
 *
 * The letters are kept so the history above and the docs that cite "check D"
 * still read true.
 *
 * Reading nothing is an ERROR, not a pass (#232, #261, and four more since): a
 * missing `menu:` block or zero entries parsed fails. So does any YAML form the
 * parser does not understand — a quiet parse failure is how a gate reports
 * green over a file it never read, which is the same rule
 * `web/scripts/lib/vite-alias.mjs` follows.
 *
 * Node 22 is the floor (`.github/.nvmrc`, read by every workflow). It was 20,
 * and two gates shipped that threw in CI on Node 22-only syntax (`fs.globSync`,
 * `Iterator.prototype.map`) while passing locally. The floor moving to 22 is
 * what removes that asymmetry — see docs/internals/build-gotchas.md.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// `parsePages`, GENERATED_PAGES and the path helpers are shared with
// `check-ig-narrative.mjs` (checks E–H) rather than written twice — see that
// file's header for why the two are separate gates.
import {
  CONFIG,
  PAGECONTENT,
  GENERATED_PAGES,
  rel,
  makeBail,
  parsePages,
} from './lib/ig-config.mjs'

/**
 * Pages the publisher renders that the menu deliberately does not navigate to,
 * and why each is legitimate — check D's reverse direction. Empty today, and
 * that is the finding: every page this IG renders is reachable from its menu.
 * A page reached only from body text would belong here, with the page that
 * links it named.
 *
 * @type {Record<string, string>}
 */
const UNLISTED_PAGES = {}

const bail = makeBail('check-ig-menu')

// --- Parse `menu:` out of sushi-config.yaml ---------------------------------
//
// A deliberately strict two-level block-map reader rather than a YAML dependency
// (there is no root package.json). It throws on any form it does not understand,
// so an unreadable menu fails loudly instead of parsing as empty.
function parseMenu(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^menu:\s*$/.test(l))
  if (start === -1) bail(`no \`menu:\` block in ${rel(CONFIG)} — nothing to compare against`)

  /** @type {{ key: string, target: string | null, children: Map<string, string> }[]} */
  const entries = []

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '' || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) break // dedent to column 0 ends the block

    const top = /^ {2}(\S.*?)\s*$/.exec(line)
    const child = /^ {4}(\S.*?)\s*$/.exec(line)

    if (top) {
      const m = /^(.+?):(?:\s+(.*))?$/.exec(top[1])
      if (!m) bail(`unparseable \`menu:\` line in ${rel(CONFIG)}:${i + 1} — ${line.trim()}`)
      if (/["'|>&*]/.test(m[1])) {
        bail(`\`menu:\` key at ${rel(CONFIG)}:${i + 1} uses YAML syntax this parser does not read — ${m[1]}`)
      }
      entries.push({ key: m[1], target: m[2] ? m[2].trim() : null, children: new Map() })
    } else if (child) {
      const parent = entries[entries.length - 1]
      if (!parent) bail(`indented \`menu:\` entry with no parent at ${rel(CONFIG)}:${i + 1}`)
      if (parent.target) {
        bail(`\`menu:\` entry "${parent.key}" has both a target and children (${rel(CONFIG)}:${i + 1})`)
      }
      const m = /^(.+?):\s+(.+?)\s*$/.exec(child[1])
      if (!m) bail(`unparseable \`menu:\` child at ${rel(CONFIG)}:${i + 1} — ${line.trim()}`)
      parent.children.set(m[1], m[2])
    } else {
      bail(`unexpected indentation in \`menu:\` at ${rel(CONFIG)}:${i + 1} — ${JSON.stringify(line)}`)
    }
  }

  if (entries.length === 0) bail(`parsed 0 entries from \`menu:\` in ${rel(CONFIG)} — refusing to pass vacuously`)
  for (const e of entries) {
    if (!e.target && e.children.size === 0) bail(`\`menu:\` entry "${e.key}" has neither a target nor children`)
  }
  return entries
}

const menu = parseMenu(readFileSync(CONFIG, 'utf8'))
const pages = parsePages(readFileSync(CONFIG, 'utf8'), bail)

const problems = []

// --- C. Every menu target is a real page ------------------------------------
const targets = []
for (const e of menu) {
  if (e.target) targets.push([e.key, e.target])
  for (const [k, t] of e.children) targets.push([`${e.key} › ${k}`, t])
}

for (const [label, target] of targets) {
  if (GENERATED_PAGES[target]) continue
  if (!/^[\w-]+\.html$/.test(target)) {
    problems.push(`\`menu:\` entry "${label}" points at "${target}", which is not a local page`)
    continue
  }
  const source = resolve(PAGECONTENT, target.replace(/\.html$/, '.md'))
  if (!existsSync(source)) {
    problems.push(
      `\`menu:\` entry "${label}" points at ${target}, but ${rel(source)} does not exist ` +
        `and ${target} is not in GENERATED_PAGES — the menu would render a broken link`,
    )
  }
}

// --- D. `menu:` and `pages:` agree, both directions -------------------------
const pageSet = new Set(pages)
const menuPages = new Set()

for (const [label, target] of targets) {
  if (GENERATED_PAGES[target]) continue
  if (!/^[\w-]+\.html$/.test(target)) continue // already reported by check C
  const md = target.replace(/\.html$/, '.md')
  menuPages.add(md)
  if (!pageSet.has(md)) {
    problems.push(
      `\`menu:\` entry "${label}" points at ${target}, but ${md} is not in the \`pages:\` block — ` +
        'the publisher renders no such page, and the menu is on EVERY page, so this is one broken link ' +
        'per rendered page rather than one. A page needs both blocks.',
    )
  }
}

for (const md of pages) {
  if (menuPages.has(md)) continue
  if (UNLISTED_PAGES[md]) continue
  problems.push(
    `\`pages:\` renders ${md}, but no \`menu:\` entry navigates to ${md.replace(/\.md$/, '.html')} — ` +
      'the page ships unreachable. If that is intentional, add it to UNLISTED_PAGES in this script ' +
      'with the page that links it.',
  )
}

// --- Report -----------------------------------------------------------------
if (problems.length) {
  console.error(`\n✗ check-ig-menu: ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error(`\n  A page needs BOTH \`menu:\` and \`pages:\` in ${rel(CONFIG)}; every target must be a real page.\n`)
  process.exit(1)
}

const childCount = menu.reduce((n, e) => n + e.children.size, 0)
console.log(
  `✓ check-ig-menu: ${menu.length} menu entries (${childCount} sub-entries) in ${rel(CONFIG)}, ` +
    `every target resolves to a page.`,
)
console.log(
  `  ${pages.length} \`pages:\` entries agree with \`menu:\` in both directions ` +
    `(${Object.keys(UNLISTED_PAGES).length} deliberately unlinked).`,
)
