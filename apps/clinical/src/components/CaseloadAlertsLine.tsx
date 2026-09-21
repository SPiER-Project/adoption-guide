import { Link } from 'react-router-dom'
import { Pill } from '@spier/ui/Pill'
import type { PatientAlertGroup } from '../lib/populationAlerts'

/**
 * The alerts, as one line that opens the page.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * The panel it replaces on the caseload was already collapsed and
 * height-capped, and it still cost about 350px above the table — eight
 * `<details>` rows, each carrying seven comma-joined labels, plus a drawer
 * naming the rules nothing watches. Measured with it in place, the first
 * patient row was at 1,104px on a laptop (clinical-app audit §8.2).
 *
 * ⚠️ **A count is not a summary, and the ordering is the part that matters.**
 * "12 urgent" is the number a care manager acts on; the eight patients and
 * nineteen alerts behind it are the page. So the urgent count leads, in its own
 * pill, and the rest is one clause — and when nothing is outstanding this says
 * so rather than disappearing, because a missing line reads as a panel that
 * failed to load.
 */
export function CaseloadAlertsLine({ groups }: { groups: PatientAlertGroup[] }) {
  const total = groups.reduce((n, g) => n + g.alerts.length, 0)
  const urgent = groups.reduce((n, g) => n + g.alerts.filter(a => a.severity === 'red').length, 0)

  return (
    <p className="caseload-alerts-line">
      {total === 0 ? (
        <span className="caseload-alerts-clear">No alerts outstanding.</span>
      ) : (
        <>
          {urgent > 0 && (
            <Pill size="sm" tone="high">
              {urgent} urgent
            </Pill>
          )}
          <span>
            {total} alert{total === 1 ? '' : 's'} across {groups.length} patient
            {groups.length === 1 ? '' : 's'}.
          </span>
        </>
      )}{' '}
      <Link to="/population/alerts" className="caseload-alerts-link">
        Review alerts &rarr;
      </Link>
    </p>
  )
}
