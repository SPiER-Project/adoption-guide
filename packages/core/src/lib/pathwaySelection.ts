/**
 * What each pathway stage LEADS WITH — one definition, two consumers.
 *
 * `pathwayRealizations.ts` answers "does the published pathway name this tool?"
 * and is used to ORDER a list. This answers the stronger question the clinical
 * surface asks: *given a stage, which tool does a clinician do here?*
 *
 * Two consumers, and they must not drift:
 *
 *   - the `guided-pathway` preset (`web/src/data/toolPresets.ts`), which decides
 *     what a deployment turns on;
 *   - the stage pages (`web/src/pages/PathwayStage.tsx`), which decide what a
 *     clinician is shown.
 *
 * ⚠️ **They are different questions with the same answer, and that is why this
 * file exists rather than the page reading the preset.** The preset is a claim
 * about one *deployment*; the pathway is a claim about *care*. A site that
 * enables extra instruments has not changed what the pathway says to do — so a
 * stage page keyed on the preset would change what it leads with every time an
 * operator ticked a box on /settings, which is not what "guided" means. Settled
 * with Brad 2026-09-18: *"SPiER's pathway only, for now."*
 *
 * ⚠️ **React-free and DOM-free**, like the rest of `packages/core` — the CDS
 * Hooks Worker is the third consumer this will need when the per-site toolset
 * becomes something the SERVICE can read (see `web/src/lib/toolEnablement.ts`).
 */
import { launchableTools, type Tool } from '../data/catalog/tools'
import { isPathwayRealization } from './pathwayRealizations'

/**
 * The tool each stage leads with when the PUBLISHED PATHWAY names none.
 *
 * `PlanDefinition/SPiERSuicideSaferCarePathway` is a clinical protocol — screen,
 * gate, assess, branch by tier, act, reassess — not a per-stage tool list. It
 * names four ActivityDefinitions across three of the eight stages (PHQ-9 at
 * Identify, the C-SSRS Screener at Clarify, Stanley-Brown *and* crisis resources
 * at Document Safety Actions) and is silent on the other five. So a selection
 * derived purely from it would leave five stages EMPTY — the opposite of guiding
 * a clinician through them.
 *
 * These five close that gap. They are declared here rather than added to the
 * PlanDefinition on purpose: **a published PlanDefinition is a clinical claim,
 * and this is a product default.** Promoting them into the artifact is a
 * separate decision (Brad, 2026-09-18).
 *
 * ⚠️ **A stage the pathway already covers must not appear here.** Two sources
 * for one stage is the drift this repo keeps rediscovering;
 * `toolPresets.test.ts` fails on an entry for a covered stage, on a stage left
 * with neither, on a tool that does not exist and on one declared for the wrong
 * stage.
 */
export const PATHWAY_STAGE_DEFAULTS: Readonly<Record<string, string>> = {
  // Only `core` tool at the stage; the alternate (TL-024, the CAMS therapeutic
  // worksheet) is `optional` and licensed separately.
  'define-risk-picture': 'TL-006',
  // The most general of five: it records that a handoff happened at all, which
  // the referral, the discharge packet and the appointment all elaborate.
  'coordinate-handoffs': 'TL-009',
  // The best-evidenced follow-up intervention in suicide prevention, and already
  // load-bearing here: `caring-contact` is a bespoke recorder precisely so it
  // stamps its profile and opt-out extension for a Stage-8 measure.
  'track-follow-up': 'TL-010',
  // The episode is the correlation hinge the rest of the stage hangs off — it is
  // what makes "where is this patient on the pathway" answerable at all.
  'track-risk-over-time': 'TL-038',
  // Already the stage's answer in behaviour: the Stage-8 CDS card's one action
  // is "Open measure dashboard".
  'measure-and-share': 'TL-043',
}

/**
 * The tools this stage leads with: whatever the published pathway names there,
 * and only failing that the declared default.
 *
 * ⚠️ **It can legitimately return TWO.** Document Safety Actions is named twice
 * by the pathway — share crisis resources *and* complete a safety plan — because
 * the tier groups carry both as distinct obligations. Collapsing that to one
 * would drop a published obligation to satisfy a tidier signature.
 *
 * ⚠️ **"The pathway names something here" is not the same as "a tool is
 * selected here."** At `track-risk-over-time` the pathway names a canonical that
 * is a `PlanDefinition` — the reassessment *cadence*, not an instrument — so no
 * launchable tool matches it and the stage still needs a default. The predicate
 * is therefore tool-level, which is what `isPathwayRealization` already answers.
 */
export function stageLeadTools(stageId: string): Tool[] {
  const at = launchableTools().filter(t => t.stageId === stageId)
  const named = at.filter(isPathwayRealization)
  // ⚠️ **This precedence is defensive, and no planted defect can reach it.**
  // Inverting these two branches changes no observable behaviour today, because
  // `PATHWAY_STAGE_DEFAULTS` holds entries only for stages the pathway does NOT
  // cover — the two sets are disjoint, and `toolPresets.test.ts` is what keeps
  // them so. The order is written this way regardless, because the invariant
  // worth stating is *the artifact wins*: if a default for a covered stage ever
  // slips past that test, the published pathway should still be what a clinician
  // is led with.
  if (named.length > 0) return named
  const fallback = PATHWAY_STAGE_DEFAULTS[stageId]
  return fallback ? at.filter(t => t.id === fallback) : []
}

/** The same, as ids. */
export function stageLeadToolIds(stageId: string): string[] {
  return stageLeadTools(stageId).map(t => t.id)
}

/**
 * Every tool the pathway leads with, across every stage — the membership rule
 * for the `guided-pathway` preset.
 *
 * Derived rather than listed, on both halves: a pathway that starts naming a
 * tool at a new stage is picked up without anyone editing a preset.
 */
export function guidedPathwayToolIds(): string[] {
  const picked = new Set(Object.values(PATHWAY_STAGE_DEFAULTS))
  return launchableTools()
    .filter(t => isPathwayRealization(t) || picked.has(t.id))
    .map(t => t.id)
}

/** The tools at this stage that are NOT what it leads with — the escape. */
export function stageAlternativeTools(stageId: string): Tool[] {
  const lead = new Set(stageLeadToolIds(stageId))
  return launchableTools().filter(t => t.stageId === stageId && !lead.has(t.id))
}
