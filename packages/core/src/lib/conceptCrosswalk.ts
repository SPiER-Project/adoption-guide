/**
 * The concept layer's crosswalks, read as data.
 *
 * SPiER publishes one ConceptMap per instrument that translates that
 * instrument's own result vocabulary into the shared suicide-risk tier
 * (`ig/input/fsh/crosswalk-*.fsh`). Until now nothing in the runtime read them:
 * the mappers each carried their own native-to-`RiskAlert.level` reading, and
 * the only consumer of the harmonized tier — the problem-list guidance card —
 * deliberately looked at nothing but observations already valued in
 * `SPiERSuicideRiskTier`.
 *
 * ⚠️ **That gap is what makes this module necessary rather than tidy.** SPiER's
 * own C-SSRS administrations put their result on LOINC 93374-7 valued in
 * `cssrs-risk-level` — a native vocabulary — so a rule that read only the
 * harmonized value could not tell moderate risk from high for the one
 * assessment the published pathway names as its realization. The alternative,
 * reading `RiskAlert.level`, would be a hand-written second crosswalk in
 * TypeScript beside the published one. This reads the published one.
 *
 * ── Pattern A, like `reassessment.ts` and `pathway.ts` ───────
 *
 * Nothing about any mapping is written here: every row comes from the generated
 * ConceptMaps. Adding a crosswalk in FSH changes this module's answers with no
 * TypeScript change. Absence degrades rather than throwing — an unmappable
 * coding simply yields no tier, and every caller already has to handle "this
 * record carries no tier" — which is the `reassessment.ts` stance, not the
 * `pathway.ts` one, because a *guessed* tier is worse than a missing one.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import { RISK_TIER_SYSTEM } from './riskEpisode'

interface RawConceptMap {
  url?: string
  name?: string
  title?: string
  status?: string
  group?: Array<{
    source?: string
    target?: string
    element?: Array<{
      code?: string
      display?: string
      target?: Array<{ code?: string; display?: string; equivalence?: string; comment?: string }>
    }>
  }>
}

const conceptMapModules = import.meta.glob<{ default: RawConceptMap }>(
  // ⚠️ Relative, not `@spier/fhir-artifacts/...`: Vite does not resolve aliases
  // inside `import.meta.glob`. Climbs out of packages/core into the artifacts
  // package — the same path `pathway.ts` and `reassessment.ts` use.
  '../../../fhir-artifacts/generated/ConceptMap-*.json',
  { eager: true },
)

/** `"<source system>|<source code>"` → the tier code it translates to. */
function readCrosswalks(): Map<string, string> {
  const out = new Map<string, string>()
  for (const module of Object.values(conceptMapModules)) {
    for (const group of module.default?.group ?? []) {
      // Only the maps that land ON the tier vocabulary. SPiERRiskTierToLOINC
      // runs the other way — tier to a LOINC answer code — and indexing it here
      // would translate a tier into something that is not one.
      if (group.target !== RISK_TIER_SYSTEM || !group.source) continue
      for (const element of group.element ?? []) {
        const tier = element.target?.find(t => !!t.code)?.code
        if (!element.code || !tier) continue
        out.set(`${group.source}|${element.code}`, tier)
      }
    }
  }
  return out
}

let cached: Map<string, string> | null = null

function crosswalks(): Map<string, string> {
  if (!cached) cached = readCrosswalks()
  return cached
}

/** Source systems the published crosswalks can translate — for the drift test. */
export function crosswalkedSourceSystems(): string[] {
  return [...new Set([...crosswalks().keys()].map(k => k.split('|')[0]))].sort()
}

/**
 * The harmonized suicide-risk tier a coding carries, or `undefined`.
 *
 * A coding already in `SPiERSuicideRiskTier` is returned as-is — it IS the
 * harmonized concept and needs no translation. Anything else is looked up in
 * the published crosswalks.
 */
export function tierForCoding(coding: { system?: string; code?: string } | undefined): string | undefined {
  if (!coding?.code) return undefined
  if (coding.system === RISK_TIER_SYSTEM) return coding.code
  if (!coding.system) return undefined
  return crosswalks().get(`${coding.system}|${coding.code}`)
}

/** The first of a resource's value codings that yields a harmonized tier. */
export function tierForCodings(
  codings: Array<{ system?: string; code?: string }> | undefined,
): string | undefined {
  for (const coding of codings ?? []) {
    const tier = tierForCoding(coding)
    if (tier) return tier
  }
  return undefined
}

// ─── How faithful each route into the tier is ────────────────────────────────

/** One row of a crosswalk, as the data dictionary shows it. */
export interface CrosswalkRow {
  source: { code: string; display?: string }
  target: { code: string; display?: string }
  equivalence: string
  comment?: string
}

/**
 * How a source vocabulary reaches the shared tier.
 *
 * `native`: the value is ALREADY a tier code (SAFE-T, the episode's
 * current-tier extension) and nothing translates it. `crosswalk`: a published
 * ConceptMap does, and every row of it is carried, because the rows are where
 * the precision is lost.
 */
export type TierRoute =
  | { kind: 'native' }
  | { kind: 'crosswalk'; title: string; url?: string; draft: boolean; rows: CrosswalkRow[] }

/**
 * The route a value drawn from `system` takes into the tier, or `undefined`
 * when no published crosswalk lands it there.
 *
 * Read from the generated ConceptMaps like everything else in this module, so
 * a crosswalk whose equivalences or status change in FSH changes what the
 * dictionary says with no TypeScript edit. ⚠️ `draft` is the ConceptMap's own
 * `status`, which is how the IG marks a mapping still waiting on clinical
 * sign-off — not a separate flag someone has to remember to clear.
 */
export function tierRoute(system: string | undefined): TierRoute | undefined {
  if (!system) return undefined
  if (system === RISK_TIER_SYSTEM) return { kind: 'native' }
  for (const module of Object.values(conceptMapModules)) {
    const map = module.default
    const group = map?.group?.find(g => g.source === system && g.target === RISK_TIER_SYSTEM)
    if (!map || !group) continue
    const rows: CrosswalkRow[] = []
    for (const element of group.element ?? []) {
      for (const target of element.target ?? []) {
        if (!element.code || !target.code || !target.equivalence) continue
        rows.push({
          source: { code: element.code, display: element.display },
          target: { code: target.code, display: target.display },
          equivalence: target.equivalence,
          comment: target.comment,
        })
      }
    }
    return { kind: 'crosswalk', title: map.title ?? map.name ?? system, url: map.url, draft: map.status === 'draft', rows }
  }
  return undefined
}

/**
 * The one word a route's precision is summarized by, and the rows that earn it.
 *
 * A route is as precise as its LOSSIEST row: a C-SSRS crosswalk that is exact
 * for three levels and related-to for the fourth is not an exact route, and a
 * reader deciding whether to act on a `high` needs to know that the `high` row
 * is the inexact one. So the rows that are not `equivalent` / `equal` are
 * returned beside the word, and the page names them.
 *
 *   native       no translation at all
 *   exact        every row equivalent
 *   approximate  some row related-to, inexact, or narrower — a neighbouring
 *                meaning, not a containment
 *   widened      some row wider or subsumes — the tier covers more than the
 *                source said, so precision the instrument had is gone
 */
export type RoutePrecision = 'native' | 'exact' | 'approximate' | 'widened'

const EXACT = new Set(['equivalent', 'equal'])
const WIDENING = new Set(['wider', 'subsumes'])

export function routePrecision(route: TierRoute): { precision: RoutePrecision; inexact: CrosswalkRow[] } {
  if (route.kind === 'native') return { precision: 'native', inexact: [] }
  const inexact = route.rows.filter(r => !EXACT.has(r.equivalence))
  if (inexact.length === 0) return { precision: 'exact', inexact }
  return { precision: inexact.some(r => WIDENING.has(r.equivalence)) ? 'widened' : 'approximate', inexact }
}
