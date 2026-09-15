/**
 * The date strings the workflow recorders put in their inputs.
 *
 * Built in the browser's LOCAL timezone on purpose. `toISOString()` is UTC,
 * which defaults a date input to tomorrow for anyone behind UTC in the
 * evening — the first recorder found this and fixed it in a private helper,
 * and nine more views then copied the helper (five as `todayIso`, three as
 * `nowLocal`) rather than share it. One copy here, so the timezone decision
 * is made once.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD`, local — the value for an `<input type="date">`. */
export function todayLocalIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** `YYYY-MM-DDTHH:MM`, local — the value for an `<input type="datetime-local">`. */
export function nowLocalIso(now: Date = new Date()): string {
  return `${todayLocalIso(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/**
 * A datetime-local input's value as a full UTC instant for a FHIR resource,
 * falling back to "now" when the field is empty or unparseable rather than
 * writing `Invalid Date` into the record.
 */
export function toIsoOrNow(localValue: string, now: Date = new Date()): string {
  const ms = new Date(localValue).getTime()
  return Number.isFinite(ms) ? new Date(ms).toISOString() : now.toISOString()
}

/** The first ten characters of a FHIR dateTime — the day, as the record spells it. */
export function isoDay(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

/**
 * A date for reading — "Sep 15, 2026" — or an em dash for nothing parseable.
 *
 * A date-only value (`2026-09-15`, a FHIR `date`) is a calendar day, not an
 * instant: `new Date()` reads it as UTC midnight, and a local rendering west
 * of Greenwich shows the day before. So a date-only value is formatted in
 * UTC, and only a real instant (with a time) is formatted in local time. The
 * encounters timeline carried a `timeZone: 'UTC'` for exactly this; now the
 * helper knows.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  })
}

/** A date and time for reading — "Sep 15, 2026, 12:08 PM" — or an em dash. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(iso)}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/** "Today", "3 days ago", "2 weeks ago", "4 months ago" — for a caseload's last-activity column. */
export function formatDaysAgo(isoDate: string, now: number = Date.now()): string {
  const then = new Date(isoDate).getTime()
  const days = Math.max(0, Math.floor((now - then) / 86_400_000))
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (days === 0) return 'Today'
  if (days < 7) return ago(days, 'day')
  if (days < 30) return ago(Math.floor(days / 7), 'week')
  return ago(Math.floor(days / 30), 'month')
}
