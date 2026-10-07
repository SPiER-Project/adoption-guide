#!/usr/bin/env node
/**
 * Keep the population scenarios' dates coherent with their anchor (#297), and
 * re-date a scenario's FILE when its designed state changes.
 *
 * ─── How the demo stays current ───
 *
 * The files are dated against `SCENARIO_ANCHOR` and stay that way. The two
 * Workers that serve them (the mock EHR and the CDS service's fallback) serve
 * them `populationScenariosAsOf(today)`: every date moved forward by the whole
 * UTC days since the anchor, so patient-001 is ~3 days overdue on any day. The
 * reasoning — and why neither an app-side demo clock nor a scheduled re-date was
 * chosen — is in `packages/demo-population/src/scenarioDates.ts`, which also
 * owns the shift this script applies. Before that, the apps read the static
 * files on the real clock: two months after the last re-date, patient-001 read
 * 59 days overdue.
 *
 * ─── The invariants it refuses to break ───
 *
 * A date can be schema-valid and still nonsense: a `fulfilled` appointment next
 * week. Every check below is phrased against the ANCHOR, and holds for what is
 * served because a whole-day shift moves the anchor to today with everything
 * else.
 *
 * ⚠️ **"Already happened" is bounded at the START of the anchor day, not its
 * end.** Served, the anchor day IS today, so a QR authored at 09:30 on it is in
 * the future for any viewer before 09:30 UTC — and the measure period ends at
 * now, so it drops out of the numbers for those hours. Until 2026-10-06 the
 * bound was 23:59:59, which was right only while the apps read the files as-is;
 * sixteen timestamps sat after midnight and moved when the bound did. A
 * date-only value on the anchor day (midnight) still passes.
 *
 * ⚠️ **A date written into prose is an error.** The shift rewrites strings that
 * ARE dates; "patient seen 2026-03-20" is served verbatim and goes stale. Three
 * such notes were already wrong, left behind by the August re-date. Say it
 * relatively ("four days later") or put it in a date element.
 *
 * ─── Two modes ───
 *
 *   --check   (default) Validate the files AS THEY ARE. Idempotent; in `verify`.
 *   --apply   Shift each file by SHIFTS below, validate the result, then write.
 *
 * ⚠️ **What --check does NOT see: whether a scenario still shows the state its
 * SHIFTS comment names.** That is the reassessment math, not a date bound.
 *
 * SHIFTS is a one-time migration, not a standing offset. An early version
 * applied it in both modes, so the second run double-shifted and pushed an
 * episode past the anchor. To change a scenario's designed state, set its delta,
 * run --apply once, and reset it to 0.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCore } from './lib/load-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const scenarioDir = resolve(here, '../packages/demo-population/src/scenarios')

// The anchor and the shift are the ones the Workers serve with — loaded, not
// copied, so this gate cannot check a different shift from the one in use.
const [{ SCENARIO_ANCHOR: ANCHOR, shiftDates, isIsoDate }] = await loadCore([
  '@spier/demo-population',
])
if (typeof ANCHOR !== 'string' || typeof shiftDates !== 'function' || typeof isIsoDate !== 'function') {
  console.error('✗ @spier/demo-population no longer exports SCENARIO_ANCHOR / shiftDates / isIsoDate')
  process.exit(1)
}

/**
 * Days to add to every date in a scenario FILE under --apply. All 0: nothing is
 * pending. Every scenario has an entry because --apply refuses a file without
 * one — a new scenario needs a deliberate delta, not a default.
 *
 * Comments name the reassessment state each scenario shows on any day, as
 * DERIVED today; `tests/scenarioDates.test.ts` pins the same table, so a change
 * to one is a decision. ⚠️ 001 and 006 were first re-dated to these states as
 * high/7d; once the caseload row read the harmonized tier (2026-09-21) both
 * derived moderate/14d and lost them, and on 2026-10-06 each moved 7 days
 * earlier to restore them. 003 (designed no-baseline) and 008 (designed ~2
 * weeks) still differ from their original design.
 */
const SHIFTS = {
  'patient-001.json': 0, // moderate/14d → overdue by 3 days, the red case
  'patient-002.json': 0, // not on the pathway → no cadence
  'patient-003.json': 0, // low/30d → due in 30 days (designed: no-baseline); item-9 answer on the anchor day
  'patient-004.json': 0, // moderate/14d → due today
  'patient-005.json': 0, // acute → no routine cadence
  'patient-006.json': 0, // moderate/14d → due in 2 days, the amber "due in 48 hours" case
  'patient-007.json': 0, // moderate/14d → no-baseline
  'patient-008.json': 0, // low/30d → due in 6 days (designed: ~2 weeks)
  'patient-009.json': 0, // high/7d → overdue by 6 days
  'patient-010.json': 0, // low/30d → due in 12 days
  'patient-011.json': 0, // high/7d → overdue by 2 days
  'patient-012.json': 0, // not on the pathway → no cadence
  'patient-013.json': 0, // acute → no routine cadence
  'patient-014.json': 0, // acute → no routine cadence (the elopement case)
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
  // Procedure — a counseling session "performed" next month is the same
  // nonsense as a fulfilled appointment next week. Missing until 2026-10-06.
  'performedDateTime',
]

/** Period-typed elements whose start/end are checked like the fields above. */
const PERIOD_FIELDS = ['period', 'performedPeriod']

function collectDates(resource) {
  const out = []
  for (const f of DATE_FIELDS) {
    if (typeof resource[f] === 'string') out.push([f, resource[f]])
  }
  for (const p of PERIOD_FIELDS) {
    if (resource[p]?.start) out.push([`${p}.start`, resource[p].start])
    if (resource[p]?.end) out.push([`${p}.end`, resource[p].end])
  }
  return out
}

/**
 * The resource a bucket entry holds, and the dates on it.
 *
 * ⚠️ `responses` holds StoredResponse WRAPPERS, not resources: the date is
 * `resource.authored` (plus the wrapper's own `completedAt`). Reading the
 * wrapper's top-level fields — as this did until 2026-10-06 — found no date at
 * all, so `responses` sat in PAST_ONLY_BUCKETS checking nothing, and a QR
 * authored next year passed.
 */
function datedEntry(bucket, entry) {
  if (bucket !== 'responses') return [entry, collectDates(entry)]
  const qr = entry?.resource ?? {}
  const dates = collectDates(qr)
  if (typeof entry?.completedAt === 'string') dates.push(['completedAt (wrapper)', entry.completedAt])
  return [qr, dates]
}

/** Every string in `node` that contains a date without being one. */
function proseDates(node, path, out) {
  if (typeof node === 'string') {
    if (!isIsoDate(node) && /\d{4}-\d{2}-\d{2}/.test(node)) out.push([path, node])
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => proseDates(v, `${path}[${i}]`, out))
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) proseDates(v, path ? `${path}.${k}` : k, out)
  }
  return out
}

function checkScenario(name, doc, anchorMs, errors, warnings) {
  for (const [path, value] of proseDates(doc, '', [])) {
    errors.push(
      `${name}: ${path} = ${JSON.stringify(value)} writes a date into text — the served ` +
        'shift cannot move it, so it goes stale. Say it relatively, or use a date element',
    )
  }

  for (const bucket of PAST_ONLY_BUCKETS) {
    for (const entry of doc[bucket] ?? []) {
      const [r, dates] = datedEntry(bucket, entry)
      for (const [field, value] of dates) {
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
// `readdirSync` + filter rather than `fs.globSync`. globSync needs Node 22, and
// the floor was Node 20 when this was written: the mismatch stayed invisible for
// as long as the gate ran only on developer machines, then threw `SyntaxError:
// does not provide an export named 'globSync'` the first time CI executed it.
// The floor is 22 now (`.github/.nvmrc`) so globSync would work, but this stays
// — every other script in scripts enumerates with readdirSync, and matching
// them is worth more than the one line saved. See docs/internals/build-gotchas.md.
const files = readdirSync(scenarioDir)
  .filter(name => /^patient-.*\.json$/.test(name))
  .sort()
if (files.length === 0) {
  console.error(`✗ no scenario files found under ${scenarioDir}`)
  process.exit(1)
}

// The START of the anchor day: served, the anchor day is today, and nothing that
// already happened may be later than the earliest moment of it. See the header.
const anchorMs = Date.parse(`${ANCHOR}T00:00:00Z`)
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
  const candidate = apply && days ? shiftDates(original, days) : original
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
