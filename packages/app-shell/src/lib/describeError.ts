/**
 * Render an unknown thrown value as a message for the SMART launch pages.
 *
 * Deliberately NOT shared with the same-named helper in `writeback/execute.ts`:
 * that one also stringifies non-Error objects, because a writeback failure is
 * reported in a scorecard the user reads for detail. This one backs the SMART
 * launch and redirect pages' error state.
 *
 * ⚠️ It no longer backs the chart's `dataSourceError` banner (2026-10-07): that
 * printed this string — resource types, HTTP statuses, the server's
 * OperationOutcome — to the clinician. The banner reads a coded failure now
 * (`@spier/core/lib/dataSource/failure`).
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
