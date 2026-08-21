import { describe, it, expect } from 'vitest'
import {
  ENCOUNTER_PROFILE,
  attachAppointment,
  attachEpisode,
  buildEncounter,
  findOpenEncounter,
  isEncounterOpen,
  stampEncounter,
} from '@spier/core/lib/encounters'
import type { EncounterResource, EpisodeOfCareResource } from '@spier/core/types/fhir'

const enc = (over: Record<string, unknown> = {}): EncounterResource =>
  ({
    resourceType: 'Encounter',
    id: 'e1',
    status: 'in-progress',
    period: { start: '2026-08-11T09:00:00Z' },
    ...over,
  }) as EncounterResource

const episode = (id = 'ep1'): EpisodeOfCareResource =>
  ({ resourceType: 'EpisodeOfCare', id }) as EpisodeOfCareResource

describe('buildEncounter', () => {
  it('does NOT claim the SPiER profile — episodeOfCare is 1..* there, and no episode exists yet', () => {
    const e = buildEncounter({ patientId: 'patient-001', startIso: '2026-08-11T09:00:00Z' })
    expect((e as { meta?: unknown }).meta).toBeUndefined()
    expect((e as { status?: string }).status).toBe('in-progress')
    // class is 1..1 in base R4, so it has to be populated
    expect((e as { class?: { code?: string } }).class?.code).toBe('AMB')
    expect((e as { subject?: { reference?: string } }).subject?.reference).toBe('Patient/patient-001')
  })
})

describe('findOpenEncounter', () => {
  it('finds an open encounter from the same day', () => {
    expect(findOpenEncounter([enc()], '2026-08-11T17:00:00Z')?.id).toBe('e1')
  })

  it('ignores an open encounter from a previous day, so overnight work is not misfiled', () => {
    expect(findOpenEncounter([enc()], '2026-08-12T09:00:00Z')).toBeUndefined()
  })

  it('ignores a finished encounter from today', () => {
    expect(findOpenEncounter([enc({ status: 'finished' })], '2026-08-11T17:00:00Z')).toBeUndefined()
  })

  it('isEncounterOpen is status-based', () => {
    expect(isEncounterOpen(enc())).toBe(true)
    expect(isEncounterOpen(enc({ status: 'finished' }))).toBe(false)
  })
})

describe('attachEpisode', () => {
  it('adds the episode reference AND the profile claim together', () => {
    const out = attachEpisode(enc(), episode()) as EncounterResource & {
      episodeOfCare?: { reference?: string }[]
      meta?: { profile?: string[] }
    }
    expect(out.episodeOfCare).toEqual([{ reference: 'EpisodeOfCare/ep1' }])
    expect(out.meta?.profile).toEqual([ENCOUNTER_PROFILE])
  })

  it('is idempotent — a second positive screen in one contact adds nothing', () => {
    const once = attachEpisode(enc(), episode())
    const twice = attachEpisode(once, episode())
    expect(twice).toBe(once)
  })

  it('keeps an existing profile list rather than replacing it', () => {
    const out = attachEpisode(
      enc({ meta: { profile: ['http://example.org/other'] } }),
      episode(),
    ) as EncounterResource & { meta?: { profile?: string[] } }
    expect(out.meta?.profile).toEqual(['http://example.org/other', ENCOUNTER_PROFILE])
  })
})

describe('attachAppointment', () => {
  it('records the reverse link, since Appointment has no .encounter in R4', () => {
    const out = attachAppointment(enc(), 'appt-1') as EncounterResource & {
      appointment?: { reference?: string }[]
    }
    expect(out.appointment).toEqual([{ reference: 'Appointment/appt-1' }])
  })

  it('is idempotent', () => {
    const once = attachAppointment(enc(), 'appt-1')
    expect(attachAppointment(once, 'appt-1')).toBe(once)
  })
})

describe('stampEncounter', () => {
  it('sets .encounter on a type that has one', () => {
    const o = stampEncounter({ resourceType: 'Observation', id: 'o1' }, 'e1') as {
      encounter?: { reference?: string }
    }
    expect(o.encounter).toEqual({ reference: 'Encounter/e1' })
  })

  it('uses context.encounter for DocumentReference — the one R4 slot that also takes an episode', () => {
    const d = stampEncounter({ resourceType: 'DocumentReference', id: 'd1' }, 'e1') as {
      context?: { encounter?: unknown[] }
      encounter?: unknown
    }
    expect(d.context?.encounter).toEqual([{ reference: 'Encounter/e1' }])
    expect(d.encounter).toBeUndefined()
  })

  it('preserves other context fields on DocumentReference', () => {
    const d = stampEncounter(
      { resourceType: 'DocumentReference', id: 'd1', context: { period: { start: 'x' } } },
      'e1',
    ) as { context?: { period?: unknown; encounter?: unknown[] } }
    expect(d.context?.period).toEqual({ start: 'x' })
    expect(d.context?.encounter).toEqual([{ reference: 'Encounter/e1' }])
  })

  it.each([
    ['Appointment', 'linked in reverse via Encounter.appointment'],
    ['Consent', 'no .encounter in R4'],
    ['Encounter', 'is the hinge itself'],
    ['EpisodeOfCare', 'is what the Encounter points at'],
  ])('leaves %s untouched (%s)', (resourceType) => {
    const input = { resourceType, id: 'x' }
    expect(stampEncounter(input, 'e1')).toBe(input)
  })
})
