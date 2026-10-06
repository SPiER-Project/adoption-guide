/**
 * The concept layer, on the wire: one harmonized suicide-risk Observation per
 * instrument result, derived the way the published maps say.
 *
 * ── What this closes ────────────────────────────────────────
 *
 * The IG publishes `SPiERSuicideRiskConcept` — LOINC 93374-7 valued in the
 * instrument-agnostic `SPiERSuicideRiskTier` — and the Translate pillar rests on
 * it: a receiving system acts on the tier without understanding the tool that
 * produced it. Until this module, the app derived it for **no** instrument.
 * ASQ, BSSA, the C-SSRS family, CAMS and PSS-3 wrote their NATIVE result codes
 * onto 93374-7, SPiER's own readers translated those at read time through the
 * ConceptMaps, and an EHR receiving SPiER's writeback got codes it would have
 * to translate itself. The published CQL (`Risk Concept Observations`) counts
 * only Observations claiming the profile, so against SPiER's own output every
 * concept-layer measure counted nothing outside the seeded fixtures.
 *
 * ── How a tier is derived — the published artifacts, nothing new ──
 *
 * - **A coded result on 93374-7** translates through the published ConceptMap
 *   for its system (`conceptCrosswalk.ts`), which is what
 *   `ASQResultToSuicideRiskConcept.fml` and `CSSRSRiskLevelToSuicideRiskConcept.fml`
 *   do, and covers BSSA, CAMS and PSS-3 by the same rule. A result already coded
 *   in the tier vocabulary (SAFE-T, PSS-Full) is its own translation.
 * - **PHQ-9 item 9 and the SBQ-R total** have no ConceptMap; their published
 *   maps are thresholds (`PHQ9Item9ToSuicideRiskConcept.fml`,
 *   `SBQRTotalScoreToSuicideRiskConcept.fml`). The two functions below restate
 *   those thresholds, and `riskConcept.test.ts` evaluates the `.fml` rules over
 *   every score to hold them equal — the Stanley-Brown arrangement, one map in
 *   two languages under a parity test.
 *
 * ⚠️ **The tier assignments are the published maps', and those are marked
 * pending SME sign-off.** Deriving a concept from a PHQ-9 screen means a screen
 * now records a tier; whether a later SCREEN's tier should supersede an earlier
 * ASSESSMENT's is an open clinical question recorded in `pathwayEvaluation.ts`.
 *
 * ── The shape ───────────────────────────────────────────────
 *
 * Exactly the FML maps' target: status, code, subject and effective carried
 * from the source; the survey + domain categories; `derivedFrom` the source
 * Observation; the tier as value; POS/NEG as interpretation. The source's
 * pathway-stage tag and encounter are carried too, because screens and
 * assessments are told apart by stage and artifacts reach their episode through
 * the encounter.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import type { ObservationResource } from '../types/fhir'
import { displayFor } from './codedOption'
import { tierForCodings } from './conceptCrosswalk'
import { suicideRiskCategory } from './conceptDomain'
import { PATHWAY_STAGE_SYSTEM } from './patientPathway'
import { RISK_TIER_SYSTEM, RISK_TIERS } from './riskEpisode'

export const RISK_CONCEPT_PROFILE = 'http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-concept'
/** The generic concept-layer code the risk-concept profile mandates. */
export const RISK_CONCEPT_LOINC = '93374-7'
/** PHQ-9 item 9 — the screen's suicide-risk gateway item. */
export const PHQ9_ITEM9_LOINC = '44260-8'
/** The SBQ-R total score's code, as `sbqr.ts` and the FML source declare it. */
const SBQR_TOTAL_SNOMED = '225337009'

/**
 * POS / NEG, the interpretation every published concept map writes.
 *
 * Repeated system literals for the reason `observationMappers/shared.ts` gives:
 * `check-codings.mjs` reads `system`, `code` and `display` as sibling string
 * literals.
 */
const CONCEPT_INTERPRETATION = {
  POS: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'POS', display: 'Positive' },
  NEG: { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'NEG', display: 'Negative' },
} as const

type Coded = { system?: string; code?: string }
type ObservationShape = {
  id?: string
  meta?: { profile?: string[]; tag?: Coded[] }
  code?: { coding?: Coded[] }
  valueCodeableConcept?: { coding?: Coded[] }
  valueInteger?: number
  subject?: unknown
  encounter?: unknown
  effectiveDateTime?: string
  effectivePeriod?: unknown
}

function hasCode(o: ObservationShape, system: string, code: string): boolean {
  return !!o.code?.coding?.some(c => c.system === system && c.code === code)
}

function claimsConceptProfile(o: ObservationShape): boolean {
  return !!o.meta?.profile?.includes(RISK_CONCEPT_PROFILE)
}

/**
 * Is this the harmonized suicide-risk concept Observation?
 *
 * ⚠️ **Narrowed 2026-10-06, and the narrowing is the point.** It used to accept
 * any Observation on LOINC 93374-7, which made every instrument's NATIVE result
 * — a `cssrs-risk-level`, an `asq-screening-result` — count as "the concept",
 * while the published CQL counts only the profile claim. Now:
 *
 * - **Claims the profile** → yes. That is the CQL's own rule.
 * - **Claims some OTHER profile** → no. A SAFE-T result is tier-valued, but it
 *   says it is a `spier-safet-risk-level`; its concept is the Observation
 *   derived from it, and counting both would count one assessment twice.
 * - **Claims nothing** → judged by content: 93374-7 valued in the tier
 *   vocabulary. Another system's concept Observation is unlikely to populate
 *   `meta.profile`, and its content is exactly what the profile requires.
 */
export function isRiskConcept(o: ObservationResource): boolean {
  const r = o as ObservationShape
  if (claimsConceptProfile(r)) return true
  if (r.meta?.profile?.length) return false
  if (!hasCode(r, 'http://loinc.org', RISK_CONCEPT_LOINC)) return false
  return !!r.valueCodeableConcept?.coding?.some(c => c.system === RISK_TIER_SYSTEM && !!c.code)
}

/** `PHQ9Item9ToSuicideRiskConcept.fml`: the item-9 ordinal, 0–3. */
export function phq9Item9Tier(score: number): string | undefined {
  return ({ 0: 'no-risk', 1: 'low', 2: 'moderate', 3: 'high' } as Record<number, string>)[score]
}

/** `SBQRTotalScoreToSuicideRiskConcept.fml`: below 7, exactly 7, 8 and above. */
export function sbqrTotalTier(total: number): string {
  if (total < 7) return 'no-risk'
  if (total < 8) return 'moderate'
  return 'high'
}

/**
 * The harmonized tier an instrument result translates to, or `undefined` when
 * it is not a result the published maps cover.
 *
 * Anything `isRiskConcept` already accepts is never a source — including an
 * UNPROFILED tier-coded Observation such as a documented risk status, which is
 * a concept by its content. Deriving from one would put the same tier on the
 * chart twice.
 */
export function tierForResult(o: ObservationResource): string | undefined {
  const r = o as ObservationShape
  if (isRiskConcept(o)) return undefined
  if (hasCode(r, 'http://loinc.org', RISK_CONCEPT_LOINC)) return tierForCodings(r.valueCodeableConcept?.coding)
  if (typeof r.valueInteger !== 'number') return undefined
  if (hasCode(r, 'http://loinc.org', PHQ9_ITEM9_LOINC)) return phq9Item9Tier(r.valueInteger)
  if (hasCode(r, 'http://snomed.info/sct', SBQR_TOTAL_SNOMED)) return sbqrTotalTier(r.valueInteger)
  return undefined
}

/** The id a source's concept Observation carries. Deterministic, so a re-derivation finds it. */
export function riskConceptId(sourceId: string): string {
  return `${sourceId}-concept`
}

/** The concept Observation derived from one instrument result, or `null`. */
export function riskConceptFor(source: ObservationResource): ObservationResource | null {
  const r = source as ObservationShape
  const tier = tierForResult(source)
  // `derivedFrom` is 1..* in the profile: a source with no id cannot be pointed at.
  if (!tier || !r.id) return null
  const display = displayFor(RISK_TIERS, tier)
  const stageTags = (r.meta?.tag ?? []).filter(t => t.system === PATHWAY_STAGE_SYSTEM)
  const interpretation = tier === 'no-risk' ? CONCEPT_INTERPRETATION.NEG : CONCEPT_INTERPRETATION.POS
  return {
    resourceType: 'Observation',
    id: riskConceptId(r.id),
    meta: {
      profile: [RISK_CONCEPT_PROFILE],
      ...(stageTags.length ? { tag: stageTags.map(t => ({ ...t })) } : {}),
    },
    status: 'final',
    category: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }],
      },
      suicideRiskCategory(),
    ],
    code: { coding: [{ system: 'http://loinc.org', code: RISK_CONCEPT_LOINC, display: 'Suicide risk level' }] },
    ...(r.subject ? { subject: r.subject } : {}),
    ...(r.encounter ? { encounter: r.encounter } : {}),
    ...(r.effectiveDateTime ? { effectiveDateTime: r.effectiveDateTime } : {}),
    ...(r.effectivePeriod ? { effectivePeriod: r.effectivePeriod } : {}),
    derivedFrom: [{ reference: `Observation/${r.id}` }],
    valueCodeableConcept: { coding: [{ system: RISK_TIER_SYSTEM, code: tier, display }] },
    interpretation: [{ coding: [{ ...interpretation }] }],
  } as ObservationResource
}

/**
 * The same Observations with each derivable result's concept placed right after
 * it. Idempotent: a source whose concept is already in the list is not derived
 * twice, so running this over a chart that already carries concepts — a
 * scenario fixture, a slice read back from a server — changes nothing.
 *
 * "Already in the list" is read off the concept's `derivedFrom`, not its id: a
 * server assigns its own ids, so a concept read back from one is recognized by
 * what it points at.
 */
export function withRiskConcepts(observations: ObservationResource[]): ObservationResource[] {
  const derived = new Set(
    observations
      .filter(o => claimsConceptProfile(o as ObservationShape))
      .flatMap(o => (o as { derivedFrom?: Array<{ reference?: string }> }).derivedFrom ?? [])
      .map(ref => ref.reference)
      .filter((ref): ref is string => !!ref),
  )
  const out: ObservationResource[] = []
  for (const o of observations) {
    out.push(o)
    const id = (o as ObservationShape).id
    if (id && derived.has(`Observation/${id}`)) continue
    const concept = riskConceptFor(o)
    if (concept) out.push(concept)
  }
  return out
}
