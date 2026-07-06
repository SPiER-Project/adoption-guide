import { useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { GUIDE_SECTIONS, guideHref } from '../data/guideSections'
import { usePatient } from '../context/PatientContext'
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

// The patient lens links depend on the active patient, so the lens list is
// built per-render from the current chart base path (see the component).
function buildLenses(patientBase: string): Lens[] {
  return [
    {
      to: '/',
      label: 'Home',
      icon: '⌂', // house
      matchPrefix: '__exact__', // never matches via prefix; uses `end` instead
    },
    {
      to: '/guide',
      label: 'Adoption Guide',
      icon: '\u{1F4DA}', // books
      matchPrefix: '/guide',
      // Children mirror the canonical guide section list so the sidebar can never
      // drift from the routes or the in-page pager (see data/guideSections.ts).
      children: GUIDE_SECTIONS.map(section => ({
        to: guideHref(section.path),
        label: section.label,
      })),
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
      // Opening the Patient lens preserves the active patient (bare
      // /patient/chart, or the patient-specific URL when one is loaded).
      // Clearing to the blank "play with forms" state is now an explicit
      // action — the "Close patient" control in the patient banner
      // (which routes to /patient/chart?new=1).
      to: patientBase,
      label: 'Patient View',
      icon: '\u{1F464}', // bust
      matchPrefix: '/patient',
      // Anchor children carry the active patient id so a deep-linked section
      // URL stays shareable mid-session (e.g. /patient/chart/patient-001#activity).
      children: [
        { to: `${patientBase}#recommendations`, label: 'Recommendations', anchor: 'recommendations' },
        { to: `${patientBase}#activity`,        label: 'Activity',        anchor: 'activity' },
        { to: `${patientBase}#encounters`,      label: 'Encounters',      anchor: 'encounters' },
        { to: `${patientBase}#documents`,       label: 'Documents',       anchor: 'documents' },
      ],
    },
  ]
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { activePatientId } = usePatient()

  // Patient lens links target the active patient's URL when one is loaded, so
  // opening the lens (or a section anchor) keeps the same patient rather than
  // dropping back to the blank chart.
  const patientBase = activePatientId
    ? `/patient/chart/${activePatientId}`
    : '/patient/chart'
  const lenses = useMemo(() => buildLenses(patientBase), [patientBase])

  // Dismiss the mobile overlay on Escape, mirroring the click-away behavior.
  // The listener is only attached while the sidebar is open.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const isLensActive = (lens: Lens) => {
    if (lens.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(lens.matchPrefix)
  }

  // Anchor children share the chart route, so NavLink's default isActive would
  // highlight all of them. Match on the section anchor instead: React Router's
  // HashRouter exposes it (the part after the second '#' in
  // `#/patient/chart#activity`) as `location.hash`. Matching the chart route by
  // prefix keeps the anchor active whether or not the URL carries a patient id.
  const isChildActive = (child: LensChild) => {
    if (!child.anchor) return false
    return location.pathname.startsWith('/patient/chart') && location.hash === `#${child.anchor}`
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <nav className="sidebar-nav">
          {lenses.map(lens => {
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
