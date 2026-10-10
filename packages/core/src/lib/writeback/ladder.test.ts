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
const condition: FhirResource = { resourceType: 'Condition' }

function artifacts(overrides: Partial<WritebackArtifacts> = {}): WritebackArtifacts {
  return { qr, observations: obs, conditions: [], documentReference, condition, ...overrides }
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
  it('defaults: QR + Observation on, Condition off, floor conditional', () => {
    expect(resolveConfig()).toEqual({
      enableQuestionnaireResponse: true,
      enableObservation: true,
      enableRecordedConditions: true,
      enableConditionProposal: false,
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

describe('buildWritePlan — Tier 2 recorded Conditions (CAMS drivers)', () => {
  const driver = { resourceType: 'Condition', id: 'd1' } as const

  it('is its own Tier-2 step, after the Observations and before Tier 3', () => {
    const plan = buildWritePlan(ALL, { enableConditionProposal: true }, artifacts({ conditions: [driver] }))
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [2, 'Observation', 'attempt'],
      [2, 'Condition', 'attempt'],
      [3, 'Condition', 'attempt'],
      [0, 'DocumentReference', 'attempt'],
    ])
  })

  it('is ON by default — unlike Tier 3, it is not the app inferring a problem', () => {
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
    expect(plan.find(s => s.tier === 2 && s.resourceType === 'Observation')?.disposition).toBe('attempt')
    expect(plan.find(s => s.tier === 2 && s.resourceType === 'Condition')?.disposition).toBe('unsupported')
  })

  it('is omitted when the instrument recorded none', () => {
    const plan = buildWritePlan(ALL, {}, artifacts())
    expect(plan.some(s => s.tier === 2 && s.resourceType === 'Condition')).toBe(false)
  })

  it('can be turned off by config', () => {
    const plan = buildWritePlan(ALL, { enableRecordedConditions: false }, artifacts({ conditions: [driver] }))
    expect(plan.find(s => s.tier === 2 && s.resourceType === 'Condition')?.disposition).toBe('disabled')
  })
})

describe('buildWritePlan — Tier 3 (opt-in Condition)', () => {
  it('is absent by default even when a proposal exists', () => {
    const plan = buildWritePlan(ALL, {}, artifacts())
    expect(plan.some(s => s.tier === 3)).toBe(false)
  })

  it('appears (before the floor) when enabled and a proposal exists', () => {
    const plan = buildWritePlan(ALL, { enableConditionProposal: true }, artifacts())
    expect(shape(plan)).toEqual([
      [1, 'QuestionnaireResponse', 'attempt'],
      [2, 'Observation', 'attempt'],
      [3, 'Condition', 'attempt'],
      [0, 'DocumentReference', 'attempt'],
    ])
  })

  it('is omitted when enabled but no proposal was built', () => {
    const plan = buildWritePlan(ALL, { enableConditionProposal: true }, artifacts({ condition: undefined }))
    expect(plan.some(s => s.tier === 3)).toBe(false)
  })

  it('is unsupported when enabled + proposed but the server cannot create Condition', () => {
    const caps: ServerCapabilities = { ...ALL, Condition: { create: false } }
    const plan = buildWritePlan(caps, { enableConditionProposal: true }, artifacts())
    expect(plan.find(s => s.tier === 3)?.disposition).toBe('unsupported')
  })
})

describe('buildWritePlan — explicit disable', () => {
  it('marks a config-disabled discrete tier as disabled (not unsupported)', () => {
    const plan = buildWritePlan(ALL, { enableQuestionnaireResponse: false }, artifacts())
    expect(plan.find(s => s.tier === 1)?.disposition).toBe('disabled')
  })
})
