import { useMemo } from 'react'
import { STAGES, TOOLS, type Tool } from '../data/catalog'

type ToolBuildStatus = 'built' | 'planned'

function buildStatusOf(tool: Tool): ToolBuildStatus {
  return tool.launchActions.length > 0 ? 'built' : 'planned'
}

// Per-tool roadmap notes. Module-scope so this isn't reallocated on every call.
// Edit this map when the build plan for a tool changes.
const PLANS: Record<string, string> = {
  'TL-001': 'Built. Next: LOINC coding on the result Observation and a published ActivityDefinition.',
  'TL-002': 'Built. Next: LOINC item codes for each PHQ-9 question and CDS trigger on Item 9 ≥ 1.',
  'TL-003': 'Built. Next: publish ActivityDefinition; add SNOMED CT for severity outcomes.',
  'TL-011': 'Planned. Need: Questionnaire JSON, response-to-Observation mapper, route wiring. Public domain instrument.',
  'TL-014': 'Future. Lower-priority; PSS-3 covers most flag-risk needs. Build only if requested by an adopter.',
  'TL-025': 'Built. Next: LOINC mapping for total score and clinical-cutoff Observation.',
  'TL-004': 'Built. Next: long-form item-level LOINC codes and risk-history-derived Condition extraction.',
  'TL-019': 'Planned. Need: Questionnaire JSON for the since-last-contact form, mapping to a tracking Observation.',
  'TL-005': 'Planned. Need: BSSA Questionnaire JSON and CarePlan generation from the disposition decision tree.',
  'TL-020': 'Built (Sections A/B). Next: link Section B drivers to FHIR Condition resources for problem-list tracking.',
  'TL-006': 'Planned. Need: SAFE-T as a structured decision-support form; ties to risk-status Observation.',
  'TL-024': 'Built. Next: longitudinal SSF vital tracking via repeated Observations with consistent LOINC codes.',
  'TL-007': 'Built. Next: CarePlan transformation formalized as a defined PlanDefinition.action.transform.',
  'TL-008': 'Planned. Need: Means counseling Questionnaire + Procedure resource generation per CALM model.',
  'TL-021': 'Built. Next: surface stabilization activities as discrete CarePlan.activity entries with codes.',
  'TL-013': 'Planned. Need: Now Matters Now integration (external resource library) plus CarePlan link-out.',
  'TL-015': 'Future. CRP requires licensure and a video-mediated workflow; defer until partner request.',
  'TL-016': 'Future. CALM training assets needed; provider-side workflow rather than patient-facing form.',
  'TL-009': 'Planned. Need: Transition Questionnaire + ServiceRequest/Task resources for inter-setting handoff.',
  'TL-023': 'Planned. Need: CAMS outcome form; outputs an Observation describing pathway resolution.',
  'TL-017': 'Future. Rapid-referral logic depends on having receiving-system FHIR endpoints; defer.',
  'TL-010': 'Planned. Need: Caring Contacts Questionnaire + scheduled Task resources for 7/30-day follow-up.',
  'TL-012': 'Planned. Need: ED-SAFE telephone-follow-up workflow modeled as CommunicationRequest + Communication resources.',
  'TL-018': 'Future. Post-visit survey instrument; lower priority than active-risk tooling.',
  'TL-022': 'Built. Next: link CAMS interim sessions to the parent CAMS Encounter and update active-episode state.',
}

function planForTool(tool: Tool): string {
  return PLANS[tool.id] ?? 'Not yet scoped.'
}

export function Roadmap() {
  const { groupedTools, built, planned } = useMemo(() => {
    const grouped = STAGES.map(stage => ({
      stage,
      tools: TOOLS.filter(t => t.stageId === stage.id),
    }))
    const builtCount = TOOLS.filter(t => buildStatusOf(t) === 'built').length
    return {
      groupedTools: grouped,
      built: builtCount,
      planned: TOOLS.length - builtCount,
    }
  }, [])

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
        <h3>Tool build status</h3>
        <p>
          Every tool catalogued on the Pathway page is listed here with its current build state
          and what's needed next. <strong>{built}</strong> of <strong>{TOOLS.length}</strong>{' '}
          tools are launchable today; <strong>{planned}</strong> are planned.
        </p>
        {groupedTools.map(({ stage, tools }) => (
          <div key={stage.id} className="roadmap-stage-block">
            <h4 className="roadmap-stage-heading">{stage.title}</h4>
            {tools.length === 0 && (
              <p className="roadmap-tool-empty">
                No tools catalogued for this stage yet. Likely candidates: outcome reporting
                packs, registry exports, and de-identified pathway-completion measures.
              </p>
            )}
            <ul className="roadmap-tool-list">
              {tools.map(tool => {
                const status = buildStatusOf(tool)
                return (
                  <li key={tool.id} className={`roadmap-tool roadmap-tool--${status}`}>
                    <span className={`roadmap-tool-status roadmap-tool-status--${status}`}>
                      {status === 'built' ? 'Built' : 'Planned'}
                    </span>
                    <div className="roadmap-tool-body">
                      <div className="roadmap-tool-name">
                        <strong>{tool.shortName ?? tool.name}</strong>
                        <span className="roadmap-tool-id">{tool.id}</span>
                        <span className={`roadmap-tool-inclusion roadmap-tool-inclusion--${tool.inclusionStatus}`}>
                          {tool.inclusionStatus}
                        </span>
                      </div>
                      <div className="roadmap-tool-plan">{planForTool(tool)}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
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
