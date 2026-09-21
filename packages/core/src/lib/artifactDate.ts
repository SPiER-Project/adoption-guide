/**
 * The clinically meaningful date on any SPiER artifact.
 *
 * Lifted out of `registry.ts` when a second reader appeared: the pathway
 * evaluator (`pathwayEvaluation.ts`) asks the same question of the same
 * resources — *when was this recorded* — and a second field-precedence list
 * would be a second opinion about which element on a CarePlan, a Communication
 * or a Procedure carries the answer. `npm run check:dupes` fails the copy; this
 * module is the one definition.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */

/** Anything with a date on it. Every field is optional; none is required. */
export type DatedResourceLike = Record<string, unknown>

/**
 * The best available date for a resource, or `undefined` when it carries none.
 *
 * The order is deliberate and each entry earned its place: a resource's own
 * clinical time first, then the time it was written down, then — for resources
 * read back from a SMART server, which carry no local save stamp — the server's
 * own `meta.lastUpdated` as the last resort before the artifact goes undated.
 *
 * ⚠️ **Structurally typed, not `FhirResourceLike`.** This reads a SUPERSET of
 * what that interface declares — `meta.lastUpdated` is not on it — so naming it
 * here would make the last-resort branch unreachable for any caller who typed
 * their argument honestly, while the cast inside kept it working for the ones
 * who did not.
 */
export function bestArtifactDate(resource: DatedResourceLike): string | undefined {
  const r = resource as {
    authored?: string
    effectiveDateTime?: string
    issued?: string
    sent?: string
    // Stage-7: Task carries authoredOn; EpisodeOfCare/Flag carry period.start.
    // Without these the feed would fall back to the local `_savedAt` stamp,
    // which is the save time rather than the clinical time (and is absent
    // entirely on resources read back from a SMART server).
    authoredOn?: string
    // Stage-5: DocumentReference carries `date`, Consent `dateTime`, and
    // Appointment `start` (its clinical time is the visit, not the booking).
    date?: string
    dateTime?: string
    start?: string
    // Stage-4: means-safety counseling is a Procedure, whose clinical time is
    // `performedDateTime` (or the start of `performedPeriod`).
    performedDateTime?: string
    performedPeriod?: { start?: string; end?: string }
    period?: { start?: string; end?: string }
    // CarePlan's own record-time field, and the FHIR home of what the demo
    // fixtures used to keep in `_savedAt`. It sits beside `_savedAt` rather than
    // up with the clinical fields because both answer "when was this written
    // down", not "when did it happen".
    created?: string
    _savedAt?: string
    meta?: { lastUpdated?: string }
  }
  return (
    r.authored ??
    r.effectiveDateTime ??
    r.issued ??
    r.sent ??
    r.authoredOn ??
    r.date ??
    r.dateTime ??
    r.start ??
    r.performedDateTime ??
    r.performedPeriod?.start ??
    // An episode that has closed is most meaningfully dated by its end.
    r.period?.end ??
    r.period?.start ??
    r.created ??
    r._savedAt ??
    // Resources read back from a SMART server carry no `_savedAt`; the server's
    // own stamp is the last resort before the row goes undated.
    r.meta?.lastUpdated
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * A date as a clinician reads it in a sentence — `Sep 3`, or `Sep 3, 2025` when
 * it is not in `relativeTo`'s year.
 *
 * Spelled out from a fixed month list rather than `Intl.DateTimeFormat` on
 * purpose: this string is asserted in tests and rendered inside a CDS card that
 * a host EHR may display anywhere, and a locale-dependent month name would make
 * the same card read differently on two machines. Returns `null` for a date
 * that cannot be parsed, so a caller can leave it out rather than print
 * `Invalid Date`.
 */
export function shortDate(value: string | undefined, relativeTo: Date = new Date()): string | null {
  if (!value) return null
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return null
  const day = `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`
  return at.getUTCFullYear() === relativeTo.getUTCFullYear() ? day : `${day}, ${at.getUTCFullYear()}`
}
