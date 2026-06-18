import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { PatientBanner } from './PatientBanner'
import { Sidebar } from './Sidebar'
import { SpierLogo } from './SpierLogo'
import '../css/EhrShell.css'

export function EhrShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
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
