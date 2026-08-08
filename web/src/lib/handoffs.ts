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
 * The four are not independent: `applySharingConsent()` at the foot of this
 * file is where the TL-032 consent stops being a record and starts being a
 * rule, deciding what the TL-030 packet may assert it carries.
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
export const WITHHOLDING_BASIS_SYSTEM = 'http://spier.org/CodeSystem/spier-withholding-basis'

export const HANDOFF_CONTENT_ITEM_EXT = 'http://spier.org/StructureDefinition/handoff-content-item'
export const HANDOFF_WITHHELD_ITEM_EXT =
  'http://spier.org/StructureDefinition/handoff-withheld-item'

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

/**
 * Why an item is NOT in the packet. Displays must match spier-withholding-basis
 * in ig/input/fsh/handoffs.fsh exactly — `validate-fhir.mjs` compares every
 * `Coding.display` against the SPiER CodeSystem it names.
 */
export const WITHHOLDING_BASES: CodedOption[] = [
  { code: 'patient-declined-sharing', display: 'Patient declined sharing' },
  { code: 'category-excluded', display: 'Category excluded by the patient' },
  { code: 'recipient-excluded', display: 'Recipient excluded by the patient' },
  { code: 'recipient-not-authorised', display: 'Recipient not authorised by the consent' },
  { code: 'consent-expired', display: 'Sharing consent expired' },
  { code: 'no-consent-recorded', display: 'No sharing consent on file' },
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

/**
 * The complex counterpart of contentItemExtensions: each withheld item carries
 * the content code AND the basis, as two sub-extensions. Pairing them is the
 * point — a packet that merely dropped the code would be indistinguishable
 * from one assembled before anybody asked the patient.
 */
function withheldItemExtensions(items: WithheldItem[]) {
  return items.map(({ code, basis }) => ({
    url: HANDOFF_WITHHELD_ITEM_EXT,
    extension: [
      {
        url: 'item',
        valueCodeableConcept: {
          coding: [
            {
              system: HANDOFF_CONTENT_SYSTEM,
              code,
              display: displayFor(HANDOFF_CONTENT_ITEMS, code),
            },
          ],
        },
      },
      {
        url: 'basis',
        valueCodeableConcept: {
          coding: [
            {
              system: WITHHOLDING_BASIS_SYSTEM,
              code: basis,
              display: displayFor(WITHHOLDING_BASES, basis),
            },
          ],
        },
      },
    ],
  }))
}

/** Items a packet records as deliberately left out, with the basis for each. */
export function handoffWithheldItems(resource: FhirResource): WithheldItem[] {
  const exts = (resource as {
    extension?: {
      url?: string
      extension?: { url?: string; valueCodeableConcept?: { coding?: { code?: string }[] } }[]
    }[]
  }).extension
  return (exts ?? [])
    .filter(e => e.url === HANDOFF_WITHHELD_ITEM_EXT)
    .map(e => ({
      code: e.extension?.find(s => s.url === 'item')?.valueCodeableConcept?.coding?.[0]?.code,
      basis: e.extension?.find(s => s.url === 'basis')?.valueCodeableConcept?.coding?.[0]?.code,
    }))
    .filter((w): w is WithheldItem => !!w.code && !!w.basis)
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
  /** What the sharing consent kept out of it, and why. See applySharingConsent. */
  withheldItems?: WithheldItem[]
  /**
   * The consent that governed assembly, as `Consent/id`. Joins `context.related`
   * so the omissions above are traceable to the preference that caused them —
   * DocumentReference has no element for "the authority this was released under",
   * and inventing one would say more than the resource can back.
   */
  consentReference?: string
  note?: string
}): DocumentReferenceResource {
  const withheld = params.withheldItems ?? []
  const related = [...(params.relatedReferences ?? [])]
  if (params.consentReference && !related.includes(params.consentReference)) {
    related.push(params.consentReference)
  }
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
    extension: [
      ...contentItemExtensions(params.contentCodes),
      ...withheldItemExtensions(withheld),
    ],
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
  /**
   * Handoff-content categories the patient excluded — the same vocabulary the
   * discharge packet checks itself against, which is what lets one resource
   * gate the other without SPiER-specific logic.
   */
  deniedContentCodes?: string[]
}): ConsentResource {
  const deniedCodes = params.deniedContentCodes ?? []
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
      // Two nested denies rather than one combined provision. Within a single
      // provision the criteria are ANDed, so actor + code together would say
      // "deny these categories *to this person*" — narrower than what the
      // patient stated. Independent preferences stay independent provisions.
      ...(params.deniedActor?.trim() || deniedCodes.length
        ? {
            provision: [
              ...(params.deniedActor?.trim()
                ? [
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
                  ]
                : []),
              ...(deniedCodes.length
                ? [
                    {
                      type: 'deny',
                      code: deniedCodes.map(code => ({
                        coding: [
                          {
                            system: HANDOFF_CONTENT_SYSTEM,
                            code,
                            display: displayFor(HANDOFF_CONTENT_ITEMS, code),
                          },
                        ],
                      })),
                    },
                  ]
                : []),
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

/** Nested deny provisions — where the exclusions live. */
function denyProvisions(consent: ConsentResource) {
  const nested = (consent as {
    provision?: {
      provision?: {
        type?: string
        actor?: { reference?: { display?: string } }[]
        code?: { coding?: { code?: string }[] }[]
      }[]
    }
  }).provision?.provision
  return (nested ?? []).filter(p => p.type === 'deny')
}

/**
 * Recipients the root provision names. In FHIR a provision's `actor` NARROWS
 * it, so a permit naming one clinic authorises that clinic — not everyone.
 * An empty list is an unrestricted permit.
 */
export function permittedRecipients(consent: ConsentResource): string[] {
  const actors = (consent as {
    provision?: { actor?: { reference?: { display?: string } }[] }
  }).provision?.actor
  return (actors ?? []).map(a => a.reference?.display).filter((d): d is string => !!d)
}

/** Recipients the patient excluded by name, even where the decision permits. */
export function deniedRecipients(consent: ConsentResource): string[] {
  return denyProvisions(consent)
    .flatMap(p => p.actor ?? [])
    .map(a => a.reference?.display)
    .filter((d): d is string => !!d)
}

/** Handoff-content categories the patient excluded. */
export function deniedContentCodes(consent: ConsentResource): string[] {
  return denyProvisions(consent)
    .flatMap(p => p.code ?? [])
    .flatMap(c => c.coding ?? [])
    .map(c => c.code)
    .filter((c): c is string => !!c)
}

/** The end of the consent's authorising period, if it carries one. */
export function consentExpiry(consent: ConsentResource): string | undefined {
  return (consent as { provision?: { period?: { end?: string } } }).provision?.period?.end
}

/** Expiry is relative to when release happens, not to today. */
function isConsentExpired(consent: ConsentResource, asOf: string): boolean {
  const end = consentExpiry(consent)
  return !!end && end.slice(0, 10) < asOf.slice(0, 10)
}

/** Free-text party names, compared the only way free text can be. */
function sameParty(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export type WithholdingBasis =
  | 'patient-declined-sharing'
  | 'category-excluded'
  | 'recipient-excluded'
  | 'recipient-not-authorised'
  | 'consent-expired'
  | 'no-consent-recorded'

export interface WithheldItem {
  code: string
  basis: WithholdingBasis
}

export interface SharingDecision {
  /** Content codes the packet may assert it carries. */
  included: string[]
  /** Codes it may not, each with the basis it was withheld on. */
  withheld: WithheldItem[]
  /** The governing consent, expired or not — undefined when none is on file. */
  consent?: ConsentResource
  /** True when `consent` exists but its period ended before the release date. */
  expired: boolean
  /** No recipient named: the packet is the patient's own copy. */
  patientCopyOnly: boolean
  /** Set when one rule withheld everything, rather than per-category exclusions. */
  blanketBasis?: WithholdingBasis
}

/**
 * The consent gate — the one place in SPiER where a recorded patient preference
 * changes what an artifact contains (issues #227 / #168 / #170).
 *
 * Deliberately narrow, and the narrowness is the honest part: SPiER is not a
 * consent-enforcement engine for arbitrary access. This decides one thing — what
 * THIS packet, assembled at THIS moment for THIS recipient, may assert it
 * carries — and it decides it from native Consent provisions, so a real consent
 * engine would reach the same answer without reading SPiER's code.
 *
 * Two rules worth stating out loud, because both are choices rather than
 * consequences of FHIR:
 *
 *  1. **No recipient means no gate.** A sharing consent governs disclosure to a
 *     third party. Handing patients their own safety material is not a
 *     disclosure, so a packet with no recipient named goes out whole — including
 *     when a deny is on file. Reading a deny as "the patient may not have their
 *     own safety plan" would invert what they asked for.
 *  2. **No consent on file withholds everything from a third party.** The
 *     conservative direction, and the reason the basis vocabulary has a code for
 *     it: an adopting site can see the default was applied rather than inferring
 *     permission from silence. Sites that decide otherwise are changing a
 *     documented default, not discovering an undocumented one.
 */
export function applySharingConsent(params: {
  contentCodes: string[]
  /** Who the packet is being released to. Empty ⇒ the patient's own copy. */
  recipient?: string
  consents: ConsentResource[]
  /** The packet's own date — an expiry is judged against the release, not today. */
  asOf: string
}): SharingDecision {
  const recipient = params.recipient?.trim() ?? ''
  const consent = currentSharingConsent(params.consents)
  const expired = consent ? isConsentExpired(consent, params.asOf) : false
  const base = { consent, expired, patientCopyOnly: recipient === '' }

  if (recipient === '') {
    return { ...base, included: [...params.contentCodes], withheld: [] }
  }

  const blanket = (basis: WithholdingBasis): SharingDecision => ({
    ...base,
    included: [],
    withheld: params.contentCodes.map(code => ({ code, basis })),
    blanketBasis: basis,
  })

  if (!consent) return blanket('no-consent-recorded')
  if (expired) return blanket('consent-expired')
  if (consentDecision(consent) === 'deny') return blanket('patient-declined-sharing')
  if (deniedRecipients(consent).some(a => sameParty(a, recipient))) {
    return blanket('recipient-excluded')
  }
  // A permit that names recipients permits THOSE recipients. Reading it as
  // blanket permission is the quiet failure this whole gate exists to prevent:
  // one consent to share with the receiving clinic would become authority to
  // send the same packet anywhere.
  const permitted = permittedRecipients(consent)
  if (permitted.length > 0 && !permitted.some(a => sameParty(a, recipient))) {
    return blanket('recipient-not-authorised')
  }

  const denied = new Set(deniedContentCodes(consent))
  return {
    ...base,
    included: params.contentCodes.filter(code => !denied.has(code)),
    withheld: params.contentCodes
      .filter(code => denied.has(code))
      .map(code => ({ code, basis: 'category-excluded' as const })),
  }
}
