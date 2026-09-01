import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  KNOWN_TIER_CODES,
  PROBLEM_LIST_CARD_ID,
  buildProblemListGuidanceCard,
  latestRiskConceptTier,
} from '@spier/core/lib/cdsHooks/problemListCard'
import { PATHWAY_URL, loadPathway } from '@spier/core/lib/pathway'
import { RISK_TIER_SYSTEM } from '@spier/core/lib/riskEpisode'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import type { ObservationResource } from '@spier/core/types/fhir'

/** A harmonized concept Observation — LOINC 93374-7 valued on the tier system. */
function conceptObs(tier: string, effective: string, display?: string): ObservationResource {
  return {
    resourceType: 'Observation',
    id: `obs-${tier}-${effective}`,
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
    effectiveDateTime: effective,
    valueCodeableConcept: { coding: [{ system: RISK_TIER_SYSTEM, code: tier, display }] },
  } as ObservationResource
}

describe('tier vocabulary — drift against the published CodeSystem', () => {
  it('decides every concept in spier-suicide-risk-tier, and no others', () => {
    // The card's per-tier table is hand-written, so this is what keeps it from
    // going stale: a tier added in concept-layer.fsh has to gain a decision here
    // (emit at which indicator, or deliberately nothing) rather than silently
    // falling through to "no guidance owed" — which is a clinical claim nobody
    // made. Read from the generated artifact, not restated.
    const cs = JSON.parse(
      readFileSync(
        new URL(
          '../../../../fhir-artifacts/generated/CodeSystem-spier-suicide-risk-tier.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { concept?: Array<{ code: string }> }
    const published = (cs.concept ?? []).map(c => c.code)
    // Reading nothing must not pass: an empty CodeSystem would make the two
    // sets trivially comparable in the wrong direction.
    expect(published.length).toBeGreaterThan(0)
    expect([...KNOWN_TIER_CODES].sort()).toEqual([...published].sort())
  })
})

describe('latestRiskConceptTier', () => {
  it('takes the most recent tier, regardless of array order', () => {
    const tier = latestRiskConceptTier([
      conceptObs('moderate', '2026-08-01T10:00:00.000Z'),
      conceptObs('high', '2026-08-05T10:00:00.000Z'),
      conceptObs('low', '2026-07-01T10:00:00.000Z'),
    ])
    expect(tier?.code).toBe('high')
  })

  it('ignores a 93374-7 Observation whose value is an INSTRUMENT-NATIVE code', () => {
    // The deliberate narrowness. Most mappers put a native result on 93374-7
    // (asq-screening-result here); translating one into a harmonized tier is the
    // ConceptMaps' job, and a card that did it would be a second crosswalk.
    // Asserted against a real scenario slice rather than a hand-built shape, so
    // the test cannot certify the card against input the app never produces
    // (the #327 lesson).
    const p001 = POPULATION_SCENARIOS['patient-001']
    expect(p001).toBeDefined()
    const native = p001.observations.filter(o =>
      o.code?.coding?.some(c => c.code === '93374-7'),
    )
    expect(native.length).toBeGreaterThan(0)
    expect(latestRiskConceptTier(p001.observations)).toBeNull()
  })

  it('reads the tier off a real scenario slice that carries one', () => {
    const p009 = POPULATION_SCENARIOS['patient-009']
    expect(latestRiskConceptTier(p009.observations)?.code).toBe('high')
  })

  it('returns null for an empty slice', () => {
    expect(latestRiskConceptTier([])).toBeNull()
  })
})

describe('buildProblemListGuidanceCard — when it fires', () => {
  it('emits nothing without a harmonized tier on record', () => {
    expect(buildProblemListGuidanceCard([])).toBeNull()
  })

  it('emits nothing for a negative screen (no-risk)', () => {
    expect(buildProblemListGuidanceCard([conceptObs('no-risk', '2026-08-05T10:00:00.000Z')])).toBeNull()
  })

  it('emits for every positive tier, capped at warning', () => {
    // Tier drives the indicator, but a documentation prompt never claims
    // `critical` — that rung belongs to the cards carrying a clinical action.
    const at = '2026-08-05T10:00:00.000Z'
    expect(buildProblemListGuidanceCard([conceptObs('low', at)])?.indicator).toBe('info')
    expect(buildProblemListGuidanceCard([conceptObs('moderate', at)])?.indicator).toBe('warning')
    expect(buildProblemListGuidanceCard([conceptObs('high', at)])?.indicator).toBe('warning')
    expect(buildProblemListGuidanceCard([conceptObs('imminent', at)])?.indicator).toBe('warning')
  })

  it('follows the LATEST tier when it steps down to no-risk', () => {
    const cards = buildProblemListGuidanceCard([
      conceptObs('high', '2026-08-01T10:00:00.000Z'),
      conceptObs('no-risk', '2026-08-09T10:00:00.000Z'),
    ])
    expect(cards).toBeNull()
  })
})

describe('buildProblemListGuidanceCard — content comes from the artifact', () => {
  const card = buildProblemListGuidanceCard([
    conceptObs('high', '2026-08-05T10:00:00.000Z', 'High risk'),
  ])!

  it('cites the pathway PlanDefinition as its source', () => {
    expect(card).toBeDefined()
    expect(card.source.url).toBe(PATHWAY_URL)
    expect(card.source.label).toBe(loadPathway().title)
    expect(card.source.topic?.code).toBe('define-risk-picture')
    expect(card.extension?.['spier-card-id']).toBe(PROBLEM_LIST_CARD_ID)
    expect(card.extension?.['spier-stage-id']).toBe('define-risk-picture')
  })

  it('names the tier and stays inside the 140-char summary cap', () => {
    expect(card.summary).toContain('High risk')
    expect(card.summary.length).toBeLessThanOrEqual(140)
  })

  it('carries the verified SNOMED CT concepts the pathway names', () => {
    // Not literals this file chose: the FSH's problem-list action names them,
    // and both are members of the verified SPiERSuicideRelatedProblem value set
    // (suicide-related-conditions.fsh). Asserted here so a card that lost the
    // guidance text fails rather than prompting a coding decision with no codes.
    expect(card.detail).toContain('6471006') // Suicidal thoughts
    expect(card.detail).toContain('225444004') // At increased risk for suicide
    expect(card.detail).toContain('spier-suicide-related-problem-vs')
  })

  it('carries the CORRECTED ICD-10-CM crosswalk and never Z91.82', () => {
    // ⚠️ No gate checks ICD-10 literals — the nightly terminology check covers
    // LOINC/SNOMED/THO only — so this assertion and the verification record it
    // points at are the whole control. Z91.82 is *personal history of military
    // deployment*; the source diagram states it, and no SPiER card may show it.
    // docs/reference/suicide-safer-care-pathway-spec.md §"ICD-10 correction
    // (Phase 1d)".
    expect(card.detail).toContain('R45.851')
    expect(card.detail).toContain('Z91.51')
    expect(card.detail).toContain('Z91.52')
    expect(card.detail).not.toContain('Z91.82')
  })

  it('says, in the card itself, that SPiER does not create the Condition', () => {
    expect(card.detail).toContain('SPiER does not create the Condition')
  })
})

describe('buildProblemListGuidanceCard — it suggests, it never writes', () => {
  it('carries no suggestions and no links', () => {
    // Decision 5 of the pathway plan, asserted rather than trusted to review: a
    // CDS Hooks suggestion is an offer to apply a FHIR resource, and the only
    // resource this card could offer is a Condition derived from a screen.
    for (const tier of ['low', 'moderate', 'high', 'imminent']) {
      const card = buildProblemListGuidanceCard([conceptObs(tier, '2026-08-05T10:00:00.000Z')])!
      expect(card.suggestions).toBeUndefined()
      expect(card.selectionBehavior).toBeUndefined()
      expect(card.links).toBeUndefined()
    }
  })
})
