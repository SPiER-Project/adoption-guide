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
          <div className="card-badge card-badge--screening">Screening</div>
          <h3>PHQ-9 — Patient Health Questionnaire</h3>
          <p>9-item depression screening with Item 9 as the primary suicide risk gateway. Scored 0-27 with severity thresholds. LOINC coded throughout.</p>
          <div className="tool-card-meta">
            <span className="tool-card-tag">9 items</span>
            <span className="tool-card-tag">LOINC coded</span>
            <span className="tool-card-tag">ordinalValue scoring</span>
            <span className="tool-card-tag">public domain</span>
          </div>
          <Link to="/chart/screenings/phq-9" className="btn-primary">Launch PHQ-9</Link>
        </div>

        <div className="tool-card">
          <div className="card-badge card-badge--screening">Screening</div>
          <h3>ASQ — Ask Suicide-Screening Questions</h3>
          <p>NIMH-validated 4-question suicide risk screening tool for youth (8+) and adults. Includes acuity question with three-tier risk stratification.</p>
          <div className="tool-card-meta">
            <span className="tool-card-tag">~20 seconds</span>
            <span className="tool-card-tag">NIMH public domain</span>
            <span className="tool-card-tag">enableWhen logic</span>
          </div>
          <Link to="/chart/screenings/asq" className="btn-primary">Launch ASQ Screening</Link>
        </div>

        <div className="tool-card">
          <div className="card-badge card-badge--screening">Screening</div>
          <h3>SBQ-R — Suicide Behaviors Questionnaire-Revised</h3>
          <p>4-item self-report covering lifetime ideation, past-year frequency, threat disclosure, and future likelihood. Score range 3-18 with population-specific cutoffs.</p>
          <div className="tool-card-meta">
            <span className="tool-card-tag">4 items</span>
            <span className="tool-card-tag">ordinalValue scoring</span>
            <span className="tool-card-tag">validated cutoffs</span>
          </div>
          <Link to="/chart/screenings/sbq-r" className="btn-primary">Launch SBQ-R</Link>
        </div>

        <div className="tool-card">
          <div className="card-badge card-badge--assessment">Assessment</div>
          <h3>C-SSRS — Columbia Suicide Severity Rating Scale</h3>
          <p>Gold-standard suicide risk assessment with hierarchical ideation levels, intensity ratings, and behavior tracking. Two versions available.</p>
          <div className="tool-card-meta">
            <span className="tool-card-tag">LOINC coded</span>
            <span className="tool-card-tag">5-level hierarchy</span>
            <span className="tool-card-tag">risk stratification</span>
          </div>
          <div className="cams-links">
            <Link to="/chart/screenings/cssrs-screener" className="btn-secondary">
              Screener (6-item) <span className="btn-meta">Quick</span>
            </Link>
            <Link to="/chart/screenings/cssrs-full" className="btn-secondary">
              Full Lifetime/Recent <span className="btn-meta">Comprehensive</span>
            </Link>
          </div>
        </div>

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
