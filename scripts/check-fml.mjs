#!/usr/bin/env node
/**
 * FHIR Mapping Language gate — compile every `.fml` SPiER publishes, and check
 * the one map that has a TypeScript twin still agrees with it.
 *
 * ─── Why this replaced the inline bash in fml-validate.yml ───────────────────
 *
 * The workflow used to invoke the validator directly. It had been green since
 * 2026-06-06 while compiling *nothing*, for three compounding reasons:
 *
 *   1. `validator_cli.jar <file>.fml -compile <url>` does not load the file.
 *      `compile` resolves the map by canonical URL out of the loaded context,
 *      so the `.fml` has to arrive via `-ig`. It never did.
 *   2. `-ig ig/fsh-generated` loaded 0 resources — `-ig` does not recurse, and
 *      the generated resources are one level down in `fsh-generated/resources`.
 *      (The same trap `validate-fhir.mjs` documents for `-ig FHIR-Resources`.)
 *   3. **The validator exits 0 when the compile fails.** It prints
 *      `...Failure: Unable to locate map …`, a Java stack trace, and then
 *      `Successfully compiled map … to <path>` — and returns 0 without writing
 *      the file. `set -euo pipefail` cannot see that, and the artifact upload
 *      was `if-no-files-found: ignore`, so the missing output was silent too.
 *
 * On top of that the four draft maps could not have compiled even if they had
 * been loaded: they opened with R5-style `/// url = "…"` metadata, which the
 * R4 FML parser rejects at line 1 (`Found "url" expecting "map"`). The one red
 * run in the history (2026-06-06, run 27072266152) was a `SocketException`
 * reaching tx.fhir.org — evidence that the job can fail, not that the check can
 * detect a bad map.
 *
 * So: this script asserts on the *output artifact*, not the exit code.
 *
 * ─── What each phase actually covers ────────────────────────────────────────
 *
 * COMPILE (hermetic, `-tx n/a`)
 *   Catches: FML syntax errors, an unparseable header, a map whose canonical
 *   URL does not match its filename's declared URL, unresolvable `imports`.
 *   Does NOT catch: misspelled target elements. `tgt.interpretaton = …`
 *   compiles clean — the compiler is a parser, not a profile checker. Element
 *   names are checked when the map is *executed* (the parity phase below) and
 *   by the IG Publisher when it builds the StructureMap.
 *
 * PARITY (needs a terminology server — the transform engine refuses `-tx n/a`)
 *   Executes StanleyBrownQRToCarePlan over a committed QuestionnaireResponse
 *   and compares the result to `scripts/fixtures/stanley-brown/`
 *   `careplan-expected.json`. The TypeScript half of the same contract is
 *   asserted offline by `web/src/lib/carePlanMappers/stanleyBrown.parity.test.ts`,
 *   which compares the runtime mapper against that same golden file. Between
 *   them, either side drifting from the declared transformation goes red.
 *
 * Usage:
 *   node scripts/check-fml.mjs [--tx <url|n/a>] [--jar <path>] [--write-golden]
 *
 *   --tx n/a          compile only; skip parity (and say so loudly)
 *   --write-golden    regenerate the golden from the transform output. Review
 *                     the diff — this is the contract both sides are held to.
 *
 * Environment:
 *   SPIER_VALIDATOR_JAR  path to an existing validator_cli.jar (skips download)
 *   SPIER_FHIR_TX        terminology server, or `n/a`
 *
 * Prerequisites: Java 17+, and `ig/fsh-generated/resources/` populated by
 * `npx fsh-sushi .` inside `ig/`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { FHIR_VERSION, VALIDATOR_VERSION, resolveValidatorJar } from './lib/validator-jar.mjs'
import { normalizeCarePlan, PARITY_EXCLUSIONS } from './lib/careplan-parity.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** Published maps — compiled by the IG Publisher, so these must always be green. */
const MAPS_DIR = join(root, 'ig/input/resources/maps')
/**
 * Unpromoted drafts. Empty today; kept scanned so a map parked here while it is
 * being written is still gated, which is the whole point of having a drafts
 * folder rather than an unwatched scratch directory.
 */
const DRAFTS_DIR = join(root, 'ig/drafts')

const GENERATED_DIR = join(root, 'ig/fsh-generated/resources')

const FIXTURES_DIR = join(root, 'scripts/fixtures/stanley-brown')
/**
 * Both QuestionnaireResponse shapes the map accepts, against ONE golden — they
 * carry identical content, so a difference between them is a defect by
 * definition.
 *
 * ⚠️ Testing only the legacy shape is what let #419 exist. The map read the
 * repeating contact groups as `answer.item`, the Questionnaire declares them as
 * `type: group, repeats: true` (so a conforming filler emits `item.item`), and
 * the single fixture happened to use the shape the map could read. The two
 * agreed with each other and both disagreed with the Questionnaire, so parity
 * was green while a real safety plan lost every contact section.
 */
const PARITY_GOLDEN = join(FIXTURES_DIR, 'careplan-expected.json')
const PARITY_SOURCES = [
  { label: 'conformant (item.item — what SPiER\'s form emits)', path: join(FIXTURES_DIR, 'questionnaireresponse-conformant.json') },
  { label: 'legacy (answer.item — non-conformant, still accepted)', path: join(FIXTURES_DIR, 'questionnaireresponse.json') },
]
const PARITY_MAP = 'http://spier.org/StructureMap/StanleyBrownQRToCarePlan'

// --- CLI args --------------------------------------------------------------
const argv = process.argv.slice(2)
const argValue = (flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? undefined : argv[i + 1]
}
const tx = argValue('--tx') ?? process.env.SPIER_FHIR_TX ?? 'n/a'
const writeGolden = argv.includes('--write-golden')

const problems = []
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

let jar
try {
  jar = await resolveValidatorJar({ explicitPath: argValue('--jar') })
} catch (err) {
  fail(err.message)
}

// --- Collect maps ----------------------------------------------------------
function fmlFilesIn(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.fml'))
    .sort()
    .map((f) => join(dir, f))
}

const published = fmlFilesIn(MAPS_DIR)
const drafts = fmlFilesIn(DRAFTS_DIR)
const allMaps = [...published, ...drafts]

if (published.length === 0) {
  // A silent "0 maps, all green" is exactly the failure this script exists to
  // stop. If the folder is ever emptied or renamed, say so instead of passing.
  fail(
    `no .fml files found in ${relative(root, MAPS_DIR)}.\n` +
      '  The published maps live there and are wired into the IG build via the\n' +
      '  `path-resource: input/resources/maps` parameter in ig/sushi-config.yaml.',
  )
}

/**
 * R4 FML declares identity on line 1 as `map "<url>" = "<name>"`. The R5
 * `/// url = "…"` metadata block does not parse under `-version 4.0.1`, and
 * because a file that fails to parse simply contributes 0 resources, that
 * mistake is invisible unless it is checked for by name.
 */
function readMapHeader(file) {
  const text = readFileSync(file, 'utf8')
  if (/^\s*\/\/\/\s*url\s*=/m.test(text) && !/^\s*map\s+"/m.test(text)) {
    return {
      error:
        'uses R5 `/// url = "…"` metadata. The R4 parser rejects it at line 1 ' +
        '("Found \\"url\\" expecting \\"map\\"") and the file contributes no map at all. ' +
        'Use `map "<url>" = "<name>"` instead.',
    }
  }
  const match = text.match(/^\s*map\s+"([^"]+)"\s*=\s*"([^"]+)"/m)
  if (!match) return { error: 'no `map "<url>" = "<name>"` declaration found.' }
  return { url: match[1], name: match[2] }
}

// --- Compile ---------------------------------------------------------------
const workDir = mkdtempSync(join(tmpdir(), 'spier-fml-'))
const cleanup = () => rmSync(workDir, { recursive: true, force: true })
process.on('exit', cleanup)

console.log(
  `Compiling ${allMaps.length} StructureMap(s) ` +
    `(validator ${VALIDATOR_VERSION} · FHIR ${FHIR_VERSION} · tx n/a)…\n`,
)

for (const file of allMaps) {
  const rel = relative(root, file)
  const header = readMapHeader(file)
  if (header.error) {
    problems.push(`${rel}: ${header.error}`)
    console.log(`  ✗ ${rel}`)
    continue
  }

  const expectedName = basename(file, '.fml')
  if (header.name !== expectedName) {
    // The IG Publisher derives the StructureMap id from the file name; a
    // mismatch publishes an artifact whose id and name disagree.
    problems.push(`${rel}: declares name "${header.name}" but the file is named "${expectedName}.fml".`)
  }

  const out = join(workDir, `${expectedName}.json`)
  const run = spawnSync(
    'java',
    [
      '-jar', jar,
      'compile', header.url,
      '-output', out,
      '-version', FHIR_VERSION,
      '-tx', 'n/a',
      // Order matters only in that both must be present: the generated
      // resources resolve `imports` (the ConceptMaps), and the map folders
      // are what actually put the .fml into the context.
      '-ig', GENERATED_DIR,
      ...(published.length ? ['-ig', MAPS_DIR] : []),
      ...(drafts.length ? ['-ig', DRAFTS_DIR] : []),
    ],
    { encoding: 'utf8' },
  )

  const log = `${run.stdout ?? ''}${run.stderr ?? ''}`
  // The exit code is not trustworthy here (see the header). The output file is.
  const produced = existsSync(out) && statSync(out).size > 0

  // Surface the parse error for *this* file, which the validator reports while
  // loading the folder rather than while compiling.
  const parseError = log
    .split('\n')
    .find((line) => line.includes('load file:') && line.includes(basename(file)) && line.includes('ignored due to error'))

  if (!produced) {
    const detail = parseError
      ? parseError.replace(/^.*ignored due to error:\s*/, '').trim()
      : (log.split('\n').find((l) => l.includes('...Failure:')) ?? 'no output produced and no diagnostic emitted').trim()
    problems.push(`${rel}: did not compile — ${detail}`)
    console.log(`  ✗ ${rel}`)
    continue
  }
  if (parseError) {
    problems.push(`${rel}: ${parseError.replace(/^.*ignored due to error:\s*/, '').trim()}`)
    console.log(`  ✗ ${rel}`)
    continue
  }

  console.log(`  ✓ ${rel}  →  ${header.url}`)
}

// --- Parity ----------------------------------------------------------------
// The transform engine refuses to run without a terminology server, so this
// half cannot be offline-reproducible the way the compile half is. Same
// constraint, same treatment as `check:codings`: it runs in CI, not in
// `npm run verify`.
if (tx === 'n/a') {
  console.log(
    '\n⚠ Parity check SKIPPED (--tx n/a). The FML transform engine requires a\n' +
      '  terminology server. Re-run with --tx https://tx.fhir.org to compare\n' +
      `  ${PARITY_MAP}\n` +
      '  against its golden CarePlan. The TypeScript half of the same contract is\n' +
      '  covered offline by stanleyBrown.parity.test.ts.',
  )
} else if (problems.length) {
  console.log('\n⚠ Parity check SKIPPED — a map failed to compile, so its output would be meaningless.')
} else {
  console.log(`\nRunning transform parity for ${PARITY_MAP} (tx ${tx})…`)

  for (const [i, source] of PARITY_SOURCES.entries()) {
    if (!existsSync(source.path)) {
      problems.push(`parity fixture ${relative(root, source.path)} is missing`)
      continue
    }
    const out = join(workDir, `parity-careplan-${i}.json`)
    const run = spawnSync(
      'java',
      [
        '-jar', jar,
        'transform', PARITY_MAP, source.path,
        '-output', out,
        '-version', FHIR_VERSION,
        '-tx', tx,
        '-ig', GENERATED_DIR,
        '-ig', MAPS_DIR,
      ],
      { encoding: 'utf8' },
    )
    const log = `${run.stdout ?? ''}${run.stderr ?? ''}`

    if (!existsSync(out) || statSync(out).size === 0) {
      const detail = log.split('\n').find((l) => l.includes('Error transforming') || l.includes('Exception')) ?? 'no output produced'
      problems.push(`transform ${PARITY_MAP} failed on the ${source.label} fixture — ${detail.trim()}`)
      continue
    }
    const actual = normalizeCarePlan(JSON.parse(readFileSync(out, 'utf8')))

    // Only the FIRST (conformant) fixture may write the golden; the second must
    // agree with it rather than overwrite it, which is the whole point.
    if (writeGolden && i === 0) {
      writeFileSync(PARITY_GOLDEN, `${JSON.stringify(actual, null, 2)}\n`)
      console.log(`  ✎ wrote ${relative(root, PARITY_GOLDEN)} from the ${source.label} fixture — review the diff before committing.`)
      continue
    }
    if (!existsSync(PARITY_GOLDEN)) {
      problems.push(`${relative(root, PARITY_GOLDEN)} is missing — regenerate it with --write-golden.`)
      continue
    }
    const expected = JSON.parse(readFileSync(PARITY_GOLDEN, 'utf8'))
    const a = JSON.stringify(actual, null, 2)
    const e = JSON.stringify(expected, null, 2)
    if (a === e) {
      console.log(`  ✓ ${source.label} matches the golden CarePlan`)
    } else {
      problems.push(
        `${basename(PARITY_MAP)} output for the ${source.label} fixture no longer matches ` +
          `${relative(root, PARITY_GOLDEN)}.\n${diffLines(e, a)}`,
      )
    }
  }

  if (PARITY_SOURCES.length < 2) {
    problems.push('parity is covering fewer than both QuestionnaireResponse shapes — see PARITY_SOURCES')
  }
}

/** Minimal line diff — enough to read in CI logs without pulling a dependency. */
function diffLines(expected, actual) {
  const e = expected.split('\n')
  const a = actual.split('\n')
  const out = []
  for (let i = 0; i < Math.max(e.length, a.length); i += 1) {
    if (e[i] !== a[i]) {
      if (e[i] !== undefined) out.push(`      - expected: ${e[i].trim()}`)
      if (a[i] !== undefined) out.push(`      + actual:   ${a[i].trim()}`)
    }
  }
  return out.slice(0, 40).join('\n')
}

// --- Report ----------------------------------------------------------------
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error('')
  process.exit(1)
}

const parityNote =
  tx === 'n/a'
    ? '. Parity not checked (no terminology server).'
    : writeGolden
      ? ' and the Stanley-Brown transform output was written to the golden CarePlan.'
      : ' and the Stanley-Brown transform matches its golden CarePlan.'

console.log(
  `\n✓ ${allMaps.length} StructureMap(s) compile${parityNote}` +
    `\n  Fields excluded from the parity comparison: ${PARITY_EXCLUSIONS.join(', ')}.`,
)
