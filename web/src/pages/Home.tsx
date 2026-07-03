import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SpierLogo } from '../components/SpierLogo'
import '../css/Home.css'

// The published HL7 IG is a sibling static site (web/dist/ig/), not a hash route —
// link to it with a plain anchor built from the Vite base path. Resolves to
// `/adoption-guide/ig/` in the production build and `/ig/` in local dev (not served by `npm run dev`).
const IG_HREF = `${import.meta.env.BASE_URL}ig/`
const MARKETING_URL = 'https://thespierproject.org'
const REPO_URL = 'https://github.com/SPiER-Project/adoption-guide'

export function Home() {
  const [navOpen, setNavOpen] = useState(false)
  const closeNav = () => setNavOpen(false)

  return (
    <div className="portal">
      <header className="portal-header">
        <SpierLogo className="portal-logo" />

        <button
          type="button"
          className="portal-nav-toggle"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen(o => !o)}
        >
          <span className={`portal-hamburger ${navOpen ? 'portal-hamburger--active' : ''}`} />
        </button>

        <nav className={`portal-nav ${navOpen ? 'portal-nav--open' : ''}`}>
          <Link to="/guide" className="portal-nav-link" onClick={closeNav}>Adoption Guide</Link>
          <Link to="/population" className="portal-nav-link" onClick={closeNav}>Population</Link>
          <Link to="/patient/chart" className="portal-nav-link" onClick={closeNav}>Patient</Link>
          <a className="portal-nav-link" href={IG_HREF} target="_blank" rel="noopener noreferrer" onClick={closeNav}>Implementation Guide&nbsp;&#8599;</a>
          <a className="portal-nav-link" href={MARKETING_URL} target="_blank" rel="noopener noreferrer" onClick={closeNav}>thespierproject.org&nbsp;&#8599;</a>
          <a className="portal-nav-link" href={REPO_URL} target="_blank" rel="noopener noreferrer" onClick={closeNav}>GitHub&nbsp;&#8599;</a>
        </nav>
      </header>

      <div className="home-container">
        <div className="hero-section">
          <h2 className="spier-title">SPiER</h2>
          <span className="portal-brand-subtitle">Suicide Prevention in Electronic Records</span>
          <div className="accent-line"></div>
          <p className="spier-tagline">
            Setting Priorities for technology-enabled suicide-safer care in Electronic Records
          </p>
          <p className="spier-description">
            A FHIR-native reference implementation of the suicide-safer care pathway. SPiER&rsquo;s mission is to
            make suicide-safer care the standard everywhere &mdash; and the tools to do it already exist.
            Validated screeners, risk assessments, safety plans, and response protocols live on paper, in PDFs,
            and in plain-text guidelines that no EHR can act on. SPiER makes each layer machine-actionable,
            shows EHR vendors and health-system admins what a configured implementation looks like, and
            provides the code to execute on it. The artifacts are free and open to adopt at no cost.
          </p>
        </div>

        <section className="how-it-works">
          <h3 className="how-it-works__title">How SPiER works</h3>
          <p className="how-it-works__lead">
            Everything that matters in suicide prevention currently lives only in human-readable form. SPiER&rsquo;s
            work is to encode each layer so software can act on it &mdash; in three steps that build on each other:{' '}
            <strong>Capture &rarr; Translate &rarr; Act</strong>.
          </p>
          <div className="how-it-works__grid">
            <div className="how-it-works__card">
              <span className="how-it-works__step">Step 1</span>
              <h4>Capture</h4>
              <p>
                Validated tools &mdash; the <strong>ASQ</strong> screener, the{' '}
                <strong>Columbia Suicide Severity Rating Scale</strong>, the <strong>Stanley-Brown Safety Plan</strong>{' '}
                &mdash; live on paper and in PDFs. SPiER turns each into a single canonical FHIR shape (a{' '}
                <code>Questionnaire</code>) so it&rsquo;s recorded identically in every system that uses it.
              </p>
            </div>
            <div className="how-it-works__card">
              <span className="how-it-works__step">Step 2</span>
              <h4>Translate</h4>
              <p>
                Different sites use different tools, and a result is useless to a system that can&rsquo;t read the
                instrument behind it. SPiER defines a shared, instrument-agnostic risk concept that every tool maps
                into &mdash; so a receiving system can act on a result <em>without running the same tool</em>. It&rsquo;s
                the approach HL7&rsquo;s Gravity Project took for social-determinants screening.
              </p>
            </div>
            <div className="how-it-works__card">
              <span className="how-it-works__step">Step 3</span>
              <h4>Act</h4>
              <p>
                The response protocols already exist as written guidelines &mdash; they just can&rsquo;t fire on
                their own. SPiER encodes them as executable logic (<code>PlanDefinition</code> + CDS Hooks) so the
                right next step surfaces at the right moment. SPiER recommends; the clinician decides.
              </p>
            </div>
          </div>
          <p className="how-it-works__payoff">
            <strong>Why it matters.</strong> Captured once, translated into a shared concept, and made actionable,
            a patient&rsquo;s safety information can travel across systems and be available wherever they show up
            next. A patient screened with the ASQ in an emergency department and discharged with a safety plan
            shouldn&rsquo;t be re-screened from scratch at an outpatient clinic 48 hours later &mdash; the next
            clinician should pick up where the last one left off.
          </p>
        </section>

        <div className="lens-grid">
          <a href={IG_HREF} target="_blank" rel="noopener noreferrer" className="lens-card lens-card--ig">
            <div className="lens-card-badge">Specification</div>
            <h3>Implementation Guide</h3>
            <p>
              The published HL7 FHIR Implementation Guide &mdash; the normative spec: profiles,
              value sets, code systems, and canonical Questionnaires for suicide-safer care.
            </p>
            <span className="lens-card-cta">Open the HL7 IG &rarr;</span>
          </a>

          <Link to="/guide" className="lens-card lens-card--guide">
            <div className="lens-card-badge">Adopt</div>
            <h3>Adoption Guide</h3>
            <p>
              How to adopt SPiER and see it running: the 8-stage suicide-safer care pathway, a data
              dictionary, an adoption-readiness matrix and EHR adoption rubric, a configurable Tool
              Configuration that drives the Patient View, and a public roadmap.
            </p>
            <span className="lens-card-cta">Explore the guide &rarr;</span>
          </Link>

          <Link to="/population" className="lens-card lens-card--population">
            <div className="lens-card-badge">Demo</div>
            <h3>Population View</h3>
            <p>
              A behavioral-health counselor's caseload &mdash; 10 sample patients spanning every
              pathway stage and risk level. Each row surfaces the recommended next step regardless
              of which specific tools an implementation has enabled.
            </p>
            <span className="lens-card-cta">Open the caseload &rarr;</span>
          </Link>

          <Link to="/patient/chart" className="lens-card lens-card--patient">
            <div className="lens-card-badge">Demo</div>
            <h3>Patient View</h3>
            <p>
              One patient's chart, organized around the 8-stage pathway: a visual stage tracker,
              CDS-style next-step recommendation cards, activity grouped by stage, encounter
              timeline, and a full FHIR document list.
            </p>
            <span className="lens-card-cta">Open the chart &rarr;</span>
          </Link>
        </div>
      </div>

      <footer className="portal-footer">
        <span>SPiER &mdash; Setting priorities for technology-enabled suicide-safer care</span>
      </footer>
    </div>
  )
}
