import { Fragment, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Home, ExternalLink } from 'lucide-react'
import { GUIDE_SECTIONS, guideGroupLabel, guideHref } from '../data/guideSections'
import { MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'
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
 * ── The two zones ──────────────────────────────────────────────────────────
 *
 * The guide's own three groups (Learn / Configure / Evaluate) are the body, no
 * longer nested under a collapsible "Adoption Guide" row that was always open on
 * every guide page anyway. Then **Try it**, which is the Demo EHR and nothing
 * else, because that is where the product runs.
 *
 * ⚠️ **The three in-app demo rows are gone, one release after being added, and
 * the reason is the same de-duplication that produced this file.** "Demo chart",
 * "Demo caseload" and "Demo measures" were the app's own copies of the two
 * screens the host launches — so each was a second way to reach something whose
 * home is a launch. Brad, 2026-09-09: *"the Demo chart, Demo caseload, Demo
 * measures should all explicitly be launched in the mock EHR."* They are, and the
 * two explainer pages still link them for a reader who wants the no-launch view.
 *
 * ⚠️ **What survives of "we can still show the workflows with no host" is the
 * INSTRUMENTS, and they were never these three.** The chart and the caseload
 * render patient data, which is what needs a host. The 18 fillers do not:
 * `QuestionnaireView` never reads `activePatientId`, so every instrument works on
 * a blank slice. That is why the zone points at Tools in a sentence rather than
 * carrying a row — a "Fill in an instrument" row would land on `/guide/tools`,
 * which is already a row eleven lines above, and one destination behind two
 * differently-labelled links is exactly the defect this file was written to fix.
 *
 * ⚠️ **Icons mark destinations, headings never carry one.** Guide sections stay
 * plain text, exactly as they rendered when they were children, so the icon is
 * not doing two jobs. That is also why the group headings are `<p>` and not
 * links: a heading you can click is a fifth kind of thing in a 240px column.
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

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  // ⚠️ No `usePatient()` any more, and that is worth noticing rather than just
  // being tidy: the sidebar's only reason to know the active patient was to
  // build the demo chart's URL. With the chart launched from the host, this
  // component reads no patient context at all — so it cannot be the thing that
  // leaks one.
  //
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

          {/* The no-host path, as a sentence rather than a row — see the note
              at the top of this file for why a row would be a duplicate. */}
          <p className="sidebar-try__aside">
            No host running? Every instrument fills in without one, from{' '}
            <Link to="/guide/tools" onClick={onClose}>Tools</Link>.
          </p>
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
