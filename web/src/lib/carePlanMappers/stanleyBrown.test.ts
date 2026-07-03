import { describe, it, expect } from 'vitest'
import { generateCarePlan } from './stanleyBrown'
import type { QuestionnaireResponseResource, QuestionnaireResponseItem } from '../../types/fhir'

// Repeating "pair" groups capture their two child fields under answer.item.
function pairGroup(groupLinkId: string, fieldA: string, fieldB: string, pairs: Array<[string, string]>): QuestionnaireResponseItem {
  return {
    linkId: groupLinkId,
    answer: pairs.map(([a, b]) => ({
      item: [
        { linkId: fieldA, answer: [{ valueString: a }] },
        { linkId: fieldB, answer: [{ valueString: b }] },
      ],
    })),
  }
}

function simple(linkId: string, values: string[]): QuestionnaireResponseItem {
  return { linkId, answer: values.map(valueString => ({ valueString })) }
}

function fullSafetyPlan(): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/StanleyBrownSafetyPlan',
    item: [
      simple('1-1-warning-sign', ['Racing thoughts', 'Isolating']),
      simple('2-1-coping-strategy', ['Go for a walk']),
      pairGroup('3-1-distraction-contact-group', '3-1-name-place', '3-2-contact-info', [['Local gym', '555-0100']]),
      pairGroup('4-1-support-person-group', '4-1-name', '4-2-contact-info', [['Sister Jane', '555-0111']]),
      pairGroup('5-1-clinician-agency-group', '5-1-name', '5-2-contact-info', [['Dr. Lee', '555-0122']]),
      simple('5-3-name', ['General Hospital ED']),
      simple('5-4-address', ['1 Main St']),
      simple('5-5-phone', ['555-0133']),
      simple('6-1-safety-action', ['Store medications with a friend']),
      simple('7-1-worth-living', ['My children']),
    ],
  } as QuestionnaireResponseResource
}

describe('generateCarePlan (Stanley-Brown)', () => {
  it('produces a suicide-prevention CarePlan with all 7 steps', () => {
    const { resource, activities, isEmpty } = generateCarePlan(fullSafetyPlan())
    expect(isEmpty).toBe(false)
    expect(resource.resourceType).toBe('CarePlan')
    expect(activities).toHaveLength(7)

    const meta = resource.meta as { profile?: string[] }
    expect(meta.profile).toContain('http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan')

    const category = resource.category as Array<{ coding?: Array<{ code?: string }> }>
    expect(category[0].coding?.[0]?.code).toBe('735324008')
  })

  it('embeds patient content and LOINC codes on each activity (Hybrid model)', () => {
    const { activities, resource } = generateCarePlan(fullSafetyPlan())

    // Step 1: multiple warning signs joined
    expect(activities[0].loincCode).toBe('76689-1')
    expect(activities[0].description).toBe('Racing thoughts, Isolating')

    // Step 3: distraction pair rendered as "name (contact)"
    expect(activities[2].description).toBe('Local gym (555-0100)')

    // Step 5: professional support + ED block merged
    expect(activities[4].description).toContain('Dr. Lee (555-0122)')
    expect(activities[4].description).toContain('General Hospital ED')
    expect(activities[4].description).toContain('1 Main St')

    // LOINC codes land on the FHIR activity detail.code
    const fhirActivity = (resource.activity as Array<{ detail?: { code?: { coding?: Array<{ code?: string }> } } }>)[0]
    expect(fhirActivity.detail?.code?.coding?.[0]?.code).toBe('76689-1')
  })

  it('an empty response yields isEmpty=true and placeholder descriptions', () => {
    const empty: QuestionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://spier.org/Questionnaire/StanleyBrownSafetyPlan',
      item: [],
    } as QuestionnaireResponseResource

    const { activities, isEmpty } = generateCarePlan(empty)
    expect(isEmpty).toBe(true)
    expect(activities).toHaveLength(7)
    expect(activities[0].description).toBe('No warning signs provided.')
  })
})
