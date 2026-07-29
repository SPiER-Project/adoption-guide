/**
 * Stage-5 (Coordinate Handoffs) domain helpers.
 *
 * The FHIR shape is defined in ig/input/fsh/handoffs.fsh; this module is the
 * runtime counterpart shared by the four Stage-5 recorders and the registry.
 * Same split as lib/riskEpisode.ts for Stage 7: the interesting rules ("is
 * this referral still open", "which appointment is next", "what did the packet
 * contain") live here so they are unit-testable and not re-implemented per
 * view.
 *
 * Four resource types, one question: when this patient moves to the next
 * provider, does the suicide-safety context move with them?
 *
 *   TL-030 Discharge Safety Packet → DocumentReference
 *   TL-017 Referral / Next Provider Handoff → ServiceRequest
 *   TL-031 Next Appointment → Appointment
 *   TL-032 Consent / Sharing Status → Consent
 *
 * ⚠️ DEMO ONLY — no data is persisted to a server.
 */
import { PATHWAY_STAGE_SYSTEM } from './patientPathway'
import type {
  AppointmentResource,
  ConsentResource,
  DocumentReferenceResource,
  FhirResource,
  ServiceRequestResource,
} from '../types/fhir'

export const STAGE_ID = 'coordinate-handoffs'
const STAGE_TITLE = 'Coordinate Handoffs'

export const PACKET_PROFILE = 'http://spier.org/StructureDefinition/spier-discharge-safety-packet'
export const REFERRAL_PROFILE = 'http://spier.org/StructureDefinition/spier-safety-referral'
export const APPOINTMENT_PROFILE = 'http://spier.org/StructureDefinition/spier-follow-up-appointment'
export const CONSENT_PROFILE = 'http://spier.org/StructureDefinition/spier-information-sharing-consent'

export const HANDOFF_CONTENT_SYSTEM = 'http://spier.org/CodeSystem/spier-handoff-content'
export const REFERRAL_REASON_SYSTEM = 'http://spier.org/CodeSystem/spier-referral-reason'
export const CONSENT_CATEGORY_SYSTEM = 'http://spier.org/CodeSystem/spier-consent-category'

export const HANDOFF_CONTENT_ITEM_EXT = 'http://spier.org/StructureDefinition/handoff-content-item'

/** HL7 code systems the profiles bind to natively rather than SPiER-locally. */
const CONSENT_SCOPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/consentscope'
const CONSENT_POLICY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/consentpolicycodes'
const PARTICIPATION_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType'

export interface CodedOption {
  code: string
  display: string
}

/**
 * The shared TL-009/TL-030 content vocabulary (spier-handoff-content). One code
 * list serves the transition checklist and the discharge packet because the SSC
 * asks a near-identical "what is included?" multiselect for both.
 */
export const HANDOFF_CONTENT_ITEMS: CodedOption[] = [
  { code: 'current-risk-status', display: 'Current risk status' },
  { code: 'recent-assessment', display: 'Most recent suicide-risk assessment' },
  { code: 'safety-plan-status', display: 'Safety plan status' },
  { code: 'safety-plan-copy', display: 'Safety plan copy' },
  { code: 'lethal-means-actions', display: 'Lethal means safety actions' },
  { code: 'crisis-resources', display: 'Crisis contacts / resources' },
  { code: 'follow-up-plan', display: 'Follow-up plan' },
  { code: 'next-provider', display: 'Next provider / team' },
  { code: 'appointment-details', display: 'Appointment details' },
  { code: 'referral-details', display: 'Referral details' },
  { code: 'care-team-contact', display: 'Care team contact' },
  { code: 'patient-instructions', display: 'Patient instructions' },
  { code: 'pending-tasks', display: 'Pending tasks' },
]

export const REFERRAL_REASONS: CodedOption[] = [
  { code: 'elevated-risk', display: 'Elevated suicide risk' },
  { code: 'safety-planning', display: 'Safety planning' },
  { code: 'ongoing-treatment', display: 'Ongoing behavioral health treatment' },
  { code: 'higher-level-of-care', display: 'Higher level of care' },
  { code: 'specialty-assessment', display: 'Specialty assessment' },
  { code: 'post-discharge-follow-up', display: 'Post-discharge follow-up' },
]

/**
 * ServiceRequest.status values the referral recorder offers. This is the whole
 * reason TL-017 is a ServiceRequest rather than a Communication: the SSC scores
 * highest on tracking a referral past "sent" through to accepted/completed,
 * which `Communication` cannot express.
 */
export const REFERRAL_STATUSES: CodedOption[] = [
  { code: 'draft', display: 'Draft — not yet sent' },
  { code: 'active', display: 'Sent / accepted by receiving team' },
  { code: 'completed', display: 'Completed — patient seen' },
  { code: 'revoked', display: 'Revoked / withdrawn' },
]

/** ServiceRequest.status values that mean the referral loop is still open. */
const OPEN_REFERRAL_STATUSES = new Set(['draft', 'active', 'on-hold'])

/**
 * Appointment.status values the recorder offers. `booked → fulfilled | noshow |
 * cancelled` is exactly the lifecycle the Stage-6 no-show workflow reads, which
 * is why TL-034 needs no second resource type.
 */
export const APPOINTMENT_STATUSES: CodedOption[] = [
  { code: 'proposed', display: 'Proposed' },
  { code: 'booked', display: 'Booked' },
  { code: 'arrived', display: 'Patient arrived' },
  { code: 'fulfilled', display: 'Attended (fulfilled)' },
  { code: 'cancelled', display: 'Cancelled' },
  { code: 'noshow', display: 'No-show' },
]

export const CONSENT_DECISIONS: CodedOption[] = [
  { code: 'permit', display: 'Permit — information may be shared' },
  { code: 'deny', display: 'Deny — patient declined sharing' },
]

export function displayFor(options: CodedOption[], code: string): string {
  return options.find(o => o.code === code)?.display ?? code
}

function stageTag() {
  return [{ system: PATHWAY_STAGE_SYSTEM, code: STAGE_ID, display: STAGE_TITLE }]
}

/**
 * The repeating handoff-content-item extensions for a set of selected codes.
 * Contexted on both Communication and DocumentReference in the IG because
 * neither has a native coded slot for "what was included".
 */
function contentItemExtensions(contentCodes: string[]) {
  return contentCodes.map(code => ({
    url: HANDOFF_CONTENT_ITEM_EXT,
    valueCodeableConcept: {
      coding: [
        { system: HANDOFF_CONTENT_SYSTEM, code, display: displayFor(HANDOFF_CONTENT_ITEMS, code) },
      ],
    },
  }))
}

/** Content codes recorded on a handoff Communication or discharge packet. */
export function handoffContentCodes(resource: FhirResource): string[] {
  const exts = (resource as {
    extension?: { url?: string; valueCodeableConcept?: { coding?: { code?: string }[] } }[]
  }).extension
  return (exts ?? [])
    .filter(e => e.url === HANDOFF_CONTENT_ITEM_EXT)
    .map(e => e.valueCodeableConcept?.coding?.[0]?.code)
    .filter((c): c is string => !!c)
}

// ─── TL-030 — Discharge safety packet (DocumentReference) ─────

export function buildDischargePacket(params: {
  id: string
  patientId: string | null
  date: string
  title: string
  contentCodes: string[]
  /** Live resources the packet was assembled from, as `Type/id` references. */
  relatedReferences?: string[]
  note?: string
}): DocumentReferenceResource {
  const related = params.relatedReferences ?? []
  return {
    resourceType: 'DocumentReference',
    id: params.id,
    meta: { profile: [PACKET_PROFILE], tag: stageTag() },
    status: 'current',
    type: { text: 'Suicide-safety discharge packet' },
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    date: params.date,
    // The attachment IS the packet. In the demo there is no binary to attach,
    // so only its title and content type are asserted — a real implementation
    // would carry `url` or `data`.
    content: [
      {
        attachment: {
          contentType: 'application/pdf',
          title: params.title,
        },
      },
    ],
    // context.related is what keeps the packet from becoming a stale copy
    // divorced from the record: it points at the live safety plan, risk
    // Observation and follow-up Appointment it was assembled from.
    ...(related.length
      ? { context: { related: related.map(reference => ({ reference })) } }
      : {}),
    extension: contentItemExtensions(params.contentCodes),
    ...(params.note ? { description: params.note } : {}),
  }
}

// ─── TL-017 — Referral / next provider handoff (ServiceRequest) ─

export function buildSafetyReferral(params: {
  id: string
  patientId: string | null
  status: string
  reason: string
  performer: string
  authoredOn: string
  serviceText?: string
  note?: string
}): ServiceRequestResource {
  return {
    resourceType: 'ServiceRequest',
    id: params.id,
    meta: { profile: [REFERRAL_PROFILE], tag: stageTag() },
    status: params.status,
    // Fixed by the profile: this is an order, not a proposal or a plan.
    intent: 'order',
    code: { text: params.serviceText?.trim() || 'Suicide-safety referral' },
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    authoredOn: params.authoredOn,
    reasonCode: [
      {
        coding: [
          {
            system: REFERRAL_REASON_SYSTEM,
            code: params.reason,
            display: displayFor(REFERRAL_REASONS, params.reason),
          },
        ],
      },
    ],
    ...(params.performer.trim()
      ? { performer: [{ display: params.performer.trim() }] }
      : {}),
    ...(params.note ? { note: [{ text: params.note }] } : {}),
  }
}

/**
 * Advance a referral's status, keeping the same id so the store's
 * upsert-by-id replaces it rather than leaving a stale "sent" copy behind.
 * This is the tracking the SSC asks for, and the reason a Communication
 * wouldn't do.
 */
export function setReferralStatus(
  referral: ServiceRequestResource,
  status: string,
): ServiceRequestResource {
  return { ...referral, status }
}

export function isReferralOpen(referral: ServiceRequestResource): boolean {
  return OPEN_REFERRAL_STATUSES.has((referral as { status?: string }).status ?? '')
}

export function referralPerformer(referral: ServiceRequestResource): string | undefined {
  const performers = (referral as { performer?: { display?: string }[] }).performer
  return performers?.[0]?.display
}

// ─── TL-031 — Next appointment (Appointment) ──────────────────

/**
 * Note the participant array: Appointment has NO `subject` or `patient`
 * element — the patient is a `participant.actor`. Writing `subject` here (or in
 * the SMART source's create payload) would be invalid FHIR that a strict server
 * rejects and a lenient one silently drops, losing the patient link. This is
 * the same class of bug Stage 7 hit with EpisodeOfCare.patient / Task.for.
 */
export function buildFollowUpAppointment(params: {
  id: string
  patientId: string | null
  status: string
  start: string
  /** Minutes; the profile requires only `start`, but an end reads better. */
  durationMinutes?: number
  provider?: string
  description?: string
  note?: string
}): AppointmentResource {
  const startMs = new Date(params.start).getTime()
  const end =
    Number.isFinite(startMs) && params.durationMinutes
      ? new Date(startMs + params.durationMinutes * 60_000).toISOString()
      : undefined
  return {
    resourceType: 'Appointment',
    id: params.id,
    meta: { profile: [APPOINTMENT_PROFILE], tag: stageTag() },
    status: params.status,
    description: params.description?.trim() || 'Suicide-safety follow-up visit',
    start: params.start,
    ...(end ? { end } : {}),
    participant: [
      {
        actor: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
        status: 'accepted',
      },
      ...(params.provider?.trim()
        ? [{ actor: { display: params.provider.trim() }, status: 'accepted' }]
        : []),
    ],
    ...(params.note ? { comment: params.note } : {}),
  }
}

/** Same id ⇒ the store upserts, so tracking an outcome updates one resource. */
export function setAppointmentStatus(
  appointment: AppointmentResource,
  status: string,
): AppointmentResource {
  return { ...appointment, status }
}

export function appointmentStart(appointment: AppointmentResource): string | undefined {
  return (appointment as { start?: string }).start
}

export function appointmentStatus(appointment: AppointmentResource): string {
  return (appointment as { status?: string }).status ?? 'proposed'
}

export function appointmentProvider(appointment: AppointmentResource): string | undefined {
  const participants = (appointment as {
    participant?: { actor?: { display?: string; reference?: string } }[]
  }).participant
  return participants?.find(p => p.actor?.display && !p.actor.reference)?.actor?.display
}

// ─── TL-032 — Information-sharing consent (Consent) ───────────

/**
 * A permit/deny decision plus an optional nested deny for one named support
 * person — the SSC's "patient declined" case. Per the Stage-5 design, declining
 * is a deny *provision*, not a separate status, so any consent engine can
 * compute what to send at a handoff without SPiER-specific logic.
 */
export function buildSharingConsent(params: {
  id: string
  patientId: string | null
  dateTime: string
  decision: string
  recipient: string
  expiry?: string
  /** Named actor explicitly excluded even when the top-level decision permits. */
  deniedActor?: string
}): ConsentResource {
  const start = params.dateTime.slice(0, 10)
  return {
    resourceType: 'Consent',
    id: params.id,
    meta: { profile: [CONSENT_PROFILE], tag: stageTag() },
    status: 'active',
    scope: {
      coding: [{ system: CONSENT_SCOPE_SYSTEM, code: 'patient-privacy', display: 'Privacy Consent' }],
    },
    // Required by the base Consent invariant ppc-1 ("Either a Policy or
    // PolicyRule"). Not optional garnish: without it every Consent this recorder
    // writes is invalid and a strict server rejects it. The IG's own example
    // shipped without it in Wave 5 and only the IG Publisher's FHIRPath run
    // caught it (#201) — SUSHI does not evaluate invariants, so nothing in
    // `npm run verify` would flag this. Same code as the example, deliberately.
    policyRule: {
      coding: [{ system: CONSENT_POLICY_SYSTEM, code: 'hipaa-auth', display: 'HIPAA Authorization' }],
    },
    // Only the category is SPiER-local — it marks this record as governing
    // suicide-safety sharing. Everything else is native Consent structure.
    category: [
      {
        coding: [
          {
            system: CONSENT_CATEGORY_SYSTEM,
            code: 'suicide-safety-sharing',
            display: 'Suicide-safety information sharing',
          },
        ],
      },
    ],
    patient: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    dateTime: params.dateTime,
    provision: {
      type: params.decision,
      period: { start, ...(params.expiry ? { end: params.expiry } : {}) },
      ...(params.recipient.trim()
        ? {
            actor: [
              {
                role: {
                  coding: [
                    {
                      system: PARTICIPATION_TYPE_SYSTEM,
                      code: 'IRCP',
                      display: 'information recipient',
                    },
                  ],
                },
                reference: { display: params.recipient.trim() },
              },
            ],
          }
        : {}),
      ...(params.deniedActor?.trim()
        ? {
            provision: [
              {
                type: 'deny',
                actor: [
                  {
                    role: {
                      coding: [
                        {
                          system: PARTICIPATION_TYPE_SYSTEM,
                          code: 'IRCP',
                          display: 'information recipient',
                        },
                      ],
                    },
                    reference: { display: params.deniedActor.trim() },
                  },
                ],
              },
            ],
          }
        : {}),
    },
  }
}

/** The permit/deny decision on a consent record, or undefined. */
export function consentDecision(consent: ConsentResource): string | undefined {
  return (consent as { provision?: { type?: string } }).provision?.type
}

export function consentRecipient(consent: ConsentResource): string | undefined {
  const actors = (consent as {
    provision?: { actor?: { reference?: { display?: string } }[] }
  }).provision?.actor
  return actors?.[0]?.reference?.display
}

/**
 * The active sharing consent, if any — the most recently dated `active` record.
 * A patient can have several over time (consent is re-asked, or expires); the
 * newest is the one that governs a handoff happening now.
 */
export function currentSharingConsent(consents: ConsentResource[]): ConsentResource | undefined {
  return consents
    .filter(c => (c as { status?: string }).status === 'active')
    .slice()
    .sort((a, b) => {
      const da = (a as { dateTime?: string }).dateTime ?? ''
      const db = (b as { dateTime?: string }).dateTime ?? ''
      return db.localeCompare(da)
    })[0]
}
