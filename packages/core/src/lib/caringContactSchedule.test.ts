import { describe, expect, it } from 'vitest'
import type { CommunicationResource, DocumentReferenceResource } from '../types/fhir'
import {
  CARING_CONTACT_SCHEDULE,
  caringContactCadenceLabel,
  caringContactDue,
  caringContactState,
  caringContactStatusLabel,
} from './caringContactSchedule'
import { CARING_CONTACT_OPT_OUT_EXT, CARING_CONTACT_PROFILE } from './followUp'
import { PACKET_PROFILE, SAFETY_HANDOFF_PROFILE } from './handoffs'

const T = Date.parse('2026-08-01T12:00:00Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (ms: number) => new Date(T + ms)

const handoff = (offset = 0): CommunicationResource =>
  ({
    resourceType: 'Communication',
    status: 'completed',
    meta: { profile: [SAFETY_HANDOFF_PROFILE] },
    sent: new Date(T + offset).toISOString(),
  }) as CommunicationResource

const packet = (offset = 0): DocumentReferenceResource =>
  ({
    resourceType: 'DocumentReference',
    status: 'current',
    meta: { profile: [PACKET_PROFILE] },
    date: new Date(T + offset).toISOString(),
  }) as DocumentReferenceResource

const contact = (offset: number, optOut = false): CommunicationResource =>
  ({
    resourceType: 'Communication',
    status: 'completed',
    meta: { profile: [CARING_CONTACT_PROFILE] },
    sent: new Date(T + offset).toISOString(),
    ...(optOut ? { extension: [{ url: CARING_CONTACT_OPT_OUT_EXT, valueBoolean: true }] } : {}),
  }) as CommunicationResource

describe('the published caring-contact schedule, read as data', () => {
  it('reads three windows closing at 48 hours, 7 days and 30 days', () => {
    // ⚠️ A reader whose glob stops matching returns no slots, and every patient
    // then reads as "no transition" — indistinguishable from an empty chart. So
    // the read itself is asserted before anything below relies on it.
    expect(CARING_CONTACT_SCHEDULE.slots.map(s => [s.ordinal, s.fromHours, s.byHours])).toEqual([
      [1, 24, 48],
      [2, 7 * 24, 7 * 24],
      [3, 30 * 24, 30 * 24],
    ])
  })

  it('reads what marks a care transition off the schedule, not off this module', () => {
    expect([...CARING_CONTACT_SCHEDULE.transitionProfiles].sort()).toEqual(
      [PACKET_PROFILE, SAFETY_HANDOFF_PROFILE].sort(),
    )
  })

  it('says the cadence the way the catalogue used to type it', () => {
    expect(caringContactCadenceLabel()).toBe('24–48 hours, 7 days and 30 days after a care transition')
  })
})

describe('caringContactState', () => {
  it('starts no series without a care transition', () => {
    expect(caringContactState({ communications: [contact(DAY)] }, at(2 * DAY))).toEqual({ kind: 'no-transition' })
  })

  it('makes the first contact due straight after a transition, from either record', () => {
    for (const record of [{ communications: [handoff()] }, { documentReferences: [packet()] }]) {
      const state = caringContactState(record, at(2 * HOUR))
      expect(state).toMatchObject({ kind: 'scheduled', next: { ordinal: 1 }, sent: 0, missed: 0 })
      expect(caringContactDue(state)).toBe(true)
    }
  })

  it('moves on to the second once the first is sent, and asks for nothing until it is near', () => {
    const state = caringContactState({ communications: [handoff(), contact(30 * HOUR)] }, at(3 * DAY))
    expect(state).toMatchObject({ kind: 'scheduled', next: { ordinal: 2 }, sent: 1, missed: 0, daysUntilDue: 4 })
    expect(caringContactDue(state)).toBe(false)
    expect(caringContactDue(caringContactState({ communications: [handoff(), contact(30 * HOUR)] }, at(6 * DAY)))).toBe(
      true,
    )
  })

  it('counts a window that closed unsent as missed and makes the NEXT contact the one due', () => {
    // The decided rule: a spaced series does not chase a missed contact.
    const state = caringContactState({ communications: [handoff()] }, at(5 * DAY))
    expect(state).toMatchObject({ kind: 'scheduled', next: { ordinal: 2 }, sent: 0, missed: 1 })
    expect(caringContactStatusLabel(state)).toBe('Second caring contact due in 2 days · 1 missed')
  })

  it('lets a late first contact satisfy the window it falls in, not the one it was late for', () => {
    // Sent on day 7: inside the second window, so the first stays missed.
    const state = caringContactState({ communications: [handoff(), contact(7 * DAY)] }, at(10 * DAY))
    expect(state).toMatchObject({ kind: 'scheduled', next: { ordinal: 3 }, sent: 1, missed: 1 })
  })

  it('closes each window inclusively, as the measure’s interval does', () => {
    const state = caringContactState(
      { communications: [handoff(), contact(48 * HOUR), contact(7 * DAY), contact(30 * DAY)] },
      at(31 * DAY),
    )
    expect(state).toMatchObject({ kind: 'complete', sent: 3, missed: 0, total: 3 })
  })

  it('stops the series on an opt-out, as the measure excludes one', () => {
    const state = caringContactState({ communications: [handoff(), contact(DAY, true)] }, at(3 * DAY))
    expect(state.kind).toBe('opted-out')
    expect(caringContactDue(state)).toBe(false)
  })

  it('counts from the most recent transition, ignoring contacts sent for an earlier one', () => {
    const state = caringContactState(
      { communications: [handoff(-40 * DAY), contact(-39 * DAY), handoff()] },
      at(HOUR),
    )
    expect(state).toMatchObject({ kind: 'scheduled', next: { ordinal: 1 }, sent: 0 })
  })

  it('is complete once the last window closes, with the misses counted', () => {
    expect(caringContactState({ communications: [handoff()] }, at(31 * DAY))).toMatchObject({
      kind: 'complete',
      sent: 0,
      missed: 3,
    })
  })
})
