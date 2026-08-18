import { describe, it, expect } from 'vitest'
import { parseCapabilityStatement, canCreate } from './capability'

describe('parseCapabilityStatement', () => {
  it('extracts create support per resource type', () => {
    const cs = {
      resourceType: 'CapabilityStatement',
      rest: [
        {
          mode: 'server',
          resource: [
            { type: 'QuestionnaireResponse', interaction: [{ code: 'read' }, { code: 'create' }] },
            { type: 'Observation', interaction: [{ code: 'read' }] },
            { type: 'DocumentReference', interaction: [{ code: 'create' }] },
          ],
        },
      ],
    }
    const caps = parseCapabilityStatement(cs)
    expect(caps.QuestionnaireResponse).toEqual({ create: true })
    expect(caps.Observation).toEqual({ create: false })
    expect(caps.DocumentReference).toEqual({ create: true })
    expect(canCreate(caps, 'QuestionnaireResponse')).toBe(true)
    expect(canCreate(caps, 'Observation')).toBe(false)
    expect(canCreate(caps, 'Condition')).toBe(false) // absent → unsupported
  })

  it('treats a missing/malformed rest as no capabilities', () => {
    expect(parseCapabilityStatement(null)).toEqual({})
    expect(parseCapabilityStatement({})).toEqual({})
    expect(parseCapabilityStatement({ rest: 'nope' })).toEqual({})
    expect(parseCapabilityStatement('not json')).toEqual({})
  })

  it('tolerates resources with no type or no interaction array', () => {
    const caps = parseCapabilityStatement({
      rest: [{ resource: [{ interaction: [{ code: 'create' }] }, { type: 'Patient' }] }],
    })
    expect(caps).toEqual({ Patient: { create: false } })
  })

  it('ORs create support across multiple rest entries (never removes it)', () => {
    const caps = parseCapabilityStatement({
      rest: [
        { resource: [{ type: 'Observation', interaction: [{ code: 'read' }] }] },
        { resource: [{ type: 'Observation', interaction: [{ code: 'create' }] }] },
      ],
    })
    expect(caps.Observation).toEqual({ create: true })
  })
})
