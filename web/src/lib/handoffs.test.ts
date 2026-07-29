import { describe, it, expect } from 'vitest'
import {
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
  handoffContentCodes,
  isReferralOpen,
  referralPerformer,
  setAppointmentStatus,
  setReferralStatus,
  CONSENT_CATEGORY_SYSTEM,
  HANDOFF_CONTENT_ITEM_EXT,
  REFERRAL_REASON_SYSTEM,
} from './handoffs'
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

  it('omits end when no duration was given', () => {
    const open = buildFollowUpAppointment({
      id: 'appointment-2',
      patientId: 'patient-005',
      status: 'booked',
      start: '2026-08-04T18:00:00.000Z',
    })
    expect(open.end).toBeUndefined()
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
})
