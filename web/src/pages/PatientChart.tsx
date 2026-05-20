import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import { STAGES, TOOLS, stageById, type Tool } from '../data/catalog'
import {
  derivePathwayStatus,
  groupArtifactsByStage,
  stageForResponseName,
  type StageStatus,
} from '../lib/patientPathway'
import type { RiskAlert } from '../lib/observationMappers'
import '../css/Dashboard.css'
import '../css/PatientChart.css'

/* ---------- Mock encounter data (until real FHIR Encounter resources flow in) ---------- */
interface MockEncounter {
  id: string
  date: string
  type: string
  provider: string
  location: string
  status: 'completed' | 'scheduled'
  notes: string
  relatedResponseNames: string[]
  relatedCarePlanIdPatterns: RegExp[]
}

const MOCK_ENCOUNTERS: MockEncounter[] = [
  {
    id: 'enc-001',
    date: '2026-03-15',
    type: 'Initial Assessment',
    provider: 'Dr. Sarah Chen',
    location: 'Outpatient Behavioral Health',
    status: 'completed',
    notes: 'Initial suicide risk assessment. PHQ-9 administered. C-SSRS screening positive. Safety plan initiated.',
    relatedResponseNames: ['PHQ-9', 'ASQ Screening'],
    relatedCarePlanIdPatterns: [],
  },
  {
    id: 'enc-002',
    date: '2026-03-17',
    type: 'Safety Planning Session',
    provider: 'Dr. Sarah Chen',
    location: 'Outpatient Behavioral Health',
    status: 'completed',
    notes: 'Stanley-Brown Safety Plan completed collaboratively. Lethal means counseling provided. Follow-up scheduled.',
    relatedResponseNames: ['Stanley-Brown Safety Plan', 'CAMS SSF-5: Section A'],
    relatedCarePlanIdPatterns: [/stanley-brown/i, /cams-stabilization/i],
  },
  {
    id: 'enc-003',
    date: '2026-03-24',
    type: 'Follow-up Visit',
    provider: 'Dr. Sarah Chen',
    location: 'Outpatient Behavioral Health',
    status: 'scheduled',
    notes: 'Scheduled follow-up. CAMS Therapeutic Worksheet planned. Re-assess safety plan.',
    relatedResponseNames: [] as string[],
    relatedCarePlanIdPatterns: [] as RegExp[],
  },
]

const RISK_LEVEL_LABEL: Record<string, string> = {
  acute: 'ACUTE',
  high: 'HIGH',
  moderate: 'MODERATE',
  low: 'LOW',
  none: 'NONE',
}

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

function readSectionAnchor(): string {
  const raw = window.location.hash
  const stripped = raw.startsWith('#') ? raw.slice(1) : raw
  const second = stripped.indexOf('#')
  return second >= 0 ? stripped.slice(second + 1) : ''
}

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
}

function buildCdsCards(
  activeStageId: string | null,
  riskAlerts: RiskAlert[],
  isToolEnabled: (id: string) => boolean,
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
    // Highest-severity risk alert drives the urgency
    const topAlert = [...riskAlerts].sort((a, b) => {
      const order = { acute: 0, high: 1, moderate: 2, low: 3, none: 4 } as Record<string, number>
      return (order[a.level] ?? 9) - (order[b.level] ?? 9)
    })[0]
    const level: CdsCard['level'] =
      topAlert?.level === 'acute' || topAlert?.level === 'high' ? 'urgent'
      : topAlert?.level === 'moderate' ? 'recommended'
      : 'routine'

    cards.push({
      id: `cds-stage-${activeStageId}`,
      stageId: activeStageId,
      level,
      title: `Next step: ${stage?.title ?? activeStageId}`,
      rationale: STAGE_BLURB[activeStageId] ?? stage?.description ?? '',
      options,
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
              ) : (
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
function StageActivitySection({
  stageId,
  status,
  responses,
  carePlans,
}: {
  stageId: string
  status: StageStatus
  responses: any[]
  carePlans: any[]
}) {
  const stage = stageById(stageId)
  const empty = responses.length === 0 && carePlans.length === 0
  if (empty && status === 'not-started') return null

  return (
    <section
      id={`stage-${stageId}`}
      className={`stage-section stage-section--${status}`}
      aria-label={`${stage?.title} stage`}
    >
      <header className="stage-section-header">
        <h4 className="stage-section-title">{stage?.title}</h4>
        <span className={`stage-section-status stage-section-status--${status}`}>
          {status === 'complete' ? 'Complete' : status === 'active' ? 'Active' : 'Not started'}
        </span>
      </header>
      <p className="stage-section-desc">{stage?.description}</p>

      {empty ? (
        <p className="stage-section-empty">No activity at this stage yet.</p>
      ) : (
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
        </div>
      )}
    </section>
  )
}

/* ---------- Encounters timeline with inline drill-in ---------- */
function EncountersTimeline({ responses, carePlans }: { responses: any[]; carePlans: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section id="encounters" className="encounters-timeline-section">
      <header className="chart-section-header">
        <h3 className="chart-section-title">Encounters</h3>
        <span className="chart-section-count">{MOCK_ENCOUNTERS.length} encounters</span>
      </header>
      <p className="encounters-note">
        Mock encounter data. In production these would be linked FHIR Encounter resources with references back to the artifacts captured during each visit.
      </p>
      <ol className="encounters-list">
        {MOCK_ENCOUNTERS.map(enc => {
          const relatedResponses = responses.filter(r => enc.relatedResponseNames.includes(r.questionnaireName))
          const relatedCarePlans = carePlans.filter((cp: any) =>
            enc.relatedCarePlanIdPatterns.some(p => cp.id && p.test(cp.id))
          )
          const isExpanded = expandedId === enc.id
          return (
            <li key={enc.id} className={`encounter-row encounter-row--${enc.status}`}>
              <button
                type="button"
                className="encounter-row-header"
                onClick={() => setExpandedId(isExpanded ? null : enc.id)}
                aria-expanded={isExpanded}
              >
                <span className="encounter-row-date">
                  {new Date(enc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="encounter-row-type">{enc.type}</span>
                <span className={`encounter-row-status encounter-row-status--${enc.status}`}>{enc.status}</span>
                <span className="encounter-row-toggle">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="encounter-row-body">
                  <div className="encounter-row-meta">
                    <span>{enc.provider}</span>
                    <span className="encounter-card-divider">&middot;</span>
                    <span>{enc.location}</span>
                  </div>
                  <p className="encounter-row-notes">{enc.notes}</p>
                  {(relatedResponses.length > 0 || relatedCarePlans.length > 0) && (
                    <div className="encounter-related">
                      <h5 className="encounter-related-title">Documented at this encounter</h5>
                      <ul className="encounter-related-list">
                        {relatedResponses.map(r => (
                          <li key={r.id}>
                            <strong>{r.questionnaireName}</strong>
                            <span className="encounter-related-meta"> &middot; QuestionnaireResponse</span>
                          </li>
                        ))}
                        {relatedCarePlans.map((cp: any, idx: number) => (
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
        stageTag: stageForResponseName(r.questionnaireName),
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
  const { carePlans, responses, riskAlerts, observations, loadDemoScenario, clearDemoData } = usePatient()
  const { isToolEnabled } = useToolConfig()

  const hasData = responses.length > 0 || carePlans.length > 0
  const { statuses, activeStageId } = useMemo(
    () => derivePathwayStatus(responses, carePlans),
    [responses, carePlans],
  )
  const stageGroups = useMemo(() => groupArtifactsByStage(responses, carePlans), [responses, carePlans])
  const cdsCards = useMemo(
    () => buildCdsCards(activeStageId, riskAlerts, isToolEnabled),
    [activeStageId, riskAlerts, isToolEnabled],
  )

  const jumpTo = useCallback((anchor: string) => {
    history.replaceState(null, '', `#/patient/chart#${anchor}`)
    scrollToAnchor(anchor)
  }, [])

  // Disable the browser's automatic scroll restoration so our anchor scroll
  // isn't immediately overridden when the page mounts with a hash. Use
  // useLayoutEffect so the scroll runs synchronously after DOM mutation but
  // before paint, removing the need for a magic-number setTimeout.
  useLayoutEffect(() => {
    const prev = history.scrollRestoration
    if (prev !== undefined) history.scrollRestoration = 'manual'
    scrollToAnchor(readSectionAnchor())
    return () => {
      if (prev !== undefined) history.scrollRestoration = prev
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => scrollToAnchor(readSectionAnchor())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const activeAlerts = riskAlerts.filter(a => a.level !== 'none')
  const highestLevel = activeAlerts.length > 0
    ? (['acute', 'high', 'moderate', 'low'] as const).find(l => activeAlerts.some(a => a.level === l)) || 'none'
    : null

  return (
    <div className="patient-chart">
      <header className="patient-chart-titlebar">
        <h2 className="patient-chart-title">Patient Chart</h2>
        {highestLevel && (
          <span className={`risk-summary risk-summary--${highestLevel}`}>
            {RISK_LEVEL_LABEL[highestLevel]} risk
          </span>
        )}
        {hasData ? (
          <button className="patient-chart-reset" onClick={clearDemoData}>Reset demo data</button>
        ) : (
          <button className="patient-chart-reset" onClick={loadDemoScenario}>Load demo scenario</button>
        )}
      </header>

      {!hasData && (
        <div className="empty-chart-banner">
          <strong>This chart is empty.</strong>
          <p>
            Click <em>Load demo scenario</em> to populate with a PHQ-9 + ASQ + CAMS + Stanley-Brown
            sequence, or use the recommendations below to start fresh.
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
            />
          ))}
        </div>
      </section>

      <EncountersTimeline responses={responses} carePlans={carePlans} />

      <PatientDocuments responses={responses} carePlans={carePlans} observations={observations} />
    </div>
  )
}
