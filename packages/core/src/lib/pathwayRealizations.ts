/**
 * Which tools the published pathway NAMES for a stage — its "demonstrated
 * realizations" — so the surfaces that offer tools can lead with them.
 *
 * `PlanDefinition/SPiERSuicideSaferCarePathway` codes each step by what it
 * accomplishes and then names one artifact as the realization SPiER
 * demonstrates end to end: `AdministerPHQ9` for the screen, `AdministerCSSRSScreener`
 * for the assessment after a positive screen, `AdministerStanleyBrown` for the
 * safety plan, and so on. The tool catalog lists every launchable tool at a
 * stage in catalog order, which put the PHQ-9 second of six screeners on the
 * "Identify Possible Risk" card and would put the C-SSRS Screener somewhere in
 * the middle of eight on "Clarify Risk" — the workflow the pathway page
 * describes was present but not visible. Ordering, not filtering: every tool
 * stays offered; the pathway's named instrument comes first.
 *
 * A tool is matched through its ActivityDefinition canonicals (`Tool.activityDefinitionUrls`,
 * derived in tools.ts), because that is the join the PlanDefinition itself uses.
 */
import { stripCanonicalVersion, type Tool } from '../data/catalog/tools'
import { loadPathway, type PathwayAction } from './pathway'

/**
 * The ActivityDefinition canonicals (version stripped) the pathway names under
 * `stageId`. A nested action inherits its parent's stage unless it carries its
 * own — the tier groups' children ("Share crisis resources") carry their own.
 */
export function pathwayRealizationsForStage(stageId: string): Set<string> {
  const out = new Set<string>()
  const steps = pathwaySteps()
  if (!steps) return out
  const walk = (actions: PathwayAction[], inherited: string | undefined) => {
    for (const action of actions) {
      const stage = action.stage?.code ?? inherited
      if (action.definitionCanonical && stage === stageId) {
        out.add(stripCanonicalVersion(action.definitionCanonical))
      }
      walk(action.children, stage)
    }
  }
  walk(steps, undefined)
  return out
}

let warned = false

/**
 * The pathway's steps, or `undefined` when the artifact cannot be loaded.
 *
 * ⚠️ `loadPathway()` THROWS on a missing artifact, on purpose — the pages that
 * render the protocol must not draw an empty one and call it published
 * (pathway.ts header). This helper only ORDERS a list of tools, and it is called
 * from the card builder inside the patient chart's render. Letting the throw
 * through there blanks the entire chart over a nicety; observed on the dev
 * server the moment `copy-fhir --force` emptied the generated folder mid-reload.
 * Catalog order, plus one warning, is the right degradation here.
 */
function pathwaySteps(): PathwayAction[] | undefined {
  try {
    return loadPathway().steps
  } catch (err) {
    if (!warned) {
      warned = true
      console.warn(`[pathwayRealizations] pathway unavailable — tools stay in catalog order: ${String(err)}`)
    }
    return undefined
  }
}

/** Whether the pathway names this tool as a realization of its own stage. */
export function isPathwayRealization(tool: Tool): boolean {
  const named = pathwayRealizationsForStage(tool.stageId)
  return (tool.activityDefinitionUrls ?? []).some(url => named.has(url))
}

/**
 * The same tools, with the pathway's named realizations first. Stable: the
 * catalog's order is kept within each half, so nothing else moves.
 */
export function orderByPathwayRealization<T extends Tool>(tools: T[]): T[] {
  const named = tools.filter(isPathwayRealization)
  const rest = tools.filter(t => !isPathwayRealization(t))
  return [...named, ...rest]
}
