import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToHash'
import { HeaderMenu } from './HeaderMenu'
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
// link to the normative spec belongs.
const IG_HREF = `${import.meta.env.BASE_URL}ig/`

// The outbound links. They lived in the standalone front door's top nav until
// that page merged into /overview and lost its own chrome; the app bar is now
// the only place they can live, and the only place they need to.
//
// A flat list on purpose: a right-hand overflow menu is coming, and it should
// be able to consume this array as-is rather than unpick three hand-written
// anchors. `short` is the label below 768px, where the brand subtitle already
// wraps and three full labels do not fit.
const HEADER_LINKS = [
  { key: 'ig', href: IG_HREF, label: 'Implementation Guide', short: 'IG' },
  { key: 'site', href: 'https://thespierproject.org', label: 'thespierproject.org', short: 'Site' },
  { key: 'repo', href: 'https://github.com/SPiER-Project/adoption-guide', label: 'GitHub', short: 'GitHub' },
]

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
          {/* Right-side action cluster: the app's outbound links, and the
              natural slot for a SMART-connection indicator later.

              Two renderings of the same list, swapped by CSS at 640px — pills
              where there is room, an overflow menu where there is not. Both are
              always in the DOM and exactly one is ever displayed, so only one
              is in the tab order and accessibility tree at any width. */}
          <nav className="ehr-header-actions" aria-label="Project links">
            {HEADER_LINKS.map(link => (
              <a
                key={link.key}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ehr-header-action"
                aria-label={`${link.label} (opens in a new tab)`}
              >
                {/* Labels shorten below 1024px, where the brand subtitle also
                    drops; the aria-label carries the full name at every width. */}
                <span className="ehr-header-action-full">{link.label}</span>
                <span className="ehr-header-action-short">{link.short}</span>
                <span aria-hidden>&#8599;</span>
              </a>
            ))}
          </nav>
          <HeaderMenu links={HEADER_LINKS} />
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
