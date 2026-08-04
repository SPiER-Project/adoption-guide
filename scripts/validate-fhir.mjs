#!/usr/bin/env node
/**
 * Resource-level FHIR conformance gate.
 *
 * SUSHI compiling clean does not mean the resources are valid FHIR: cardinality,
 * required-field, extension-context and local-terminology violations all slip
 * through `sushi .`. The full IG Publisher run (`ig-publish.yml`) catches
 * FHIRPath invariants and narrative link integrity, but
 *
 *   - it only runs when `ig/**` changes, so the hand-authored Questionnaires in
 *     `FHIR-Resources/` — imported directly by the app at runtime — were never
 *     validated by anything at all, and
 *   - its gate is a coarse `err = N` / `Broken Links: N` parse, not a
 *     per-resource conformance report.
 *
 * This script closes both gaps by running the official HL7 `validator_cli`
 * over every generated IG resource *and* every hand-authored resource, then
 * reporting errors grouped by file. It exits non-zero on any error or fatal
 * issue so it can gate CI.
 *
 * Usage:
 *   node scripts/validate-fhir.mjs [--tx <url|n/a>] [--jar <path>]
 *                                  [--json <path>] [--show-warnings]
 *
 * Environment:
 *   SPIER_VALIDATOR_JAR  path to an existing validator_cli.jar (skips download)
 *   SPIER_FHIR_TX        terminology server, or `n/a` to run without one
 *
 * Prerequisites: Java 17+, and `ig/fsh-generated/resources/` populated by
 * `npx fsh-sushi .` inside `ig/`.
 */
import { spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/**
 * Pinned deliberately. `ig-publish.yml` resolves the *latest* IG Publisher
 * because that job is informational-until-it-fails and tracking upstream is
 * desirable there. This job is a hard PR gate, so a new validator release must
 * never be able to turn a PR red on its own. Bump this constant in its own PR,
 * with the new findings triaged.
 */
const VALIDATOR_VERSION = '6.10.0'
const VALIDATOR_URL = `https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VALIDATOR_VERSION}/validator_cli.jar`

const FHIR_VERSION = '4.0.1'

/** IG dependencies, mirroring `ig/sushi-config.yaml`. */
const PACKAGE_DEPS = ['hl7.fhir.us.core#6.1.0', 'hl7.fhir.uv.sdc#3.0.0']

const GENERATED_DIR = join(root, 'ig/fsh-generated/resources')
const AUTHORED_DIR = join(root, 'FHIR-Resources')

/**
 * Files excluded from validation, with the reason. Keep this list *short* and
 * every entry justified — it is the one place a real conformance problem could
 * hide from the gate.
 */
const EXCLUSIONS = [
  {
    // SUSHI writes the IG's own ImplementationGuide resource from
    // sushi-config.yaml's `parameters:` block. Those codes
    // (copyrightyear, releaselabel, apply-contact, …) are IG-Publisher
    // parameters that R4's required-bound `guide-parameter-code` ValueSet does
    // not list, so validator_cli reports 6 unfixable binding errors. The IG
    // Publisher — the only consumer of this resource — accepts them (its own QA
    // reports 0 errors). Validating a build artifact against a ValueSet its
    // consumer deliberately extends buys nothing.
    match: (rel) => /(^|\/)ImplementationGuide-.*\.json$/.test(rel),
    reason: 'SUSHI build artifact; parameter codes are IG-Publisher extensions to R4 guide-parameter-code',
  },
]

// --- CLI args --------------------------------------------------------------
const argv = process.argv.slice(2)
const argValue = (flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? undefined : argv[i + 1]
}
const showWarnings = argv.includes('--show-warnings')
const tx = argValue('--tx') ?? process.env.SPIER_FHIR_TX ?? 'n/a'
const keepJsonAt = argValue('--json')

const fail = (msg) => {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

// --- Prerequisites ---------------------------------------------------------
if (spawnSync('java', ['-version'], { stdio: 'ignore' }).status !== 0) {
  fail('java not found on PATH — the HL7 validator needs a JRE (17+).')
}

if (!existsSync(GENERATED_DIR)) {
  fail(
    `${relative(root, GENERATED_DIR)} does not exist.\n` +
      '  Compile the IG first:  cd ig && npx fsh-sushi .',
  )
}

// --- Resolve the validator jar (download + cache on first use) -------------
async function resolveJar() {
  const fromEnv = process.env.SPIER_VALIDATOR_JAR ?? argValue('--jar')
  if (fromEnv) {
    if (!existsSync(fromEnv)) fail(`validator jar not found at ${fromEnv}`)
    return fromEnv
  }

  const cacheDir = join(root, '.fhir-validator')
  const jar = join(cacheDir, `validator_cli-${VALIDATOR_VERSION}.jar`)
  if (existsSync(jar)) return jar

  mkdirSync(cacheDir, { recursive: true })
  console.log(`Downloading validator_cli ${VALIDATOR_VERSION} (~190 MB, one time)…`)
  const res = await fetch(VALIDATOR_URL, { redirect: 'follow' })
  if (!res.ok) fail(`download failed: ${res.status} ${res.statusText} — ${VALIDATOR_URL}`)
  const partial = `${jar}.partial`
  await pipeline(Readable.fromWeb(res.body), createWriteStream(partial))
  const { renameSync } = await import('node:fs')
  renameSync(partial, jar)
  return jar
}

// --- Collect targets -------------------------------------------------------
function* walkJson(dir) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walkJson(full)
    else if (entry.endsWith('.json')) yield full
  }
}

const excluded = []
const targets = []
for (const dir of [GENERATED_DIR, AUTHORED_DIR]) {
  for (const full of walkJson(dir)) {
    const rel = relative(root, full)
    const hit = EXCLUSIONS.find((e) => e.match(rel))
    if (hit) excluded.push({ rel, reason: hit.reason })
    else targets.push(rel)
  }
}

if (targets.length === 0) fail('no resources found to validate')

// --- Run the validator -----------------------------------------------------
const jar = await resolveJar()
const outFile = keepJsonAt ?? join(tmpdir(), `spier-fhir-validation-${process.pid}.json`)

const args = [
  '-Xmx4g',
  '-jar',
  jar,
  '-version',
  FHIR_VERSION,
  // Load the IG's own profiles/CodeSystems/ValueSets so instances can be
  // validated against the SPiER profiles they claim conformance to.
  ...PACKAGE_DEPS.flatMap((p) => ['-ig', p]),
  '-ig',
  relative(root, GENERATED_DIR),
  '-ig',
  relative(root, AUTHORED_DIR),
  '-tx',
  tx,
  '-output',
  outFile,
  ...targets,
]

console.log(
  `Validating ${targets.length} resources against FHIR ${FHIR_VERSION} ` +
    `(validator ${VALIDATOR_VERSION}, tx=${tx})…`,
)
const run = spawnSync('java', args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
if (run.error) fail(`could not run java: ${run.error.message}`)
if (!existsSync(outFile)) {
  fail(`validator produced no output (exit ${run.status}) — see the stderr above`)
}

// --- Report ----------------------------------------------------------------
const bundle = JSON.parse(readFileSync(outFile, 'utf8'))
if (!keepJsonAt) rmSync(outFile, { force: true })

const FILE_EXT = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file'
const totals = { fatal: 0, error: 0, warning: 0, information: 0 }
/** @type {{file: string, issues: {severity: string, path: string, text: string}[]}[]} */
const offenders = []

for (const entry of bundle.entry ?? []) {
  const oo = entry.resource
  const file = oo?.extension?.find((e) => e.url === FILE_EXT)?.valueString ?? '(unknown file)'
  const issues = []
  for (const issue of oo?.issue ?? []) {
    const severity = issue.severity ?? 'information'
    if (severity in totals) totals[severity]++
    const keep = severity === 'error' || severity === 'fatal' || (showWarnings && severity === 'warning')
    if (!keep) continue
    issues.push({
      severity,
      path: issue.expression?.[0] ?? issue.location?.[0] ?? '(no path)',
      text: issue.details?.text ?? issue.diagnostics ?? '(no detail)',
    })
  }
  if (issues.length) offenders.push({ file, issues })
}

const blocking = totals.error + totals.fatal
const inCi = Boolean(process.env.GITHUB_ACTIONS)

for (const { file, issues } of offenders) {
  console.log(`\n${file}`)
  for (const { severity, path, text } of issues) {
    console.log(`  [${severity}] ${path}\n    → ${text}`)
    // Inline PR annotation so a failure lands on the offending file.
    if (inCi && (severity === 'error' || severity === 'fatal')) {
      const clean = (s) => s.replace(/\r?\n/g, ' ').replace(/::/g, ':')
      console.log(`::error file=${file},title=FHIR ${severity}::${clean(`${path}: ${text}`)}`)
    }
  }
}

console.log(
  `\n${targets.length} resources validated — ` +
    `${blocking} error(s), ${totals.warning} warning(s), ${totals.information} info`,
)
for (const { rel, reason } of excluded) console.log(`  skipped ${rel} — ${reason}`)
if (tx === 'n/a') {
  console.log(
    '  note: no terminology server (-tx n/a), so codes from external systems ' +
      '(LOINC, SNOMED) are not checked here — the IG Publisher gate covers those.',
  )
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '### FHIR resource validation',
    '',
    `Validator \`${VALIDATOR_VERSION}\` · FHIR \`${FHIR_VERSION}\` · tx \`${tx}\``,
    '',
    '| Resources | Errors | Warnings | Info |',
    '|---|---|---|---|',
    `| ${targets.length} | ${blocking} | ${totals.warning} | ${totals.information} |`,
  ]
  if (blocking) {
    lines.push('', '#### Errors by file', '')
    for (const { file, issues } of offenders) {
      const errs = issues.filter((i) => i.severity === 'error' || i.severity === 'fatal')
      if (!errs.length) continue
      lines.push(`**${file}**`, '')
      for (const { path, text } of errs) lines.push(`- \`${path}\` — ${text}`)
      lines.push('')
    }
  }
  const { appendFileSync } = await import('node:fs')
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`)
}

if (blocking > 0) {
  console.error(`\n✗ ${blocking} FHIR conformance error(s) — see above`)
  process.exit(1)
}
console.log('✓ no FHIR conformance errors')
