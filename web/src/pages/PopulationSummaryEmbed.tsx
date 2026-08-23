/**
 * PopulationSummaryEmbed — the caseload summary and alerts, and nothing else.
 *
 * ── Why this route exists ───────────────────────────────────────────────────
 *
 * The mock EHR's front door used to frame the whole Population lens as an
 * "embedded worklist", which put **two patient lists on one page**: the host's
 * own demographics table and SPiER's sortable caseload inside the iframe. The
 * frame was duplicating the list beside it, and the row clicks inside it went
 * nowhere the demo cares about — they navigate within the frame rather than
 * opening the host's chart.
 *
 * What a host cannot compute for itself is the part above the list: the summary
 * tiles, the risk-tier census and the alert groups. That is the honest shape of
 * an embedded activity on a worklist page, so this route serves exactly it.
 *
 * ── What this deliberately is NOT ───────────────────────────────────────────
 *
 * - **Not a page.** No `PageHeader`: the host draws the section heading, the
 *   same reason `PanelShell` drops the patient banner when the host says it
 *   draws one. `check-page-template.mjs` enforces that only the LENSES own a
 *   page header, and this is not one.
 * - **Not a claim about where the data came from.** It reads through
 *   `useCaseloadSummary`, so under a SMART session the cohort is the one patient
 *   the token is bound to and the notice below says so. Embedded in the mock EHR
 *   with no launch, it renders the bundled demo registry — which is exactly what
 *   the host page's own warning states, because that is where the claim would be
 *   misread.
 * - **Not a second derivation.** Every number here comes from the same hook the
 *   caseload table's page uses. Two summaries that could disagree would be worse
 *   than one summary in one place.
 */
import { PopulationAlertsPanel } from '../components/PopulationAlertsPanel'
import { PopulationSummary } from '../components/PopulationSummary'
import { useCaseloadSummary } from '../hooks/useCaseloadSummary'
import '../css/PopulationView.css'

export function PopulationSummaryEmbed() {
  const { rows, tiles, census, alertGroups, scope, isLoading } = useCaseloadSummary()

  return (
    <div className="population-summary-embed">
      {/* ⚠️ Same notice the full lens carries, and for the same reason: a SMART
          access token is bound to one patient, so a census drawn from it is a
          census of one. Saying so beats a tile strip that reads like a caseload. */}
      {scope === 'in-context' && (
        <p className="population-scope-notice">
          <strong>Showing the patient in context only.</strong> A SMART access token is
          bound to one patient, so this connection cannot serve a caseload — nothing
          here is a cross-patient claim.
        </p>
      )}

      {isLoading && rows.length === 0 && (
        <p className="population-scope-notice">Reading the caseload from the connected server…</p>
      )}

      <div className="population-zones">
        <PopulationSummary tiles={tiles} census={census} total={rows.length} />
        <PopulationAlertsPanel groups={alertGroups} />
      </div>
    </div>
  )
}
