import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import type { PopulationPatient } from '../context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import { STAGES, TOOLS, stageById, type Tool } from '../data/catalog'
import {
  derivePathwayStatus,
  groupArtifactsByStage,
  stageForResponse,
  type StageStatus,
} from '../lib/patientPathway'
import type { RiskAlert } from '../lib/observationMappers'
import type { CarePlanResource, ScenarioEncounter, StoredResponse } from '../types/fhir'
import '../css/Dashboard.css'
import '../css/PatientChart.css'

const STAGE_BLURB: Record<string, string> = {
  'flag-risk': 'Administer a suicide-risk screen to flag whether further review is needed.',
  'clarify-risk': 'Positive screen — clarify the nature, severity, and context of suicide risk.',
  'set-risk-status': 'Document the current risk status and the clinical reasoning that guides next steps.',
  'document-safety-actions': 'Document concrete actions to reduce risk: safety plan, means counseling.',
  'coordinate-handoffs': 'Transfer suicide-safety information and responsibility across settings.',
  'track-follow-up': 'Track caring contacts and follow-up steps after the immediate encounter.',
  'manage-active-risk': 'Keep the active suicide-safer care episode visible and escalated when needed.',
  'measure-and-share': 'Use pathway activity for reporting, QI, and information sharing.',
}

/* ---------- Helpers ---------- */

// Sortable sentinel for FHIR resources missing an authoritative timestamp.
// Keeps date-driven memos deterministic and pushes undated rows to the bottom
// when sorting newest-first.
const UNDATED_SENTINEL = '1970-01-01T00:00:00.000Z'

function scrollToAnchor(anchor: string) {
  if (!anchor) return
  const el = document.getElementById(anchor)
  if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/* ---------- Pathway tracker ---------- */
function PathwayTracker({ statuses, onJump }: {
  statuses: Record<string, StageStatus>
  onJump: (stageId: string) => void
}) {
  return (
    <nav className="pathway-tracker" aria-label="Suicide-safer care pathway">
      <ol className="pathway-tracker-list">
        {STAGES.map((stage, idx) => {
          const status = statuses[stage.id]
          return (
            <li key={stage.id} className={`pathway-step pathway-step--${status}`}>
              <button
                type="button"
                className="pathway-step-btn"
                onClick={() => onJump(`stage-${stage.id}`)}
                title={stage.description}
              >
                <span className="pathway-step-index">
                  {status === 'complete' ? '✓' : idx + 1}
                </span>
                <span className="pathway-step-label">{stage.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ---------- CDS recommendation cards ---------- */
interface CdsCard {
  id: string
  stageId: string
  level: 'urgent' | 'recommended' | 'routine'
  title: string
  rationale: string
  options: { tool: Tool; action: { label: string; path: string } }[]
  // When true, suppress the "no tools enabled" fallback because the
  // title/rationale already convey a curated next-step recommendation.
  narrativeOnly?: boolean
}

function buildCdsCards(
  activeStageId: string | null,
  riskAlerts: RiskAlert[],
  isToolEnabled: (id: string) => boolean,
  populationPatient: PopulationPatient | null,
  isSmartConnected: boolean,
): CdsCard[] {
  const cards: CdsCard[] = []

  // Card #1: based on the active pathway stage
  if (activeStageId) {
    const stage = stageById(activeStageId)
    const stageTools = TOOLS.filter(t => t.stageId === activeStageId && t.launchActions.length > 0)
    const options = stageTools.flatMap(tool =>
      tool.launchActions
        .filter(() => isToolEnabled(tool.id))
        .map(action => ({ tool, action })),
    )
    // Highest-severity risk alert drives the urgency. When no live alert
    // exists, fall back to the population patient's curated currentRiskLevel
    // so curated next-step cards keep accurate urgency styling. SMART
    // suppresses the fallback since a connected EHR's real chart is
    // authoritative.
    const topAlert = [...riskAlerts].sort((a, b) => {
      const order = { acute: 0, high: 1, moderate: 2, low: 3, none: 4 } as Record<string, number>
      return (order[a.level] ?? 9) - (order[b.level] ?? 9)
    })[0]
    const populationLevel = !isSmartConnected ? populationPatient?.currentRiskLevel : null
    const effectiveLevel =
      topAlert?.level && topAlert.level !== 'none'
        ? topAlert.level
        : populationLevel && populationLevel !== 'none'
          ? populationLevel
          : null
    const level: CdsCard['level'] =
      effectiveLevel === 'acute' || effectiveLevel === 'high' ? 'urgent'
      : effectiveLevel === 'moderate' ? 'recommended'
      : 'routine'

    // Population-patient recommendedNextStep substitution: when no tools are
    // wired for the active stage and the patient's curated recommendation
    // targets that same stage, swap in the recommendation's label/rationale.
    // Suppressed under SMART so a connected EHR's real chart isn't overwritten
    // by demo population data.
    const recommended = populationPatient?.recommendedNextStep
    const useRecommendation =
      options.length === 0 &&
      !isSmartConnected &&
      recommended != null &&
      recommended.stageId === activeStageId

    cards.push({
      id: `cds-stage-${activeStageId}`,
      stageId: activeStageId,
      level,
      title: useRecommendation && recommended
        ? recommended.label
        : `Next step: ${stage?.title ?? activeStageId}`,
      rationale: useRecommendation && recommended
        ? recommended.rationale
        : STAGE_BLURB[activeStageId] ?? stage?.description ?? '',
      options,
      narrativeOnly: useRecommendation,
    })
  }

  // Card #2..n: any tool-suggested actions from risk alerts whose target isn't already covered
  const seenPaths = new Set(cards.flatMap(c => c.options.map(o => o.action.path)))
  for (const alert of riskAlerts) {
    if (!alert.suggestedAction || alert.level === 'none') continue
    if (seenPaths.has(alert.suggestedAction.path)) continue
    // Find the tool by path
    const tool = TOOLS.find(t => t.launchActions.some(a => a.path === alert.suggestedAction!.path))
    if (!tool || !isToolEnabled(tool.id)) continue
    cards.push({
      id: `cds-alert-${alert.tool}`,
      stageId: tool.stageId,
      level: alert.level === 'acute' || alert.level === 'high' ? 'urgent' : 'recommended',
      title: alert.suggestedAction.label,
      rationale: alert.detail,
      options: [{ tool, action: { label: alert.suggestedAction.label, path: alert.suggestedAction.path } }],
    })
    seenPaths.add(alert.suggestedAction.path)
  }

  return cards
}

function CdsCardStack({ cards }: { cards: CdsCard[] }) {
  if (cards.length === 0) return null
  return (
    <section id="recommendations" className="cds-stack">
      <header className="cds-stack-header">
        <h3 className="cds-stack-title">Recommendations</h3>
        <span className="cds-stack-subtitle">
          Generated from this patient's pathway state &middot; mirrors CDS Hooks card behavior
        </span>
      </header>
      <div className="cds-stack-list">
        {cards.map(card => {
          const stage = stageById(card.stageId)
          return (
            <article key={card.id} className={`cds-card cds-card--${card.level}`}>
              <header className="cds-card-header">
                <span className={`cds-card-pill cds-card-pill--${card.level}`}>
                  {card.level === 'urgent' ? 'Urgent' : card.level === 'recommended' ? 'Recommended' : 'Routine'}
                </span>
                {stage && <span className="cds-card-stage-tag">{stage.title}</span>}
              </header>
              <h4 className="cds-card-title">{card.title}</h4>
              <p className="cds-card-rationale">{card.rationale}</p>
              {card.options.length > 0 ? (
                <div className="cds-card-actions">
                  {card.options.map(({ tool, action }) => (
                    <Link key={action.path} to={action.path} className="cds-card-action-btn">
                      {tool.launchActions.length > 1 ? `${tool.shortName ?? tool.name}: ${action.label}` : action.label}
                    </Link>
                  ))}
                </div>
              ) : card.narrativeOnly ? null : (
                <p className="cds-card-no-options">
                  No tools enabled for this stage in your implementation.{' '}
                  <Link to="/implementation-guide/tool-configuration">Configure tools</Link>.
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- Stage-grouped activity ---------- */
// Short labels for the per-stage score chip — full LOINC/SNOMED display names
// are too long to read inline.
const SCORE_CHIP_LABELS: Record<string, string> = {
  '44261-6': 'PHQ-9 total',
  '44260-8': 'PHQ-9 item 9',
  '225337009': 'SBQ-R total',
}

function StageActivitySection({
  stageId,
  status,
  responses,
  carePlans,
  observations,
  communications,
}: {
  stageId: string
  status: StageStatus
  responses: any[]
  carePlans: any[]
  observations: any[]
  communications: any[]
}) {
  const stage = stageById(stageId)
  const [open, setOpen] = useState(false)
  const empty =
    responses.length === 0 &&
    carePlans.length === 0 &&
    observations.length === 0 &&
    communications.length === 0

  // Future stages (always empty, since any artifact would mark the stage complete)
  // render as a faded, read-only roadmap row so the full 8-stage journey stays visible.
  if (status === 'not-started') {
    return (
      <section
        id={`stage-${stageId}`}
        className="stage-section stage-section--not-started"
        aria-label={`${stage?.title} stage`}
      >
        <header className="stage-section-header">
          <h4 className="stage-section-title">{stage?.title}</h4>
          <span className="stage-section-status stage-section-status--not-started">Not started</span>
        </header>
        <p className="stage-section-desc">{stage?.description}</p>
      </section>
    )
  }

  // Completed stages with activity collapse to a one-line summary that expands on click.
  const collapsible = status === 'complete' && !empty
  const showArtifacts = !empty && (!collapsible || open)
  const showDesc = !collapsible || open

  // Surface the clinical score(s) for this stage from its Observations, e.g. "PHQ-9: 14".
  // Read straight off the persisted resource value; omit when no scored observation exists.
  const scoreSummary = observations
    .map(o => {
      const value = o.valueInteger ?? o.valueQuantity?.value
      if (value === undefined || value === null) return null
      // Full LOINC display names are long and clutter the chip — prefer a short
      // label for known scored codes, falling back to the resource's own text.
      const code = o.code?.coding?.[0]?.code
      const label =
        (code && SCORE_CHIP_LABELS[code]) || o.code?.text || o.code?.coding?.[0]?.display || 'Score'
      return `${label}: ${value}`
    })
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      id={`stage-${stageId}`}
      className={`stage-section stage-section--${status}`}
      aria-label={`${stage?.title} stage`}
    >
      <header className="stage-section-header">
        {collapsible ? (
          // Accordion pattern: heading wraps the toggle button so the stage title
          // keeps its <h4> heading semantics while staying fully clickable.
          <h4 className="stage-section-toggle-heading">
            <button
              type="button"
              className="stage-section-toggle"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
            >
              <span className="stage-section-toggle-main">
                <span className="stage-section-title">{stage?.title}</span>
                {scoreSummary && <span className="stage-section-score">{scoreSummary}</span>}
              </span>
              <span className="stage-section-toggle-aside">
                <span className="stage-section-status stage-section-status--complete">Complete</span>
                <span className="stage-section-toggle-hint" aria-hidden>{open ? '▲' : '▼'}</span>
              </span>
            </button>
          </h4>
        ) : (
          <>
            <h4 className="stage-section-title">{stage?.title}</h4>
            <span className={`stage-section-status stage-section-status--${status}`}>
              {status === 'complete' ? 'Complete' : 'Active'}
            </span>
          </>
        )}
      </header>
      {showDesc && <p className="stage-section-desc">{stage?.description}</p>}

      {empty ? (
        <p className="stage-section-empty">No activity at this stage yet.</p>
      ) : showArtifacts ? (
        <div className="stage-section-artifacts">
          {responses.map(r => (
            <div key={r.id} className="stage-artifact stage-artifact--response">
              <span className="stage-artifact-icon" aria-hidden>{'\u{1F4DD}'}</span>
              <div className="stage-artifact-body">
                <span className="stage-artifact-name">{r.questionnaireName}</span>
                <span className="stage-artifact-meta">QuestionnaireResponse &middot; {formatDateTime(r.completedAt)}</span>
              </div>
            </div>
          ))}
          {carePlans.map((cp, idx) => {
            const source = cp.id?.includes('stanley-brown') ? 'Stanley-Brown Safety Plan' : 'CAMS Stabilization Plan'
            const savedAt = cp._savedAt ? new Date(cp._savedAt).toLocaleDateString() : null
            return (
              <div key={`${cp.id}-${idx}`} className="stage-artifact stage-artifact--careplan">
                <span className="stage-artifact-icon" aria-hidden>{'\u{1F4CB}'}</span>
                <div className="stage-artifact-body">
                  <span className="stage-artifact-name">{source}</span>
                  <span className="stage-artifact-meta">
                    CarePlan &middot; {cp.status ?? 'active'}
                    {savedAt && ` · ${savedAt}`}
                  </span>
                </div>
              </div>
            )
          })}
          {observations.map((obs, idx) => {
            const name = obs.code?.text || obs.code?.coding?.[0]?.display || 'Observation'
            const when = obs.effectiveDateTime ?? obs._savedAt
            return (
              <div key={obs.id ?? `obs-${idx}`} className="stage-artifact stage-artifact--observation">
                <span className="stage-artifact-icon" aria-hidden>{'\u{1F4CA}'}</span>
                <div className="stage-artifact-body">
                  <span className="stage-artifact-name">{name}</span>
                  <span className="stage-artifact-meta">
                    Observation
                    {when && ` · ${new Date(when).toLocaleDateString()}`}
                  </span>
                </div>
              </div>
            )
          })}
          {communications.map((c, idx) => {
            const name =
              c.reasonCode?.[0]?.text ||
              c.category?.[0]?.text ||
              c.category?.[0]?.coding?.[0]?.display ||
              'Communication'
            const when = c.sent ?? c._savedAt
            return (
              <div key={c.id ?? `comm-${idx}`} className="stage-artifact stage-artifact--communication">
                <span className="stage-artifact-icon" aria-hidden>{'\u{1F4DE}'}</span>
                <div className="stage-artifact-body">
                  <span className="stage-artifact-name">{name}</span>
                  <span className="stage-artifact-meta">
                    Communication &middot; {c.status ?? 'completed'}
                    {when && ` · ${new Date(when).toLocaleDateString()}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

/* ---------- Encounters / scenario-walkthrough timeline with inline drill-in ---------- */
function EncountersTimeline({
  encounters,
  responses,
  carePlans,
}: {
  encounters: ScenarioEncounter[]
  responses: StoredResponse[]
  carePlans: CarePlanResource[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section id="encounters" className="encounters-timeline-section">
      <header className="chart-section-header">
        <h3 className="chart-section-title">Encounters</h3>
        <span className="chart-section-count">
          {encounters.length} {encounters.length === 1 ? 'step' : 'steps'}
        </span>
      </header>
      {encounters.length === 0 ? (
        <p className="encounters-note">No encounters recorded for this patient yet.</p>
      ) : (
        <>
          <p className="encounters-note">
            Scenario walkthrough — each step links to the FHIR artifact it produces. Steps
            marked <em>profile gap</em> map to resource types that don't yet have a SPiER
            profile (tracked in issue&nbsp;#52).
          </p>
          <ol className="encounters-list">
            {encounters.map(enc => {
              const relatedResponses = responses.filter(r =>
                (enc.relatedResponseNames ?? []).includes(r.questionnaireName),
              )
              const relatedCarePlans = carePlans.filter(cp =>
                (enc.relatedCarePlanIdSubstrings ?? []).some(
                  sub => cp.id && cp.id.includes(sub),
                ),
              )
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
                      </div>
                      <p className="encounter-row-notes">{enc.notes}</p>
                      {enc.fhirArtifacts && enc.fhirArtifacts.length > 0 && (
                        <div className="encounter-artifacts">
                          {enc.fhirArtifacts.map(a => (
                            <span key={a} className="encounter-artifact-chip">{a}</span>
                          ))}
                        </div>
                      )}
                      {(relatedResponses.length > 0 || relatedCarePlans.length > 0) && (
                        <div className="encounter-related">
                          <h5 className="encounter-related-title">Captured in this patient's chart</h5>
                          <ul className="encounter-related-list">
                            {relatedResponses.map(r => (
                              <li key={r.id}>
                                <strong>{r.questionnaireName}</strong>
                                <span className="encounter-related-meta"> &middot; QuestionnaireResponse</span>
                              </li>
                            ))}
                            {relatedCarePlans.map((cp, idx) => (
                              <li key={`${cp.id}-${idx}`}>
                                <strong>{cp.id?.includes('stanley-brown') ? 'Stanley-Brown Safety Plan' : 'CAMS Stabilization Plan'}</strong>
                                <span className="encounter-related-meta"> &middot; CarePlan</span>
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
  responses: any[]
  carePlans: any[]
  observations: any[]
}) {
  const [filter, setFilter] = useState<DocFilter>('all')
  const [openDoc, setOpenDoc] = useState<string | null>(null)

  type DocEntry =
    | { kind: 'response'; key: string; title: string; when: string; resource: any; stageTag?: string }
    | { kind: 'careplan'; key: string; title: string; when: string; resource: any; stageTag?: string }
    | { kind: 'observation'; key: string; title: string; when: string; resource: any; stageTag?: string }

  const docs: DocEntry[] = useMemo(() => {
    const all: DocEntry[] = []
    for (const r of responses) {
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
      all.push({
        kind: 'careplan',
        key: cp.id ?? `cp-${all.length}`,
        title: cp.id?.includes('stanley-brown') ? 'Stanley-Brown Safety Plan' : 'CAMS Stabilization Plan',
        // Stable sentinel so this useMemo stays deterministic across recomputes
        // when an artifact is missing its timestamp. Undated entries sort to the bottom.
        when: cp._savedAt ?? UNDATED_SENTINEL,
        resource: cp,
      })
    }
    for (const obs of observations) {
      all.push({
        kind: 'observation',
        key: obs.id ?? `obs-${all.length}`,
        title: obs.code?.text || obs.code?.coding?.[0]?.display || 'Observation',
        when: obs.effectiveDateTime ?? UNDATED_SENTINEL,
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
    activePatientId,
    populationPatient,
    isSmartConnected,
    encounters,
  } = usePatient()
  const { isToolEnabled } = useToolConfig()
  const location = useLocation()

  const artifacts = useMemo(
    () => ({ responses, carePlans, observations, communications }),
    [responses, carePlans, observations, communications],
  )
  const hasData =
    responses.length > 0 ||
    carePlans.length > 0 ||
    observations.length > 0 ||
    communications.length > 0
  const { statuses, activeStageId } = useMemo(
    () => derivePathwayStatus(artifacts),
    [artifacts],
  )
  const stageGroups = useMemo(() => groupArtifactsByStage(artifacts), [artifacts])
  const cdsCards = useMemo(
    () => buildCdsCards(activeStageId, riskAlerts, isToolEnabled, populationPatient, isSmartConnected),
    [activeStageId, riskAlerts, isToolEnabled, populationPatient, isSmartConnected],
  )

  const jumpTo = useCallback((anchor: string) => {
    history.replaceState(null, '', `#/patient/chart#${anchor}`)
    scrollToAnchor(anchor)
  }, [])

  // Disable the browser's automatic scroll restoration so our anchor scroll
  // isn't immediately overridden when the page mounts with a hash.
  useLayoutEffect(() => {
    const prev = history.scrollRestoration
    if (prev !== undefined) history.scrollRestoration = 'manual'
    return () => {
      if (prev !== undefined) history.scrollRestoration = prev
    }
  }, [])

  // Scroll on initial mount and whenever the router-tracked hash changes
  // (sidebar Link clicks, browser back/forward). useLayoutEffect runs
  // synchronously after DOM mutation but before paint.
  useLayoutEffect(() => {
    const anchor = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
    scrollToAnchor(anchor)
  }, [location.hash])

  return (
    <div className="patient-chart">
      <header className="patient-chart-titlebar">
        <h2 className="patient-chart-title">Patient Chart</h2>
      </header>

      {!hasData && (
        <div className="empty-chart-banner">
          <strong>This chart is empty.</strong>
          <p>
            {activePatientId === null
              ? 'Use the assessment forms in the sidebar to try them, or pick a patient from the Population view.'
              : 'No artifacts yet for this patient. Submit an assessment from the sidebar to populate the chart.'}
          </p>
        </div>
      )}

      <PathwayTracker statuses={statuses} onJump={jumpTo} />

      <CdsCardStack cards={cdsCards} />

      <section id="activity" className="activity-section">
        <header className="chart-section-header">
          <h3 className="chart-section-title">Activity by pathway stage</h3>
          <span className="chart-section-count">
            {STAGES.filter(s => statuses[s.id] === 'complete').length} of {STAGES.length} stages with activity
          </span>
        </header>
        <div className="stage-sections">
          {stageGroups.map(group => (
            <StageActivitySection
              key={group.stageId}
              stageId={group.stageId}
              status={statuses[group.stageId]}
              responses={group.responses}
              carePlans={group.carePlans}
              observations={group.observations}
              communications={group.communications}
            />
          ))}
        </div>
      </section>

      <EncountersTimeline encounters={encounters} responses={responses} carePlans={carePlans} />

      <PatientDocuments responses={responses} carePlans={carePlans} observations={observations} />
    </div>
  )
}
