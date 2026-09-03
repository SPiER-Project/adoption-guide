#!/usr/bin/env node
/**
 * IG narrative gate — what the guide's prose is allowed to say, and whether the
 * things it points at exist.
 *
 * ─── Why this is a sibling of check-ig-menu.mjs, not more of it ──────────────
 *
 * #410's `check-ig-menu.mjs` compares the guide's navigation against
 * `sushi-config.yaml` (checks A–D). This file adds checks E–H over
 * `ig/input/pagecontent/*.md` and shares that gate's `pages:` reader and
 * GENERATED_PAGES allowlist through `lib/ig-config.mjs`, rather than becoming a
 * second reader of the same file.
 *
 * They are two scripts for one concrete reason: **when they can run.**
 * `check-ig-menu.mjs` needs neither SUSHI nor the network, so `ig.yml` runs it
 * BEFORE the compile — a documented property worth keeping, since it fails in
 * milliseconds on the mistake most likely to be made. Checks F and H resolve
 * against `ig/fsh-generated/resources/`, so this gate can only run AFTER it.
 * Folding E–H into the menu gate would have pushed the whole thing past the
 * compile; making F and H degrade when `fsh-generated/` is absent would have
 * been worse, since a gate that quietly checks less is how #232 and #261
 * happened. So: two scripts, two positions in the pipeline, one set of parsers.
 *
 * ─── What it asserts ─────────────────────────────────────────────────────────
 *
 *   E. No repo internals. An IG page is read by implementers who do not have
 *      this repo, so `web/src`, `packages/`, `npm run`, `scripts/`, `.mjs`,
 *      `vitest`, `sushi-config`, `path-binary` and `#NNN` issue references are
 *      all addressed to the wrong reader. Per the content contract in
 *      docs/plans/docs-and-ig-content-consolidation.md, build/gate/tooling
 *      prose has one home — CLAUDE.md — and "never in an IG page". A3 cleaned
 *      these out by hand; this keeps them out. There is deliberately no opt-out
 *      marker until a real need appears.
 *
 *   F. Every `TL-0NN` resolves to a published tool id. These are SPiER's own
 *      tool ids, and until task C2 the IG published none of them — so an IG
 *      page naming `TL-017` named something no reader could resolve to any
 *      artifact, which is why A3 stripped them out of the prose entirely. They
 *      are now `ActivityDefinition.identifier` values, so the rule is
 *      resolvability rather than prohibition: a `TL-` id must be one an
 *      ActivityDefinition actually carries.
 *
 *      Zero mentions is a legitimate state, and today's: the prose links AD
 *      pages under the tool's *name*, which is better for a reader than a bare
 *      id. F does not enforce that preference — it enforces that an id, if
 *      used, resolves.
 *
 *   G. Every link into the demo app resolves to a live route. `#/<route>` must
 *      match a NON-LEGACY route in `web/src/App.tsx`, and `#/guide/<x>` must
 *      also be a section in `web/src/data/guideSections.ts`. "Non-legacy"
 *      matters: `/guide/roadmap` and `/guide/measures` still *exist* as
 *      `<Navigate>` redirects, so a naive route scan would call a link to a
 *      deleted page fine. Three pages linked `#/guide/roadmap` after #440
 *      removed that section; A1 retargeted them, and this keeps them fixed.
 *
 *      ⚠️ This reads `web/src`, so `ig.yml` triggers on those two files too — a
 *      route rename breaks the IG's links with no `ig/` change at all.
 *
 *   H. Every internal `.html` link resolves. A `](<name>.html)` must be a
 *      `pages:` entry, an artifact page the publisher will emit, or one of the
 *      generated pages check C already allowlists.
 *
 *      H is the OWNER of `.html` links. `scripts/check-md-links.mjs` (C1a)
 *      checks relative *file* links across every tracked `.md` and skips
 *      `.html` precisely so this check keeps that half: the publisher resolves
 *      those at render time from `input/pagecontent/` and from the resources it
 *      loads, which a plain file-existence test cannot model. Do not extend
 *      C1a to cover them.
 *
 *      Anchors are checked as far as the page, like C1a's `:137` line suffixes.
 *      Heading-to-anchor slugification is the publisher's, and asserting it
 *      here would encode a second guess at someone else's algorithm.
 *
 * ─── Properties, per this repo's gate discipline ─────────────────────────────
 *
 * Reading nothing is an ERROR, not a pass (#232, #261, and several since): zero
 * pages, zero routes, zero guide sections, or an empty `fsh-generated/` all
 * fail. Where zero *occurrences* of a pattern is a legitimate state (F's tool
 * ids, G's app links), the liveness assertion is on the index the check would
 * resolve against, not on the count of hits — so the check cannot go quiet
 * because its inputs vanished.
 *
 * Shapes are asserted, never counts. A pinned number churns on every page added
 * and trains people to bump it, which is what a stale `check:codings` floor
 * already did in #232.
 *
 * Node 20 is part of the contract: every workflow pins it, and this repo has
 * already shipped two gates that threw in CI on Node 22-only syntax.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

import {
  ROOT,
  PAGECONTENT,
  FSH_GENERATED,
  GENERATED_PAGES,
  rel,
  makeBail,
  readConfig,
  parsePages,
  parsePathResource,
} from './lib/ig-config.mjs'

const bail = makeBail('check-ig-narrative')

const APP_TSX = resolve(ROOT, 'web/src/App.tsx')
const GUIDE_SECTIONS_TS = resolve(ROOT, 'web/src/data/guideSections.ts')

const problems = []
const flag = (msg) => problems.push(msg)

// ─── Load the pages ─────────────────────────────────────────────────────────

if (!existsSync(PAGECONTENT)) bail(`${rel(PAGECONTENT)} does not exist — there is no narrative to check`)

const pageFiles = readdirSync(PAGECONTENT)
  .filter((f) => f.endsWith('.md'))
  .sort()
if (pageFiles.length === 0) {
  bail(`no *.md files in ${rel(PAGECONTENT)} — refusing to pass vacuously over an unread page tree`)
}
const pageDocs = pageFiles.map((file) => ({
  file,
  lines: readFileSync(join(PAGECONTENT, file), 'utf8').split('\n'),
}))

/** Report a finding against a page, with the line the reader can open. */
const at = (doc, i, msg) => flag(`ig/input/pagecontent/${doc.file}:${i + 1} — ${msg}`)

// ─── E. No repo internals ───────────────────────────────────────────────────
//
// Each pattern carries what it is and why an IG reader cannot use it, because a
// gate failure that only says "matched /packages\//" leaves the author guessing
// at what to write instead.
const INTERNALS = [
  ['app source paths', /\bweb\/src\b/g, 'the app is a demo of the artifacts, not part of them; describe the behaviour or link the running app'],
  ['monorepo package paths', /\bpackages\//g, 'the reader does not have this repo checked out'],
  ['npm commands', /\bnpm run\b/g, 'build and gate instructions belong in CLAUDE.md, which is the one home for them'],
  ['repo script paths', /\bscripts\//g, 'a script name tells an implementer nothing they can run'],
  ['Node script filenames', /\.mjs\b/g, 'these are this repo\'s gates, not part of the specification'],
  ['the test runner', /\bvitest\b/gi, 'how SPiER tests itself is not IG content'],
  ['the SUSHI config', /\bsushi-config\b/g, 'how this IG is built is not part of what it specifies'],
  ['an IG-Publisher parameter', /\bpath-binary\b/g, 'a build parameter; its rationale lives in the config and in CLAUDE.md'],
  // GitHub issue references. The lookarounds keep LOINC/SNOMED codes and page
  // anchors out: `#93374-7` must not match as `#93374`, and `#harmonization`
  // is letters. Bounded to four digits for the same reason.
  ['GitHub issue references', /(?<![\w#-])#\d{1,4}(?![\d-])/g, 'issue numbers are repo history; state the decision itself, or cite the artifact that carries it'],
]

let internalsScanned = 0
for (const doc of pageDocs) {
  doc.lines.forEach((line, i) => {
    internalsScanned++
    for (const [what, re, why] of INTERNALS) {
      re.lastIndex = 0
      const m = re.exec(line)
      if (m) {
        at(doc, i, `mentions ${what} ("${m[0]}") — ${why}`)
      }
    }
  })
}

// ─── The artifact index (F and H both need it) ──────────────────────────────
//
// Read resourceType + id out of each generated resource rather than trusting
// the filename, since the page the publisher emits is named from the resource.
if (!existsSync(FSH_GENERATED)) {
  bail(
    `${rel(FSH_GENERATED)} does not exist — run \`npx fsh-sushi .\` in ig/ first. Checks F and H ` +
      `resolve against it, and this gate will not run them against a missing index.`,
  )
}

/** `<ResourceType>-<id>.html` pages the publisher will emit. */
const artifactPages = new Set()
/** Tool ids carried by an ActivityDefinition identifier — check F's index. */
const publishedToolIds = new Set()
const TOOL_ID_SYSTEM_HINT = '/identifier/tool-id'

let generatedRead = 0
for (const file of readdirSync(FSH_GENERATED)) {
  if (!file.endsWith('.json')) continue
  let res
  try {
    res = JSON.parse(readFileSync(join(FSH_GENERATED, file), 'utf8'))
  } catch {
    bail(`${rel(join(FSH_GENERATED, file))} is not readable JSON — the artifact index would be incomplete`)
  }
  if (typeof res?.resourceType !== 'string' || typeof res?.id !== 'string') continue
  generatedRead++
  artifactPages.add(`${res.resourceType}-${res.id}.html`)
  if (res.resourceType === 'ActivityDefinition') {
    for (const ident of res.identifier ?? []) {
      if (typeof ident?.system === 'string' && ident.system.endsWith(TOOL_ID_SYSTEM_HINT)) {
        if (typeof ident.value === 'string') publishedToolIds.add(ident.value)
      }
    }
  }
}
if (generatedRead === 0) {
  bail(
    `read 0 resources from ${rel(FSH_GENERATED)} — checks F and H would resolve every reference ` +
      `against an empty index and pass vacuously`,
  )
}

// Hand-authored resources the publisher loads via `path-resource` — see
// parsePathResource for why the five FML StructureMaps depend on this.
const configText = readConfig()
for (const dir of parsePathResource(configText, bail)) {
  const abs = resolve(ROOT, 'ig', dir)
  if (!existsSync(abs)) {
    bail(
      `\`path-resource\` names ${dir}, but ${rel(abs)} does not exist — the publisher loads that ` +
        `directory, so check H cannot resolve links to what is in it`,
    )
  }
  for (const file of readdirSync(abs)) {
    if (file.endsWith('.json')) {
      try {
        const res = JSON.parse(readFileSync(join(abs, file), 'utf8'))
        if (typeof res?.resourceType === 'string' && typeof res?.id === 'string') {
          artifactPages.add(`${res.resourceType}-${res.id}.html`)
        }
      } catch {
        bail(`${rel(join(abs, file))} is not readable JSON — the artifact index would be incomplete`)
      }
    } else if (file.endsWith('.fml')) {
      // `map "<canonical>/StructureMap/<id>" = "<name>"` — the id is what names
      // the rendered page.
      const text = readFileSync(join(abs, file), 'utf8')
      const m = /^map\s+"([^"]*\/StructureMap\/([^"/]+))"/m.exec(text)
      if (!m) {
        bail(
          `${rel(join(abs, file))} has no \`map "…/StructureMap/<id>" = …\` header this gate can read — ` +
            `its rendered page name is unknown, so a link to it could not be resolved`,
        )
      }
      artifactPages.add(`StructureMap-${m[2]}.html`)
    }
  }
}

// ─── F. Tool ids resolve ────────────────────────────────────────────────────
if (publishedToolIds.size === 0) {
  bail(
    `no ActivityDefinition in ${rel(FSH_GENERATED)} carries a tool-id identifier — check F would ` +
      `resolve every TL- id against an empty set. See ig/input/fsh/tool-id-identifier.fsh.`,
  )
}

for (const doc of pageDocs) {
  doc.lines.forEach((line, i) => {
    for (const m of line.matchAll(/\bTL-\d+\b/g)) {
      if (!publishedToolIds.has(m[0])) {
        at(
          doc,
          i,
          `names tool id ${m[0]}, which no ActivityDefinition carries as an identifier — a reader ` +
            `cannot resolve it to any artifact. Check the id, or link the ActivityDefinition page ` +
            `under the tool's name instead (which is what the rest of the guide does).`,
        )
      }
    }
  })
}

// ─── G. App links resolve ───────────────────────────────────────────────────
//
// Parse App.tsx's <Route> tree into full paths. A scanner rather than a line
// regex, because a JSX attribute list wraps across lines and `element={…}`
// nests its own tags: `path="assessments/phq-9"` and its element sit on
// different lines throughout that file.
function parseRoutes(src) {
  /** @type {{ path: string, live: boolean, index: boolean }[]} */
  const routes = []
  /** @type {string[]} */
  const stack = [] // path prefixes of enclosing <Route> elements
  let tagsRead = 0

  for (let i = 0; i < src.length; i++) {
    if (src.startsWith('</Route>', i)) {
      stack.pop()
      i += 7
      continue
    }
    if (!src.startsWith('<Route', i)) continue
    // Not `<Routes>`.
    if (/[A-Za-z]/.test(src[i + 6] ?? '')) continue

    // Read to the end of the tag, tracking strings and JSX expression braces so
    // a `>` inside `element={<X a=">" />}` does not end it early.
    let j = i + 6
    let depth = 0
    let quote = null
    for (; j < src.length; j++) {
      const c = src[j]
      if (quote) {
        if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') { depth++; continue }
      if (c === '}') { depth--; continue }
      if (c === '>' && depth === 0) break
    }
    if (j >= src.length) {
      bail(`${rel(APP_TSX)}: unterminated <Route> tag — the route tree cannot be parsed, so check G would report nothing`)
    }
    const attrs = src.slice(i + 6, j)
    const selfClosing = src[j - 1] === '/'
    tagsRead++

    const pathAttr = /\bpath="([^"]*)"/.exec(attrs)?.[1]
    const isIndex = /(^|\s)index(\s|$|=)/.test(attrs)
    const element = /\belement=\{([\s\S]*)\}\s*\/?$/.exec(attrs)?.[1] ?? ''

    // A redirect is not a destination. `<Navigate>` and the three
    // `Legacy*Redirect` wrappers exist so old URLs keep working; a page linking
    // one is linking something that was moved or deleted.
    //
    // ⚠️ With ONE exception, and it is the difference between a real finding and
    // a false positive. An INDEX route that navigates to a RELATIVE target is
    // picking its parent's default child — `/patient` has no element of its own
    // and sends you to `chart` — so the parent path does land on a real page.
    // An ABSOLUTE target is the other thing entirely: `/guide/roadmap` →
    // `/guide/adoption-readiness` is a section #440 deleted, and a page linking
    // it is linking something gone. The `to="…"` form is what separates them.
    const navTo = /<Navigate\b[^>]*\bto=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(element)
    const isDefaultChildRedirect =
      isIndex && navTo !== null && !(navTo[1] ?? navTo[2] ?? '/').startsWith('/')
    const isRedirect =
      (/<Navigate\b/.test(element) || /<Legacy\w*Redirect\b/.test(element)) && !isDefaultChildRedirect
    const live = element.trim() !== '' && !isRedirect

    const prefix = stack.length ? stack[stack.length - 1] : ''
    let full = prefix
    if (pathAttr !== undefined) {
      full = pathAttr.startsWith('/') ? pathAttr : `${prefix}/${pathAttr}`.replace(/\/{2,}/g, '/')
    }

    if (pathAttr !== undefined || isIndex) {
      routes.push({ path: full, live, index: isIndex })
    }
    if (!selfClosing) stack.push(full)
    i = j
  }

  if (tagsRead === 0) {
    bail(`${rel(APP_TSX)}: parsed 0 <Route> tags — refusing to report every app link as broken (or as fine)`)
  }
  return routes
}

const routes = parseRoutes(readFileSync(APP_TSX, 'utf8'))

// A path resolves if a live route sits at it, or if its index child is live.
// Both shapes occur: `/population` has no element of its own and gets its page
// from `<Route index element={<PopulationView />} />`, while `/patient` gets
// its page from an index that redirects to the relative `chart`.
const livePaths = new Set()
for (const r of routes) {
  if (!r.live) continue
  livePaths.add(r.path)
}
if (livePaths.size === 0) {
  bail(`${rel(APP_TSX)}: parsed routes but none is live — check G would call every app link broken`)
}

// The catch-all cannot be a destination; it would match anything.
livePaths.delete('/*')

/** Does `link` match a route path, allowing `:param` segments? */
function matchesRoute(link) {
  const want = link.replace(/\/$/, '').split('/')
  for (const path of livePaths) {
    const have = path.replace(/\/$/, '').split('/')
    if (have.length !== want.length) continue
    if (have.every((seg, k) => seg.startsWith(':') || seg === want[k])) return true
  }
  return false
}

// GUIDE_SECTIONS — the sidebar's own list. A /guide/<x> that is a route but not
// a section is unreachable from the guide's navigation.
function parseGuideSections(src) {
  const m = /export const GUIDE_SECTIONS:[^=]*=\s*\[([\s\S]*?)\n\]/.exec(src)
  if (!m) {
    bail(
      `${rel(GUIDE_SECTIONS_TS)}: no \`export const GUIDE_SECTIONS = [ … ]\` this gate can read — ` +
        `has the file shape changed? Check G's second half depends on it.`,
    )
  }
  const paths = [...m[1].matchAll(/\{\s*path:\s*'([^']+)'/g)].map((x) => x[1])
  if (paths.length === 0) {
    bail(`${rel(GUIDE_SECTIONS_TS)}: parsed 0 sections from GUIDE_SECTIONS — refusing to pass vacuously`)
  }
  return new Set(paths)
}

const guideSections = parseGuideSections(readFileSync(GUIDE_SECTIONS_TS, 'utf8'))

for (const doc of pageDocs) {
  doc.lines.forEach((line, i) => {
    // The prose links the deployed app absolutely
    // (`https://…/adoption-guide/#/guide/…`), so match the HashRouter fragment
    // wherever it appears rather than only a bare `#/…` link target.
    for (const m of line.matchAll(/#(\/[A-Za-z0-9/_:-]*)/g)) {
      const route = m[1].replace(/\/$/, '')
      if (route === '') continue // `#/` is the app root
      if (!matchesRoute(route)) {
        at(
          doc,
          i,
          `links the app at \`#${route}\`, which is not a live route in ${rel(APP_TSX)}. It may have ` +
            `been moved or deleted — a \`<Navigate>\` or \`Legacy*Redirect\` route does not count, ` +
            `because linking one means linking something that no longer exists.`,
        )
        return
      }
      const guide = /^\/guide\/([A-Za-z0-9_-]+)$/.exec(route)
      if (guide && !guideSections.has(guide[1])) {
        at(
          doc,
          i,
          `links \`#${route}\`, but "${guide[1]}" is not a section in ${rel(GUIDE_SECTIONS_TS)} — the ` +
            `route resolves, yet the guide's own sidebar does not list it, so a reader who follows the ` +
            `link cannot navigate back to it.`,
        )
      }
    }
  })
}

// ─── H. Internal IG links resolve ───────────────────────────────────────────
const pages = parsePages(configText, bail)
const pageTargets = new Set(pages.map((p) => p.replace(/\.md$/, '.html')))

let htmlLinks = 0
for (const doc of pageDocs) {
  doc.lines.forEach((line, i) => {
    for (const m of line.matchAll(/\]\(([A-Za-z0-9_.-]+\.html)(#[A-Za-z0-9_.-]*)?\)/g)) {
      const target = m[1]
      htmlLinks++
      if (pageTargets.has(target)) continue
      if (artifactPages.has(target)) continue
      if (GENERATED_PAGES[target]) continue

      // Distinguish the two ways this goes wrong, since the fixes differ.
      const looksLikeArtifact = /^[A-Z][A-Za-z]*-/.test(target)
      at(
        doc,
        i,
        looksLikeArtifact
          ? `links ${target}, but no resource with that type and id is in ${rel(FSH_GENERATED)} or in a ` +
            `\`path-resource\` directory — the publisher will emit no such page. Check the id, or author ` +
            `the artifact.`
          : `links ${target}, but ${target.replace(/\.html$/, '.md')} is not a \`pages:\` entry and ` +
            `${target} is not in GENERATED_PAGES — the publisher renders no such page. A page needs a ` +
            `\`pages:\` entry to be rendered at all (see check D in check-ig-menu.mjs).`,
      )
    }
  })
}

// ─── Report ─────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error(`\n✗ check-ig-narrative: ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error(
    `\n  An IG page is read by implementers who do not have this repo. Build and tooling prose has\n` +
      `  one home (CLAUDE.md); everything a page points at — a tool id, an app route, another page —\n` +
      `  has to be something the reader can actually reach.\n`,
  )
  process.exit(1)
}

console.log(
  `✓ check-ig-narrative: ${pageDocs.length} page(s), ${internalsScanned} line(s) scanned for repo internals.`,
)
console.log(
  `  tool ids: ${publishedToolIds.size} published by ActivityDefinitions; app links resolved against ` +
    `${livePaths.size} live route(s) and ${guideSections.size} guide section(s).`,
)
console.log(
  `  ${htmlLinks} internal .html link(s) resolve to ${pageTargets.size} page(s), ` +
    `${artifactPages.size} artifact page(s), or ${Object.keys(GENERATED_PAGES).length} generated page(s).`,
)
