import { describe, expect, it } from 'vitest'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { nativeQr, type NativeAnswer } from './observationMappers/__fixtures__/nativeQr'
import { deriveFromResponse } from './deriveFromResponse'
import { evaluatePathway } from './pathwayEvaluation'
import { tierForCodings } from './conceptCrosswalk'
import { stageForArtifact, PATHWAY_STAGE_SYSTEM, type FhirResourceLike } from './patientPathway'
import { isRiskConcept, RISK_CONCEPT_PROFILE } from './riskConcept'
import {
  isPositiveScreenConcept,
  parsePositiveScreenRequirement,
  positiveScreenRequirement,
  CLARIFY_RISK_STAGE_URL,
  POSITIVE_SCREEN_ACTION_ID,
} from './positiveScreenTrigger'
import type { ObservationResource, QuestionnaireResponseResource } from '../types/fhir'

const V3_INTERPRETATION = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
const Q = 'http://thespierproject.org/fhir/Questionnaire/'

/**
 * A screen submitted through the app: the response built from the real
 * Questionnaire (`nativeQr`), stamped with the launching tool's stage the way
 * the form stamps it, and derived by the same call the app makes on save — so
 * the concept below is exactly what a submission writes, stage tag included.
 */
function submitted(questionnaire: string, answers: Record<string, NativeAnswer>, id: string) {
  const qr = {
    ...nativeQr(Q + questionnaire, answers),
    id,
    authored: '2026-09-20T10:00:00Z',
    subject: { reference: 'Patient/patient-003' },
    meta: { tag: [{ system: PATHWAY_STAGE_SYSTEM, code: 'identify-possible-risk' }] },
  } as QuestionnaireResponseResource
  const derived = deriveFromResponse(qr)
  if (!derived) throw new Error(`${questionnaire} derived nothing — this case would test nothing`)
  const concept = derived.observations.find(isRiskConcept)
  if (!concept) throw new Error(`${questionnaire} derived no risk concept — this case would test nothing`)
  return { qr, observations: derived.observations, concept }
}

/** The rule this module replaced, kept here only to prove the switch changed nothing on the corpus. */
function previousRule(o: ObservationResource, slice: Parameters<typeof stageForArtifact>[1]): boolean {
  if (!isRiskConcept(o) || stageForArtifact(o as FhirResourceLike, slice) !== 'identify-possible-risk') return false
  const tier = tierForCodings(o.valueCodeableConcept?.coding)
  return !!tier && tier !== 'no-risk'
}

describe('the published positive-screen trigger', () => {
  it('is read from the compiled Clarify Risk stage, as three code filters on the risk concept', () => {
    const req = positiveScreenRequirement()
    expect(req.type).toBe('Observation')
    expect(req.profiles).toEqual([RISK_CONCEPT_PROFILE])
    expect(req.codeFilters).toEqual([
      { path: 'code', codes: [{ system: 'http://loinc.org', code: '93374-7' }] },
      { path: 'interpretation', codes: [{ system: V3_INTERPRETATION, code: 'POS' }] },
      { path: 'meta.tag', codes: [{ system: PATHWAY_STAGE_SYSTEM, code: 'identify-possible-risk' }] },
    ])
  })

  it('throws rather than reading nothing, or reading a filter it would not apply', () => {
    type RawStage = Parameters<typeof parsePositiveScreenRequirement>[0]
    const action = (data: unknown) =>
      ({
        url: CLARIFY_RISK_STAGE_URL,
        action: [{ id: POSITIVE_SCREEN_ACTION_ID, trigger: [{ type: 'data-added', data: [data] }] }],
      }) as RawStage
    const ok = { type: 'Observation', profile: [RISK_CONCEPT_PROFILE], codeFilter: [{ path: 'interpretation', code: [{ system: V3_INTERPRETATION, code: 'POS' }] }] }
    expect(() => parsePositiveScreenRequirement(action(ok))).not.toThrow()
    expect(() => parsePositiveScreenRequirement(undefined)).toThrow(/no compiled PlanDefinition/)
    expect(() => parsePositiveScreenRequirement({ url: CLARIFY_RISK_STAGE_URL, action: [] })).toThrow(/has no action/)
    // A valueSet filter narrows (or widens) the published gate; skipping it would make the app's gate disagree.
    expect(() =>
      parsePositiveScreenRequirement(action({ ...ok, codeFilter: [{ path: 'value', valueSet: 'http://x/vs' }] })),
    ).toThrow(/valueSet/)
    expect(() => parsePositiveScreenRequirement(action({ ...ok, dateFilter: [{}] }))).toThrow(/dateFilter/)
    expect(() => parsePositiveScreenRequirement(action({ ...ok, codeFilter: [] }))).toThrow(/match every concept/)
    expect(() => parsePositiveScreenRequirement(action({ ...ok, profile: [] }))).toThrow(/names no profile/)
  })
})

describe('a screen submitted through the app satisfies it exactly when it is positive', () => {
  // Screens with NO per-instrument trigger of their own on the stage — the
  // SBQ-R was positive in the app and in no published artifact before #629 —
  // beside the ASQ, which has one, as a control.
  it('SBQ-R at the general cutoff (7) is a positive screen; below it is not', () => {
    const at7 = submitted('SBQ-R', { q1: { code: '3a' }, q2: { code: '3' }, q3: { code: '1' }, q4: { code: '0' } }, 'sbqr-7')
    const at3 = submitted('SBQ-R', { q1: { code: '1' }, q2: { code: '1' }, q3: { code: '1' }, q4: { code: '0' } }, 'sbqr-3')
    expect(isPositiveScreenConcept(at7.concept)).toBe(true)
    expect(isPositiveScreenConcept(at3.concept)).toBe(false)
  })

  it('ASQ: one endorsed item is positive, none is not', () => {
    const pos = submitted('ASQ-Screening-Tool', { q1: true, q2: false, q3: false, q4: false, q5: false }, 'asq-pos')
    const neg = submitted('ASQ-Screening-Tool', { q1: false, q2: false, q3: false, q4: false, q5: false }, 'asq-neg')
    expect(isPositiveScreenConcept(pos.concept)).toBe(true)
    expect(isPositiveScreenConcept(neg.concept)).toBe(false)
  })

  it('a positive concept from a Clarify Risk assessment is not a positive SCREEN', () => {
    const { concept } = submitted('SBQ-R', { q1: { code: '3a' }, q2: { code: '3' }, q3: { code: '1' }, q4: { code: '0' } }, 'sbqr-clarify')
    const asAssessment = {
      ...concept,
      meta: { ...concept.meta, tag: [{ system: PATHWAY_STAGE_SYSTEM, code: 'clarify-risk' }] },
    }
    expect(isPositiveScreenConcept(asAssessment)).toBe(false)
  })

  it('and the evaluator starts Clarify Risk on a positive SBQ-R alone', () => {
    const { qr, observations } = submitted('SBQ-R', { q1: { code: '3a' }, q2: { code: '3' }, q3: { code: '1' }, q4: { code: '0' } }, 'sbqr-only')
    const result = evaluatePathway(
      {
        responses: [{ id: qr.id!, questionnaireName: 'SBQ-R', completedAt: qr.authored!, resource: qr }],
        observations,
        carePlans: [],
        communications: [],
        procedures: [],
        episodes: [],
        riskAlerts: [],
      },
      { now: new Date('2026-09-21T12:00:00Z') },
    )
    expect(result.primary?.kind).toBe('assess')
    expect(result.primary?.reason).toMatch(/positive screen/)
  })
})

describe('the published trigger agrees with the rule it replaced, over every demo patient', () => {
  it('for every risk concept in the demo population', () => {
    let concepts = 0
    let positives = 0
    for (const [id, s] of Object.entries(POPULATION_SCENARIOS)) {
      const slice = { responses: s.responses, observations: s.observations }
      for (const o of s.observations ?? []) {
        if (!isRiskConcept(o)) continue
        concepts++
        const expected = previousRule(o, slice)
        if (expected) positives++
        expect(isPositiveScreenConcept(o), `${id} ${o.id}`).toBe(expected)
      }
    }
    // Floors, not counts: a corpus that stopped carrying concepts would pass vacuously.
    expect(concepts).toBeGreaterThanOrEqual(10)
    expect(positives).toBeGreaterThanOrEqual(5)
  })
})
