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
 *   .app-shell__header      65px   the host already has a header
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
 * The strip is additionally conditional on SMART's `need_patient_banner`: a host
 * that says it draws the banner gets no strip at all, which is the one place the
 * panel gives up naming its patient and it does so only when told, by a standard
 * parameter, that something else is doing it. See `PresentationContext`.
 *
 * ⚠️ **Except on a narrow panel, where the parameter is answered anyway**
 * (clinical-app audit §1.7, decision §7.3 — Brad, 2026-09-21). The parameter
 * says the host HAS a banner; it does not say the banner is VISIBLE. On a phone
 * the host's layout stacks, its banner sits hundreds of pixels above, and since
 * the panel became a full-screen takeover (#574) it is covered outright — so a
 * clinician filled in a suicide-risk screener with no name on screen. Below the
 * phone breakpoint the strip is drawn regardless, because the alternative is a
 * safety defect in the one setting where the app is most likely to be used
 * one-handed.
 *
 * The cost, stated rather than discovered: a host that docks the panel at a
 * width under 640px on a DESKTOP — the demo host's 470px dock is one — now sees
 * the strip beside its own visible banner. That is one 24px line of redundancy
 * against a phone with no patient named at all, and the only rule that would
 * separate the two cases is a device sniff with no breakpoint behind it.
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
import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '@spier/app-shell/hooks/useScrollToHash'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { PatientIdentityStrip } from '@spier/app-shell/components/PatientIdentityStrip'
import { useIsNarrow } from '../hooks/useIsNarrow'
import '../css/PanelShell.css'

export function PanelShell() {
  useScrollToTopOnNavigate()
  const { activePatientId, isSmartConnected } = usePatient()
  const { hostDrawsPatientBanner } = usePresentation()
  const rootRef = useRef<HTMLDivElement>(null)
  const isNarrow = useIsNarrow(rootRef)

  // Mirrors PatientBanner's rule: with no patient and no SMART context there is
  // nobody to name, and a strip reading "—" is worse than no strip.
  //
  // The second condition is SMART's `need_patient_banner`: the host telling us it
  // already identifies the patient. Honoring it is what keeps the panel from
  // drawing a duplicate banner two inches from the host's own — and the reason
  // the default is to draw one is that a panel which never names its patient is
  // a safety problem rather than a tidy one.
  //
  // The third condition is the narrow-panel rule in the header comment: under
  // the phone breakpoint the host's banner is not on screen whatever the launch
  // parameter said, so the strip is drawn anyway.
  const hasPatient =
    (activePatientId !== null || isSmartConnected) && (!hostDrawsPatientBanner || isNarrow)

  return (
    <div className="panel-shell" ref={rootRef}>
      {hasPatient && (
        <div className="panel-shell__patient">
          <PatientIdentityStrip dense />
        </div>
      )}
      {/* Owns the panel's page inset, the way `.app-shell__body` owns the
          shell's. Declared as the second sanctioned owner in
          scripts/check-page-template.mjs — see PANEL_BODY there. */}
      <main className="panel-shell__body">
        <Outlet />
      </main>
    </div>
  )
}
