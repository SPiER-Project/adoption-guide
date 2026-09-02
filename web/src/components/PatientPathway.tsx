/**
 * The patient chart's vertical pathway rail.
 *
 * Replaces what used to be three parallel retellings of the same eight stages —
 * a horizontal stepper, a detached "Recommendations" stack, and a vertical
 * "Activity by pathway stage" list. A reader trying to work out *what the rules
 * say to do next* had to join a recommendation at the top of the page to the
 * stage row several hundred pixels below it.
 *
 * Now there is one rail. Each stage is a node carrying, in order: what the stage
 * is for, what to do here (the CDS Hooks cards that target it), what has already
 * been recorded (its FHIR artifacts), and — for stages not yet reached — which
 * tools would satisfy it. Nodes that need attention are open; everything else
 * collapses to one scannable line.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { STAGES, TOOLS, stageById } from '@spier/core/data/catalog'
import type { Card, CdsIndicator } from '@spier/core/lib/cdsHooks'
import type { StageArtifacts, StageStatus } from '@spier/core/lib/patientPathway'
import { FhirJsonViewer } from './FhirJsonViewer'
import { usePresentation } from '../context/PresentationContext'
import { ArtifactCards } from './ChartArtifacts'
import { artifactCount, scoreSummaryOf } from '../lib/chartDisplay'
import { CDS_INDICATOR_ICON } from '../lib/statusIcons'

/* ---------- CDS recommendation cards ---------- */
// The chart's recommendations are real CDS Hooks 2.0 Cards, built by the shared,
// React-free builder in lib/cdsHooks. This UI renders those Card objects inside
// the stage they target and exposes the raw wire payload via a per-card toggle.

// CDS indicator → clinician-facing pill label and BEM modifier.
const INDICATOR_LABEL: Record<CdsIndicator, string> = {
  critical: 'Urgent',
  warning: 'Recommended',
  info: 'Routine',
}

/**
 * Detail longer than this is clipped behind a "Show more" toggle.
 *
 * ⚠️ The problem-list guidance card's detail is ~200 words of SNOMED, ICD-10 and
 * a ValueSet URL — correct, sourced from the published pathway, pinned by tests,
 * and unreadable as the FIRST thing in a 470px panel. `Card.detail` is GFM per
 * the spec and both SPiER renderers deliberately print it as text (see
 * problemListCard.ts), so shortening it at the source or rendering markdown are
 * both out; the card is complete, it just does not need to be complete
 * *first*. The raw card is one toggle away in the JSON viewer either way.
 */
const DETAIL_CLIP = 280

/** Cut at the last sentence boundary inside the clip, or hard-clip with an ellipsis. */
function clipAtSentence(text: string, max: number): string {
  const head = text.slice(0, max)
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'))
  return end > max / 2 ? head.slice(0, end + 1) : `${head.trimEnd()}…`
}

function CardDetail({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (text.length <= DETAIL_CLIP) return <p className="cds-card-rationale">{text}</p>
  return (
    <div className="cds-card-rationale">
      <p className="cds-card-rationale__text">{expanded ? text : clipAtSentence(text, DETAIL_CLIP)}</p>
      <button
        type="button"
        className="cds-card-more"
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

export function CdsCardView({ card }: { card: Card }) {
  const ext = card.extension
  const narrativeOnly = ext?.['spier-narrative-only'] === true
  const routerPaths = ext?.['spier-router-paths'] ?? {}
  const links = card.links ?? []
  const IndicatorIcon = CDS_INDICATOR_ICON[card.indicator]
  // In the embedded panel there is no sidebar and no implementer: "configure
  // tools in your implementation" is addressed to someone who is not there.
  const inPanel = usePresentation().chromeMode === 'panel'
  return (
    <article className={`cds-card cds-card--${card.indicator}`}>
      <header className="cds-card-header">
        <span className={`cds-card-pill cds-card-pill--${card.indicator}`}>
          <IndicatorIcon aria-hidden="true" size={12} />
          {INDICATOR_LABEL[card.indicator]}
        </span>
      </header>
      <h5 className="cds-card-title">{card.summary}</h5>
      {card.detail && <CardDetail text={card.detail} />}
      {links.length > 0 ? (
        <div className="cds-card-actions">
          {links.map((link, i) => {
            // Deep links carry an in-app router path in the extension so the SPA
            // can navigate client-side; fall back to the absolute url otherwise.
            const to = routerPaths[link.url]
            // Keyed by position, not by url: a stage can offer two tools whose
            // launch actions share a path (different labels, same destination),
            // and `key={link.url}` then collides. patient-013 and patient-014
            // hit this on track-follow-up; patient-011 never did, so the bug sat
            // latent until the ED exception branches were added.
            const key = `${i}:${link.url}`
            return to ? (
              <Link key={key} to={to} className="cds-card-action-btn">
                {link.label}
              </Link>
            ) : (
              <a
                key={key}
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
      ) : narrativeOnly ? null : inPanel ? (
        <p className="cds-card-no-options">No tool is enabled for this step.</p>
      ) : (
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

/* ---------- Node state ---------- */

/**
 * How a stage node presents itself. Finer-grained than the derived
 * `StageStatus`, which marks every stage up to the furthest-touched one
 * `complete` — including ones the patient passed with nothing recorded. Reading
 * "Complete" against "No activity at this stage yet" was the chart's most
 * misleading pairing, so a passed-but-empty stage now says so.
 */
type NodeState = 'done' | 'passed' | 'active' | 'upcoming'

const NODE_STATE_LABEL: Record<NodeState, string> = {
  done: 'Complete',
  passed: 'Nothing recorded',
  active: 'You are here',
  upcoming: 'Upcoming',
}

function nodeStateOf(status: StageStatus, hasArtifacts: boolean): NodeState {
  if (status === 'active') return 'active'
  if (status === 'not-started') return 'upcoming'
  return hasArtifacts ? 'done' : 'passed'
}

/* ---------- One stage on the rail ---------- */

function StageNode({
  index,
  group,
  status,
  cards,
  open,
  onToggle,
  isToolEnabled,
  anchorId,
}: {
  index: number
  group: StageArtifacts
  status: StageStatus
  cards: Card[]
  open: boolean
  onToggle: () => void
  isToolEnabled: (id: string) => boolean
  /** Extra in-page anchor hosted by this node (the sidebar's #recommendations). */
  anchorId?: string
}) {
  const stage = stageById(group.stageId)
  const count = artifactCount(group)
  const state = nodeStateOf(status, count > 0)
  const scoreSummary = scoreSummaryOf(group.observations)
  // A recommendation on the stage the patient is on, or one they have not
  // reached, is a to-do. The same card on a COMPLETED stage is guidance — the
  // problem-list card sits on a finished "Define the Risk Picture" by design —
  // and labelling it "Do now" beside a "Complete" pill was the rail
  // contradicting itself on three nodes at once. The node still opens for it
  // (see `autoOpen`); it just stops claiming the stage is outstanding.
  const hasCards = cards.length > 0
  const needsAttention = hasCards && (state === 'active' || state === 'upcoming')
  const isGuidance = hasCards && !needsAttention
  // The "Do now" flag is for a to-do on a stage the patient has NOT reached —
  // there it is the only thing saying the row is actionable. On the active
  // stage it sat beside "You are here", above a red "Urgent" pill, beside a
  // card titled "Next step": four labels for one state, and a reader could not
  // tell an emergency from the ordinary next thing. The active node keeps its
  // one status pill; the open card underneath is what says what to do.
  const showTodoFlag = needsAttention && state === 'upcoming'

  // "Potential actions" at this stage: the tools that would satisfy it. This is
  // what makes the rail readable as a *rule set* rather than only as a history —
  // you can see the whole pathway's options without launching anything.
  //
  // Every stage has launchable tools in the catalog, but most implementations
  // enable only a few, so both halves matter: what you can do here now, and what
  // the pathway offers that you haven't turned on.
  const { enabled: enabledTools, disabledCount } = useMemo(() => {
    const all = TOOLS.filter(t => t.stageId === group.stageId && t.launchActions.length > 0)
    const enabled = all.filter(t => isToolEnabled(t.id))
    return { enabled, disabledCount: all.length - enabled.length }
  }, [group.stageId, isToolEnabled])

  // Collapsed one-liner: the single most useful fact about this stage.
  const summary =
    scoreSummary ||
    (count > 0 ? `${count} ${count === 1 ? 'record' : 'records'}` : '') ||
    (state === 'upcoming' && enabledTools.length > 0
      ? `${enabledTools.length} ${enabledTools.length === 1 ? 'tool' : 'tools'} available`
      : '')

  return (
    <li
      id={`stage-${group.stageId}`}
      className={`pathway-node pathway-node--${state} ${
        needsAttention ? 'pathway-node--attention' : ''
      }`}
    >
      <span className="pathway-node-marker" aria-hidden>
        {state === 'done' ? <Check size={16} /> : index + 1}
      </span>
      <div className="pathway-node-card">
        {anchorId && <span id={anchorId} className="pathway-node-anchor" />}
        <h4 className="pathway-node-heading">
          <button
            type="button"
            className="pathway-node-toggle"
            onClick={onToggle}
            aria-expanded={open}
          >
            <span className="pathway-node-main">
              <span className="pathway-node-step">Step {index + 1}</span>
              <span className="pathway-node-title">{stage?.title}</span>
              {summary && !open && <span className="pathway-node-summary">{summary}</span>}
            </span>
            <span className="pathway-node-aside">
              {showTodoFlag && (
                <span className="pathway-node-flag">
                  {cards.length === 1 ? 'Do now' : `${cards.length} to do`}
                </span>
              )}
              {isGuidance && (
                <span className="pathway-node-flag pathway-node-flag--guidance">Guidance</span>
              )}
              <span className={`pathway-node-status pathway-node-status--${state}`}>
                {NODE_STATE_LABEL[state]}
              </span>
              <span className="pathway-node-chevron" aria-hidden>
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </span>
          </button>
        </h4>

        {open && (
          <div className="pathway-node-body">
            <p className="pathway-node-desc">{stage?.description}</p>

            {cards.length > 0 && (
              <div className="pathway-node-actions">
                <h5 className="pathway-node-section-title">What to do here</h5>
                <div className="pathway-node-cards">
                  {cards.map(card => (
                    <CdsCardView
                      key={card.extension?.['spier-card-id'] ?? card.uuid}
                      card={card}
                    />
                  ))}
                </div>
              </div>
            )}

            {count > 0 && (
              <div className="pathway-node-records">
                <h5 className="pathway-node-section-title">
                  Recorded here{scoreSummary && ` · ${scoreSummary}`}
                </h5>
                <ArtifactCards
                  responses={group.responses}
                  carePlans={group.carePlans}
                  observations={group.observations}
                  communications={group.communications}
                  workflowArtifacts={group.workflowArtifacts}
                />
              </div>
            )}

            {count === 0 && cards.length === 0 && (
              <p className="pathway-node-empty">
                {state === 'passed'
                  ? 'The pathway moved past this stage without anything being recorded here.'
                  : 'Nothing recorded at this stage yet.'}
              </p>
            )}

            {/* Only offer the tool list where it answers "what could happen
                here" — a stage with live recommendations already shows its
                actions above, and repeating them reads as a second, weaker set. */}
            {cards.length === 0 && (
              <div className="pathway-node-tools">
                <h5 className="pathway-node-section-title">Tools that satisfy this stage</h5>
                {enabledTools.length > 0 && (
                  <div className="pathway-node-tool-chips">
                    {enabledTools.flatMap(tool =>
                      tool.launchActions.map(action => (
                        <Link
                          key={`${tool.id}-${action.path}`}
                          to={action.path}
                          className="pathway-tool-chip"
                        >
                          {tool.launchActions.length > 1
                            ? `${tool.shortName ?? tool.name}: ${action.label}`
                            : action.label}
                        </Link>
                      )),
                    )}
                  </div>
                )}
                {disabledCount > 0 && (
                  <p className="pathway-node-tools-note">
                    {enabledTools.length > 0
                      ? `${disabledCount} more `
                      : `${disabledCount} ${disabledCount === 1 ? 'tool' : 'tools'} `}
                    {disabledCount === 1 ? 'is' : 'are'} catalogued for this stage but not enabled
                    in your implementation.{' '}
                    <Link to="/guide/tool-configuration">Configure tools</Link>.
                  </p>
                )}
                {enabledTools.length === 0 && disabledCount === 0 && (
                  <p className="pathway-node-empty">
                    SPiER has no launchable tool for this stage yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/* ---------- The one-line status ---------- */

/**
 * Where the patient is on the pathway, in one line. Exported because in panel
 * chrome it is NOT rendered by the rail: the chart's `PageHeader` carries it as
 * the lede, so the panel shows one title and one status line instead of a page
 * title, a rail title and a two-line progress sentence stacked above the first
 * stage (112px of a 740px frame, measured 2026-09-02). `compact` drops the
 * "N of 8 stages with activity" clause, which the rail's markers already show.
 */
export function PathwayProgress({
  statuses,
  actionCount,
  compact = false,
}: {
  statuses: Record<string, StageStatus>
  actionCount: number
  compact?: boolean
}) {
  const withActivity = STAGES.filter(s => statuses[s.id] === 'complete').length
  const activeStage = STAGES.find(s => statuses[s.id] === 'active')
  return (
    <>
      {activeStage ? (
        <>
          <strong>
            {compact ? 'Step' : 'Now at step'} {STAGES.indexOf(activeStage) + 1} of {STAGES.length}
          </strong>
          {' — '}
          {activeStage.title}
        </>
      ) : (
        <strong>All {STAGES.length} stages passed</strong>
      )}
      {!compact && (
        <>
          {' · '}
          {withActivity} of {STAGES.length} stages with activity
        </>
      )}
      {actionCount > 0 && (
        <>
          {' · '}
          <span className="pathway-progress-actions">
            {actionCount} recommended {actionCount === 1 ? 'action' : 'actions'}
          </span>
        </>
      )}
    </>
  )
}

/* ---------- The rail ---------- */

export function PatientPathway({
  stageGroups,
  statuses,
  cards,
  isToolEnabled,
}: {
  stageGroups: StageArtifacts[]
  statuses: Record<string, StageStatus>
  cards: Card[]
  isToolEnabled: (id: string) => boolean
}) {
  // Cards target a stage through the `spier-stage-id` extension the builder
  // already stamps. A card whose stage doesn't resolve would otherwise vanish
  // from the page entirely, so those render above the rail.
  const { byStage, orphans } = useMemo(() => {
    const byStage = new Map<string, Card[]>()
    const orphans: Card[] = []
    for (const card of cards) {
      const stageId = card.extension?.['spier-stage-id']
      if (stageId && stageById(stageId)) {
        byStage.set(stageId, [...(byStage.get(stageId) ?? []), card])
      } else {
        orphans.push(card)
      }
    }
    return { byStage, orphans }
  }, [cards])

  // Open by default exactly the nodes a reader needs: the one they're on, and
  // any stage carrying a live recommendation (a completed stage can still carry
  // one — Sarah Patel's ASQ prompt sits on an already-passed screening stage,
  // and burying it inside a collapsed row would hide the very thing the page
  // exists to surface).
  const autoOpen = useMemo(
    () =>
      STAGES.filter(s => statuses[s.id] === 'active' || (byStage.get(s.id)?.length ?? 0) > 0).map(
        s => s.id,
      ),
    [statuses, byStage],
  )
  const [open, setOpen] = useState<Set<string>>(() => new Set(autoOpen))

  // Re-seed the open set when the pathway itself changes (patient switch, a new
  // artifact captured) — but never on an unrelated re-render, which would undo
  // the reader's own expand/collapse. Adjusting during render rather than in an
  // effect: React re-runs this component immediately, before any child renders
  // or the DOM is touched, so there is no flash of the stale open set.
  const autoOpenKey = autoOpen.join('|')
  const [seededKey, setSeededKey] = useState(autoOpenKey)
  if (seededKey !== autoOpenKey) {
    setSeededKey(autoOpenKey)
    setOpen(new Set(autoOpen))
  }

  const toggle = (stageId: string) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(stageId)) next.delete(stageId)
      else next.add(stageId)
      return next
    })

  // The panel's vertical budget is the whole reason PanelShell exists, and this
  // header spent five lines of it on meta before the first stage. In panel chrome
  // the rail renders NO header and NO progress line of its own: the chart's
  // PageHeader carries the title and `PathwayProgress` as its lede (see
  // PatientChart.tsx), and the subtitle lines become one footnote under the
  // rail — the links survive because in the panel the protocol link is the ONLY
  // way into the published pathway.
  const inPanel = usePresentation().chromeMode === 'panel'
  const actionCount = cards.length
  // First stage carrying a recommendation — where #recommendations should land.
  const recommendationsHost = STAGES.find(s => (byStage.get(s.id)?.length ?? 0) > 0)?.id

  return (
    <section id="activity" className="pathway">
      {!inPanel && <header className="pathway-header">
        <h3 className="pathway-title">Suicide-safer care pathway</h3>
        <span className="pathway-subtitle">
          <span className="pathway-subtitle__line">
            Recommendations are real CDS Hooks 2.0 cards &middot;{' '}
            <Link to="/guide/cds-service">also served over the wire</Link>
          </span>
          {/* The way into the published protocol, and in the embedded SMART
              panel the ONLY one: the panel has no sidebar, so the chart — its
              overview — is where the definition has to be reachable from.
              Deliberately not /guide/pathway, which is the implementer's
              framing, pager into Tools and all. See pages/PathwayProtocol.tsx. */}
          <span className="pathway-subtitle__line">
            This rail is <strong>this patient</strong> &middot;{' '}
            <Link to="/patient/pathway">see the published protocol</Link>
          </span>
        </span>
      </header>}

      {!inPanel && (
        <p className="pathway-progress">
          <PathwayProgress statuses={statuses} actionCount={actionCount} />
        </p>
      )}

      {orphans.length > 0 && (
        <div className="pathway-orphan-cards">
          {orphans.map(card => (
            <CdsCardView key={card.extension?.['spier-card-id'] ?? card.uuid} card={card} />
          ))}
        </div>
      )}

      {/* The sidebar and eleven "View in chart" links still address the chart by
          its old anchors. #activity is this whole section; #recommendations
          follows the actions to whichever node now hosts them. */}
      {!recommendationsHost && <span id="recommendations" className="pathway-node-anchor" />}

      <ol className="pathway-rail">
        {stageGroups.map((group, idx) => (
          <StageNode
            key={group.stageId}
            index={idx}
            group={group}
            status={statuses[group.stageId]}
            cards={byStage.get(group.stageId) ?? []}
            open={open.has(group.stageId)}
            onToggle={() => toggle(group.stageId)}
            isToolEnabled={isToolEnabled}
            anchorId={group.stageId === recommendationsHost ? 'recommendations' : undefined}
          />
        ))}
      </ol>

      {inPanel && (
        <p className="pathway-footnote">
          <Link to="/patient/pathway">The published protocol</Link>
          {' · '}
          <Link to="/guide/cds-service">How these recommendations are served</Link>
        </p>
      )}
    </section>
  )
}
