/**
 * The Suicide Safer Care Pathway, parsed into a render model.
 *
 * ⚠️ **Nothing about the pathway is written here.** Every step, condition,
 * tier and piece of documentation is read out of
 * `PlanDefinition-SPiERSuicideSaferCarePathway.json`, the generated form of
 * `ig/input/fsh/suicide-safer-care-pathway.fsh` — the same Pattern-A contract
 * `reassessment.ts` holds for the cadence, and the same `import.meta.glob`
 * bundling. Editing the FSH changes what the page renders with no TypeScript
 * change; that is the claim the page's provenance strip makes, so it has to be
 * literally true.
 *
 * ── Reading nothing is an error, everywhere ──────────────────
 *
 * `reassessment.ts` degrades to "no interval defined" when its artifact is
 * missing, because a wrong due date is worse than a missing one. This module
 * takes the opposite stance and **throws**, because its consumer is a page
 * whose entire claim is "this is a rendering of the published artifact": an
 * empty render model would present as a pathway with no steps rather than as a
 * build problem. Same #232 / #261 rule as the gates — a parse that cannot read
 * its subject must not report success.
 *
 * That extends to shapes rather than just absence. An action with no `id`, an
 * unrecognized `code.coding.system`, a `definitionUri` where the model expects
 * a canonical, a `documentation` entry carrying no content — each throws with
 * the path of the offending action. The alternative is a screen that quietly
 * omits an obligation the published protocol states, which is the failure this
 * whole plan is built against.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import { RISK_TIER_SYSTEM } from './riskEpisode'

export const PATHWAY_URL =
  'http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway'

/** SPiERPathwayStage — the eight-stage catalogue the protocol's groups tie back to. */
export const PATHWAY_STAGE_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'

/* ─── The raw artifact, as loosely as it is actually shaped ─── */

interface RawCoding {
  system?: string
  code?: string
  display?: string
}

interface RawDocumentation {
  type?: string
  label?: string
  display?: string
  url?: string
  resource?: string
}

interface RawCondition {
  kind?: string
  expression?: { language?: string; expression?: string; description?: string }
}

interface RawTriggerData {
  type?: string
  profile?: string[]
  codeFilter?: Array<{ path?: string; code?: RawCoding[] | RawCoding }>
}

interface RawTrigger {
  type?: string
  name?: string
  data?: RawTriggerData[]
}

interface RawAction {
  id?: string
  title?: string
  description?: string
  code?: Array<{ coding?: RawCoding[]; text?: string }>
  documentation?: RawDocumentation[]
  condition?: RawCondition[]
  trigger?: RawTrigger[]
  definitionCanonical?: unknown
  definitionUri?: unknown
  action?: RawAction[]
  [k: string]: unknown
}

interface RawPlanDefinition {
  resourceType?: string
  url?: string
  name?: string
  title?: string
  version?: string
  status?: string
  experimental?: boolean
  publisher?: string
  description?: string
  purpose?: string
  type?: { coding?: RawCoding[]; text?: string }
  relatedArtifact?: Array<{ type?: string; label?: string; display?: string; resource?: string }>
  action?: RawAction[]
}

/* ─── The render model ──────────────────────────────────────── */

export interface PathwayCoding {
  system: string
  code: string
  display?: string
}

export interface PathwayDocumentation {
  /** Short heading the FSH gives the note ("Transportability", "Every tier"). */
  label?: string
  display?: string
  /** An external URL (patient-education material, the published instrument). */
  url?: string
  /** A canonical of another SPiER artifact. */
  resource?: string
}

export interface PathwayCondition {
  kind: string
  language?: string
  expression: string
}

export interface PathwayTrigger {
  type: string
  name?: string
  /** One line per `data` element: resource type, profile and code filter. */
  data: string[]
}

export interface PathwayAction {
  id: string
  title: string
  description?: string
  /** The pathway stage this step belongs to, when the action carries one. */
  stage?: PathwayCoding
  /** The risk tier this group is gated on, when the action carries one. */
  tier?: PathwayCoding
  /** The artifact that realizes this step, when it names one. */
  definitionCanonical?: string
  /** Last path segment of `definitionCanonical` — what to show as its name. */
  definitionLabel?: string
  documentation: PathwayDocumentation[]
  conditions: PathwayCondition[]
  triggers: PathwayTrigger[]
  children: PathwayAction[]
}

export interface PathwayRelatedArtifact {
  type?: string
  label?: string
  display?: string
  resource?: string
}

export interface PathwayModel {
  url: string
  name?: string
  title: string
  version: string
  status?: string
  experimental?: boolean
  publisher?: string
  description?: string
  purpose?: string
  typeDisplay?: string
  relatedArtifacts: PathwayRelatedArtifact[]
  /** The top-level groups, in the order the protocol states them. */
  steps: PathwayAction[]
  /**
   * The one group whose children are tier-gated, and those children.
   *
   * Found structurally (a group all of whose children carry a tier coding),
   * never by id: the page's whole layout hinges on it, so a rename in the FSH
   * must fail loudly here rather than silently flatten the branch into a list.
   */
  tierBranch: { group: PathwayAction; tiers: PathwayAction[] }
  /** The artifact itself, for the provenance strip's JSON viewer. */
  raw: unknown
}

/* ─── Loading ───────────────────────────────────────────────── */

const planModules = import.meta.glob<{ default: RawPlanDefinition }>(
  // ⚠️ Relative, not `@spier/fhir-artifacts/...`: Vite does not resolve aliases
  // inside `import.meta.glob`. Climbs out of packages/core into the artifacts
  // package — the same path reassessment.ts uses.
  '../../../fhir-artifacts/generated/PlanDefinition-*.json',
  { eager: true },
)

class PathwayParseError extends Error {
  constructor(message: string) {
    super(`pathway: ${message}`)
    this.name = 'PathwayParseError'
  }
}

const bail = (message: string): never => {
  throw new PathwayParseError(message)
}

/* ─── Parsing ───────────────────────────────────────────────── */

function parseDocumentation(raw: RawDocumentation, path: string, i: number): PathwayDocumentation {
  const doc: PathwayDocumentation = {
    label: raw.label,
    display: raw.display,
    url: raw.url,
    resource: raw.resource,
  }
  if (!doc.display && !doc.url && !doc.resource) {
    bail(
      `${path}.documentation[${i}] carries no display, url or resource — there is nothing to render, ` +
        'and dropping it would hide a note the published protocol states',
    )
  }
  return doc
}

function parseCondition(raw: RawCondition, path: string, i: number): PathwayCondition {
  const expression = raw.expression?.expression
  if (typeof expression !== 'string' || expression.length === 0) {
    bail(
      `${path}.condition[${i}] has no expression.expression — a gate whose rule cannot be read ` +
        'must not render as an ungated step',
    )
  }
  return {
    kind: raw.kind ?? 'applicability',
    language: raw.expression?.language,
    expression: expression as string,
  }
}

function parseTrigger(raw: RawTrigger, path: string, i: number): PathwayTrigger {
  if (typeof raw.type !== 'string') bail(`${path}.trigger[${i}] has no type`)
  const data = (raw.data ?? []).map(d => {
    const parts: string[] = []
    if (d.type) parts.push(d.type)
    for (const profile of d.profile ?? []) parts.push(profile)
    for (const filter of d.codeFilter ?? []) {
      const codings = Array.isArray(filter.code) ? filter.code : filter.code ? [filter.code] : []
      for (const c of codings) {
        if (c.code) parts.push(`${filter.path ?? 'code'} = ${c.system ?? ''}#${c.code}`)
      }
    }
    if (parts.length === 0) {
      bail(`${path}.trigger[${i}].data names neither a type, a profile nor a code — nothing to show`)
    }
    return parts.join(' · ')
  })
  return { type: raw.type as string, name: raw.name, data }
}

function parseAction(raw: RawAction, path: string): PathwayAction {
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    bail(`${path} has no id — the render model keys and links every step by id`)
  }
  const here = `action[${raw.id}]`
  if (typeof raw.title !== 'string' || raw.title.length === 0) {
    bail(`${here} has no title — a step with no name cannot be rendered`)
  }

  let stage: PathwayCoding | undefined
  let tier: PathwayCoding | undefined
  for (const concept of raw.code ?? []) {
    for (const coding of concept.coding ?? []) {
      if (typeof coding.system !== 'string' || typeof coding.code !== 'string') {
        bail(`${here}: an action.code coding is missing its system or code`)
      }
      const parsed: PathwayCoding = {
        system: coding.system as string,
        code: coding.code as string,
        display: coding.display,
      }
      if (parsed.system === PATHWAY_STAGE_SYSTEM) {
        if (stage) bail(`${here} carries two pathway-stage codings — which stage owns the step is ambiguous`)
        stage = parsed
      } else if (parsed.system === RISK_TIER_SYSTEM) {
        if (tier) bail(`${here} carries two risk-tier codings — the branch would apply to two tiers at once`)
        tier = parsed
      } else {
        // Deliberately fatal rather than tolerated. This model classifies an
        // action by the systems it knows; a third one means the artifact grew a
        // dimension the page does not draw, and silently ignoring it is exactly
        // how a published obligation stops being shown.
        bail(
          `${here}: action.code names coding system "${parsed.system}", which this render model does not ` +
            'know. Extend packages/core/src/lib/pathway.ts (and the page that draws it) rather than ' +
            'letting the coding go unrendered.',
        )
      }
    }
  }

  if (raw.definitionUri != null) {
    bail(
      `${here}: definitionUri is set. The pathway references SPiER artifacts by canonical so they resolve ` +
        '(check:pathway rule b); a raw URI has nothing to link to.',
    )
  }
  let definitionCanonical: string | undefined
  if (raw.definitionCanonical != null) {
    if (typeof raw.definitionCanonical !== 'string') {
      bail(`${here}: definitionCanonical is not a string (${typeof raw.definitionCanonical})`)
    }
    definitionCanonical = (raw.definitionCanonical as string).split('|')[0]
  }

  return {
    id: raw.id as string,
    title: raw.title as string,
    description: raw.description,
    stage,
    tier,
    definitionCanonical,
    definitionLabel: definitionCanonical
      ? definitionCanonical.split('/').slice(-2).join('/')
      : undefined,
    documentation: (raw.documentation ?? []).map((d, i) => parseDocumentation(d, here, i)),
    conditions: (raw.condition ?? []).map((c, i) => parseCondition(c, here, i)),
    triggers: (raw.trigger ?? []).map((t, i) => parseTrigger(t, here, i)),
    children: (raw.action ?? []).map((child, i) => parseAction(child, `${here}.action[${i}]`)),
  }
}

/** Every action in the tree, depth-first, parents before children. */
function flatten(actions: PathwayAction[], out: PathwayAction[] = []): PathwayAction[] {
  for (const action of actions) {
    out.push(action)
    flatten(action.children, out)
  }
  return out
}

function findTierBranch(steps: PathwayAction[]): { group: PathwayAction; tiers: PathwayAction[] } {
  const candidates = flatten(steps).filter(a => a.children.some(c => c.tier))
  if (candidates.length === 0) {
    return bail(
      'no tier branch found — no action has tier-coded children. The branch is the point of this ' +
        'artifact, so a pathway without one is a parse that read the wrong thing.',
    )
  }
  if (candidates.length > 1) {
    return bail(
      `${candidates.length} tier branches found (${candidates.map(c => c.id).join(', ')}) — a patient ` +
        'would be owed two different sets of obligations, and the page can only draw one branch.',
    )
  }
  const group = candidates[0]
  const untiered = group.children.filter(c => !c.tier)
  if (untiered.length > 0) {
    return bail(
      `the tier branch "${group.id}" mixes tier-gated children with untiered ones ` +
        `(${untiered.map(c => c.id).join(', ')}) — the page draws the branch as one column per tier, ` +
        'so an untiered sibling has nowhere to go',
    )
  }
  return { group, tiers: group.children }
}

/** Parse an already-loaded PlanDefinition. Exported for tests. */
export function parsePathway(doc: unknown): PathwayModel {
  const plan = doc as RawPlanDefinition | null | undefined
  if (!plan || plan.resourceType !== 'PlanDefinition') {
    return bail('the loaded artifact is not a PlanDefinition')
  }
  if (typeof plan.url !== 'string') return bail('the PlanDefinition has no url — nothing to cite as provenance')
  if (typeof plan.version !== 'string') {
    return bail('the PlanDefinition has no version — the provenance strip states one, so it must exist')
  }
  if (!Array.isArray(plan.action) || plan.action.length === 0) {
    return bail('the PlanDefinition has no actions — there is no protocol to render')
  }

  const steps = plan.action.map((a, i) => parseAction(a, `action[${i}]`))

  return {
    url: plan.url,
    name: plan.name,
    title: plan.title ?? plan.name ?? plan.url,
    version: plan.version,
    status: plan.status,
    experimental: plan.experimental,
    publisher: plan.publisher,
    description: plan.description,
    purpose: plan.purpose,
    typeDisplay: plan.type?.coding?.[0]?.display ?? plan.type?.coding?.[0]?.code ?? plan.type?.text,
    relatedArtifacts: (plan.relatedArtifact ?? []).map(r => ({
      type: r.type,
      label: r.label,
      display: r.display,
      resource: r.resource,
    })),
    steps,
    tierBranch: findTierBranch(steps),
    raw: plan,
  }
}

let cached: PathwayModel | null = null

/**
 * The parsed pathway, from the bundled generated artifact.
 *
 * Throws when the artifact is absent or unreadable — see the module header for
 * why this does not degrade to an empty model the way `reassessment.ts` does.
 */
export function loadPathway(): PathwayModel {
  if (cached) return cached
  const doc = Object.values(planModules)
    .map(m => m.default)
    .find(d => d?.url === PATHWAY_URL)
  if (!doc) {
    return bail(
      `no PlanDefinition with url ${PATHWAY_URL} in packages/fhir-artifacts/generated/. ` +
        'Run `npm run copy-fhir -- --force` (SUSHI must have compiled suicide-safer-care-pathway.fsh).',
    )
  }
  cached = parsePathway(doc)
  return cached
}
