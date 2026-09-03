import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
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
// a list. Both are gone; `DESTINATIONS` in `Sidebar.tsx` owns the real
// destinations now (`.sidebar-footer`'s "Elsewhere" group), and the note there
// records why that does not re-break the "a lens that can never be active"
// objection that moved the IG link up here in the first place.
//
// `PROJECT_LINKS` lived alongside `DESTINATIONS` in that same sidebar group
// until the true page footer got a sidebar-shaped bug: the sidebar's height was
// pinned to the viewport, so on any page short enough not to fill it, the
// sidebar's sticky box visually covered `.ehr-footer` at the bottom of the page.
// The links moved down here, into the footer that already carries the SPiER
// tagline, so they render full-width below the sidebar rather than at the
// bottom of a column that could be obscured.
//
// ⚠️ **That overlap no longer exists — the shell is a fixed frame and the
// sidebar is an ordinary grid item that ends where the footer begins.** The
// links stay here anyway, because the footer is the better home for project
// metadata on its own merits and it is now visible without scrolling. What is
// gone with the overlap is the machinery: this file held two hand-written
// ResizeObserver hooks publishing `--ehr-header-height` and
// `--ehr-footer-height` purely so the sidebar could subtract them from `100dvh`.
// Both are deleted. See the note on `.ehr-shell` in EhrShell.css.
//
// What the header keeps is the hamburger and the brand — plus, still, the
// natural slot for a SMART-connection indicator.

/** Project metadata, rendered in the page footer — see the note above. */
const PROJECT_LINKS = [
  { key: 'site', href: 'https://thespierproject.org', label: 'thespierproject.org' },
  { key: 'repo', href: 'https://github.com/SPiER-Project/adoption-guide', label: 'GitHub' },
] as const

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
        <span>SPiER — Setting priorities for technology-enabled suicide-safer care</span>
        <nav className="ehr-footer-links" aria-label="Project links">
          {PROJECT_LINKS.map(l => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${l.label} (opens in a new tab)`}
            >
              {l.label}
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          ))}
          <span className="ehr-footer-version">SPiER v0.1.0</span>
        </nav>
      </footer>
    </div>
  )
}
