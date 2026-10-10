import { describe, it, expect } from 'vitest'
import { buildWritePlan, resolveConfig } from '@spier/core/lib/writeback/ladder'
import type { ServerCapabilities, WritebackArtifacts, WriteStep } from '@spier/core/lib/writeback/types'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'

const qr: QuestionnaireResponseResource = {
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  questionnaire: 'http://thespierproject.org/fhir/Questionnaire/PHQ-9',
  status: 'completed',
}
const obs: ObservationResource[] = [{ resourceType: 'Observation', id: 'o1', status: 'final' } as ObservationResource]
const documentReference: FhirResource = { resourceType: 'DocumentReference' }

function artifacts(overrides: Partial<WritebackArtifacts> = {}): WritebackArtifacts {
  return { qr, observations: obs, conditions: [], documentReference, ...overrides }
}

const ALL: ServerCapabilities = {
  QuestionnaireResponse: { create: true },
  Observation: { create: true },
  Condition: { create: true },
  DocumentReference: { create: true },
}

/** Compact [tier, resourceType, disposition] view for assertions. */
const shape = (plan: WriteStep[]) => plan.map(s => [s.tier, s.resourceType, s.disposition] as const)

describe('resolveConfig', () => {
  it('defaults: QR + Observation on, floor conditional', () => {
    expect(resolveConfig()).toEqual({
      enableQuestionnaireResponse: true,
      enableObservation: true,
      enableRecordedConditions: true,
      alwaysWriteDocument: false,
    })
  })
})

describe('buildWritePlan — tier ordering & swap', () => {
  it('emits QR (Tier 1) before Observation (Tier 2), floor last', () => {
    const plan = buildWritePlan(ALL, {}, artifacts())
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [2, 'Observation', 'attempt'],
      // Condition omitted (tier off by default)
      [0, 'DocumentReference', 'attempt'],
    ])
  })
})

describe('buildWritePlan — capability gating', () => {
  it('marks discrete tiers unsupported when the server cannot create them', () => {
    const caps: ServerCapabilities = { DocumentReference: { create: true } }
    const plan = buildWritePlan(caps, {}, artifacts())
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'unsupported'],
      [2, 'Observation', 'unsupported'],
      [0, 'DocumentReference', 'attempt'], // floor always attempts
    ])
  })

  it('supports partial capability (QR yes, Observation no)', () => {
    const caps: ServerCapabilities = { QuestionnaireResponse: { create: true } }
    const plan = buildWritePlan(caps, {}, artifacts())
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [2, 'Observation', 'unsupported'],
      [0, 'DocumentReference', 'attempt'],
    ])
  })
})

describe('buildWritePlan — artifact presence', () => {
  it('omits the Observation tier when there are no Observations', () => {
    const plan = buildWritePlan(ALL, {}, artifacts({ observations: [] }))
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [0, 'DocumentReference', 'attempt'],
    ])
  })
})

// A screen never becomes a Condition (#639). Even a server that can create
// Conditions, handed every config the ladder accepts, gets no Condition step.
describe('buildWritePlan — never an inferred Condition', () => {
  // A screen's save: the ladder never turns a result into a problem (#639).
  // Only a form that RECORDED problems has a Condition step — see below.
  it('plans no Condition write for a form that recorded none, under any config', () => {
    for (const config of [{}, { alwaysWriteDocument: true }, { enableObservation: false }]) {
      const plan = buildWritePlan(ALL, config, artifacts())
      expect(plan.map(s => s.resourceType)).not.toContain('Condition')
    }
  })
})

describe('buildWritePlan — Tier 2 recorded Conditions (CAMS drivers)', () => {
  const driver = { resourceType: 'Condition', id: 'd1' } as const

  it('is its own Tier-2 step, after the Observations and before the floor', () => {
    const plan = buildWritePlan(ALL, {}, artifacts({ conditions: [driver] }))
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [2, 'Observation', 'attempt'],
      [2, 'Condition', 'attempt'],
      [0, 'DocumentReference', 'attempt'],
    ])
  })

  it('stands alone when the form recorded problems and no scores', () => {
    const plan = buildWritePlan(ALL, {}, artifacts({ observations: [], conditions: [driver] }))
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [2, 'Condition', 'attempt'],
      [0, 'DocumentReference', 'attempt'],
    ])
  })

  // The defect this step exists to fix: the drivers rode in the Observation
  // step, so a server's Observation capability was what licensed a Condition POST.
  it('is gated on the CONDITION capability, never the Observation one', () => {
    const caps: ServerCapabilities = { ...ALL, Condition: { create: false } }
    const plan = buildWritePlan(caps, {}, artifacts({ conditions: [driver] }))
    expect(plan.find(s => s.resourceType === 'Observation')?.disposition).toBe('attempt')
    expect(plan.find(s => s.resourceType === 'Condition')?.disposition).toBe('unsupported')
  })

  it('can be turned off by config', () => {
    const plan = buildWritePlan(ALL, { enableRecordedConditions: false }, artifacts({ conditions: [driver] }))
    expect(plan.find(s => s.resourceType === 'Condition')?.disposition).toBe('disabled')
  })
})

describe('buildWritePlan — explicit disable', () => {
  it('marks a config-disabled discrete tier as disabled (not unsupported)', () => {
    const plan = buildWritePlan(ALL, { enableQuestionnaireResponse: false }, artifacts())
    expect(plan.find(s => s.tier === 1)?.disposition).toBe('disabled')
  })
})
