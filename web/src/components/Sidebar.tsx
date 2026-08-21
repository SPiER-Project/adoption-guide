import { Fragment, useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { GUIDE_SECTIONS, guideGroupLabel, guideHref } from '../data/guideSections'
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
  /**
   * Optional category heading. Rendered above this child whenever it differs
   * from the previous child's group, so a grouped child list (the guide's
   * sections) gets headings while a flat one (the patient lens) gets none.
   * Requires the children to be grouped-contiguous, which GUIDE_SECTIONS is.
   */
  group?: string
}

interface Lens {
  to: string
  label: string
  icon: string
  matchPrefix: string
  children?: LensChild[]
}

// The patient lens links depend on the active patient, so the lens list is
// built per-render from the current chart base path (see the component).
function buildLenses(patientBase: string): Lens[] {
  return [
    {
      // The front door. `/` redirects here, so this is the durable target —
      // pointing the lens at `/` would leave it un-highlighted on arrival,
      // since the redirect lands the router on /overview.
      to: '/overview',
      label: 'Overview',
      icon: '⌂', // house
      matchPrefix: '/overview',
    },
    {
      to: '/guide',
      label: 'Adoption Guide',
      icon: '\u{1F4DA}', // books
      matchPrefix: '/guide',
      // Children mirror the canonical guide section list so the sidebar can never
      // drift from the routes or the in-page pager (see data/guideSections.ts).
      // Group labels come from the same list, so adding a section places its
      // heading automatically.
      children: GUIDE_SECTIONS.map(section => ({
        to: guideHref(section.path),
        label: section.label,
        group: guideGroupLabel(section.group),
      })),
    },
    {
      to: '/population',
      label: 'Population View',
      icon: '\u{1F465}', // busts in silhouette
      matchPrefix: '/population',
      // Route children rather than the Patient lens's anchors: the caseload and
      // the measure dashboard are separate pages. Measures moved here from the
      // Adoption Guide in step D (#391) — it reads the caseload, so it belongs
      // beside it.
      children: [
        { to: '/population', label: 'Caseload' },
        { to: '/population/measures', label: 'Measures' },
      ],
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
        // #activity and #recommendations are load-bearing ids (eleven "View in
        // chart" links target #activity), so the labels move with the merged
        // pathway section but the anchors themselves stay put.
        { to: `${patientBase}#activity`,        label: 'Pathway',      anchor: 'activity' },
        { to: `${patientBase}#recommendations`, label: 'Next actions', anchor: 'recommendations' },
        { to: `${patientBase}#encounters`,      label: 'Encounters',   anchor: 'encounters' },
        { to: `${patientBase}#documents`,       label: 'Documents',    anchor: 'documents' },
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

  // Every lens now has a real path prefix. The Home lens used to be the
  // exception — it pointed at `/`, which prefix-matches everything — and needed
  // an exact-match branch plus NavLink's `end`. It is now /overview.
  const isLensActive = (lens: Lens) => location.pathname.startsWith(lens.matchPrefix)

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
                <NavLink
                  to={lens.to}
                  className={({ isActive }) =>
                    `sidebar-link sidebar-link--lens ${
                      isActive || isLensActive(lens) ? 'active' : ''
                    }`
                  }
                  onClick={onClose}
                >
                  <span className="sidebar-icon">{lens.icon}</span>
                  {lens.label}
                </NavLink>
                {expanded && lens.children!.map((child, i) => {
                  // A group heading is emitted whenever this child opens a new
                  // category, which for a grouped-contiguous list means once
                  // per group. Children with no `group` never produce one.
                  const prevGroup = i > 0 ? lens.children![i - 1].group : undefined
                  const heading =
                    child.group && child.group !== prevGroup ? (
                      <p className="sidebar-group-heading">{child.group}</p>
                    ) : null


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
                      <Fragment key={child.to}>
                        {heading}
                        <a
                          href={`#${child.to}`}
                          className={`sidebar-link sidebar-link--child ${active ? 'active' : ''}`}
                          onClick={onClose}
                        >
                          {child.label}
                        </a>
                      </Fragment>
                    )
                  }
                  return (
                    <Fragment key={child.to}>
                      {heading}
                      <NavLink
                        to={child.to}
                        className={({ isActive }) =>
                          `sidebar-link sidebar-link--child ${isActive ? 'active' : ''}`
                        }
                        onClick={onClose}
                      >
                        {child.label}
                      </NavLink>
                    </Fragment>
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
