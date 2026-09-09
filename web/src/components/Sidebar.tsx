import { Fragment, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, ExternalLink, User, Users, type LucideIcon } from 'lucide-react'
import { GUIDE_SECTIONS, guideGroupLabel, guideHref } from '../data/guideSections'
import { MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'
import { usePatient } from '../context/PatientContext'
import '../css/Sidebar.css'

/**
 * The implementer's navigation. Two zones: what the guide EXPLAINS, and what you
 * can go and TRY.
 *
 * ── Why it stopped being a lens switcher (2026-09-09) ───────────────────────
 *
 * It used to list four top-level "lenses" — Overview, Adoption Guide, Population
 * View, Patient View — each expanding to children. That shape stopped describing
 * the product on the day `/patient/chart` and `/population` became guide pages
 * that EXPLAIN the two SMART apps (#487) and the mock EHR grew a real launch for
 * the dashboard (#491). The result was four entries for two things:
 *
 *   Adoption Guide → Patient App            ← the explainer
 *   Patient View   → Pathway / Next actions ← the same app, again
 *   Adoption Guide → Population Dashboard   ← the explainer
 *   Population View → Caseload / Measures   ← the same dashboard, again
 *
 * …with no way for a reader to tell which of each pair they were about to open,
 * and with "View" and "App"/"Dashboard" naming the same screens differently.
 *
 * ⚠️ **The four anchor children under the patient lens were dead links most of
 * the time.** `#activity`, `#recommendations`, `#encounters` and `#documents`
 * are sections of a loaded chart; with no patient selected — the state a first
 * visit is in — they navigated to a page that renders none of them. They are
 * gone rather than conditional: the chart's own pathway rail already jumps
 * between its sections, so nothing is lost that the page did not offer better.
 *
 * ── The two zones, and why the mock EHR leads the second one ────────────────
 *
 * The guide's own three groups (Learn / Configure / Evaluate) are the body, no
 * longer nested under a collapsible "Adoption Guide" row that was always open on
 * every guide page anyway. Then **Try it**, whose first entry is the mock EHR,
 * because that is now genuinely where the product runs: SPiER is launched from a
 * host, and the two demo screens below it are the same app on sample data for
 * when there is no host to launch from. Putting the host first is the one thing
 * the old sidebar got backwards — it had the mock EHR in a footer called
 * "Elsewhere", below the app's own copies of the screens it launches.
 *
 * ⚠️ **Icons mark destinations, headings never carry one.** Guide sections stay
 * plain text, exactly as they rendered when they were children, so the icon is
 * not doing two jobs. That is also why the group headings are `<p>` and not
 * links: a heading you can click is a fifth kind of thing in a 240px column.
 *
 * ⚠️ **Only the mock EHR carries a note, and that is measured.** Each demo row
 * had a one-line note under it too ("One patient, sample data"). Three of those
 * cost 42px, and the whole column is 850px against an 808px sidebar on a 900px
 * viewport — so they were exactly what pushed the Spec footer below the fold, in
 * a column whose own CSS already warns that every line does. They were also the
 * only 10px text in here, against 11px for the outbound notes. The external
 * link keeps its note because it is the one that earns it: it is the only entry
 * that leaves the app, and "Mock EHR demo" alone does not say what you will find
 * there. "Demo caseload" does.
 */

/**
 * Where SPiER can be reached that is not a page of this app.
 *
 * ⚠️ **"Mock" is load-bearing in the label, not modesty.** That host is
 * controlled by the same project it demonstrates, so nothing observed there is
 * evidence of interoperability — the host says so on every page, and a label
 * reading "EHR demo" would quietly drop the part that keeps the claim honest.
 *
 * ⚠️ **Notes are measured, not trimmed by feel.** The sidebar is 240px and a
 * note has 192px of it, so a longer line wraps and costs the column height it
 * does not have to spare. "Launch SPiER from a chart" fits on one line; "SPiER
 * launched inside a vendor chart" did not.
 */
const MOCK_EHR = {
  href: MOCK_EHR_URL,
  label: MOCK_EHR_LABEL,
  note: 'Launch SPiER from a chart',
} as const

/**
 * The published HL7 IG is a sibling static site (`web/dist/ig/`), not a hash
 * route — link it with a plain anchor built from the Vite base path so it follows
 * whichever base is active: `/ig/` on Cloudflare and in local dev (where `npm run
 * dev` does not serve it), `/adoption-guide/ig/` on the legacy GitHub Pages
 * deploy, whose workflow sets `VITE_BASE`. See the note in `vite.config.ts`.
 */
const IG = {
  href: `${import.meta.env.BASE_URL}ig/`,
  label: 'Implementation Guide',
  // Said out loud because it is the one outbound link that is not a demo: the
  // FSH-generated profiles, value sets and examples are what an implementer
  // builds against.
  note: 'The normative FHIR spec',
} as const

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface DemoLink {
  to: string
  label: string
  icon: LucideIcon
}

/**
 * The app's own copies of the two screens the mock EHR launches, on sample data.
 *
 * ⚠️ These are the "no host connected" path, and they are in the nav on purpose:
 * *"it's okay to not have the mock ehr up, we can still show the workflows in the
 * adoption guide"* (Brad, 2026-09-09). The measure dashboard is here rather than
 * nested under the caseload because it is a separate page with its own launch
 * action in the tool catalog — nesting it would make the nav disagree with the
 * catalog about whether it is a destination.
 */
function demoLinks(patientBase: string): DemoLink[] {
  return [
    { to: patientBase, label: 'Demo chart', icon: User },
    { to: '/population/caseload', label: 'Demo caseload', icon: Users },
    { to: '/population/measures', label: 'Demo measures', icon: Users },
  ]
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { activePatientId } = usePatient()

  // The demo chart targets the active patient's URL when one is loaded, so
  // opening it keeps the same patient rather than dropping back to the blank
  // chart. Clearing to the blank "play with the forms" state is an explicit
  // action — the "Close patient" control in the patient banner.
  const patientBase = activePatientId
    ? `/patient/record/${activePatientId}`
    : '/patient/record'

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

  // The demo chart's `to` carries a patient id mid-session, so NavLink's own
  // isActive (which compares against that exact URL) would drop the highlight
  // the moment the URL gained one. Match the route family instead.
  const chartActive = location.pathname.startsWith('/patient/record')

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <nav className="sidebar-nav" aria-label="Adoption Guide">
          <NavLink
            to="/overview"
            className={({ isActive }) => `sidebar-link sidebar-link--lens ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Home aria-hidden="true" size={20} className="sidebar-icon" />
            Overview
          </NavLink>

          {GUIDE_SECTIONS.map((section, i) => {
            // A group heading is emitted whenever this section opens a new
            // category, which for a grouped-contiguous list means once per
            // group. `GUIDE_SECTIONS` is required to stay grouped-contiguous —
            // see the note on it.
            const group = guideGroupLabel(section.group)
            const prev = i > 0 ? guideGroupLabel(GUIDE_SECTIONS[i - 1].group) : undefined
            return (
              <Fragment key={section.path}>
                {group !== prev && <p className="sidebar-group-heading">{group}</p>}
                <NavLink
                  to={guideHref(section.path)}
                  className={({ isActive }) =>
                    `sidebar-link sidebar-link--child ${isActive ? 'active' : ''}`
                  }
                  onClick={onClose}
                >
                  {section.label}
                </NavLink>
              </Fragment>
            )
          })}
        </nav>

        {/* A `nav` of its own, with its own label: these are not the guide's
            sections, and a screen reader should not have to infer that from
            where they happen to sit. */}
        <nav className="sidebar-try" aria-label="Try SPiER">
          <p className="sidebar-group-heading">Try it</p>

          <a
            className="sidebar-outbound-link sidebar-outbound-link--lead"
            href={MOCK_EHR.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${MOCK_EHR.label} — ${MOCK_EHR.note} (opens in a new tab)`}
            onClick={onClose}
          >
            <span className="sidebar-outbound-label">
              {MOCK_EHR.label}
              <ExternalLink className="sidebar-outbound-ext" size={12} aria-hidden="true" />
            </span>
            {/* aria-hidden: the accessible name above already carries it, and
                reading it twice is worse than not styling it. */}
            <span className="sidebar-outbound-note" aria-hidden="true">{MOCK_EHR.note}</span>
          </a>

          {demoLinks(patientBase).map(demo => {
            const DemoIcon = demo.icon
            return (
              <NavLink
                key={demo.label}
                to={demo.to}
                className={({ isActive }) =>
                  `sidebar-link sidebar-link--demo ${
                    isActive || (demo.to === patientBase && chartActive) ? 'active' : ''
                  }`
                }
                onClick={onClose}
              >
                <DemoIcon aria-hidden="true" size={16} className="sidebar-icon" />
                {demo.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <nav className="sidebar-outbound" aria-label="The specification">
            <p className="sidebar-group-heading sidebar-group-heading--footer">Spec</p>
            <a
              className="sidebar-outbound-link"
              href={IG.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${IG.label} — ${IG.note} (opens in a new tab)`}
              onClick={onClose}
            >
              <span className="sidebar-outbound-label">
                {IG.label}
                <ExternalLink className="sidebar-outbound-ext" size={12} aria-hidden="true" />
              </span>
              <span className="sidebar-outbound-note" aria-hidden="true">{IG.note}</span>
            </a>
          </nav>
        </div>
      </aside>
    </>
  )
}
