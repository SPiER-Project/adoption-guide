import { useLayoutEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToHash'
import { PatientBanner } from './PatientBanner'
import { Sidebar } from './Sidebar'
import { SpierLogo } from './SpierLogo'
import '../css/EhrShell.css'

// ⚠️ **The app bar carries no links, and that is where they used to be.** Three
// outbound pills lived here, with `HeaderMenu` as an overflow disclosure below
// 640px — two renderings of one list, swapped by CSS. Adding a fourth (the mock
// EHR demo) did not fit at any width, and the disclosure was 121 lines of
// Escape/pointerdown/blur handling for links that are just links once they are in
// a list. Both are gone; `DESTINATIONS` and `PROJECT_LINKS` in `Sidebar.tsx` own
// them now, in `.sidebar-footer`, and the note there records why that does not
// re-break the "a lens that can never be active" objection that moved the IG link
// up here in the first place.
//
// What the header keeps is the hamburger and the brand — plus, still, the
// natural slot for a SMART-connection indicator.

/**
 * Publishes the app bar's live height as `--ehr-header-height`.
 *
 * ── Why anything needs to know this ─────────────────────────────────────────
 *
 * The bar is `position: sticky` (see EhrShell.css), and three things have to sit
 * *below* it rather than under it: the sidebar's viewport-height box, the patient
 * banner's own sticky offset, and `--anchor-scroll-offset`. Every one of those
 * needs the number, and the bar has no fixed height to hardcode — it is
 * content-sized, `padding: 0.65rem` plus a wordmark, and it is allowed to wrap to
 * two lines below 640px when a user scales text up. So it is measured.
 *
 * ⚠️ **Second hand-written copy of this pattern; `PatientBanner`'s
 * `useBannerHeightVar` is the first.** Two is a pair, three is drift — if a third
 * element needs to publish its height, extract the three into one
 * `useElementHeightVar(name)` hook rather than adding another. Kept local for now
 * because unifying them means touching the anchor-offset plumbing, which is
 * working, to fix a layout bug that is not in it.
 *
 * `check:tokens` scrapes `setProperty` calls rather than reading an allowlist, so
 * this token is recognized by virtue of this line existing — and stops being
 * recognized if this line goes.
 */
function useHeaderHeightVar() {
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!headerEl) return
    const publish = () =>
      document.documentElement.style.setProperty(
        '--ehr-header-height',
        `${Math.round(headerEl.getBoundingClientRect().height)}px`,
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(headerEl)
    return () => {
      observer.disconnect()
      // PanelShell renders instead of this shell when embedded, and it has no
      // app bar — so a stale height would offset the panel's anchors by 47px.
      // Every consumer falls back to 0px.
      document.documentElement.style.removeProperty('--ehr-header-height')
    }
  }, [headerEl])

  return setHeaderEl
}

export function EhrShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const setHeaderEl = useHeaderHeightVar()
  const location = useLocation()
  useScrollToTopOnNavigate()
  const isPatientView =
    location.pathname.startsWith('/patient') || location.pathname.startsWith('/chart')

  return (
    <div className="ehr-shell">
      <header className="ehr-header" ref={setHeaderEl}>
        <div className="ehr-header-content">
          <button
            className="ehr-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
          >
            <span className={`ehr-hamburger ${sidebarOpen ? 'ehr-hamburger--active' : ''}`} />
          </button>
          <Link to="/" className="ehr-brand">
            <SpierLogo className="ehr-brand-logo" />
            <span className="ehr-brand-subtitle">The SPiER Project</span>
          </Link>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="ehr-content">
        {isPatientView && <PatientBanner />}
        <div className="ehr-content-body">
          <Outlet />
        </div>
      </main>

      <footer className="ehr-footer">
        <span>
          Rendering native FHIR Questionnaires via{' '}
          <a href="https://www.npmjs.com/package/@formbox/renderer" target="_blank" rel="noopener noreferrer">
            formbox-renderer
          </a>
        </span>
        <span>SPiER — Setting priorities for technology-enabled suicide-safer care</span>
      </footer>
    </div>
  )
}
