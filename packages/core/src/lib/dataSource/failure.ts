/**
 * What went wrong with a read or a write, as a CODE the app words for itself.
 *
 * ⚠️ **A thrown message is a diagnostic, not copy.** The SMART source's errors
 * are built in the wire's own vocabulary — "Writeback failed — no resource was
 * created. QuestionnaireResponse: Failed to create QuestionnaireResponse — HTTP
 * 422: …", fhirclient's "403 Forbidden\nURL: …" with the OperationOutcome
 * appended — and until 2026-10-07 the chart's error banner printed them
 * verbatim, through `dataSourceError`, in front of the clinician. `check:jargon`
 * could not see it: it reads the clinical app's string literals, and these are
 * assembled at runtime here in core. The writeback scorecard had the same leak
 * and the same fix — a code beside the message (`WriteStepResult.skip`).
 *
 * So a failure that reaches the app carries a `kind`, which the clinical app
 * words in its own file, and the original message as `detail`, which is for
 * inspection only and is rendered nowhere on the clinical surface.
 */

/**
 * - `nothing-saved`  — a save that certainly landed nothing: every write the
 *                      ladder attempted was refused, the floor included.
 * - `save-failed`    — a save that failed part-way, or at a point where what
 *                      reached the chart cannot be said from here.
 * - `not-loaded`     — the chart could not be read.
 * - `not-authorized` — the server refused this session (401 / 403), on a read
 *                      or a write.
 * - `no-patient`     — a chart was asked for in a launch with no patient.
 */
export type DataSourceFailureKind =
  | 'nothing-saved'
  | 'save-failed'
  | 'not-loaded'
  | 'not-authorized'
  | 'no-patient'

export interface DataSourceFailure {
  kind: DataSourceFailureKind
  /** The thrown message, verbatim. Wire vocabulary — inspection only. */
  detail: string
}

/** An Error that already knows which kind of failure it is. */
export class DataSourceError extends Error {
  readonly kind: DataSourceFailureKind

  constructor(kind: DataSourceFailureKind, message: string) {
    super(message)
    this.name = 'DataSourceError'
    this.kind = kind
  }
}

/**
 * The HTTP status an error carries, if any. fhirclient's `HttpError` sets both
 * `statusCode` and `status`; other clients put it on `response.status`.
 */
export function httpStatusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } } | null
  const status = e?.statusCode ?? e?.status ?? e?.response?.status
  return typeof status === 'number' ? status : undefined
}

/** 401 and 403: the server knows who is asking and says no. */
export function isAuthorizationStatus(status: number | undefined): boolean {
  return status === 401 || status === 403
}

/**
 * Classify anything a data source threw. `during` decides the kind when the
 * error does not: an unrecognised failure while saving is `save-failed` (not
 * `nothing-saved` — only the ladder can know that nothing landed), and while
 * loading is `not-loaded`.
 */
export function toDataSourceFailure(err: unknown, during: 'load' | 'save'): DataSourceFailure {
  const detail = err instanceof Error ? err.message : String(err)
  if (err instanceof DataSourceError) return { kind: err.kind, detail }
  if (isAuthorizationStatus(httpStatusOf(err))) return { kind: 'not-authorized', detail }
  return { kind: during === 'load' ? 'not-loaded' : 'save-failed', detail }
}
