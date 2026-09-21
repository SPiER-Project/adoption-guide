/**
 * Population registry derivation — turns a patient's static demographics
 * (patients.json) plus their live FHIR slice into the row Population View
 * renders. `currentStage` / `completedStages` / `currentRiskLevel` /
 * `lastActivity` are all computed from the same slice PatientChart already
 * reads, so submitting an assessment on a patient's chart is immediately
 * reflected in their registry row — this is a query over FHIR data, not a
 * hand-curated snapshot.
 *
 * `recommendedNextStep` is the one field patients.json still hand-curates: it's
 * editorial rationale text, not something derivable from artifacts.
 */
import { STAGES } from '../data/catalog'
import { derivePathwayStatus, type PatientArtifacts, type FhirResourceLike } from './patientPathway'
import { highestRiskLevel } from './observationMappers'
import type { RiskAlert } from './observationMappers'
import {
  episodeCurrentTier,
  findOpenEpisode,
  isTaskOpen,
  isTaskOverdue,
  taskDueDate,
  tasksForEpisode,
} from './riskEpisode'
import {
  appointmentProvider,
  appointmentStart,
  appointmentStatus,
  consentDecision,
  isReferralOpen,
  REFERRAL_STATUSES,
} from './handoffs'
import { displayFor as displayHandoff } from './codedOption'
import {
  deriveAppointmentTracking,
  unreachedStreak,
  OUTREACH_OUTCOME_EXT,
} from './followUp'
// The risk-concept LOINC is defined once, by the measure engine that matches on
// it. Importing it here rather than re-typing '93374-7' keeps the two consumers
// of that code from drifting; measures.ts does not import this module, so there
// is no cycle.
import { RISK_CONCEPT_LOINC } from './measures'
import { reassessmentState, riskLevelForTier, type ReassessmentState } from './reassessment'
// One definition of "when was this recorded", shared with the pathway evaluator.
import { bestArtifactDate } from './artifactDate'
import { evaluatePathway } from './pathwayEvaluation'
import type { PatientSlice } from '../types/fhir'

/** Just enough of an Observation to find the risk-concept ones. */
type ObservationLike = { code?: { coding?: Array<{ code?: string }> } }

export interface RegistryPatient {
  id: string
  displayName: string
  dob: string
  mrn: string
  gender: string
  /**
   * The curated "next step" line, or `null`.
   *
   * ⚠️ **Nullable since #401, because no FHIR resource carries it.** It is
   * hand-written per patient in `patients.json`, which is fine for a bundled
   * demo registry and impossible for a cohort read over real `Patient`
   * resources — a server-backed source returns `null` here and the row's next
   * step is derived from the pathway instead (the same derivation
   * `buildCdsCards` already falls back to, which has accepted `null` since it
   * was written). Rendering a blank column, or inventing a label, would both be
   * worse than saying the field is absent.
   */
  recommendedNextStep: { stageId: string; label: string; rationale: string } | null
}

export interface RegistryActivity {
  date: string
  label: string
}

/**
 * What a caseload row can say about a patient's risk.
 *
 * ⚠️ **`unknown` is not a sixth severity — it is the absence of the question
 * having been asked**, and it is here because the five-value alert vocabulary
 * could not express it. `highestRiskLevel([])` is `none`, so a patient nobody
 * had ever screened rendered the same word as a patient screened and cleared.
 * `riskLabel.ts` has carried the distinction for the identity strip since it
 * was written — *a chart that has never been screened must not read as
 * cleared* — and this is the row type catching up with it.
 *
 * Structurally the same six values as `RiskLevel` in the view layer, declared
 * here rather than imported because `packages/core` is React-free and that
 * module ships lucide icons (`npm run check:core-boundary`). The two are tied
 * together at every render site: `RISK_LABEL` and `RISK_ICON` are keyed by the
 * view's union, so a value this one gained and that one did not would not
 * compile.
 */
export type RegistryRiskLevel = RiskAlert['level'] | 'unknown'

export interface DerivedRegistryRow extends RegistryPatient {
  /** Null once every stage (including the last) is complete — see derivePathwayStatus. */
  currentStage: string | null
  completedStages: string[]
  currentRiskLevel: RegistryRiskLevel
  /** Null when the slice has no dated artifact at all. */
  lastActivity: RegistryActivity | null
  /**
   * Stage-7 work-queue rollup (TL-037). The registry is a QUERY, not a stored
   * resource, so these are derived per row from the patient's open episode and
   * its tasks — exactly the client-side equivalent of
   * `EpisodeOfCare?status=active&_revinclude=Task:based-on`.
   */
  episodeOpen: boolean
  /** Tier cached on the episode (see the episode-current-risk-tier extension). */
  episodeTier: string | null
  openTaskCount: number
  /** Computed on read — never stored, so it can't disagree with the clock. */
  overdueTaskCount: number
  /** Soonest due date among open tasks, or null. */
  nextTaskDue: string | null
  /**
   * Stage-6 follow-up rollup (TL-034). Like the work queue above this is a
   * QUERY: every field is derived from the Stage-5 Appointments and the
   * outreach Communications, never stored — which is the whole reason TL-034
   * mints no resource of its own.
   */
  nextAppointment: { date: string; status: string; provider: string | null } | null
  noShowCount: number
  /** True when the most recent past appointment was a no-show (the TL-035 trigger). */
  awaitingNoShowFollowUp: boolean
  /** Consecutive most-recent outreach attempts that failed to reach the patient. */
  unreachedStreak: number
  /** Open referrals (ServiceRequest not yet completed or revoked). */
  openReferralCount: number
  /**
   * Reassessment cadence (TL-039, #279). Like the rollups above these are a
   * QUERY: the interval comes from the published PlanDefinition and the due date
   * is recomputed on read, so it cannot disagree with the clock or with a tier
   * that changed a moment ago.
   */
  /** Date of the most recent risk-concept Observation, or null. */
  lastAssessment: string | null
  reassessment: ReassessmentState
  /**
   * What the published pathway says to do next for this patient, or null when
   * nothing is due.
   *
   * ⚠️ **The same expression the chart's leading card uses**
   * (`lib/pathwayEvaluation.ts`). The caseload used to derive this column from
   * the patient's active STAGE while the chart derived its card from the stage's
   * lead tool plus a live alert — two derivations, and they disagreed, which is
   * exactly what the caseload page claims cannot happen.
   */
  nextStep: { label: string; rationale: string } | null
}


/**
 * When an appointment counts as *activity*.
 *
 * `Appointment.start` is the visit, which for a booked follow-up is in the
 * FUTURE — and the newest-wins rule in deriveLastActivity would then report a
 * visit that hasn't happened as the patient's most recent activity, pushing
 * every real event off the row. The activity that actually occurred is the
 * booking, so a still-upcoming appointment is dated by when it was written.
 */
function appointmentActivityDate(
  appointment: FhirResourceLike,
  now: Date,
): string | undefined {
  const a = appointment as { start?: string; _savedAt?: string; meta?: { lastUpdated?: string } }
  const startMs = a.start ? new Date(a.start).getTime() : NaN
  if (Number.isFinite(startMs) && startMs > now.getTime()) {
    return a._savedAt ?? a.meta?.lastUpdated
  }
  return bestArtifactDate(appointment)
}

function careplanLabel(resource: FhirResourceLike): string {
  const cp = resource as { title?: string; id?: string }
  if (typeof cp.title === 'string') return cp.title
  if (cp.id?.includes('stanley-brown')) return 'Stanley-Brown Safety Plan'
  if (cp.id?.includes('cams-stabilization')) return 'CAMS Stabilization Plan'
  if (cp.id?.includes('crisis-response-plan')) return 'Crisis Response Plan'
  return 'Care plan'
}

function communicationLabel(resource: FhirResourceLike): string {
  const c = resource as { reasonCode?: { text?: string }[]; category?: { text?: string; coding?: { display?: string }[] }[] }
  const name =
    c.reasonCode?.[0]?.text ??
    c.category?.[0]?.text ??
    c.category?.[0]?.coding?.[0]?.display ??
    'Communication'
  // A Stage-6 outreach attempt's whole point is its outcome — "Follow-up
  // outreach attempt" alone doesn't say whether anyone was reached, which is
  // the one thing the row needs to convey.
  const outcome = outreachOutcomeDisplay(resource)
  return outcome ? `${name} — ${outcome}` : name
}

/** Human-readable outreach outcome for a Communication, or undefined. */
function outreachOutcomeDisplay(resource: FhirResourceLike): string | undefined {
  const exts = (resource as {
    extension?: {
      url?: string
      valueCodeableConcept?: { coding?: { display?: string; code?: string }[] }
    }[]
  }).extension
  const coding = exts?.find(e => e.url === OUTREACH_OUTCOME_EXT)?.valueCodeableConcept?.coding?.[0]
  return coding?.display ?? coding?.code
}

/**
 * Stage-7 labels. Episodes/flags/tasks describe themselves through coded
 * fields rather than a title, so each label is built from the code plus the
 * lifecycle state that makes the row meaningful in an activity feed ("closed"
 * vs "opened" is the whole point of an episode entry).
 */
function episodeLabel(resource: FhirResourceLike): string {
  const e = resource as { status?: string }
  const closed = e.status === 'finished' || e.status === 'cancelled'
  return closed ? 'Suicide-safer care episode closed' : 'Suicide-safer care episode opened'
}

function flagLabel(resource: FhirResourceLike): string {
  const f = resource as { status?: string; code?: { text?: string; coding?: { display?: string }[] } }
  const name = f.code?.text ?? f.code?.coding?.[0]?.display ?? 'Suicide-risk flag'
  return f.status === 'active' ? name : `${name} (cleared)`
}

function taskLabel(resource: FhirResourceLike): string {
  const t = resource as { status?: string; code?: { text?: string; coding?: { display?: string }[] } }
  const name = t.code?.text ?? t.code?.coding?.[0]?.display ?? 'Safety task'
  return t.status === 'completed' ? `${name} (completed)` : name
}

/**
 * Stage-5/6 labels. Like the Stage-7 labels above, each is built from the
 * resource's coded fields PLUS the lifecycle state that makes the row
 * meaningful in a feed — "referral completed" and "referral sent" are the same
 * resource at different points, and an activity list that couldn't tell them
 * apart would be useless for the tracking TL-017 exists to demonstrate.
 */
function documentReferenceLabel(resource: FhirResourceLike): string {
  const d = resource as {
    type?: { text?: string; coding?: { display?: string }[] }
    content?: { attachment?: { title?: string } }[]
  }
  return (
    d.content?.[0]?.attachment?.title ??
    d.type?.text ??
    d.type?.coding?.[0]?.display ??
    'Discharge safety packet'
  )
}

function serviceRequestLabel(resource: FhirResourceLike): string {
  const s = resource as { status?: string; code?: { text?: string; coding?: { display?: string }[] } }
  const name = s.code?.text ?? s.code?.coding?.[0]?.display ?? 'Suicide-safety referral'
  const status = s.status ? displayHandoff(REFERRAL_STATUSES, s.status) : ''
  return status ? `${name} — ${status.toLowerCase()}` : name
}

function appointmentLabel(resource: FhirResourceLike): string {
  const a = resource as { description?: string; status?: string }
  const name = a.description ?? 'Follow-up appointment'
  switch (a.status) {
    case 'fulfilled':
      return `${name} (attended)`
    case 'noshow':
      return `${name} (no-show)`
    case 'cancelled':
      return `${name} (cancelled)`
    default:
      return `${name} (booked)`
  }
}

function consentLabel(resource: FhirResourceLike): string {
  // permit/deny is the decision itself, so it belongs in the label — a feed row
  // reading only "sharing consent" would hide whether sharing is allowed.
  return consentDecision(resource as never) === 'deny'
    ? 'Information-sharing consent — declined'
    : 'Information-sharing consent — permitted'
}

function observationLabel(resource: FhirResourceLike): string {
  const o = resource as { code?: { text?: string; coding?: { display?: string }[] } }
  return o.code?.text ?? o.code?.coding?.[0]?.display ?? 'Observation'
}

/**
 * True when an Observation's `derivedFrom` points at a QuestionnaireResponse
 * already present in this slice's responses. A single submitted assessment
 * (e.g. ASQ) can mint half a dozen item-level Observations within
 * milliseconds of each other and of the response itself — surfacing one of
 * them as "last activity" instead of the response reads as noise. The
 * response is the more meaningful summary of that event.
 */
function isDerivedFromKnownResponse(resource: FhirResourceLike, responseIds: Set<string>): boolean {
  const derivedFrom = (resource as { derivedFrom?: { reference?: string }[] }).derivedFrom
  return derivedFrom?.some(d => responseIds.has(d.reference?.replace('QuestionnaireResponse/', '') ?? '')) ?? false
}

/** Newest dated artifact across the whole slice, or null if nothing has a date. */
function deriveLastActivity(slice: PatientSlice, now: Date): RegistryActivity | null {
  const candidates: RegistryActivity[] = []
  const responseIds = new Set(slice.responses.map(r => r.id))

  for (const r of slice.responses) {
    if (r.completedAt) candidates.push({ date: r.completedAt, label: r.questionnaireName })
  }
  for (const o of slice.observations) {
    if (isDerivedFromKnownResponse(o, responseIds)) continue
    const date = bestArtifactDate(o)
    if (date) candidates.push({ date, label: observationLabel(o) })
  }
  for (const cp of slice.carePlans) {
    const date = bestArtifactDate(cp)
    if (date) candidates.push({ date, label: careplanLabel(cp) })
  }
  for (const c of slice.communications ?? []) {
    const date = bestArtifactDate(c)
    if (date) candidates.push({ date, label: communicationLabel(c) })
  }
  for (const e of slice.episodes ?? []) {
    const date = bestArtifactDate(e)
    if (date) candidates.push({ date, label: episodeLabel(e) })
  }
  for (const f of slice.flags ?? []) {
    const date = bestArtifactDate(f)
    if (date) candidates.push({ date, label: flagLabel(f) })
  }
  for (const t of slice.tasks ?? []) {
    const date = bestArtifactDate(t)
    if (date) candidates.push({ date, label: taskLabel(t) })
  }
  for (const d of slice.documentReferences ?? []) {
    const date = bestArtifactDate(d)
    if (date) candidates.push({ date, label: documentReferenceLabel(d) })
  }
  for (const s of slice.serviceRequests ?? []) {
    const date = bestArtifactDate(s)
    if (date) candidates.push({ date, label: serviceRequestLabel(s) })
  }
  for (const a of slice.appointments ?? []) {
    const date = appointmentActivityDate(a, now)
    if (date) candidates.push({ date, label: appointmentLabel(a) })
  }
  for (const c of slice.consents ?? []) {
    const date = bestArtifactDate(c)
    if (date) candidates.push({ date, label: consentLabel(c) })
  }

  if (candidates.length === 0) return null
  return candidates.reduce((newest, c) => (new Date(c.date) > new Date(newest.date) ? c : newest))
}

/** Stage-7 rollup for one patient's slice — the registry work-queue columns. */
function deriveEpisodeRollup(slice: PatientSlice, now: Date) {
  const openEpisode = findOpenEpisode(slice.episodes ?? [])
  const episodeTasks = tasksForEpisode(slice.tasks ?? [], openEpisode?.id)
  const open = episodeTasks.filter(isTaskOpen)
  const nextDue = open.map(taskDueDate).filter((d): d is string => !!d).sort()[0] ?? null
  return {
    episodeOpen: !!openEpisode,
    episodeTier: episodeCurrentTier(openEpisode) ?? null,
    openTaskCount: open.length,
    overdueTaskCount: open.filter(t => isTaskOverdue(t, now)).length,
    nextTaskDue: nextDue,
  }
}

/**
 * Reassessment cadence rollup (TL-039, #279).
 *
 * `lastAssessment` is the most recent risk-concept Observation — the thing the
 * deck's tracker calls "Last C-SSRS", generalised to any instrument, because at
 * the population level what matters is that a risk level was established, not
 * which tool established it.
 *
 * The interval itself comes from the published PlanDefinition, so nothing here
 * knows that high risk means 7 days. Like every other rollup in this file it
 * stores nothing: the due date is recomputed on read.
 */
function deriveReassessmentRollup(
  slice: PatientSlice,
  level: RiskAlert['level'],
  now: Date,
) {
  const dates = (slice.observations ?? [])
    .filter(o =>
      (o as ObservationLike).code?.coding?.some(c => c.code === RISK_CONCEPT_LOINC),
    )
    .map(o => bestArtifactDate(o))
    .filter((d): d is string => !!d)
    .sort()
  const lastAssessment = dates.at(-1) ?? null
  return {
    lastAssessment,
    reassessment: reassessmentState(level, lastAssessment, now),
  }
}

/**
 * Stage-6 follow-up rollup (TL-034 / TL-035). Reads the Stage-5 Appointments
 * and the outreach Communications; stores nothing.
 */
function deriveFollowUpRollup(slice: PatientSlice, now: Date) {
  const appointments = slice.appointments ?? []
  const tracking = deriveAppointmentTracking(appointments, now)
  const next = tracking.next
  return {
    nextAppointment: next
      ? {
          date: appointmentStart(next) ?? '',
          status: appointmentStatus(next),
          provider: appointmentProvider(next) ?? null,
        }
      : null,
    noShowCount: tracking.noShowCount,
    awaitingNoShowFollowUp: tracking.awaitingNoShowFollowUp,
    unreachedStreak: unreachedStreak(slice.communications ?? []),
    openReferralCount: (slice.serviceRequests ?? []).filter(isReferralOpen).length,
  }
}

/**
 * Every self-staging workflow resource type in one list — the
 * `workflowArtifacts` bucket patientPathway stages by `meta.tag`. Exported
 * because the chart needs the same list, and two independent copies would drift
 * the moment a stage adds a resource type.
 *
 * `procedures` is here even though the four before it are Stage-5 and it is
 * Stage-4: the lethal-means counseling Procedure is what the Stage-8 lethal
 * means measure scores on, and leaving it out meant the measure reported a
 * number computed from a resource that appeared nowhere in the chart.
 */
export function workflowArtifactsOf(
  source: Pick<
    PatientSlice,
    'documentReferences' | 'serviceRequests' | 'appointments' | 'consents' | 'procedures'
  >,
): FhirResourceLike[] {
  return [
    ...(source.documentReferences ?? []),
    ...(source.serviceRequests ?? []),
    ...(source.appointments ?? []),
    ...(source.consents ?? []),
    ...(source.procedures ?? []),
  ]
}

export function deriveRegistryRow(
  patient: RegistryPatient,
  slice: PatientSlice,
  now: Date = new Date(),
): DerivedRegistryRow {
  const artifacts: PatientArtifacts = {
    responses: slice.responses,
    carePlans: slice.carePlans,
    observations: slice.observations,
    communications: slice.communications ?? [],
    workflowArtifacts: workflowArtifactsOf(slice),
  }
  const { statuses, activeStageId } = derivePathwayStatus(artifacts)
  const completedStages = STAGES.filter(s => statuses[s.id] === 'complete').map(s => s.id)

  // ONE evaluation of the published pathway per row, read for two things: the
  // row's risk level and its next step. Calling it twice would be a second
  // chance for a row to disagree with itself.
  const evaluation = evaluatePathway(
    {
      responses: slice.responses,
      observations: slice.observations,
      carePlans: slice.carePlans,
      communications: slice.communications ?? [],
      procedures: slice.procedures ?? [],
      episodes: slice.episodes ?? [],
      riskAlerts: slice.riskAlerts,
    },
    { now },
  )

  // ⚠️ **The HARMONIZED TIER, not the loudest alert** — changed 2026-09-21.
  //
  // This was `highestRiskLevel(slice.riskAlerts)`, which is the most severe
  // thing any instrument said about the patient. That is a different question
  // from the one the pathway branches on, and for a real demo chart the two
  // gave different answers out loud: patient-006's CAMS session rates
  // psychological pain and hopelessness at 4/5, which drives the ALERT to
  // high, while the patient's own OVERALL risk rating is 3/5, which is the
  // moderate tier. The caseload said High and that patient's own chart said
  // moderate risk — the disagreement this page's own copy claims cannot
  // happen.
  //
  // The tier wins because it is what the protocol conditions on: the tier
  // branch, the reassessment cadence and every obligation below it are gated
  // on `SPiERSuicideRiskTier`, never on an instrument's own reading of itself.
  //
  // ⚠️ **The alert is the FALLBACK, and that is not a compromise.** A patient
  // with a positive PHQ-9 and no assessment yet has no tier at all — the
  // pathway's gate is "positive screen, go and assess", and it reaches no tier
  // until something does. Showing `none` for them would read as "screened, no
  // risk", which is the opposite of true. So a record with no tier keeps
  // saying what its instruments said.
  //
  // ⚠️ **And `unknown` below the fallback, which `highestRiskLevel` cannot
  // say.** It returns `none` for an empty alert set, so a patient nobody has
  // ever screened read exactly like a patient screened and cleared — the
  // distinction `riskLabel.ts` calls out as clinical and the one word this
  // column had no way to spell. A record the evaluator finds no screen, no
  // assessment and no tier on has not been asked the question.
  const alertLevel = highestRiskLevel(slice.riskAlerts)
  const tierLevel = evaluation.tier ? riskLevelForTier(evaluation.tier.code) : undefined
  // The alert guard is belt-and-braces: a slice carrying alerts but no
  // artifacts is malformed, and reading it as "never screened" would be the
  // louder error of the two.
  const anySignal = evaluation.screened || slice.riskAlerts.length > 0
  const currentRiskLevel: RegistryRiskLevel = tierLevel ?? (anySignal ? alertLevel : 'unknown')

  return {
    ...patient,
    currentStage: activeStageId,
    completedStages,
    currentRiskLevel,
    lastActivity: deriveLastActivity(slice, now),
    ...deriveEpisodeRollup(slice, now),
    ...deriveFollowUpRollup(slice, now),
    // Fed the tier-derived level too, so the row's next-reassessment date is
    // computed off the same tier the chart's card is. An unscreened patient is
    // on no cadence, which `none` → `no-risk` already says: "not on the
    // suicide-safer care pathway".
    ...deriveReassessmentRollup(slice, currentRiskLevel === 'unknown' ? 'none' : currentRiskLevel, now),
    nextStep: evaluation.primary
      ? { label: evaluation.primary.title, rationale: evaluation.reason }
      : null,
  }
}
