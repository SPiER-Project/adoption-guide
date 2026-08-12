import { describe, it, expect } from 'vitest'
import {
  applySharingConsent,
  appointmentProvider,
  appointmentStart,
  appointmentStatus,
  buildDischargePacket,
  buildFollowUpAppointment,
  buildSafetyReferral,
  buildSharingConsent,
  consentDecision,
  consentRecipient,
  currentSharingConsent,
  deniedContentCodes,
  deniedRecipients,
  handoffContentCodes,
  handoffWithheldItems,
  isReferralOpen,
  referralPerformer,
  setAppointmentStatus,
  setReferralStatus,
  CONSENT_CATEGORY_SYSTEM,
  HANDOFF_CONTENT_ITEM_EXT,
  HANDOFF_CONTENT_SYSTEM,
  HANDOFF_WITHHELD_ITEM_EXT,
  WITHHOLDING_BASIS_SYSTEM,
  REFERRAL_REASON_SYSTEM,
} from './handoffs'
import { CONCEPT_DOMAIN_SYSTEM } from './conceptDomain'
import { PATHWAY_STAGE_SYSTEM, stageForArtifact } from './patientPathway'
import type { ConsentResource } from '../types/fhir'

describe('discharge safety packet (TL-030)', () => {
  const packet = buildDischargePacket({
    id: 'packet-1',
    patientId: 'patient-005',
    date: '2026-07-20T15:10:00Z',
    title: 'Suicide-safety discharge packet',
    contentCodes: ['safety-plan-copy', 'crisis-resources'],
    relatedReferences: ['CarePlan/careplan-stanley-brown-1', 'Appointment/appointment-1'],
  })

  it('is a current DocumentReference with the patient as subject', () => {
    expect(packet.resourceType).toBe('DocumentReference')
    expect(packet.status).toBe('current')
    expect(packet.subject).toEqual({ reference: 'Patient/patient-005' })
    expect(packet.date).toBe('2026-07-20T15:10:00Z')
  })

  it('carries the packet as an attachment rather than inline content', () => {
    const content = packet.content as { attachment?: { title?: string; contentType?: string } }[]
    expect(content).toHaveLength(1)
    expect(content[0].attachment?.title).toBe('Suicide-safety discharge packet')
  })

  it('points at the live resources it was assembled from', () => {
    // The design point: context.related keeps the packet from becoming a stale
    // copy divorced from the record.
    const context = packet.context as { related?: { reference?: string }[] }
    expect(context.related?.map(r => r.reference)).toEqual([
      'CarePlan/careplan-stanley-brown-1',
      'Appointment/appointment-1',
    ])
  })

  it('records its checklist as repeating handoff-content-item extensions', () => {
    const exts = packet.extension as { url?: string }[]
    expect(exts.every(e => e.url === HANDOFF_CONTENT_ITEM_EXT)).toBe(true)
    expect(handoffContentCodes(packet)).toEqual(['safety-plan-copy', 'crisis-resources'])
  })

  it('stages itself to Coordinate Handoffs through meta.tag', () => {
    expect(stageForArtifact(packet)).toBe('coordinate-handoffs')
  })

  it('omits context entirely when nothing was linked', () => {
    const bare = buildDischargePacket({
      id: 'packet-2',
      patientId: 'patient-005',
      date: '2026-07-20T15:10:00Z',
      title: 'Packet',
      contentCodes: [],
    })
    expect(bare.context).toBeUndefined()
    expect(handoffContentCodes(bare)).toEqual([])
  })
})

describe('safety referral (TL-017)', () => {
  const referral = buildSafetyReferral({
    id: 'referral-1',
    patientId: 'patient-005',
    status: 'active',
    reason: 'post-discharge-follow-up',
    performer: 'Riverside Behavioral Health',
    authoredOn: '2026-07-20T15:05:00Z',
    serviceText: 'Referral to outpatient behavioral health',
  })

  it('is an order-intent ServiceRequest, not a Communication', () => {
    // The whole reason TL-017 migrated: a Communication only records that
    // something was sent, so it cannot express accepted/completed.
    expect(referral.resourceType).toBe('ServiceRequest')
    expect(referral.intent).toBe('order')
    expect(referral.subject).toEqual({ reference: 'Patient/patient-005' })
    expect(referral.authoredOn).toBe('2026-07-20T15:05:00Z')
  })

  it('codes the referral reason against the SPiER reason system', () => {
    const reasons = referral.reasonCode as { coding?: { system?: string; code?: string }[] }[]
    expect(reasons[0].coding?.[0]).toMatchObject({
      system: REFERRAL_REASON_SYSTEM,
      code: 'post-discharge-follow-up',
    })
  })

  it('names the receiving team as performer', () => {
    expect(referralPerformer(referral)).toBe('Riverside Behavioral Health')
  })

  it('omits performer when no receiving team was named', () => {
    const anonymous = buildSafetyReferral({
      id: 'referral-2',
      patientId: null,
      status: 'draft',
      reason: 'elevated-risk',
      performer: '   ',
      authoredOn: '2026-07-20T15:05:00Z',
    })
    expect(anonymous.performer).toBeUndefined()
    expect(anonymous.subject).toEqual({ reference: 'Patient/demo-patient' })
  })

  it('tracks open through to completed on the SAME resource', () => {
    expect(isReferralOpen(referral)).toBe(true)
    const completed = setReferralStatus(referral, 'completed')
    // Same id is what lets the store upsert rather than leaving a stale "sent"
    // copy that would still read as outstanding.
    expect(completed.id).toBe(referral.id)
    expect(completed.status).toBe('completed')
    expect(isReferralOpen(completed)).toBe(false)
  })

  it('treats draft as open and revoked as closed', () => {
    expect(isReferralOpen(setReferralStatus(referral, 'draft'))).toBe(true)
    expect(isReferralOpen(setReferralStatus(referral, 'revoked'))).toBe(false)
  })
})

describe('follow-up appointment (TL-031)', () => {
  const appointment = buildFollowUpAppointment({
    id: 'appointment-1',
    patientId: 'patient-005',
    status: 'booked',
    start: '2026-08-04T18:00:00.000Z',
    durationMinutes: 45,
    provider: 'Riverside Behavioral Health',
    description: 'Post-discharge behavioral health follow-up',
  })

  it('links the patient as a participant, NOT as subject or patient', () => {
    // Appointment has neither element; writing `subject` would be invalid FHIR
    // that a strict server rejects and a lenient one silently drops.
    expect(appointment.subject).toBeUndefined()
    expect(appointment.patient).toBeUndefined()
    const participants = appointment.participant as {
      actor?: { reference?: string; display?: string }
      status?: string
    }[]
    expect(participants[0].actor?.reference).toBe('Patient/patient-005')
    expect(participants[0].status).toBe('accepted')
  })

  it('adds the receiving provider as a second participant', () => {
    expect(appointmentProvider(appointment)).toBe('Riverside Behavioral Health')
    expect((appointment.participant as unknown[]).length).toBe(2)
  })

  it('computes end from the duration', () => {
    expect(appointment.end).toBe('2026-08-04T18:45:00.000Z')
  })

  it('still emits an end when no duration was given — app-2 requires both or neither', () => {
    const open = buildFollowUpAppointment({
      id: 'appointment-2',
      patientId: 'patient-005',
      status: 'booked',
      start: '2026-08-04T18:00:00.000Z',
    })
    // This assertion used to be `toBeUndefined()`. Emitting `start` without
    // `end` violates base FHIR `app-2` ("Either start and end are specified, or
    // neither") and `app-3`, which permits a missing start/end only on a proposed
    // or cancelled appointment. The UI passes
    // `Number(duration) || undefined`, so an empty duration field produced
    // exactly that invalid resource until #302's validator gate caught it.
    expect(open.end).toBe('2026-08-04T18:30:00.000Z')
    // No provider named ⇒ patient is the only participant, and the profile's
    // participant 1..* still holds.
    expect((open.participant as unknown[]).length).toBe(1)
    expect(appointmentProvider(open)).toBeUndefined()
  })

  it('resolves outcome in place, keeping the same resource', () => {
    const attended = setAppointmentStatus(appointment, 'fulfilled')
    expect(attended.id).toBe(appointment.id)
    expect(appointmentStatus(attended)).toBe('fulfilled')
    expect(appointmentStart(attended)).toBe('2026-08-04T18:00:00.000Z')
  })

  it('stages itself to Coordinate Handoffs', () => {
    const tag = (appointment.meta as { tag?: { system?: string; code?: string }[] }).tag
    expect(tag?.[0]).toMatchObject({ system: PATHWAY_STAGE_SYSTEM, code: 'coordinate-handoffs' })
  })

  it('carries the concept-domain tag on serviceCategory, not category (#272)', () => {
    // Appointment is the one profiled type with no `category` element, so the
    // domain tag rides on `serviceCategory` — which is what
    // `Appointment?service-category=…|suicide-risk` searches. `category` here
    // would be silently dropped by a server and unreachable by any query.
    expect(appointment.category).toBeUndefined()
    const serviceCategory = appointment.serviceCategory as {
      coding?: { system?: string; code?: string }[]
    }[]
    expect(serviceCategory?.[0]?.coding?.[0]).toMatchObject({
      system: CONCEPT_DOMAIN_SYSTEM,
      code: 'suicide-risk',
    })
  })
})

describe('information-sharing consent (TL-032)', () => {
  const permit = buildSharingConsent({
    id: 'consent-1',
    patientId: 'patient-005',
    dateTime: '2026-07-20T14:55:00Z',
    decision: 'permit',
    recipient: 'Riverside Behavioral Health',
    expiry: '2027-07-20',
    deniedActor: 'Support person — declined by patient',
  })

  it('uses `patient`, not `subject`', () => {
    expect(permit.patient).toEqual({ reference: 'Patient/patient-005' })
    expect(permit.subject).toBeUndefined()
  })

  it('satisfies the base ppc-1 invariant with a policyRule', () => {
    // Regression guard. ppc-1 ("Either a Policy or PolicyRule") is a FHIRPath
    // invariant, and SUSHI does not evaluate those — the IG's own example
    // shipped violating it and only the IG Publisher caught it. Nothing else in
    // `npm run verify` would notice if this dropped off.
    const policyRule = permit.policyRule as { coding?: { system?: string; code?: string }[] }
    expect(policyRule.coding?.[0]).toMatchObject({
      system: 'http://terminology.hl7.org/CodeSystem/consentpolicycodes',
      code: 'hipaa-auth',
    })
  })

  it('marks the record with the SPiER consent category', () => {
    const categories = permit.category as { coding?: { system?: string; code?: string }[] }[]
    expect(categories[0].coding?.[0]).toMatchObject({
      system: CONSENT_CATEGORY_SYSTEM,
      code: 'suicide-safety-sharing',
    })
  })

  it('carries permit/deny as the provision type — not as a status', () => {
    // "Patient declined" is a deny provision. status stays `active` because the
    // consent RECORD is active either way.
    expect(permit.status).toBe('active')
    expect(consentDecision(permit)).toBe('permit')
    expect(consentRecipient(permit)).toBe('Riverside Behavioral Health')

    const declined = buildSharingConsent({
      id: 'consent-2',
      patientId: 'patient-005',
      dateTime: '2026-07-21T09:00:00Z',
      decision: 'deny',
      recipient: 'Riverside Behavioral Health',
    })
    expect(declined.status).toBe('active')
    expect(consentDecision(declined)).toBe('deny')
  })

  it('expresses "share with the clinic but not this person" as a nested deny', () => {
    const provision = permit.provision as {
      period?: { start?: string; end?: string }
      provision?: { type?: string; actor?: { reference?: { display?: string } }[] }[]
    }
    expect(provision.period).toEqual({ start: '2026-07-20', end: '2027-07-20' })
    expect(provision.provision?.[0].type).toBe('deny')
    expect(provision.provision?.[0].actor?.[0].reference?.display).toBe(
      'Support person — declined by patient',
    )
  })

  it('omits the nested provision and expiry when not supplied', () => {
    const minimal = buildSharingConsent({
      id: 'consent-3',
      patientId: 'patient-005',
      dateTime: '2026-07-20T14:55:00Z',
      decision: 'permit',
      recipient: '',
    })
    const provision = minimal.provision as {
      period?: { end?: string }
      provision?: unknown[]
      actor?: unknown[]
    }
    expect(provision.period?.end).toBeUndefined()
    expect(provision.provision).toBeUndefined()
    expect(provision.actor).toBeUndefined()
  })

  it('resolves the newest active record as the governing consent', () => {
    const older = buildSharingConsent({
      id: 'consent-old',
      patientId: 'patient-005',
      dateTime: '2026-06-01T10:00:00Z',
      decision: 'deny',
      recipient: 'Riverside Behavioral Health',
    })
    const inactive = {
      ...buildSharingConsent({
        id: 'consent-inactive',
        patientId: 'patient-005',
        dateTime: '2026-12-01T10:00:00Z',
        decision: 'deny',
        recipient: 'Riverside Behavioral Health',
      }),
      status: 'inactive',
    } as ConsentResource

    // Newest wins, but an inactive record never does — even when it is newest.
    expect(currentSharingConsent([older, permit, inactive])?.id).toBe('consent-1')
    expect(currentSharingConsent([])).toBeUndefined()
  })

  it('records excluded content categories as a SECOND nested deny', () => {
    // Not folded into the actor deny: criteria within one provision are ANDed,
    // so "deny this category" and "deny this person" in the same provision would
    // read as "deny this category to this person" — narrower than either.
    const consent = buildSharingConsent({
      id: 'consent-4',
      patientId: 'patient-005',
      dateTime: '2026-07-20T14:55:00Z',
      decision: 'permit',
      recipient: 'Riverside Behavioral Health',
      deniedActor: 'Support person — declined by patient',
      deniedContentCodes: ['recent-assessment', 'safety-plan-copy'],
    })
    const nested = (consent.provision as { provision?: { type?: string }[] }).provision
    expect(nested).toHaveLength(2)
    expect(nested?.every(p => p.type === 'deny')).toBe(true)

    expect(deniedRecipients(consent)).toEqual(['Support person — declined by patient'])
    expect(deniedContentCodes(consent)).toEqual(['recent-assessment', 'safety-plan-copy'])

    const codes = (
      nested?.[1] as { code?: { coding?: { system?: string; code?: string }[] }[] }
    ).code
    expect(codes?.[0].coding?.[0]).toMatchObject({
      system: HANDOFF_CONTENT_SYSTEM,
      code: 'recent-assessment',
    })
  })
})

describe('the consent gate (TL-030 reading TL-032)', () => {
  const CONTENT = ['current-risk-status', 'recent-assessment', 'safety-plan-copy', 'crisis-resources']
  const RECIPIENT = 'Riverside Behavioral Health'
  const ASOF = '2026-07-20T15:10:00Z'

  const permit = buildSharingConsent({
    id: 'consent-permit',
    patientId: 'patient-005',
    dateTime: '2026-07-20T14:55:00Z',
    decision: 'permit',
    recipient: RECIPIENT,
    expiry: '2027-07-20',
  })

  it('withholds the categories a deny provision names, and nothing else', () => {
    const consent = buildSharingConsent({
      id: 'consent-categories',
      patientId: 'patient-005',
      dateTime: '2026-07-20T14:55:00Z',
      decision: 'permit',
      recipient: RECIPIENT,
      deniedContentCodes: ['recent-assessment', 'safety-plan-copy'],
    })
    const decision = applySharingConsent({
      contentCodes: CONTENT,
      recipient: RECIPIENT,
      consents: [consent],
      asOf: ASOF,
    })
    expect(decision.included).toEqual(['current-risk-status', 'crisis-resources'])
    expect(decision.withheld).toEqual([
      { code: 'recent-assessment', basis: 'category-excluded' },
      { code: 'safety-plan-copy', basis: 'category-excluded' },
    ])
    expect(decision.blanketBasis).toBeUndefined()
  })

  it('withholds everything when the decision itself is deny', () => {
    const declined = buildSharingConsent({
      id: 'consent-deny',
      patientId: 'patient-005',
      dateTime: '2026-07-21T09:00:00Z',
      decision: 'deny',
      recipient: RECIPIENT,
    })
    const decision = applySharingConsent({
      contentCodes: CONTENT,
      recipient: RECIPIENT,
      consents: [permit, declined],
      asOf: ASOF,
    })
    expect(decision.included).toEqual([])
    expect(decision.blanketBasis).toBe('patient-declined-sharing')
    expect(decision.withheld).toHaveLength(CONTENT.length)
  })

  it('withholds everything from a recipient the patient excluded by name', () => {
    const consent = buildSharingConsent({
      id: 'consent-excluded-actor',
      patientId: 'patient-005',
      dateTime: '2026-07-20T14:55:00Z',
      decision: 'permit',
      recipient: RECIPIENT,
      deniedActor: 'Aunt Ruth',
    })
    // Free-text party names, so the comparison is trimmed and case-insensitive —
    // the alternative is a deny that silently fails to bind.
    const decision = applySharingConsent({
      contentCodes: CONTENT,
      recipient: '  aunt ruth ',
      consents: [consent],
      asOf: ASOF,
    })
    expect(decision.blanketBasis).toBe('recipient-excluded')
    expect(decision.included).toEqual([])

    // The permitted recipient on the same consent is unaffected.
    expect(
      applySharingConsent({ contentCodes: CONTENT, recipient: RECIPIENT, consents: [consent], asOf: ASOF })
        .included,
    ).toEqual(CONTENT)
  })

  it('does not let a permit for one recipient authorise release to another', () => {
    // The quiet failure this gate exists to prevent. `provision.actor` NARROWS
    // a provision, so a permit naming the receiving clinic is not authority to
    // send the same packet to a different one.
    const consent = buildSharingConsent({
      id: 'consent-named',
      patientId: 'patient-005',
      dateTime: '2026-07-20T14:55:00Z',
      decision: 'permit',
      recipient: RECIPIENT,
    })
    const elsewhere = applySharingConsent({
      contentCodes: CONTENT,
      recipient: 'Some Other Clinic',
      consents: [consent],
      asOf: ASOF,
    })
    expect(elsewhere.blanketBasis).toBe('recipient-not-authorised')
    expect(elsewhere.included).toEqual([])

    // A permit naming nobody is unrestricted, and stays that way.
    const openEnded = buildSharingConsent({
      id: 'consent-open',
      patientId: 'patient-005',
      dateTime: '2026-07-20T14:55:00Z',
      decision: 'permit',
      recipient: '',
    })
    expect(
      applySharingConsent({
        contentCodes: CONTENT,
        recipient: 'Some Other Clinic',
        consents: [openEnded],
        asOf: ASOF,
      }).included,
    ).toEqual(CONTENT)
  })

  it('treats an expired consent as no authorisation, judged at the release date', () => {
    const expiring = buildSharingConsent({
      id: 'consent-expiring',
      patientId: 'patient-005',
      dateTime: '2025-01-01T09:00:00Z',
      decision: 'permit',
      recipient: RECIPIENT,
      expiry: '2026-07-19',
    })
    const late = applySharingConsent({
      contentCodes: CONTENT,
      recipient: RECIPIENT,
      consents: [expiring],
      asOf: ASOF,
    })
    expect(late.blanketBasis).toBe('consent-expired')
    expect(late.expired).toBe(true)

    // Same consent, a release one day earlier: still good.
    const inTime = applySharingConsent({
      contentCodes: CONTENT,
      recipient: RECIPIENT,
      consents: [expiring],
      asOf: '2026-07-19T08:00:00Z',
    })
    expect(inTime.expired).toBe(false)
    expect(inTime.included).toEqual(CONTENT)
  })

  it('withholds everything from a third party when NO consent is on file', () => {
    const decision = applySharingConsent({
      contentCodes: CONTENT,
      recipient: RECIPIENT,
      consents: [],
      asOf: ASOF,
    })
    expect(decision.blanketBasis).toBe('no-consent-recorded')
    expect(decision.consent).toBeUndefined()
    expect(decision.withheld.every(w => w.basis === 'no-consent-recorded')).toBe(true)
  })

  it('does NOT gate the patient’s own copy — not even on a deny', () => {
    // A sharing consent governs disclosure to a third party. Withholding a
    // patient's own safety plan from them because they declined to have it
    // forwarded would invert what they asked for.
    const declined = buildSharingConsent({
      id: 'consent-deny-2',
      patientId: 'patient-005',
      dateTime: '2026-07-21T09:00:00Z',
      decision: 'deny',
      recipient: RECIPIENT,
    })
    for (const consents of [[], [declined]]) {
      const decision = applySharingConsent({
        contentCodes: CONTENT,
        recipient: '   ',
        consents,
        asOf: ASOF,
      })
      expect(decision.patientCopyOnly).toBe(true)
      expect(decision.included).toEqual(CONTENT)
      expect(decision.withheld).toEqual([])
    }
  })

  it('lands on the packet as paired item + basis extensions', () => {
    const decision = applySharingConsent({
      contentCodes: CONTENT,
      recipient: RECIPIENT,
      consents: [
        buildSharingConsent({
          id: 'consent-5',
          patientId: 'patient-005',
          dateTime: '2026-07-20T14:55:00Z',
          decision: 'permit',
          recipient: RECIPIENT,
          deniedContentCodes: ['recent-assessment'],
        }),
      ],
      asOf: ASOF,
    })
    const packet = buildDischargePacket({
      id: 'packet-gated',
      patientId: 'patient-005',
      date: ASOF,
      title: 'Suicide-safety discharge packet',
      contentCodes: decision.included,
      relatedReferences: ['CarePlan/plan-1'],
      withheldItems: decision.withheld,
      consentReference: `Consent/${decision.consent?.id}`,
    })

    expect(handoffContentCodes(packet)).toEqual(decision.included)
    expect(handoffWithheldItems(packet)).toEqual([
      { code: 'recent-assessment', basis: 'category-excluded' },
    ])

    // The governing consent joins context.related, so the omission is traceable
    // to the preference that caused it rather than reading as a missing section.
    const related = (packet.context as { related?: { reference?: string }[] }).related
    expect(related?.map(r => r.reference)).toEqual(['CarePlan/plan-1', 'Consent/consent-5'])

    const withheldExt = (packet.extension as { url?: string; extension?: unknown[] }[]).find(
      e => e.url === HANDOFF_WITHHELD_ITEM_EXT,
    )
    expect(withheldExt?.extension).toEqual([
      {
        url: 'item',
        valueCodeableConcept: {
          coding: [
            {
              system: HANDOFF_CONTENT_SYSTEM,
              code: 'recent-assessment',
              display: 'Most recent suicide-risk assessment',
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
              code: 'category-excluded',
              display: 'Category excluded by the patient',
            },
          ],
        },
      },
    ])
  })

  it('leaves an ungated packet exactly as it was', () => {
    // Regression guard for every packet recorded before the gate existed: no
    // withheld items, no consent reference, no empty context.
    const packet = buildDischargePacket({
      id: 'packet-plain',
      patientId: 'patient-005',
      date: ASOF,
      title: 'Suicide-safety discharge packet',
      contentCodes: ['safety-plan-copy'],
    })
    expect(handoffWithheldItems(packet)).toEqual([])
    expect(packet.context).toBeUndefined()
    expect(packet.extension).toHaveLength(1)
  })
})
