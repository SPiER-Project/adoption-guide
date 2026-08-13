import { describe, it, expect } from 'vitest'
import { buildWalkthroughRefIndex, resolveRelatedRefs } from './chartDisplay'
import { POPULATION_SCENARIOS } from '../data/population/scenarios'
import type { FhirResourceLike, StoredResponseLike } from './patientPathway'

/**
 * #263 phase 5b. These replaced two string-matching fields —
 * `relatedResponseNames` (match a QuestionnaireResponse by DISPLAY NAME) and
 * `relatedCarePlanIdSubstrings` (match a CarePlan by ID SUBSTRING). Both broke
 * silently on a rename, which is why they are gone.
 */

const buckets = (over: Partial<Parameters<typeof buildWalkthroughRefIndex>[0]> = {}) => ({
  responses: [] as StoredResponseLike[],
  carePlans: [] as FhirResourceLike[],
  observations: [] as FhirResourceLike[],
  communications: [] as FhirResourceLike[],
  workflowArtifacts: [] as FhirResourceLike[],
  ...over,
})

describe('buildWalkthroughRefIndex', () => {
  it('keys a QuestionnaireResponse by its resource id, not its display name', () => {
    const index = buildWalkthroughRefIndex(
      buckets({
        responses: [
          {
            id: 'wrapper-id',
            questionnaireName: 'ASQ Screening',
            resource: { resourceType: 'QuestionnaireResponse', id: 'p011-asq' },
          } as StoredResponseLike,
        ],
      }),
    )
    expect(index.get('QuestionnaireResponse/p011-asq')?.name).toBe('ASQ Screening')
    // The display name is no longer a lookup key — renaming it cannot break a link.
    expect(index.has('QuestionnaireResponse/ASQ Screening')).toBe(false)
  })

  it('falls back to the wrapper id when the resource carries none', () => {
    const index = buildWalkthroughRefIndex(
      buckets({
        responses: [
          {
            id: 'legacy-id',
            questionnaireName: 'PHQ-9',
            resource: { resourceType: 'QuestionnaireResponse' },
          } as StoredResponseLike,
        ],
      }),
    )
    expect(index.has('QuestionnaireResponse/legacy-id')).toBe(true)
  })

  it('indexes workflow artifacts by their own resourceType, not one hardcoded kind', () => {
    const index = buildWalkthroughRefIndex(
      buckets({
        workflowArtifacts: [
          { resourceType: 'ServiceRequest', id: 'sr1' },
          { resourceType: 'Appointment', id: 'appt1' },
          { resourceType: 'DocumentReference', id: 'doc1' },
        ],
      }),
    )
    expect([...index.keys()].sort()).toEqual([
      'Appointment/appt1',
      'DocumentReference/doc1',
      'ServiceRequest/sr1',
    ])
  })

  it('skips a resource with no id rather than minting "Type/undefined"', () => {
    const index = buildWalkthroughRefIndex(
      buckets({ carePlans: [{ resourceType: 'CarePlan' }] }),
    )
    expect(index.size).toBe(0)
  })
})

describe('resolveRelatedRefs', () => {
  const index = buildWalkthroughRefIndex(
    buckets({ workflowArtifacts: [{ resourceType: 'ServiceRequest', id: 'sr1' }] }),
  )

  it('resolves a known reference', () => {
    expect(resolveRelatedRefs(['ServiceRequest/sr1'], index)).toHaveLength(1)
  })

  it('drops an unresolvable reference rather than rendering a dead row', () => {
    expect(resolveRelatedRefs(['ServiceRequest/gone'], index)).toEqual([])
  })

  it('handles a step with no refs at all — most steps have none', () => {
    expect(resolveRelatedRefs(undefined, index)).toEqual([])
  })
})

describe('every walkthrough ref in every shipped scenario resolves', () => {
  it('has no dangling reference', () => {
    const dangling: string[] = []
    for (const [patientId, scenario] of Object.entries(POPULATION_SCENARIOS)) {
      const index = buildWalkthroughRefIndex({
        responses: scenario.responses ?? [],
        carePlans: scenario.carePlans ?? [],
        observations: scenario.observations ?? [],
        communications: scenario.communications ?? [],
        // Must mirror PatientChart's index exactly, or this test passes on a
        // set of buckets the chart does not actually build.
        workflowArtifacts: [
          ...(scenario.documentReferences ?? []),
          ...(scenario.serviceRequests ?? []),
          ...(scenario.appointments ?? []),
          ...(scenario.flags ?? []),
          ...(scenario.tasks ?? []),
          ...(scenario.encounters ?? []),
          ...(scenario.procedures ?? []),
          ...(scenario.consents ?? []),
        ],
      })
      for (const step of scenario.walkthrough ?? []) {
        for (const ref of step.relatedRefs ?? []) {
          if (!index.has(ref)) dangling.push(`${patientId}:${step.step ?? step.id}:${ref}`)
        }
      }
    }
    expect(dangling).toEqual([])
  })
})
