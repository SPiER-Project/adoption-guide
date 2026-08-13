/**
 * Stage-8 (Measure and Share) measure engine — the runtime counterpart to
 * ig/input/fsh/measure-and-share.fsh.
 *
 * Computes the seven SPiER suicide-safer care measures over a patient's FHIR
 * slice and assembles MeasureReports from the results. This is the executable
 * reference implementation of the population criteria — it is what the app runs
 * and what `npm test` covers.
 *
 * The CQL long form is the portable, normative statement of the same criteria.
 * It lives at ig/input/cql/SPiERSuicideSaferCareMeasures.cql and IS compiled:
 * the IG Publisher translates it to ELM on every run and fails the build on a
 * translation error (#212 / #239). This comment used to say it sat in
 * ig/drafts/ and that nothing compiled it, which stopped being true two
 * releases ago. Change a criterion and you change both files.
 *
 * Two structural decisions:
 *
 *  1. THE MEASURE WIRING IS READ FROM THE GENERATED Measure JSON, not
 *     hand-copied. Which groups exist, which populations each group has, and
 *     which criterion each population names all come from
 *     `data/fhir/Measure-*.json`. So adding a group in FSH automatically
 *     requires a criterion here, and `npm run check:measures` fails if one is
 *     missing. The only hand-written part is CRITERIA below — the actual logic.
 *
 *  2. WINDOW LOGIC IS REUSED, NOT REIMPLEMENTED. The 7-/30-day follow-up
 *     windows call `attendedWithinDays` from followUp.ts, which exists
 *     specifically so the tracking view and the MeasureReport agree on one
 *     definition. Two copies of "was this kept within 7 days" is exactly the
 *     drift the Stage-6 design refused to create.
 *
 * ⚠️ DEMO ONLY — computes over the local slice; no server-side $evaluate-measure.
 */
import {
  APPOINTMENT_PROFILE,
  HANDOFF_CONTENT_ITEM_EXT,
  PACKET_PROFILE,
  REFERRAL_PROFILE,
} from './handoffs'
import {
  CARING_CONTACT_OPT_OUT_EXT,
  CARING_CONTACT_PROFILE,
  attendedWithinDays,
  isOutreachAttempt,
} from './followUp'
import {
  CLOSURE_REASON_EXT,
  EPISODE_PROFILE,
  RISK_TIER_SYSTEM,
} from './riskEpisode'
import { stageForArtifact, type FhirResourceLike } from './patientPathway'
// The per-tier cadence, read from PlanDefinition-SPiERReassessmentSchedule.
// reassessment.ts imports RISK_TIER_SYSTEM from riskEpisode.ts, not from here,
// so this direction introduces no cycle.
import { REASSESSMENT_INTERVAL_DAYS } from './reassessment'
import type {
  AppointmentResource,
  CarePlanResource,
  CommunicationResource,
  DocumentReferenceResource,
  EncounterResource,
  EpisodeOfCareResource,
  FhirResource,
  MeasureReportResource,
  ObservationResource,
  PatientSlice,
  ProcedureResource,
  ServiceRequestResource,
} from '../types/fhir'

// ─────────────────────────────────────────────────────────────
// Profiles + codes this engine reads
// ─────────────────────────────────────────────────────────────

export const RISK_CONCEPT_PROFILE = 'http://spier.org/StructureDefinition/spier-suicide-risk-concept'
export const SAFETY_HANDOFF_PROFILE = 'http://spier.org/StructureDefinition/spier-safety-handoff'
export const LETHAL_MEANS_PROFILE = 'http://spier.org/StructureDefinition/spier-lethal-means-counseling'
export const STANLEY_BROWN_PROFILE = 'http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan'
export const CRISIS_RESPONSE_PLAN_PROFILE = 'http://spier.org/StructureDefinition/spier-crisis-response-plan'
// Defined in followUp.ts next to the caring-contact profile it rides on, and
// re-exported here because this engine is where its consequence lives.
export { CARING_CONTACT_OPT_OUT_EXT }
export const HANDOFF_CONTENT_SYSTEM = 'http://spier.org/CodeSystem/spier-handoff-content'
/** The generic concept-layer code the risk-concept profile mandates. */
export const RISK_CONCEPT_LOINC = '93374-7'

const MEASURE_POPULATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/measure-population'
const IMPROVEMENT_NOTATION_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/measure-improvement-notation'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// ─────────────────────────────────────────────────────────────
// Measure definitions, loaded from the generated FHIR
// ─────────────────────────────────────────────────────────────

interface MeasurePopulationDoc {
  code?: { coding?: Array<{ system?: string; code?: string }> }
  criteria?: { language?: string; expression?: string }
}

interface MeasureGroupDoc {
  id?: string
  description?: string
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> }
  population?: MeasurePopulationDoc[]
}

interface MeasureDoc {
  id: string
  url: string
  title?: string
  description?: string
  group?: MeasureGroupDoc[]
}

const measureModules = import.meta.glob<{ default: MeasureDoc }>('../data/fhir/Measure-*.json', {
  eager: true,
})

/**
 * Reading order: along the pathway, not alphabetical. The measures only make
 * sense as a sequence — a positive screen leads to an assessment, which leads
 * to a risk status, a safety plan, a handoff, then follow-up. Sorting by id put
 * caring contacts first, which reads as a random list of KPIs and loses the one
 * thing this stage is trying to show.
 *
 * Any measure not listed sorts to the end by id, so adding one in FSH shows up
 * rather than disappearing.
 */
const PATHWAY_ORDER = [
  'SPiERScreenToAssessment',
  'SPiERRiskStatusDocumented',
  'SPiERSafetyPlanBeforeDischarge',
  'SPiERLethalMeansCounselingCompleted',
  'SPiERReferralCompletion',
  'SPiERFollowUpTimeliness',
  'SPiERCaringContactAdherence',
  // Stage 7: ongoing tracking comes after the stage-6 follow-up measures, so
  // reading top to bottom still walks the pathway. It would sort here anyway by
  // the id fallback, but relying on that would make the position accidental.
  'SPiERReassessmentOnTime',
]

function pathwayRank(id: string): number {
  const i = PATHWAY_ORDER.indexOf(id)
  return i === -1 ? PATHWAY_ORDER.length : i
}

/** Every published SPiER Measure, in pathway order. */
export const MEASURES: MeasureDoc[] = Object.values(measureModules)
  .map(m => m.default)
  .sort((a, b) => pathwayRank(a.id) - pathwayRank(b.id) || a.id.localeCompare(b.id))

export interface MeasureGroupSpec {
  /** The group's coded id (spier-measure-group), used to match report ↔ measure. */
  code: string
  display: string
  description?: string
  /** population code → criterion expression name */
  criteria: Record<string, string>
}

export interface MeasureSpec {
  id: string
  url: string
  title: string
  description?: string
  groups: MeasureGroupSpec[]
}

function populationCode(p: MeasurePopulationDoc): string | undefined {
  return p.code?.coding?.find(c => c.system === MEASURE_POPULATION_SYSTEM)?.code
}

/** The measure wiring, derived from FSH output rather than duplicated here. */
export const MEASURE_SPECS: MeasureSpec[] = MEASURES.map(m => ({
  id: m.id,
  url: m.url,
  title: m.title ?? m.id,
  description: m.description,
  groups: (m.group ?? []).map(g => {
    const coding = g.code?.coding?.[0]
    const criteria: Record<string, string> = {}
    for (const p of g.population ?? []) {
      const code = populationCode(p)
      const expr = p.criteria?.expression
      if (code && expr) criteria[code] = expr
    }
    return {
      code: coding?.code ?? g.id ?? 'unknown',
      display: coding?.display ?? g.description ?? g.id ?? 'Group',
      description: g.description,
      criteria,
    }
  }),
}))

/** Every criterion expression any Measure references. Used by check:measures. */
export function referencedCriteria(): string[] {
  const names = new Set<string>()
  for (const m of MEASURE_SPECS) {
    for (const g of m.groups) for (const expr of Object.values(g.criteria)) names.add(expr)
  }
  return [...names].sort()
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function conformsTo(resource: FhirResource | undefined, profile: string): boolean {
  const profiles = (resource as { meta?: { profile?: string[] } } | undefined)?.meta?.profile
  return Array.isArray(profiles) && profiles.includes(profile)
}

/**
 * Is this the harmonized suicide-risk concept Observation?
 *
 * Accepts EITHER the explicit profile claim or the LOINC code the profile
 * mandates (93374-7). Code-matching is not a fallback for convenience — it is
 * the more interoperable identity: most systems, including SPiER's own
 * observation mappers, do not stamp `meta.profile`, so a measure that required
 * the profile claim would score zero against real EHR data and against this
 * app's own output. The profile mandates the code, so matching the code can
 * never be wrong.
 */
function isRiskConcept(o: ObservationResource): boolean {
  if (conformsTo(o, RISK_CONCEPT_PROFILE)) return true
  const codings = (o as { code?: { coding?: Array<{ system?: string; code?: string }> } }).code?.coding
  return !!codings?.some(c => c.system === 'http://loinc.org' && c.code === RISK_CONCEPT_LOINC)
}

/**
 * The pathway stage an Observation belongs to — which is how screens are told
 * apart from assessments.
 *
 * Delegates to the app's own `stageForArtifact` first, then falls back to
 * resolving through `derivedFrom` to the source QuestionnaireResponse (whose
 * stage comes from its Questionnaire's tool). The derived Observations the
 * mappers emit carry no `meta.tag`, so without that second hop the screen →
 * assessment measure could never fire against real captured data. Reusing the
 * app resolver rather than reimplementing stage rules is deliberate: two
 * definitions of "which stage is this" would drift.
 */
function observationStage(o: ObservationResource, slice: PatientSlice): string | undefined {
  const direct = stageForArtifact(o as FhirResourceLike)
  if (direct) return direct
  const derivedFrom = (o as { derivedFrom?: Array<{ reference?: string }> }).derivedFrom ?? []
  for (const ref of derivedFrom) {
    const id = ref.reference?.replace('QuestionnaireResponse/', '')
    if (!id) continue
    const stored = slice.responses.find(r => r.id === id)
    const stage = stored && stageForArtifact(stored.resource as FhirResourceLike)
    if (stage) return stage
  }
  return undefined
}

function ms(value: string | undefined): number {
  if (!value) return NaN
  const n = new Date(value).getTime()
  return Number.isFinite(n) ? n : NaN
}

function extensionCode(resource: FhirResource | undefined, url: string): string | undefined {
  const exts = (resource as { extension?: Array<{ url?: string; valueCodeableConcept?: { coding?: Array<{ code?: string }> } }> } | undefined)?.extension
  return exts?.find(e => e.url === url)?.valueCodeableConcept?.coding?.[0]?.code
}

function extensionBoolean(resource: FhirResource, url: string): boolean {
  const exts = (resource as { extension?: Array<{ url?: string; valueBoolean?: boolean }> }).extension
  return exts?.some(e => e.url === url && e.valueBoolean === true) ?? false
}

function contentItemCodes(resource: FhirResource): string[] {
  const exts = (resource as { extension?: Array<{ url?: string; valueCodeableConcept?: { coding?: Array<{ system?: string; code?: string }> } }> }).extension
  return (exts ?? [])
    .filter(e => e.url === HANDOFF_CONTENT_ITEM_EXT)
    .flatMap(e => e.valueCodeableConcept?.coding ?? [])
    .filter(c => c.system === HANDOFF_CONTENT_SYSTEM || !c.system)
    .map(c => c.code)
    .filter((c): c is string => !!c)
}

/** Observation.effectiveDateTime, or the start of an effectivePeriod. */
function observationEffective(o: ObservationResource): string | undefined {
  const r = o as { effectiveDateTime?: string; effectivePeriod?: { start?: string } }
  return r.effectiveDateTime ?? r.effectivePeriod?.start
}

// ─────────────────────────────────────────────────────────────
// Evaluation context
// ─────────────────────────────────────────────────────────────

export interface MeasurementPeriod {
  /** Inclusive ISO date/dateTime. */
  start: string
  /** Inclusive ISO date/dateTime. */
  end: string
}

/**
 * Derived values shared across criteria, computed once per patient. The index
 * transition in particular is read by six of the ten groups, and recomputing it
 * per criterion would be both slow and a place for them to disagree.
 */
interface Ctx {
  slice: PatientSlice
  periodStart: number
  periodEnd: number
  riskConcepts: ObservationResource[]
  screens: ObservationResource[]
  positiveScreens: ObservationResource[]
  assessments: ObservationResource[]
  episodes: EpisodeOfCareResource[]
  latestEpisode: EpisodeOfCareResource | undefined
  transitionDates: number[]
  /** Most recent documented transition in the period — the post-discharge index. */
  indexTransition: number | undefined
  appointments: AppointmentResource[]
  outreach: CommunicationResource[]
  caringContacts: CommunicationResource[]
  referrals: ServiceRequestResource[]
  validReferrals: ServiceRequestResource[]
  safetyPlans: CarePlanResource[]
  procedures: ProcedureResource[]
  /** Encounters overlapping the most recent episode — read for the disposition. */
  episodeEncounters: EncounterResource[]
}

function inPeriod(ctx: Ctx, value: number): boolean {
  return Number.isFinite(value) && value >= ctx.periodStart && value <= ctx.periodEnd
}

function isPositive(o: ObservationResource): boolean {
  const interp = (o as { interpretation?: Array<{ coding?: Array<{ code?: string }> }> }).interpretation
  const codes = (interp ?? []).flatMap(i => i.coding ?? []).map(c => c.code)
  if (codes.includes('POS') || codes.includes('A')) return true
  // Fall back to the tier value: anything above no-risk is a positive screen.
  const value = (o as { valueCodeableConcept?: { coding?: Array<{ system?: string; code?: string }> } })
    .valueCodeableConcept?.coding
  const tier = value?.find(c => c.system === RISK_TIER_SYSTEM)?.code
  return !!tier && tier !== 'no-risk'
}

/** The risk tier coded on a risk-concept Observation, or undefined. */
function recordedTier(o: ObservationResource): string | undefined {
  const coding = (o as { valueCodeableConcept?: { coding?: Array<{ system?: string; code?: string }> } })
    .valueCodeableConcept?.coding
  return coding?.find(c => c.system === RISK_TIER_SYSTEM)?.code
}

function episodePeriod(e: EpisodeOfCareResource | undefined): { start: number; end: number } {
  const p = (e as { period?: { start?: string; end?: string } } | undefined)?.period
  const start = ms(p?.start)
  const end = ms(p?.end)
  return {
    start: Number.isFinite(start) ? start : -Infinity,
    end: Number.isFinite(end) ? end : Infinity,
  }
}

function buildContext(slice: PatientSlice, period: MeasurementPeriod): Ctx {
  const periodStart = ms(period.start)
  const periodEnd = ms(period.end)
  const communications = slice.communications ?? []

  const riskConcepts = (slice.observations ?? []).filter(
    o => isRiskConcept(o) && (o as { status?: string }).status === 'final',
  )
  const screens = riskConcepts.filter(
    o =>
      observationStage(o, slice) === 'identify-possible-risk' &&
      inPeriodRaw(observationEffective(o)),
  )
  function inPeriodRaw(value: string | undefined): boolean {
    const n = ms(value)
    return Number.isFinite(n) && n >= periodStart && n <= periodEnd
  }

  const episodes = (slice.episodes ?? []).filter(e => {
    if (!conformsTo(e, EPISODE_PROFILE)) return false
    const { start, end } = episodePeriod(e)
    return start <= periodEnd && end >= periodStart
  })
  const latestEpisode = episodes
    .slice()
    .sort((a, b) => episodePeriod(a).start - episodePeriod(b).start)
    .pop()

  const handoffDates = communications
    .filter(c => conformsTo(c, SAFETY_HANDOFF_PROFILE))
    .map(c => ms((c as { sent?: string }).sent))
  const packetDates = (slice.documentReferences ?? [])
    .filter((d: DocumentReferenceResource) => conformsTo(d, PACKET_PROFILE))
    .map((d: DocumentReferenceResource) => ms((d as { date?: string }).date))
  const transitionDates = [...handoffDates, ...packetDates].filter(
    n => Number.isFinite(n) && n >= periodStart && n <= periodEnd,
  )

  const referrals = (slice.serviceRequests ?? []).filter(
    r => conformsTo(r, REFERRAL_PROFILE) && inPeriodRaw((r as { authoredOn?: string }).authoredOn),
  )

  return {
    slice,
    periodStart,
    periodEnd,
    riskConcepts,
    screens,
    positiveScreens: screens.filter(isPositive),
    assessments: riskConcepts.filter(o => observationStage(o, slice) === 'clarify-risk'),
    episodes,
    latestEpisode,
    transitionDates,
    indexTransition: transitionDates.length ? Math.max(...transitionDates) : undefined,
    appointments: (slice.appointments ?? []).filter(a => conformsTo(a, APPOINTMENT_PROFILE)),
    outreach: communications.filter(isOutreachAttempt),
    caringContacts: communications.filter(c => conformsTo(c, CARING_CONTACT_PROFILE)),
    referrals,
    validReferrals: referrals.filter(r => (r as { status?: string }).status !== 'entered-in-error'),
    safetyPlans: (slice.carePlans ?? []).filter(
      p =>
        (conformsTo(p, STANLEY_BROWN_PROFILE) || conformsTo(p, CRISIS_RESPONSE_PLAN_PROFILE)) &&
        ['active', 'completed'].includes((p as { status?: string }).status ?? ''),
    ),
    procedures: slice.procedures ?? [],
    episodeEncounters: (slice.encounters ?? []).filter(e => {
      if (!latestEpisode) return false
      const { start, end } = episodePeriod(latestEpisode)
      const p = (e as { period?: { start?: string; end?: string } }).period
      const encStart = ms(p?.start)
      const encEnd = ms(p?.end)
      // Overlap, not containment: the ED encounter typically starts before the
      // episode opens (triage precedes the positive screen that opens it).
      return (Number.isFinite(encStart) ? encStart : -Infinity) <= end &&
        (Number.isFinite(encEnd) ? encEnd : Infinity) >= start
    }),
  }
}

function closureReason(ctx: Ctx): string | undefined {
  return extensionCode(ctx.latestEpisode, CLOSURE_REASON_EXT)
}

/**
 * Discharge dispositions that defer or preclude means counseling (issue #324).
 *
 * `psy` / `hosp` / `long` / `rehab` — the patient went to a higher level of
 * care, so counseling belongs at the eventual discharge to the community and is
 * owed by the receiving facility. `aadvice` — the patient left before
 * disposition, so there was no opportunity.
 *
 * Mirrors "Deferring Discharge Dispositions" in the CQL library. HL7's
 * discharge-disposition CodeSystem, which the Encounters already carry — this
 * measure asked for no new recording.
 */
const DEFERRING_DISPOSITIONS = new Set(['psy', 'hosp', 'long', 'rehab', 'aadvice'])
const DISCHARGE_DISPOSITION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/discharge-disposition'

function dischargeDispositionCodes(encounter: EncounterResource): string[] {
  const coding = (encounter as {
    hospitalization?: { dischargeDisposition?: { coding?: Array<{ system?: string; code?: string }> } }
  }).hospitalization?.dischargeDisposition?.coding
  return (coding ?? [])
    .filter(c => c.system === DISCHARGE_DISPOSITION_SYSTEM && !!c.code)
    .map(c => c.code as string)
}

function sentWithin(messages: CommunicationResource[], from: number, windowMs: number): boolean {
  return messages.some(c => {
    const n = ms((c as { sent?: string }).sent)
    return Number.isFinite(n) && n >= from && n <= from + windowMs
  })
}

// ─────────────────────────────────────────────────────────────
// The criteria — one per named definition in the Measures
// ─────────────────────────────────────────────────────────────
// Names match `Measure.group.population.criteria.expression` exactly, and
// check:measures enforces that correspondence in both directions.

const CRITERIA: Record<string, (ctx: Ctx) => boolean> = {
  // ── Measure 1: positive screen → assessment ──
  'Has A Suicide Risk Screen': ctx => ctx.screens.length > 0,
  'Has A Positive Screen': ctx => ctx.positiveScreens.length > 0,
  'Positive Screen Assessed Within 24 Hours': ctx => {
    // Tie-break: the most recent positive screen in the period is the index.
    const index = ctx.positiveScreens
      .map(o => ms(observationEffective(o)))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
      .pop()
    if (index === undefined) return false
    return ctx.assessments.some(a => {
      const n = ms(observationEffective(a))
      return Number.isFinite(n) && n >= index && n <= index + 24 * HOUR_MS
    })
  },

  // ── Shared episode cohort ──
  'Has An Active Suicide Safer Care Episode': ctx => ctx.episodes.length > 0,
  'Episode Closed Administratively': ctx => closureReason(ctx) === 'administrative',

  // ── Measure 2: risk level documented ──
  // Reads the Observation, NOT the episode-current-risk-tier extension: that
  // extension is a denormalized cache for work-queue sorting and can be stale,
  // so measuring it would measure the cache rather than the care.
  'Risk Tier Documented During Episode': ctx => {
    if (!ctx.latestEpisode) return false
    const { start, end } = episodePeriod(ctx.latestEpisode)
    return ctx.riskConcepts.some(o => {
      const n = ms(observationEffective(o))
      return Number.isFinite(n) && n >= start && n <= end
    })
  },

  // ── Shared post-discharge index ──
  'Has A Documented Care Transition': ctx => ctx.indexTransition !== undefined,

  // ── Measure 3: safety plan before discharge ──
  'Safety Plan In Place Before Transition': ctx => {
    const index = ctx.indexTransition
    if (index === undefined) return false
    return ctx.safetyPlans.some(p => {
      const start = ms((p as { period?: { start?: string } }).period?.start)
      // Fall back to created/date where a plan carries no period.
      const created = ms((p as { created?: string; date?: string }).created ?? (p as { date?: string }).date)
      const at = Number.isFinite(start) ? start : created
      return Number.isFinite(at) && at <= index
    })
  },
  'Patient Copy Of Safety Plan Documented': ctx => {
    if (ctx.indexTransition === undefined) return false
    return (ctx.slice.documentReferences ?? []).some(
      d =>
        conformsTo(d, PACKET_PROFILE) &&
        inPeriod(ctx, ms((d as { date?: string }).date)) &&
        contentItemCodes(d).includes('safety-plan-copy'),
    )
  },

  // ── Measure 4: lethal means counseling ──
  // Written by the TL-008 recorder (components/LethalMeansCounselingView.tsx).
  // Counts the counseling Procedure only — the per-means SPiERMeansSafetyAction
  // Observations the same recorder writes are richer detail a site reports
  // separately, not part of this numerator.
  'Lethal Means Counseling During Episode': ctx => {
    if (!ctx.latestEpisode) return false
    const { start, end } = episodePeriod(ctx.latestEpisode)
    return ctx.procedures.some(p => {
      if (!conformsTo(p, LETHAL_MEANS_PROFILE)) return false
      if ((p as { status?: string }).status !== 'completed') return false
      const r = p as { performedDateTime?: string; performedPeriod?: { start?: string } }
      const n = ms(r.performedDateTime ?? r.performedPeriod?.start)
      return Number.isFinite(n) && n >= start && n <= end
    })
  },

  // The #324 exception. Two ways an open episode carries no counseling without
  // the ED having failed at anything: the patient went to a higher level of
  // care (not yet due — and owed by the receiving facility), or left before
  // disposition (no opportunity). Read off the discharge disposition, which the
  // encounters already carry.
  //
  // This names the REASON only. "Removed only if the numerator is not met" is
  // the exception's scoring semantics and lives in evaluateMeasure, so a
  // patient counseled before transfer still counts as a pass.
  'Transferred Or Left Before Means Counseling': ctx =>
    ctx.episodeEncounters.some(e =>
      dischargeDispositionCodes(e).some(c => DEFERRING_DISPOSITIONS.has(c)),
    ),

  // ── Measure 5: follow-up timeliness ──
  'Excluded From Follow Up Measurement': ctx => {
    const reason = closureReason(ctx)
    return reason === 'administrative' || reason === 'deceased'
  },
  // Counts an ATTEMPT, not a successful contact: the attempt is what the care
  // team controls. A stricter reached-only variant would filter on the
  // outreach-outcome extension.
  'Outreach Within 48 Hours Of Transition': ctx =>
    ctx.indexTransition !== undefined &&
    sentWithin(ctx.outreach, ctx.indexTransition, 48 * HOUR_MS),
  // Delegates to followUp.attendedWithinDays so the tracking view and the
  // MeasureReport cannot disagree about what "kept within N days" means.
  'Follow Up Visit Within 7 Days': ctx =>
    ctx.indexTransition !== undefined &&
    attendedWithinDays(ctx.appointments, new Date(ctx.indexTransition).toISOString(), 7),
  'Follow Up Visit Within 30 Days': ctx =>
    ctx.indexTransition !== undefined &&
    attendedWithinDays(ctx.appointments, new Date(ctx.indexTransition).toISOString(), 30),

  // ── Measure 6: caring contact adherence ──
  // The opt-out exclusion is why caring-contact-opt-out exists on the profile:
  // honoring an opt-out is correct behaviour, and scoring it as a miss would
  // pressure sites to ignore the patient. The TL-010 recorder
  // (components/CaringContactView.tsx) writes the extension, so the exclusion
  // is reachable from the UI rather than only from injected data.
  'Excluded From Caring Contact Measurement': ctx => {
    const optedOut = ctx.caringContacts.some(c => extensionBoolean(c, CARING_CONTACT_OPT_OUT_EXT))
    const reason = closureReason(ctx)
    return optedOut || reason === 'administrative' || reason === 'deceased'
  },
  'Caring Contact Within 30 Days': ctx =>
    ctx.indexTransition !== undefined &&
    sentWithin(ctx.caringContacts, ctx.indexTransition, 30 * DAY_MS),

  // ── Measure 7: referral loop closure ──
  // Computable only because TL-017 is a ServiceRequest: a Communication records
  // only that a referral was sent, and sent-vs-completed is the whole measure.
  'Has A Suicide Safety Referral': ctx => ctx.referrals.length > 0,
  'Referral Entered In Error': ctx => ctx.referrals.length > 0 && ctx.validReferrals.length === 0,
  // `revoked` is NOT success: a referral withdrawn without an alternative
  // arranged is a genuine loop failure.
  'All Referrals Completed': ctx =>
    ctx.validReferrals.length > 0 &&
    ctx.validReferrals.every(r => (r as { status?: string }).status === 'completed'),

  // ── Measure 8: reassessment on time ──
  // The one measure whose window is data. `REASSESSMENT_INTERVAL_DAYS` is read
  // from PlanDefinition-SPiERReassessmentSchedule; the CQL restates the same
  // numbers because a patient-context library cannot retrieve a definitional
  // resource, and check:reassessment asserts all three agree.
  'Has A Reassessment Interval': ctx => datedAssessments(ctx).length >= 2,
  'Reassessment Not On A Published Cadence': ctx => {
    const pair = assessmentPair(ctx)
    if (!pair) return false
    return applicableIntervalDays(pair) === undefined || closureReason(ctx) === 'administrative'
  },
  'Most Recent Reassessment Was On Time': ctx => {
    const pair = assessmentPair(ctx)
    if (!pair) return false
    const interval = applicableIntervalDays(pair)
    if (interval === undefined) return false
    const gapDays = (pair.latest - pair.preceding) / DAY_MS
    return gapDays <= interval
  },
}

/** Risk-concept Observations dated inside the period, oldest first. */
function datedAssessments(ctx: Ctx): ObservationResource[] {
  return ctx.riskConcepts
    .map(o => ({ o, t: ms(observationEffective(o)) }))
    .filter(x => inPeriod(ctx, x.t))
    .sort((a, b) => a.t - b.t)
    .map(x => x.o)
}

/**
 * The most recent completed interval: the last two assessments.
 *
 * Returns undefined when there is no gap to measure. Ties at the same instant
 * drop out rather than producing an arbitrary winner — matching the CQL, which
 * takes the latest assessment strictly before the most recent.
 */
function assessmentPair(
  ctx: Ctx,
): { preceding: number; latest: number; precedingTier: string | undefined } | undefined {
  const dated = datedAssessments(ctx)
  if (dated.length < 2) return undefined
  const latest = ms(observationEffective(dated[dated.length - 1]))
  const earlier = [...dated]
    .reverse()
    .find(o => ms(observationEffective(o)) < latest)
  if (!earlier) return undefined
  return {
    preceding: ms(observationEffective(earlier)),
    latest,
    // Read off the EARLIER assessment: the interval a site owed is the one that
    // applied when the clock started, not the patient's tier today.
    precedingTier: recordedTier(earlier),
  }
}

function applicableIntervalDays(pair: {
  precedingTier: string | undefined
}): number | undefined {
  return pair.precedingTier ? REASSESSMENT_INTERVAL_DAYS[pair.precedingTier] : undefined
}

/** Criterion names this engine implements. Used by check:measures. */
export function implementedCriteria(): string[] {
  return Object.keys(CRITERIA).sort()
}

// ─────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────

export interface GroupEvaluation {
  code: string
  display: string
  /** population code → membership */
  populations: Record<string, boolean>
  /**
   * True when the patient counts toward the denominator after exclusions AND
   * after exceptions. See `evaluateMeasure` for why those two are not the same
   * test.
   */
  inDenominator: boolean
  inNumerator: boolean
  /**
   * True when an exception actually removed this patient — i.e. they met the
   * exception criterion and did NOT meet the numerator. A patient who met both
   * stays in the denominator and passes, so this is false for them.
   *
   * Reported separately because the summary MeasureReport counts the population
   * as FHIR defines it: how many cases the exception removed.
   */
  removedByException: boolean
}

export interface MeasureEvaluation {
  measureId: string
  measureUrl: string
  title: string
  groups: GroupEvaluation[]
}

/** Evaluate one measure for one patient. */
export function evaluateMeasure(
  spec: MeasureSpec,
  slice: PatientSlice,
  period: MeasurementPeriod,
): MeasureEvaluation {
  const ctx = buildContext(slice, period)
  return {
    measureId: spec.id,
    measureUrl: spec.url,
    title: spec.title,
    groups: spec.groups.map(g => {
      const populations: Record<string, boolean> = {}
      for (const [code, expr] of Object.entries(g.criteria)) {
        const fn = CRITERIA[expr]
        // A missing criterion is a programming error, not a false result —
        // check:measures exists so this cannot reach a build.
        if (!fn) throw new Error(`No implementation for measure criterion "${expr}"`)
        populations[code] = fn(ctx)
      }
      // Exclusion and exception are NOT the same test, and the difference is
      // the whole reason #324 chose an exception:
      //
      //   exclusion  the case never belonged in the cohort. Removed outright.
      //   exception  the case belongs, but there is a valid clinical or system
      //              reason it could not be met — so it is removed ONLY IF the
      //              numerator is not met. A patient who got lethal-means
      //              counseling before being transferred still counts as a
      //              pass; a patient who was transferred without it drops out
      //              rather than reading as a care failure.
      //
      // That conditionality means the numerator has to be resolved before the
      // denominator can be, which is why it is computed first here.
      const excluded = populations['denominator-exclusion'] === true
      const meetsNumerator = populations['numerator'] === true
      const removedByException = populations['denominator-exception'] === true && !meetsNumerator
      const inDenominator = populations['denominator'] === true && !excluded && !removedByException
      return {
        code: g.code,
        display: g.display,
        populations,
        inDenominator,
        inNumerator: inDenominator && meetsNumerator,
        removedByException,
      }
    }),
  }
}

/** Evaluate every published measure for one patient. */
export function evaluateAllMeasures(
  slice: PatientSlice,
  period: MeasurementPeriod,
): MeasureEvaluation[] {
  return MEASURE_SPECS.map(spec => evaluateMeasure(spec, slice, period))
}

// ─────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────

export interface GroupTally {
  code: string
  display: string
  initialPopulation: number
  denominator: number
  denominatorExclusion: number
  /**
   * Cases an exception actually removed — met the exception criterion and not
   * the numerator. Patients who met both are counted in the numerator instead,
   * so this is the number FHIR asks for: how many cases came out.
   */
  denominatorException: number
  numerator: number
  /**
   * numerator / (denominator − exclusion − exception), or null when nothing is
   * left to score over.
   */
  score: number | null
}

export interface MeasureTally {
  measureId: string
  measureUrl: string
  title: string
  groups: GroupTally[]
}

/**
 * Roll per-patient evaluations up into counts. Scores follow the proportion
 * convention the MeasureReport examples use: the denominator is reported
 * PRE-exclusion and the score divides by (denominator − exclusion).
 */
export function tallyMeasure(evaluations: MeasureEvaluation[], spec: MeasureSpec): MeasureTally {
  return {
    measureId: spec.id,
    measureUrl: spec.url,
    title: spec.title,
    groups: spec.groups.map(g => {
      const rows = evaluations
        .map(e => e.groups.find(x => x.code === g.code))
        .filter((x): x is GroupEvaluation => !!x)
      const count = (pop: string) => rows.filter(r => r.populations[pop] === true).length
      const denominator = count('denominator')
      const exclusion = count('denominator-exclusion')
      // Counted from `removedByException`, not from the raw population flag: a
      // patient who met the exception criterion AND the numerator was never
      // removed, so counting the flag would subtract a case that is still being
      // scored — and the score would exceed 100%.
      const exception = rows.filter(r => r.removedByException).length
      const numerator = rows.filter(r => r.inNumerator).length
      const effective = denominator - exclusion - exception
      return {
        code: g.code,
        display: g.display,
        initialPopulation: count('initial-population'),
        denominator,
        denominatorExclusion: exclusion,
        denominatorException: exception,
        numerator,
        score: effective > 0 ? numerator / effective : null,
      }
    }),
  }
}

/** Tally every measure across a cohort of per-patient evaluation sets. */
export function tallyAll(perPatient: MeasureEvaluation[][]): MeasureTally[] {
  return MEASURE_SPECS.map((spec, i) =>
    tallyMeasure(
      perPatient.map(evals => evals[i]).filter((e): e is MeasureEvaluation => !!e),
      spec,
    ),
  )
}

// ─────────────────────────────────────────────────────────────
// MeasureReport assembly
// ─────────────────────────────────────────────────────────────

function populationEntry(code: string, display: string, count: number) {
  return {
    code: { coding: [{ system: MEASURE_POPULATION_SYSTEM, code, display }] },
    count,
  }
}

const POPULATION_DISPLAYS: Record<string, string> = {
  'initial-population': 'Initial Population',
  denominator: 'Denominator',
  'denominator-exclusion': 'Denominator Exclusion',
  'denominator-exception': 'Denominator Exception',
  numerator: 'Numerator',
}

function groupCoding(code: string, display: string) {
  return { coding: [{ system: 'http://spier.org/CodeSystem/spier-measure-group', code, display }] }
}

/**
 * An individual MeasureReport for one patient. Reports EVERY population the
 * Measure defines — a report that omits one cannot be checked against its
 * definition, which the IG Publisher flags as an error.
 */
export function buildIndividualMeasureReport(
  spec: MeasureSpec,
  evaluation: MeasureEvaluation,
  patientId: string,
  period: MeasurementPeriod,
  reportedAt: string,
): MeasureReportResource {
  return {
    resourceType: 'MeasureReport',
    id: `${spec.id}-${patientId}`,
    status: 'complete',
    type: 'individual',
    measure: spec.url,
    subject: { reference: `Patient/${patientId}` },
    date: reportedAt,
    period: { start: period.start, end: period.end },
    improvementNotation: {
      coding: [{ system: IMPROVEMENT_NOTATION_SYSTEM, code: 'increase' }],
    },
    group: spec.groups.map(g => {
      const row = evaluation.groups.find(x => x.code === g.code)
      const populations = Object.keys(g.criteria).map(pop => {
        // The exception population reports what it REMOVED, not who matched
        // its criterion — a patient who met the exception and the numerator was
        // never taken out. Same rule as the summary tally; see GroupTally.
        const member = pop === 'denominator-exception'
          ? row?.removedByException === true
          : row?.populations[pop] === true
        return populationEntry(pop, POPULATION_DISPLAYS[pop] ?? pop, member ? 1 : 0)
      })
      return {
        id: g.code,
        code: groupCoding(g.code, g.display),
        population: populations,
        measureScore: { value: row?.inNumerator ? 1 : 0 },
      }
    }),
  } as MeasureReportResource
}

/** A program-level summary MeasureReport from a cohort tally. */
export function buildSummaryMeasureReport(
  tally: MeasureTally,
  spec: MeasureSpec,
  period: MeasurementPeriod,
  reportedAt: string,
  reporter?: string,
): MeasureReportResource {
  return {
    resourceType: 'MeasureReport',
    id: `${tally.measureId}-summary`,
    status: 'complete',
    type: 'summary',
    measure: tally.measureUrl,
    date: reportedAt,
    ...(reporter ? { reporter: { display: reporter } } : {}),
    period: { start: period.start, end: period.end },
    improvementNotation: {
      coding: [{ system: IMPROVEMENT_NOTATION_SYSTEM, code: 'increase' }],
    },
    group: tally.groups.map((g, i) => {
      const defined = Object.keys(spec.groups[i]?.criteria ?? {})
      const counts: Record<string, number> = {
        'initial-population': g.initialPopulation,
        denominator: g.denominator,
        'denominator-exclusion': g.denominatorExclusion,
        'denominator-exception': g.denominatorException,
        numerator: g.numerator,
      }
      return {
        id: g.code,
        code: groupCoding(g.code, g.display),
        population: defined.map(pop =>
          populationEntry(pop, POPULATION_DISPLAYS[pop] ?? pop, counts[pop] ?? 0),
        ),
        ...(g.score === null ? {} : { measureScore: { value: Math.round(g.score * 1000) / 1000 } }),
      }
    }),
  } as MeasureReportResource
}

/**
 * A sensible default measurement period: the trailing `days` window ending
 * today. The dashboard needs *a* period and the demo data is undated relative
 * to any fiscal calendar, so a rolling window is the honest default.
 */
export function trailingPeriod(days: number, now: Date = new Date()): MeasurementPeriod {
  const end = new Date(now)
  const start = new Date(now.getTime() - days * DAY_MS)
  return { start: start.toISOString(), end: end.toISOString() }
}
