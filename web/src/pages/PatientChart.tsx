import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import { STAGES, stageById } from '../data/catalog'
import {
  derivePathwayStatus,
  groupArtifactsByStage,
  unstagedArtifacts,
  stageForResponse,
  type StageStatus,
  type FhirResourceLike,
  type StoredResponseLike,
} from '../lib/patientPathway'
import { buildCdsCards, type Card, type CdsIndicator } from '../lib/cdsHooks'
import type { CarePlanResource, CodeableConcept, ScenarioEncounter, StoredResponse } from '../types/fhir'

// The chart renders stored FHIR resources that arrive (via patientPathway) as
// loose FhirResourceLike — typed only for stage resolution. This is the set of
// extra fields the rendering reads off them; `_savedAt` is SPiER's client-side
// capture stamp (demo only, no server persistence).
interface RenderableResource {
  id?: string
  status?: string
  code?: CodeableConcept
  effectiveDateTime?: string
  valueInteger?: number
  valueQuantity?: { value?: number }
  reasonCode?: CodeableConcept[]
  category?: CodeableConcept[]
  sent?: string
  _savedAt?: string
}
import '../css/Dashboard.css'
import '../css/PatientChart.css'

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
// The chart's "Recommendations" are real CDS Hooks 2.0 Cards, built by the
// shared, React-free builder in lib/cdsHooks. This UI renders those Card objects
// and exposes the raw wire payload via a per-card JSON toggle.

// CDS indicator → clinician-facing pill label and BEM modifier.
const INDICATOR_LABEL: Record<CdsIndicator, string> = {
  critical: 'Urgent',
  warning: 'Recommended',
  info: 'Routine',
}

function CdsCardView({ card }: { card: Card }) {
  const ext = card.extension
  const stageId = ext?.['spier-stage-id']
  const stage = stageId ? stageById(stageId) : undefined
  const narrativeOnly = ext?.['spier-narrative-only'] === true
  const routerPaths = ext?.['spier-router-paths'] ?? {}
  const links = card.links ?? []
  return (
    <article className={`cds-card cds-card--${card.indicator}`}>
      <header className="cds-card-header">
        <span className={`cds-card-pill cds-card-pill--${card.indicator}`}>
          {INDICATOR_LABEL[card.indicator]}
        </span>
        {stage && <span className="cds-card-stage-tag">{stage.title}</span>}
      </header>
      <h4 className="cds-card-title">{card.summary}</h4>
      {card.detail && <p className="cds-card-rationale">{card.detail}</p>}
      {links.length > 0 ? (
        <div className="cds-card-actions">
          {links.map(link => {
            // Deep links carry an in-app router path in the extension so the SPA
            // can navigate client-side; fall back to the absolute url otherwise.
            const to = routerPaths[link.url]
            return to ? (
              <Link key={link.url} to={to} className="cds-card-action-btn">
                {link.label}
              </Link>
            ) : (
              <a
                key={link.url}
                href={link.url}
                className="cds-card-action-btn"
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            )
          })}
        </div>
      ) : narrativeOnly ? null : (
        <p className="cds-card-no-options">
          No tools enabled for this stage in your implementation.{' '}
          <Link to="/guide/tool-configuration">Configure tools</Link>.
        </p>
      )}
      <div className="cds-card-json">
        <FhirJsonViewer data={card} title="View CDS Hooks card JSON" />
      </div>
    </article>
  )
}

function CdsCardStack({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null
  return (
    <section id="recommendations" className="cds-stack">
      <header className="cds-stack-header">
        <h3 className="cds-stack-title">Recommendations</h3>
        <span className="cds-stack-subtitle">
          Generated from this patient's pathway state &middot; real CDS Hooks 2.0 cards
        </span>
      </header>
      <div className="cds-stack-list">
        {cards.map(card => (
          <CdsCardView key={card.extension?.['spier-card-id'] ?? card.uuid} card={card} />
        ))}
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

// CarePlan display name: the resource's own title when present (scenario and
// foreign-EHR plans carry one), else the legacy id-convention fallbacks for
// tool-emitted plans that predate titles.
function carePlanDisplayName(cp: RenderableResource & { title?: unknown }): string {
  if (typeof cp.title === 'string' && cp.title) return cp.title
  if (cp.id?.includes('stanley-brown')) return 'Stanley-Brown Safety Plan'
  if (cp.id?.includes('cams-stabilization')) return 'CAMS Stabilization Plan'
  if (cp.id?.includes('cams-therapeutic')) return 'CAMS Therapeutic Worksheet'
  return 'Care plan'
}

/** The four artifact-card lists shared by stage sections and the unstaged
 *  "Other activity" bucket. */
function ArtifactCards({
  responses,
  carePlans,
  observations,
  communications,
}: {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
}) {
  return (
    <div className="stage-section-artifacts">
      {responses.map(rawR => {
        const r = rawR as StoredResponse
        return (
        <div key={r.id} className="stage-artifact stage-artifact--response">
          <span className="stage-artifact-icon" aria-hidden>{'\u{1F4DD}'}</span>
          <div className="stage-artifact-body">
            <span className="stage-artifact-name">{r.questionnaireName}</span>
            <span className="stage-artifact-meta">QuestionnaireResponse &middot; {formatDateTime(r.completedAt)}</span>
          </div>
        </div>
        )
      })}
      {carePlans.map((rawCp, idx) => {
        const cp = rawCp as RenderableResource
        const savedAt = cp._savedAt ? new Date(cp._savedAt).toLocaleDateString() : null
        return (
          <div key={`${cp.id}-${idx}`} className="stage-artifact stage-artifact--careplan">
            <span className="stage-artifact-icon" aria-hidden>{'\u{1F4CB}'}</span>
            <div className="stage-artifact-body">
              <span className="stage-artifact-name">{carePlanDisplayName(cp)}</span>
              <span className="stage-artifact-meta">
                CarePlan &middot; {cp.status ?? 'active'}
                {savedAt && ` · ${savedAt}`}
              </span>
            </div>
          </div>
        )
      })}
      {observations.map((rawObs, idx) => {
        const obs = rawObs as RenderableResource
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
      {communications.map((rawComm, idx) => {
        const c = rawComm as RenderableResource
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
  )
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
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
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
    .map(rawObs => {
      const o = rawObs as RenderableResource
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
        <ArtifactCards
          responses={responses}
          carePlans={carePlans}
          observations={observations}
          communications={communications}
        />
      ) : null}
    </section>
  )
}

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
}: {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
}) {
  const [open, setOpen] = useState(false)
  const count =
    responses.length + carePlans.length + observations.length + communications.length
  if (count === 0) return null
  return (
    <section
      id="stage-other"
      className="stage-section stage-section--other"
      aria-label="Other activity"
    >
      <header className="stage-section-header">
        <h4 className="stage-section-toggle-heading">
          <button
            type="button"
            className="stage-section-toggle"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
          >
            <span className="stage-section-toggle-main">
              <span className="stage-section-title">Other activity</span>
            </span>
            <span className="stage-section-toggle-aside">
              <span className="stage-section-status stage-section-status--other">
                {count} {count === 1 ? 'item' : 'items'}
              </span>
              <span className="stage-section-toggle-hint" aria-hidden>{open ? '▲' : '▼'}</span>
            </span>
          </button>
        </h4>
      </header>
      {open && (
        <>
          <p className="stage-section-desc">
            Captured resources that don't map to a SPiER pathway stage — for example, records
            written by other systems on a connected EHR.
          </p>
          <ArtifactCards
            responses={responses}
            carePlans={carePlans}
            observations={observations}
            communications={communications}
          />
        </>
      )}
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
                                <strong>{carePlanDisplayName(cp as RenderableResource)}</strong>
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
    activePatientId,
    populationPatient,
    isSmartConnected,
    encounters,
    isSliceLoading,
    dataSourceError,
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
              ? 'No SPiER artifacts on the connected EHR for this patient yet. Submit an assessment from the sidebar to write one back.'
              : activePatientId === null
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
          <OtherActivitySection
            responses={unstaged.responses}
            carePlans={unstaged.carePlans}
            observations={unstaged.observations}
            communications={unstaged.communications}
          />
        </div>
      </section>

      <EncountersTimeline encounters={encounters} responses={responses} carePlans={carePlans} />

      <PatientDocuments responses={responses} carePlans={carePlans} observations={observations} />
    </div>
  )
}
