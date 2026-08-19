/**
 * Render an unknown thrown value as a message for the chart's error banner.
 *
 * Deliberately NOT shared with the same-named helper in `writeback/execute.ts`:
 * that one also stringifies non-Error objects, because a writeback failure is
 * reported in a scorecard the user reads for detail. This one backs a
 * `dataSourceError` banner, where `String(err)` is the long-standing behaviour.
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
