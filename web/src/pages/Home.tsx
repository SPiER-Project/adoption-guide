import { Link } from 'react-router-dom'
import '../css/Home.css'

export function Home() {
  return (
    <div className="home-container">
      <div className="hero-section">
        <h2 className="spier-title">SPiER</h2>
        <div className="accent-line"></div>
        <p className="spier-tagline">
          Setting Priorities for technology-enabled suicide-safer care in Electronic Records
        </p>
        <p className="spier-description">
          A FHIR-native reference implementation of a suicide prevention pathway. SPiER demonstrates
          to EHR vendors and health-system admins what a configured implementation can look like &mdash;
          and provides the code to execute on it.
        </p>
      </div>

      <section className="how-it-works">
        <h3 className="how-it-works__title">How SPiER works</h3>
        <p className="how-it-works__lead">
          SPiER takes research-validated suicide prevention tools &mdash; the <strong>ASQ</strong> screener,
          the <strong>Columbia Suicide Severity Rating Scale</strong>, the <strong>Stanley-Brown Safety Plan</strong>,
          and others &mdash; and turns them into structured, machine-readable forms that any EHR or health
          system can implement the same way.
        </p>
        <div className="how-it-works__grid">
          <div className="how-it-works__card">
            <h4>Standards (HL7)</h4>
            <p>
              US Core and USCDI cover the basics, but don't specify <em>how</em> suicide screeners,
              risk assessments, and safety plans should be captured. SPiER fills that gap by
              translating each tool into a canonical FHIR shape and contributing it to existing
              HL7 workgroups.
            </p>
          </div>
          <div className="how-it-works__card">
            <h4>Exchange (HIEs)</h4>
            <p>
              EHRs hold the data; Health Information Exchanges move it between organizations.
              SPiER's HIE work makes suicide-safer-care data findable and shareable across the
              systems a patient actually moves through.
            </p>
          </div>
          <div className="how-it-works__card">
            <h4>Care transitions</h4>
            <p>
              When standards and exchange come together, the patient's safety information is
              available wherever they show up next &mdash; so the next clinician can pick up
              where the last one left off, instead of starting from scratch.
            </p>
          </div>
        </div>
      </section>

      <div className="lens-grid">
        <Link to="/implementation-guide" className="lens-card lens-card--guide">
          <div className="lens-card-badge">Lens 1</div>
          <h3>Implementation Guide</h3>
          <p>
            The 8-stage suicide-safer care pathway, a data dictionary for the FHIR resources it
            produces, an adoption-readiness matrix and EHR adoption rubric, a configurable Tool
            Configuration that drives the Patient View, and a public roadmap.
          </p>
          <span className="lens-card-cta">Explore the guide &rarr;</span>
        </Link>

        <Link to="/population" className="lens-card lens-card--population">
          <div className="lens-card-badge">Lens 2</div>
          <h3>Population View</h3>
          <p>
            A behavioral-health counselor's caseload &mdash; 10 sample patients spanning every
            pathway stage and risk level. Each row surfaces the recommended next step regardless
            of which specific tools an implementation has enabled.
          </p>
          <span className="lens-card-cta">Open the caseload &rarr;</span>
        </Link>

        <Link to="/patient/chart" className="lens-card lens-card--patient">
          <div className="lens-card-badge">Lens 3</div>
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
  )
}
