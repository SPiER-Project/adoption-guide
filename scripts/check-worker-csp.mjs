#!/usr/bin/env node
/**
 * One `frame-ancestors` policy, for every Worker that serves a SPiER SMART
 * surface.
 *
 * Two Workers serve an app build over Static Assets — `services/guide` (the
 * Adoption Guide, plus the rendered IG) and `services/clinical` (the two SMART
 * apps, which is the one a real EHR frames). The header they attach is the only thing standing between a SMART
 * app and being embedded by a page that wants the clinician's clicks, and
 * `services/clinical` is both the copy where a permissive list matters most and
 * the copy nobody would re-read after editing the other.
 *
 * So the value lives once, in `packages/worker-http/src/spaAssets.ts`. This gate
 * holds five rules that keep it that way:
 *
 *   1. LIVENESS — the shared module still sets the header. Without this the
 *      other three rules pass trivially on a module that does nothing, which is
 *      the failure mode this repo keeps rediscovering (#232, #261, #280).
 *   2. NO SECOND COPY — no source outside that module may put
 *      `content-security-policy` or `frame-ancestors` in a STRING: every
 *      `.ts/.tsx/.js/.mjs/.cjs` under `services/<name>/src` and under
 *      `packages/worker-http/src`, and no such header in `public/_headers` (the
 *      Static Assets header file Vite copies into both builds). Comments are
 *      stripped first: every Worker's prose legitimately discusses the header,
 *      and a gate that fires on its own documentation gets switched off inside
 *      a week (the lesson `check-core-boundary.mjs` records).
 *   3. EVERY ASSET HOST USES IT — a service whose `wrangler.jsonc` declares an
 *      `assets` block must value-import AND CALL `serveSpaAsset` or
 *      `withFrameAncestors` in its `src/index.ts`, and none of its source may
 *      call `ASSETS.fetch` itself — a route answering from the binding directly
 *      ships its bytes with no header. This is the rule that catches a NEW Worker
 *      added without a CSP at all, which rule 2 cannot see (a missing header is
 *      not a literal). ⚠️ Until 2026-10-06 it checked the import only, so
 *      `app.get('/x', (c) => c.env.ASSETS.fetch(c.req.raw))` beside the real
 *      route passed.
 *   4. `not_found_handling: "none"` — the shared module's `onMiss` hook and its
 *      explicit SPA fallback both depend on a miss being a real 404. Under
 *      `"single-page-application"` the binding answers every miss with
 *      index.html and a 200, so the 404 branch is dead code and a dropped file
 *      comes back as HTML with a 200 (#533 → #534). A wrangler edit is exactly
 *      how that would come back.
 *   5. NO WIDER OVERRIDE — `PANEL_FRAME_ANCESTORS`, the one knob the shared
 *      module reads, may name only `'self'`/`'none'` and origins in
 *      `deploy-origins.json`, in the top-level `vars` AND in every
 *      `env.<name>.vars`. (`check:origins` holds the top-level copy too; an
 *      env-scoped `"*"` passed both gates until 2026-10-06.)
 *
 * Run from either asset-serving service's `verify` (it scans the whole repo, so
 * which one invokes it does not matter), and listed at the repo root in
 * CLAUDE.md. Not in the root verify: it reads only `services/`, `packages/worker-http` and
 * `public/_headers`.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED = 'packages/worker-http/src/spaAssets.ts'
const SERVICES = join(root, 'services')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

/** Strip block and line comments. String literals survive — they are the subject. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ')

/** Strip JSONC comments so a `//`-annotated wrangler config parses. */
const parseJsonc = (src) => JSON.parse(
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '').replace(/,(\s*[}\]])/g, '$1'),
)

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'web-dist' || entry === '.wrangler') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

const FORBIDDEN = /content-security-policy|frame-ancestors/i
const SOURCE = /\.(?:[cm]?js|tsx?)$/
const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f)
const STRING = /`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*"/g

/** Rule 2 over one file: no string literal carrying the header. */
function noSecondCopy(file) {
  const code = stripComments(readFileSync(file, 'utf8'))
  for (const m of code.matchAll(STRING)) {
    if (FORBIDDEN.test(m[0])) {
      fail(`${relative(root, file)}: a string containing ${FORBIDDEN.source.split('|').find((k) => new RegExp(k, 'i').test(m[0]))} — the policy lives in ${SHARED}. Import it; do not re-type the header.`)
    }
  }
}

const origins = Object.values(JSON.parse(readFileSync(join(root, 'deploy-origins.json'), 'utf8')))
  .filter((v) => typeof v === 'string')

// ── Rule 1: the shared module still does the thing ───────────────────────────
const sharedPath = join(root, SHARED)
if (!existsSync(sharedPath)) {
  console.error(`✗ ${SHARED} is missing — this gate exists to keep the policy in ONE place, and that place is gone. Moving it means updating this script, not deleting the rule.`)
  process.exit(1)
}
const sharedCode = stripComments(readFileSync(sharedPath, 'utf8'))
if (!/['"`]content-security-policy['"`]/i.test(sharedCode)) {
  fail(`${SHARED} no longer sets a 'content-security-policy' header — the other rules below would then pass against a module that does nothing.`)
}
if (!/frame-ancestors/i.test(sharedCode)) {
  fail(`${SHARED} no longer names 'frame-ancestors' in code — same problem.`)
}

// ── Services: rules 2, 3 and 4 ───────────────────────────────────────────────
if (!existsSync(SERVICES)) {
  console.error(`✗ no services/ directory at ${SERVICES} — this gate reads that tree, so an empty read would certify nothing.`)
  process.exit(1)
}

const services = readdirSync(SERVICES).filter((d) => statSync(join(SERVICES, d)).isDirectory())
let assetHosts = 0

for (const service of services) {
  const dir = join(SERVICES, service)
  const src = join(dir, 'src')
  if (!existsSync(src)) continue

  // Rule 2 — no second copy of the header, anywhere in the service's own source.
  // Tests are exempt: asserting the behaviour is the point of them.
  const sources = [...walk(src)].filter((f) => SOURCE.test(f) && !isTest(f))
  for (const file of sources) noSecondCopy(file)

  // Rules 3 and 4 — only for a service that actually serves assets.
  const wranglerPath = join(dir, 'wrangler.jsonc')
  if (!existsSync(wranglerPath)) continue
  let wrangler
  try {
    wrangler = parseJsonc(readFileSync(wranglerPath, 'utf8'))
  } catch (err) {
    fail(`${relative(root, wranglerPath)}: could not be parsed (${err.message}) — refusing to report on a config this gate cannot read.`)
    continue
  }
  if (!wrangler.assets) continue
  assetHosts++

  const entry = join(src, 'index.ts')
  if (!existsSync(entry)) {
    fail(`${relative(root, dir)} declares a Static Assets binding but has no src/index.ts for this gate to check.`)
    continue
  }
  const entryCode = stripComments(readFileSync(entry, 'utf8'))
  // A VALUE import of one of the two functions that attach the header — not
  // merely a mention of the package. ⚠️ The first version of this rule tested
  // `/@spier\/worker-http\//` and a planted defect sailed through it: deleting
  // the `serveSpaAsset` import left `import type { SpaAssetsEnv } from
  // '@spier/worker-http/spaAssets'` behind, which satisfied the match while the
  // Worker attached no CSP at all. A type import is erased at build time; it
  // cannot set a header.
  const attaches = [...entryCode.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"](@spier\/worker-http\/[^'"]+)['"]/g)]
    .some(([, isType, names]) => !isType && /\b(serveSpaAsset|withFrameAncestors)\b/.test(names))
  if (!attaches) {
    fail(`${relative(root, entry)} serves Static Assets but value-imports neither serveSpaAsset nor withFrameAncestors from @spier/worker-http — a SMART surface with no frame-ancestors header can be embedded by anything.`)
  } else if (!/\b(?:serveSpaAsset|withFrameAncestors)\s*\(/.test(entryCode)) {
    fail(`${relative(root, entry)} imports the header helper but never calls it — an import attaches nothing.`)
  }
  // …and no route may answer from the binding directly, around the helper.
  for (const file of sources) {
    if (/\bASSETS\s*\.\s*fetch\s*\(/.test(stripComments(readFileSync(file, 'utf8')))) {
      fail(`${relative(root, file)} calls ASSETS.fetch itself — that response skips ${SHARED} and carries no frame-ancestors header. Route it through serveSpaAsset.`)
    }
  }

  // Rule 5 — the override knob, at the top level and in every environment.
  const scopes = [['vars', wrangler.vars], ...Object.entries(wrangler.env ?? {}).map(([name, e]) => [`env.${name}.vars`, e?.vars])]
  for (const [where, vars] of scopes) {
    const fa = vars?.PANEL_FRAME_ANCESTORS
    if (typeof fa !== 'string' || !fa.trim()) continue
    for (const token of fa.trim().split(/\s+/)) {
      if (/^'(?:self|none)'$/.test(token)) continue
      if (!origins.includes(token)) {
        fail(`${relative(root, wranglerPath)}: ${where}.PANEL_FRAME_ANCESTORS admits ${token}, which is not an origin in deploy-origins.json — that widens who may frame this SMART surface.`)
      }
    }
  }

  if (wrangler.assets.not_found_handling !== 'none') {
    fail(`${relative(root, wranglerPath)}: assets.not_found_handling is ${JSON.stringify(wrangler.assets.not_found_handling ?? '(unset)')}, not "none". ${SHARED} tells a real 404 from an app route to decide between its onMiss hook and the SPA fallback; under SPA fallback the binding answers every miss with index.html and a 200, so that branch is dead and a dropped file is served as HTML (#533 → #534).`)
  }
}

// Rule 2 beyond services/: the shared package's OTHER modules, and the Static
// Assets header file both app builds ship.
for (const file of walk(join(root, 'packages/worker-http/src'))) {
  if (!SOURCE.test(file) || isTest(file) || file === sharedPath) continue
  noSecondCopy(file)
}
const headersFile = join(root, 'public/_headers')
if (existsSync(headersFile) && FORBIDDEN.test(stripComments(readFileSync(headersFile, 'utf8').replace(/^\s*#.*$/gm, '')))) {
  fail(`public/_headers sets a content-security-policy / frame-ancestors header — the policy lives in ${SHARED}, and a second one in the assets header file is the copy nobody re-reads.`)
}

// A check that reads nothing must fail, not pass.
if (assetHosts === 0) {
  console.error(`✗ no service under services/ declares a Static Assets binding — this gate's whole subject is missing, so a green result here would mean nothing.`)
  process.exit(1)
}

if (failures > 0) {
  console.error(`\n${failures} problem(s). One frame-ancestors policy, in ${SHARED}.`)
  process.exit(1)
}
console.log(`✓ worker CSP: ${assetHosts} asset-serving Worker(s), one frame-ancestors policy (${SHARED})`)
