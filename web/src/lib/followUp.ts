/**
 * Stage-6 (Track Follow-Up) domain helpers.
 *
 * The FHIR shape is defined in ig/input/fsh/follow-up.fsh. Stage 6 adds only
 * ONE new artifact builder — the outreach attempt — because three of its five
 * tools deliberately reuse resources earlier stages already produce:
 *
 *   TL-033 Outreach / contact attempts → SPiEROutreachAttempt (Communication)
 *   TL-010 Caring contacts            → SPiERCaringContact (Communication)
 *   TL-034 Appointment tracking        → a READ over the Stage-5 Appointment
 *   TL-035 No-show follow-up           → the same outreach attempt, different prompt
 *   TL-036 Follow-up escalation        → the Stage-7 SPiERSafetyTask
 *
 * So the interesting logic here is the tracking side: deriving attended /
 * no-show / next-due state from Appointment.status + Appointment.start rather
 * than storing a parallel copy that could drift.
 *
 * ⚠️ DEMO ONLY — no data is persisted to a server.
 */
import { PATHWAY_STAGE_SYSTEM } from './patientPathway'
import { appointmentStart, appointmentStatus, type CodedOption } from './handoffs'
import type { AppointmentResource, CommunicationResource } from '../types/fhir'

export const STAGE_ID = 'track-follow-up'
const STAGE_TITLE = 'Track Follow-Up'

export const OUTREACH_PROFILE = 'http://spier.org/StructureDefinition/spier-outreach-attempt'
export const CARING_CONTACT_PROFILE = 'http://spier.org/StructureDefinition/spier-caring-contact'

export const OUTREACH_OUTCOME_SYSTEM = 'http://spier.org/CodeSystem/spier-outreach-outcome'
export const OUTREACH_PROMPT_SYSTEM = 'http://spier.org/CodeSystem/spier-outreach-prompt'

export const OUTREACH_OUTCOME_EXT = 'http://spier.org/StructureDefinition/outreach-outcome'
export const OUTREACH_PROMPT_EXT = 'http://spier.org/StructureDefinition/outreach-prompt'
export const SAFETY_CONCERN_EXT = 'http://spier.org/StructureDefinition/safety-concern-identified'

const PARTICIPATION_MODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode'

export const OUTREACH_OUTCOMES: CodedOption[] = [
  { code: 'patient-reached', display: 'Patient reached' },
  { code: 'no-answer', display: 'No answer' },
  { code: 'message-left', display: 'Message left' },
  { code: 'unable-to-reach', display: 'Unable to reach' },
  { code: 'wrong-contact-info', display: 'Wrong or outdated contact information' },
  { code: 'patient-declined', display: 'Patient declined contact' },
  { code: 'reached-support-person', display: 'Reached a support person' },
]

export const OUTREACH_PROMPTS: CodedOption[] = [
  { code: 'scheduled-follow-up', display: 'Scheduled follow-up' },
  { code: 'post-discharge', display: 'Post-discharge follow-up' },
  { code: 'missed-appointment', display: 'Missed appointment' },
  { code: 'no-show', display: 'No-show' },
  { code: 'cancelled-appointment', display: 'Cancelled appointment' },
  { code: 'missed-reassessment', display: 'Missed reassessment' },
  { code: 'open-care-gap', display: 'Open care gap' },
]

/** HL7 v3 ParticipationMode codes for how the contact was made. */
export const OUTREACH_CHANNELS: CodedOption[] = [
  { code: 'PHONE', display: 'Telephone call' },
  { code: 'WRITTEN', display: 'Letter / card' },
  { code: 'SMSWRIT', display: 'Text message' },
  { code: 'EMAILWRIT', display: 'Email' },
]

/** Outcomes that mean this attempt did not make contact with the patient. */
const UNREACHED_OUTCOMES = new Set([
  'no-answer',
  'message-left',
  'unable-to-reach',
  'wrong-contact-info',
])

/** Prompts that mark an attempt as no-show follow-up (TL-035) vs routine (TL-033). */
const NO_SHOW_PROMPTS = new Set(['missed-appointment', 'no-show', 'cancelled-appointment'])

export function displayFor(options: CodedOption[], code: string): string {
  return options.find(o => o.code === code)?.display ?? code
}

function stageTag() {
  return [{ system: PATHWAY_STAGE_SYSTEM, code: STAGE_ID, display: STAGE_TITLE }]
}

// ─── TL-033 / TL-035 — Outreach attempt ───────────────────────

/**
 * One follow-up contact attempt.
 *
 * `outcome` is a required extension, not a status: `Communication.status` says
 * whether a message was *sent*, never whether anyone answered. `safetyConcern`
 * is deliberately a separate axis from the outcome — a concern can surface on a
 * successfully reached call, and "unable to reach" can itself be the concern.
 */
export function buildOutreachAttempt(params: {
  id: string
  patientId: string | null
  sent: string
  channel: string
  outcome: string
  prompt?: string
  safetyConcern?: boolean
  note?: string
}): CommunicationResource {
  const channel = OUTREACH_CHANNELS.find(c => c.code === params.channel) ?? OUTREACH_CHANNELS[0]
  const isNoShowFollowUp = !!params.prompt && NO_SHOW_PROMPTS.has(params.prompt)
  return {
    resourceType: 'Communication',
    id: params.id,
    meta: { profile: [OUTREACH_PROFILE], tag: stageTag() },
    status: 'completed',
    category: [{ text: isNoShowFollowUp ? 'No-show follow-up' : 'Follow-up outreach attempt' }],
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    sent: params.sent,
    medium: [
      { coding: [{ system: PARTICIPATION_MODE_SYSTEM, code: channel.code, display: channel.display }] },
    ],
    extension: [
      {
        url: OUTREACH_OUTCOME_EXT,
        valueCodeableConcept: {
          coding: [
            {
              system: OUTREACH_OUTCOME_SYSTEM,
              code: params.outcome,
              display: displayFor(OUTREACH_OUTCOMES, params.outcome),
            },
          ],
        },
      },
      ...(params.prompt
        ? [
            {
              url: OUTREACH_PROMPT_EXT,
              valueCodeableConcept: {
                coding: [
                  {
                    system: OUTREACH_PROMPT_SYSTEM,
                    code: params.prompt,
                    display: displayFor(OUTREACH_PROMPTS, params.prompt),
                  },
                ],
              },
            },
          ]
        : []),
      ...(params.safetyConcern === undefined
        ? []
        : [{ url: SAFETY_CONCERN_EXT, valueBoolean: params.safetyConcern }]),
    ],
    ...(params.note ? { note: [{ text: params.note }] } : {}),
  }
}

function codedExtension(
  resource: CommunicationResource,
  url: string,
): string | undefined {
  const exts = (resource as {
    extension?: { url?: string; valueCodeableConcept?: { coding?: { code?: string }[] } }[]
  }).extension
  return exts?.find(e => e.url === url)?.valueCodeableConcept?.coding?.[0]?.code
}

export function outreachOutcome(resource: CommunicationResource): string | undefined {
  return codedExtension(resource, OUTREACH_OUTCOME_EXT)
}

export function outreachPrompt(resource: CommunicationResource): string | undefined {
  return codedExtension(resource, OUTREACH_PROMPT_EXT)
}

export function outreachSafetyConcern(resource: CommunicationResource): boolean {
  const exts = (resource as { extension?: { url?: string; valueBoolean?: boolean }[] }).extension
  return exts?.find(e => e.url === SAFETY_CONCERN_EXT)?.valueBoolean === true
}

/**
 * True for Communications that are outreach attempts — recognized by the
 * presence of the required outcome extension rather than by profile URL, so an
 * attempt written by another system is still counted.
 */
export function isOutreachAttempt(resource: CommunicationResource): boolean {
  return outreachOutcome(resource) !== undefined
}

export function outreachAttempts(communications: CommunicationResource[]): CommunicationResource[] {
  return communications
    .filter(isOutreachAttempt)
    .slice()
    .sort((a, b) => {
      const sa = (a as { sent?: string }).sent ?? ''
      const sb = (b as { sent?: string }).sent ?? ''
      return sb.localeCompare(sa)
    })
}

/**
 * Consecutive most-recent attempts that failed to reach the patient. This is
 * what the `failed-contact-sequence` escalation trigger describes, so the
 * outreach recorder can suggest escalating rather than leaving staff to count.
 */
export function unreachedStreak(communications: CommunicationResource[]): number {
  let streak = 0
  for (const attempt of outreachAttempts(communications)) {
    const outcome = outreachOutcome(attempt)
    if (outcome && UNREACHED_OUTCOMES.has(outcome)) streak++
    else break
  }
  return streak
}

// ─── TL-034 — Appointment tracking (a read, not a write) ──────

export interface AppointmentTracking {
  /** Soonest future appointment that is still expected to happen. */
  next: AppointmentResource | undefined
  /** Most recent appointment whose date has passed. */
  mostRecentPast: AppointmentResource | undefined
  attendedCount: number
  noShowCount: number
  cancelledCount: number
  /**
   * True when the patient's LATEST appointment was a no-show and nothing has
   * superseded it — the TL-035 trigger.
   *
   * Keyed to the latest appointment rather than the latest *past* one on
   * purpose. A no-show is normally marked after the slot, but staff can resolve
   * one early, and a booking dated tomorrow must not hide outstanding
   * re-engagement work. Booking a replacement visit makes that the latest
   * appointment and clears the flag on its own — which is exactly the design's
   * "follow-up rescheduled is a new Appointment".
   */
  awaitingNoShowFollowUp: boolean
}

const UPCOMING_STATUSES = new Set(['proposed', 'pending', 'booked', 'arrived', 'checked-in'])

function startMs(appointment: AppointmentResource): number {
  const start = appointmentStart(appointment)
  const ms = start ? new Date(start).getTime() : NaN
  return Number.isFinite(ms) ? ms : NaN
}

/**
 * Everything the SSC asks TL-034 to show, derived from the appointments TL-031
 * created. Nothing here is stored: a parallel "appointment tracking" resource
 * would be a second copy to keep in sync with the first, which is a guaranteed
 * drift source. The 7-/30-day completion figures are Stage-8 measures computed
 * over these same appointments.
 */
export function deriveAppointmentTracking(
  appointments: AppointmentResource[],
  now: Date = new Date(),
): AppointmentTracking {
  const nowMs = now.getTime()
  const dated = appointments.filter(a => !Number.isNaN(startMs(a)))

  const upcoming = dated
    .filter(a => startMs(a) >= nowMs && UPCOMING_STATUSES.has(appointmentStatus(a)))
    .sort((a, b) => startMs(a) - startMs(b))
  const past = dated.filter(a => startMs(a) < nowMs).sort((a, b) => startMs(b) - startMs(a))

  const countBy = (status: string) => dated.filter(a => appointmentStatus(a) === status).length
  const mostRecentPast = past[0]
  const latest = dated.slice().sort((a, b) => startMs(b) - startMs(a))[0]

  return {
    next: upcoming[0],
    mostRecentPast,
    attendedCount: countBy('fulfilled'),
    noShowCount: countBy('noshow'),
    cancelledCount: countBy('cancelled'),
    awaitingNoShowFollowUp: !!latest && appointmentStatus(latest) === 'noshow',
  }
}

/**
 * Whether an appointment was kept within `days` of a reference date — the shape
 * the Stage-8 7-day / 30-day follow-up measures are computed from. Exposed here
 * so the tracking view and the future MeasureReport agree on one definition.
 */
export function attendedWithinDays(
  appointments: AppointmentResource[],
  from: string,
  days: number,
): boolean {
  const fromMs = new Date(from).getTime()
  if (!Number.isFinite(fromMs)) return false
  const windowEnd = fromMs + days * 24 * 60 * 60 * 1000
  return appointments.some(a => {
    if (appointmentStatus(a) !== 'fulfilled') return false
    const ms = startMs(a)
    return !Number.isNaN(ms) && ms >= fromMs && ms <= windowEnd
  })
}
