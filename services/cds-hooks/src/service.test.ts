import { describe, expect, it } from 'vitest'
import {
  PATIENT_VIEW_SERVICE,
  SERVICE_ID,
  buildPatientViewResponse,
} from './service'
import type { CdsHookRequest } from './types'

function request(overrides: Partial<CdsHookRequest>): CdsHookRequest {
  return {
    hook: 'patient-view',
    hookInstance: 'test-instance',
    context: { patientId: 'patient-001' },
    ...overrides,
  }
}

// A high-risk C-SSRS Screener response (ideation with plan/intent) — the mapper
// should classify this at a level that drives a `critical` card.
const HIGH_RISK_CSSRS: unknown = {
  resourceType: 'QuestionnaireResponse',
  status: 'completed',
  questionnaire: 'http://spier.org/Questionnaire/C-SSRS-Screener',
  item: [
    { linkId: 'q1', answer: [{ valueBoolean: true }] },
    { linkId: 'q2', answer: [{ valueBoolean: true }] },
    { linkId: 'q3', answer: [{ valueBoolean: true }] },
    { linkId: 'q4', answer: [{ valueBoolean: true }] },
    { linkId: 'q5', answer: [{ valueBoolean: true }] },
    { linkId: 'q6', answer: [{ valueBoolean: true }] },
  ],
}

describe('discovery definition', () => {
  it('describes exactly the patient-view hook with a QR prefetch', () => {
    expect(PATIENT_VIEW_SERVICE.hook).toBe('patient-view')
    expect(PATIENT_VIEW_SERVICE.id).toBe(SERVICE_ID)
    expect(PATIENT_VIEW_SERVICE.prefetch?.questionnaireResponses).toContain('{{context.patientId}}')
  })
})

describe('scenario fallback (no prefetch)', () => {
  it('returns cards for a bundled population patient', () => {
    const { cards } = buildPatientViewResponse(request({ context: { patientId: 'patient-001' } }))
    expect(cards.length).toBeGreaterThan(0)
    // Every card must satisfy the CDS Hooks required fields.
    for (const card of cards) {
      expect(typeof card.summary).toBe('string')
      expect(card.summary.length).toBeLessThanOrEqual(140)
      expect(['info', 'warning', 'critical']).toContain(card.indicator)
      expect(card.source.label).toBeTruthy()
    }
  })

  it('surfaces the curated recommendedNextStep as a narrative-only card when a stage has no wired tool', () => {
    // patient-010 is a resolved episode: active stage `measure-and-share` has no
    // wired Questionnaire tool, so the curated recommendation surfaces instead.
    const { cards } = buildPatientViewResponse(request({ context: { patientId: 'patient-010' } }))
    const narrative = cards.find((c) => c.extension?.['spier-narrative-only'])
    expect(narrative?.summary).toBe('Include in Q2 zero-suicide outcome report')
  })

  it('returns an empty (valid) card list for an unknown patient id', () => {
    expect(buildPatientViewResponse(request({ context: { patientId: 'nope-999' } }))).toEqual({
      cards: [],
    })
  })
})

describe('live path (prefetched QuestionnaireResponses)', () => {
  it('derives a critical card from a high-risk screener bundle', () => {
    const { cards } = buildPatientViewResponse(
      request({
        context: { patientId: 'ehr-patient' },
        prefetch: {
          questionnaireResponses: {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: [{ resource: HIGH_RISK_CSSRS }],
          },
        },
      }),
    )
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.some((c) => c.indicator === 'critical')).toBe(true)
    // Live path never emits the curated narrative fallback.
    expect(cards.every((c) => !c.extension?.['spier-narrative-only'])).toBe(true)
  })

  // A foreign EHR's PHQ-9 QR: NOT under a SPiER canonical, foreign linkIds, but
  // standard LOINC per-item codes. Tier-2 recognition (the default policy here)
  // should still surface a card. q9 = 3 (LA6571-9) drives a suicide-risk alert.
  const FOREIGN_PHQ9: unknown = {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://epic.example.org/Questionnaire/phq9-internal',
    item: [
      ['44250-9', 'LA6570-1'], ['44255-8', 'LA6570-1'], ['44259-0', 'LA6569-3'],
      ['44254-1', 'LA6569-3'], ['44251-7', 'LA6568-5'], ['44258-2', 'LA6568-5'],
      ['44252-5', 'LA6568-5'], ['44253-3', 'LA6568-5'], ['44260-8', 'LA6571-9'],
    ].map(([code, answer], i) => ({
      linkId: `EPIC-${i + 1}`,
      code: [{ system: 'http://loinc.org', code }],
      answer: [{ valueCoding: { system: 'http://loinc.org', code: answer } }],
    })),
  }

  it('recognizes a foreign-canonical PHQ-9 via LOINC item codes (Tier 2) and emits a card', () => {
    const { cards } = buildPatientViewResponse(
      request({
        context: { patientId: 'ehr-patient' },
        prefetch: {
          questionnaireResponses: {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: [{ resource: FOREIGN_PHQ9 }],
          },
        },
      }),
    )
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.some((c) => c.indicator === 'critical' || c.indicator === 'warning')).toBe(true)
  })
})
