import { useMemo, useState } from 'react'
import { useScrollToHash } from '../hooks/useScrollToHash'
import { usePatient } from '../context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import { PageHeader } from '../components/PageHeader'
import { PatientPathway } from '../components/PatientPathway'
import { ArtifactCards } from '../components/ChartArtifacts'
import { EpisodeRecordView } from '../components/EpisodeRecordView'
import {
  artifactCount,
  buildWalkthroughRefIndex,
  carePlanDisplayName,
  resolveRelatedRefs,
  type RelatedArtifact,
  type RenderableResource,
} from '../lib/chartDisplay'
import { stageById } from '../data/catalog'
import {
  derivePathwayStatus,
  groupArtifactsByStage,
  unstagedArtifacts,
  stageForResponse,
  type FhirResourceLike,
  type StoredResponseLike,
} from '../lib/patientPathway'
import { workflowArtifactsOf } from '../lib/registry'
import { buildCdsCards } from '../lib/cdsHooks'
import type { ScenarioEncounter, StoredResponse } from '../types/fhir'
import '../css/Dashboard.css'
import '../css/PatientChart.css'

/* ---------- Helpers ---------- */

// Sortable sentinel for FHIR resources missing an authoritative timestamp.
// Keeps date-driven memos deterministic and pushes undated rows to the bottom
// when sorting newest-first.
const UNDATED_SENTINEL = '1970-01-01T00:00:00.000Z'

/* ---------- Unstaged ("Other activity") bucket ---------- */
// Artifacts that resolve to no pathway stage — typically foreign EHR data
// read over SMART (QRs against non-SPiER Questionnaire canonicals, survey
// Observations written by other systems). Collapsed by default: a connected
// EHR patient can carry dozens of these, and they're context rather than
// pathway state.
function OtherActivitySection({
  responses,
  carePlans,
  observations,
  communications,
  workflowArtifacts,
}: {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
  workflowArtifacts: FhirResourceLike[]
}) {
  const [open, setOpen] = useState(false)
  const count = artifactCount({
    responses,
    carePlans,
    observations,
    communications,
    workflowArtifacts,
  })
  if (count === 0) return null
  return (
    <section id="stage-other" className="pathway-other" aria-label="Other activity">
      <h4 className="pathway-node-heading">
        <button
          type="button"
          className="pathway-node-toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          <span className="pathway-node-main">
            <span className="pathway-node-step">Off pathway</span>
            <span className="pathway-node-title">Other activity</span>
          </span>
          <span className="pathway-node-aside">
            <span className="pathway-node-status pathway-node-status--upcoming">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
            <span className="pathway-node-chevron" aria-hidden>{open ? '▲' : '▼'}</span>
          </span>
        </button>
      </h4>
      {open && (
        <div className="pathway-node-body">
          <p className="pathway-node-desc">
            Captured resources that don't map to a SPiER pathway stage — for example, records
            written by other systems on a connected EHR.
          </p>
          <ArtifactCards
            responses={responses}
            carePlans={carePlans}
            observations={observations}
            communications={communications}
            workflowArtifacts={workflowArtifacts}
          />
        </div>
      )}
    </section>
  )
}

/* ---------- Encounters / scenario-walkthrough timeline with inline drill-in ---------- */
function EncountersTimeline({
  walkthrough,
  refIndex,
}: {
  walkthrough: ScenarioEncounter[]
  /** `Type/id` → display, built by the caller from every artifact bucket. */
  refIndex: Map<string, RelatedArtifact>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Most patients carry no scenario walkthrough. An empty "Scenario walkthrough /
  // 0 steps" heading is pure noise between the pathway and the documents list.
  if (walkthrough.length === 0) return null

  return (
    <section id="encounters" className="encounters-timeline-section">
      <header className="chart-section-header">
        <h3 className="chart-section-title">Scenario walkthrough</h3>
        <span className="chart-section-count">
          {walkthrough.length} {walkthrough.length === 1 ? 'step' : 'steps'}
        </span>
      </header>
      {(
        <>
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
                        {new Date(enc.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </span>
                    <span className="encounter-row-type">{enc.title}</span>
                    <span className={`encounter-row-status encounter-row-status--${enc.status}`}>
                      {enc.status}
                    </span>
                    <span className="encounter-row-toggle">{isExpanded ? '▼' : '▶'}</span>
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
                            <span key={a} className="encounter-artifact-chip">{a}</span>
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
        </>
      )}
    </section>
  )
}

/* ---------- Patient-level documents ---------- */
type DocFilter = 'all' | 'responses' | 'careplans' | 'observations'

function PatientDocuments({
  responses,
  carePlans,
  observations,
}: {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
}) {
  const [filter, setFilter] = useState<DocFilter>('all')
  const [openDoc, setOpenDoc] = useState<string | null>(null)

  type DocEntry =
    | { kind: 'response'; key: string; title: string; when: string; resource: FhirResourceLike; stageTag?: string }
    | { kind: 'careplan'; key: string; title: string; when: string; resource: FhirResourceLike; stageTag?: string }
    | { kind: 'observation'; key: string; title: string; when: string; resource: FhirResourceLike; stageTag?: string }

  const docs: DocEntry[] = useMemo(() => {
    const all: DocEntry[] = []
    for (const rawR of responses) {
      const r = rawR as StoredResponse
      all.push({
        kind: 'response',
        key: r.id,
        title: r.questionnaireName,
        when: r.completedAt,
        resource: r.resource,
        stageTag: stageForResponse(r.resource),
      })
    }
    for (const cp of carePlans) {
      const cpRead = cp as RenderableResource
      all.push({
        kind: 'careplan',
        key: cpRead.id ?? `cp-${all.length}`,
        title: carePlanDisplayName(cpRead),
        // Stable sentinel so this useMemo stays deterministic across recomputes
        // when an artifact is missing its timestamp. Undated entries sort to the bottom.
        when: cpRead._savedAt ?? UNDATED_SENTINEL,
        resource: cp,
      })
    }
    for (const obs of observations) {
      const obsRead = obs as RenderableResource
      all.push({
        kind: 'observation',
        key: obsRead.id ?? `obs-${all.length}`,
        title: obsRead.code?.text || obsRead.code?.coding?.[0]?.display || 'Observation',
        when: obsRead.effectiveDateTime ?? UNDATED_SENTINEL,
        resource: obs,
      })
    }
    all.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    return all
  }, [responses, carePlans, observations])

  const filtered = docs.filter(d => {
    if (filter === 'all') return true
    if (filter === 'responses') return d.kind === 'response'
    if (filter === 'careplans') return d.kind === 'careplan'
    return d.kind === 'observation'
  })

  return (
    <section id="documents" className="documents-section">
      <header className="chart-section-header">
        <h3 className="chart-section-title">Patient Documents</h3>
        <span className="chart-section-count">{docs.length} total</span>
      </header>
      <p className="documents-note">
        Every FHIR resource captured for this patient, regardless of encounter or stage. The
        "show me everything" view.
      </p>
      <div className="documents-filters">
        {(['all', 'responses', 'careplans', 'observations'] as DocFilter[]).map(opt => (
          <button
            key={opt}
            type="button"
            className={`filter-chip ${filter === opt ? 'filter-chip--active' : ''}`}
            onClick={() => setFilter(opt)}
          >
            {opt === 'all' && `All (${docs.length})`}
            {opt === 'responses' && `Responses (${docs.filter(d => d.kind === 'response').length})`}
            {opt === 'careplans' && `Care Plans (${docs.filter(d => d.kind === 'careplan').length})`}
            {opt === 'observations' && `Observations (${docs.filter(d => d.kind === 'observation').length})`}
          </button>
        ))}
      </div>
      <ul className="documents-list">
        {filtered.length === 0 && <li className="documents-empty">No documents.</li>}
        {filtered.map(d => {
          const isOpen = openDoc === d.key
          return (
            <li key={d.key} className="document-row">
              <button
                type="button"
                className="document-row-header"
                onClick={() => setOpenDoc(isOpen ? null : d.key)}
                aria-expanded={isOpen}
              >
                <span className={`document-kind document-kind--${d.kind}`}>
                  {d.kind === 'response' ? 'QR' : d.kind === 'careplan' ? 'CP' : 'OBS'}
                </span>
                <span className="document-title">{d.title}</span>
                <span className="document-when">
                  {d.when === UNDATED_SENTINEL ? 'Undated' : new Date(d.when).toLocaleDateString()}
                </span>
                <span className="document-toggle">{isOpen ? '▼' : '▶'}</span>
              </button>
              {isOpen && (
                <div className="document-body">
                  <FhirJsonViewer data={d.resource} title={`FHIR ${d.kind}`} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------- Main page ---------- */
export function PatientChart() {
  const {
    carePlans,
    responses,
    riskAlerts,
    observations,
    communications,
    documentReferences,
    serviceRequests,
    appointments,
    consents,
    procedures,
    episodes,
    encounters,
    flags,
    tasks,
    activePatientId,
    populationPatient,
    isSmartConnected,
    walkthrough,
    isSliceLoading,
    dataSourceError,
  } = usePatient()
  const { isToolEnabled } = useToolConfig()
  useScrollToHash()

  // `Type/id` → display for every artifact a walkthrough step can reference
  // (#263 phase 5b). Built from all the buckets rather than just responses and
  // CarePlans, which is all the retired string matching could reach.
  const walkthroughRefIndex = useMemo(
    () =>
      buildWalkthroughRefIndex({
        responses,
        carePlans,
        observations,
        communications: communications ?? [],
        // Flags, Tasks and Encounters are indexed here but deliberately NOT in
        // `workflowArtifactsOf` below — that feeds pathway derivation, and a
        // precaution Flag is not a stage artifact. This index only answers
        // "can a walkthrough step link to it", and the ED exception branches
        // (patient-013, patient-014) reference all three.
        //
        // Procedures were missing until #324: patient-011's means-counseling
        // step had no artifact to link to, so nothing here noticed. A ref this
        // index cannot resolve renders no link at all, which is why
        // walkthroughRefs.test.ts asserts the two stay in step.
        workflowArtifacts: [
          ...(documentReferences ?? []),
          ...(serviceRequests ?? []),
          ...(appointments ?? []),
          ...(flags ?? []),
          ...(tasks ?? []),
          ...(encounters ?? []),
          ...(procedures ?? []),
        ],
      }),
    [
      responses,
      carePlans,
      observations,
      communications,
      documentReferences,
      serviceRequests,
      appointments,
      flags,
      tasks,
      encounters,
      procedures,
    ],
  )

  // Stage-5 artifacts all stage themselves through meta.tag, so they travel as
  // one bucket rather than a named field per resource type — see PatientArtifacts.
  const workflowArtifacts = useMemo(
    () => workflowArtifactsOf({ documentReferences, serviceRequests, appointments, consents, procedures }),
    [documentReferences, serviceRequests, appointments, consents, procedures],
  )
  const artifacts = useMemo(
    () => ({ responses, carePlans, observations, communications, workflowArtifacts }),
    [responses, carePlans, observations, communications, workflowArtifacts],
  )
  const hasData =
    responses.length > 0 ||
    carePlans.length > 0 ||
    observations.length > 0 ||
    communications.length > 0 ||
    workflowArtifacts.length > 0
  const { statuses, activeStageId } = useMemo(
    () => derivePathwayStatus(artifacts),
    [artifacts],
  )
  const stageGroups = useMemo(() => groupArtifactsByStage(artifacts), [artifacts])
  const unstaged = useMemo(() => unstagedArtifacts(artifacts), [artifacts])
  const cdsCards = useMemo(
    () =>
      buildCdsCards({
        activeStageId,
        riskAlerts,
        isToolEnabled,
        recommendedNextStep: populationPatient?.recommendedNextStep ?? null,
        isSmartConnected,
      }),
    [activeStageId, riskAlerts, isToolEnabled, populationPatient, isSmartConnected],
  )

  return (
    <div className="patient-chart">
      <PageHeader eyebrow="Patient View" title="Patient Chart" />

      {dataSourceError && (
        <div className="chart-data-error" role="alert">
          <strong>EHR data error.</strong>
          <p>{dataSourceError}</p>
        </div>
      )}

      {isSliceLoading && (
        <div className="chart-loading-banner" role="status" aria-live="polite">
          Loading chart data from the connected EHR…
        </div>
      )}

      {!hasData && !isSliceLoading && !dataSourceError && (
        <div className="empty-chart-banner">
          <strong>This chart is empty.</strong>
          <p>
            {isSmartConnected
              ? 'No SPiER artifacts on the connected EHR for this patient yet. Launch an assessment from the recommendation below to write one back.'
              : activePatientId === null
                ? 'Launch an assessment from the recommendation below to try the forms, or pick a patient from the Population view.'
                : 'No artifacts yet for this patient. Launch an assessment from the recommendation below to populate the chart.'}
          </p>
        </div>
      )}

      <PatientPathway
        stageGroups={stageGroups}
        statuses={statuses}
        cards={cdsCards}
        isToolEnabled={isToolEnabled}
      />

      <OtherActivitySection
        responses={unstaged.responses}
        carePlans={unstaged.carePlans}
        observations={unstaged.observations}
        communications={unstaged.communications}
        workflowArtifacts={unstaged.workflowArtifacts}
      />

      <EpisodeRecordView
        episodes={episodes}
        encounters={encounters}
        responses={responses}
        observations={observations}
        carePlans={carePlans}
        communications={communications}
        serviceRequests={serviceRequests}
        procedures={procedures}
        documentReferences={documentReferences}
        appointments={appointments}
        consents={consents}
      />

      <EncountersTimeline walkthrough={walkthrough} refIndex={walkthroughRefIndex} />

      <PatientDocuments responses={responses} carePlans={carePlans} observations={observations} />
    </div>
  )
}
