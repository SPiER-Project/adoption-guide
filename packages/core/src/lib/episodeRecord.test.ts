import { describe, it, expect } from 'vitest'
import { groupByEpisode } from '@spier/core/lib/episodeRecord'
import { TRIGGER_EXT } from '@spier/core/lib/riskEpisode'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'

const episode = (id: string, triggerRef?: string): FhirResourceLike =>
  ({
    resourceType: 'EpisodeOfCare',
    id,
    ...(triggerRef
      ? { extension: [{ url: TRIGGER_EXT, valueReference: { reference: triggerRef } }] }
      : {}),
  }) as FhirResourceLike

const encounter = (
  id: string,
  episodeIds: string[],
  extra: Record<string, unknown> = {},
): FhirResourceLike =>
  ({
    resourceType: 'Encounter',
    id,
    episodeOfCare: episodeIds.map(e => ({ reference: `EpisodeOfCare/${e}` })),
    period: { start: '2026-08-11T09:00:00Z' },
    ...extra,
  }) as FhirResourceLike

const at = (resourceType: string, id: string, encounterId?: string): FhirResourceLike =>
  ({
    resourceType,
    id,
    ...(encounterId ? { encounter: { reference: `Encounter/${encounterId}` } } : {}),
  }) as FhirResourceLike

describe('groupByEpisode', () => {
  it('reaches artifacts through the Encounter hinge', () => {
    const { records } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [encounter('e1', ['ep1'])],
      observations: [at('Observation', 'o1', 'e1')],
      carePlans: [at('CarePlan', 'cp1', 'e1')],
    })
    expect(records).toHaveLength(1)
    expect(records[0].encounters.map(e => e.id)).toEqual(['e1'])
    expect(records[0].artifacts.map(a => a.id).sort()).toEqual(['cp1', 'o1'])
  })

  it('unwraps QuestionnaireResponses out of their StoredResponse wrapper', () => {
    const { records } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [encounter('e1', ['ep1'])],
      responses: [
        { id: 'qr1', questionnaireName: 'ASQ', resource: at('QuestionnaireResponse', 'qr1', 'e1') },
      ],
    })
    expect(records[0].artifacts.map(a => a.resourceType)).toEqual(['QuestionnaireResponse'])
  })

  it('reads DocumentReference from context.encounter, not .encounter', () => {
    const doc = {
      resourceType: 'DocumentReference',
      id: 'd1',
      context: { encounter: [{ reference: 'Encounter/e1' }] },
    } as FhirResourceLike
    const { records, unassigned } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [encounter('e1', ['ep1'])],
      documentReferences: [doc],
    })
    expect(records[0].artifacts.map(a => a.id)).toEqual(['d1'])
    expect(unassigned).toEqual([])
  })

  it('reaches an Appointment in reverse, through Encounter.appointment', () => {
    const { records } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [
        encounter('e1', ['ep1'], { appointment: [{ reference: 'Appointment/appt1' }] }),
      ],
      appointments: [at('Appointment', 'appt1')], // no .encounter — R4 has none
    })
    expect(records[0].artifacts.map(a => a.id)).toEqual(['appt1'])
  })

  it('includes the trigger even though it predates the episode', () => {
    // Decision 1: the screen cannot reference an episode that did not exist yet,
    // so the episode points back at it. It still belongs to the record.
    const screen = at('Observation', 'screen1') // deliberately no encounter
    const { records } = groupByEpisode({
      episodes: [episode('ep1', 'Observation/screen1')],
      encounters: [encounter('e1', ['ep1'])],
      observations: [screen],
    })
    expect(records[0].trigger?.id).toBe('screen1')
    expect(records[0].artifacts.map(a => a.id)).toContain('screen1')
  })

  it('classifies a booked appointment as not-yet-occurred, not as a lost link', () => {
    // There is no Encounter because the visit has not happened. Keyed on status
    // rather than comparing to a clock, so the result is deterministic.
    const { unassigned } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [encounter('e1', ['ep1'])],
      appointments: [{ resourceType: 'Appointment', id: 'future', status: 'booked' } as FhirResourceLike],
    })
    expect(unassigned).toEqual([
      { resource: expect.objectContaining({ id: 'future' }), reason: 'not-yet-occurred' },
    ])
  })

  it('still flags a HELD appointment with no Encounter as a lost link', () => {
    const { unassigned } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [encounter('e1', ['ep1'])],
      appointments: [{ resourceType: 'Appointment', id: 'held', status: 'fulfilled' } as FhirResourceLike],
    })
    expect(unassigned[0].reason).toBe('no-encounter')
  })

  it('separates the two reasons an artifact has no episode', () => {
    const { unassigned } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [encounter('e1', ['ep1'])],
      observations: [at('Observation', 'orphan')], // linked to nothing
      consents: [at('Consent', 'c1')], // no R4 route at all
    })
    expect(unassigned).toEqual([
      { resource: expect.objectContaining({ id: 'orphan' }), reason: 'no-encounter' },
      { resource: expect.objectContaining({ id: 'c1' }), reason: 'no-r4-route' },
    ])
  })

  it('does not leak artifacts between two episodes for the same patient', () => {
    // The case #263 opens with: two episodes six months apart, previously
    // indistinguishable to any consumer.
    const { records } = groupByEpisode({
      episodes: [episode('ep1'), episode('ep2')],
      encounters: [encounter('e1', ['ep1']), encounter('e2', ['ep2'])],
      observations: [at('Observation', 'first', 'e1'), at('Observation', 'second', 'e2')],
    })
    expect(records[0].artifacts.map(a => a.id)).toEqual(['first'])
    expect(records[1].artifacts.map(a => a.id)).toEqual(['second'])
  })

  it('orders an episode\'s encounters by period start', () => {
    const { records } = groupByEpisode({
      episodes: [episode('ep1')],
      encounters: [
        { ...(encounter('late', ['ep1']) as object), period: { start: '2026-08-12T09:00:00Z' } } as FhirResourceLike,
        { ...(encounter('early', ['ep1']) as object), period: { start: '2026-08-10T09:00:00Z' } } as FhirResourceLike,
      ],
    })
    expect(records[0].encounters.map(e => e.id)).toEqual(['early', 'late'])
  })

  it('returns no records when the patient has no episode', () => {
    const { records, unassigned } = groupByEpisode({
      observations: [at('Observation', 'o1')],
    })
    expect(records).toEqual([])
    expect(unassigned).toHaveLength(1)
  })
})

describe('the shipped scenarios actually group', () => {
  it('every episode-bearing scenario yields a record with artifacts', () => {
    const empty: string[] = []
    for (const [patientId, scenario] of Object.entries(POPULATION_SCENARIOS)) {
      if (!(scenario.episodes ?? []).length) continue
      const { records } = groupByEpisode(scenario as never)
      for (const record of records) {
        if (record.artifacts.length === 0) empty.push(`${patientId}:${record.episode.id}`)
      }
    }
    expect(empty).toEqual([])
  })

  it('leaves only Consent unroutable across all scenarios', () => {
    const byReason = new Map<string, Set<string>>()
    for (const scenario of Object.values(POPULATION_SCENARIOS)) {
      if (!(scenario.episodes ?? []).length) continue
      for (const { resource, reason } of groupByEpisode(scenario as never).unassigned) {
        const set = byReason.get(reason) ?? new Set<string>()
        set.add(String(resource.resourceType))
        byReason.set(reason, set)
      }
    }
    // Consent is the one type R4 gives no route; anything else showing up here
    // means an artifact lost its link.
    expect([...(byReason.get('no-r4-route') ?? [])]).toEqual(['Consent'])
    // A booked future appointment is correctly unlinked — patient-009 has one.
    expect([...(byReason.get('not-yet-occurred') ?? [])].sort()).toEqual(['Appointment'])
    // This is the one that must stay empty: it means an artifact LOST its link.
    expect([...(byReason.get('no-encounter') ?? [])].sort()).toEqual([])
  })
})
