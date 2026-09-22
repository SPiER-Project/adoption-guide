/**
 * What the published pathway owes this patient, read off the record.
 *
 * ── What this replaces ──────────────────────────────────────
 *
 * Until 2026-09-21 the clinical surfaces answered "what do I do for this
 * patient" three times and disagreed twice (clinical-app audit §1.4, §1.5). The
 * chart's first card was *the active stage's lead tool*, which for five of the
 * eight stages is a product default (`PATHWAY_STAGE_DEFAULTS`) rather than
 * anything the published protocol names; beside it sat one card per live risk
 * alert, which nothing ever retired — so a chart whose *Clarify Risk* step was
 * complete, and held the C-SSRS Screener, still said **Start C-SSRS Screener**.
 * The one card the protocol actually obliged at moderate risk, a safety plan,
 * came third.
 *
 * This module is the single answer: **the first step of
 * `PlanDefinition/SPiERSuicideSaferCarePathway` this record has not satisfied.**
 * Decided 2026-09-21 (audit §7, items 1 and 2) — the published pathway and
 * nothing beside it; custom pathways are a later decision, which is why the
 * protocol is a parameter here rather than a hardcoded load.
 *
 * ── Two things it reads that are NOT in the artifact ────────
 *
 * ⚠️ **Priority.** The pathway states the obligations a tier carries; it does
 * not rank them. There is no `action.priority` and no `selectionBehavior`
 * anywhere in it, and FHIR does not make `action` order a ranking. So the
 * ranking below is declared here, from audit §4.5's table and decision §7.2:
 * *the pathway names no formulation step, so the safety plan is primary.* If
 * the protocol ever states a priority, this table should read it instead.
 *
 * ⚠️ **Satisfaction.** "Recorded after the trigger" is the audit's rule, and
 * which artifact kind satisfies which step is a reading of the step's
 * `definitionCanonical` plus the profile that activity emits. Both are stated
 * per obligation below.
 *
 * ── And two it deliberately does not answer ─────────────────
 *
 * - **`high-missed-appointment-outreach`** is a published high-risk obligation
 *   and this evaluator never emits it. It is gated on an event — the patient
 *   missed or no-showed a scheduled appointment — that lives in the Stage-5/6
 *   appointment rollup, not in the pathway's own tier condition. Emitting it
 *   unconditionally would tell a clinician to chase a patient who attended.
 * - **The tier `imminent`** has no group in the protocol; the tier branch
 *   covers low / moderate / high only, for the reasons `risk-episode.fsh`
 *   records. It is treated here as carrying at least the high-risk group's
 *   obligations, which is a monotonicity reading rather than an invention — the
 *   escalation CodeSystem already defines `high-risk-status` as "the patient's
 *   current risk tier is high **or imminent**". Its reassessment obligation
 *   drops out on its own, because the published schedule publishes no cadence
 *   for it.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import { toolForActivityDefinition, type Tool } from '../data/catalog'
import { bestArtifactDate, shortDate } from './artifactDate'
import { tierForCodings } from './conceptCrosswalk'
import { conformsTo, isRiskConcept, observationStage } from './measures'
import { CRISIS_RESOURCES_PROFILE } from './crisisResources'
import { COUNSELING_PROFILE } from './lethalMeans'
import { loadPathway, type PathwayAction, type PathwayModel } from './pathway'
import { stageForArtifact, toolForResponse, type FhirResourceLike } from './patientPathway'
import {
  reassessmentStateForTier,
  reassessmentStatusLabel,
  type ReassessmentState,
} from './reassessment'
import { episodeCurrentTier, findOpenEpisode, RISK_TIERS } from './riskEpisode'
import { displayFor } from './codedOption'
import type { RiskAlert } from './observationMappers'
import type {
  CarePlanResource,
  CommunicationResource,
  EpisodeOfCareResource,
  ObservationResource,
  PatientSlice,
  ProcedureResource,
  StoredResponse,
} from '../types/fhir'

/**
 * The lethal-means activity, which the pathway's STAT safety evaluation names
 * in prose rather than as `definitionCanonical`.
 *
 * ⚠️ Not an oversight in the FSH, and not something to "fix" by adding the
 * canonical there: the published step is a three-part evaluation — counsel on
 * lethal means, assess and engage immediate supports, alert the responsible
 * provider — and only the first part has a modeled activity. The FSH says so
 * explicitly, because a `definitionCanonical` would claim the whole step is
 * that one activity. So the step keeps its published title and description, and
 * the launch offered against it is the part SPiER can actually record.
 */
const MEANS_SAFETY_CANONICAL =
  'http://thespierproject.org/fhir/ActivityDefinition/ProvideMeansSafetyCounseling'

/** The reassessment cadence the tier groups reference rather than restate. */
const REASSESSMENT_SCHEDULE_CANONICAL =
  'http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule'

const CRISIS_RESOURCES_CANONICAL =
  'http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources'

const SAFETY_PLAN_CANONICAL =
  'http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown'

/** The PHQ-9 item-9 LOINC — the gate the published protocol's realization reads. */
const PHQ9_ITEM9_LOINC = '44260-8'

/** What a step asks the clinician to do. */
export type ObligationKind =
  | 'screen'
  | 'assess'
  | 'safety-plan'
  | 'crisis-resources'
  | 'stat-safety-evaluation'
  | 'direct-question'
  | 'reassess'

/**
 * How pressing the obligation is, in the record's terms rather than a
 * renderer's. `cdsHooks/cards.ts` maps these onto CDS Hooks indicators; keeping
 * the vocabulary out of `packages/core`'s domain layer is why this is not just
 * `CdsIndicator`.
 */
export type ObligationUrgency = 'routine' | 'elevated' | 'urgent'

export interface ObligationTool {
  id: string
  /** The launch button's words, from the tool's own launch action. */
  label: string
  /** In-app router path. */
  path: string
}

export interface PathwayObligation {
  kind: ObligationKind
  /** The published action this realizes — `action.id` in the PlanDefinition. */
  actionId: string
  /** The pathway stage the step sits at, for grouping on the chart. */
  stageId: string
  /** The act, in the clinician's words. */
  title: string
  /**
   * The published step's own description — what the protocol says the act is.
   * Carried for the "Why this?" page and for the cards that have no button of
   * their own; a card with a launch does not repeat it.
   */
  description: string
  /** Why it is due now, as the trigger reads on the chart. */
  reason: string
  urgency: ObligationUrgency
  /** The tool that records it, when one does. */
  tool: ObligationTool | null
  /**
   * A standing instruction rather than an artifact to produce — "ask the direct
   * question at every contact". It is always listed and is never the primary,
   * because no record can retire it and a card that can never be completed
   * would sit at the top of the chart forever.
   */
  standing: boolean
}

export interface PathwayEvaluation {
  /** The one thing to do now, or null when nothing is due. */
  primary: PathwayObligation | null
  /** The rest of what the tier owes, in the order the pathway's table states. */
  alsoDue: PathwayObligation[]
  /** One sentence in the clinician's words: why this, or why nothing. */
  reason: string
  /** The harmonized tier the record carries, or null. */
  tier: { code: string; display: string; recordedOn?: string } | null
  /** The cadence state, once a tier is on record. */
  reassessment: ReassessmentState | null
  /**
   * Whether anything on this record answers "has this patient been screened".
   *
   * ⚠️ **"Not screened" and "screened, nothing found" are different facts and
   * must not render as one word.** `riskLabel.ts` has said so for as long as
   * the identity strip has existed — *a chart that has never been screened
   * must not read as cleared* — and the caseload had no way to tell them apart,
   * because its risk level came from `highestRiskLevel([])`, which is `none`.
   * The evaluator is the one place that already knows: it is the same question
   * as "does the protocol's first row apply".
   */
  screened: boolean
}

/** The slice of a chart this evaluator reads. Every bucket is optional. */
export interface PathwayRecord {
  responses?: StoredResponse[]
  observations?: ObservationResource[]
  carePlans?: CarePlanResource[]
  communications?: CommunicationResource[]
  procedures?: ProcedureResource[]
  episodes?: EpisodeOfCareResource[]
  riskAlerts?: RiskAlert[]
}

export interface EvaluatePathwayOptions {
  /**
   * The protocol to evaluate against. Defaults to the published pathway, which
   * is the only one SPiER ships today — a parameter so that a second published
   * protocol is a call site, not a rewrite (audit §7 item 2).
   */
  pathway?: PathwayModel
  now?: Date
}

/* ─── Reading the record ────────────────────────────────────── */

function asSlice(record: PathwayRecord): PatientSlice {
  return {
    responses: record.responses ?? [],
    observations: record.observations ?? [],
    carePlans: record.carePlans ?? [],
    riskAlerts: record.riskAlerts ?? [],
    communications: record.communications ?? [],
    procedures: record.procedures ?? [],
    episodes: record.episodes ?? [],
  }
}

function timeOf(value: string | undefined): number {
  if (!value) return NaN
  const at = new Date(value).getTime()
  return Number.isFinite(at) ? at : NaN
}

/** Resources at a stage, newest last, each paired with its parsed date. */
interface Dated<T> {
  resource: T
  date: string
  at: number
}

function dated<T extends FhirResourceLike>(resources: T[]): Dated<T>[] {
  return resources
    .map(resource => {
      const date = bestArtifactDate(resource)
      return { resource, date: date ?? '', at: timeOf(date) }
    })
    .filter(d => Number.isFinite(d.at))
    .sort((a, b) => a.at - b.at)
}

/** Every artifact that counts as a screen: a Stage-1 response or result. */
function screenArtifacts(slice: PatientSlice): Dated<FhirResourceLike>[] {
  const responses = slice.responses
    .filter(r => toolForResponse(r.resource)?.stageId === 'identify-possible-risk')
    .map(r => r.resource as FhirResourceLike)
  const results = (slice.observations ?? []).filter(
    o => isRiskConcept(o) && observationStage(o, slice) === 'identify-possible-risk',
  )
  return dated([...responses, ...(results as FhirResourceLike[])])
}

/** Every artifact that counts as a clarifying assessment. */
function assessmentArtifacts(slice: PatientSlice): Dated<FhirResourceLike>[] {
  const responses = slice.responses
    .filter(r => toolForResponse(r.resource)?.stageId === 'clarify-risk')
    .map(r => r.resource as FhirResourceLike)
  const results = (slice.observations ?? []).filter(
    o => isRiskConcept(o) && observationStage(o, slice) === 'clarify-risk',
  )
  return dated([...responses, ...(results as FhirResourceLike[])])
}

/**
 * Whether a screen found anything.
 *
 * The published gate is "item 9 ≥ 1, or a result that crosswalks above
 * no-risk" — never `RiskAlert.level`, which is an instrument's own reading of
 * itself. Both halves are read off the record here.
 */
function screenIsPositive(slice: PatientSlice): boolean {
  for (const o of slice.observations ?? []) {
    const codings = (o as { code?: { coding?: Array<{ system?: string; code?: string }> } }).code?.coding
    const isItem9 = codings?.some(c => c.system === 'http://loinc.org' && c.code === PHQ9_ITEM9_LOINC)
    if (isItem9 && typeof o.valueInteger === 'number' && o.valueInteger >= 1) return true
    if (!isRiskConcept(o) || observationStage(o, slice) !== 'identify-possible-risk') continue
    const tier = tierForCodings(o.valueCodeableConcept?.coding)
    if (tier && tier !== 'no-risk') return true
  }
  return false
}

/** One harmonized tier on the record, with the Observation that carries it. */
interface TierPoint {
  code: string
  date: string
  at: number
  observation: ObservationResource
}

/** Every harmonized tier on the record, oldest first. */
function tierHistory(slice: PatientSlice): TierPoint[] {
  return (slice.observations ?? [])
    .filter(isRiskConcept)
    .map(o => {
      const date = bestArtifactDate(o as FhirResourceLike)
      return {
        code: tierForCodings(o.valueCodeableConcept?.coding),
        date: date ?? '',
        at: timeOf(date),
        observation: o,
      }
    })
    .filter((t): t is TierPoint => !!t.code && Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at)
}

/* ─── Finding the steps in the protocol ─────────────────────── */

function bail(message: string): never {
  throw new Error(`pathway evaluation: ${message}`)
}

/** The one top-level step coded to this stage, or undefined. */
function stepAtStage(pathway: PathwayModel, stageId: string): PathwayAction | undefined {
  return pathway.steps.find(step => step.stage?.code === stageId)
}

/** The child of `action` whose `definitionCanonical` is `canonical`. */
function childFor(action: PathwayAction | undefined, canonical: string): PathwayAction | undefined {
  return action?.children.find(c => c.definitionCanonical === canonical)
}

/** The tier group the protocol states for this tier code, or undefined. */
function tierGroup(pathway: PathwayModel, tierCode: string): PathwayAction | undefined {
  return pathway.tierBranch.tiers.find(t => t.tier?.code === tierCode)
}

function toolLaunch(tool: Tool | undefined): ObligationTool | null {
  const action = tool?.launchActions[0]
  if (!tool || !action) return null
  return { id: tool.id, label: action.label, path: action.path }
}

/* ─── Building an obligation ────────────────────────────────── */

function obligation(params: {
  kind: ObligationKind
  action: PathwayAction
  /** Overrides the published title where it does not work as a headline. */
  title?: string
  reason: string
  urgency: ObligationUrgency
  tool?: Tool
  standing?: boolean
}): PathwayObligation {
  const { action } = params
  if (!action.stage?.code) {
    bail(`published step "${action.id}" carries no pathway-stage code, so a card for it has nowhere to sit`)
  }
  return {
    kind: params.kind,
    actionId: action.id,
    stageId: action.stage.code,
    title: params.title ?? action.title,
    description: action.description ?? action.title,
    reason: params.reason,
    urgency: params.urgency,
    tool: toolLaunch(params.tool),
    standing: params.standing ?? false,
  }
}

function urgencyForTier(tierCode: string | null): ObligationUrgency {
  if (tierCode === 'high' || tierCode === 'imminent') return 'urgent'
  if (tierCode === 'moderate') return 'elevated'
  return 'routine'
}

/** "C-SSRS Screener on Sep 3" — the artifact a clinician would point at. */
function artifactPhrase(
  resource: FhirResourceLike | undefined,
  slice: PatientSlice,
  now: Date,
): string | null {
  if (!resource) return null
  const when = shortDate(bestArtifactDate(resource), now)
  const name = instrumentName(resource, slice)
  if (!name) return when
  return when ? `${name} on ${when}` : name
}

/**
 * The instrument behind an artifact, in the words a clinician uses for it.
 *
 * A QuestionnaireResponse names its own Questionnaire; a derived Observation
 * carries `derivedFrom` back to the response it came from, which is the hop the
 * mappers leave for readers rather than restating the tool on every resource.
 *
 * Exported since 2026-09-21 because *What’s on file* asks the same question of
 * every row it renders, and `check:dupes` fails the paste. Its one heuristic
 * branch is why it is shared rather than reimplemented: a second copy would
 * name a different instrument on the same artifact the day either was tuned.
 */
export function instrumentName(resource: FhirResourceLike, slice: PatientSlice): string | null {
  if (resource.resourceType === 'QuestionnaireResponse') {
    const tool = toolForResponse(resource)
    if (tool) return tool.shortName ?? tool.name
  }
  const stored = sourceResponse(resource, slice)
  if (!stored) return null
  const tool = toolForResponse(stored.resource)
  return tool ? (tool.shortName ?? tool.name) : stored.questionnaireName
}

/**
 * The completed form an artifact came from, or null.
 *
 * ⚠️ **Split out of `instrumentName` on 2026-09-22 rather than copied.** The
 * record page has to LINK a result back to the form that produced it, and the
 * name alone cannot be linked; a second walk would be a second answer to "which
 * form is this from" the day either was tuned, which is what `check:dupes`
 * exists to stop. `instrumentName` is the name of what this returns, and
 * nothing else now resolves it.
 */
export function sourceResponse(
  resource: FhirResourceLike,
  slice: PatientSlice,
): PatientSlice['responses'][number] | null {
  const derivedFrom = (resource as { derivedFrom?: Array<{ reference?: string }> }).derivedFrom ?? []
  for (const ref of derivedFrom) {
    const id = ref.reference?.replace('QuestionnaireResponse/', '')
    const stored = id ? slice.responses.find(r => r.id === id) : undefined
    if (stored) return stored
  }
  // ⚠️ Last resort, and a heuristic rather than a link: the latest response at
  // the same pathway stage, recorded no later than this artifact. The scenario
  // fixtures' Observations predate `derivedFrom` and carry only a stage tag, so
  // without this the chart would say "Aug 6: no risk identified" where a
  // clinician expects "ASQ on Aug 6". Naming the wrong instrument is the risk
  // it carries, which is why it is the last thing tried and why it is confined
  // to one stage, one direction in time and the SAME DAY. Without the day bound
  // it named a CAMS worksheet from two months earlier as the source of a risk
  // status recorded in July — a plausible sentence that was not true.
  const stage = stageForArtifact(resource)
  const date = bestArtifactDate(resource)
  const at = timeOf(date)
  if (!stage || !Number.isFinite(at)) return null
  const day = (value: string | undefined) => (value ? value.slice(0, 10) : null)
  const sameStage = slice.responses
    .filter(r => stageForArtifact(r.resource as FhirResourceLike) === stage)
    .map(r => {
      const on = bestArtifactDate(r.resource as FhirResourceLike)
      return { stored: r, at: timeOf(on), on }
    })
    .filter(r => Number.isFinite(r.at) && r.at <= at && day(r.on) === day(date))
    .sort((a, b) => a.at - b.at)
    .at(-1)
  return sameStage?.stored ?? null
}

/* ─── The walk ──────────────────────────────────────────────── */

/**
 * The first unsatisfied step of the protocol, and what else is owed.
 *
 * The walk is audit §4.5's table, top to bottom: no screen → screen; positive
 * screen with no assessment after it → assess; a negative assessment leaves the
 * pathway; otherwise the tier's obligations in the declared order, and finally
 * the cadence.
 */
export function evaluatePathway(
  record: PathwayRecord,
  options: EvaluatePathwayOptions = {},
): PathwayEvaluation {
  const slice = asSlice(record)
  // ⚠️ Stamped HERE, at one exit, rather than on each of the walk's six
  // returns. "Has this patient been screened" is a property of the record and
  // not of which row matched, and threading it through every branch is how one
  // branch ends up saying something different from the others.
  const screened =
    screenArtifacts(slice).length > 0 ||
    assessmentArtifacts(slice).length > 0 ||
    tierHistory(slice).length > 0
  return { ...walkPathway(record, options), screened }
}

function walkPathway(
  record: PathwayRecord,
  options: EvaluatePathwayOptions,
): Omit<PathwayEvaluation, 'screened'> {
  const now = options.now ?? new Date()
  const pathway = options.pathway ?? loadPathway()
  const slice = asSlice(record)

  const screenStep = stepAtStage(pathway, 'identify-possible-risk')
  const assessStep = stepAtStage(pathway, 'clarify-risk')
  if (!screenStep || !assessStep) {
    bail(
      `${pathway.url} states no step at identify-possible-risk and clarify-risk. The screen and the ` +
        'gate are the first two rows of the protocol, so a pathway missing either is a parse that read ' +
        'the wrong thing rather than a patient with nothing to do.',
    )
  }

  const screens = screenArtifacts(slice)
  const assessments = assessmentArtifacts(slice)
  const tiers = tierHistory(slice)
  const latestTier = tiers.at(-1) ?? null
  const openEpisodeTier = episodeCurrentTier(findOpenEpisode(slice.episodes ?? []))
  // The Observation wins over the episode's extension: the extension is
  // documented as a denormalized cache of the latest concept Observation, so
  // where both exist the Observation is the fresher of the two.
  const tierCode = latestTier?.code ?? openEpisodeTier ?? null
  const tier = tierCode
    ? {
        code: tierCode,
        display: displayFor(RISK_TIERS, tierCode),
        ...(latestTier?.date ? { recordedOn: latestTier.date } : {}),
      }
    : null

  /* Row 1 — a positive screen with no assessment after it.
   *
   * ⚠️ **Checked BEFORE "nothing on file", not after.** A foreign EHR's PHQ-9
   * arrives under its own canonical, so the tool catalog cannot recognize the
   * response and it counts as no screen at all — but the fallback dispatcher
   * still derives an item-9 Observation from it, and the published gate is on
   * that item, not on whether SPiER recognized the form. Asking a patient with
   * a positive item 9 to be screened is the exact defect this evaluator exists
   * to stop, so the positive gate is read first.
   */
  const latestScreen = screens.at(-1)
  const assessedAfterScreen = assessments.some(a => !latestScreen || a.at >= latestScreen.at)
  if (screenIsPositive(slice) && !assessedAfterScreen) {
    const realization = assessStep.children.find(c => !!c.definitionCanonical)
    const trigger = artifactPhrase(latestScreen?.resource, slice, now)
    return one(
      obligation({
        kind: 'assess',
        action: assessStep,
        reason: trigger ? `${trigger}: positive screen.` : 'A screen on this chart was positive.',
        // A screen that already crosswalks to a high or imminent tier is not a
        // routine "please assess": the urgency the screen found travels with
        // the step it triggers.
        urgency: tierCode ? urgencyForTier(tierCode) : 'elevated',
        tool: toolForActivityDefinition(realization?.definitionCanonical),
      }),
      [],
      tier,
      null,
    )
  }

  /* Row 2 — nothing on file at all. */
  if (screens.length === 0 && assessments.length === 0 && tiers.length === 0) {
    const realization = screenStep.children.find(c => !!c.definitionCanonical)
    return one(
      obligation({
        kind: 'screen',
        action: screenStep,
        reason: 'No suicide-risk screen on file.',
        urgency: 'routine',
        tool: toolForActivityDefinition(realization?.definitionCanonical),
      }),
      [],
      tier,
      null,
    )
  }

  /* Row 2b — assessed, but the result records no suicide-risk level.
   *
   * ⚠️ **Not the same as a negative assessment, and saying so matters.** The
   * tier branch is the whole rest of the protocol and it is gated on the
   * harmonized concept; an assessment whose result carries no tier leaves the
   * pathway unable to say what is owed. Falling through to the row below would
   * print "no risk identified" about a patient nobody said that about. The demo
   * reaches this today: the CAMS Section A mapper records its overall risk as a
   * bare integer on LOINC 93374-7, so the published CAMS crosswalk — which is
   * keyed on a coded rating — has nothing to translate.
   */
  if (assessments.length > 0 && !tierCode) {
    const phrase = artifactPhrase(assessments.at(-1)?.resource, slice, now)
    return {
      primary: null,
      alsoDue: [],
      reason:
        `${phrase ? `${phrase} is on file, but it` : 'The assessment on file'} records no suicide-risk ` +
        'level, so the pathway cannot say what is owed.',
      tier,
      reassessment: null,
    }
  }

  /* Row 3 — the patient does not enter the pathway. */
  if (!tierCode || tierCode === 'no-risk') {
    const phrase = artifactPhrase(assessments.at(-1)?.resource ?? latestScreen?.resource, slice, now)
    return {
      primary: null,
      alsoDue: [],
      reason: phrase
        ? `Nothing is due. ${phrase}: no risk identified — re-screen at the next depression screen.`
        : 'Nothing is due. No risk identified — re-screen at the next depression screen.',
      tier,
      reassessment: null,
    }
  }

  /* Rows 4–6 — the tier's obligations. `tier` is non-null here: the row above
   * returned for every record that carries no tier or a `no-risk` one. */
  if (!tier) return { primary: null, alsoDue: [], reason: 'Nothing is due.', tier: null, reassessment: null }
  return evaluateTier({ pathway, slice, tier, tiers, now })
}

function one(
  primary: PathwayObligation,
  alsoDue: PathwayObligation[],
  tier: PathwayEvaluation['tier'],
  reassessment: ReassessmentState | null,
): Omit<PathwayEvaluation, 'screened'> {
  return { primary, alsoDue, reason: primary.reason, tier, reassessment }
}

/**
 * The obligations a tier carries, in the order the audit's table ranks them.
 *
 * ⚠️ **The ranking is here and not in the artifact** — see the module header.
 * The pathway's own `action` order puts crisis resources before the safety
 * plan; FHIR does not make that a priority, and decision §7.2 ranks the safety
 * plan first at moderate and high.
 */
function evaluateTier(params: {
  pathway: PathwayModel
  slice: PatientSlice
  tier: NonNullable<PathwayEvaluation['tier']>
  tiers: TierPoint[]
  now: Date
}): Omit<PathwayEvaluation, 'screened'> {
  const { pathway, slice, tier, tiers, now } = params

  // `imminent` has no group of its own; it carries at least the high-risk
  // group's obligations. See the module header for why that is a reading of the
  // published artifacts rather than an addition to them.
  const groupCode = tier.code === 'imminent' ? 'high' : tier.code
  const group = tierGroup(pathway, groupCode)
  if (!group) {
    return {
      primary: null,
      alsoDue: [],
      reason: `Nothing is due. The published pathway states no obligations for ${tier.display.toLowerCase()}.`,
      tier,
      reassessment: null,
    }
  }

  // The trigger is the start of the CURRENT unbroken run of this tier — the
  // assessment that put the patient here, not the most recent one to confirm
  // it. A reassessment that reports the same tier does not re-owe a safety plan
  // the patient already has; an escalation to a new tier does.
  let runStart = tiers.at(-1)
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (tiers[i].code !== tier.code) break
    runStart = tiers[i]
  }
  const triggerAt = runStart?.at ?? Number.NEGATIVE_INFINITY
  const trigger =
    artifactPhrase(runStart?.observation as FhirResourceLike | undefined, slice, now) ??
    (runStart?.date
      ? `Risk recorded ${shortDate(runStart.date, now)}`
      : // No tier Observation at all — the tier came off the open episode, which
        // is where it is cached between assessments.
        'Risk on the open episode')
  const reason = `${trigger}: ${tier.display.toLowerCase()}.`
  const urgency = urgencyForTier(tier.code)

  const recordedAfter = (resources: FhirResourceLike[], profile?: string): boolean =>
    dated(resources).some(d => d.at >= triggerAt && (!profile || conformsTo(d.resource, profile)))

  const candidates: Array<{ obligation: PathwayObligation; satisfied: boolean } | null> = [
    // Safety plan — any Stage-4 care plan (Stanley-Brown, the CAMS
    // stabilization plan, the crisis response plan) recorded since the trigger.
    withAction(childFor(group, SAFETY_PLAN_CANONICAL), action => ({
      obligation: obligation({
        kind: 'safety-plan',
        action,
        reason,
        urgency,
        tool: toolForActivityDefinition(action.definitionCanonical),
      }),
      satisfied: recordedAfter(
        (slice.carePlans ?? []).filter(
          cp => stageForArtifact(cp as FhirResourceLike) === 'document-safety-actions',
        ) as FhirResourceLike[],
      ),
    })),

    // Crisis resources — the Communication the ShareCrisisResources activity emits.
    withAction(childFor(group, CRISIS_RESOURCES_CANONICAL), action => ({
      obligation: obligation({
        kind: 'crisis-resources',
        action,
        reason,
        urgency,
        tool: toolForActivityDefinition(action.definitionCanonical),
      }),
      satisfied: recordedAfter(
        (slice.communications ?? []) as FhirResourceLike[],
        CRISIS_RESOURCES_PROFILE,
      ),
    })),

    // The STAT safety evaluation — satisfied by the one part of it SPiER
    // records, the means-safety counseling Procedure.
    withAction(group.children.find(c => c.id.endsWith('stat-safety-evaluation')), action => ({
      obligation: obligation({
        kind: 'stat-safety-evaluation',
        action,
        reason,
        urgency,
        tool: toolForActivityDefinition(MEANS_SAFETY_CANONICAL),
      }),
      satisfied: recordedAfter((slice.procedures ?? []) as FhirResourceLike[], COUNSELING_PROFILE),
    })),

    // The direct question — standing, so never satisfied and never primary.
    withAction(group.children.find(c => c.id.endsWith('every-contact-question')), action => ({
      obligation: obligation({ kind: 'direct-question', action, reason, urgency, standing: true }),
      satisfied: false,
    })),
  ]

  // The cadence, last: it is what remains once the tier's acts are done.
  const reassessAction = childFor(group, REASSESSMENT_SCHEDULE_CANONICAL)
  const lastAssessment = tiers.at(-1)?.date ?? null
  const reassessment = reassessmentStateForTier(tier.code, lastAssessment, now)
  const reassessDue =
    reassessment.kind === 'scheduled' &&
    (reassessment.status === 'overdue' || reassessment.status === 'due-today')
  if (reassessAction) {
    // The reassessment is another administration of the pathway's own
    // assessment, so it launches what the assess step names.
    const assessStep = stepAtStage(pathway, 'clarify-risk')
    const realization = assessStep?.children.find(c => !!c.definitionCanonical)
    candidates.push({
      obligation: obligation({
        kind: 'reassess',
        action: reassessAction,
        // The published title states the rule ("on the published cadence for
        // this tier"); a card headline has to state the act.
        title: 'Reassess suicide risk',
        reason: `${reason} ${reassessmentStatusLabel(reassessment)}.`,
        urgency: reassessDue && urgency === 'routine' ? 'elevated' : urgency,
        tool: toolForActivityDefinition(realization?.definitionCanonical),
      }),
      satisfied: !reassessDue,
    })
  }

  const present = candidates.filter((c): c is { obligation: PathwayObligation; satisfied: boolean } => !!c)
  const outstanding = present.filter(c => !c.satisfied).map(c => c.obligation)
  const primary = outstanding.find(o => !o.standing) ?? null
  const alsoDue = outstanding.filter(o => o !== primary)

  return {
    primary,
    alsoDue,
    reason: primary
      ? primary.reason
      : reassessment.kind === 'scheduled'
        ? `Nothing is due. ${reason} Next reassessment ${shortDate(reassessment.dueDate, now)}.`
        : `Nothing is due. ${reason}`,
    tier,
    reassessment,
  }
}

function withAction<T>(action: PathwayAction | undefined, build: (a: PathwayAction) => T): T | null {
  return action ? build(action) : null
}
