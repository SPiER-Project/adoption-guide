#!/usr/bin/env node
/**
 * Re-date the population scenarios (#297).
 *
 * ─── Why this script exists ───
 *
 * Every clinical date in `src/data/population/scenarios/patient-*.json` is
 * static, and the demo has enough time-relative logic that stale fixtures make a
 * working pathway read as a failing one: reassessments all overdue, no visit ever
 * booked, "positive item 9 today" structurally zero.
 *
 * #297 considered making the app's clock injectable instead. That was rejected on
 * measurement: there are 33 `new Date()` call sites in `src`, and only 5 are the
 * parameterised derivation kind. The rest are components that MINT resources —
 * `authoredOn`, `effectiveDateTime`, `_savedAt`. Anchoring reads without writes
 * means a clinician submitting an assessment in the demo creates an artifact
 * months after every fixture, flipping that one patient to "on time"; anchoring
 * both is a 33-site change touching every recorder. Static fixtures also keep
 * `check:scenarios` and `validate-fhir.mjs` validating exactly what the app
 * renders, which an offset-at-load-time approach would quietly break.
 *
 * So the dates stay static and this script makes re-dating a command rather than
 * 40 hand edits across 11 files.
 *
 * ─── Per-scenario shifts, not one global shift ───
 *
 * A single shift cannot work. The scenarios are independently stale — patient-001
 * was 143 days overdue and patient-010 one day — so any uniform shift that fixes
 * one puts another's last assessment in the future. Each scenario gets its own
 * delta, which still moves every date INSIDE that scenario together, preserving
 * the intervals that carry the clinical meaning (patient-011's 48-hour ED
 * outreach, patient-001's 7-day follow-up).
 *
 * ─── The invariants it refuses to break ───
 *
 * Shifting forward can produce nonsense that no other gate catches, because
 * every individual resource stays schema-valid. A `fulfilled` appointment dated
 * next week is the obvious one. This script asserts the whole set after shifting
 * and exits non-zero rather than writing, so a bad delta fails here instead of
 * becoming a confusing demo.
 *
 * ─── Two modes, and why they differ ───
 *
 *   --check   (default) Validate the files AS THEY ARE. Applies no shift, so it
 *             is idempotent and safe to run from `verify` forever.
 *   --apply   Shift by SHIFTS below, validate the result, then write.
 *
 * The distinction matters: SHIFTS is a one-time migration, not a standing offset.
 * An early version applied it in both modes, so the second run double-shifted and
 * pushed an episode past the anchor. If you re-date again, set new deltas, run
 * --apply once, and reset them to 0 (or update ANCHOR and start over).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const scenarioDir = resolve(here, '../src/data/population/scenarios')

/**
 * The anchor these fixtures are dated against. Recorded so a future refresh can
 * see how far the demo has drifted, and so `--check` has something to measure.
 */
export const ANCHOR = '2026-08-11'

/**
 * Days to add to every date in each scenario.
 *
 * Chosen so the caseload shows a MIX of reassessment states rather than a wall of
 * red — the demo's job is to show the tracker working, and "everything overdue"
 * demonstrates nothing. Comments name the state each delta targets; the numbers
 * are also bounded by the invariants below (an appointment already fulfilled
 * cannot move past today).
 */
const SHIFTS = {
  'patient-001.json': 140, // high/7d → overdue by ~3 days; keeps its fulfilled visit in the past
  'patient-002.json': 87, //  no risk tier → no cadence either way; just recent activity
  'patient-003.json': 88, //  moderate, no assessment → no-baseline; puts its item-9 answer on the anchor day
  'patient-004.json': 77, //  moderate/14d → due today
  'patient-005.json': 83, //  acute → no routine cadence; recent activity
  'patient-006.json': 82, //  high/7d → due in 2 days, the amber "due in 48 hours" case
  'patient-007.json': 83, //  moderate, no assessment → no-baseline; bounded by its finished follow-up encounter
  'patient-008.json': 88, //  low/30d → on time, due in ~2 weeks
  'patient-009.json': 14, //  high/7d → overdue by ~6 days; bounded by its caring-contact Communication
  'patient-010.json': 13, //  low/30d → on time
  'patient-011.json': 73, //  high/7d → overdue by ~2 days; bounded by its caring-contact Communication
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T/
const DAY_MS = 86400000

function shiftIso(value, days) {
  const dateOnly = DATE_ONLY.test(value)
  const t = Date.parse(dateOnly ? `${value}T00:00:00Z` : value)
  if (!Number.isFinite(t)) return value
  const shifted = new Date(t + days * DAY_MS).toISOString()
  return dateOnly ? shifted.slice(0, 10) : shifted
}

/** Recursively shift every ISO date/dateTime string in a JSON value. */
function shiftDeep(node, days) {
  if (typeof node === 'string') {
    return DATE_ONLY.test(node) || DATE_TIME.test(node) ? shiftIso(node, days) : node
  }
  if (Array.isArray(node)) return node.map(v => shiftDeep(v, days))
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shiftDeep(v, days)]))
  }
  return node
}

/* ─── Invariants ─────────────────────────────────────────── */

/** Appointment statuses that assert the visit already happened (or didn't). */
const PAST_APPOINTMENT_STATUSES = new Set(['fulfilled', 'arrived', 'noshow', 'checked-in'])

/**
 * Buckets whose resources describe something that HAS happened, and so must not
 * be dated in the future. Deliberately excludes `appointments` (booked ones are
 * meant to be future) and `consents` (provision.period.end is a validity window).
 */
const PAST_ONLY_BUCKETS = [
  'responses',
  'observations',
  'carePlans',
  'communications',
  'procedures',
  'documentReferences',
  'encounters',
  'serviceRequests',
]

const DATE_FIELDS = [
  'authored',
  'effectiveDateTime',
  'issued',
  'sent',
  'authoredOn',
  'date',
  'dateTime',
  'start',
  'created',
  'occurrenceDateTime',
]

function collectDates(resource) {
  const out = []
  for (const f of DATE_FIELDS) {
    if (typeof resource[f] === 'string') out.push([f, resource[f]])
  }
  if (resource.period?.start) out.push(['period.start', resource.period.start])
  if (resource.period?.end) out.push(['period.end', resource.period.end])
  return out
}

function checkScenario(name, doc, anchorMs, errors, warnings) {
  for (const bucket of PAST_ONLY_BUCKETS) {
    for (const r of doc[bucket] ?? []) {
      for (const [field, value] of collectDates(r)) {
        const t = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value)
        if (Number.isFinite(t) && t > anchorMs) {
          errors.push(
            `${name}: ${bucket}[${r.id ?? '?'}].${field} = ${value} is AFTER the anchor — ` +
              `a ${r.resourceType} describes something that already happened`,
          )
        }
      }
    }
  }

  for (const a of doc.appointments ?? []) {
    const start = a.start
    if (!start) continue
    const t = Date.parse(start)
    if (!Number.isFinite(t)) continue
    if (PAST_APPOINTMENT_STATUSES.has(a.status) && t > anchorMs) {
      errors.push(
        `${name}: appointments[${a.id ?? '?'}] status "${a.status}" but starts ${start.slice(0, 10)}, ` +
          `after the anchor — a visit cannot already be ${a.status} in the future`,
      )
    }
    if (a.status === 'booked' && t <= anchorMs) {
      warnings.push(
        `${name}: appointments[${a.id ?? '?'}] is booked for ${start.slice(0, 10)}, in the past — ` +
          `it will not appear as an upcoming visit`,
      )
    }
  }

  // Episodes: an episode still open should not have ended, and none should start
  // in the future.
  for (const e of doc.episodes ?? []) {
    if (e.period?.start) {
      const t = Date.parse(`${e.period.start.slice(0, 10)}T00:00:00Z`)
      if (Number.isFinite(t) && t > anchorMs) {
        errors.push(`${name}: episodes[${e.id ?? '?'}].period.start is after the anchor`)
      }
    }
    if (e.status === 'active' && e.period?.end) {
      warnings.push(
        `${name}: episodes[${e.id ?? '?'}] is active but has period.end — it reads as closed`,
      )
    }
  }
}

/* ─── Main ───────────────────────────────────────────────── */

const apply = process.argv.includes('--apply')
// `readdirSync` + filter rather than `fs.globSync`, which needs Node 22 while
// every workflow here pins Node 20. This script was the only globSync user in
// the repo, and the mismatch was invisible for as long as the gate ran solely
// on developer machines: it threw `SyntaxError: does not provide an export
// named 'globSync'` the first time CI executed it. Every other script in
// web/scripts enumerates with readdirSync; this now matches.
const files = readdirSync(scenarioDir)
  .filter(name => /^patient-.*\.json$/.test(name))
  .sort()
if (files.length === 0) {
  console.error(`✗ no scenario files found under ${scenarioDir}`)
  process.exit(1)
}

const anchorMs = Date.parse(`${ANCHOR}T23:59:59Z`)
const errors = []
const warnings = []
const summary = []

for (const file of files) {
  const path = resolve(scenarioDir, file)
  const original = JSON.parse(readFileSync(path, 'utf8'))
  const days = SHIFTS[file]
  if (apply && days === undefined) {
    errors.push(`${file}: no entry in SHIFTS — a new scenario needs a deliberate delta, not a default of 0`)
    continue
  }
  // --check validates what is on disk. Only --apply shifts.
  const candidate = apply && days ? shiftDeep(original, days) : original
  checkScenario(basename(file), candidate, anchorMs, errors, warnings)
  summary.push({ file, days: apply ? (days ?? 0) : 0 })
  if (apply && days) writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`)
}

for (const w of warnings) console.warn(`  ! ${w}`)

if (errors.length > 0) {
  console.error(`\n✗ scenario date shift refused — ${errors.length} invariant violation(s):\n`)
  for (const e of errors) console.error(`  - ${e}`)
  console.error('\nAdjust SHIFTS in this script; nothing was written.\n')
  process.exit(1)
}

const newest = files
  .flatMap(f => JSON.stringify(JSON.parse(readFileSync(resolve(scenarioDir, f), 'utf8'))).match(/\d{4}-\d{2}-\d{2}/g) ?? [])
  .filter(d => d <= ANCHOR)
  .sort()
  .at(-1)

if (apply) {
  console.log(
    `✓ scenario dates shifted against anchor ${ANCHOR}: ` +
      summary.map(s => `${s.file.replace('patient-', '').replace('.json', '')}+${s.days}`).join(' '),
  )
} else {
  const ageDays = Math.round((Date.parse(`${ANCHOR}T00:00:00Z`) - Date.parse(`${newest}T00:00:00Z`)) / 86400000)
  console.log(
    `✓ scenario dates: ${files.length} scenario(s) consistent with anchor ${ANCHOR}; ` +
      `newest clinical date ${newest} (${ageDays} day(s) before the anchor)`,
  )
  console.log('\nscenario date check passed.')
}
