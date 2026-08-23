import { useState } from 'react'
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

export function EhrShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useScrollToTopOnNavigate()
  const isPatientView =
    location.pathname.startsWith('/patient') || location.pathname.startsWith('/chart')

  return (
    <div className="ehr-shell">
      <header className="ehr-header">
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
