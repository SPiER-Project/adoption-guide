/**
 * "A positive screen", read out of the published Clarify Risk stage.
 *
 * ── What this closes (#629) ─────────────────────────────────
 *
 * The app's gate already treated any screen as positive when its harmonized
 * risk concept was above no-risk — but the published FHIR said something
 * narrower: three per-instrument triggers on `SPiERClarifyRiskStage` (ASQ,
 * PSS-3, PHQ-9 item 9), so the SBQ-R, the BSSA and every other screen that
 * translates into the concept layer started Clarify Risk in the app and in no
 * published artifact. The stage now declares ONE general trigger,
 * `on-positive-screen`, and this module is how the app reads it: the profile
 * and the three code filters come from the compiled PlanDefinition, so editing
 * the FSH changes what the chart treats as a positive screen with no
 * TypeScript change — the same contract `pathway.ts` holds for the protocol.
 *
 * Only `DataRequirement` as the trigger uses it is interpreted: a resource
 * type, `profile` (any one claimed in `meta.profile`), and `codeFilter.code`
 * on a code-valued path (a Coding, a CodeableConcept, or an array of either).
 * Anything else in the requirement — a `valueSet` filter, a `dateFilter`, a
 * path the walker cannot follow — THROWS, rather than being skipped: a filter
 * the app silently ignored would make its gate wider than the published one.
 *
 * ⚠️ PHQ-9 item 9 is NOT read from here. Its gate is an integer threshold
 * (`>= 1`) that no code filter can express, and `pathwayEvaluation.ts` reads it
 * directly off the Observation. Its concept carries the same POS/NEG reading,
 * so a tagged item-9 concept satisfies this trigger as well.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */

export const CLARIFY_RISK_STAGE_URL =
  'http://thespierproject.org/fhir/PlanDefinition/SPiERClarifyRiskStage'

/** The action id of the general gate in the Clarify Risk stage. */
export const POSITIVE_SCREEN_ACTION_ID = 'on-positive-screen'

interface RawCoding {
  system?: string
  code?: string
}

interface RawCodeFilter {
  path?: string
  code?: RawCoding[]
  valueSet?: string
  [k: string]: unknown
}

interface RawDataRequirement {
  type?: string
  profile?: string[]
  codeFilter?: RawCodeFilter[]
  [k: string]: unknown
}

interface RawStage {
  url?: string
  action?: Array<{
    id?: string
    trigger?: Array<{ type?: string; name?: string; data?: RawDataRequirement[] }>
  }>
}

/** One code filter: the element at `path` must carry one of `codes`. */
export interface TriggerCodeFilter {
  path: string
  codes: Array<{ system: string; code: string }>
}

/** The trigger's data requirement, as the app applies it. */
export interface PositiveScreenRequirement {
  name: string
  type: string
  profiles: string[]
  codeFilters: TriggerCodeFilter[]
}

const stageModules = import.meta.glob<{ default: RawStage }>(
  // ⚠️ Relative, not `@spier/fhir-artifacts/...`: Vite does not resolve aliases
  // inside `import.meta.glob` (the same path pathway.ts climbs).
  '../../../fhir-artifacts/generated/PlanDefinition-SPiERClarifyRiskStage.json',
  { eager: true },
)

function unreadable(message: string): never {
  throw new Error(`[positiveScreenTrigger] ${message}`)
}

/** The keys a data requirement may carry for this reader to apply it faithfully. */
const UNDERSTOOD_REQUIREMENT_KEYS = new Set(['type', 'profile', 'codeFilter'])
const UNDERSTOOD_FILTER_KEYS = new Set(['path', 'code'])

/** Parse the published trigger. Exported for its test; callers use `positiveScreenRequirement()`. */
export function parsePositiveScreenRequirement(stage: RawStage | undefined): PositiveScreenRequirement {
  if (!stage) unreadable(`no compiled PlanDefinition at ${CLARIFY_RISK_STAGE_URL} — has copy-fhir run?`)
  const action = (stage.action ?? []).find(a => a.id === POSITIVE_SCREEN_ACTION_ID)
  if (!action) unreadable(`${CLARIFY_RISK_STAGE_URL} has no action "${POSITIVE_SCREEN_ACTION_ID}"`)
  const triggers = action.trigger ?? []
  if (triggers.length !== 1) unreadable(`"${POSITIVE_SCREEN_ACTION_ID}" declares ${triggers.length} triggers, expected 1`)
  const [trigger] = triggers
  if (trigger.type !== 'data-added') unreadable(`"${POSITIVE_SCREEN_ACTION_ID}" trigger type is ${trigger.type}, expected data-added`)
  const data = trigger.data ?? []
  if (data.length !== 1) unreadable(`"${POSITIVE_SCREEN_ACTION_ID}" trigger declares ${data.length} data requirements, expected 1`)
  const [req] = data

  for (const key of Object.keys(req)) {
    if (!UNDERSTOOD_REQUIREMENT_KEYS.has(key)) unreadable(`data requirement carries "${key}", which this reader does not apply`)
  }
  if (!req.type) unreadable('data requirement has no type')
  const profiles = req.profile ?? []
  if (profiles.length === 0) unreadable('data requirement names no profile')

  const codeFilters = (req.codeFilter ?? []).map((f, i): TriggerCodeFilter => {
    for (const key of Object.keys(f)) {
      if (!UNDERSTOOD_FILTER_KEYS.has(key)) unreadable(`codeFilter[${i}] carries "${key}", which this reader does not apply`)
    }
    if (!f.path) unreadable(`codeFilter[${i}] has no path`)
    const codes = (f.code ?? []).map(c => {
      if (!c.system || !c.code) unreadable(`codeFilter[${i}] (${f.path}) has a code without system and code`)
      return { system: c.system, code: c.code }
    })
    if (codes.length === 0) unreadable(`codeFilter[${i}] (${f.path}) names no code`)
    return { path: f.path, codes }
  })
  if (codeFilters.length === 0) unreadable('data requirement has no code filters — it would match every concept')

  return { name: trigger.name ?? POSITIVE_SCREEN_ACTION_ID, type: req.type, profiles, codeFilters }
}

let cached: PositiveScreenRequirement | undefined

/** The published positive-screen trigger. Throws if the artifact cannot be read. */
export function positiveScreenRequirement(): PositiveScreenRequirement {
  if (cached) return cached
  const stage = Object.values(stageModules)
    .map(m => m.default)
    .find(d => d?.url === CLARIFY_RISK_STAGE_URL)
  cached = parsePositiveScreenRequirement(stage)
  return cached
}

/** Every Coding at a dot-separated path, through CodeableConcepts and arrays. */
function codingsAtPath(resource: unknown, path: string): RawCoding[] {
  let nodes: unknown[] = [resource]
  for (const segment of path.split('.')) {
    nodes = nodes.flatMap((n): unknown[] => {
      const v = n && typeof n === 'object' ? (n as Record<string, unknown>)[segment] : undefined
      return Array.isArray(v) ? (v as unknown[]) : v === undefined ? [] : [v]
    })
  }
  return nodes.flatMap(n => {
    if (!n || typeof n !== 'object') return []
    const o = n as { coding?: RawCoding[]; system?: string; code?: string }
    return Array.isArray(o.coding) ? o.coding : 'code' in o ? [o] : []
  })
}

/** Whether a resource satisfies a data requirement of the shape `parsePositiveScreenRequirement` returns. */
export function satisfiesRequirement(resource: unknown, req: PositiveScreenRequirement): boolean {
  const r = resource as { resourceType?: string; meta?: { profile?: string[] } } | undefined
  if (!r || r.resourceType !== req.type) return false
  if (!req.profiles.some(p => r.meta?.profile?.includes(p))) return false
  return req.codeFilters.every(f =>
    codingsAtPath(r, f.path).some(c => f.codes.some(want => c.system === want.system && c.code === want.code)),
  )
}

/** Whether this resource is a positive screen, by the published Clarify Risk trigger. */
export function isPositiveScreenConcept(resource: unknown): boolean {
  return satisfiesRequirement(resource, positiveScreenRequirement())
}
