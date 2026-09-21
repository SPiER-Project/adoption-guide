import { describe, expect, it } from 'vitest'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { evaluatePathway, type PathwayRecord } from './pathwayEvaluation'
import { RISK_TIER_SYSTEM } from './riskEpisode'
import { CRISIS_RESOURCES_PROFILE } from './crisisResources'
import type {
  CarePlanResource,
  CommunicationResource,
  ObservationResource,
  QuestionnaireResponseResource,
} from '../types/fhir'

/**
 * Every case here is a DEMO FIXTURE, not an invented chart. The audit's §4.5
 * table is a claim about what the published pathway says for real records, and
 * a hand-built slice can be shaped to agree with whatever the evaluator happens
 * to do. Where a case needs an artifact the fixture does not have — Sarah's
 * later C-SSRS, which was written into the live demo rather than into the
 * scenario — it is added to her real slice rather than replacing it.
 */
const NOW = new Date('2026-09-21T12:00:00.000Z')

function recordFor(id: string): PathwayRecord {
  const s = POPULATION_SCENARIOS[id]
  if (!s) throw new Error(`no demo scenario ${id} — this test would check nothing`)
  return {
    responses: s.responses,
    observations: s.observations,
    carePlans: s.carePlans,
    communications: s.communications ?? [],
    procedures: s.procedures ?? [],
    episodes: s.episodes ?? [],
    riskAlerts: s.riskAlerts,
  }
}

const evaluate = (record: PathwayRecord) => evaluatePathway(record, { now: NOW })

/* ─── The artifacts a demo write would add ──────────────────── */

const CSSRS_SCREENER_URL = 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener'

/** A C-SSRS Screener administration, as submitting the form records one. */
function cssrsScreener(at: string, tier: 'moderate' | 'no-risk') {
  const response: QuestionnaireResponseResource = {
    resourceType: 'QuestionnaireResponse',
    id: `cssrs-${tier}`,
    status: 'completed',
    questionnaire: CSSRS_SCREENER_URL,
    authored: at,
    subject: { reference: 'Patient/patient-003' },
    item: [],
  } as unknown as QuestionnaireResponseResource
  // The result the mapper derives: LOINC 93374-7 valued in the C-SSRS's OWN
  // vocabulary, which is what makes the published crosswalk load-bearing — an
  // evaluator that read only `spier-suicide-risk-tier` would see no tier here.
  const observation: ObservationResource = {
    resourceType: 'Observation',
    id: `cssrs-risk-${tier}`,
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
    effectiveDateTime: at,
    derivedFrom: [{ reference: `QuestionnaireResponse/cssrs-${tier}` }],
    valueCodeableConcept: {
      coding: [
        {
          system: 'http://thespierproject.org/fhir/CodeSystem/cssrs-risk-level',
          code: tier === 'moderate' ? 'moderate' : 'none',
        },
      ],
    },
  } as unknown as ObservationResource
  return {
    stored: { id: `cssrs-${tier}`, questionnaireName: 'C-SSRS Screener', completedAt: at, resource: response },
    observation,
  }
}

function safetyPlan(at: string): CarePlanResource {
  return {
    resourceType: 'CarePlan',
    id: 'sb-plan',
    meta: {
      profile: ['http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan'],
    },
    status: 'active',
    intent: 'plan',
    created: at,
    subject: { reference: 'Patient/patient-003' },
  } as unknown as CarePlanResource
}

function crisisResources(at: string): CommunicationResource {
  return {
    resourceType: 'Communication',
    id: 'crisis',
    meta: { profile: [CRISIS_RESOURCES_PROFILE] },
    status: 'completed',
    sent: at,
    subject: { reference: 'Patient/patient-003' },
  } as unknown as CommunicationResource
}

/** Sarah's real slice plus the C-SSRS the live demo wrote onto her chart. */
function sarahPlusCssrs(tier: 'moderate' | 'no-risk', extra: Partial<PathwayRecord> = {}): PathwayRecord {
  const base = recordFor('patient-003')
  const { stored, observation } = cssrsScreener('2026-09-03T10:00:00.000Z', tier)
  return {
    ...base,
    responses: [...(base.responses ?? []), stored],
    observations: [...(base.observations ?? []), observation],
    ...extra,
  }
}

/* ─── The table, row by row ─────────────────────────────────── */

describe('audit §4.5 — the first unsatisfied step of the published pathway', () => {
  it('Marcus Chen (patient-002), nothing on file → screen', () => {
    const { primary, alsoDue } = evaluate(recordFor('patient-002'))
    expect(primary?.kind).toBe('screen')
    expect(primary?.reason).toBe('No suicide-risk screen on file.')
    // The PHQ-9 is the pathway's own demonstrated realization of the screen —
    // read off `definitionCanonical`, not chosen here.
    expect(primary?.tool?.id).toBe('TL-002')
    expect(alsoDue).toEqual([])
  })

  it('Sarah Patel (patient-003), positive PHQ-9 and nothing after it → assess', () => {
    const { primary, alsoDue } = evaluate(recordFor('patient-003'))
    expect(primary?.kind).toBe('assess')
    expect(primary?.tool?.id).toBe('TL-003')
    // The trigger in the clinician's words, not a CodeSystem definition.
    expect(primary?.reason).toBe('PHQ-9 on Aug 11: positive screen.')
    expect(alsoDue).toEqual([])
  })

  it('Sarah plus a later moderate C-SSRS → safety plan primary, and NO C-SSRS card', () => {
    // §1.4: the alert that suggested the C-SSRS is satisfied by the C-SSRS, and
    // §1.5: the obligation the protocol actually states outranks everything else.
    const { primary, alsoDue, tier } = evaluate(sarahPlusCssrs('moderate'))
    expect(tier?.code).toBe('moderate')
    expect(primary?.kind).toBe('safety-plan')
    expect(primary?.tool?.id).toBe('TL-007')
    expect(primary?.reason).toBe('C-SSRS Screener on Sep 3: moderate risk.')
    expect(alsoDue.map(o => o.kind)).toEqual(['crisis-resources', 'reassess'])
    // Nothing anywhere in the evaluation still asks for the assessment.
    expect([primary, ...alsoDue].some(o => o?.kind === 'assess')).toBe(false)
  })

  it('…and the safety plan retires once one is recorded after the assessment', () => {
    const { primary, alsoDue } = evaluate(
      sarahPlusCssrs('moderate', { carePlans: [safetyPlan('2026-09-03T11:00:00.000Z')] }),
    )
    expect(primary?.kind).toBe('crisis-resources')
    expect(alsoDue.map(o => o.kind)).toEqual(['reassess'])
  })

  it('…and with crisis resources too, the cadence is all that is left', () => {
    const { primary } = evaluate(
      sarahPlusCssrs('moderate', {
        carePlans: [safetyPlan('2026-09-03T11:00:00.000Z')],
        communications: [crisisResources('2026-09-03T11:30:00.000Z')],
      }),
    )
    // Moderate reassesses every 14 days (the published schedule); Sep 3 + 14 is
    // Sep 17, and "now" is Sep 21.
    expect(primary?.kind).toBe('reassess')
    expect(primary?.title).toBe('Reassess suicide risk')
    expect(primary?.tool?.id).toBe('TL-003')
  })

  it('a negative C-SSRS → nothing is due, and the patient does not enter the pathway', () => {
    const { primary, alsoDue, tier, reason } = evaluate(sarahPlusCssrs('no-risk'))
    expect(tier?.code).toBe('no-risk')
    expect(primary).toBeNull()
    expect(alsoDue).toEqual([])
    expect(reason).toContain('Nothing is due')
    expect(reason).toContain('re-screen')
  })

  it('Maria Alvarez (patient-011), high risk with a safety plan and means counseling on file', () => {
    const { primary, alsoDue, tier, reassessment } = evaluate(recordFor('patient-011'))
    expect(tier?.code).toBe('high')
    // Her safety plan (Aug 2, 15:10) and her means-safety counseling (14:40)
    // both postdate the assessment that put her at high risk, so neither is
    // re-recommended. Her chart holds no crisis-resources Communication at all,
    // which is the one high-tier obligation still outstanding.
    expect([primary, ...alsoDue].map(o => o?.kind)).not.toContain('safety-plan')
    expect([primary, ...alsoDue].map(o => o?.kind)).not.toContain('stat-safety-evaluation')
    expect(primary?.kind).toBe('crisis-resources')
    expect(alsoDue.map(o => o.kind)).toEqual(['direct-question', 'reassess'])
    // High reassesses every 7 days from Aug 2; by Sep 21 that is long overdue.
    expect(reassessment?.kind).toBe('scheduled')
    expect(reassessment).toMatchObject({ status: 'overdue' })
  })
})

describe('what a tier owes, and what retires it', () => {
  it('ranks the safety plan above crisis resources at moderate and high', () => {
    // Decision §7.2: the published pathway names no formulation step, so the
    // safety plan is primary. The artifact's own action ORDER puts crisis
    // resources first and FHIR does not make that a priority — which is why the
    // ranking is declared in the evaluator and asserted here.
    const { primary } = evaluate(sarahPlusCssrs('moderate'))
    expect(primary?.kind).toBe('safety-plan')
  })

  it('never makes the standing "ask at every contact" obligation the primary', () => {
    // No record can retire it, so a card for it at the top of the chart would
    // sit there forever.
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      expect(evaluate(recordFor(id)).primary?.kind).not.toBe('direct-question')
    }
    // …and it IS produced somewhere, or this check is vacuous.
    const highTier = Object.keys(POPULATION_SCENARIOS)
      .map(id => evaluate(recordFor(id)))
      .flatMap(e => e.alsoDue.map(o => o.kind))
    expect(highTier).toContain('direct-question')
  })

  it('counts satisfaction from the start of the CURRENT tier run, not the latest reading', () => {
    // Maria's tier was confirmed high again at 19:30, after her 15:10 safety
    // plan. Counting from the latest reading would re-recommend a safety plan
    // she already has.
    const { primary, alsoDue } = evaluate(recordFor('patient-011'))
    expect([primary, ...alsoDue].map(o => o?.kind)).not.toContain('safety-plan')
  })

  it('reads the tier through the PUBLISHED crosswalk, never an instrument-native result', () => {
    // A C-SSRS records `cssrs-risk-level#moderate` on LOINC 93374-7; the tier
    // comes from ConceptMap/CSSRSRiskLevelToRiskTier.
    expect(evaluate(sarahPlusCssrs('moderate')).tier?.code).toBe('moderate')
  })

  it('falls back to the open episode’s cached tier when no Observation carries one', () => {
    // patient-007 has a moderate tier only on the episode extension.
    expect(evaluate(recordFor('patient-007')).tier?.code).toBe('moderate')
  })

  it('treats imminent as carrying at least the high group’s obligations', () => {
    const record = sarahPlusCssrs('moderate')
    const imminent: ObservationResource = {
      resourceType: 'Observation',
      id: 'imminent',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '93374-7' }] },
      effectiveDateTime: '2026-09-10T10:00:00.000Z',
      valueCodeableConcept: { coding: [{ system: RISK_TIER_SYSTEM, code: 'imminent' }] },
    } as unknown as ObservationResource
    const { primary, alsoDue, tier, reassessment } = evaluate({
      ...record,
      observations: [...(record.observations ?? []), imminent],
    })
    expect(tier?.code).toBe('imminent')
    expect(primary?.kind).toBe('safety-plan')
    expect(primary?.urgency).toBe('urgent')
    expect(alsoDue.map(o => o.kind)).toContain('stat-safety-evaluation')
    // No published cadence for imminent, so no reassessment obligation.
    expect(reassessment?.kind).toBe('no-cadence')
    expect(alsoDue.map(o => o.kind)).not.toContain('reassess')
  })

  it('reads a CAMS chart through the CAMS crosswalk', () => {
    // ⚠️ **This case read `tier: null` until the CAMS mapper was fixed.** Her
    // SSF overall-risk rating sat on LOINC 93374-7 as a bare integer, so
    // `ConceptMap/CAMSOverallRiskToRiskTier` — published, and translating
    // codes — had nothing to translate, and a documented CAMS patient's chart
    // could state no tier at all.
    const { primary, alsoDue, tier } = evaluate(recordFor('patient-006'))
    expect(tier?.code).toBe('moderate')
    expect(primary?.kind).toBe('safety-plan')
    expect(primary?.reason).toBe('CAMS SSF-5 on Aug 6: moderate risk.')
    expect(alsoDue.map(o => o.kind)).toEqual(['crisis-resources', 'reassess'])
  })

  it('says so when an assessment records no risk level, rather than "no risk"', () => {
    // The branch still matters and no demo patient reaches it any more, so the
    // case is built: an assessment on file whose result carries no tier at all
    // is NOT a negative assessment, and printing "no risk identified" about
    // one would be a clinical claim nobody made.
    const base = recordFor('patient-006')
    const untiered = (base.observations ?? []).map(o =>
      o.id === 'p006-cams-risk' ? { ...o, valueCodeableConcept: undefined, valueInteger: 3 } : o,
    )
    const { primary, reason, tier } = evaluate({ ...base, observations: untiered })
    expect(tier).toBeNull()
    expect(primary).toBeNull()
    expect(reason).toContain('records no suicide-risk level')
    expect(reason).not.toContain('no risk identified')
  })
})

describe('no product default ever recommends', () => {
  /**
   * §7.2 / §4.5. `PATHWAY_STAGE_DEFAULTS` fills the five stages the published
   * pathway is silent on — SAFE-T, the handoff, the episode, the dashboard.
   * They are still what a stage page OFFERS; they may never be what the chart
   * RECOMMENDS.
   */
  const DEFAULTED = ['TL-006', 'TL-009', 'TL-010', 'TL-038', 'TL-043']

  it('never offers one as an obligation’s launch, for any demo patient', () => {
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      const { primary, alsoDue } = evaluate(recordFor(id))
      for (const obligation of [primary, ...alsoDue]) {
        if (!obligation?.tool) continue
        expect(DEFAULTED, `${id} recommends ${obligation.tool.id}`).not.toContain(obligation.tool.id)
      }
    }
  })

  it('every obligation it does produce traces to a published pathway action', () => {
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      const { primary, alsoDue } = evaluate(recordFor(id))
      for (const obligation of [primary, ...alsoDue]) {
        if (!obligation) continue
        expect(obligation.actionId, `${id}: obligation with no action id`).toBeTruthy()
        expect(obligation.stageId, `${id}: obligation with no stage`).toBeTruthy()
      }
    }
  })
})

describe('the caseload reads the same evaluation the chart does', () => {
  // `deriveRegistryRow` runs `evaluatePathway` once per row and takes the
  // primary's headline and the tier off the one result — asserted there, in
  // registry.test.ts, against the real demo slices. What belongs here is the
  // shape that makes that possible.
  it('carries a tier and a primary a row can render without re-deriving either', () => {
    const { primary, reason, tier } = evaluate(sarahPlusCssrs('moderate'))
    expect(tier?.code).toBe('moderate')
    expect(primary?.title).toBeTruthy()
    expect(reason).toBe(primary?.reason)
  })

  it('has no primary when nothing is due', () => {
    expect(evaluate(sarahPlusCssrs('no-risk')).primary).toBeNull()
  })
})
