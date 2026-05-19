export function Roadmap() {
  return (
    <div className="page-placeholder">
      <h2>Roadmap</h2>
      <p>
        Three strategic priorities, taken in order. Each one is a precondition for the next:
        you can't put codes on tools that aren't structured, and you can't wire automations
        between tools whose data elements aren't standardized.
      </p>

      <section className="roadmap-section">
        <h3>Priority 1 &middot; Translate tools to FHIR objects</h3>
        <p>
          Today the catalog (<code>Tool</code>, <code>Stage</code>, <code>Trigger</code>,{' '}
          <code>Preset</code>) lives as bespoke TypeScript interfaces. To be a real reference
          implementation rather than just a demo, the catalog needs to be FHIR-shaped:
        </p>
        <ul>
          <li><code>Tool</code> &rarr; <strong>ActivityDefinition</strong> (referencing the Questionnaire)</li>
          <li><code>Stage</code> + pathway &rarr; <strong>PlanDefinition</strong> with grouped actions</li>
          <li><code>Trigger</code> &rarr; <strong>PlanDefinition.action.trigger</strong> (TriggerDefinition)</li>
          <li><code>Preset</code> / user tool-config &rarr; a custom <strong>PlanDefinition</strong> that selects a subset of the canonical pathway's actions</li>
          <li>
            <strong>Licensing &amp; usage requirements per tool</strong> &mdash; capture each
            instrument's licensing status using <code>ActivityDefinition.copyright</code>,{' '}
            <code>copyrightLabel</code>, and related fields. Public domain (ASQ, PHQ-9, SBQ-R,
            BSSA) vs registration-required (C-SSRS) vs commercially licensed (CAMS) all need to
            surface in the Implementation Guide so adopters know what's actually safe to deploy
            and where attribution or fees are required.
          </li>
        </ul>
        <p>
          The payoff: a configured implementation can be exported as a FHIR Bundle and handed
          to another EHR. SPiER stops modeling interop and starts demonstrating it.
        </p>
      </section>

      <section className="roadmap-section">
        <h3>Priority 2 &middot; Use LOINC / SNOMED codes where available</h3>
        <p>
          Once tools are FHIR shapes, every coded element should reference a standard terminology
          rather than a local string:
        </p>
        <ul>
          <li>Questionnaire item codes &rarr; LOINC where published (e.g. PHQ-9 individual items, ASQ result, C-SSRS items)</li>
          <li>Observation codes &rarr; LOINC for survey results, vitals-style measures (CAMS SSF psychological pain, etc.)</li>
          <li>Condition / Problem codes &rarr; SNOMED CT (suicidal ideation, suicide attempt, self-harm, depression)</li>
          <li>Procedure / intervention codes &rarr; SNOMED or CPT (safety planning, means counseling, follow-up)</li>
        </ul>
        <p>
          Where no published LOINC exists (e.g. CAMS SSF measures), document the local code system
          clearly so a receiving system knows what to map.
        </p>
      </section>

      <section className="roadmap-section">
        <h3>Priority 3 &middot; Automations &amp; clinical decision support hooks</h3>
        <p>
          With structured, coded tools in place, the workflow logic between stages becomes
          machine-readable:
        </p>
        <ul>
          <li>
            <strong>Triggers between stages</strong> &mdash; e.g. PHQ-9 Item 9 &ge; 1 fires the
            Flag Risk &rarr; Clarify Risk transition, modeled as{' '}
            <code>PlanDefinition.action.trigger</code>.
          </li>
          <li>
            <strong>CDS Hooks integration</strong> &mdash; expose risk-elevating events
            (<code>patient-view</code>, <code>order-sign</code>) so an EHR can call out to a
            SPiER service and receive cards recommending the next stage's tool.
          </li>
          <li>
            <strong>Care-plan auto-generation</strong> &mdash; completion of a Stabilization or
            Stanley-Brown questionnaire writes a derived <code>CarePlan</code> resource
            automatically (already partially implemented; formalize as a defined transformation).
          </li>
        </ul>
      </section>

      <section className="roadmap-section">
        <h3>In flight</h3>
        <ul>
          <li>Population View: a CoCM-style behavioral-health patient registry (prototype lives separately in <code>cocm_registry</code>)</li>
        </ul>
      </section>

      <section className="roadmap-section">
        <h3>Done</h3>
        <ul>
          <li>FHIR Questionnaires for ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS (Sections A/B, Stabilization, Therapeutic Worksheet), Stanley-Brown</li>
          <li>Unified Implementation Guide (Pathway, Data Dictionary, Adoption Rubric, Tool Configuration, Roadmap)</li>
          <li>8-stage pathway hierarchy with FHIR resources organized by stage</li>
          <li>Three-lens navigation (Home, Implementation Guide, Patient View, Population View)</li>
          <li>Tool Configuration: implementation-level feature flags driving the Patient View's Assessments tab (localStorage-backed)</li>
          <li>Consolidated single-page Patient Chart (risk status, care plans, encounters timeline with anchor links)</li>
          <li>Design-token system: centralized colors, spacing, and radii under <code>:root</code> in <code>index.css</code></li>
        </ul>
      </section>
    </div>
  )
}
