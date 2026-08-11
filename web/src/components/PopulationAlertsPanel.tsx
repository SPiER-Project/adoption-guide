/**
 * Zone 2 of the Population view: alerts grouped by patient (deck panel 8,
 * issue #278).
 *
 * The deck names eight alert rules. This panel shows the ones SPiER can
 * actually compute — every alert traceable to a published `Measure` group — and
 * then says out loud which rules it is NOT watching, because "13 alerts" read
 * against a panel silently missing five rules is worse than no panel. See
 * `lib/populationAlerts.ts` for why it is built on the measure engine rather
 * than a rules engine of its own.
 *
 * ⚠️ **Collapsed by default, and height-capped, on purpose.** Rendered fully
 * expanded this panel measured 1085px against an 800px viewport and pushed the
 * first caseload row to y=1825 — it buried the worklist it is supposed to
 * triage. Each patient is one `<details>` row showing its alert labels; the
 * per-alert explanation and measure provenance are one click away. The list also
 * scrolls inside a fixed cap, so an unusually bad day cannot reintroduce the
 * problem.
 */
import { Link } from 'react-router-dom'
import { UNAVAILABLE_RULES, type PatientAlertGroup } from '../lib/populationAlerts'

export function PopulationAlertsPanel({ groups }: { groups: PatientAlertGroup[] }) {
  const total = groups.reduce((n, g) => n + g.alerts.length, 0)
  const red = groups.reduce((n, g) => n + g.alerts.filter(a => a.severity === 'red').length, 0)

  return (
    <section className="pop-alerts" aria-label="Alerts">
      <div className="pop-alerts-head">
        <h3 className="pop-alerts-title">Alerts</h3>
        <span className="pop-alerts-count">
          {total === 0
            ? 'Nothing outstanding'
            : `${total} · ${groups.length} patient${groups.length === 1 ? '' : 's'} · ${red} urgent`}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="pop-alerts-empty">
          No measure group reports a failure for any patient in this period. That is a real
          result, not an empty state — but read it against the unwatched rules below.
        </p>
      ) : (
        <ul className="pop-alerts-list">
          {groups.map(g => (
            <li key={g.patientId}>
              <details className={`pop-alert-group pop-alert-group--${g.severity}`}>
                <summary className="pop-alert-group-head">
                  <span className={`pop-alert-badge pop-alert-badge--${g.severity}`}>
                    {g.alerts.length}
                  </span>
                  <span className="pop-alert-group-name">{g.patientName}</span>
                  {/* The labels, comma-joined, are the scannable payload: enough
                      to triage without expanding anything. */}
                  <span className="pop-alert-group-labels">
                    {g.alerts.map(a => a.label).join(' · ')}
                  </span>
                </summary>
                <ul className="pop-alert-items">
                  {g.alerts.map(a => (
                    <li key={a.label} className={`pop-alert pop-alert--${a.severity}`}>
                      <span className="pop-alert-dot" aria-hidden="true" />
                      <span className="pop-alert-body">
                        <span className="pop-alert-label">{a.label}</span>
                        <span className="pop-alert-detail">{a.detail}</span>
                        {/* Provenance. An alert nobody can trace back to a
                            definition is an alert nobody can audit or dispute. */}
                        <span className="pop-alert-source">
                          {a.source
                            ? `Measure ${a.source.measureId} · ${a.source.groupCode}`
                            : 'Derived from episode workflow state'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={`/patient/chart/${g.patientId}`} className="pop-alert-patient">
                  Open {g.patientName}’s chart →
                </Link>
              </details>
            </li>
          ))}
        </ul>
      )}

      <details className="pop-alerts-unwatched">
        <summary className="pop-alerts-unwatched-summary">
          {UNAVAILABLE_RULES.length} deck rules are not being watched
        </summary>
        <ul className="pop-alerts-unwatched-list">
          {UNAVAILABLE_RULES.map(r => (
            <li key={r.rule}>
              <strong>{r.rule}</strong> — waiting on {r.waitingOn}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
