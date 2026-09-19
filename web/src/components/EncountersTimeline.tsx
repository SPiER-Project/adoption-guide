/**
 * The scenario-walkthrough timeline, with inline drill-in. Extracted from
 * `PatientChart` (#126).
 *
 * ⚠️ These are **narrative** steps, not FHIR resources — the bucket is
 * `walkthrough`, and #285 is why that matters: `encounters` used to hold this
 * narration and now holds real FHIR `Encounter`s. Each step links to the
 * artifacts it produced by reference (#263 phase 5b).
 *
 * No CSS import, matching every sibling chart section — `PatientChart.css` is
 * imported once by the page.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { resolveRelatedRefs, type RelatedArtifact } from '../lib/chartDisplay'
import { stageById } from '@spier/core/data/catalog'
import type { ScenarioEncounter } from '@spier/core/types/fhir'
import { Pill } from '@spier/ui/Pill'
import { formatDate } from '../lib/dates'

export function EncountersTimeline({
  walkthrough,
  refIndex,
  defaultCollapsed = false,
}: {
  walkthrough: ScenarioEncounter[]
  /** `Type/id` → display, built by the caller from every artifact bucket. */
  refIndex: Map<string, RelatedArtifact>
  /** Start closed — the embedded panel does, the full shell does not. */
  defaultCollapsed?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [open, setOpen] = useState(!defaultCollapsed)

  // Most patients carry no scenario walkthrough. An empty "Scenario walkthrough /
  // 0 steps" heading is pure noise between the pathway and the documents list.
  if (walkthrough.length === 0) return null

  return (
    <section id="encounters" className="encounters-timeline-section">
      <SectionHeader
        title="Scenario walkthrough"
        meta={`${walkthrough.length} ${walkthrough.length === 1 ? 'step' : 'steps'}`}
        collapsible={{ open, onToggle: () => setOpen(o => !o), controls: 'encounters-body' }}
      />
      {open && (
        <div id="encounters-body">
          <p className="encounters-note">
            Narrative steps, not FHIR resources — each links to the FHIR artifact it
            produces. Steps
            marked <em>profile gap</em> map to resource types that don't yet have a SPiER
            profile (tracked in issue&nbsp;#52). Steps marked <em>proposed step</em> are
            SPiER additions to the HL7 use case, not part of the scenario the working
            group circulated.
          </p>
          <ol className="encounters-list">
            {walkthrough.map(enc => {
              // Resolve by reference (#263 phase 5b). A ref that resolves to
              // nothing is dropped here rather than rendered as a dead row —
              // check-scenario-resources.mjs is what makes that impossible to ship.
              const related = resolveRelatedRefs(enc.relatedRefs, refIndex)
              const stage = enc.stageId ? stageById(enc.stageId) : undefined
              const isExpanded = expandedId === enc.id
              return (
                <li key={enc.id} className={`encounter-row encounter-row--${enc.status}`}>
                  <button
                    type="button"
                    className="encounter-row-header"
                    onClick={() => setExpandedId(isExpanded ? null : enc.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="encounter-row-when">
                      {enc.step && <span className="encounter-row-step">{enc.step}</span>}
                      <span className="encounter-row-date">
                        {formatDate(enc.date)}
                      </span>
                    </span>
                    <span className="encounter-row-type">{enc.title}</span>
                    <Pill tone={enc.status === 'completed' ? 'soft-low' : 'info'}>{enc.status}</Pill>
                    <span className="encounter-row-toggle">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="encounter-row-body">
                      <div className="encounter-row-meta">
                        {enc.actor && <span>{enc.actor}</span>}
                        {enc.actor && stage && <span className="encounter-card-divider">&middot;</span>}
                        {stage && <span>{stage.title}</span>}
                        {enc.profileGap && (
                          <>
                            <span className="encounter-card-divider">&middot;</span>
                            <span className="encounter-gap-tag">profile gap</span>
                          </>
                        )}
                        {enc.proposed && (
                          <>
                            <span className="encounter-card-divider">&middot;</span>
                            <span className="encounter-proposed-tag">proposed step</span>
                          </>
                        )}
                      </div>
                      <p className="encounter-row-notes">{enc.notes}</p>
                      {enc.fhirArtifacts && enc.fhirArtifacts.length > 0 && (
                        <div className="encounter-artifacts">
                          {enc.fhirArtifacts.map(a => (
                            <Pill key={a} variant="label">{a}</Pill>
                          ))}
                        </div>
                      )}
                      {related.length > 0 && (
                        <div className="encounter-related">
                          <h5 className="encounter-related-title">Captured in this patient's chart</h5>
                          <ul className="encounter-related-list">
                            {related.map(a => (
                              <li key={a.ref}>
                                <strong>{a.name}</strong>
                                <span className="encounter-related-meta">
                                  {' '}&middot; {a.resourceType}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
