/**
 * The eight-stage rail: where this patient is.
 *
 * Replaces what used to be three parallel retellings of the same eight stages —
 * a horizontal stepper, a detached "Recommendations" stack, and a vertical
 * "Activity by pathway stage" list. A reader trying to work out *what the rules
 * say to do next* had to join a recommendation at the top of the page to the
 * stage row several hundred pixels below it.
 *
 * ── It is a page now, not the top of the chart (2026-09-21) ────────────────
 *
 * Clinical-app audit §4.3: the rail is a good answer to a question the landing
 * screen no longer asks, so it moved to `pages/PatientWhere.tsx` and a clinician
 * opens it on purpose. Three things left with the move:
 *
 *   - **The stage CodeSystem definitions.** Every one begins "The EHR supports…"
 *     — written to a vendor, and the chart used them as stage descriptions
 *     (§1.9). The node now carries `stageBlurb`, one clinician sentence held in
 *     `packages/core` beside the stage ids.
 *   - **"Tools that satisfy this stage".** That list is the stage page's, and
 *     the row links there. ⚠️ Deleting the block is the MEASURED part of §4.3,
 *     not a tidy-up: with the pathway's obligations off the rail (PR 4) every
 *     stage that used to carry a card fell into that branch instead, and one
 *     chart grew 372px because of it.
 *   - **Its own title and progress line.** The page's `PageHeader` carries
 *     both, so the rail draws no header in either chrome and `inPanel` stopped
 *     being a thing this component reads.
 *
 * What a node carries now: the stage in one clinician sentence, the guidance
 * cards that target it, and what has already been recorded there. A stage the
 * pathway owes something at says how many on its row; the obligations
 * themselves are the landing screen's, and rendering them here too is §1.5
 * rebuilt one layer down.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { STAGES, stageBlurb, stageById } from '@spier/core/data/catalog'
import type { Card, CdsIndicator } from '@spier/core/lib/cdsHooks'
import type { StageArtifacts, StageStatus } from '@spier/core/lib/patientPathway'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { useInspect } from '@spier/tool-views/context/InspectContext'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { ArtifactCards } from './ChartArtifacts'
import { artifactCount, scoreSummaryOf } from '../lib/chartDisplay'
import { CDS_INDICATOR_ICON } from '@spier/tool-views/lib/statusIcons'
import { EmptyState } from '@spier/ui/EmptyState'
import { Pill } from '@spier/ui/Pill'
import { Card as CardSurface } from '@spier/ui/Card'

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

function CdsCardView({ card }: { card: Card }) {
  const ext = card.extension
  const narrativeOnly = ext?.['spier-narrative-only'] === true
  const routerPaths = ext?.['spier-router-paths'] ?? {}
  const links = card.links ?? []
  const IndicatorIcon = CDS_INDICATOR_ICON[card.indicator]
  // In the embedded panel there is no sidebar and no implementer: "configure
  // tools in your implementation" is addressed to someone who is not there.
  const inPanel = usePresentation().chromeMode === 'panel'
  const inspect = useInspect()
  return (
    <CardSurface as="article" padding="compact" accent className={`cds-card cds-card--${card.indicator}`}>
      <header className="cds-card-header">
        <Pill className={`cds-card-pill--${card.indicator}`} icon={IndicatorIcon}>
          {INDICATOR_LABEL[card.indicator]}
        </Pill>
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
        <EmptyState>No tool is enabled for this step.</EmptyState>
      ) : (
        <EmptyState>
          No tools enabled for this stage in your implementation.{' '}
          <Link to="/settings">Configure tools</Link>.
        </EmptyState>
      )}
      {/* The card's own JSON, for an implementer reading the guide. A clinician
          sees the card and not the wire format behind it — the wrapper is
          checked as well as the viewer so the surface does not keep a gap where
          the accordion used to be. See context/InspectContext.ts. */}
      {inspect && (
        <div className="cds-card-json">
          <FhirJsonViewer data={card} title="View CDS Hooks card JSON" />
        </div>
      )}
    </CardSurface>
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
  dueCount,
  open,
  onToggle,
  anchorId,
}: {
  index: number
  group: StageArtifacts
  status: StageStatus
  cards: Card[]
  /** How many of the pathway's outstanding obligations sit at this stage. */
  dueCount: number
  open: boolean
  onToggle: () => void
  /** Extra in-page anchor hosted by this node (the sidebar's #recommendations). */
  anchorId?: string
}) {
  const stage = stageById(group.stageId)
  const count = artifactCount(group)
  const state = nodeStateOf(status, count > 0)
  const scoreSummary = scoreSummaryOf(group.observations)
  // ⚠️ **"Due" is the PATHWAY's count, not the card count**, and that is the
  // whole difference from the rule this replaced. Until PR 4 the rail held the
  // obligations themselves, so "a card is here" and "something is owed here"
  // were the same fact; now the obligations are the landing screen's and every
  // card the rail still draws is guidance. A guidance card that set this flag
  // would tell a clinician a finished stage was outstanding — which is what
  // "four labels for one state" (§1.6) was, one layer down.
  const hasCards = cards.length > 0
  const needsAttention = dueCount > 0
  // Collapsed one-liner: the scores if there are any, else how much is here.
  const summary =
    scoreSummary || (count > 0 ? `${count} ${count === 1 ? 'record' : 'records'}` : '')

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
        {/* ⚠️ **Two controls, not one, and the split is audit §4.3's "each row
            links to its stage page".** The title is a LINK — the row's primary
            action is "what do I do here", which is the stage page — and the
            summary, the pills and the chevron are a separate toggle for "what
            is already recorded here". One control could only have been one of
            those two, and a `<Link>` nested inside the `<button>` the whole row
            used to be is not valid markup in the first place. */}
        <h4 className="pathway-node-heading">
          <Link className="pathway-node-open" to={`/patient/pathway/${group.stageId}`}>
            <span className="pathway-node-step">Step {index + 1}</span>
            <span className="pathway-node-title">{stage?.title}</span>
          </Link>
          <span className="pathway-node-aside">
            {dueCount > 0 && (
              <Pill tone="brand">{dueCount === 1 ? '1 due' : `${dueCount} due`}</Pill>
            )}
            {hasCards && <Pill tone="neutral">Guidance</Pill>}
            <Pill className={`pathway-node-status--${state}`}>{NODE_STATE_LABEL[state]}</Pill>
            <button
              type="button"
              className="pathway-node-toggle"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={
                open
                  ? `Hide what is recorded at ${stage?.title}`
                  : `Show what is recorded at ${stage?.title}`
              }
            >
              <span className="pathway-node-chevron" aria-hidden>
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
          </span>
        </h4>

        {/* ⚠️ The one useful fact about a collapsed stage sits on its OWN line,
            not beside the pills. Inside the aside it cost the title most of a
            375px row and wrapped "Identify Possible Risk" onto three lines. */}
        {!open && summary && <p className="pathway-node-summary">{summary}</p>}

        {open && (
          <div className="pathway-node-body">
            {/* The clinician's sentence, not the CodeSystem's definition — see
                the module header and `packages/core/src/data/catalog/stageBlurbs.ts`. */}
            <p className="pathway-node-desc">{stageBlurb(group.stageId)}</p>

            {hasCards && (
              <div className="pathway-node-actions">
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
                  Recorded here{scoreSummary && ` \u00b7 ${scoreSummary}`}
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

            {count === 0 && !hasCards && (
              <EmptyState>
                {state === 'passed'
                  ? 'The pathway moved past this stage without anything being recorded here.'
                  : 'Nothing recorded at this stage yet.'}
              </EmptyState>
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
  dueByStage,
}: {
  stageGroups: StageArtifacts[]
  statuses: Record<string, StageStatus>
  cards: Card[]
  /**
   * Stage id → how many of the pathway's outstanding obligations sit there.
   * Supplied by the page from the same `evaluatePathway` the landing screen
   * reads, so the two cannot disagree about what is owed.
   */
  dueByStage?: Record<string, number>
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

  // First stage carrying a recommendation — where #recommendations should land.
  const recommendationsHost = STAGES.find(s => (byStage.get(s.id)?.length ?? 0) > 0)?.id

  return (
    <section id="activity" className="pathway">
      {/* ⚠️ **No header and no progress line in EITHER chrome since 2026-09-21.**
          The rail is a page now and `pages/PatientWhere.tsx` owns its header —
          title, up-link and `PathwayProgress` as the lede. It drew its own in a
          standalone tab while the panel suppressed them, which is exactly the
          "one owner per page" rule `docs/internals/css-and-page-template.md`
          states; the rail simply stopped being the thing that owns it. */}
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
            dueCount={dueByStage?.[group.stageId] ?? 0}
            open={open.has(group.stageId)}
            onToggle={() => toggle(group.stageId)}
            anchorId={group.stageId === recommendationsHost ? 'recommendations' : undefined}
          />
        ))}
      </ol>
    </section>
  )
}
