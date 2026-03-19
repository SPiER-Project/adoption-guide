import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { PatientBanner } from './PatientBanner'
import { Sidebar } from './Sidebar'
import '../css/EhrShell.css'

export function EhrShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
          <Link to="/chart/dashboard" className="ehr-brand">
            <h1>SPiER</h1>
            <span className="ehr-brand-subtitle">Clinical Assessment Tools</span>
          </Link>
        </div>
      </header>

      <PatientBanner />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="ehr-content">
        <Outlet />
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
