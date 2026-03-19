import { Link } from 'react-router-dom'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import '../css/ImplementationGuide.css'

const EXAMPLE_PHQ9_OBSERVATION = {
  resourceType: 'Observation',
  id: 'phq9-item9-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead or of hurting yourself' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T10:30:00Z',
  valueInteger: 2,
  interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Positive — suicide risk screening indicated' }] }],
}

const EXAMPLE_ASQ_OBSERVATION = {
  resourceType: 'Observation',
  id: 'asq-result-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '93243-5', display: 'ASQ suicide risk screening result' }] },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T10:35:00Z',
  valueCodeableConcept: {
    coding: [{ system: 'http://spier.org/CodeSystem/asq-screening-result', code: 'non-acute-positive', display: 'Non-Acute Positive Screen' }],
  },
}

const EXAMPLE_CAMS_VITAL = {
  resourceType: 'Observation',
  id: 'cams-psychological-pain-example',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] }],
  code: {
    coding: [{ system: 'http://spier.org/CodeSystem/cams-ssf', code: 'psychological-pain', display: 'CAMS SSF: Psychological Pain' }],
    text: 'Psychological Pain — local code pending LOINC submission',
  },
  subject: { reference: 'Patient/123' },
  effectiveDateTime: '2026-03-19T11:00:00Z',
  valueInteger: 4,
  interpretation: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'H', display: 'Elevated (4/5)' }] }],
  note: [{ text: 'Track longitudinally across CAMS sessions to show trending.' }],
}

const EXAMPLE_CAMS_CONDITION = {
  resourceType: 'Condition',
  id: 'cams-driver-example',
  clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
  category: [
    { coding: [{ system: 'http://cams-care.com/driver-category', code: 'suicide-driver', display: 'Suicide Driver' }] },
    { coding: [{ system: 'http://cams-care.com/driver-type', code: 'direct', display: 'Direct Driver' }] },
  ],
  code: { text: 'Relationship conflict with spouse — feeling trapped and hopeless' },
  subject: { reference: 'Patient/123' },
  note: [{ text: 'Track on problem list until resolved. Update clinicalStatus to "resolved" at CAMS disposition.' }],
}

const RECORDING_PATTERNS = [
  {
    tool: 'PHQ-9',
    phase: 'Screening',
    resources: [
      { type: 'QuestionnaireResponse', description: 'Raw form data — all 9 item responses', when: 'On submit' },
      { type: 'Observation', description: 'Total score (LOINC 44261-6) with severity interpretation', when: 'Extracted from response' },
      { type: 'Observation', description: 'Item 9 score (LOINC 44260-8) — suicide risk gateway flag', when: 'Extracted from response' },
    ],
    trigger: 'Item 9 score ≥ 1 → recommend ASQ or C-SSRS',
  },
  {
    tool: 'ASQ',
    phase: 'Screening',
    resources: [
      { type: 'QuestionnaireResponse', description: 'All 5 items (Q1-Q4 + acuity Q5)', when: 'On submit' },
      { type: 'Observation', description: 'Screening result (negative / non-acute-positive / acute-positive)', when: 'Extracted from response' },
      { type: 'Observation', description: 'Individual item responses (LOINC 93263-3 through 93267-4)', when: 'Extracted from response' },
    ],
    trigger: 'Acute positive → STAT safety evaluation + safety plan. Non-acute positive → brief safety assessment.',
  },
  {
    tool: 'SBQ-R',
    phase: 'Screening',
    resources: [
      { type: 'QuestionnaireResponse', description: 'All 4 items with ordinal scoring', when: 'On submit' },
      { type: 'Observation', description: 'Total score (3-18) with cutoff comparison', when: 'Extracted from response' },
    ],
    trigger: 'Score ≥ 7 (general) or ≥ 8 (inpatient) → further assessment',
  },
  {
    tool: 'CAMS Section A',
    phase: 'Assessment',
    resources: [
      { type: 'QuestionnaireResponse', description: 'SSF-5 Section A — 6 vital ratings + qualitative text', when: 'On submit' },
      { type: 'Observation (x6)', description: 'Individual vital scores (pain, stress, agitation, hopelessness, self-hate, overall risk)', when: 'Extracted from response' },
      { type: 'Observation', description: 'Overall suicide risk level (LOINC 93374-7)', when: 'Extracted from response' },
    ],
    trigger: 'Any vital ≥ 4 → stabilization planning. Track longitudinally for trending.',
  },
  {
    tool: 'CAMS Section B',
    phase: 'Assessment',
    resources: [
      { type: 'QuestionnaireResponse', description: 'SSF-5 Section B — ideation, plan, preparation, history, drivers', when: 'On submit' },
      { type: 'Condition (x1-3)', description: 'Suicide drivers added to problem list (clinicalStatus: active)', when: 'Extracted from response' },
    ],
    trigger: 'Plan present → immediate stabilization planning. Drivers tracked until resolved.',
  },
  {
    tool: 'Stanley-Brown',
    phase: 'Safety Planning',
    resources: [
      { type: 'QuestionnaireResponse', description: '7-step safety plan responses', when: 'On submit' },
      { type: 'CarePlan', description: 'FHIR CarePlan with LOINC-coded activities (hybrid model)', when: 'Generated from response' },
    ],
    trigger: 'CarePlan persists on chart. Reviewed at follow-up encounters.',
  },
  {
    tool: 'CAMS Stabilization',
    phase: 'Safety Planning',
    resources: [
      { type: 'QuestionnaireResponse', description: 'Stabilization plan responses', when: 'On submit' },
      { type: 'CarePlan', description: 'Stabilization CarePlan with lethal means, coping strategies, support network', when: 'Generated from response' },
    ],
    trigger: 'CarePlan updated at start of every CAMS session.',
  },
]

export function ImplementationGuide() {
  return (
    <div className="impl-guide">
      <h2 className="page-title">Implementation Guide</h2>
      <p className="impl-description">
        How EHR developers should record, store, and act on data from each clinical tool.
        The pattern is: <strong>Questionnaire &rarr; QuestionnaireResponse &rarr; Observations/Conditions &rarr; Workflow Triggers</strong>.
      </p>

      {/* ── Implementation Levels ── */}
      <section className="impl-section">
        <h3 className="impl-section-title">Integration Levels</h3>
        <div className="impl-levels">
          <div className="impl-level impl-level--1">
            <div className="impl-level-header">
              <span className="impl-level-number">1</span>
              <span className="impl-level-name">Render &amp; Record</span>
            </div>
            <p>Render the FHIR Questionnaire, store the QuestionnaireResponse. Minimum viable integration.</p>
          </div>
          <div className="impl-level impl-level--2">
            <div className="impl-level-header">
              <span className="impl-level-number">2</span>
              <span className="impl-level-name">Extract Observations</span>
            </div>
            <p>Calculate scores and create discrete Observations (with LOINC codes where available). Data becomes queryable across encounters.</p>
          </div>
          <div className="impl-level impl-level--3">
            <div className="impl-level-header">
              <span className="impl-level-number">3</span>
              <span className="impl-level-name">Trigger Workflows</span>
            </div>
            <p>Use Observation values to fire CDS Hooks, route to next tool, generate CarePlans, and display risk alerts on the patient chart.</p>
          </div>
        </div>
      </section>

      {/* ── Recording Pattern Table ── */}
      <section className="impl-section">
        <h3 className="impl-section-title">Recording Pattern by Tool</h3>
        <p className="impl-hint">Each tool follows the same pattern: form submission creates a QuestionnaireResponse, then the EHR extracts clinical data points as FHIR resources.</p>

        {RECORDING_PATTERNS.map(pattern => (
          <div key={pattern.tool} className="impl-pattern-card">
            <div className="impl-pattern-header">
              <span className="impl-pattern-tool">{pattern.tool}</span>
              <span className="impl-pattern-phase">{pattern.phase}</span>
            </div>
            <table className="impl-pattern-table">
              <thead>
                <tr>
                  <th>FHIR Resource</th>
                  <th>Content</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {pattern.resources.map((r, idx) => (
                  <tr key={idx}>
                    <td><code>{r.type}</code></td>
                    <td>{r.description}</td>
                    <td className="impl-pattern-when">{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="impl-pattern-trigger">
              <strong>Workflow trigger:</strong> {pattern.trigger}
            </div>
          </div>
        ))}
      </section>

      {/* ── Example FHIR Resources ── */}
      <section className="impl-section">
        <h3 className="impl-section-title">Example FHIR Resources</h3>
        <p className="impl-hint">These are the Observation and Condition resources that the EHR would create after extracting data from QuestionnaireResponses.</p>

        <div className="impl-examples">
          <FhirJsonViewer data={EXAMPLE_PHQ9_OBSERVATION} title="PHQ-9 Item 9 → Observation (suicide risk gateway)" />
          <FhirJsonViewer data={EXAMPLE_ASQ_OBSERVATION} title="ASQ → Observation (screening result)" />
          <FhirJsonViewer data={EXAMPLE_CAMS_VITAL} title="CAMS Section A → Observation (psychological pain vital)" />
          <FhirJsonViewer data={EXAMPLE_CAMS_CONDITION} title="CAMS Section B → Condition (suicide driver on problem list)" />
        </div>
      </section>

      {/* ── Terminology Notes ── */}
      <section className="impl-section">
        <h3 className="impl-section-title">Terminology Notes</h3>
        <div className="impl-terminology">
          <div className="impl-term-item impl-term-item--good">
            <h4>LOINC Coded (ready to use)</h4>
            <ul>
              <li>PHQ-9: Panel 44249-1, all 9 items individually coded, total score 44261-6</li>
              <li>ASQ: Individual items 93263-3 through 93267-4</li>
              <li>Stanley-Brown: 7 steps coded 76689-1 through 81344-4</li>
              <li>Suicide risk level: 93374-7 (usable for CAMS overall risk)</li>
            </ul>
          </div>
          <div className="impl-term-item impl-term-item--pending">
            <h4>Local Codes (pending LOINC submission)</h4>
            <ul>
              <li>CAMS SSF vitals (psychological pain, stress, agitation, hopelessness, self-hate): <code>http://spier.org/CodeSystem/cams-ssf</code></li>
              <li>CAMS driver classification: <code>http://cams-care.com/driver-type</code> (direct/indirect)</li>
              <li>ASQ screening result: <code>http://spier.org/CodeSystem/asq-screening-result</code></li>
              <li>SBQ-R items: <code>http://spier.org/CodeSystem/sbqr-*</code></li>
            </ul>
            <p className="impl-term-note">
              EHR developers should use these local code systems for now and map to LOINC codes as they become available.
              This is a standard pattern — see <a href="https://www.hl7.org/fhir/terminologies.html" target="_blank" rel="noopener noreferrer">FHIR Terminology guidance</a>.
            </p>
          </div>
        </div>
      </section>

      <div className="impl-nav">
        <Link to="/chart/data-dictionary" className="impl-nav-link">View Data Dictionary &rarr;</Link>
        <Link to="/chart/workflow" className="impl-nav-link">View Clinical Workflow &rarr;</Link>
      </div>
    </div>
  )
}
