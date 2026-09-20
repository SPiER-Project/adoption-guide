#!/usr/bin/env node
/**
 * One `frame-ancestors` policy, for every Worker that serves a SPiER SMART
 * surface.
 *
 * Two Workers serve a build of `web/` over Static Assets — `services/guide`
 * (the `demo` surface, plus the CDS Hooks API and the rendered IG) and
 * `services/clinical` (the `clinical` surface, which is the one a real EHR
 * frames). The header they attach is the only thing standing between a SMART
 * app and being embedded by a page that wants the clinician's clicks, and
 * `services/clinical` is both the copy where a permissive list matters most and
 * the copy nobody would re-read after editing the other.
 *
 * So the value lives once, in `packages/worker-http/src/spaAssets.ts`. This gate
 * holds four rules that keep it that way:
 *
 *   1. LIVENESS — the shared module still sets the header. Without this the
 *      other three rules pass trivially on a module that does nothing, which is
 *      the failure mode this repo keeps rediscovering (#232, #261, #280).
 *   2. NO SECOND COPY — no service source outside that module may put
 *      `content-security-policy` or `frame-ancestors` in a STRING. Comments are
 *      stripped first: every Worker's prose legitimately discusses the header,
 *      and a gate that fires on its own documentation gets switched off inside
 *      a week (the lesson `check-core-boundary.mjs` records).
 *   3. EVERY ASSET HOST USES IT — a service whose `wrangler.jsonc` declares an
 *      `assets` block must import the shared module from its `src/index.ts`.
 *      This is the rule that catches a NEW Worker added without a CSP at all,
 *      which rule 2 cannot see (a missing header is not a literal).
 *   4. `not_found_handling: "none"` — the shared module's `onMiss` hook and its
 *      explicit SPA fallback both depend on a miss being a real 404. Under
 *      `"single-page-application"` the binding answers every miss with
 *      index.html and a 200, so the 404 branch is dead code and a dropped file
 *      comes back as HTML with a 200 (#533 → #534). A wrangler edit is exactly
 *      how that would come back.
 *
 * Run from either asset-serving service's `verify` (it scans the whole repo, so
 * which one invokes it does not matter), and listed at the repo root in
 * CLAUDE.md. Not in `web/`'s verify: it reads nothing under `web/`.
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
  for (const file of walk(src)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const m of code.matchAll(/`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*"/g)) {
      if (FORBIDDEN.test(m[0])) {
        fail(`${relative(root, file)}: a string containing ${FORBIDDEN.source.split('|').find((k) => new RegExp(k, 'i').test(m[0]))} — the policy lives in ${SHARED}. Import it; do not re-type the header.`)
      }
    }
  }

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
  }

  if (wrangler.assets.not_found_handling !== 'none') {
    fail(`${relative(root, wranglerPath)}: assets.not_found_handling is ${JSON.stringify(wrangler.assets.not_found_handling ?? '(unset)')}, not "none". ${SHARED} tells a real 404 from an app route to decide between its onMiss hook and the SPA fallback; under SPA fallback the binding answers every miss with index.html and a 200, so that branch is dead and a dropped file is served as HTML (#533 → #534).`)
  }
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
