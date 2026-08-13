#!/usr/bin/env node
/**
 * check:fhir-r5 — dropping the R5 type model is still safe.
 *
 * `@formbox/renderer` statically imports both FHIR models and selects one from
 * its `fhirVersion` prop. SPiER is R4-only, so vite.config.ts aliases
 * `fhirpath/fhir-context/r5` to an empty object (web/src/shims/fhirpath-r5-context.ts)
 * and the chunk every assessment route loads drops 575KB raw / 67KB gzip.
 *
 * That rests on two claims, one rule each:
 *
 *  RULE 1  the alias and the shim exist together, or neither does
 *  RULE 2  every `fhirVersion` in the app is the literal "r4" — an R5 render
 *          would be handed the empty model and fail in a way no type checker sees
 *  RULE 3  the renderer still imports this exact specifier. Liveness: if an
 *          upgrade renames or drops the import, the alias stops applying and the
 *          67KB comes back silently — that is the failure this rule exists for,
 *          because the app would look and behave completely normally.
 *
 * ⚠️ Plant a defect and watch it fail before trusting it: `fhirVersion="r5"`,
 * a computed `fhirVersion={version}`, deleting the alias while keeping the shim,
 * and a renderer that no longer imports the R5 context.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasedModules } from './lib/vite-alias.mjs'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(WEB, 'src')
const VITE_CONFIG = join(WEB, 'vite.config.ts')
const SHIM = join(WEB, 'src/shims/fhirpath-r5-context.ts')
const SPECIFIER = 'fhirpath/fhir-context/r5'
const RENDERER_DIST = join(WEB, 'node_modules/@formbox/renderer/dist')
const SUPPORTED_VERSION = 'r4'

const errors = []
const fail = msg => errors.push(msg)

// ── RULE 1 — alias and shim travel together ───────────────────────────────────

const aliased = aliasedModules(readFileSync(VITE_CONFIG, 'utf8')).has(SPECIFIER)
const shimExists = existsSync(SHIM)

if (!aliased && !shimExists) {
  console.log(`✓ fhir-r5: ${SPECIFIER} is not stubbed — nothing to guard`)
  process.exit(0)
}
if (aliased && !shimExists) {
  fail(`vite.config.ts aliases ${SPECIFIER} but src/shims/fhirpath-r5-context.ts does not exist`)
}
if (!aliased && shimExists) {
  fail(
    'src/shims/fhirpath-r5-context.ts exists but vite.config.ts no longer aliases ' +
      `${SPECIFIER} — a dead shim, and the R5 model is back in the bundle. ` +
      'Delete the shim, or restore the alias.',
  )
}
if (errors.length > 0) report()

// ── RULE 2 — the app only ever renders R4 ─────────────────────────────────────

const sources = []
const collect = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) collect(path)
    else if (/\.tsx?$/.test(entry.name)) sources.push(path)
  }
}
collect(SRC)

let versionProps = 0
for (const path of sources) {
  const src = readFileSync(path, 'utf8')
  const rel = path.replace(WEB + '/', '')
  for (const match of src.matchAll(/fhirVersion\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g)) {
    versionProps++
    const raw = match[1]
    const line = src.slice(0, match.index).split('\n').length
    const literal = /^["'](.+)["']$/.exec(raw)
    if (!literal) {
      // A computed value cannot be checked here, and this gate must not approve
      // what it cannot read.
      fail(
        `${rel}:${line}: fhirVersion=${raw} is computed — the R5 model is stubbed out, so this ` +
          'prop has to be a literal the gate can verify. Pass "r4", or drop the alias.',
      )
      continue
    }
    if (literal[1] !== SUPPORTED_VERSION) {
      fail(
        `${rel}:${line}: fhirVersion="${literal[1]}" — only "${SUPPORTED_VERSION}" works while the ` +
          'R5 model is stubbed out (it resolves to an empty object). Drop the alias in vite.config.ts.',
      )
    }
  }
}

if (versionProps === 0) {
  fail(
    'no fhirVersion prop found anywhere in src/ — either nothing renders a Questionnaire any ' +
      'more (delete the shim) or this scan has stopped matching, in which case RULE 2 is checking nothing.',
  )
}

// ── RULE 3 — the renderer still imports the specifier we alias ────────────────

if (!existsSync(RENDERER_DIST)) {
  fail('@formbox/renderer is not installed — run npm ci; this check cannot verify the alias without it')
} else {
  const bundles = readdirSync(RENDERER_DIST).filter(f => f.endsWith('.js'))
  // The *whole* quoted specifier, closing quote included. A bare `includes()`
  // was the first version of this and it passed a planted rename to
  // `fhirpath/fhir-context/r5-renamed`, which still contains the old string —
  // exactly the case the rule is here to catch, since a renamed import means the
  // alias silently stops applying.
  const quoted = new RegExp(`['"]${SPECIFIER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
  const importsR5 = bundles.some(f => quoted.test(readFileSync(join(RENDERER_DIST, f), 'utf8')))
  if (!importsR5) {
    fail(
      `@formbox/renderer no longer imports ${SPECIFIER}, so the alias matches nothing. ` +
        'Either the R5 model is gone from its dependency tree (delete the shim and the alias — ' +
        'the saving is already yours) or the specifier changed and the 67KB is silently back. ' +
        'Check which before touching this.',
    )
  }
}

report()

function report() {
  if (errors.length > 0) {
    console.error(`\n✗ fhir-r5 shim: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`)
    for (const e of errors) console.error(`  • ${e}`)
    console.error('\n  See web/src/shims/fhirpath-r5-context.ts for what the shim is and why.\n')
    process.exit(1)
  }
  console.log(
    `✓ fhir-r5: shim active, ${versionProps} fhirVersion prop(s) all "${SUPPORTED_VERSION}", ` +
      'renderer still imports the aliased specifier',
  )
}
