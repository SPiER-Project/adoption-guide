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
  displayFor as displayHandoff,
} from './handoffs'
import {
  deriveAppointmentTracking,
  unreachedStreak,
  OUTREACH_OUTCOME_EXT,
} from './followUp'
import type { PatientSlice } from '../types/fhir'

export interface RegistryPatient {
  id: string
  displayName: string
  dob: string
  mrn: string
  gender: string
  recommendedNextStep: { stageId: string; label: string; rationale: string }
}

export interface RegistryActivity {
  date: string
  label: string
}

export interface DerivedRegistryRow extends RegistryPatient {
  /** Null once every stage (including the last) is complete — see derivePathwayStatus. */
  currentStage: string | null
  completedStages: string[]
  currentRiskLevel: RiskAlert['level']
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
}

function bestArtifactDate(resource: FhirResourceLike): string | undefined {
  const r = resource as {
    authored?: string
    effectiveDateTime?: string
    issued?: string
    sent?: string
    // Stage-7: Task carries authoredOn; EpisodeOfCare/Flag carry period.start.
    // Without these the feed would fall back to the local `_savedAt` stamp,
    // which is the save time rather than the clinical time (and is absent
    // entirely on resources read back from a SMART server).
    authoredOn?: string
    // Stage-5: DocumentReference carries `date`, Consent `dateTime`, and
    // Appointment `start` (its clinical time is the visit, not the booking).
    date?: string
    dateTime?: string
    start?: string
    period?: { start?: string; end?: string }
    _savedAt?: string
    meta?: { lastUpdated?: string }
  }
  return (
    r.authored ??
    r.effectiveDateTime ??
    r.issued ??
    r.sent ??
    r.authoredOn ??
    r.date ??
    r.dateTime ??
    r.start ??
    // An episode that has closed is most meaningfully dated by its end.
    r.period?.end ??
    r.period?.start ??
    r._savedAt ??
    // Resources read back from a SMART server carry no `_savedAt`; the server's
    // own stamp is the last resort before the row goes undated.
    r.meta?.lastUpdated
  )
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
 * Every Stage-5 resource type in one list — the `workflowArtifacts` bucket
 * patientPathway stages by `meta.tag`. Exported because the chart needs the
 * same list, and two independent copies would drift the moment a stage adds a
 * resource type.
 */
export function workflowArtifactsOf(
  source: Pick<
    PatientSlice,
    'documentReferences' | 'serviceRequests' | 'appointments' | 'consents'
  >,
): FhirResourceLike[] {
  return [
    ...(source.documentReferences ?? []),
    ...(source.serviceRequests ?? []),
    ...(source.appointments ?? []),
    ...(source.consents ?? []),
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

  return {
    ...patient,
    currentStage: activeStageId,
    completedStages,
    currentRiskLevel: highestRiskLevel(slice.riskAlerts),
    lastActivity: deriveLastActivity(slice, now),
    ...deriveEpisodeRollup(slice, now),
    ...deriveFollowUpRollup(slice, now),
  }
}
