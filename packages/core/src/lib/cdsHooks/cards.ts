/**
 * Pure, React-free builder for the Patient Chart's CDS Hooks Cards.
 *
 * Given a patient's live pathway slice (active stage + risk alerts + tool
 * config), returns genuine CDS Hooks 2.0 `Card[]`. Kept importable from Node —
 * no `window`, no react-router — so the future hosted `/cds-services` endpoint
 * (plan-cds-hooks-service) can share it verbatim.
 */

import { TOOLS, stageById } from '../../data/catalog'
import { RISK_LEVEL_ORDER } from '../observationMappers'
import type { RiskAlert } from '../observationMappers'
import { PATHWAY_STAGE_SYSTEM } from '../patientPathway'
import { intentForLaunchPath } from '../smartIntent'
import { orderByPathwayRealization } from '../pathwayRealizations'
import type { ObservationResource } from '../../types/fhir'
import { makeUuid, truncateSummary } from './cardShape'
import { buildProblemListGuidanceCard } from './problemListCard'
import type { Card, CdsIndicator, CdsLink, Coding } from './types'
import { isStageId, type StageId } from '@spier/fhir-artifacts/generated/stage-ids.generated'

// Per-stage rationale copy for the "next step" card, keyed by stage id. Falls
// back to the stage's own CodeSystem definition when a stage has no blurb.
// `Record<StageId, string>` rather than `Record<string, string>` on purpose: a
// typo'd key here used to silently fall through to the CodeSystem's own
// definition text below instead of erroring, and a stage added to the
// CodeSystem with no blurb here failed the same way. Both a typo AND a
// missing entry are now compile errors.
const STAGE_BLURB: Record<StageId, string> = {
  'identify-possible-risk': 'Administer a suicide-risk screen to find a signal and decide whether more review is needed.',
  'clarify-risk': 'Positive screen — clarify the nature, severity, and context of suicide risk.',
  'define-risk-picture': 'Document the current risk status and the clinical reasoning that guides next steps.',
  'document-safety-actions': 'Document concrete actions to reduce risk: safety plan, means counseling.',
  'coordinate-handoffs': 'Transfer suicide-safety information and responsibility across settings.',
  'track-follow-up': 'Track caring contacts and follow-up steps after the immediate encounter.',
  'track-risk-over-time': 'Keep the active suicide-safer care episode visible, trackable, and escalated when needed.',
  'measure-and-share': 'Use pathway activity for reporting, QI, and information sharing.',
}

// Deployed app base — links point here so a real CDS client (which has no idea
// about SPiER's SPA routing) can still open the tool. HashRouter → the router
// path lives after the `#`.
const APP_BASE_URL = 'https://spier-project.github.io/adoption-guide/'
const SOURCE_LABEL = 'SPiER Suicide-Safer Pathway'

/** The one field patients.json still hand-curates (see lib/registry.ts). */
export interface RecommendedNextStep {
  stageId: string
  label: string
  rationale: string
}

/**
 * Emit card links as SMART app launches instead of deep links.
 *
 * ⚠️ **Opt-in, and the reason is who consumes the card.** In-app, the Patient
 * Chart renders these cards itself and follows `spier-router-paths` to route
 * client-side — there is no EHR to perform a launch, so a `type: "smart"` link
 * would be a button that cannot be pressed. In a host EHR the opposite holds:
 * the host mints the launch context and `type: "absolute"` throws away the
 * patient context it already has. So the hosted `/cds-services` endpoint sets
 * this and the app does not.
 *
 * `launchUrl` is the app's `launch_uri`. Per the CDS Hooks spec the CDS *client*
 * appends `iss` and `launch` — this builder must not, and could not: it has no
 * authorization server and no launch context.
 */
export interface SmartLaunchLinks {
  /** The app's launch URL, e.g. `https://…workers.dev/`. */
  launchUrl: string
}

export interface BuildCdsCardsInput {
  activeStageId: string | null
  riskAlerts: RiskAlert[]
  isToolEnabled: (id: string) => boolean
  /** The active patient's curated recommendation, or null (e.g. under SMART). */
  recommendedNextStep: RecommendedNextStep | null
  isSmartConnected: boolean
  /** Set by a host-facing service to emit `type: "smart"` links. See above. */
  smartLaunch?: SmartLaunchLinks
  /**
   * The patient's Observations, for the tier-driven guidance cards.
   *
   * Optional, and an omission means "this caller has no observation slice" — it
   * yields no guidance card rather than a wrong one. `riskAlerts` is not a
   * substitute: an alert is what an instrument said, while the guidance card is
   * gated on the *harmonized concept* the record carries (LOINC 93374-7 +
   * SPiERSuicideRiskTier), which is what the published pathway's tier branch
   * conditions on. See `problemListCard.ts`.
   */
  observations?: ObservationResource[]
}

function appUrlForPath(path: string): string {
  return `${APP_BASE_URL}#${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * One card link for one tool launch action, in whichever of the two forms the
 * consumer can act on.
 *
 * The SMART form carries the tool in `appContext` rather than in the URL,
 * because the URL is the app's launch endpoint and the same for every link — the
 * host reads `appContext` and puts it in the launch context as `intent`.
 * `appContext` is a string on the wire (spec), so it is JSON-encoded here.
 */
function cardLink(
  label: string,
  path: string,
  smartLaunch: SmartLaunchLinks | undefined,
): { link: CdsLink; routerPath: [string, string] | null } {
  if (smartLaunch) {
    return {
      link: {
        label,
        url: smartLaunch.launchUrl,
        type: 'smart',
        appContext: JSON.stringify({ intent: intentForLaunchPath(path) }),
      },
      // No router path: these cards are being handed to a host EHR, which has
      // no idea about SPiER's client-side routes. Emitting one would invite the
      // app to route a link it is not the consumer of.
      routerPath: null,
    }
  }
  const url = appUrlForPath(path)
  return { link: { label, url, type: 'absolute' }, routerPath: [url, path] }
}

// Stage/next-step card urgency: acute/high → critical, moderate → warning,
// low/none → info. Matches the pre-refactor urgent/recommended/routine ladder.
function indicatorForLevel(level: RiskAlert['level']): CdsIndicator {
  if (level === 'acute' || level === 'high') return 'critical'
  if (level === 'moderate') return 'warning'
  return 'info'
}

function stageTopic(stageId: string): Coding {
  return { system: PATHWAY_STAGE_SYSTEM, code: stageId, display: stageById(stageId)?.title ?? stageId }
}

export function buildCdsCards({
  activeStageId,
  riskAlerts,
  isToolEnabled,
  recommendedNextStep,
  isSmartConnected,
  smartLaunch,
  observations,
}: BuildCdsCardsInput): Card[] {
  const cards: Card[] = []
  // Router paths already surfaced as a link, so alert cards don't duplicate them.
  const seenPaths = new Set<string>()

  // Card #1: the active pathway stage.
  if (activeStageId) {
    const stage = stageById(activeStageId)
    // The pathway's demonstrated realization leads (PHQ-9 on the screen card,
    // the C-SSRS Screener on Clarify Risk); every other tool follows in catalog
    // order. Ordering only — nothing a site enabled is withheld.
    const stageTools = orderByPathwayRealization(
      TOOLS.filter((t) => t.stageId === activeStageId && t.launchActions.length > 0),
    )
    const options = stageTools.flatMap((tool) =>
      tool.launchActions.filter(() => isToolEnabled(tool.id)).map((action) => ({ tool, action })),
    )

    // Highest-severity live alert drives urgency (this patient's own slice).
    const topAlert = [...riskAlerts].sort((a, b) => RISK_LEVEL_ORDER[a.level] - RISK_LEVEL_ORDER[b.level])[0]
    const effectiveLevel = topAlert?.level && topAlert.level !== 'none' ? topAlert.level : null
    // ⚠️ The reporting stage is never urgent. The stage card's urgency mirrors
    // the patient's highest live alert, which is right for every clinical stage
    // and wrong for the last one: a high-risk patient whose remaining step is
    // "use this activity for reporting" was shown an URGENT card whose action was
    // "open the measure dashboard" — in a 470px clinical panel. The alert cards
    // (#2..n) still carry the patient's urgency; this caps only the stage card.
    const indicator =
      activeStageId === 'measure-and-share'
        ? 'info'
        : effectiveLevel ? indicatorForLevel(effectiveLevel) : 'info'

    // Substitute the patient's curated recommendation only when no tools are
    // wired for this stage, we're not on a live EHR, and it targets this stage.
    const useRecommendation =
      options.length === 0 &&
      !isSmartConnected &&
      recommendedNextStep != null &&
      recommendedNextStep.stageId === activeStageId

    // A live alert whose suggested action is one of THIS stage's tools is
    // absorbed into the stage card (the dedupe below never emits it again), and
    // the reason it fired would vanish with it: Sarah Patel's "PHQ-9 Item 9
    // positive" became a generic "Positive screen — clarify…" the moment the
    // C-SSRS Screener became a Clarify Risk tool. The stage card carries the
    // absorbed alert's summary and detail instead of the stage blurb, so the
    // card still says WHY this step is due and which instrument answers it.
    const optionPaths = new Set(options.map(({ action }) => action.path))
    const absorbedAlert = [...riskAlerts]
      .sort((a, b) => RISK_LEVEL_ORDER[a.level] - RISK_LEVEL_ORDER[b.level])
      .find((a) => a.level !== 'none' && !!a.suggestedAction && optionPaths.has(a.suggestedAction.path))

    const routerPaths: Record<string, string> = {}
    // ⚠️ One link per DESTINATION, not per tool. Two tools can share a launch
    // path — TL-042 (KPI Reporting) and TL-043 (Dashboard) both launch
    // `/guide/measures` with the same label — and this map ran over tools, so
    // the card carried two byte-identical links. The in-app chart has rendered
    // two identical "Open measure dashboard" buttons for every patient at the
    // measure-and-share stage since the cards were built; nothing caught it
    // because `spier-router-paths` is keyed by URL and silently collapsed the
    // pair, so only the visible list was ever doubled. Found when a host EHR
    // rendered the same cards as SMART launch buttons (panel step 5) — the
    // duplication is louder when each one is a button that mints an OAuth
    // launch.
    const linkedPaths = new Set<string>()
    const links: CdsLink[] = []
    for (const { tool, action } of options) {
      seenPaths.add(action.path)
      if (linkedPaths.has(action.path)) continue
      linkedPaths.add(action.path)
      const label =
        tool.launchActions.length > 1
          ? `${tool.shortName ?? tool.name}: ${action.label}`
          : action.label
      const { link, routerPath } = cardLink(label, action.path, smartLaunch)
      if (routerPath) routerPaths[routerPath[0]] = routerPath[1]
      links.push(link)
    }

    cards.push({
      uuid: makeUuid(),
      summary: truncateSummary(
        useRecommendation && recommendedNextStep
          ? recommendedNextStep.label
          : `Next step: ${stage?.title ?? activeStageId}`,
      ),
      detail:
        useRecommendation && recommendedNextStep
          ? recommendedNextStep.rationale
          : absorbedAlert
            ? `${absorbedAlert.summary}. ${absorbedAlert.detail}`
          // `activeStageId` is resolved off live patient data (see
          // `derivePathwayStatus`), so it stays a plain string rather than
          // `StageId` — `isStageId` is the boundary guard for indexing the
          // hand-authored STAGE_BLURB table with it.
          : (isStageId(activeStageId) ? STAGE_BLURB[activeStageId] : undefined) ?? stage?.description ?? '',
      indicator,
      source: { label: SOURCE_LABEL, url: APP_BASE_URL, topic: stageTopic(activeStageId) },
      links: links.length > 0 ? links : undefined,
      extension: {
        'spier-card-id': `cds-stage-${activeStageId}`,
        'spier-stage-id': activeStageId,
        ...(useRecommendation ? { 'spier-narrative-only': true } : {}),
        ...(Object.keys(routerPaths).length > 0 ? { 'spier-router-paths': routerPaths } : {}),
      },
    })
  }

  // Cards #2..n: tool-suggested actions from risk alerts not already surfaced.
  for (const alert of riskAlerts) {
    if (!alert.suggestedAction || alert.level === 'none') continue
    if (seenPaths.has(alert.suggestedAction.path)) continue
    const tool = TOOLS.find((t) => t.launchActions.some((a) => a.path === alert.suggestedAction!.path))
    if (!tool || !isToolEnabled(tool.id)) continue

    const { link, routerPath } = cardLink(
      alert.suggestedAction.label,
      alert.suggestedAction.path,
      smartLaunch,
    )
    cards.push({
      uuid: makeUuid(),
      summary: truncateSummary(alert.suggestedAction.label),
      detail: alert.detail,
      // Alert cards carry only two urgencies: critical for acute/high, else
      // warning (preserves the pre-refactor urgent/recommended split).
      indicator: alert.level === 'acute' || alert.level === 'high' ? 'critical' : 'warning',
      source: { label: SOURCE_LABEL, url: APP_BASE_URL, topic: stageTopic(tool.stageId) },
      links: [link],
      extension: {
        'spier-card-id': `cds-alert-${alert.tool}`,
        'spier-stage-id': tool.stageId,
        ...(routerPath ? { 'spier-router-paths': { [routerPath[0]]: routerPath[1] } } : {}),
      },
    })
    seenPaths.add(alert.suggestedAction.path)
  }

  // Card #n+1: tier-driven clinician guidance, read out of the published
  // pathway. Last on purpose — it is a documentation prompt, and the actionable
  // cards above are what a clinician should reach first. It carries no link, so
  // it can never be a duplicate of one.
  const guidance = buildProblemListGuidanceCard(observations ?? [])
  if (guidance) cards.push(guidance)

  return cards
}
