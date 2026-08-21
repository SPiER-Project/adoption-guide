import { describe, it, expect } from 'vitest'
import { executeWritePlan } from '@spier/core/lib/writeback/execute'
import { buildWritePlan } from '@spier/core/lib/writeback/ladder'
import type { WritebackArtifacts, WritebackTarget, WriteStepResult } from '@spier/core/lib/writeback/types'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'

const ALL = {
  QuestionnaireResponse: { create: true },
  Observation: { create: true },
  Condition: { create: true },
  DocumentReference: { create: true },
}

const qr: QuestionnaireResponseResource = {
  resourceType: 'QuestionnaireResponse',
  id: 'client-qr',
  questionnaire: 'http://spier.org/Questionnaire/PHQ-9',
  status: 'completed',
}

/** Two Observations whose derivedFrom points at the CLIENT qr id. */
const observations: ObservationResource[] = [
  { resourceType: 'Observation', id: 'o1', status: 'final', derivedFrom: [{ reference: 'QuestionnaireResponse/client-qr' }] } as ObservationResource,
  { resourceType: 'Observation', id: 'o2', status: 'final', derivedFrom: [{ reference: 'QuestionnaireResponse/client-qr' }] } as ObservationResource,
]

const condition: FhirResource = {
  resourceType: 'Condition',
  evidence: [{ detail: [{ reference: 'QuestionnaireResponse/client-qr' }] }],
}

const documentReference: FhirResource = { resourceType: 'DocumentReference' }

function artifacts(overrides: Partial<WritebackArtifacts> = {}): WritebackArtifacts {
  return { qr, observations, documentReference, condition, ...overrides }
}

/** Fake target: records created resources, assigns predictable server ids. */
function fakeTarget(failOn?: (r: FhirResource) => boolean): WritebackTarget & { created: FhirResource[] } {
  const created: FhirResource[] = []
  const counts: Record<string, number> = {}
  return {
    created,
    async createResource(resource: FhirResource) {
      if (failOn?.(resource)) throw new Error(`HTTP 422 ${resource.resourceType} rejected`)
      created.push(resource)
      counts[resource.resourceType] = (counts[resource.resourceType] ?? 0) + 1
      return { id: `srv-${resource.resourceType}-${counts[resource.resourceType]}` }
    },
  }
}

const byTier = (steps: WriteStepResult[], tier: number) => steps.find(s => s.tier === tier)!

describe('executeWritePlan — happy path (full capability)', () => {
  it('writes QR first, remaps Observation derivedFrom to the server QR id, skips the floor', async () => {
    const target = fakeTarget()
    const plan = buildWritePlan(ALL, {}, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts())

    expect(byTier(steps, 1).outcome).toBe('written')
    expect(byTier(steps, 1).id).toBe('srv-QuestionnaireResponse-1')
    expect(byTier(steps, 2).outcome).toBe('written')
    expect(byTier(steps, 2).reason).toBe('2 Observations written')

    // Floor skipped because every discrete tier landed.
    expect(byTier(steps, 0).outcome).toBe('skipped')
    expect(target.created.some(r => r.resourceType === 'DocumentReference')).toBe(false)

    // The two Observations that reached the server point at the SERVER QR id.
    const writtenObs = target.created.filter(r => r.resourceType === 'Observation') as ObservationResource[]
    expect(writtenObs).toHaveLength(2)
    for (const o of writtenObs) {
      expect(o.derivedFrom).toEqual([{ reference: 'QuestionnaireResponse/srv-QuestionnaireResponse-1' }])
    }
  })

  it('remaps a Tier-3 Condition proposal evidence ref to the server QR id when enabled', async () => {
    const target = fakeTarget()
    const plan = buildWritePlan(ALL, { enableConditionProposal: true }, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts(), { enableConditionProposal: true })

    expect(byTier(steps, 3).outcome).toBe('written')
    const writtenCondition = target.created.find(r => r.resourceType === 'Condition') as FhirResource
    expect((writtenCondition.evidence as Array<{ detail: { reference: string }[] }>)[0].detail[0].reference).toBe(
      'QuestionnaireResponse/srv-QuestionnaireResponse-1',
    )
  })
})

describe('executeWritePlan — degradation', () => {
  it('runs the floor when a discrete write fails', async () => {
    // Server rejects Observations only.
    const target = fakeTarget(r => r.resourceType === 'Observation')
    const plan = buildWritePlan(ALL, {}, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts())

    expect(byTier(steps, 1).outcome).toBe('written')
    expect(byTier(steps, 2).outcome).toBe('failed')
    expect(byTier(steps, 2).error).toContain('HTTP 422')
    expect(byTier(steps, 2).reason).toBe('0/2 Observations written')
    // Floor fires as the backstop.
    expect(byTier(steps, 0).outcome).toBe('written')
    expect(target.created.some(r => r.resourceType === 'DocumentReference')).toBe(true)
  })

  it('skips unsupported discrete tiers and lands on the floor', async () => {
    const target = fakeTarget()
    const caps = { DocumentReference: { create: true } } // nothing discrete supported
    const plan = buildWritePlan(caps, {}, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts())

    expect(byTier(steps, 1).outcome).toBe('skipped')
    expect(byTier(steps, 2).outcome).toBe('skipped')
    expect(byTier(steps, 0).outcome).toBe('written')
  })

  it('records a failed floor without throwing (fully-failed scorecard)', async () => {
    const target = fakeTarget(() => true) // everything fails
    const plan = buildWritePlan({ DocumentReference: { create: true } }, {}, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts())
    expect(byTier(steps, 0).outcome).toBe('failed')
    expect(byTier(steps, 0).error).toContain('HTTP 422')
  })
})

describe('executeWritePlan — config', () => {
  it('alwaysWriteDocument forces the floor even when discrete tiers fully landed', async () => {
    const target = fakeTarget()
    const plan = buildWritePlan(ALL, {}, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts(), { alwaysWriteDocument: true })
    expect(byTier(steps, 0).outcome).toBe('written')
  })

  it('a config-disabled tier is skipped and does NOT force the floor', async () => {
    const target = fakeTarget()
    // Disable Observation; QR still lands. No in-scope discrete gap → floor skipped.
    const plan = buildWritePlan(ALL, { enableObservation: false }, artifacts())
    const { steps } = await executeWritePlan(plan, target, artifacts(), { enableObservation: false })
    expect(byTier(steps, 2).outcome).toBe('skipped')
    expect(byTier(steps, 2).reason).toBe('Tier not enabled')
    expect(byTier(steps, 0).outcome).toBe('skipped')
  })
})
