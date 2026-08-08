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
 * It also covers a third tree that nothing validated at all (issue #226): the
 * demo registry's scenario slices at `web/src/data/population/scenarios/`.
 * Those hold hand-authored FHIR nested inside a `PatientSlice` wrapper rather
 * than as standalone resource files, so they are unwrapped into a temp
 * directory first (see `collectScenarioResources`). The Stage-8 measure engine
 * reads exactly those resources, so a malformed one produces a wrong measure
 * score rather than an empty one.
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
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, relative, resolve } from 'node:path'
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
const SCENARIOS_DIR = join(root, 'web/src/data/population/scenarios')

/**
 * Scenario buckets that hold FHIR resources, and the resourceType each implies.
 * Mirrors `FHIR_BUCKETS` in web/scripts/check-scenario-resources.mjs, which
 * gates the same correspondence offline.
 *
 * Deliberately absent: `responses` (StoredResponse wrappers — the QRs inside
 * them are already covered by `npm run check:scenarios`), `riskAlerts` (an app
 * type, not FHIR) and `encounters` (ScenarioEncounter walkthrough narration,
 * NOT a FHIR Encounter — feeding those to the validator would report garbage).
 */
const SCENARIO_FHIR_BUCKETS = {
  observations: 'Observation',
  carePlans: 'CarePlan',
  communications: 'Communication',
  episodes: 'EpisodeOfCare',
  flags: 'Flag',
  tasks: 'Task',
  documentReferences: 'DocumentReference',
  serviceRequests: 'ServiceRequest',
  appointments: 'Appointment',
  consents: 'Consent',
  procedures: 'Procedure',
}

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
/**
 * Directories to hand to `-ig` so their contents populate the validation
 * *context* (profiles, CodeSystems, ValueSets, and — critically —
 * Questionnaires that a QuestionnaireResponse must be validated against).
 *
 * `-ig <folder>` does NOT recurse: pointing it at `FHIR-Resources` loads
 * "0 resources" because every file sits one level down in a per-instrument
 * subdirectory. That failure is silent and it degrades to a PASS — the
 * validator emits "the questionnaire … could not be resolved, so no validation
 * can be performed against the base questionnaire" as a *warning* and reports
 * no errors. So every directory that directly holds .json is listed
 * individually.
 */
const contextDirs = new Set()
for (const dir of [GENERATED_DIR, AUTHORED_DIR]) {
  for (const full of walkJson(dir)) {
    contextDirs.add(relative(root, dirname(full)))
    const rel = relative(root, full)
    const hit = EXCLUSIONS.find((e) => e.match(rel))
    if (hit) excluded.push({ rel, reason: hit.reason })
    else targets.push(rel)
  }
}

/**
 * Unwrap the population scenarios into standalone resource files the validator
 * can read.
 *
 * Two deliberate transforms, and nothing else:
 *
 *  - `_savedAt` is dropped. It is SPiER's client-side persistence stamp, not
 *    FHIR — `localDataSource.saveArtifact` adds it and `smartDataSource`
 *    deletes it again before writing to a server (see its `_savedAt` handling).
 *    Stripping it here mirrors exactly what the app does before the resource
 *    becomes real FHIR; leaving it in would report a `_savedAt` error on a
 *    field no server ever sees.
 *  - `id` is filled from the scenario position where a resource has none. The
 *    offline gate already fails an id-less scenario resource, so this only
 *    keeps the temp filenames unique.
 *
 * Returns `{ paths, labels }` where `labels` maps each temp path back to a
 * scenario-relative label, so a failure reads as
 * `web/src/data/population/scenarios/patient-004.json episodes[0]` rather than
 * as a path in /tmp that means nothing to the reader.
 */
function collectScenarioResources(dir) {
  const paths = []
  const labels = new Map()
  let files
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  } catch {
    return { paths, labels, tmpDir: null }
  }
  if (files.length === 0) return { paths, labels, tmpDir: null }

  const tmpDir = mkdtempSync(join(tmpdir(), 'spier-scenarios-'))
  for (const file of files) {
    const scenario = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    for (const [bucket, type] of Object.entries(SCENARIO_FHIR_BUCKETS)) {
      const entries = scenario[bucket]
      if (!Array.isArray(entries)) continue
      entries.forEach((resource, i) => {
        if (!resource || typeof resource !== 'object') return
        const clean = { ...resource }
        delete clean._savedAt
        if (!clean.id) clean.id = `${file.replace(/\.json$/, '')}-${bucket}-${i}`
        const name = `${file.replace(/\.json$/, '')}--${bucket}-${i}--${type}-${clean.id}.json`
        const full = join(tmpDir, name)
        writeFileSync(full, JSON.stringify(clean, null, 2))
        paths.push(full)
        labels.set(full, {
          label: `web/src/data/population/scenarios/${file} ${bucket}[${i}] (${clean.id})`,
          repoFile: `web/src/data/population/scenarios/${file}`,
        })
      })
    }
  }
  return { paths, labels, tmpDir }
}

const { paths: scenarioTargets, labels: scenarioLabels, tmpDir: scenarioTmpDir } =
  collectScenarioResources(SCENARIOS_DIR)
targets.push(...scenarioTargets)

if (targets.length === 0) fail('no resources found to validate')
/**
 * A scenario tree that produced nothing is a silent pass, not an empty pass:
 * the buckets could have been renamed, or the directory moved. Coverage that
 * can quietly drop to zero is exactly the failure mode this gate exists to
 * prevent, so a zero count is an error rather than a shrug.
 */
if (existsSync(SCENARIOS_DIR) && scenarioTargets.length === 0) {
  fail(
    `${relative(root, SCENARIOS_DIR)} exists but yielded 0 resources — ` +
      'the scenario buckets may have been renamed. Update SCENARIO_FHIR_BUCKETS.',
  )
}

// --- Run the validator -----------------------------------------------------
const jar = await resolveJar()
const outFile = keepJsonAt ?? join(tmpdir(), `spier-fhir-validation-${process.pid}.json`)

const args = [
  '-Xmx4g',
  '-jar',
  jar,
  '-version',
  FHIR_VERSION,
  // Load the IG's own profiles/CodeSystems/ValueSets/Questionnaires so instances
  // can be validated against the definitions they claim conformance to.
  ...PACKAGE_DEPS.flatMap((p) => ['-ig', p]),
  ...[...contextDirs].sort().flatMap((d) => ['-ig', d]),
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
const output = JSON.parse(readFileSync(outFile, 'utf8'))
if (!keepJsonAt) rmSync(outFile, { force: true })
if (scenarioTmpDir) rmSync(scenarioTmpDir, { recursive: true, force: true })

/**
 * Unwrapped scenario resources live in a temp directory, so the validator
 * reports them by a path that means nothing to a reader. Translate back to the
 * scenario file and bucket index they came from.
 */
function describeFile(file) {
  const hit = scenarioLabels.get(file)
  return hit ? { display: hit.label, annotate: hit.repoFile } : { display: file, annotate: file }
}

/**
 * `-output` shape depends on the number of sources: a Bundle of OperationOutcomes
 * for several, a bare OperationOutcome for exactly one. Reading only `entry`
 * would silently find zero issues in the single-source case and report a pass.
 */
let outcomes
if (output?.resourceType === 'Bundle') {
  outcomes = (output.entry ?? []).map((e) => e.resource).filter(Boolean)
} else if (output?.resourceType === 'OperationOutcome') {
  outcomes = [output]
} else {
  fail(`unexpected validator output: resourceType '${output?.resourceType}' is neither Bundle nor OperationOutcome`)
}
if (outcomes.length === 0) fail('validator returned no OperationOutcome — nothing was validated')

const FILE_EXT = 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file'
const totals = { fatal: 0, error: 0, warning: 0, information: 0 }
/** @type {{file: string, issues: {severity: string, path: string, text: string}[]}[]} */
const offenders = []

/**
 * Warnings that mean "this resource was not actually checked". The validator
 * reports an unresolvable Questionnaire/profile as a *warning* and then returns
 * no errors — so a context-loading mistake degrades silently to a PASS, which is
 * the one failure mode a gate must never have. Treated as blocking.
 */
const SILENT_PASS_PATTERNS = [
  /could not be resolved, so no validation can be performed/i,
  /Unable to resolve profile/i,
  // A claimed profile that cannot be found. This one was live: two CarePlans
  // declared conformance to `hl7.fhir.us.ecareplan`, a canonical that does not
  // exist (404 in the FHIR package registry and on hl7.org), and the gate
  // reported them clean because the miss is only a warning.
  /has not been checked because it could not be found/i,
]
let silentPasses = 0

for (const oo of outcomes) {
  const file = oo?.extension?.find((e) => e.url === FILE_EXT)?.valueString ?? '(unknown file)'
  const issues = []
  for (const issue of oo?.issue ?? []) {
    const severity = issue.severity ?? 'information'
    if (severity in totals) totals[severity]++
    const text = issue.details?.text ?? issue.diagnostics ?? '(no detail)'
    const silentPass = severity === 'warning' && SILENT_PASS_PATTERNS.some((re) => re.test(text))
    if (silentPass) silentPasses++
    const keep =
      severity === 'error' || severity === 'fatal' || silentPass || (showWarnings && severity === 'warning')
    if (!keep) continue
    issues.push({
      severity: silentPass ? 'error' : severity,
      path: issue.expression?.[0] ?? issue.location?.[0] ?? '(no path)',
      text: silentPass ? `${text}  [not validated — treated as a failure, not a pass]` : text,
    })
  }
  if (issues.length) offenders.push({ file, issues })
}
totals.error += silentPasses

const blocking = totals.error + totals.fatal
const inCi = Boolean(process.env.GITHUB_ACTIONS)

for (const { file, issues } of offenders) {
  const { display, annotate } = describeFile(file)
  console.log(`\n${display}`)
  for (const { severity, path, text } of issues) {
    console.log(`  [${severity}] ${path}\n    → ${text}`)
    // Inline PR annotation so a failure lands on the offending file.
    if (inCi && (severity === 'error' || severity === 'fatal')) {
      const clean = (s) => s.replace(/\r?\n/g, ' ').replace(/::/g, ':')
      console.log(`::error file=${annotate},title=FHIR ${severity}::${clean(`${path}: ${text}`)}`)
    }
  }
}

console.log(
  `\n${targets.length} resources validated ` +
    `(${scenarioTargets.length} unwrapped from the population scenarios) — ` +
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
      lines.push(`**${describeFile(file).display}**`, '')
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
