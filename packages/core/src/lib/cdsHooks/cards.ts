/**
 * Pure, React-free builder for the patient-view CDS Hooks Cards.
 *
 * Given a patient's record slice, returns genuine CDS Hooks 2.0 `Card[]`: the
 * one thing the published pathway says to do now, then the rest of what the
 * patient's tier owes, then the problem-list guidance prompt. Kept importable
 * from Node — no `window`, no react-router — so the hosted `/cds-services`
 * endpoint shares it verbatim with the chart and the embedded panel.
 *
 * ── Rewritten 2026-09-21 (clinical-app audit §1.4, §1.5, §4.5) ──
 *
 * The old builder emitted a card for the ACTIVE STAGE, leading with that
 * stage's lead tool — which for five of the eight stages is a product default
 * (`PATHWAY_STAGE_DEFAULTS`), not anything the published protocol names — plus
 * one card per live risk alert, which nothing ever retired. A chart whose
 * *Clarify Risk* step was complete and held a C-SSRS Screener still said
 * **Start C-SSRS Screener**, and the card the protocol actually obliged at
 * moderate risk sat third.
 *
 * Every one of those decisions now lives in `lib/pathwayEvaluation.ts`, which
 * walks the published `PlanDefinition/SPiERSuicideSaferCarePathway` against the
 * record. This file does one job: turn its answer into cards. Nothing here
 * decides what is recommended.
 *
 * ⚠️ **`PATHWAY_STAGE_DEFAULTS` no longer produces a card, and the constant
 * stays.** It is still what a stage page OFFERS and what the guided preset
 * turns on; it is no longer what anything RECOMMENDS (decision §7.2).
 */

import { PATHWAY_STAGE_SYSTEM } from '../patientPathway'
import { stageById } from '../../data/catalog'
import { DEPLOY_ORIGINS } from '../deployOrigins'
import { intentForLaunchPath } from '../smartIntent'
import {
  evaluatePathway,
  type EvaluatePathwayOptions,
  type ObligationUrgency,
  type PathwayObligation,
  type PathwayRecord,
} from '../pathwayEvaluation'
import { makeUuid, truncateSummary } from './cardShape'
import { buildProblemListGuidanceCard } from './problemListCard'
import type { Card, CdsIndicator, CdsLink, Coding } from './types'

// Deployed app base — links point here so a real CDS client (which has no idea
// about SPiER's SPA routing) can still open the tool. HashRouter → the router
// path lives after the `#`. The host comes from deploy-origins.json (repo
// root) like every other hosted origin; `check:origins` fails a literal here.
const APP_BASE_URL = `${DEPLOY_ORIGINS.pages}/`
const SOURCE_LABEL = 'SPiER Suicide-Safer Pathway'

/**
 * The `spier-card-id` prefix every card built from a pathway OBLIGATION carries.
 *
 * ⚠️ **Read by `isPathwayObligationCard` below and written by `cardFor`, once
 * each.** The chart's landing screen renders the obligations itself and leaves
 * the rest to the rail below it, so something has to tell the two apart — and
 * the audit's rule is *guidance is not an action* (§4.5), which is a statement
 * about where a card came from rather than about which card it happens to be.
 * A predicate naming the problem-list card by id would answer the question the
 * wrong way round: a second guidance card added later would be silently
 * promoted onto the landing screen, which is the one surface that is allowed to
 * hold exactly one thing. Phrased as "not an obligation", a new guidance card
 * is guidance by construction and a new obligation card is an obligation by
 * construction.
 */
const PATHWAY_CARD_ID_PREFIX = 'cds-pathway-'

/**
 * Whether this card is something the published pathway OWES this record, as
 * opposed to a documentation prompt or other guidance. See the prefix above.
 */
export function isPathwayObligationCard(card: Card): boolean {
  return (card.extension?.['spier-card-id'] ?? '').startsWith(PATHWAY_CARD_ID_PREFIX)
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
  /** The patient's chart, as the pathway evaluator reads it. */
  record: PathwayRecord
  /**
   * Whether a site has this tool turned on.
   *
   * ⚠️ **It can never withhold a recommendation, only its launch button.** The
   * old builder dropped a whole card when its tool was disabled, so a site
   * whose preset excluded the pathway's instrument silently lost the
   * recommendation (the 2026-09-02 defect). What the protocol obliges is not a
   * site setting, so a disabled tool now costs the card its link and nothing
   * else — the clinician still reads what is due.
   */
  isToolEnabled: (id: string) => boolean
  /** Set by a host-facing service to emit `type: "smart"` links. See above. */
  smartLaunch?: SmartLaunchLinks
  /** Passed through to the evaluator — the protocol, and the clock. */
  evaluation?: EvaluatePathwayOptions
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

/** The record's urgency, in the card vocabulary. */
const INDICATOR_FOR_URGENCY: Record<ObligationUrgency, CdsIndicator> = {
  routine: 'info',
  elevated: 'warning',
  urgent: 'critical',
}

function stageTopic(stageId: string): Coding {
  return { system: PATHWAY_STAGE_SYSTEM, code: stageId, display: stageById(stageId)?.title ?? stageId }
}

function cardFor(
  obligation: PathwayObligation,
  options: { primary: boolean; isToolEnabled: (id: string) => boolean; smartLaunch?: SmartLaunchLinks },
): Card {
  const { tool } = obligation
  const launchable = tool && options.isToolEnabled(tool.id) ? tool : null
  const { link, routerPath } = launchable
    ? cardLink(launchable.label, launchable.path, options.smartLaunch)
    : { link: null, routerPath: null }

  return {
    uuid: makeUuid(),
    // The title is the ACT — "Complete a collaborative safety plan" — and the
    // detail is THE TRIGGER, in the clinician's words. Never a CodeSystem
    // definition, and never the published step's description as well (audit
    // §4.5): for a step with a button the description only restates what the
    // button says, and two sentences per card is what turned a chart into
    // something to read rather than something to do.
    //
    // ⚠️ The exception is a step with nothing to launch. There the published
    // description IS the act — "At EVERY CONTACT, ask: …" — and dropping it
    // would leave a card that names an instruction without giving it.
    summary: truncateSummary(obligation.title),
    detail: launchable ? obligation.reason : `${obligation.reason}\n\n${obligation.description}`,
    indicator: INDICATOR_FOR_URGENCY[obligation.urgency],
    source: { label: SOURCE_LABEL, url: APP_BASE_URL, topic: stageTopic(obligation.stageId) },
    ...(link ? { links: [link] } : {}),
    extension: {
      'spier-card-id': `${PATHWAY_CARD_ID_PREFIX}${obligation.actionId}`,
      'spier-stage-id': obligation.stageId,
      ...(options.primary ? { 'spier-primary': true as const } : {}),
      // A standing instruction has no tool at all, so "no tools enabled for
      // this stage — configure tools" would send a clinician somewhere that
      // cannot help. A card whose tool is merely disabled does not set this.
      ...(tool ? {} : { 'spier-narrative-only': true as const }),
      ...(routerPath ? { 'spier-router-paths': { [routerPath[0]]: routerPath[1] } } : {}),
    },
  }
}

/**
 * The patient's cards: the primary first, then what else the tier owes, then
 * the problem-list guidance prompt.
 *
 * Exactly one card carries `spier-primary`, and only when something is due. A
 * patient with nothing outstanding gets no action card at all — which is the
 * answer, not an empty result: the chart says *Nothing is due* from the
 * evaluator's own sentence.
 */
export function buildCdsCards({
  record,
  isToolEnabled,
  smartLaunch,
  evaluation,
}: BuildCdsCardsInput): Card[] {
  const { primary, alsoDue } = evaluatePathway(record, evaluation)
  const cards: Card[] = []

  if (primary) cards.push(cardFor(primary, { primary: true, isToolEnabled, smartLaunch }))
  for (const obligation of alsoDue) {
    cards.push(cardFor(obligation, { primary: false, isToolEnabled, smartLaunch }))
  }

  // Last on purpose — it is a documentation prompt, and the actionable cards
  // above are what a clinician should reach first. It carries no link, so it
  // can never be a duplicate of one.
  const guidance = buildProblemListGuidanceCard(record.observations ?? [])
  if (guidance) cards.push(guidance)

  return cards
}
