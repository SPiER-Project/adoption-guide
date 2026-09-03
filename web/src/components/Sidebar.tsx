import { Fragment, useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, BookOpen, Users, User, ExternalLink, type LucideIcon } from 'lucide-react'
import { GUIDE_SECTIONS, guideGroupLabel, guideHref } from '../data/guideSections'
import { usePatient } from '../context/PatientContext'
import '../css/Sidebar.css'

/**
 * The published HL7 IG is a sibling static site (`web/dist/ig/`), not a hash
 * route — link it with a plain anchor built from the Vite base path so it follows
 * whichever base is active: `/ig/` on Cloudflare and in local dev (where `npm run
 * dev` does not serve it), `/adoption-guide/ig/` on the legacy GitHub Pages
 * deploy, whose workflow sets `VITE_BASE`. See the note in `vite.config.ts`.
 */
const IG_HREF = `${import.meta.env.BASE_URL}ig/`

/**
 * Where SPiER can be reached that is not a page of this app.
 *
 * ── Why these are in the sidebar, having been moved OUT of it ───────────────
 *
 * `AppShell` used to render these as pills in the app bar, with an overflow
 * disclosure (`HeaderMenu`) taking over below 640px. The stated reason for
 * moving the IG link there was that *"the sidebar is a switcher for in-app
 * lenses: it was the one entry that could never be 'active', because it's the
 * one entry that isn't a place you can be."*
 *
 * That reasoning was about being an entry **in the switcher**, and it still
 * holds — which is why these are in `.sidebar-footer`, below the rule, and are
 * not `NavLink`s. A separate zone with its own heading is not a lens that can
 * never light up. What forced the move back was the header running out of room:
 * a fourth link (the demo host) did not fit, and the two-renderings-swapped-by-
 * CSS arrangement that made three fit cost 121 lines of disclosure machinery —
 * Escape handling, pointerdown dismissal, blur-to-close — for links that are
 * just links once they are in a list. `HeaderMenu` is deleted, not relocated.
 *
 * ⚠️ **These are real destinations, and that's what still earns them a place
 * here.** GitHub, the project site and the version stamp used to sit below
 * these in the same `.sidebar-footer`, as quieter project metadata — but that
 * put them at the bottom of a box whose height is pinned to the viewport, so on
 * a short page the sidebar's own sticky box visually covered the real page
 * footer sitting right below it. They moved down into `.app-shell__footer` in
 * `AppShell.tsx`, which runs full width below the sidebar and can't be
 * obscured by it — see the note there and on `.sidebar` in `Sidebar.css`. The
 * IG and the mock EHR stay here because unlike a repo link they're places you
 * can actually go use SPiER, which is what "Elsewhere" means.
 */
const DESTINATIONS = [
  {
    key: 'ig',
    href: IG_HREF,
    label: 'Implementation Guide',
    // Said out loud because it is the one link here that is not a demo: the
    // FSH-generated profiles, value sets and examples are what an implementer
    // builds against.
    note: 'The normative FHIR spec',
  },
  {
    key: 'demo',
    href: 'https://spier-mock-ehr.bbthorson.workers.dev/',
    // ⚠️ "Mock" is load-bearing, not modesty. That host is controlled by the
    // same project it demonstrates, so nothing observed there is evidence of
    // interoperability — the host says so on every page, and a label reading
    // "EHR demo" would quietly drop the part that keeps the claim honest.
    label: 'Mock EHR demo',
    // ⚠️ Measured, not trimmed by feel: the sidebar is 240px and a note has
    // 192px of it, so "SPiER launched inside a vendor chart" wrapped to two
    // lines and cost the footer 15px it does not have to spare. Every line here
    // pushes the rest of this footer further down a column that already scrolls.
    note: 'Inside a vendor chart',
  },
] as const

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
  icon: LucideIcon
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
      icon: Home,
      matchPrefix: '/overview',
    },
    {
      to: '/guide',
      label: 'Adoption Guide',
      icon: BookOpen,
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
      icon: Users,
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
      icon: User,
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
            const LensIcon = lens.icon
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
                  <LensIcon aria-hidden="true" size={20} className="sidebar-icon" />
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
          {/* A `nav` of its own, with its own label: these are not the lens
              switcher above, and a screen reader should not have to infer that
              from where they happen to sit. */}
          <nav className="sidebar-outbound" aria-label="SPiER elsewhere">
            <p className="sidebar-group-heading sidebar-group-heading--footer">Elsewhere</p>
            {DESTINATIONS.map(d => (
              <a
                key={d.key}
                className="sidebar-outbound-link"
                href={d.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${d.label} — ${d.note} (opens in a new tab)`}
                onClick={onClose}
              >
                <span className="sidebar-outbound-label">
                  {d.label}
                  <ExternalLink className="sidebar-outbound-ext" size={12} aria-hidden="true" />
                </span>
                {/* aria-hidden: the accessible name above already carries it,
                    and reading it twice is worse than not styling it. */}
                <span className="sidebar-outbound-note" aria-hidden="true">{d.note}</span>
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}
