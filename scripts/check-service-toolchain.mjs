#!/usr/bin/env node
/**
 * One Worker toolchain, four services — and nothing but a note used to hold
 * them together.
 *
 * #387's "no npm workspaces" gives each service under services/ its own
 * install, so each carries its own devDependency ranges and, until
 * packages/worker-tooling existed, its own copy of the eslint / tsconfig / vite
 * / vitest config. Four copies of a version range are four chances to fork,
 * and they did (2026-09-20: two services on `wrangler ~4.107.0`, two on
 * `^4.0.0`, and the pin held three HIGH advisories open — see
 * docs/internals/workers.md). The `//cloudflare` note in each manifest was the
 * whole guard. This is the gate that note asked for.
 *
 * RULES
 *   1. Every service's `devDependencies` is IDENTICAL to every other's — same
 *      names, same ranges. A service that genuinely needs a tool the others do
 *      not gets it added to all four with a note, or the exception is named
 *      here with its reason; it does not get a private range.
 *   2. Every service's `eslint.config.js`, `vite.config.ts` and
 *      `vitest.config.ts` value-imports its body from packages/worker-tooling,
 *      and its `tsconfig.json` `extends` the shared base. A file that stops
 *      importing the shared body is a copy coming back, whatever it contains.
 *   3. No service config re-declares what the shared body owns: no `find:` /
 *      `replacement:` alias entry, no `compilerOptions`, no `paths`. Rule 2
 *      cannot see a file that imports the body AND adds a local alias on top;
 *      this can.
 *   4. `tsconfig.worker.json`'s `paths` and `aliases.mjs` name the SAME set of
 *      `@spier/*` packages, and every target exists on disk. tsc resolves
 *      through one list and the bundler through the other; a package in only
 *      one compiles yet fails to bundle, or the reverse.
 *   5. FLOOR: at least four services are found and every one has all four
 *      config files. A gate that finds zero services and reports ✓ has checked
 *      nothing — the failure mode docs/internals/README.md is about.
 *
 * Offline and dependency-free: it reads manifests and config files as text
 * and imports aliases.mjs (which imports only `node:url`). Run from any
 * service's `verify` (`npm run check:toolchain`); it scans all of services/,
 * so one caller is sufficient, and every service calls it so that a change
 * to any one of them re-runs it in that service's CI job.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const SERVICES = join(root, 'services')
const TOOLING = join(root, 'packages', 'worker-tooling')
const MIN_SERVICES = 4

const failures = []
const fail = (msg) => failures.push(msg)
const rel = (p) => relative(root, p)

/** Strip line and block comments so a JSONC config parses. Strings are respected. */
function stripJsonc(text) {
  let out = ''
  let i = 0
  let inString = false
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (inString) {
      out += ch
      if (ch === '\\') { out += next ?? ''; i += 2; continue }
      if (ch === '"') inString = false
      i++
      continue
    }
    if (ch === '"') { inString = true; out += ch; i++; continue }
    if (ch === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; continue }
    if (ch === '/' && next === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue }
    out += ch
    i++
  }
  return out
}

function readJsonc(path) {
  try {
    return JSON.parse(stripJsonc(readFileSync(path, 'utf8')))
  } catch (err) {
    fail(`${rel(path)}: could not be parsed (${err.message}) — refusing to report on a file this gate cannot read`)
    return null
  }
}

// ─── Rule 5 first: what is there to check ────────────────────────────────────
const services = readdirSync(SERVICES)
  .map((d) => join(SERVICES, d))
  .filter((d) => statSync(d).isDirectory() && existsSync(join(d, 'package.json')))

if (services.length < MIN_SERVICES) {
  fail(`found ${services.length} service(s) with a package.json under services/, below the floor of ${MIN_SERVICES} — the scan is broken, not the services`)
}

const CONFIGS = {
  'eslint.config.js': { imports: 'packages/worker-tooling/eslint.mjs', symbol: 'workerEslintConfig' },
  'vite.config.ts': { imports: 'packages/worker-tooling/vite.mjs', symbol: 'workerViteConfig' },
  'vitest.config.ts': { imports: 'packages/worker-tooling/vite.mjs', symbol: 'workerVitestConfig' },
  'tsconfig.json': { extends: 'packages/worker-tooling/tsconfig.worker.json' },
}

// ─── Rule 1: identical devDependencies ───────────────────────────────────────
const manifests = new Map()
for (const dir of services) {
  const j = readJsonc(join(dir, 'package.json'))
  if (j) manifests.set(dir, j)
}
const reference = [...manifests.entries()][0]
if (reference) {
  const [refDir, refManifest] = reference
  const refDeps = refManifest.devDependencies ?? {}
  for (const [dir, j] of manifests) {
    if (dir === refDir) continue
    const deps = j.devDependencies ?? {}
    const names = new Set([...Object.keys(refDeps), ...Object.keys(deps)])
    for (const name of names) {
      if (refDeps[name] !== deps[name]) {
        fail(`devDependencies differ: ${name} is ${JSON.stringify(refDeps[name] ?? '(absent)')} in ${rel(refDir)}/package.json but ${JSON.stringify(deps[name] ?? '(absent)')} in ${rel(dir)}/package.json — the four services move together (docs/internals/workers.md)`)
      }
    }
  }
}

// ─── Rules 2 + 3: every config consumes the shared body, and adds nothing ────
const STRIP_COMMENTS = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
for (const dir of services) {
  for (const [file, want] of Object.entries(CONFIGS)) {
    const path = join(dir, file)
    if (!existsSync(path)) { fail(`${rel(dir)}: missing ${file} — every service carries all four config files`); continue }
    const raw = readFileSync(path, 'utf8')
    if (want.extends) {
      const j = readJsonc(path)
      if (!j) continue
      const target = j.extends ? resolve(dir, j.extends) : null
      if (target !== join(root, want.extends)) {
        fail(`${rel(path)}: must "extends" ${want.extends} (found ${JSON.stringify(j.extends ?? '(none)')})`)
      }
      if (j.compilerOptions) fail(`${rel(path)}: declares its own compilerOptions — the shared base owns them; add the option there, for all four, or name the exception in this gate`)
      continue
    }
    const code = STRIP_COMMENTS(raw)
    const importRe = new RegExp(`import\\s*\\{[^}]*\\b${want.symbol}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`)
    const m = code.match(importRe)
    if (!m) {
      fail(`${rel(path)}: does not value-import ${want.symbol} from ${want.imports} — a config that stops consuming the shared body is a copy coming back`)
    } else if (resolve(dir, m[1]) !== join(root, want.imports)) {
      fail(`${rel(path)}: imports ${want.symbol} from ${m[1]}, which is not ${want.imports}`)
    }
    if (!new RegExp(`\\b${want.symbol}\\s*\\(`).test(code)) {
      fail(`${rel(path)}: imports ${want.symbol} but never calls it`)
    }
    for (const forbidden of ['find:', 'replacement:', 'compilerOptions', '"paths"']) {
      if (code.includes(forbidden)) {
        fail(`${rel(path)}: contains \`${forbidden}\` — a per-service alias or option set is the drift this gate exists to stop; it belongs in packages/worker-tooling`)
      }
    }
  }
}

// ─── Rule 4: tsconfig paths and Vite aliases name the same packages ──────────
const base = readJsonc(join(TOOLING, 'tsconfig.worker.json'))
const { workerAliases } = await import(pathToFileURL(join(TOOLING, 'aliases.mjs')).href)
const aliases = workerAliases()
const pkgOf = (spec) => {
  const s = spec instanceof RegExp ? spec.source.replace(/^\^|\$$/g, '').replace(/\\\//g, '/') : spec
  const m = s.match(/^@spier\/([a-z-]+)/)
  return m ? m[1] : null
}
const tsPackages = new Set(Object.keys(base?.compilerOptions?.paths ?? {}).map(pkgOf).filter(Boolean))
const vitePackages = new Set(aliases.map((a) => pkgOf(a.find)).filter(Boolean))
if (tsPackages.size === 0 || vitePackages.size === 0) fail('tsconfig.worker.json paths or aliases.mjs came back EMPTY — the reader is broken, not the config')
for (const p of tsPackages) if (!vitePackages.has(p)) fail(`@spier/${p} has a tsconfig path but no Vite alias — it typechecks and fails to bundle`)
for (const p of vitePackages) if (!tsPackages.has(p)) fail(`@spier/${p} has a Vite alias but no tsconfig path — it bundles and fails to typecheck`)
for (const [, targets] of Object.entries(base?.compilerOptions?.paths ?? {})) {
  for (const t of targets) {
    const dir = resolve(TOOLING, t.replace(/\/\*$/, ''))
    if (!existsSync(dir)) fail(`tsconfig.worker.json path target ${t} does not exist (resolved ${rel(dir)})`)
  }
}
for (const a of aliases) {
  if (!existsSync(a.replacement)) fail(`aliases.mjs target ${rel(a.replacement)} does not exist`)
}

// ─── Report ──────────────────────────────────────────────────────────────────
const summary = `check-service-toolchain: ${services.length} services, ${Object.keys(CONFIGS).length} config files each, ${tsPackages.size} shared @spier/* packages`
if (failures.length) {
  console.error(`✗ ${summary}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ ${summary} — identical devDependencies, every config consumes packages/worker-tooling, paths and aliases agree`)
