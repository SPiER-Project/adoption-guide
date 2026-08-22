import { describe, it, expect } from 'vitest'
import { generateCarePlan } from '@spier/core/lib/carePlanMappers/stanleyBrown'
import type { QuestionnaireResponseResource, QuestionnaireResponseItem } from '@spier/core/types/fhir'
import { PAIR_SHAPES, pairGroup, type PairShape } from './__fixtures__/pairGroup'

function simple(linkId: string, values: string[]): QuestionnaireResponseItem {
  return { linkId, answer: values.map(valueString => ({ valueString })) }
}

function fullSafetyPlan(shape: PairShape = 'conformant'): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/StanleyBrownSafetyPlan',
    item: [
      simple('1-1-warning-sign', ['Racing thoughts', 'Isolating']),
      simple('2-1-coping-strategy', ['Go for a walk']),
      ...pairGroup(shape, '3-1-distraction-contact-group', '3-1-name-place', '3-2-contact-info', [['Local gym', '555-0100']]),
      ...pairGroup(shape, '4-1-support-person-group', '4-1-name', '4-2-contact-info', [['Sister Jane', '555-0111']]),
      ...pairGroup(shape, '5-1-clinician-agency-group', '5-1-name', '5-2-contact-info', [['Dr. Lee', '555-0122']]),
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

  it('embeds patient content and section codes on each activity (Hybrid model)', () => {
    const { activities, resource } = generateCarePlan(fullSafetyPlan())

    // Step 1: multiple warning signs joined
    expect(activities[0].sectionCode?.code).toBe('warning-signs')
    expect(activities[0].description).toBe('Racing thoughts, Isolating')

    // Step 3: distraction pair rendered as "name (contact)"
    expect(activities[2].description).toBe('Local gym (555-0100)')

    // Step 5: professional support + ED block merged
    expect(activities[4].description).toContain('Dr. Lee (555-0122)')
    expect(activities[4].description).toContain('General Hospital ED')
    expect(activities[4].description).toContain('1 Main St')

    // Section codes land on the FHIR activity detail.code
    const fhirActivity = (resource.activity as Array<{ detail?: { code?: { coding?: Array<{ system?: string; code?: string }> } } }>)[0]
    expect(fhirActivity.detail?.code?.coding?.[0]?.system).toBe('http://spier.org/CodeSystem/safety-plan-section')
    expect(fhirActivity.detail?.code?.coding?.[0]?.code).toBe('warning-signs')

    // The one real standard code that applies sits at document level on category.
    const category = resource.category as Array<{ coding?: Array<{ system?: string; code?: string }> }>
    expect(category.some(c => c.coding?.[0]?.system === 'http://loinc.org' && c.coding?.[0]?.code === '87626-8')).toBe(true)
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

  // Both response shapes must yield the same contacts — reading only
  // `answer.item` is what emptied every contact section (#418/#419).
  for (const shape of PAIR_SHAPES) {
    it(`reads all three contact steps from the ${shape} response shape`, () => {
      const { activities } = generateCarePlan(fullSafetyPlan(shape))
      const byCode = (code: string) => activities.find(a => a.sectionCode?.code === code)?.description ?? ''
      expect(byCode('social-distraction'), `${shape}: step 3`).toContain('Local gym')
      expect(byCode('crisis-support'), `${shape}: step 4`).toContain('Sister Jane')
      expect(byCode('professional-support'), `${shape}: step 5`).toContain('Dr. Lee')
      for (const code of ['social-distraction', 'crisis-support', 'professional-support']) {
        expect(byCode(code), `${shape}: ${code}`).not.toMatch(/^No .* provided\.$/)
      }
    })
  }
})
