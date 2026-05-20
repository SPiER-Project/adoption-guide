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

      <div className="lens-grid">
        <Link to="/implementation-guide" className="lens-card lens-card--guide">
          <div className="lens-card-badge">Lens 1</div>
          <h3>Implementation Guide</h3>
          <p>
            The 8-stage suicide-safer care pathway, a data dictionary for the FHIR resources it
            produces, an EHR adoption rubric, a configurable Tool Configuration that drives the
            Patient View, and a public roadmap.
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
