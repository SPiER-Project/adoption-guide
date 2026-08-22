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
  questionnaire: 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener',
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

  it('offers the measure dashboard on the measure-and-share stage', () => {
    // patient-010 is a resolved episode whose active stage is `measure-and-share`.
    //
    // This test used to assert the CURATED NARRATIVE FALLBACK here, because that
    // stage had no wired tool and the recommendation text surfaced instead. That
    // premise expired when TL-042/TL-043 gained launch actions pointing at the
    // measure dashboard: every one of the eight stages now has a wired tool, so
    // the fallback no longer fires for ANY bundled patient. Restoring the old
    // assertion would mean un-wiring the dashboard, which is strictly worse — an
    // actionable link beats narrative text with nowhere to go.
    //
    // The fallback itself is still reachable when a site disables a stage's tools
    // via tool configuration, and remains unit-tested against `buildCdsCards`
    // directly in web/src/lib/cdsHooks/cards.test.ts.
    const { cards } = buildPatientViewResponse(request({ context: { patientId: 'patient-010' } }))
    const stageCard = cards.find((c) => c.extension?.['spier-stage-id'] === 'measure-and-share')
    expect(stageCard).toBeDefined()
    expect(stageCard?.extension?.['spier-narrative-only']).toBeUndefined()
    expect(stageCard?.links?.some((l) => l.url.includes('/population/measures'))).toBe(true)
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

describe('SMART launch links (panel step 5)', () => {
  const LAUNCH = 'https://spier-adoption-guide.example/'

  /** Every link on every card, flattened. */
  function linksOf(cards: Array<{ links?: Array<{ type: string; url: string; appContext?: string }> }>) {
    return cards.flatMap(c => c.links ?? [])
  }

  it('emits deep links when no launch URL is supplied', () => {
    // The default has to stay `absolute`: a caller that does not know its own
    // public URL must still get cards a human can follow.
    const { cards } = buildPatientViewResponse(request({}))
    const links = linksOf(cards)
    expect(links.length).toBeGreaterThan(0)
    expect(links.every(l => l.type === 'absolute')).toBe(true)
  })

  it('emits SMART launches on the fallback (no-prefetch) path', () => {
    // This is the path the mock EHR's chart page actually takes — it sends
    // context only — so if the two paths were going to disagree, it would be
    // here that the demo broke.
    const { cards } = buildPatientViewResponse(request({}), { smartLaunchUrl: LAUNCH })
    const links = linksOf(cards)
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.type).toBe('smart')
      expect(link.url).toBe(LAUNCH)
      expect(typeof link.appContext).toBe('string')
      expect(JSON.parse(link.appContext!).intent).toMatch(/^open-/)
    }
  })

  it('emits SMART launches on the live (prefetch) path too', () => {
    const { cards } = buildPatientViewResponse(
      request({ prefetch: { questionnaireResponses: HIGH_RISK_CSSRS } }),
      { smartLaunchUrl: LAUNCH },
    )
    const links = linksOf(cards)
    expect(links.length).toBeGreaterThan(0)
    expect(links.every(l => l.type === 'smart')).toBe(true)
  })

  it('is ignored when the launch URL is an empty string', () => {
    // A misconfigured env var reaching the builder as '' must not produce SMART
    // links pointing at nothing — that would be a card whose button silently
    // launches the current page.
    const { cards } = buildPatientViewResponse(request({}), { smartLaunchUrl: '' })
    expect(linksOf(cards).every(l => l.type === 'absolute')).toBe(true)
  })
})
