#!/usr/bin/env node
/**
 * Markdown relative-link gate — every `[text](path)` in a tracked `.md` file
 * must point at something that exists.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * Plan docs and READMEs are ungated prose (see `docs/README.md`), so a file that
 * moves takes every link to it down in silence. Two reorganizations did exactly
 * that and nothing went red for months: #389 moved the domain layer into
 * `packages/core/`, #392 moved SUSHI's output into `packages/fhir-artifacts/generated/`,
 * and the Roadmap page's deletion took a whole README workflow section with it.
 * Fourteen links were dead when this gate was written — including one in
 * `services/mock-ehr/README.md` pointing at the shared FHIR resource rules,
 * which is the file CLAUDE.md tells you to read before changing a write
 * validation.
 *
 * The IG Publisher cannot see any of this: it renders `ig/input/pagecontent/`
 * and knows nothing about `docs/`, `README.md`, or `services/`.
 *
 * ─── What it does NOT assert ─────────────────────────────────────────────────
 *
 * Only that the target *resolves*. It cannot tell you a link points at the wrong
 * true thing, and a `:<line>` suffix is checked as far as the file, not the line
 * — a line number is a hint, and pinning one would churn on every edit above it.
 *
 * ─── The four skips, each for a different reason ─────────────────────────────
 *
 *   1. Non-paths — `http(s):`, `mailto:`, and bare `#anchor`.
 *   2. `.html` — the IG's own cross-references, resolved by the IG Publisher at
 *      render time from `input/pagecontent/*.md`. `check-ig-menu.mjs` owns those.
 *   3. Targets containing `…` — prose ellipsis inside inline code that happens to
 *      be shaped like a link (`StructureDefinition-…`), not a path. A real path
 *      never contains one.
 *   4. Gitignored paths — build output like `ig/fsh-generated/` and
 *      `packages/fhir-artifacts/generated/` is correct to link to and absent from a
 *      clean checkout. Asked of git rather than hardcoded, so it tracks
 *      `.gitignore`. Note git needs the trailing slash to match a
 *      directory-only pattern on a path that does not exist. No link in the
 *      corpus exercises this today (#470 removed the last one), so the rule is
 *      covered by a planted probe rather than by the tree — do not delete it as
 *      dead code.
 *
 * ─── Fenced code blocks are deliberately IN scope ────────────────────────────
 *
 * A link inside a fence never renders as a link, so skipping fences would be
 * defensible. It is not done, because a stale *path* in a code block is exactly
 * the drift worth catching: `FHIR-Resources/README.md` documented copy-fhir's
 * destination as `web/src/data/fhir/*.json` inside a fence long after #392 moved
 * it, and only this rule saw it. The cost is that prose *about* link syntax trips
 * the gate — write such an example without the parentheses.
 *
 * ─── Liveness ────────────────────────────────────────────────────────────────
 *
 * The #232 / #261 failure: a gate that reports green because it read nothing.
 * This one fails when it finds no markdown files, and when the number of links
 * it actually resolved falls under `LINK_FLOOR`. Per this repo's convention the
 * floor asserts liveness, not completeness — it sits at roughly half the real
 * count and the live count is printed on every run.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Roughly half the 348 relative links that resolve today. Raise it only alongside
// a real jump in the printed live count; never pin it to the exact number.
const LINK_FLOOR = 175

/**
 * Markdown inline links, in both spellings:
 *   [text](path)  [text](path "title")  [text](<path with spaces>)
 * The angle form is what carries a space, so the bare form deliberately stops at
 * whitespace rather than trying to balance parens.
 */
const LINK_RE = /\[[^\]]*\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+["'][^)]*["'])?\s*\)/g

function tracked() {
  const out = execFileSync('git', ['ls-files', '-z', '*.md'], { cwd: repoRoot, encoding: 'utf8' })
  return out.split('\0').filter(Boolean)
}

/**
 * git check-ignore, in one batch. A directory-only pattern (`fsh-generated/`)
 * will not match a path that does not exist on disk unless it is asked with a
 * trailing slash, so every candidate is probed both ways.
 */
function ignored(paths) {
  if (paths.length === 0) return new Set()
  const probes = [...new Set(paths.flatMap((p) => [p, `${p}/`]))]
  let out = ''
  try {
    out = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: probes.join('\n'),
    })
  } catch (err) {
    // Exit code 1 just means "none of them are ignored"; anything else is real.
    if (err.status !== 1) throw err
    out = err.stdout ?? ''
  }
  return new Set(out.split('\n').filter(Boolean).map((p) => p.replace(/\/$/, '')))
}

const files = tracked()
if (files.length === 0) {
  console.error('check-md-links: found no tracked .md files — the gate read nothing.')
  process.exit(1)
}

const candidates = []
for (const file of files) {
  const text = await readFile(path.join(repoRoot, file), 'utf8')
  for (const m of text.matchAll(LINK_RE)) {
    const raw = (m[1] ?? m[2]).trim()
    if (!raw) continue
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue // skip 1
    const target = raw.split('#')[0]
    if (!target) continue
    if (target.endsWith('.html')) continue // skip 2
    if (target.includes('…')) continue // skip 3
    // A `:137` suffix names a line in the target file, not a different file.
    const onDisk = target.replace(/:\d+(?::\d+)?$/, '')
    const rel = path.relative(repoRoot, path.resolve(path.dirname(path.join(repoRoot, file)), onDisk))
    candidates.push({ file, raw, rel })
  }
}

const missing = candidates.filter((c) => !existsSync(path.join(repoRoot, c.rel)))
const skipIgnored = ignored(missing.map((c) => c.rel)) // skip 4
const broken = missing.filter((c) => !skipIgnored.has(c.rel))

const resolved = candidates.length - broken.length
console.log(
  `check-md-links: ${files.length} files, ${candidates.length} relative links, ` +
    `${resolved} resolved (floor ${LINK_FLOOR}), ${skipIgnored.size} skipped as build output.`,
)

if (broken.length > 0) {
  console.error(`\ncheck-md-links: ${broken.length} broken link(s):\n`)
  for (const b of broken) console.error(`  ${b.file}  ->  ${b.raw}`)
  console.error('\nRetarget each to its current location, or delete the link if the')
  console.error('target is genuinely gone. Do not invent a replacement.')
  process.exit(1)
}

if (resolved < LINK_FLOOR) {
  console.error(
    `\ncheck-md-links: only ${resolved} links resolved, under the floor of ${LINK_FLOOR}.` +
      '\nThe scan is probably no longer reading what it thinks it is.',
  )
  process.exit(1)
}
