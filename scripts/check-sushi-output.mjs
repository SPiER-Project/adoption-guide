#!/usr/bin/env node
/**
 * Gate the SHAPE of SUSHI's warnings, so the next real one is not invisible.
 *
 * Until #271, "SUSHI is quiet" was a usable signal: the repo compiled at
 * `0 Errors  0 Warnings`. #271 sliced `.category` on 28 profiles to carry
 * `spier-concept-domain#suicide-risk`; the slicing is `#open` by design, so
 * every example Instance that sets a standard category by numeric index
 * (`* category[+] = …#survey`) now emits one advisory warning:
 *
 *   warn  Sliced element Observation.category is being accessed via numeric
 *         index. Use slice names in rule paths when possible.
 *
 * ⚠️ **That reasoning was wrong, and the warnings were not harmless.** This
 * docblock used to argue the warnings should be left alone because naming the
 * slices would "over-constrain ~28 profiles" for a quiet linter. In fact the
 * named slice on the domain tag was resolving onto index 0 and **overwriting the
 * value `category[+]` had just written there** — 23 of 25 example Instances were
 * silently losing `survey` / `procedure` / `problem-list-item` / the SNOMED
 * artifact code. Nothing caught it, because a missing optional category is not a
 * validation error: `validate-fhir.mjs` reporting 0 errors was never evidence the
 * category survived.
 *
 * Those profiles now declare their standard category as a named slice too (see
 * `SurveyCategorySlice` and friends in `ig/input/fsh/concept-layer.fsh`), which
 * fixes the data loss, removes the warning at its source, and — for `survey` —
 * makes the instrument Observations conformant to
 * `us-core-observation-screening-assessment`. That took the count from 31 to 6.
 *
 * The 6 that remain are genuinely benign and structurally different: they are
 * `Communication.category[+].text` assignments, which write a *sub-element* of
 * index 0, so the domain coding merges into the same CodeableConcept instead of
 * replacing it. Text and coding both survive. Verify that before assuming a new
 * numeric-index warning is equally harmless — the two cases look identical in
 * SUSHI's output and only one of them loses data.
 *
 * The gap it closes is that the in-source comment tells a human reader to leave
 * the warnings alone, and nothing told CI. The real 32nd warning now arrives in
 * a field of 31 expected ones, and `ig.yml`'s `sushi .` asserted nothing about
 * warnings at all (issue #273). Same class of blind spot as the `check:codings`
 * floors and the CQL `Translating CQL source` log assertion: green means
 * nothing until something asserts what green consists of.
 *
 * So: match the SHAPE, never a count. Pinning "31" would churn on every new
 * example Instance and would train people to bump the number without reading it
 * — the exact failure mode #232 demonstrated with a stale `check:codings` floor.
 *
 * Usage:
 *   node scripts/check-sushi-output.mjs                # compile ig/ and gate the output
 *   node scripts/check-sushi-output.mjs <path-to-log>  # gate an already-captured log
 *
 * The second form is what CI uses: `ig.yml` tees the compile step's output, so
 * the compile keeps its own step (and its own exit status) and this reads the
 * capture. That scoping also sidesteps the trap in this area — `npm install -g
 * fsh-sushi` prints its own `npm warn deprecated …` lines, and a naive
 * `grep -i warn` over a whole job's log false-positives on every one of them.
 * Lines starting `npm warn` are skipped here as well, belt and braces.
 *
 * Exits non-zero on an unexpected warning, on any error, or when it cannot
 * account for what SUSHI reported.
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const igDir = resolve(root, 'ig')

/**
 * Warnings this repo expects. Each entry needs a reason, because adding one is
 * a decision to stop reading a class of warning — the thing this gate exists to
 * prevent happening by accident.
 */
const ALLOWED = [
  {
    id: 'sliced-category-numeric-index',
    // Communication only, now. Observation/CarePlan/Condition used to produce
    // this too — and were losing data when they did; those profiles now name
    // their standard category slice. See the docblock above before widening
    // this back out to `[A-Za-z]+`.
    pattern: /^Sliced element Communication\.category is being accessed via numeric index\./,
    why: 'Communication example Instances set `category[+].text` — a SUB-ELEMENT of '
       + 'index 0, so the concept-domain coding merges into that same '
       + 'CodeableConcept rather than replacing it. Both survive; verified against '
       + 'the generated resources. This is NOT the same case as a whole-value '
       + '`category[+] = <coding>`, which silently lost the coding until the named '
       + 'slices landed — see ig/input/fsh/concept-layer.fsh.',
  },
]

// SUSHI colourises when attached to a TTY. Strip ANSI so a local run parses the
// same as a piped CI one.
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '')

let output
const [logPath] = process.argv.slice(2)
if (logPath) {
  if (!existsSync(logPath)) {
    console.error(`✗ log file not found: ${logPath}`)
    process.exit(1)
  }
  output = readFileSync(logPath, 'utf8')
  console.log(`reading captured SUSHI output: ${logPath}`)
} else {
  console.log(`compiling ${igDir} with fsh-sushi …`)
  const run = spawnSync('npx', ['fsh-sushi', '.'], { cwd: igDir, encoding: 'utf8' })
  if (run.error) {
    console.error(`✗ could not run fsh-sushi: ${run.error.message}`)
    process.exit(1)
  }
  output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  process.stdout.write(output)
  // SUSHI exits non-zero on errors. Warnings alone leave it at 0, which is why
  // this gate reads output rather than status — but a real failure still fails.
  if (run.status !== 0) {
    console.error(`\n✗ fsh-sushi exited ${run.status}`)
    process.exit(1)
  }
}

const lines = stripAnsi(output).split('\n')

// A warning is a line starting `warn `; the `  File:` / `  Line:` lines that
// follow are indented continuations belonging to it.
const warnings = []
const errors = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (/^npm\s+warn/i.test(line)) continue // npm's own deprecation notices
  const warn = /^warn\s+(.*)$/.exec(line)
  const error = /^error\s+(.*)$/.exec(line)
  if (!warn && !error) continue
  const context = []
  for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) context.push(lines[j].trim())
  ;(warn ? warnings : errors).push({ message: (warn ?? error)[1].trim(), context })
}

// The summary banner's sentence is randomised per run ("Something smells
// fishy…", "You seem to be casting about…"), so match only the N Errors /
// N Warnings fields.
const summary = [...stripAnsi(output).matchAll(/(\d+)\s+Errors?\s+(\d+)\s+Warnings?/g)].pop()

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

if (!summary) {
  // Without the banner there is nothing to reconcile the parse against, and an
  // unparsed log would otherwise read as a clean one.
  console.error('✗ could not find SUSHI\'s "N Errors  N Warnings" summary in the output — '
    + 'this gate cannot vouch for a compile it did not see')
  process.exit(1)
}
const reportedErrors = Number(summary[1])
const reportedWarnings = Number(summary[2])
console.log(`SUSHI reported ${reportedErrors} error(s), ${reportedWarnings} warning(s); `
  + `parsed ${errors.length} error line(s), ${warnings.length} warning line(s)`)

// If SUSHI's line format changes, the per-line regex above silently matches
// nothing and every warning becomes "expected". Reconciling the parse against
// SUSHI's own count is what keeps that from passing.
if (warnings.length !== reportedWarnings) {
  fail(`parsed ${warnings.length} warning line(s) but SUSHI reported ${reportedWarnings} — `
    + 'the parser and SUSHI disagree, so no verdict here is trustworthy')
}
if (errors.length !== reportedErrors) {
  fail(`parsed ${errors.length} error line(s) but SUSHI reported ${reportedErrors} — same problem`)
}

if (reportedErrors > 0 || errors.length > 0) {
  for (const e of errors) fail(`SUSHI error: ${e.message}${e.context.length ? `\n    ${e.context.join('\n    ')}` : ''}`)
  if (errors.length === 0) fail(`SUSHI reported ${reportedErrors} error(s)`)
}

const tally = new Map(ALLOWED.map((a) => [a.id, 0]))
for (const w of warnings) {
  const match = ALLOWED.find((a) => a.pattern.test(w.message))
  if (match) {
    tally.set(match.id, tally.get(match.id) + 1)
    continue
  }
  fail(`unexpected SUSHI warning:\n    ${w.message}`
    + `${w.context.length ? `\n    ${w.context.join('\n    ')}` : ''}`)
}

for (const [id, count] of tally) {
  const entry = ALLOWED.find((a) => a.id === id)
  console.log(`  ${count} × ${id} — expected. ${entry.why}`)
}

if (failures) {
  console.error(`\nSUSHI output check FAILED (${failures} issue(s)).`)
  console.error('Fix the warning, or — if it is genuinely expected — add it to ALLOWED in '
    + 'scripts/check-sushi-output.mjs with the reason it is expected.')
  process.exit(1)
}
console.log('\nSUSHI output check passed: every warning is a known, deliberate advisory.')
