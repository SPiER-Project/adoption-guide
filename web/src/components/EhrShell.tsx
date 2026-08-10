import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToHash'
import { PatientBanner } from './PatientBanner'
import { Sidebar } from './Sidebar'
import { SpierLogo } from './SpierLogo'
import '../css/EhrShell.css'

// The published HL7 IG is a sibling static site (web/dist/ig/), not a hash route —
// link to it with a plain anchor built from the Vite base path, so it follows
// whichever base is active: `/ig/` on Cloudflare and in local dev (where `npm run
// dev` does not serve it), `/adoption-guide/ig/` on the legacy GitHub Pages deploy,
// whose workflow sets VITE_BASE. See the note in vite.config.ts.
//
// It used to sit in the sidebar, which is a switcher for in-app lenses: it was
// the one entry that could never be "active", because it's the one entry that
// isn't a place you can be. The header's action cluster is where an outbound
// link to the normative spec belongs, and it mirrors Home's own top nav.
const IG_HREF = `${import.meta.env.BASE_URL}ig/`

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
            <span className="ehr-brand-subtitle">Suicide Prevention in Electronic Records</span>
          </Link>
          {/* Right-side action cluster. One link today; the natural slot for a
              SMART-connection indicator later. */}
          <div className="ehr-header-actions">
            <a
              href={IG_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="ehr-header-action"
              aria-label="Implementation Guide (opens in a new tab)"
            >
              {/* The label shortens below 768px, where the brand subtitle
                  already wraps; the aria-label above carries the full name
                  either way. */}
              <span className="ehr-header-action-full">Implementation Guide</span>
              <span className="ehr-header-action-short">IG</span>
              <span aria-hidden>&#8599;</span>
            </a>
          </div>
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
