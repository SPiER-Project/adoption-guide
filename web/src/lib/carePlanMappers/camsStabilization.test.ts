import { describe, it, expect } from 'vitest'
import { generateStabilizationCarePlan } from './camsStabilization'
import type { QuestionnaireResponseResource, QuestionnaireResponseItem } from '../../types/fhir'

// Helpers
function pairGroup(groupLinkId: string, fieldA: string, fieldB: string, pairs: Array<[string, string]>): QuestionnaireResponseItem {
  return {
    linkId: groupLinkId,
    answer: pairs.map(([a, b]) => {
      const item: QuestionnaireResponseItem[] = []
      if (a) item.push({ linkId: fieldA, answer: [{ valueString: a }] })
      if (b) item.push({ linkId: fieldB, answer: [{ valueString: b }] })
      return { item }
    }),
  }
}

function simple(linkId: string, values: string[]): QuestionnaireResponseItem {
  return { linkId, answer: values.map(valueString => ({ valueString })) }
}

function fullStabilizationPlan(): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/CAMSStabilizationPlan',
    item: [
      simple('lethal-means-list', ['Remove firearms', 'Lock medications']),
      simple('coping-list', ['Deep breathing', 'Listen to music']),
      simple('emergency-contact', ['911', 'Local Crisis Center']),
      simple('support-list', ['Wife', 'Best Friend']),
      pairGroup('barrier-solution-group', 'barrier', 'solution', [
        ['Transportation', 'Bus pass'],
        ['Forgetting appointments', 'Phone alarm'],
        ['No motivation', ''], // no solution case
      ]),
    ],
  } as QuestionnaireResponseResource
}

describe('generateStabilizationCarePlan (CAMS)', () => {
  it('produces a suicide-prevention CarePlan with all 5 steps', () => {
    const { resource, activities, isEmpty } = generateStabilizationCarePlan(fullStabilizationPlan())
    expect(isEmpty).toBe(false)
    expect(resource.resourceType).toBe('CarePlan')
    expect(activities).toHaveLength(5)

    const meta = resource.meta as { profile?: string[] }
    expect(meta.profile).toContain('http://spier.org/StructureDefinition/spier-cams-stabilization-plan')

    const category = resource.category as Array<{ coding?: Array<{ code?: string }> }>
    expect(category[0].coding?.[0]?.code).toBe('735324008')
  })

  it('embeds patient content and LOINC codes on each activity', () => {
    const { activities, resource } = generateStabilizationCarePlan(fullStabilizationPlan())

    // Step 1: Lethal Means Reduction
    expect(activities[0].loincCode).toBe('76694-1')
    expect(activities[0].description).toBe('Remove firearms; Lock medications')

    // Step 2: Coping Strategies
    expect(activities[1].loincCode).toBe('76690-9')
    expect(activities[1].description).toBe('Deep breathing; Listen to music')

    // Step 3: Emergency Contact
    expect(activities[2].loincCode).toBe('76693-3')
    expect(activities[2].description).toBe('911, Local Crisis Center')

    // Step 4: Support Network
    expect(activities[3].loincCode).toBe('76692-5')
    expect(activities[3].description).toBe('Wife; Best Friend')

    // Step 5: Treatment Adherence Plan
    expect(activities[4].loincCode).toBeUndefined()
    expect(activities[4].description).toBe('Transportation → Bus pass; Forgetting appointments → Phone alarm; No motivation')

    // LOINC codes land on the FHIR activity detail.code
    const fhirActivity = (resource.activity as Array<{ detail?: { code?: { coding?: Array<{ code?: string }> } } }>)[0]
    expect(fhirActivity.detail?.code?.coding?.[0]?.code).toBe('76694-1')
  })

  it('an empty response yields isEmpty=true and placeholder descriptions', () => {
    const empty: QuestionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://spier.org/Questionnaire/CAMSStabilizationPlan',
      item: [],
    } as QuestionnaireResponseResource

    const { activities, isEmpty } = generateStabilizationCarePlan(empty)
    expect(isEmpty).toBe(true)
    expect(activities).toHaveLength(5)

    expect(activities[0].description).toBe('No lethal means reduction steps provided.')
    expect(activities[1].description).toBe('No coping strategies provided.')
    expect(activities[2].description).toBe('No emergency contact provided.')
    expect(activities[3].description).toBe('No support contacts provided.')
    expect(activities[4].description).toBe('No barriers/solutions identified.')
  })
})
