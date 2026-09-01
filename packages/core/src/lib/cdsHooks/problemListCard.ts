/**
 * The problem-list guidance card — Phase 5 of
 * docs/plans/suicide-safer-care-pathway.md.
 *
 * When a patient's latest harmonized suicide-risk concept Observation (LOINC
 * 93374-7) carries a positive tier, the clinician is prompted to consider a
 * suicide-related problem-list entry. The card *suggests*; it never writes.
 *
 * ── The one rule this file exists to keep ────────────────────
 *
 * **SPiER NEVER writes a diagnosis code.** Decision 5 of the plan, and the
 * standing rule in `ig/input/fsh/suicide-related-conditions.fsh`: a screen is a
 * signal that a problem-list entry may be warranted; a problem-list entry is a
 * clinician's assertion. So this card carries **no `suggestions`** — not even a
 * `create` suggestion the clinician could accept — because a CDS Hooks
 * suggestion is an offer to apply a FHIR resource, and the resource on offer
 * would be a `Condition` derived from a screen. It carries no links either:
 * there is nothing for SPiER to launch, the work happens in the host's own
 * problem-list workflow.
 *
 * ── Where the words come from (Pattern A) ────────────────────
 *
 * ⚠️ **No SNOMED CT code, no ICD-10-CM code and no guidance sentence is written
 * in this file.** All of it is read out of the published
 * `PlanDefinition/SPiERSuicideSaferCarePathway` — its `problem-list-entry`
 * action and that action's two `documentation` notes — the same Pattern-A
 * contract `reassessment.ts` holds for the cadence and `pathway.ts` holds for
 * the guide page. Editing the FSH changes what the card says with no TypeScript
 * change.
 *
 * That is not only tidiness. The FSH is where the ICD-10-CM literals are
 * *commented with their verification record*, which matters because **no gate
 * checks ICD-10** — the nightly `check:codings` covers LOINC, SNOMED and
 * terminology.hl7.org only. Restating `R45.851` here would put an unverifiable
 * literal in a second place, and the diagram's wrong code (`Z91.82`, which is
 * *personal history of military deployment*) is exactly the kind of thing that
 * survives a copy. See `docs/reference/suicide-safer-care-pathway-spec.md`
 * §"ICD-10 correction (Phase 1d)" for the verification, and the FSH comment on
 * the action for the same record next to the codes themselves.
 *
 * Reading nothing is an error: a missing action, or an action whose
 * documentation has gone, throws rather than yielding a card with the guidance
 * quietly missing. Same #232/#261 stance `pathway.ts` takes, for the same
 * reason — the claim this card makes is "here is what the published protocol
 * says", so it must not be able to say it about nothing.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import { isRiskConcept } from '../measures'
import { loadPathway, type PathwayAction, type PathwayModel } from '../pathway'
import { RISK_TIER_SYSTEM } from '../riskEpisode'
import type { ObservationResource } from '../../types/fhir'
import { makeUuid, truncateSummary } from './cardShape'
import type { Card, CdsIndicator } from './types'

/** The pathway action group holding the steps SPiER prompts and a human performs. */
const GUIDANCE_GROUP_ID = 'clinician-guidance'
/** The action inside it that this card surfaces. */
const PROBLEM_LIST_ACTION_ID = 'problem-list-entry'

/** Deterministic card id, for React keys and for tests. */
export const PROBLEM_LIST_CARD_ID = 'cds-problem-list-guidance'

/**
 * What each harmonized tier means for this card: an indicator, or `null` for
 * "emit nothing".
 *
 * ── Why the ladder is capped at `warning` ────────────────────
 *
 * The stage and alert cards use `critical` for acute/high, because those cards
 * carry a clinical action. This one is a **documentation prompt**: a
 * problem-list entry is never the urgent thing to do for a patient at imminent
 * risk, and rendering it beside the STAT-safety-evaluation card at the same
 * urgency would flatten the difference. Tier still drives the indicator — it
 * just tops out one rung lower.
 *
 * ── Why every tier is listed, including the suppressed one ───
 *
 * `no-risk` maps to `null` rather than being left out, so "this tier
 * deliberately gets no card" is written down instead of being the accident of
 * an absent key. `problemListCard.test.ts` asserts these keys are EXACTLY the
 * concepts in the generated `spier-suicide-risk-tier` CodeSystem, so a tier
 * added in FSH fails the suite rather than silently emitting nothing — an
 * unlisted tier would otherwise read as "no guidance owed", which is a clinical
 * claim nobody made.
 */
const TIER_INDICATOR: Record<string, CdsIndicator | null> = {
  // A negative screen. The pathway's own rule: a screen never becomes a
  // Condition, and a screen that found nothing does not even prompt one.
  'no-risk': null,
  low: 'info',
  moderate: 'warning',
  high: 'warning',
  imminent: 'warning',
}

/** The tier codes this card knows about — exported for the drift test. */
export const KNOWN_TIER_CODES = Object.keys(TIER_INDICATOR)

/** A harmonized tier read off a concept Observation. */
export interface RiskConceptTier {
  code: string
  display?: string
  /** `effectiveDateTime` (or an `effectivePeriod.start`), when the resource has one. */
  effective?: string
}

/** `Observation.effectiveDateTime`, or the start of an `effectivePeriod`. */
function effectiveOf(o: ObservationResource): string | undefined {
  const r = o as { effectiveDateTime?: string; effectivePeriod?: { start?: string } }
  return r.effectiveDateTime ?? r.effectivePeriod?.start
}

/**
 * The most recent harmonized suicide-risk tier in a set of Observations, or
 * `null` when there is none.
 *
 * ⚠️ **Deliberately narrow: the value must be coded in `SPiERSuicideRiskTier`.**
 * Most instrument mappers put their *native* result on 93374-7 — an
 * `asq-screening-result`, a `cssrs-risk-level`, a `bssa-disposition` — and
 * translating one of those into a tier here would be a second implementation of
 * a crosswalk that already has a home (the per-instrument ConceptMaps, and the
 * mappers that derive `RiskAlert.level`). A card that guessed a tier would be
 * guessing about a problem-list entry, so it does not guess: it fires for the
 * observations that already carry the concept layer's own vocabulary — SAFE-T
 * and PSS-Full, which have the clinician assign the tier directly, and the
 * risk-status Observations a documented risk picture produces.
 *
 * Undated observations lose to dated ones rather than being dropped: a resource
 * with no `effective[x]` still says something, it just cannot claim to be the
 * latest.
 */
export function latestRiskConceptTier(observations: ObservationResource[]): RiskConceptTier | null {
  let best: { tier: RiskConceptTier; at: number } | null = null
  for (const o of observations) {
    if (!isRiskConcept(o)) continue
    const coding = o.valueCodeableConcept?.coding?.find(c => c.system === RISK_TIER_SYSTEM)
    if (!coding?.code) continue
    const effective = effectiveOf(o)
    const at = effective ? new Date(effective).getTime() : Number.NEGATIVE_INFINITY
    if (Number.isNaN(at)) continue
    if (best && at <= best.at) continue
    best = { tier: { code: coding.code, display: coding.display, effective }, at }
  }
  return best?.tier ?? null
}

/** Find one action by id anywhere in the pathway's action tree. */
function findAction(actions: PathwayAction[], id: string): PathwayAction | undefined {
  for (const action of actions) {
    if (action.id === id) return action
    const nested = findAction(action.children, id)
    if (nested) return nested
  }
  return undefined
}

function bail(message: string): never {
  throw new Error(`problem-list guidance card: ${message}`)
}

/** The pathway's guidance group and the problem-list action inside it. */
function guidanceSource(pathway: PathwayModel): { group: PathwayAction; action: PathwayAction } {
  const group = findAction(pathway.steps, GUIDANCE_GROUP_ID)
  if (!group) {
    bail(
      `no "${GUIDANCE_GROUP_ID}" action in ${pathway.url}. The card's whole claim is that it ` +
        'restates the published protocol, so an absent protocol is a build problem, not an empty card.',
    )
  }
  const action = findAction([group], PROBLEM_LIST_ACTION_ID)
  if (!action) {
    bail(`no "${PROBLEM_LIST_ACTION_ID}" action under "${GUIDANCE_GROUP_ID}" in ${pathway.url}.`)
  }
  if (action.documentation.length === 0) {
    bail(
      `"${PROBLEM_LIST_ACTION_ID}" carries no documentation. Its notes ARE the card's content — the ` +
        'SNOMED CT value set and the verified ICD-10-CM crosswalk — so a card without them would ' +
        'prompt a coding decision while naming no codes.',
    )
  }
  return { group, action }
}

/**
 * One documentation note, as plain prose.
 *
 * ⚠️ **No markdown, even though `Card.detail` is specified as GFM.** Both SPiER
 * renderers put the detail in a `textContent` / `{card.detail}` text node on
 * purpose — see the comment in `services/mock-ehr/src/chartPage.ts` — so `**` and
 * backticks would reach a clinician as literal punctuation. Emphasis that only
 * renders somewhere else is worse than none.
 */
function renderNote(note: { label?: string; display?: string; url?: string; resource?: string }): string {
  const body = note.display ?? note.url ?? note.resource ?? ''
  const head = note.label ? `${note.label}: ` : ''
  const trailer = note.resource ? ` Value set: ${note.resource}` : ''
  return `${head}${body}${trailer}`
}

/**
 * The problem-list guidance card for a patient's observations, or `null` when
 * no positive harmonized tier is on record.
 *
 * Suppressed — deliberately, each for a different reason — when:
 *   - there is no 93374-7 Observation carrying a `SPiERSuicideRiskTier` value
 *     (nothing to base guidance on: see `latestRiskConceptTier`);
 *   - the latest such tier is `no-risk` (a negative screen prompts nothing);
 *   - the latest such tier is a code this card does not know (a tier added to
 *     the CodeSystem without a decision recorded here — the drift test fails
 *     before this can reach a clinician).
 */
export function buildProblemListGuidanceCard(observations: ObservationResource[]): Card | null {
  const tier = latestRiskConceptTier(observations)
  if (!tier) return null
  if (!(tier.code in TIER_INDICATOR)) return null
  const indicator = TIER_INDICATOR[tier.code]
  if (indicator === null) return null

  const pathway = loadPathway()
  const { group, action } = guidanceSource(pathway)
  const tierLabel = tier.display ?? tier.code
  const recorded = tier.effective ? `, recorded ${tier.effective.slice(0, 10)}` : ''

  const detail = [
    `Current suicide-risk tier: ${tierLabel} (harmonized concept, LOINC 93374-7${recorded}).`,
    action.description ?? action.title,
    ...action.documentation.map(renderNote),
    'SPiER does not create the Condition. This card is guidance: the problem-list entry is a ' +
      "clinician assertion, recorded in the host system's own workflow.",
  ].join('\n\n')

  return {
    uuid: makeUuid(),
    summary: truncateSummary(`${action.title} (${tierLabel})`),
    detail,
    indicator,
    // The pathway itself is the source — label and canonical both read off the
    // artifact rather than restated, so a re-versioned protocol re-labels its
    // own cards.
    source: {
      label: pathway.title,
      url: pathway.url,
      ...(group.stage ? { topic: group.stage } : {}),
    },
    // No `links` and no `suggestions`. See the module header: a suggestion here
    // would be an offer to create a Condition from a screen.
    extension: {
      'spier-card-id': PROBLEM_LIST_CARD_ID,
      ...(group.stage ? { 'spier-stage-id': group.stage.code } : {}),
    },
  }
}
