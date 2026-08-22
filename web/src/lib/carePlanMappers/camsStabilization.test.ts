import { describe, it, expect } from 'vitest'
import { generateStabilizationCarePlan } from '@spier/core/lib/carePlanMappers/camsStabilization'
import type { QuestionnaireResponseResource, QuestionnaireResponseItem } from '@spier/core/types/fhir'
import { PAIR_SHAPES, pairGroup, type PairShape } from './__fixtures__/pairGroup'

// Helpers
function simple(linkId: string, values: string[]): QuestionnaireResponseItem {
  return { linkId, answer: values.map(valueString => ({ valueString })) }
}

function fullStabilizationPlan(shape: PairShape = 'conformant'): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/CAMSStabilizationPlan',
    item: [
      simple('lethal-means-list', ['Remove firearms', 'Lock medications']),
      simple('coping-list', ['Deep breathing', 'Listen to music']),
      simple('emergency-contact', ['911', 'Local Crisis Center']),
      simple('support-list', ['Wife', 'Best Friend']),
      ...pairGroup(shape, 'barrier-solution-group', 'barrier', 'solution', [
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

  it('embeds patient content and a section code on each activity', () => {
    const { activities, resource } = generateStabilizationCarePlan(fullStabilizationPlan())
    const SECTION_SYSTEM = 'http://spier.org/CodeSystem/cams-careplan-section'

    // Step 1: Lethal Means Reduction
    expect(activities[0].sectionCode?.code).toBe('lethal-means-reduction')
    expect(activities[0].description).toBe('Remove firearms; Lock medications')

    // Step 2: Coping Strategies
    expect(activities[1].sectionCode?.code).toBe('coping-strategies')
    expect(activities[1].description).toBe('Deep breathing; Listen to music')

    // Step 3: Emergency Contact
    expect(activities[2].sectionCode?.code).toBe('emergency-contact')
    expect(activities[2].description).toBe('911, Local Crisis Center')

    // Step 4: Support Network
    expect(activities[3].sectionCode?.code).toBe('support-network')
    expect(activities[3].description).toBe('Wife; Best Friend')

    // Step 5: Treatment Adherence Plan. Every section is coded — the profile
    // slices activity on detail.code and requires all five.
    expect(activities[4].sectionCode).toEqual({ system: SECTION_SYSTEM, code: 'treatment-adherence' })
    expect(activities[4].description).toBe('Transportation → Bus pass; Forgetting appointments → Phone alarm; No motivation')

    // Section codes land on the FHIR activity detail.code — and every one of the
    // five activities must carry a coding, or the CarePlan violates the profile
    // it declares in meta.profile.
    const fhirActivities = resource.activity as Array<{ detail?: { code?: { coding?: Array<{ system?: string; code?: string }> } } }>
    expect(fhirActivities.map(a => a.detail?.code?.coding?.[0])).toEqual([
      { system: SECTION_SYSTEM, code: 'lethal-means-reduction' },
      { system: SECTION_SYSTEM, code: 'coping-strategies' },
      { system: SECTION_SYSTEM, code: 'emergency-contact' },
      { system: SECTION_SYSTEM, code: 'support-network' },
      { system: SECTION_SYSTEM, code: 'treatment-adherence' },
    ])
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

  // ⚠️ `barrier-solution-group` is `type: group, repeats: true`, the same shape
  // that broke Stanley-Brown (#418/#419). This mapper shares `extractPairs`, so
  // it was broken the same way and fixed by the same change — incidentally, and
  // with nothing here covering it. That is the gap this closes.
  for (const shape of PAIR_SHAPES) {
    it(`reads the barrier/solution pairs from the ${shape} response shape`, () => {
      const { activities } = generateStabilizationCarePlan(fullStabilizationPlan(shape))
      const barriers = activities.find(a => a.sectionCode?.code === 'treatment-adherence')
      expect(barriers?.description, `${shape} shape lost its pairs`).toContain('Transportation')
      expect(barriers?.description).toContain('Bus pass')
      expect(barriers?.description).toContain('Forgetting appointments')
      expect(barriers?.description).not.toMatch(/^No .* (provided|identified)\.$/)
    })
  }
})
