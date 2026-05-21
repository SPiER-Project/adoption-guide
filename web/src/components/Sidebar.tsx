import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import '../css/Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface LensChild {
  to: string
  label: string
  /**
   * When set, this child represents a section anchor on the parent route.
   * Active state is computed by matching against the current URL fragment
   * rather than the React Router pathname, since multiple anchor children
   * share the same path.
   */
  anchor?: string
}

interface Lens {
  to: string
  label: string
  icon: string
  matchPrefix: string
  children?: LensChild[]
}

const LENSES: Lens[] = [
  {
    to: '/',
    label: 'Home',
    icon: '⌂', // house
    matchPrefix: '__exact__', // never matches via prefix; uses `end` instead
  },
  {
    to: '/implementation-guide',
    label: 'Implementation Guide',
    icon: '\u{1F4DA}', // books
    matchPrefix: '/implementation-guide',
    children: [
      { to: '/implementation-guide/pathway', label: 'Pathway' },
      { to: '/implementation-guide/tool-configuration', label: 'Tool Configuration' },
      { to: '/implementation-guide/data-dictionary', label: 'Data Dictionary' },
      { to: '/implementation-guide/adoption-rubric', label: 'Adoption Rubric' },
      { to: '/implementation-guide/roadmap', label: 'Roadmap' },
    ],
  },
  {
    to: '/population',
    label: 'Population View',
    icon: '\u{1F465}', // busts in silhouette
    matchPrefix: '/population',
  },
  {
    to: '/patient/chart',
    label: 'Patient View',
    icon: '\u{1F464}', // bust
    matchPrefix: '/patient',
    children: [
      { to: '/patient/chart#recommendations', label: 'Recommendations', anchor: 'recommendations' },
      { to: '/patient/chart#activity',        label: 'Activity',        anchor: 'activity' },
      { to: '/patient/chart#encounters',      label: 'Encounters',      anchor: 'encounters' },
      { to: '/patient/chart#documents',       label: 'Documents',       anchor: 'documents' },
    ],
  },
]

/**
 * Reads the section anchor from the URL. HashRouter uses the first '#' for
 * routing (e.g. '#/patient/chart'); the section anchor is anything after a
 * second '#'.
 */
function readSectionAnchor(): string {
  const raw = window.location.hash
  const stripped = raw.startsWith('#') ? raw.slice(1) : raw
  const second = stripped.indexOf('#')
  return second >= 0 ? stripped.slice(second + 1) : ''
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { clearDemoData, loadDemoScenario } = usePatient()
  const location = useLocation()

  // Track the current section anchor so anchor children can show active state.
  // React Router only updates on path changes, so we also subscribe to
  // hashchange (fires when only the section fragment changes).
  const [sectionAnchor, setSectionAnchor] = useState<string>(() => readSectionAnchor())
  useEffect(() => {
    const update = () => setSectionAnchor(readSectionAnchor())
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [location.pathname])

  const isLensActive = (lens: Lens) => {
    if (lens.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(lens.matchPrefix)
  }

  const isChildActive = (lens: Lens, child: LensChild) => {
    if (child.anchor) {
      // Anchor child: parent route must match, and the URL fragment must
      // equal this child's anchor.
      return isLensActive(lens) && sectionAnchor === child.anchor
    }
    // Regular path child: NavLink's `isActive` handles it elsewhere.
    return false
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <nav className="sidebar-nav">
          {LENSES.map(lens => {
            const expanded = isLensActive(lens) && !!lens.children?.length
            return (
              <div key={lens.to} className="sidebar-section">
                <NavLink
                  to={lens.to}
                  className={({ isActive }) =>
                    `sidebar-link sidebar-link--lens ${
                      isActive || isLensActive(lens) ? 'active' : ''
                    }`
                  }
                  end={lens.to === '/'}
                  onClick={onClose}
                >
                  <span className="sidebar-icon">{lens.icon}</span>
                  {lens.label}
                </NavLink>
                {expanded && lens.children!.map(child => {
                  // Anchor children combine a route path with a section
                  // anchor (`/patient/chart#recommendations`). React Router's
                  // <Link>/<NavLink> strip the second '#' since they navigate
                  // via the History API, not by mutating window.location.hash.
                  // Use a plain anchor with the full HashRouter URL form
                  // (`#/patient/chart#recommendations`) so a single hash
                  // change updates both the route and the section anchor —
                  // and our hashchange listener picks it up for active state.
                  if (child.anchor) {
                    const active = isChildActive(lens, child)
                    return (
                      <a
                        key={child.to}
                        href={`#${child.to}`}
                        className={`sidebar-link sidebar-link--child ${active ? 'active' : ''}`}
                        onClick={onClose}
                      >
                        {child.label}
                      </a>
                    )
                  }
                  return (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) =>
                        `sidebar-link sidebar-link--child ${isActive ? 'active' : ''}`
                      }
                      onClick={onClose}
                    >
                      {child.label}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-load-btn" onClick={() => { loadDemoScenario(); onClose() }}>
            Load Demo Scenario
          </button>
          <button className="sidebar-clear-btn" onClick={() => { clearDemoData(); onClose() }}>
            Clear Demo Data
          </button>
          <span className="sidebar-version">SPiER v0.1.0</span>
        </div>
      </aside>
    </>
  )
}
