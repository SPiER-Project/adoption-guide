import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TOOLS, groupToolsByStage, type Licensing, type MaturityLevel, type Tool } from '../data/catalog'
import roadmapSnapshot from '../data/roadmap.generated.json'
import '../css/AdoptionReadiness.css'

// ─────────────────────────────────────────────────────────────
// Adoption Readiness matrix
// ------------------------------------------------------------
// One row per catalogued instrument, answering an adopter's three
// questions at a glance:
//   1. Where is it in the build lifecycle?  → build status (roadmap epics)
//   2. How strongly do we recommend it?     → inclusionStatus (core/optional/future)
//   3. How deeply does it integrate?        → targetMaturity (electronic / writeback / triggering)
// plus the adoption assets that exist to help (pilot plan, demo, tracking epic).
//
// Data is reused, not duplicated:
//   - TOOLS / targetMaturity / inclusionStatus / pilotPlanSlug  → catalog
//   - build status                                              → roadmap.generated.json (GitHub epics)
// ─────────────────────────────────────────────────────────────

interface RoadmapIssue {
  number: number
  url: string
  toolId?: string
  type?: 'epic' | 'task'
  status?: 'built' | 'planned' | 'future'
}

interface RoadmapSnapshot {
  repo: string
  issues: RoadmapIssue[]
}

const SNAPSHOT = roadmapSnapshot as RoadmapSnapshot

type BuildStatus = 'built' | 'planned' | 'future'

// Composite readiness tier, refining build status with the adoption assets
// that actually let a partner act on it. Order = most → least adoptable.
type ReadinessTier = 'pilot-ready' | 'built' | 'in-progress' | 'roadmap'

const READINESS_LABELS: Record<ReadinessTier, string> = {
  'pilot-ready': 'Pilot-ready',
  built: 'Built',
  'in-progress': 'In progress',
  roadmap: 'On roadmap',
}

const READINESS_BLURB: Record<ReadinessTier, string> = {
  'pilot-ready': 'Built and demoable, with a step-by-step pilot plan you can run with a partner today.',
  built: 'Implemented as FHIR artifacts and demoable in the Patient View; pilot plan not yet written.',
  'in-progress': 'Actively being built — tracked by an open epic, not yet ready to adopt.',
  roadmap: 'Catalogued and scoped, but scheduled for a later phase.',
}

const MATURITY_DIMENSIONS = [
  {
    key: 'electronic' as const,
    label: 'Electronic capture',
    description:
      'Is the instrument a structured electronic form (FHIR Questionnaire / QuestionnaireResponse) rather than scanned paper or free text?',
  },
  {
    key: 'writeback' as const,
    label: 'Discrete write-back',
    description:
      'Are the results written back as discrete, coded data (Observation / CarePlan / Condition) the chart and downstream systems can act on?',
  },
  {
    key: 'triggering' as const,
    label: 'Workflow triggering',
    description:
      'Does a result drive the next step automatically (CDS hooks, order sets, stage transitions) rather than relying on a human to notice?',
  },
] as const

const MATURITY_LEVEL_LABELS = ['None', 'Basic', 'Partial', 'Full'] as const

const LICENSING_LABELS: Record<Licensing, string> = {
  'public-domain': 'Public domain',
  registration: 'Registration',
  commercial: 'Commercial',
}

const LICENSING_BLURB: Record<Licensing, string> = {
  'public-domain': 'Free to use and embed without permission or fees (e.g. ASQ, PHQ-9, SBQ-R, BSSA). Attribution still good practice.',
  registration: 'Free but gated — requires registering with the instrument owner and accepting usage terms before deployment (e.g. C-SSRS).',
  commercial: 'Requires a paid license, training, or both from the instrument owner (e.g. CAMS). Confirm terms before deploying.',
}

interface ReadinessRow {
  tool: Tool
  buildStatus: BuildStatus
  tier: ReadinessTier
  epicUrl?: string
  /** Sum of the three target-maturity dimensions, 0–9. */
  depthScore: number
}

/** Build status for a tool: prefer its tracking epic, fall back to a launch-action heuristic. */
function buildStatusFor(tool: Tool, epicsByTool: Map<string, RoadmapIssue>): { status: BuildStatus; epicUrl?: string } {
  const epic = epicsByTool.get(tool.id)
  if (epic) return { status: (epic.status ?? 'planned') as BuildStatus, epicUrl: epic.url }
  return { status: tool.launchActions.length > 0 ? 'built' : 'planned' }
}

function readinessTier(tool: Tool, buildStatus: BuildStatus): ReadinessTier {
  if (buildStatus === 'built') return tool.pilotPlanSlug ? 'pilot-ready' : 'built'
  if (buildStatus === 'planned') return 'in-progress'
  return 'roadmap'
}

function MaturityChip({ level, dimension }: { level: MaturityLevel; dimension: string }) {
  return (
    <span
      className={`ar-mat-chip ar-mat-chip--${level}`}
      title={`${dimension}: ${level} — ${MATURITY_LEVEL_LABELS[level]}`}
      aria-label={`${dimension}: ${level} of 3, ${MATURITY_LEVEL_LABELS[level]}`}
    >
      {level}
    </span>
  )
}

export function AdoptionReadiness() {
  const { groups, stats } = useMemo(() => {
    // Index the single tracking epic per tool (matches Roadmap.tsx's epic-first rule).
    const epicsByTool = new Map<string, RoadmapIssue>()
    for (const issue of SNAPSHOT?.issues ?? []) {
      if (!issue.toolId) continue
      const existing = epicsByTool.get(issue.toolId)
      // Prefer an explicit epic; otherwise keep the first issue seen.
      if (!existing || (issue.type === 'epic' && existing.type !== 'epic')) {
        epicsByTool.set(issue.toolId, issue)
      }
    }

    const rowFor = (tool: Tool): ReadinessRow => {
      const { status, epicUrl } = buildStatusFor(tool, epicsByTool)
      const m = tool.targetMaturity
      return {
        tool,
        buildStatus: status,
        epicUrl,
        tier: readinessTier(tool, status),
        depthScore: m.electronic + m.writeback + m.triggering,
      }
    }

    const rowById = new Map(TOOLS.map((t) => [t.id, rowFor(t)]))
    const groups = groupToolsByStage(TOOLS, { skipEmpty: true }).map(({ stage, tools }) => ({
      stage,
      rows: tools.map((t) => rowById.get(t.id)).filter((r): r is ReadinessRow => !!r),
    }))

    const allRows = [...rowById.values()]
    const pilotReady = allRows.filter((r) => r.tier === 'pilot-ready').length
    const builtOrBetter = allRows.filter((r) => r.buildStatus === 'built').length
    const coreRows = allRows.filter((r) => r.tool.inclusionStatus === 'core')
    const coreBuilt = coreRows.filter((r) => r.buildStatus === 'built').length
    const depthSum = allRows.reduce((acc, r) => acc + r.depthScore, 0)
    const depthPct = allRows.length > 0 ? Math.round((depthSum / (allRows.length * 9)) * 100) : 0

    return {
      groups,
      stats: {
        total: allRows.length,
        pilotReady,
        builtOrBetter,
        builtPct: allRows.length > 0 ? Math.round((builtOrBetter / allRows.length) * 100) : 0,
        coreBuilt,
        coreTotal: coreRows.length,
        coreBuiltPct: coreRows.length > 0 ? Math.round((coreBuilt / coreRows.length) * 100) : 0,
        depthPct,
      },
    }
  }, [])

  return (
    <div className="adoption-readiness">
      <h2 className="page-title">Adoption Readiness</h2>
      <p className="ar-description">
        Every catalogued instrument, scored on how ready it is to adopt. For each tool: where it sits in
        the build lifecycle, how strongly SPiER recommends it, what its licensing requires, and how deeply
        its target design integrates into a workflow — captured electronically, written back as discrete
        data, and triggering the next step. This is the spec-side companion to the{' '}
        <Link to="/guide/adoption-rubric">EHR Adoption Rubric</Link>, where you score your
        own system.
      </p>

      {/* Summary */}
      <div className="ar-summary">
        <div className="ar-summary-stat">
          <span className="ar-summary-value">{stats.pilotReady}</span>
          <span className="ar-summary-label">Pilot-ready</span>
        </div>
        <div className="ar-summary-stat">
          <span className="ar-summary-value">{stats.builtOrBetter}/{stats.total}</span>
          <span className="ar-summary-label">Built</span>
        </div>
        <div className="ar-summary-bar-block">
          <div className="ar-summary-bar">
            <div className="ar-summary-fill ar-summary-fill--built" style={{ width: `${stats.builtPct}%` }} />
          </div>
          <span className="ar-summary-bar-caption">{stats.builtPct}% of the catalog built</span>
        </div>
        <div className="ar-summary-stat">
          <span className="ar-summary-value">{stats.coreBuilt}/{stats.coreTotal}</span>
          <span className="ar-summary-label">Core built</span>
        </div>
        <div className="ar-summary-bar-block">
          <div className="ar-summary-bar">
            <div className="ar-summary-fill ar-summary-fill--depth" style={{ width: `${stats.depthPct}%` }} />
          </div>
          <span className="ar-summary-bar-caption">{stats.depthPct}% avg target integration depth</span>
        </div>
      </div>

      {/* Legend */}
      <div className="ar-legend">
        <details className="ar-legend-block">
          <summary className="ar-legend-summary"><strong>Readiness tiers</strong> — build lifecycle + available adoption assets</summary>
          <div className="ar-legend-body">
            {(Object.keys(READINESS_LABELS) as ReadinessTier[]).map((tier) => (
              <div key={tier} className="ar-legend-row">
                <span className={`ar-tier ar-tier--${tier}`}>{READINESS_LABELS[tier]}</span>
                <span className="ar-legend-text">{READINESS_BLURB[tier]}</span>
              </div>
            ))}
          </div>
        </details>
        <details className="ar-legend-block">
          <summary className="ar-legend-summary"><strong>Target integration depth</strong> — three dimensions, each 0–3</summary>
          <div className="ar-legend-body">
            {MATURITY_DIMENSIONS.map((d) => (
              <div key={d.key} className="ar-legend-row">
                <span className="ar-legend-dim">{d.label}</span>
                <span className="ar-legend-text">{d.description}</span>
              </div>
            ))}
            <div className="ar-legend-row ar-legend-row--scale">
              {MATURITY_LEVEL_LABELS.map((label, level) => (
                <span key={level} className="ar-legend-scale-item">
                  <span className={`ar-mat-chip ar-mat-chip--${level}`}>{level}</span> {label}
                </span>
              ))}
            </div>
          </div>
        </details>
        <details className="ar-legend-block">
          <summary className="ar-legend-summary"><strong>Licensing</strong> — what you're allowed to deploy, and where fees or attribution apply</summary>
          <div className="ar-legend-body">
            {(Object.keys(LICENSING_LABELS) as Licensing[]).map((lic) => (
              <div key={lic} className="ar-legend-row">
                <span className={`ar-lic ar-lic--${lic}`}>{LICENSING_LABELS[lic]}</span>
                <span className="ar-legend-text">{LICENSING_BLURB[lic]}</span>
              </div>
            ))}
            <div className="ar-legend-row">
              <span className="ar-lic ar-lic--unknown">—</span>
              <span className="ar-legend-text">Licensing not yet documented for this tool.</span>
            </div>
          </div>
        </details>
      </div>

      {/* Matrix, grouped by pathway stage */}
      {groups.map(({ stage, rows }) => (
        <section key={stage.id} className="ar-stage">
          <h3 className="ar-stage-title">{stage.title}</h3>
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th scope="col" className="ar-col-tool">Instrument</th>
                  <th scope="col">Inclusion</th>
                  <th scope="col">Licensing</th>
                  <th scope="col">Readiness</th>
                  <th scope="col" className="ar-col-mat" title="Captured as a structured electronic form">Electronic</th>
                  <th scope="col" className="ar-col-mat" title="Results written back as discrete coded data">Write-back</th>
                  <th scope="col" className="ar-col-mat" title="A result drives the next step automatically">Triggering</th>
                  <th scope="col" className="ar-col-resources">Resources</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tool, buildStatus, tier, epicUrl }) => (
                  <tr key={tool.id}>
                    <td className="ar-col-tool">
                      <span className="ar-tool-name">{tool.shortName ?? tool.name}</span>
                      <span className="ar-tool-id">{tool.id}</span>
                    </td>
                    <td>
                      <span className={`roadmap-tool-inclusion roadmap-tool-inclusion--${tool.inclusionStatus}`}>
                        {tool.inclusionStatus}
                      </span>
                    </td>
                    <td>
                      {tool.licensing ? (
                        <span className={`ar-lic ar-lic--${tool.licensing}`} title={LICENSING_BLURB[tool.licensing]}>
                          {LICENSING_LABELS[tool.licensing]}
                        </span>
                      ) : (
                        <span className="ar-lic ar-lic--unknown" title="Licensing not yet documented">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`ar-tier ar-tier--${tier}`} title={`Build status: ${buildStatus}`}>
                        {READINESS_LABELS[tier]}
                      </span>
                    </td>
                    <td className="ar-col-mat"><MaturityChip level={tool.targetMaturity.electronic} dimension="Electronic capture" /></td>
                    <td className="ar-col-mat"><MaturityChip level={tool.targetMaturity.writeback} dimension="Discrete write-back" /></td>
                    <td className="ar-col-mat"><MaturityChip level={tool.targetMaturity.triggering} dimension="Workflow triggering" /></td>
                    <td className="ar-col-resources">
                      <div className="ar-resources">
                        {tool.pilotPlanSlug && (
                          <Link className="ar-res-link" to={`/guide/pathway/${tool.pilotPlanSlug}/plan`}>
                            Pilot plan
                          </Link>
                        )}
                        {tool.launchActions[0] && (
                          <Link className="ar-res-link" to={tool.launchActions[0].path}>
                            Demo
                          </Link>
                        )}
                        {epicUrl && (
                          <a className="ar-res-link ar-res-link--ext" href={epicUrl} target="_blank" rel="noopener noreferrer">
                            Epic
                          </a>
                        )}
                        {!tool.pilotPlanSlug && !tool.launchActions[0] && !epicUrl && (
                          <span className="ar-res-empty">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Cross-links */}
      <section className="ar-crosslinks">
        <h3 className="ar-crosslinks-title">Where to go next</h3>
        <ul className="ar-crosslinks-list">
          <li>
            <Link to="/guide/roadmap">Roadmap</Link> — the build status above, by tool, with
            tracking epics and the three strategic priorities behind them.
          </li>
          <li>
            <Link to="/guide/pathway">Pathway</Link> — each instrument in its clinical
            context across the 8-stage Suicide Safer Care pathway.
          </li>
          <li>
            <Link to="/guide/adoption-rubric">EHR Adoption Rubric</Link> — score your own
            system's maturity against these same dimensions.
          </li>
        </ul>
      </section>
    </div>
  )
}
