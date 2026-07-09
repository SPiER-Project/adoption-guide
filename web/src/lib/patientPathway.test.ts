import { describe, it, expect } from 'vitest'
import { derivePathwayStatus, PATHWAY_STAGE_SYSTEM } from './patientPathway'
import type { PatientArtifacts, FhirResourceLike } from './patientPathway'
import { STAGES } from '../data/catalog'

function mockArtifact(stageId?: string): FhirResourceLike {
  if (!stageId) {
    return { resourceType: 'Observation', id: 'unmapped' }
  }
  return {
    resourceType: 'Observation',
    id: `mapped-${stageId}`,
    meta: {
      tag: [
        {
          system: PATHWAY_STAGE_SYSTEM,
          code: stageId,
        },
      ],
    },
  }
}

describe('derivePathwayStatus', () => {
  it('returns initial state for empty artifacts', () => {
    const artifacts: PatientArtifacts = { responses: [] }
    const result = derivePathwayStatus(artifacts)

    expect(result.maxCompletedIndex).toBe(-1)
    expect(result.activeStageId).toBe(STAGES[0]?.id)

    // First stage should be active, rest not-started
    expect(result.statuses[STAGES[0]!.id]).toBe('active')
    for (let i = 1; i < STAGES.length; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('not-started')
    }
  })

  it('handles a single artifact at a specific stage', () => {
    const stageIndex = 1
    const stageId = STAGES[stageIndex]!.id
    const artifacts: PatientArtifacts = {
      responses: [],
      observations: [mockArtifact(stageId)],
    }
    const result = derivePathwayStatus(artifacts)

    expect(result.maxCompletedIndex).toBe(stageIndex)
    expect(result.activeStageId).toBe(STAGES[stageIndex + 1]?.id || null)

    // Up to stageIndex should be complete
    for (let i = 0; i <= stageIndex; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('complete')
    }
    // Next stage should be active (if exists)
    if (stageIndex + 1 < STAGES.length) {
      expect(result.statuses[STAGES[stageIndex + 1]!.id]).toBe('active')
    }
    // Rest should be not-started
    for (let i = stageIndex + 2; i < STAGES.length; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('not-started')
    }
  })

  it('handles multiple artifacts out of order (highest index wins)', () => {
    const lowerIndex = 0
    const higherIndex = 2
    const artifacts: PatientArtifacts = {
      responses: [],
      observations: [
        mockArtifact(STAGES[lowerIndex]!.id),
        mockArtifact(STAGES[higherIndex]!.id),
      ],
    }
    const result = derivePathwayStatus(artifacts)

    expect(result.maxCompletedIndex).toBe(higherIndex)
    expect(result.activeStageId).toBe(STAGES[higherIndex + 1]?.id || null)

    for (let i = 0; i <= higherIndex; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('complete')
    }
    if (higherIndex + 1 < STAGES.length) {
      expect(result.statuses[STAGES[higherIndex + 1]!.id]).toBe('active')
    }
    for (let i = higherIndex + 2; i < STAGES.length; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('not-started')
    }
  })

  it('ignores artifacts that do not map to any stage', () => {
    const artifacts: PatientArtifacts = {
      responses: [],
      observations: [mockArtifact()],
    }
    const result = derivePathwayStatus(artifacts)

    expect(result.maxCompletedIndex).toBe(-1)
    expect(result.activeStageId).toBe(STAGES[0]?.id)

    expect(result.statuses[STAGES[0]!.id]).toBe('active')
    for (let i = 1; i < STAGES.length; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('not-started')
    }
  })

  it('handles a mix of mapped and unmapped artifacts correctly', () => {
    const stageIndex = 1
    const artifacts: PatientArtifacts = {
      responses: [],
      observations: [
        mockArtifact(), // Unmapped
        mockArtifact(STAGES[stageIndex]!.id), // Mapped to index 1
        mockArtifact(), // Unmapped
      ],
    }
    const result = derivePathwayStatus(artifacts)

    expect(result.maxCompletedIndex).toBe(stageIndex)
    expect(result.activeStageId).toBe(STAGES[stageIndex + 1]?.id || null)

    for (let i = 0; i <= stageIndex; i++) {
      expect(result.statuses[STAGES[i]!.id]).toBe('complete')
    }
    if (stageIndex + 1 < STAGES.length) {
      expect(result.statuses[STAGES[stageIndex + 1]!.id]).toBe('active')
    }
  })
})
