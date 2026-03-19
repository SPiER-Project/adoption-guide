import { Link } from 'react-router-dom'

export function ToolsReference() {
  return (
    <div className="tools-reference">
      <h2 className="page-title">Available Tools</h2>
      <p className="tools-description">
        Select a clinical tool to begin an interactive, FHIR-native screening or safety planning session.
        All tools render native FHIR R4 Questionnaires and can generate structured FHIR resources.
      </p>

      <div className="tools-grid">
        <div className="tool-card">
          <div className="card-badge card-badge--safety">Safety Plan</div>
          <h3>Stanley-Brown Safety Plan</h3>
          <p>A brief intervention to help individuals manage suicidal crises and reduce access to lethal means.</p>
          <div className="tool-card-meta">
            <span className="tool-card-tag">7-step plan</span>
            <span className="tool-card-tag">LOINC coded</span>
            <span className="tool-card-tag">CarePlan output</span>
          </div>
          <Link to="/chart/screenings/stanley-and-brown" className="btn-primary">Launch Safety Plan</Link>
        </div>

        <div className="tool-card">
          <div className="card-badge card-badge--cams">CAMS Framework</div>
          <h3>Collaborative Assessment &amp; Management of Suicidality</h3>
          <p>A therapeutic framework for suicide-specific assessment and treatment planning.</p>
          <div className="cams-links">
            <Link to="/chart/screenings/cams-section-a" className="btn-secondary">
              SSF-5 Section A <span className="btn-meta">Patient</span>
            </Link>
            <Link to="/chart/screenings/cams-section-b" className="btn-secondary">
              SSF-5 Section B <span className="btn-meta">Clinician</span>
            </Link>
            <Link to="/chart/screenings/cams-stabilization-plan" className="btn-secondary">
              Stabilization Plan
            </Link>
            <Link to="/chart/screenings/cams-therapeutic-worksheet" className="btn-secondary">
              Therapeutic Worksheet
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
