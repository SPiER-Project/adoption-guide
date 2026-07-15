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
import type { Card, CdsIndicator, CdsLink, Coding } from './types'

// Per-stage rationale copy for the "next step" card, keyed by stage id. Falls
// back to the stage's own CodeSystem definition when a stage has no blurb.
const STAGE_BLURB: Record<string, string> = {
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
const MAX_SUMMARY = 140

/** The one field patients.json still hand-curates (see lib/registry.ts). */
export interface RecommendedNextStep {
  stageId: string
  label: string
  rationale: string
}

export interface BuildCdsCardsInput {
  activeStageId: string | null
  riskAlerts: RiskAlert[]
  isToolEnabled: (id: string) => boolean
  /** The active patient's curated recommendation, or null (e.g. under SMART). */
  recommendedNextStep: RecommendedNextStep | null
  isSmartConnected: boolean
}

function appUrlForPath(path: string): string {
  return `${APP_BASE_URL}#${path.startsWith('/') ? path : `/${path}`}`
}

/** CDS Hooks caps `summary` at 140 chars — truncate with an ellipsis. */
function truncateSummary(text: string): string {
  return text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1).trimEnd()}…`
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

// Available in browsers and Node ≥19; degrade to undefined elsewhere so the
// builder never throws.
function makeUuid(): string | undefined {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : undefined
}

export function buildCdsCards({
  activeStageId,
  riskAlerts,
  isToolEnabled,
  recommendedNextStep,
  isSmartConnected,
}: BuildCdsCardsInput): Card[] {
  const cards: Card[] = []
  // Router paths already surfaced as a link, so alert cards don't duplicate them.
  const seenPaths = new Set<string>()

  // Card #1: the active pathway stage.
  if (activeStageId) {
    const stage = stageById(activeStageId)
    const stageTools = TOOLS.filter((t) => t.stageId === activeStageId && t.launchActions.length > 0)
    const options = stageTools.flatMap((tool) =>
      tool.launchActions.filter(() => isToolEnabled(tool.id)).map((action) => ({ tool, action })),
    )

    // Highest-severity live alert drives urgency (this patient's own slice).
    const topAlert = [...riskAlerts].sort((a, b) => RISK_LEVEL_ORDER[a.level] - RISK_LEVEL_ORDER[b.level])[0]
    const effectiveLevel = topAlert?.level && topAlert.level !== 'none' ? topAlert.level : null
    const indicator = effectiveLevel ? indicatorForLevel(effectiveLevel) : 'info'

    // Substitute the patient's curated recommendation only when no tools are
    // wired for this stage, we're not on a live EHR, and it targets this stage.
    const useRecommendation =
      options.length === 0 &&
      !isSmartConnected &&
      recommendedNextStep != null &&
      recommendedNextStep.stageId === activeStageId

    const routerPaths: Record<string, string> = {}
    const links: CdsLink[] = options.map(({ tool, action }) => {
      const url = appUrlForPath(action.path)
      routerPaths[url] = action.path
      seenPaths.add(action.path)
      return {
        label:
          tool.launchActions.length > 1
            ? `${tool.shortName ?? tool.name}: ${action.label}`
            : action.label,
        url,
        type: 'absolute' as const,
      }
    })

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
          : STAGE_BLURB[activeStageId] ?? stage?.description ?? '',
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

    const url = appUrlForPath(alert.suggestedAction.path)
    cards.push({
      uuid: makeUuid(),
      summary: truncateSummary(alert.suggestedAction.label),
      detail: alert.detail,
      // Alert cards carry only two urgencies: critical for acute/high, else
      // warning (preserves the pre-refactor urgent/recommended split).
      indicator: alert.level === 'acute' || alert.level === 'high' ? 'critical' : 'warning',
      source: { label: SOURCE_LABEL, url: APP_BASE_URL, topic: stageTopic(tool.stageId) },
      links: [{ label: alert.suggestedAction.label, url, type: 'absolute' }],
      extension: {
        'spier-card-id': `cds-alert-${alert.tool}`,
        'spier-stage-id': tool.stageId,
        'spier-router-paths': { [url]: alert.suggestedAction.path },
      },
    })
    seenPaths.add(alert.suggestedAction.path)
  }

  return cards
}
