// Coarse "time ago" formatting for activity timestamps in list/worklist UIs.
// Buckets by day → week → month; finer precision isn't meaningful for the
// caseload's "last activity" column.

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - then) / 86_400_000))
}

function ago(n: number, unit: 'day' | 'week' | 'month'): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`
}

/**
 * "Today", "1 day ago", "3 days ago", "1 week ago", "2 weeks ago",
 * "1 month ago", … — with correct singular/plural agreement.
 */
export function formatDaysAgo(isoDate: string): string {
  const d = daysSince(isoDate)
  if (d === 0) return 'Today'
  if (d < 7) return ago(d, 'day')
  if (d < 30) return ago(Math.floor(d / 7), 'week')
  return ago(Math.floor(d / 30), 'month')
}
