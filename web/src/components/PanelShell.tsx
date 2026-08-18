/**
 * PanelShell — the chrome SPiER wears when embedded as a SMART activity in a
 * host chart (panel plan §3, step 3).
 *
 * ── What this component is actually for ───────────────────────────────────
 *
 * Not width. The step-0 spike (panel plan §9.1) measured the longest instrument
 * in the repo at 470px and found zero horizontal overflow — `@formbox/renderer`
 * uses comboboxes, not radio matrices, so the predicted narrow-width failure
 * does not exist. **The panel's constraint is vertical.**
 *
 * Measured on this branch before the change, reproducing the spike's method
 * (a 470px iframe inside a normal viewport, so panel media queries apply without
 * triggering mobile-device emulation): **252px of chrome above the first form
 * card** — 28% of a 900px panel spent before a single question is asked.
 *
 *   .ehr-header      65px   the host already has a header
 *   .patient-banner  73px   the host already identifies the patient
 *   .page-header     75px   eyebrow + large title + accent rule + margin
 *   body padding     16px
 *   margins        ~23px
 *
 * So this shell drops the two the host duplicates outright, keeps a one-line
 * identity strip (a panel that never names its patient is a safety problem, not
 * a tidy one), and PageHeader.css collapses the page header to a single line
 * under `.panel-shell`.
 *
 * ── What it deliberately does NOT do ──────────────────────────────────────
 *
 * - **No sidebar.** The lens switcher is implementer navigation; a clinician in
 *   a host chart is not lens-switching. Dropping it also drops the hamburger the
 *   spike observed appearing below 768px inside the iframe.
 * - **No footer.** Attribution belongs on the standalone demo, not in someone
 *   else's chart.
 * - **No data-source assumption.** This reads the patient through `usePatient()`
 *   exactly as the chart does, so it works against `LocalDataSource` and
 *   `SmartDataSource` alike. That is the one constraint both plan docs agree on,
 *   and it holds regardless of how the offline-vs-mock-EHR question lands.
 * - **No width opinion.** Nothing here sets a width; the host sizes the frame.
 */
import { Outlet } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToHash'
import { usePatient } from '../context/PatientContext'
import '../css/PanelShell.css'

type RiskLevel = 'acute' | 'high' | 'moderate' | 'low' | 'none' | 'unknown'

const RISK_LABEL: Record<RiskLevel, string> = {
  acute: 'Acute',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  none: 'None',
  unknown: 'Unknown',
}

/**
 * Highest active level, matching PatientBanner exactly — including that an empty
 * set is `unknown` ("no screening on file") rather than `none` ("screened, no
 * risk"). The distinction is clinical, and the shared `highestRiskLevel` in
 * observationMappers collapses it to `none`, which is why the banner has its own
 * and why this reuses the banner's rule rather than the shared one.
 */
function highestRiskLevel(alertLevels: string[]): RiskLevel {
  if (alertLevels.length === 0) return 'unknown'
  const order: RiskLevel[] = ['acute', 'high', 'moderate', 'low', 'none']
  return order.find(l => alertLevels.includes(l)) ?? 'none'
}

export function PanelShell() {
  useScrollToTopOnNavigate()
  const { patientDisplay, activePatientId, isSmartConnected, riskAlerts } = usePatient()

  // Mirrors PatientBanner's rule: with no patient and no SMART context there is
  // nobody to name, and a strip reading "—" is worse than no strip.
  const hasPatient = activePatientId !== null || isSmartConnected
  const risk = highestRiskLevel(riskAlerts.map(a => a.level))

  return (
    <div className="panel-shell">
      {hasPatient && (
        <div className="panel-shell__patient">
          <span className="panel-shell__name">{patientDisplay.fullName}</span>
          <span className="panel-shell__meta">
            {patientDisplay.dob} &middot; MRN {patientDisplay.mrn}
          </span>
          <span
            className={`risk-pill risk-pill--sm risk-pill--${risk}`}
            title={
              risk === 'unknown'
                ? 'No suicide-risk screening on file'
                : `Highest active risk level: ${RISK_LABEL[risk]}`
            }
          >
            {RISK_LABEL[risk]}
          </span>
        </div>
      )}
      {/* Owns the panel's page inset, the way `.ehr-content-body` owns the
          shell's. Declared as the second sanctioned owner in
          web/scripts/check-page-template.mjs — see PANEL_BODY there. */}
      <main className="panel-shell__body">
        <Outlet />
      </main>
    </div>
  )
}
