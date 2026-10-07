/**
 * The scenarios' clock: the day they are authored against, and how they are
 * served relative to today.
 *
 * ─── Why the data moves rather than the clock ───
 *
 * The scenario files are dated against `SCENARIO_ANCHOR`, and every state the
 * demo is designed to show is relative to it: patient-001 is ~3 days overdue,
 * patient-006 due in 2, patient-003's positive item 9 is "today". The apps run
 * on the real clock, so a static file drifts a day behind every day — two months
 * after the last re-date, patient-001 read 59 days overdue and patient-006 54.
 *
 * #297 rejected giving the apps an injectable clock, and the measurement has
 * only grown since (51 `new Date()` / `Date.now()` sites, most of them MINTING
 * `authored`, `effectiveDateTime`, `_savedAt`): an anchored clock for reads but
 * not writes dates a clinician's submission months after every fixture.
 * Re-dating the files on a schedule means a bot committing to `main`.
 *
 * So the two Workers that serve the population — the mock EHR and the CDS
 * service's no-prefetch fallback — serve it `asOf(now)`: every date in a
 * scenario moved forward by the whole UTC days between the anchor and today.
 * The apps keep the real clock, a clinician's write is dated coherently with the
 * record around it, and the designed states hold on any day.
 *
 * ─── Why whole UTC days ───
 *
 * The apps' time-relative logic counts UTC calendar days (`reassessment.ts`,
 * `positiveItem9OnDay`, `shortDate`), so a whole-day shift reproduces every
 * designed state exactly and keeps every interval inside a scenario. It also
 * means a resource dated later in the anchor day would be served in the future
 * for part of every day — which is why `check:dates` bounds what already
 * happened at the START of the anchor day, not its end.
 *
 * ⚠️ **What a shift cannot move: a date written into prose.** `shiftDates`
 * rewrites strings that ARE dates; a note reading "seen 2026-03-20" is served
 * unchanged and goes stale. Three of those survived the August re-date. The
 * gate now fails on any date embedded in a longer string.
 *
 * ⚠️ **The files on disk stay anchor-dated, deliberately.** `check:scenarios`,
 * `check:dates` and `validate-fhir.mjs` validate the files, and the structural
 * tests read `POPULATION_SCENARIOS`; a uniform whole-day shift changes no shape,
 * no binding and no interval, so what they prove holds for what is served.
 * Re-dating the files (`--apply`) is now only for a deliberate content change.
 */
import type { PatientScenario } from './scenarios'
import { POPULATION_SCENARIOS } from './scenarios'

/** The UTC day every scenario file is dated against. */
export const SCENARIO_ANCHOR = '2026-08-11'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T/
const DAY_MS = 86_400_000

/** True for a string that IS a FHIR date or dateTime (and so gets shifted). */
export function isIsoDate(value: string): boolean {
  return DATE_ONLY.test(value) || DATE_TIME.test(value)
}

function shiftIso(value: string, days: number): string {
  const dateOnly = DATE_ONLY.test(value)
  const t = Date.parse(dateOnly ? `${value}T00:00:00Z` : value)
  if (!Number.isFinite(t)) return value
  const shifted = new Date(t + days * DAY_MS).toISOString()
  return dateOnly ? shifted.slice(0, 10) : shifted
}

/** A copy of `node` with every ISO date/dateTime string moved by `days`. */
export function shiftDates<T>(node: T, days: number): T {
  if (days === 0) return node
  if (typeof node === 'string') return (isIsoDate(node) ? shiftIso(node, days) : node) as T
  if (Array.isArray(node)) return (node as unknown[]).map(v => shiftDates(v, days)) as T
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, shiftDates(v, days)]),
    ) as T
  }
  return node
}

/** Whole UTC calendar days from the anchor to `now` (negative before it). */
export function daysSinceAnchor(now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((today - Date.parse(`${SCENARIO_ANCHOR}T00:00:00Z`)) / DAY_MS)
}

let memo: { days: number; scenarios: Record<string, PatientScenario> } | undefined

/**
 * The population as it reads on `now`'s UTC day. Memoized on the day count, so
 * a long-lived Worker isolate re-shifts once at midnight rather than serving
 * yesterday's dates, and never shifts twice in a day.
 */
export function populationScenariosAsOf(now: Date = new Date()): Record<string, PatientScenario> {
  const days = daysSinceAnchor(now)
  if (memo?.days !== days) {
    memo = { days, scenarios: shiftDates(POPULATION_SCENARIOS, days) }
  }
  return memo.scenarios
}
