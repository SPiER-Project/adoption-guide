/**
 * The alerts, on a page of their own.
 *
 * ── Why this is a page and not a panel ────────────────────────────────────
 *
 * It was a panel, beside the summary, above the caseload table — and the
 * caseload's whole job is the table (clinical-app audit §1.11, §4.8). Collapsed
 * and height-capped it still cost about 350px of the first screen, and it grew
 * as the fixtures did: thirteen alerts over five patients when it was written,
 * nineteen over eight after the reassessment cadence landed. A count that opens
 * a page costs one line and cannot grow.
 *
 * ⚠️ **The same component renders here and in the mock EHR's framed summary**,
 * which is the one place a panel is still the right shape: a host embedding an
 * activity at the top of its own worklist page has nowhere to send a reader.
 */
import { Link } from 'react-router-dom'
import { PageHeader } from '@spier/ui/PageHeader'
import { Notice } from '@spier/ui/Notice'
import { PopulationAlertsPanel } from '../components/PopulationAlertsPanel'
import { CohortScopeNotice } from '../components/CohortScopeNotice'
import { useCaseloadSummary } from '../hooks/useCaseloadSummary'
import '../css/PopulationView.css'

export function PopulationAlerts() {
  const { alertGroups, scope, isLoading } = useCaseloadSummary()

  return (
    <div className="population-view">
      <PageHeader
        eyebrow={['Caseload', 'Alerts']}
        up="/population/caseload"
        eyebrowStyle="pill"
        title="Alerts"
        lede="Every patient on the caseload who was eligible for something and did not get it, worst first."
      />

      {scope !== 'registry' ? (
        <CohortScopeNotice scope={scope} />
      ) : (
        <>
          {isLoading && alertGroups.length === 0 && (
            <Notice tone="info">Reading the caseload from the connected server&hellip;</Notice>
          )}
          <PopulationAlertsPanel groups={alertGroups} />
          <p className="population-footnote">
            <Link to="/population/caseload">&larr; Back to the caseload</Link>
          </p>
        </>
      )}
    </div>
  )
}
