import { describe, it, expect } from 'vitest'
import {
  attendedWithinDays,
  buildCaringContact,
  buildOutreachAttempt,
  caringContactOptedOut,
  caringContacts,
  deriveAppointmentTracking,
  hasOptedOutOfCaringContacts,
  isOutreachAttempt,
  outreachAttempts,
  outreachOutcome,
  outreachPrompt,
  outreachSafetyConcern,
  unreachedStreak,
  CARING_CONTACT_OPT_OUT_EXT,
  CARING_CONTACT_PROFILE,
  OUTREACH_OUTCOME_EXT,
  OUTREACH_OUTCOME_SYSTEM,
  OUTREACH_PROMPT_EXT,
  SAFETY_CONCERN_EXT,
} from './followUp'
import { buildFollowUpAppointment } from './handoffs'
import { stageForArtifact } from './patientPathway'
import type { AppointmentResource, CommunicationResource } from '../types/fhir'

function attempt(params: {
  id: string
  sent: string
  outcome: string
  prompt?: string
  safetyConcern?: boolean
}): CommunicationResource {
  return buildOutreachAttempt({
    patientId: 'patient-005',
    channel: 'PHONE',
    ...params,
  })
}

describe('outreach attempt (TL-033 / TL-035)', () => {
  const reached = attempt({
    id: 'outreach-1',
    sent: '2026-07-27T16:30:00.000Z',
    outcome: 'patient-reached',
    prompt: 'scheduled-follow-up',
    safetyConcern: false,
  })

  it('is a Communication staged to Track Follow-Up', () => {
    expect(reached.resourceType).toBe('Communication')
    expect(reached.status).toBe('completed')
    expect(reached.subject).toEqual({ reference: 'Patient/patient-005' })
    expect(reached.sent).toBe('2026-07-27T16:30:00.000Z')
    expect(stageForArtifact(reached)).toBe('track-follow-up')
  })

  it('carries the outcome as an extension, because Communication has none', () => {
    // Communication.status only says a message was SENT. Whether anyone
    // answered has to ride as an extension, and the profile makes it 1..1.
    const exts = reached.extension as {
      url?: string
      valueCodeableConcept?: { coding?: { system?: string; code?: string }[] }
    }[]
    const outcomeExt = exts.find(e => e.url === OUTREACH_OUTCOME_EXT)
    expect(outcomeExt?.valueCodeableConcept?.coding?.[0]).toMatchObject({
      system: OUTREACH_OUTCOME_SYSTEM,
      code: 'patient-reached',
    })
    expect(outreachOutcome(reached)).toBe('patient-reached')
  })

  it('records the prompt, which is the only thing separating TL-033 from TL-035', () => {
    expect(outreachPrompt(reached)).toBe('scheduled-follow-up')
    const noShowFollowUp = attempt({
      id: 'outreach-2',
      sent: '2026-07-28T09:15:00.000Z',
      outcome: 'unable-to-reach',
      prompt: 'no-show',
    })
    expect(outreachPrompt(noShowFollowUp)).toBe('no-show')
    // Same artifact, same profile — only the category text and prompt differ.
    const category = noShowFollowUp.category as { text?: string }[]
    expect(category[0].text).toBe('No-show follow-up')
  })

  it('keeps "safety concern" as a separate axis from the outcome', () => {
    // A concern can surface on a reached call, and "unable to reach" can itself
    // BE the concern — so collapsing them into one code list would lose data.
    const concernOnReachedCall = attempt({
      id: 'outreach-3',
      sent: '2026-07-27T16:30:00.000Z',
      outcome: 'patient-reached',
      safetyConcern: true,
    })
    expect(outreachOutcome(concernOnReachedCall)).toBe('patient-reached')
    expect(outreachSafetyConcern(concernOnReachedCall)).toBe(true)
    expect(outreachSafetyConcern(reached)).toBe(false)
  })

  it('omits the prompt and concern extensions when not supplied', () => {
    const bare = attempt({ id: 'outreach-4', sent: '2026-07-27T16:30:00.000Z', outcome: 'no-answer' })
    const urls = (bare.extension as { url?: string }[]).map(e => e.url)
    expect(urls).toEqual([OUTREACH_OUTCOME_EXT])
    expect(urls).not.toContain(OUTREACH_PROMPT_EXT)
    expect(urls).not.toContain(SAFETY_CONCERN_EXT)
    expect(outreachSafetyConcern(bare)).toBe(false)
  })

  it('recognizes an outreach attempt by its outcome, not its profile URL', () => {
    // So an attempt written by another system still counts.
    expect(isOutreachAttempt(reached)).toBe(true)
    const caringContact: CommunicationResource = {
      resourceType: 'Communication',
      status: 'completed',
      sent: '2026-08-03T10:00:00Z',
    }
    // A caring contact asks nothing of the patient, so it has no outcome and is
    // deliberately NOT an outreach attempt.
    expect(isOutreachAttempt(caringContact)).toBe(false)
  })

  it('lists attempts newest first, ignoring non-outreach communications', () => {
    const plain: CommunicationResource = { resourceType: 'Communication', status: 'completed' }
    const listed = outreachAttempts([
      attempt({ id: 'a', sent: '2026-07-20T10:00:00.000Z', outcome: 'no-answer' }),
      plain,
      attempt({ id: 'b', sent: '2026-07-28T10:00:00.000Z', outcome: 'patient-reached' }),
    ])
    expect(listed.map(a => a.id)).toEqual(['b', 'a'])
  })
})

describe('caring contact (TL-010)', () => {
  const contact = buildCaringContact({
    id: 'caring-contact-1',
    patientId: 'patient-005',
    sent: '2026-08-03T10:00:00.000Z',
    channel: 'WRITTEN',
    message: 'Thinking of you. No reply needed.',
    optOut: false,
  })

  it('is a Communication on the caring-contact profile, staged to Track Follow-Up', () => {
    expect(contact.resourceType).toBe('Communication')
    expect(contact.status).toBe('completed')
    expect((contact.meta as { profile?: string[] }).profile).toEqual([CARING_CONTACT_PROFILE])
    expect(contact.sent).toBe('2026-08-03T10:00:00.000Z')
    expect(stageForArtifact(contact)).toBe('track-follow-up')
  })

  it('is NOT an outreach attempt — it has no outcome to record', () => {
    // The distinction the profile exists for: a caring contact asks nothing of
    // the patient, so "was anyone reached" is not a question it can answer.
    expect(isOutreachAttempt(contact)).toBe(false)
    expect(outreachOutcome(contact)).toBeUndefined()
  })

  it('carries the message as payload, not as a note', () => {
    expect(contact.payload).toEqual([{ contentString: 'Thinking of you. No reply needed.' }])
  })

  it('writes the medium display the publishing authority actually uses', () => {
    // v3-ParticipationMode publishes "written", not the picker's "Letter / card".
    const medium = contact.medium as { coding?: { code?: string; display?: string }[] }[]
    expect(medium[0].coding?.[0]).toEqual({
      system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
      code: 'WRITTEN',
      display: 'written',
    })
  })

  it('stamps the opt-out extension — the whole point of issue #211', () => {
    const optedOut = buildCaringContact({
      id: 'caring-contact-2',
      patientId: 'patient-005',
      sent: '2026-08-10T10:00:00.000Z',
      channel: 'WRITTEN',
      optOut: true,
    })
    expect(optedOut.extension).toEqual([
      { url: CARING_CONTACT_OPT_OUT_EXT, valueBoolean: true },
    ])
    expect(caringContactOptedOut(optedOut)).toBe(true)
  })

  it('records an explicit opt-IN rather than staying silent', () => {
    // `false` is a different claim from "nothing recorded", and it is the one
    // ExampleCaringContact makes.
    expect(contact.extension).toEqual([{ url: CARING_CONTACT_OPT_OUT_EXT, valueBoolean: false }])
    expect(caringContactOptedOut(contact)).toBe(false)
  })

  it('omits the extension entirely when opt-out was never asked', () => {
    const silent = buildCaringContact({
      id: 'caring-contact-3',
      patientId: 'p',
      sent: '2026-08-03T10:00:00.000Z',
      channel: 'PHONE',
    })
    expect(silent.extension).toBeUndefined()
    expect(caringContactOptedOut(silent)).toBe(false)
  })
})

describe('reading caring contacts off a chart', () => {
  const older = buildCaringContact({
    id: 'cc-1',
    patientId: 'p',
    sent: '2026-07-27T10:00:00.000Z',
    channel: 'WRITTEN',
    optOut: false,
  })
  const newer = buildCaringContact({
    id: 'cc-2',
    patientId: 'p',
    sent: '2026-08-03T10:00:00.000Z',
    channel: 'WRITTEN',
    optOut: true,
  })
  const anAttempt = attempt({ id: 'o-1', sent: '2026-08-01T10:00:00.000Z', outcome: 'no-answer' })

  it('separates caring contacts from outreach attempts, newest first', () => {
    expect(caringContacts([older, anAttempt, newer]).map(c => c.id)).toEqual(['cc-2', 'cc-1'])
  })

  it('reports the series as stopped once any contact records an opt-out', () => {
    expect(hasOptedOutOfCaringContacts([older, anAttempt])).toBe(false)
    expect(hasOptedOutOfCaringContacts([older, anAttempt, newer])).toBe(true)
  })
})

describe('unreachedStreak — the failed-contact-sequence trigger', () => {
  it('counts consecutive most-recent failures', () => {
    const streak = unreachedStreak([
      attempt({ id: 'a', sent: '2026-07-26T10:00:00.000Z', outcome: 'no-answer' }),
      attempt({ id: 'b', sent: '2026-07-27T10:00:00.000Z', outcome: 'message-left' }),
      attempt({ id: 'c', sent: '2026-07-28T10:00:00.000Z', outcome: 'unable-to-reach' }),
    ])
    expect(streak).toBe(3)
  })

  it('resets when the most recent attempt reached the patient', () => {
    const streak = unreachedStreak([
      attempt({ id: 'a', sent: '2026-07-26T10:00:00.000Z', outcome: 'no-answer' }),
      attempt({ id: 'b', sent: '2026-07-28T10:00:00.000Z', outcome: 'patient-reached' }),
    ])
    expect(streak).toBe(0)
  })

  it('stops counting at the first success working backwards', () => {
    const streak = unreachedStreak([
      attempt({ id: 'old', sent: '2026-07-20T10:00:00.000Z', outcome: 'no-answer' }),
      attempt({ id: 'mid', sent: '2026-07-24T10:00:00.000Z', outcome: 'patient-reached' }),
      attempt({ id: 'new', sent: '2026-07-28T10:00:00.000Z', outcome: 'no-answer' }),
    ])
    expect(streak).toBe(1)
  })

  it('treats reaching a support person as contact, not a failure', () => {
    expect(
      unreachedStreak([
        attempt({ id: 'a', sent: '2026-07-28T10:00:00.000Z', outcome: 'reached-support-person' }),
      ]),
    ).toBe(0)
  })

  it('is zero with no attempts at all', () => {
    expect(unreachedStreak([])).toBe(0)
  })
})

describe('appointment tracking (TL-034) — a read, never a stored copy', () => {
  const now = new Date('2026-07-28T12:00:00.000Z')

  const booked = (id: string, start: string, status = 'booked'): AppointmentResource =>
    buildFollowUpAppointment({ id, patientId: 'patient-005', status, start })

  it('picks the soonest upcoming appointment as next', () => {
    const tracking = deriveAppointmentTracking(
      [
        booked('far', '2026-09-01T14:00:00.000Z'),
        booked('soon', '2026-08-04T14:00:00.000Z'),
        booked('past', '2026-07-01T14:00:00.000Z', 'fulfilled'),
      ],
      now,
    )
    expect(tracking.next?.id).toBe('soon')
    expect(tracking.mostRecentPast?.id).toBe('past')
  })

  it('does not treat a cancelled future slot as the next visit', () => {
    const tracking = deriveAppointmentTracking(
      [booked('cancelled', '2026-08-04T14:00:00.000Z', 'cancelled')],
      now,
    )
    expect(tracking.next).toBeUndefined()
    expect(tracking.cancelledCount).toBe(1)
  })

  it('counts attended, no-show and cancelled from Appointment.status alone', () => {
    const tracking = deriveAppointmentTracking(
      [
        booked('a', '2026-07-01T14:00:00.000Z', 'fulfilled'),
        booked('b', '2026-07-08T14:00:00.000Z', 'noshow'),
        booked('c', '2026-07-15T14:00:00.000Z', 'cancelled'),
        booked('d', '2026-07-22T14:00:00.000Z', 'fulfilled'),
      ],
      now,
    )
    expect(tracking.attendedCount).toBe(2)
    expect(tracking.noShowCount).toBe(1)
    expect(tracking.cancelledCount).toBe(1)
  })

  it('flags the TL-035 trigger only when the LATEST visit was a no-show', () => {
    const noShowLast = deriveAppointmentTracking(
      [
        booked('older', '2026-07-01T14:00:00.000Z', 'fulfilled'),
        booked('latest', '2026-07-22T14:00:00.000Z', 'noshow'),
      ],
      now,
    )
    expect(noShowLast.awaitingNoShowFollowUp).toBe(true)

    // An old no-show that has since been followed by an attended visit is not
    // outstanding work.
    const recovered = deriveAppointmentTracking(
      [
        booked('older', '2026-07-01T14:00:00.000Z', 'noshow'),
        booked('latest', '2026-07-22T14:00:00.000Z', 'fulfilled'),
      ],
      now,
    )
    expect(recovered.awaitingNoShowFollowUp).toBe(false)
  })

  it('still flags a no-show marked on a future-dated slot', () => {
    // Staff can resolve a no-show before the slot has passed, and a booking
    // dated tomorrow must not hide the re-engagement work.
    const tracking = deriveAppointmentTracking(
      [booked('future', '2026-08-05T14:00:00.000Z', 'noshow')],
      now,
    )
    expect(tracking.awaitingNoShowFollowUp).toBe(true)
    expect(tracking.mostRecentPast).toBeUndefined()
    // A no-show is not an upcoming visit, whatever its date.
    expect(tracking.next).toBeUndefined()
  })

  it('clears the flag once a replacement visit is booked', () => {
    // "Follow-up rescheduled" is a new Appointment, per the design — so the
    // reschedule clears the flag with no extra state to track.
    const tracking = deriveAppointmentTracking(
      [
        booked('missed', '2026-07-22T14:00:00.000Z', 'noshow'),
        booked('rebooked', '2026-08-05T14:00:00.000Z'),
      ],
      now,
    )
    expect(tracking.awaitingNoShowFollowUp).toBe(false)
    expect(tracking.next?.id).toBe('rebooked')
  })

  it('ignores appointments with an unparseable start', () => {
    const tracking = deriveAppointmentTracking(
      [{ resourceType: 'Appointment', id: 'undated', status: 'booked' }],
      now,
    )
    expect(tracking.next).toBeUndefined()
    expect(tracking.mostRecentPast).toBeUndefined()
  })

  it('is empty for a patient with no appointments', () => {
    const tracking = deriveAppointmentTracking([], now)
    expect(tracking).toMatchObject({
      next: undefined,
      attendedCount: 0,
      noShowCount: 0,
      awaitingNoShowFollowUp: false,
    })
  })
})

describe('attendedWithinDays — the shape of the Stage-8 measures', () => {
  const discharge = '2026-07-01T00:00:00.000Z'

  it('is true for a kept visit inside the window', () => {
    const appts = [
      buildFollowUpAppointment({
        id: 'a',
        patientId: 'p',
        status: 'fulfilled',
        start: '2026-07-05T14:00:00.000Z',
      }),
    ]
    expect(attendedWithinDays(appts, discharge, 7)).toBe(true)
  })

  it('is false when the kept visit falls outside the window', () => {
    const appts = [
      buildFollowUpAppointment({
        id: 'a',
        patientId: 'p',
        status: 'fulfilled',
        start: '2026-07-20T14:00:00.000Z',
      }),
    ]
    expect(attendedWithinDays(appts, discharge, 7)).toBe(false)
    expect(attendedWithinDays(appts, discharge, 30)).toBe(true)
  })

  it('requires the visit to have been KEPT, not merely booked', () => {
    const appts = [
      buildFollowUpAppointment({
        id: 'a',
        patientId: 'p',
        status: 'booked',
        start: '2026-07-05T14:00:00.000Z',
      }),
    ]
    expect(attendedWithinDays(appts, discharge, 7)).toBe(false)
  })

  it('is false for an unparseable reference date', () => {
    expect(attendedWithinDays([], 'not-a-date', 7)).toBe(false)
  })
})
