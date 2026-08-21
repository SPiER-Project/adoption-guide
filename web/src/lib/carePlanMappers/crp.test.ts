import { describe, it, expect } from 'vitest'
import { generateCrisisResponseCarePlan } from '@spier/core/lib/carePlanMappers/crp'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'

type Activity = { detail?: { code?: { text?: string; coding?: Array<{ system?: string; code?: string }> }; description?: string } }

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
    // shares the Stanley-Brown warning-signs section code
    expect(warning?.detail?.code?.coding?.[0]?.system).toBe('http://spier.org/CodeSystem/safety-plan-section')
    expect(warning?.detail?.code?.coding?.[0]?.code).toBe('warning-signs')
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
