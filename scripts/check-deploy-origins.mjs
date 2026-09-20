#!/usr/bin/env node
/**
 * Every hosted origin SPiER names comes from ONE file, deploy-origins.json at
 * the repo root — and the configs that cannot import it repeat it exactly.
 *
 * Until 2026-09-20 the same five strings (four `*.workers.dev` Workers and the
 * GitHub Pages site) were typed into nine places across seven source files,
 * plus four `wrangler.jsonc` vars. Each rename — the CDS split, the clinical
 * Worker — found them one at a time: `SMART_LAUNCH_URL` was derived from the
 * wrong origin for a whole release (#552 → services/cds/README.md) and the CDS
 * audience pointed at the adoption-guide Worker after the API had left it.
 * Code now imports `@spier/core/lib/deployOrigins` (or the JSON relatively
 * where no alias reaches); this gate holds everything that cannot import.
 *
 * RULES
 *   1. No hosted-origin LITERAL in TypeScript source (`.ts`/`.tsx`, comments and
 *      tests stripped/excluded). Code imports the origin; a literal is the
 *      copy this gate exists to stop, whether or not it currently agrees.
 *   2. Every hosted-origin literal in the configs that cannot import
 *      (`wrangler.jsonc`, workflow YAML, other JSON) is one of the file's
 *      origins, optionally followed by a path. A typo'd or renamed host in a
 *      wrangler var is otherwise a deploy that points at nothing.
 *   3. Every asset-serving Worker's `PANEL_FRAME_ANCESTORS` var, when set,
 *      names only `'self'`-style keywords and origins from the file — the
 *      clinical Worker's header is a clickjacking surface, and an override that
 *      admits an unknown host should not pass on the grounds that it is config.
 *   4. The file's own shape: five keys, each an https origin with no trailing
 *      slash and no query; only `pages` may carry a path. Consumers append
 *      their own paths, so two consumers can never disagree about a slash.
 *   5. Every key is USED — imported as `DEPLOY_ORIGINS.<key>` / `origins.<key>`
 *      somewhere in code, or repeated in a config. An origin nobody reads is
 *      drift in the other direction.
 *   6. FLOOR: the scan read at least four `wrangler.jsonc` files and found at
 *      least one origin literal among them (services/cds must name several). A
 *      gate that finds no configs and reports ✓ has checked nothing.
 *
 * Offline; reads the tracked tree via `git ls-files`. In the root `verify` as
 * `check:origins`.
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const ORIGINS_FILE = 'deploy-origins.json'
const MIN_WRANGLER_FILES = 4

const failures = []
const fail = (msg) => failures.push(msg)

// A hosted origin as SPiER writes one: a Cloudflare workers.dev host or a
// GitHub Pages host, optionally with a path. Widen the host alternation when
// the project gets a domain — and the file, and this comment.
const ORIGIN_RE = /https?:\/\/[a-z0-9.-]+\.(?:workers\.dev|github\.io)(?:\/[^\s"'`)\]},]*)?/gi

// ─── The file itself (rule 4) ───────────────────────────────────────────────
const originsPath = join(root, ORIGINS_FILE)
if (!existsSync(originsPath)) {
  console.error(`✗ ${ORIGINS_FILE} is missing at the repo root — nothing to check against`)
  process.exit(1)
}
const raw = JSON.parse(readFileSync(originsPath, 'utf8'))
const origins = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== '$comment'))
const EXPECTED_KEYS = ['guide', 'clinical', 'cds', 'mockEhr', 'pages']
for (const k of EXPECTED_KEYS) if (!(k in origins)) fail(`${ORIGINS_FILE}: missing key "${k}"`)
for (const k of Object.keys(origins)) if (!EXPECTED_KEYS.includes(k)) fail(`${ORIGINS_FILE}: unexpected key "${k}" — add it to EXPECTED_KEYS here with a reason, or it is a typo`)
for (const [k, v] of Object.entries(origins)) {
  let url
  try { url = new URL(v) } catch { fail(`${ORIGINS_FILE}: "${k}" is not a URL: ${v}`); continue }
  if (url.protocol !== 'https:') fail(`${ORIGINS_FILE}: "${k}" must be https (${v})`)
  if (v.endsWith('/')) fail(`${ORIGINS_FILE}: "${k}" must not end in a slash — consumers append their own path (${v})`)
  if (url.search || url.hash) fail(`${ORIGINS_FILE}: "${k}" must carry no query or fragment (${v})`)
  if (k !== 'pages' && url.pathname !== '/') fail(`${ORIGINS_FILE}: "${k}" must be a bare origin; only "pages" carries a path (${v})`)
}
const values = Object.values(origins)
const matchesKnown = (literal) => values.some((v) => literal === v || literal.startsWith(`${v}/`))

// ─── The tracked tree ───────────────────────────────────────────────────────
const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).trim().split('\n')
const isTest = (f) => /\.test\.[cm]?[jt]sx?$|__fixtures__\//.test(f)
const isDoc = (f) => f.endsWith('.md') || f.startsWith('docs/') || f.startsWith('ig/') || f.startsWith('.claude/')
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** Only string/template literals count — a URL in a comment is prose. */
const literalsIn = (code) => {
  const out = []
  for (const m of code.matchAll(/`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*"/g)) {
    for (const o of m[0].matchAll(ORIGIN_RE)) out.push(o[0])
  }
  return out
}

const used = new Set()
let wranglerFiles = 0
let wranglerLiterals = 0

for (const f of tracked) {
  if (f === ORIGINS_FILE || f.endsWith('package-lock.json') || isTest(f) || isDoc(f)) continue
  const abs = join(root, f)
  if (!existsSync(abs)) continue

  if (/\.tsx?$/.test(f)) {
    const code = stripComments(readFileSync(abs, 'utf8'))
    // Rule 1
    for (const lit of literalsIn(code)) {
      fail(`${f}: hosted-origin literal ${lit} — import DEPLOY_ORIGINS from @spier/core/lib/deployOrigins (or ${ORIGINS_FILE} relatively) instead of typing the host`)
    }
    // Rule 5 bookkeeping
    for (const m of code.matchAll(/\b(?:DEPLOY_ORIGINS|origins)\.([A-Za-z]+)\b/g)) if (m[1] in origins) used.add(m[1])
    continue
  }

  if (/\.(?:jsonc?|ya?ml|mjs|js)$/.test(f)) {
    const text = readFileSync(abs, 'utf8')
    const isWrangler = /(^|\/)wrangler\.jsonc$/.test(f)
    if (isWrangler) wranglerFiles++
    const code = /\.(?:mjs|js|jsonc)$/.test(f) ? stripComments(text) : text
    // Scripts and workflows may quote an origin as a literal only if it is a known one (rule 2).
    for (const lit of code.match(ORIGIN_RE) ?? []) {
      if (isWrangler) wranglerLiterals++
      if (!matchesKnown(lit)) fail(`${f}: ${lit} is not an origin in ${ORIGINS_FILE} (or a path under one) — a renamed or mistyped host here is a deploy that points at nothing`)
      else for (const [k, v] of Object.entries(origins)) if (lit === v || lit.startsWith(`${v}/`)) used.add(k)
    }
    // Rule 3
    if (isWrangler) {
      let cfg
      try { cfg = JSON.parse(stripComments(text)) } catch (err) { fail(`${f}: could not be parsed (${err.message})`); continue }
      const fa = cfg?.vars?.PANEL_FRAME_ANCESTORS
      if (cfg?.assets && typeof fa === 'string' && fa.trim()) {
        for (const token of fa.trim().split(/\s+/)) {
          if (/^'[a-z-]+'$/.test(token)) continue // 'self', 'none'
          if (!values.includes(token)) fail(`${f}: PANEL_FRAME_ANCESTORS admits ${token}, which is not an origin in ${ORIGINS_FILE} — the clinical header is a clickjacking surface; add the host to the file first`)
        }
      }
    }
  }
}

// Rule 5
for (const k of Object.keys(origins)) {
  if (!used.has(k)) fail(`${ORIGINS_FILE}: "${k}" is read by nothing — no DEPLOY_ORIGINS.${k} / origins.${k} in code and no config repeats it; delete it or use it`)
}

// Rule 6
if (wranglerFiles < MIN_WRANGLER_FILES) fail(`read ${wranglerFiles} wrangler.jsonc file(s), below the floor of ${MIN_WRANGLER_FILES} — the scan is broken, not the configs`)
if (wranglerLiterals === 0) fail('found no hosted-origin literal in any wrangler.jsonc — services/cds names several, so the reader is broken')

const summary = `check-deploy-origins: ${values.length} origins in ${ORIGINS_FILE}, ${wranglerFiles} wrangler configs (${wranglerLiterals} origin literals), ${used.size}/${values.length} keys used`
if (failures.length) {
  console.error(`✗ ${summary}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ ${summary} — no origin literal in TypeScript, every config copy matches the file`)
