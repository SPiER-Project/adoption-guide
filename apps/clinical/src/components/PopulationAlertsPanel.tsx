/**
 * The caseload's alerts, grouped by patient — the body of `/population/alerts`,
 * and the one panel the mock EHR's framed summary still renders inline.
 *
 * The dashboard names eight alert rules. This panel shows the ones SPiER can
 * actually compute — every alert traceable to a published `Measure` group — and
 * then says out loud which rules it is NOT watching, because "13 alerts" read
 * against a panel silently missing five rules is worse than no panel. See
 * `lib/populationAlerts.ts` for why it is built on the measure engine rather
 * than a rules engine of its own.
 *
 * ⚠️ **Collapsed by default, and height-capped, on purpose** — and that was
 * not enough. Rendered fully expanded it measured 1085px against an 800px
 * viewport; collapsed and capped it still cost ~350px above the caseload's
 * table, and it grew from 13 alerts over 5 patients to 19 over 8 as the
 * fixtures did (clinical-app audit §8.2). So the caseload carries
 * `CaseloadAlertsLine` instead and this is what the page behind it renders.
 * Each patient is one `<details>` row showing its alert labels; the per-alert
 * explanation and its provenance are one click away.
 */
import { Link } from 'react-router-dom'
import { UNAVAILABLE_RULES, type PatientAlertGroup } from '../lib/populationAlerts'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { EmptyState } from '@spier/ui/EmptyState'
import { Pill } from '@spier/ui/Pill'
import { Card } from '@spier/ui/Card'

export function PopulationAlertsPanel({ groups }: { groups: PatientAlertGroup[] }) {
  const total = groups.reduce((n, g) => n + g.alerts.length, 0)
  const red = groups.reduce((n, g) => n + g.alerts.filter(a => a.severity === 'red').length, 0)

  return (
    <Card as="section" padding="compact" className="pop-alerts" aria-label="Alerts">
      <SectionHeader
        title="Alerts"
        meta={
          total === 0
            ? 'Nothing outstanding'
            : `${total} · ${groups.length} patient${groups.length === 1 ? '' : 's'} · ${red} urgent`
        }
      />

      {groups.length === 0 ? (
        <EmptyState>
          No measure group reports a failure for any patient in this period. That is a real
          result, not an empty state — but read it against the unwatched rules below.
        </EmptyState>
      ) : (
        <ul className="pop-alerts-list">
          {groups.map(g => (
            <li key={g.patientId}>
              <details className={`pop-alert-group pop-alert-group--${g.severity}`}>
                <summary className="pop-alert-group-head">
                  <Pill size="sm" tone={g.severity === 'red' ? 'high' : 'warning'}>{g.alerts.length}</Pill>
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
                            definition is an alert nobody can audit or dispute
                            — in the reader's words, not the criterion's key
                            (audit §8.5). */}
                        <span className="pop-alert-source">
                          {a.source?.title
                            ? `From the ${a.source.title} measure`
                            : 'From this patient’s open workflow'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={`/patient/record/${g.patientId}`} className="pop-alert-patient">
                  Open {g.patientName}’s chart →
                </Link>
              </details>
            </li>
          ))}
        </ul>
      )}

      <details className="pop-alerts-unwatched">
        <summary className="pop-alerts-unwatched-summary">
          {UNAVAILABLE_RULES.length} alert rules are not being watched
        </summary>
        <ul className="pop-alerts-unwatched-list">
          {UNAVAILABLE_RULES.map(r => (
            <li key={r.rule}>
              <strong>{r.rule}</strong> — waiting on {r.waitingOn}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  )
}
