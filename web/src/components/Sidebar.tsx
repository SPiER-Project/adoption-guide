import { NavLink, useLocation } from 'react-router-dom'
import '../css/Sidebar.css'

// Published HL7 IG — a sibling static site (not a hash route), linked via the Vite base path.
const IG_HREF = `${import.meta.env.BASE_URL}ig/`

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
  /** External link (e.g. the published HL7 IG) — rendered as a plain anchor, no active state. */
  external?: boolean
}

const LENSES: Lens[] = [
  {
    to: '/',
    label: 'Home',
    icon: '⌂', // house
    matchPrefix: '__exact__', // never matches via prefix; uses `end` instead
  },
  {
    to: '/adoption-guide',
    label: 'Adoption Guide',
    icon: '\u{1F4DA}', // books
    matchPrefix: '/adoption-guide',
    children: [
      { to: '/adoption-guide/pathway', label: 'Pathway' },
      { to: '/adoption-guide/tool-configuration', label: 'Tool Configuration' },
      { to: '/adoption-guide/data-dictionary', label: 'Data Dictionary' },
      { to: '/adoption-guide/adoption-readiness', label: 'Adoption Readiness' },
      { to: '/adoption-guide/adoption-rubric', label: 'Adoption Rubric' },
      { to: '/adoption-guide/roadmap', label: 'Roadmap' },
    ],
  },
  {
    to: IG_HREF,
    label: 'Implementation Guide ↗', // published HL7 IG (external)
    icon: '\u{1F4C4}', // page facing up
    matchPrefix: '__external__', // never active
    external: true,
  },
  {
    to: '/population',
    label: 'Population View',
    icon: '\u{1F465}', // busts in silhouette
    matchPrefix: '/population',
  },
  {
    // ?new=1 explicitly clears the last-viewed patient so the Patient tab
    // always opens the blank "play with forms" state. Bare /patient/chart
    // (assessment-submit redirects) preserves the active patient.
    to: '/patient/chart?new=1',
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

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

  const isLensActive = (lens: Lens) => {
    if (lens.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(lens.matchPrefix)
  }

  // Anchor children share a pathname, so NavLink's default isActive would
  // highlight all of them. Match both pathname and hash explicitly. React
  // Router's HashRouter exposes the section anchor (the part after the
  // second '#' in `#/patient/chart#activity`) as `location.hash`.
  const isChildActive = (child: LensChild) => {
    if (!child.anchor) return false
    const [childPath] = child.to.split('#')
    return location.pathname === childPath && location.hash === `#${child.anchor}`
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
                {lens.external ? (
                  <a
                    href={lens.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sidebar-link sidebar-link--lens"
                    onClick={onClose}
                  >
                    <span className="sidebar-icon">{lens.icon}</span>
                    {lens.label}
                  </a>
                ) : (
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
                )}
                {expanded && lens.children!.map(child => {
                  // Anchor children combine a route path with a section
                  // anchor (`/patient/chart#recommendations`). React Router's
                  // <Link>/<NavLink> strip the second '#' since they navigate
                  // via the History API, not by mutating window.location.hash.
                  // Use a plain anchor with the full HashRouter URL form
                  // (`#/patient/chart#recommendations`) so a single hash
                  // mutation updates both the route and the section anchor —
                  // React Router observes the resulting hashchange and
                  // surfaces the section anchor as `location.hash`.
                  if (child.anchor) {
                    const active = isChildActive(child)
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
          <span className="sidebar-version">SPiER v0.1.0</span>
        </div>
      </aside>
    </>
  )
}
