import { describe, it, expect } from 'vitest'
import { generateCrisisResponseCarePlan } from './crp'
import type { QuestionnaireResponseResource } from '../../types/fhir'

type Activity = { detail?: { code?: { text?: string; coding?: Array<{ code?: string }> }; description?: string } }

function crpResponse(answers: Record<string, string[]>): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/CrisisResponsePlan',
    item: Object.entries(answers).map(([linkId, values]) => ({
      linkId,
      answer: values.map(valueString => ({ valueString })),
    })),
  } as QuestionnaireResponseResource
}

describe('generateCrisisResponseCarePlan', () => {
  it('produces a 5-activity CarePlan conformant to the CRP profile', () => {
    const plan = generateCrisisResponseCarePlan(crpResponse({
      'warning-signs-list': ['racing thoughts', 'skipping meals'],
      'coping-list': ['go for a run'],
      'reasons-living-list': ['my daughter'],
      'social-support-list': ['call my sister'],
      'professional-support-list': ['988', 'Dr. Lee'],
    }))
    expect(plan.resource.resourceType).toBe('CarePlan')
    const meta = plan.resource.meta as { profile?: string[] }
    expect(meta.profile?.[0]).toBe('http://spier.org/StructureDefinition/spier-crisis-response-plan')
    expect(plan.activities).toHaveLength(5)
    expect(plan.isEmpty).toBe(false)
  })

  it('joins repeating answers into the matching activity description', () => {
    const plan = generateCrisisResponseCarePlan(crpResponse({
      'warning-signs-list': ['racing thoughts', 'skipping meals'],
    }))
    const activity = plan.resource.activity as Activity[]
    const warning = activity.find(a => a.detail?.code?.text === 'Warning Signs')
    expect(warning?.detail?.description).toBe('racing thoughts; skipping meals')
    // reuses the Stanley-Brown warning-signs LOINC
    expect(warning?.detail?.code?.coding?.[0]?.code).toBe('76689-1')
  })

  it('empty response → isEmpty true with placeholder descriptions', () => {
    const plan = generateCrisisResponseCarePlan(crpResponse({}))
    expect(plan.isEmpty).toBe(true)
    expect(plan.activities).toHaveLength(5)
    const activity = plan.resource.activity as Activity[]
    const reasons = activity.find(a => a.detail?.code?.text === 'Reasons for Living')
    expect(reasons?.detail?.description).toContain('No reasons for living')
  })
})
