/**
 * LaunchShell — the chrome SPiER wears on the CLINICAL build surface, standalone.
 *
 * Three chromes now, and they answer three different questions:
 *
 *   AppShell     the adoption guide's browsing chrome. An implementer is
 *                reading, comparing and following links out to the spec.
 *   PanelShell   embedded as a SMART activity in a host chart. The host owns
 *                the surrounding UI, so ours collapses to an identity strip.
 *   LaunchShell  the clinical build, opened in its own tab. Nobody browsed
 *                here — a clinician was LAUNCHED here from their EHR.
 *
 * ── What it drops, and why each one is a defect rather than a preference ────
 *
 * ⚠️ **The "Spec → Implementation Guide" link was live-broken on this surface.**
 * It resolves to `${BASE_URL}ig/`, which `services/cds-hooks` serves for real
 * and `services/clinical` does not hold at all — so on the clinical Worker it
 * hit the SPA fallback and opened SPiER again in a new tab, titled "The SPiER
 * Project" instead of the IG. Verified against both deploys on 2026-09-18. It is
 * now `IS_DEMO`-only in `Sidebar.tsx`, which is the honest fix: the IG is
 * implementer documentation and this surface has no implementer on it.
 *
 * ⚠️ **The project footer is adoption-guide material.** The tagline,
 * thespierproject.org, the GitHub repo and the version string are how a product
 * introduces itself to someone evaluating it. A clinician mid-assessment is not
 * evaluating SPiER, and a vendor's repo link in a chart is noise at best.
 *
 * ── What replaces the footer, and why it is not decoration ──────────────────
 *
 * One line saying whether this app is connected to an EHR. `AppShell`'s own
 * header comment has called that "the natural slot for a SMART-connection
 * indicator" for as long as it has existed, and on the clinical surface it is
 * the one fact a clinician cannot afford to be wrong about: the `clinical` build
 * compiles in NO synthetic patient (`@spier/demo-population` resolves to an
 * empty shim), so disconnected here means there is no data at all rather than
 * demo data — and the honest thing to say is how to fix it.
 *
 * ⚠️ **It reads `isSmartSession`, not `isSmartConnected`.** The two differ, and
 * the difference is exactly this line's subject: `isSmartConnected` means "there
 * is a PATIENT in context", which a user-scoped worklist launch does not have
 * while being perfectly well connected (#401). A banner reading "not connected"
 * over a working caseload would be a lie.
 *
 * ── What it does NOT do ────────────────────────────────────────────────────
 *
 * - **No page inset of its own.** `.app-shell__body` stays the sole owner, and
 *   `check-page-template.mjs` says why in so many words: "Adding a third entry
 *   should feel expensive. Two is a chrome decision; three is drift." The chrome
 *   around the page diverges; the page frame does not, because the pages are the
 *   same pages.
 * - **No second navigation.** It renders the same `<Sidebar>`, which already
 *   branches on `IS_DEMO` to show the two SMART apps and settings.
 * - **No brand change.** An adopting site would reskin the wordmark eventually;
 *   that is a theming question and this is not it.
 */
import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToHash'
import { usePatient } from '../context/PatientContext'
import { PatientBanner } from './PatientBanner'
import { Sidebar } from './Sidebar'
import { SpierLogo } from './SpierLogo'
import '../css/AppShell.css'
import '../css/LaunchShell.css'
import { cx } from '../lib/cx'

export function LaunchShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useScrollToTopOnNavigate()
  const { isSmartSession } = usePatient()
  const isPatientView =
    location.pathname.startsWith('/patient') || location.pathname.startsWith('/chart')

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-content">
          <button
            className="app-shell__nav-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
          >
            <span className={cx('app-shell__hamburger', sidebarOpen && 'app-shell__hamburger--active')} />
          </button>
          <Link to="/patient/record" className="app-shell__brand">
            <SpierLogo className="app-shell__brand-logo" />
          </Link>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="app-shell__content">
        {isPatientView && <PatientBanner />}
        <div className="app-shell__body">
          <Outlet />
        </div>
      </main>

      {/* `role="status"` rather than a bare footer: this is state that can
          change under the clinician (a session expires, a launch completes), and
          a screen reader should hear it when it does. `aria-live` is deliberately
          left polite-by-default — it is context, not an alarm. */}
      <footer className="app-shell__footer launch-shell__status" role="status">
        <span className={cx('launch-shell__dot', isSmartSession && 'launch-shell__dot--live')} aria-hidden="true" />
        {isSmartSession
          ? <span>Connected to your EHR. Everything recorded here is written back to the chart.</span>
          : <span>Not connected to an EHR — launch SPiER from a patient’s chart to read and write their record.</span>}
      </footer>
    </div>
  )
}
