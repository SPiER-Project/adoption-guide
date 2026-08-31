import { describe, it, expect } from 'vitest'
import {
  CLOSURE_REASON_EXT,
  CURRENT_TIER_EXT,
  TRIGGER_EXT,
  buildEpisode,
  buildFlag,
  buildSafetyTask,
  canClaimPositiveScreen,
  clearFlag,
  closeEpisode,
  completeTask,
  episodeCurrentTier,
  findOpenEpisode,
  isEpisodeOpen,
  isPositiveScreen,
  isTaskOpen,
  isTaskOverdue,
  pickEpisodeTrigger,
  taskDueDate,
  tasksForEpisode,
} from '@spier/core/lib/riskEpisode'
import type { EpisodeOfCareResource, ObservationResource, TaskResource } from '@spier/core/types/fhir'

const openEpisode = () =>
  buildEpisode({
    id: 'episode-1',
    patientId: 'p1',
    entryReason: 'positive-screen',
    currentTier: 'moderate',
    startDate: '2026-07-02',
  })

const task = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    ...buildSafetyTask({
      id: 'task-1',
      patientId: 'p1',
      episodeId: 'episode-1',
      taskType: 'reassessment-due',
      dueDate: '2026-07-16T23:59:59Z',
      authoredOn: '2026-07-02T09:00:00Z',
    }),
    ...over,
  }) as TaskResource

describe('episode lifecycle', () => {
  it('builds an open, stage-tagged, profiled episode with entry reason and tier', () => {
    const e = openEpisode() as EpisodeOfCareResource & { meta?: { profile?: string[]; tag?: { code?: string }[] } }
    expect(isEpisodeOpen(e)).toBe(true)
    expect(e.meta?.profile?.[0]).toContain('spier-suicide-risk-episode')
    expect(e.meta?.tag?.[0]?.code).toBe('track-risk-over-time')
    expect(episodeCurrentTier(e)).toBe('moderate')
    // EpisodeOfCare uses `patient`, not `subject`
    expect((e as { patient?: { reference?: string } }).patient?.reference).toBe('Patient/p1')
  })

  it('closing keeps the same id so the store upserts rather than duplicating', () => {
    const open = openEpisode()
    const closed = closeEpisode(open, { closureReason: 'risk-resolved', endDate: '2026-09-30' })
    expect(closed.id).toBe(open.id)
    expect(isEpisodeOpen(closed)).toBe(false)
    expect((closed as { period?: { end?: string } }).period?.end).toBe('2026-09-30')
  })

  it('closing records a closure reason and a status history trail', () => {
    const closed = closeEpisode(openEpisode(), { closureReason: 'risk-resolved', endDate: '2026-09-30' })
    const exts = (closed as { extension?: { url?: string; valueCodeableConcept?: { coding?: { code?: string }[] } }[] }).extension
    const closure = exts?.find(x => x.url === CLOSURE_REASON_EXT)
    expect(closure?.valueCodeableConcept?.coding?.[0]?.code).toBe('risk-resolved')
    // the entry reason and tier survive the close
    expect(exts?.some(x => x.url === CURRENT_TIER_EXT)).toBe(true)
    const history = (closed as { statusHistory?: { status?: string }[] }).statusHistory
    expect(history?.map(h => h.status)).toEqual(['active', 'finished'])
  })

  it('closing twice does not stack duplicate closure reasons', () => {
    const once = closeEpisode(openEpisode(), { closureReason: 'risk-resolved', endDate: '2026-09-30' })
    const twice = closeEpisode(once, { closureReason: 'transferred', endDate: '2026-10-01' })
    const exts = (twice as { extension?: { url?: string }[] }).extension ?? []
    expect(exts.filter(x => x.url === CLOSURE_REASON_EXT)).toHaveLength(1)
  })

  it('findOpenEpisode ignores closed episodes — a patient may have several over time', () => {
    const closed = closeEpisode(openEpisode(), { closureReason: 'risk-resolved', endDate: '2026-09-30' })
    const second = buildEpisode({ id: 'episode-2', patientId: 'p1', entryReason: 'referral', startDate: '2026-11-01' })
    expect(findOpenEpisode([closed])).toBeUndefined()
    expect(findOpenEpisode([closed, second])?.id).toBe('episode-2')
  })
})

describe('flag lifecycle', () => {
  it('raises an active safety flag with no clinical detail beyond the episode', () => {
    const f = buildFlag({ id: 'flag-1', patientId: 'p1', startDate: '2026-07-02' })
    expect((f as { status?: string }).status).toBe('active')
    const cat = (f as { category?: { coding?: { code?: string }[] }[] }).category
    expect(cat?.[0]?.coding?.[0]?.code).toBe('safety')
    // no risk tier leaks onto the banner
    expect(JSON.stringify(f)).not.toContain('moderate')
  })

  it('clearing keeps the id and sets inactive with an end date', () => {
    const raised = buildFlag({ id: 'flag-1', patientId: 'p1', startDate: '2026-07-02' })
    const cleared = clearFlag(raised, '2026-09-30')
    expect(cleared.id).toBe('flag-1')
    expect((cleared as { status?: string }).status).toBe('inactive')
    expect((cleared as { period?: { end?: string } }).period?.end).toBe('2026-09-30')
  })
})

describe('safety tasks', () => {
  it('builds a task linked to its episode, with Task.for (not subject) and a due date', () => {
    const t = task()
    expect((t as { for?: { reference?: string } }).for?.reference).toBe('Patient/p1')
    expect((t as { basedOn?: { reference?: string }[] }).basedOn?.[0]?.reference).toBe('EpisodeOfCare/episode-1')
    expect(taskDueDate(t)).toBe('2026-07-16T23:59:59Z')
  })

  it('carries repeating escalation triggers when escalating', () => {
    const t = buildSafetyTask({
      id: 'task-esc',
      patientId: 'p1',
      episodeId: 'episode-1',
      taskType: 'escalation',
      escalationTriggers: ['missed-reassessment', 'unable-to-reach'],
      authoredOn: '2026-07-17T08:00:00Z',
    })
    const exts = (t as { extension?: { valueCodeableConcept?: { coding?: { code?: string }[] } }[] }).extension
    expect(exts?.map(e => e.valueCodeableConcept?.coding?.[0]?.code)).toEqual([
      'missed-reassessment',
      'unable-to-reach',
    ])
  })

  it('overdue is computed from the due date', () => {
    const t = task()
    expect(isTaskOverdue(t, new Date('2026-07-10T00:00:00Z'))).toBe(false)
    expect(isTaskOverdue(t, new Date('2026-07-20T00:00:00Z'))).toBe(true)
  })

  it('a completed task is never overdue, however far past due', () => {
    const done = completeTask(task())
    expect(isTaskOpen(done)).toBe(false)
    expect(isTaskOverdue(done, new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })

  it('an undated task is never overdue', () => {
    const undated = buildSafetyTask({
      id: 'task-2',
      patientId: 'p1',
      taskType: 'safety-plan-needed',
      authoredOn: '2026-07-02T09:00:00Z',
    })
    expect(taskDueDate(undated)).toBeUndefined()
    expect(isTaskOverdue(undated, new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })

  it('completing keeps the id so the store upserts in place', () => {
    expect(completeTask(task()).id).toBe('task-1')
  })

  it('tasksForEpisode filters by episode and sorts soonest-due first, undated last', () => {
    const soon = task({ id: 'a', restriction: { period: { end: '2026-07-05T00:00:00Z' } } })
    const later = task({ id: 'b', restriction: { period: { end: '2026-08-05T00:00:00Z' } } })
    const undated = task({ id: 'c', restriction: undefined })
    const otherEpisode = task({ id: 'd', basedOn: [{ reference: 'EpisodeOfCare/other' }] })
    const got = tasksForEpisode([later, undated, soon, otherEpisode], 'episode-1')
    expect(got.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('tasksForEpisode returns nothing when there is no open episode', () => {
    expect(tasksForEpisode([task()], undefined)).toEqual([])
  })
})

// ─── #263 Decision 1: episode opens on a positive screen ─────

describe('isPositiveScreen', () => {
  it('treats any identified risk as positive, matching the CDS card threshold', () => {
    expect(isPositiveScreen('low')).toBe(true)
    expect(isPositiveScreen('moderate')).toBe(true)
    expect(isPositiveScreen('high')).toBe(true)
    expect(isPositiveScreen('acute')).toBe(true)
  })

  it('does not open an episode when the screen found nothing', () => {
    expect(isPositiveScreen('none')).toBe(false)
  })
})

describe('pickEpisodeTrigger', () => {
  const obs = (id: string, code?: string) =>
    ({
      resourceType: 'Observation',
      id,
      ...(code ? { code: { coding: [{ system: 'http://loinc.org', code }] } } : {}),
    }) as ObservationResource

  it('prefers the harmonized risk-concept Observation over an instrument-specific one', () => {
    const picked = pickEpisodeTrigger([obs('item9', '44260-8'), obs('concept', '93374-7')], 'qr1')
    expect(picked).toBe('Observation/concept')
  })

  it('falls back to the first Observation when no concept-layer result exists', () => {
    expect(pickEpisodeTrigger([obs('item9', '44260-8')], 'qr1')).toBe('Observation/item9')
  })

  it('falls back to the QuestionnaireResponse, which the extension also accepts', () => {
    expect(pickEpisodeTrigger([], 'qr1')).toBe('QuestionnaireResponse/qr1')
  })

  it('returns undefined when there is nothing to evidence the screen with', () => {
    expect(pickEpisodeTrigger([], undefined)).toBeUndefined()
  })
})

describe('buildEpisode trigger extension', () => {
  it('emits episode-trigger when given a reference, satisfying the profile invariant', () => {
    const ep = buildEpisode({
      id: 'ep1',
      patientId: 'patient-001',
      entryReason: 'positive-screen',
      startDate: '2026-08-11',
      triggerRef: 'Observation/o1',
    }) as { extension?: { url: string; valueReference?: { reference?: string } }[] }
    const trigger = ep.extension?.find(e => e.url === TRIGGER_EXT)
    expect(trigger?.valueReference?.reference).toBe('Observation/o1')
  })

  it('omits it when no trigger is given — several entry reasons have no structured artifact', () => {
    const ep = buildEpisode({
      id: 'ep1',
      patientId: 'patient-001',
      entryReason: 'manual-add',
      startDate: '2026-08-11',
    }) as { extension?: { url: string }[] }
    expect(ep.extension?.some(e => e.url === TRIGGER_EXT)).toBe(false)
  })

  it('canClaimPositiveScreen gates the manual recorder', () => {
    expect(canClaimPositiveScreen('Observation/o1')).toBe(true)
    expect(canClaimPositiveScreen('')).toBe(false)
    expect(canClaimPositiveScreen(undefined)).toBe(false)
  })
})
