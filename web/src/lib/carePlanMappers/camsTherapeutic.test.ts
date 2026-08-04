import { describe, it, expect } from 'vitest'
import { generateTherapeuticCarePlan } from './camsTherapeutic'
import type { QuestionnaireResponseResource, QuestionnaireResponseItem } from '../../types/fhir'

function simple(linkId: string, value: string): QuestionnaireResponseItem {
  return { linkId, answer: [{ valueString: value }] }
}

describe('generateTherapeuticCarePlan', () => {
  it('produces a 4-activity CarePlan for a fully populated QuestionnaireResponse', () => {
    const fullResponse: QuestionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://spier.org/Questionnaire/CamsTherapeuticWorksheet',
      item: [
        simple('story-narrative', 'Patient has been feeling overwhelmed at work.'),
        simple('dd-thoughts', 'I am a failure'),
        simple('dd-feelings', 'Hopelessness'),
        simple('dd-behaviors', 'Withdrawing from friends'),
        simple('dd-themes', 'Rejection'),
        simple('id-desc', 'Recent divorce and financial stress.'),
        simple('si-increase', 'Argument with ex-spouse'),
        simple('si-decrease', 'Talking to best friend'),
        simple('sd-increase', 'Being alone on weekends'),
        simple('sd-decrease', 'Engaging in hobbies'),
        simple('so-increase', 'Intense feelings of shame'),
        simple('so-decrease', 'Thinking of children'),
      ],
    } as QuestionnaireResponseResource

    const { resource, activities, isEmpty } = generateTherapeuticCarePlan(fullResponse)
    expect(isEmpty).toBe(false)
    expect(resource.resourceType).toBe('CarePlan')
    expect(activities).toHaveLength(4)

    const meta = resource.meta as { profile?: string[] }
    expect(meta.profile).toContain('http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet')

    expect(activities[0].stepTitle).toBe('Personal Narrative')
    expect(activities[0].description).toBe('Patient has been feeling overwhelmed at work.')

    expect(activities[1].stepTitle).toBe('Direct Drivers of Suicidality')
    expect(activities[1].description).toBe('Thoughts: I am a failure; Feelings: Hopelessness; Behaviors: Withdrawing from friends; Themes: Rejection')

    expect(activities[2].stepTitle).toBe('Indirect Drivers of Suicidality')
    expect(activities[2].description).toBe('Recent divorce and financial stress.')

    expect(activities[3].stepTitle).toBe('Suicide Crisis Working Model')
    expect(activities[3].description).toBe(
      '[Indirect Drivers] Increases risk: Argument with ex-spouse | Decreases risk: Talking to best friend. ' +
      '[Direct Drivers] Increases risk: Being alone on weekends | Decreases risk: Engaging in hobbies. ' +
      '[Suicide as an Option] Increases risk: Intense feelings of shame | Decreases risk: Thinking of children'
    )
  })

  it('codes every section, since the profile slices activity on detail.code', () => {
    // The section codes are structural — they do not depend on the answers, so
    // even a single-answer response must emit all four, coded.
    const response = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://spier.org/Questionnaire/CAMS-Therapeutic-Worksheet',
      item: [simple('story-narrative', 'Overwhelmed at work.')],
    } as QuestionnaireResponseResource

    const { activities, resource } = generateTherapeuticCarePlan(response)
    const SYSTEM = 'http://spier.org/CodeSystem/cams-careplan-section'

    // All four are SPiER-local: CAMS's narrative and driver constructs have no
    // published LOINC equivalent. A text-only detail.code no longer conforms to
    // SPiERCAMSTherapeuticWorksheet, which this CarePlan declares in meta.profile.
    expect(activities.map(a => a.sectionCode)).toEqual([
      { system: SYSTEM, code: 'personal-narrative' },
      { system: SYSTEM, code: 'direct-drivers' },
      { system: SYSTEM, code: 'indirect-drivers' },
      { system: SYSTEM, code: 'crisis-working-model' },
    ])

    const fhirActivities = resource.activity as Array<{
      detail?: { code?: { coding?: Array<{ system?: string; code?: string }>; text?: string } }
    }>
    expect(fhirActivities.map(a => a.detail?.code?.coding?.[0])).toEqual([
      { system: SYSTEM, code: 'personal-narrative' },
      { system: SYSTEM, code: 'direct-drivers' },
      { system: SYSTEM, code: 'indirect-drivers' },
      { system: SYSTEM, code: 'crisis-working-model' },
    ])
    // The human label is retained alongside the code, not replaced by it.
    expect(fhirActivities[0].detail?.code?.text).toBe('Personal Narrative')
  })

  it('an empty response yields isEmpty=true and placeholder descriptions', () => {
    const empty: QuestionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'http://spier.org/Questionnaire/CamsTherapeuticWorksheet',
      item: [],
    } as QuestionnaireResponseResource

    const { activities, isEmpty } = generateTherapeuticCarePlan(empty)
    expect(isEmpty).toBe(true)
    expect(activities).toHaveLength(4)

    expect(activities[0].description).toBe('No personal narrative provided.')
    expect(activities[1].description).toBe('No direct drivers identified.')
    expect(activities[2].description).toBe('No indirect drivers identified.')
    expect(activities[3].description).toBe('No crisis model data provided.')
  })

  it('handles partial direct driver data correctly', () => {
    const partialResponse: QuestionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [
        simple('dd-feelings', 'Sadness'),
        simple('dd-themes', 'Loss'),
      ],
    } as QuestionnaireResponseResource

    const { activities } = generateTherapeuticCarePlan(partialResponse)
    expect(activities[1].description).toBe('Feelings: Sadness; Themes: Loss')
  })

  it('handles partial crisis model data correctly', () => {
    const partialResponse: QuestionnaireResponseResource = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [
        simple('si-increase', 'Work stress'),
        simple('sd-decrease', 'Exercise'),
      ],
    } as QuestionnaireResponseResource

    const { activities } = generateTherapeuticCarePlan(partialResponse)
    expect(activities[3].description).toBe(
      '[Indirect Drivers] Increases risk: Work stress. ' +
      '[Direct Drivers] Decreases risk: Exercise'
    )
  })
})
