import { describe, it, expect } from 'vitest'
import {
  CARING_CONTACT_OPT_OUT_EXT,
  CRISIS_RESPONSE_PLAN_PROFILE,
  LETHAL_MEANS_PROFILE,
  MEASURE_SPECS,
  RISK_CONCEPT_PROFILE,
  SAFETY_HANDOFF_PROFILE,
  buildIndividualMeasureReport,
  buildSummaryMeasureReport,
  evaluateAllMeasures,
  evaluateMeasure,
  implementedCriteria,
  referencedCriteria,
  tallyAll,
  tallyMeasure,
  trailingPeriod,
} from '@spier/core/lib/measures'
import {
  APPOINTMENT_PROFILE,
  HANDOFF_CONTENT_ITEM_EXT,
  PACKET_PROFILE,
  REFERRAL_PROFILE,
} from '@spier/core/lib/handoffs'
import {
  buildCaringContact,
  CARING_CONTACT_PROFILE,
  OUTREACH_OUTCOME_EXT,
  OUTREACH_OUTCOME_SYSTEM,
} from '@spier/core/lib/followUp'
import { buildLethalMeansCounseling, buildMeansSafetyAction } from './lethalMeans'
import { CLOSURE_REASON_EXT, EPISODE_PROFILE } from '@spier/core/lib/riskEpisode'
import { PATHWAY_STAGE_SYSTEM } from '@spier/core/lib/patientPathway'
import type { PatientSlice } from '@spier/core/types/fhir'

// ─── Fixtures ────────────────────────────────────────────────
// July 2026 throughout, matching the IG examples: episode opens 07-02, the
// handoff (index event) is 07-20T15:00Z.

const PERIOD = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T23:59:59.000Z' }
const INDEX = '2026-07-20T15:00:00.000Z'

function emptySlice(): PatientSlice {
  return { responses: [], observations: [], carePlans: [], riskAlerts: [] }
}

function riskConcept(params: { id: string; effective: string; stage: string; tier?: string; positive?: boolean }) {
  return {
    resourceType: 'Observation' as const,
    id: params.id,
    status: 'final',
    meta: {
      profile: [RISK_CONCEPT_PROFILE],
      tag: [{ system: PATHWAY_STAGE_SYSTEM, code: params.stage }],
    },
    code: { coding: [{ system: 'http://loinc.org', code: '93374-7' }] },
    effectiveDateTime: params.effective,
    valueCodeableConcept: {
      coding: [
        { system: 'http://spier.org/CodeSystem/spier-suicide-risk-tier', code: params.tier ?? 'moderate' },
      ],
    },
    interpretation: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: params.positive === false ? 'NEG' : 'POS',
          },
        ],
      },
    ],
  }
}

function episode(params: { start: string; end?: string; closure?: string; status?: string }) {
  return {
    resourceType: 'EpisodeOfCare' as const,
    id: 'episode-1',
    status: params.status ?? 'active',
    meta: { profile: [EPISODE_PROFILE] },
    patient: { reference: 'Patient/patient-005' },
    period: { start: params.start, ...(params.end ? { end: params.end } : {}) },
    ...(params.closure
      ? {
          extension: [
            {
              url: CLOSURE_REASON_EXT,
              valueCodeableConcept: {
                coding: [
                  { system: 'http://spier.org/CodeSystem/spier-episode-closure-reason', code: params.closure },
                ],
              },
            },
          ],
        }
      : {}),
  }
}

function handoff(sent: string) {
  return {
    resourceType: 'Communication' as const,
    id: 'handoff-1',
    status: 'completed',
    meta: { profile: [SAFETY_HANDOFF_PROFILE] },
    subject: { reference: 'Patient/patient-005' },
    sent,
  }
}

function outreach(params: { id: string; sent: string; outcome?: string }) {
  return {
    resourceType: 'Communication' as const,
    id: params.id,
    status: 'completed',
    meta: { profile: ['http://spier.org/StructureDefinition/spier-outreach-attempt'] },
    subject: { reference: 'Patient/patient-005' },
    sent: params.sent,
    extension: [
      {
        url: OUTREACH_OUTCOME_EXT,
        valueCodeableConcept: {
          coding: [{ system: OUTREACH_OUTCOME_SYSTEM, code: params.outcome ?? 'patient-reached' }],
        },
      },
    ],
  }
}

function caringContact(params: { id: string; sent: string; optOut?: boolean }) {
  return {
    resourceType: 'Communication' as const,
    id: params.id,
    status: 'completed',
    meta: { profile: [CARING_CONTACT_PROFILE] },
    subject: { reference: 'Patient/patient-005' },
    sent: params.sent,
    ...(params.optOut === undefined
      ? {}
      : { extension: [{ url: CARING_CONTACT_OPT_OUT_EXT, valueBoolean: params.optOut }] }),
  }
}

function appointment(params: { id: string; start: string; status: string }) {
  return {
    resourceType: 'Appointment' as const,
    id: params.id,
    status: params.status,
    meta: { profile: [APPOINTMENT_PROFILE] },
    start: params.start,
    participant: [{ actor: { reference: 'Patient/patient-005' }, status: 'accepted' }],
  }
}

function referral(params: { id: string; authoredOn: string; status: string }) {
  return {
    resourceType: 'ServiceRequest' as const,
    id: params.id,
    status: params.status,
    intent: 'order',
    meta: { profile: [REFERRAL_PROFILE] },
    subject: { reference: 'Patient/patient-005' },
    authoredOn: params.authoredOn,
  }
}

function packet(params: { date: string; contentItems?: string[] }) {
  return {
    resourceType: 'DocumentReference' as const,
    id: 'packet-1',
    status: 'current',
    meta: { profile: [PACKET_PROFILE] },
    subject: { reference: 'Patient/patient-005' },
    date: params.date,
    content: [{ attachment: { title: 'packet' } }],
    extension: (params.contentItems ?? []).map(code => ({
      url: HANDOFF_CONTENT_ITEM_EXT,
      valueCodeableConcept: {
        coding: [{ system: 'http://spier.org/CodeSystem/spier-handoff-content', code }],
      },
    })),
  }
}

function specFor(idFragment: string) {
  const spec = MEASURE_SPECS.find(s => s.id.includes(idFragment))
  if (!spec) throw new Error(`no measure spec matching ${idFragment}`)
  return spec
}

function groupOf(evaluation: ReturnType<typeof evaluateMeasure>, code: string) {
  const g = evaluation.groups.find(x => x.code === code)
  if (!g) throw new Error(`no group ${code}`)
  return g
}

// ─── The FSH ↔ TS contract ───────────────────────────────────

describe('measure specs derived from the generated FHIR', () => {
  it('loads all eight measures and eleven groups', () => {
    // Eight since #296 added SPiERReassessmentOnTime. A bare count is a weak
    // assertion on its own, which is why check:measures ties every criterion
    // reference to an implementation in both directions.
    expect(MEASURE_SPECS).toHaveLength(8)
    expect(MEASURE_SPECS.flatMap(m => m.groups)).toHaveLength(11)
  })

  it('implements every criterion the Measures reference', () => {
    const missing = referencedCriteria().filter(c => !implementedCriteria().includes(c))
    expect(missing).toEqual([])
  })

  it('has no criterion implementation the Measures never reference', () => {
    const orphans = implementedCriteria().filter(c => !referencedCriteria().includes(c))
    expect(orphans).toEqual([])
  })

  it('gives every group a code from the SPiER measure-group CodeSystem', () => {
    for (const m of MEASURE_SPECS) {
      for (const g of m.groups) {
        expect(g.code).toMatch(/^[a-z0-9-]+$/)
        expect(g.code).not.toBe('unknown')
      }
    }
  })

  it('gives every group a denominator and a numerator criterion', () => {
    for (const m of MEASURE_SPECS) {
      for (const g of m.groups) {
        expect(Object.keys(g.criteria)).toContain('denominator')
        expect(Object.keys(g.criteria)).toContain('numerator')
      }
    }
  })
})

// ─── Measure 1: screen → assessment ──────────────────────────

describe('positive screen followed by assessment', () => {
  const spec = specFor('ScreenToAssessment')

  it('counts a positive screen clarified inside 24 hours', () => {
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 's1', effective: '2026-07-10T09:00:00.000Z', stage: 'identify-possible-risk' }),
      riskConcept({ id: 'a1', effective: '2026-07-10T15:00:00.000Z', stage: 'clarify-risk' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'screen-to-assessment')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(true)
  })

  it('misses when the assessment is later than 24 hours', () => {
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 's1', effective: '2026-07-10T09:00:00.000Z', stage: 'identify-possible-risk' }),
      riskConcept({ id: 'a1', effective: '2026-07-12T09:00:00.000Z', stage: 'clarify-risk' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'screen-to-assessment')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(false)
  })

  it('excludes a negative screen from the denominator', () => {
    const slice = emptySlice()
    slice.observations = [
      riskConcept({
        id: 's1',
        effective: '2026-07-10T09:00:00.000Z',
        stage: 'identify-possible-risk',
        tier: 'no-risk',
        positive: false,
      }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'screen-to-assessment')
    expect(g.populations['initial-population']).toBe(true)
    expect(g.inDenominator).toBe(false)
  })

  it('indexes on the MOST RECENT positive screen, not the first', () => {
    // First screen was clarified promptly; the later one never was. The
    // documented tie-break says the later screen is the index, so this misses.
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 's1', effective: '2026-07-05T09:00:00.000Z', stage: 'identify-possible-risk' }),
      riskConcept({ id: 'a1', effective: '2026-07-05T12:00:00.000Z', stage: 'clarify-risk' }),
      riskConcept({ id: 's2', effective: '2026-07-25T09:00:00.000Z', stage: 'identify-possible-risk' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'screen-to-assessment')
    expect(g.inNumerator).toBe(false)
  })

  it('ignores screens outside the measurement period', () => {
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 's1', effective: '2026-05-10T09:00:00.000Z', stage: 'identify-possible-risk' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'screen-to-assessment')
    expect(g.populations['initial-population']).toBe(false)
  })
})

// ─── Measure 2: risk level documented ────────────────────────

describe('current risk level documented', () => {
  const spec = specFor('RiskStatusDocumented')

  it('counts a risk Observation dated inside the episode', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.observations = [
      riskConcept({ id: 'r1', effective: '2026-07-06T09:00:00.000Z', stage: 'clarify-risk' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'risk-status-documented')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(true)
  })

  it('does NOT count the cached episode tier extension alone', () => {
    // The episode carries a current-risk-tier cache but there is no Observation.
    // Measuring the cache would measure the cache, not the care.
    const slice = emptySlice()
    slice.episodes = [
      {
        ...episode({ start: '2026-07-02' }),
        extension: [
          {
            url: 'http://spier.org/StructureDefinition/episode-current-risk-tier',
            valueCodeableConcept: {
              coding: [
                { system: 'http://spier.org/CodeSystem/spier-suicide-risk-tier', code: 'moderate' },
              ],
            },
          },
        ],
      },
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'risk-status-documented')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(false)
  })

  it('excludes an administratively closed episode', () => {
    const slice = emptySlice()
    slice.episodes = [
      episode({ start: '2026-07-02', end: '2026-07-03', status: 'finished', closure: 'administrative' }),
    ]
    slice.observations = [
      riskConcept({ id: 'r1', effective: '2026-07-02T09:00:00.000Z', stage: 'clarify-risk' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'risk-status-documented')
    expect(g.populations['denominator-exclusion']).toBe(true)
    expect(g.inDenominator).toBe(false)
    expect(g.inNumerator).toBe(false)
  })
})

// ─── Measure 3: safety plan before discharge ─────────────────

describe('safety plan before discharge', () => {
  const spec = specFor('SafetyPlanBeforeDischarge')

  function sliceWithTransition(): PatientSlice {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.communications = [handoff(INDEX)]
    return slice
  }

  it('counts a plan active before the transition', () => {
    const slice = sliceWithTransition()
    slice.carePlans = [
      {
        resourceType: 'CarePlan',
        id: 'plan-1',
        status: 'active',
        meta: { profile: [CRISIS_RESPONSE_PLAN_PROFILE] },
        period: { start: '2026-07-18' },
      },
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'safety-plan-completed')
    expect(g.inNumerator).toBe(true)
  })

  it('misses a plan created only after the transition', () => {
    const slice = sliceWithTransition()
    slice.carePlans = [
      {
        resourceType: 'CarePlan',
        id: 'plan-1',
        status: 'active',
        meta: { profile: [CRISIS_RESPONSE_PLAN_PROFILE] },
        period: { start: '2026-07-25' },
      },
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'safety-plan-completed')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(false)
  })

  it('drops out of the denominator entirely with no documented transition', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'safety-plan-completed')
    expect(g.inDenominator).toBe(false)
  })

  it('counts the patient copy only when the packet says safety-plan-copy', () => {
    const withCopy = sliceWithTransition()
    withCopy.documentReferences = [packet({ date: INDEX, contentItems: ['safety-plan-copy'] })]
    expect(
      groupOf(evaluateMeasure(spec, withCopy, PERIOD), 'patient-copy-documented').inNumerator,
    ).toBe(true)

    const without = sliceWithTransition()
    without.documentReferences = [packet({ date: INDEX, contentItems: ['crisis-resources'] })]
    expect(
      groupOf(evaluateMeasure(spec, without, PERIOD), 'patient-copy-documented').inNumerator,
    ).toBe(false)
  })
})

// ─── Measure 5: follow-up timeliness ─────────────────────────

describe('follow-up timeliness', () => {
  const spec = specFor('FollowUpTimeliness')

  function base(): PatientSlice {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.communications = [handoff(INDEX)]
    return slice
  }

  it('counts outreach inside 48 hours', () => {
    const slice = base()
    slice.communications = [...slice.communications!, outreach({ id: 'o1', sent: '2026-07-21T10:00:00.000Z' })]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'outreach-within-48-hours').inNumerator,
    ).toBe(true)
  })

  it('misses outreach after 48 hours', () => {
    const slice = base()
    slice.communications = [...slice.communications!, outreach({ id: 'o1', sent: '2026-07-27T16:30:00.000Z' })]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'outreach-within-48-hours').inNumerator,
    ).toBe(false)
  })

  it('counts an outreach ATTEMPT even when the patient was not reached', () => {
    const slice = base()
    slice.communications = [
      ...slice.communications!,
      outreach({ id: 'o1', sent: '2026-07-21T10:00:00.000Z', outcome: 'unable-to-reach' }),
    ]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'outreach-within-48-hours').inNumerator,
    ).toBe(true)
  })

  it('requires an ATTENDED visit — booked does not count', () => {
    const booked = base()
    booked.appointments = [appointment({ id: 'a1', start: '2026-07-24T14:00:00.000Z', status: 'booked' })]
    expect(groupOf(evaluateMeasure(spec, booked, PERIOD), 'follow-up-within-7-days').inNumerator).toBe(
      false,
    )

    const attended = base()
    attended.appointments = [
      appointment({ id: 'a1', start: '2026-07-24T14:00:00.000Z', status: 'fulfilled' }),
    ]
    expect(
      groupOf(evaluateMeasure(spec, attended, PERIOD), 'follow-up-within-7-days').inNumerator,
    ).toBe(true)
  })

  it('a no-show fails 7-day but a later attended visit still makes 30-day', () => {
    const slice = base()
    slice.appointments = [
      appointment({ id: 'a1', start: '2026-07-24T14:00:00.000Z', status: 'noshow' }),
      appointment({ id: 'a2', start: '2026-08-10T14:00:00.000Z', status: 'fulfilled' }),
    ]
    const ev = evaluateMeasure(spec, slice, PERIOD)
    expect(groupOf(ev, 'follow-up-within-7-days').inNumerator).toBe(false)
    expect(groupOf(ev, 'follow-up-within-30-days').inNumerator).toBe(true)
  })

  it('excludes an episode closed as deceased', () => {
    const slice = base()
    slice.episodes = [
      episode({ start: '2026-07-02', end: '2026-07-22', status: 'finished', closure: 'deceased' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'follow-up-within-7-days')
    expect(g.populations['denominator-exclusion']).toBe(true)
    expect(g.inDenominator).toBe(false)
  })

  it('indexes on the most recent transition when there are several', () => {
    const slice = base()
    // A second, later handoff moves the index — outreach near the FIRST one
    // then falls outside the 48h window.
    slice.communications = [
      handoff(INDEX),
      { ...handoff('2026-07-28T10:00:00.000Z'), id: 'handoff-2' },
      outreach({ id: 'o1', sent: '2026-07-21T10:00:00.000Z' }),
    ]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'outreach-within-48-hours').inNumerator,
    ).toBe(false)
  })
})

// ─── Measure 6: caring contact adherence ─────────────────────

describe('caring contact adherence', () => {
  const spec = specFor('CaringContactAdherence')

  function base(): PatientSlice {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.communications = [handoff(INDEX)]
    return slice
  }

  it('counts a caring contact inside 30 days', () => {
    const slice = base()
    slice.communications = [...slice.communications!, caringContact({ id: 'c1', sent: '2026-08-03T10:00:00.000Z' })]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'caring-contact-within-30-days')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(true)
  })

  it('EXCLUDES an opted-out patient rather than failing them', () => {
    const slice = base()
    slice.communications = [
      ...slice.communications!,
      caringContact({ id: 'c1', sent: '2026-07-21T10:00:00.000Z', optOut: true }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'caring-contact-within-30-days')
    expect(g.populations['denominator-exclusion']).toBe(true)
    expect(g.inDenominator).toBe(false)
    expect(g.inNumerator).toBe(false)
  })

  it('does not exclude when opt-out is explicitly false', () => {
    const slice = base()
    slice.communications = [
      ...slice.communications!,
      caringContact({ id: 'c1', sent: '2026-07-21T10:00:00.000Z', optOut: false }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'caring-contact-within-30-days')
    expect(g.populations['denominator-exclusion']).toBe(false)
    expect(g.inNumerator).toBe(true)
  })

  // The fixtures above are hand-built, so they prove the criterion but not that
  // anything in the app can produce a resource satisfying it. These two feed
  // the TL-010 recorder's actual output in — which is what issue #211 was
  // about: the exclusion was correct and unreachable at the same time.
  describe('against what the TL-010 recorder actually writes', () => {
    it('counts a recorded caring contact', () => {
      const slice = base()
      slice.communications = [
        ...slice.communications!,
        buildCaringContact({
          id: 'cc-1',
          patientId: 'patient-005',
          sent: '2026-08-03T10:00:00.000Z',
          channel: 'WRITTEN',
          optOut: false,
        }),
      ]
      expect(
        groupOf(evaluateMeasure(spec, slice, PERIOD), 'caring-contact-within-30-days').inNumerator,
      ).toBe(true)
    })

    it('excludes a patient the recorder marked as opted out', () => {
      const slice = base()
      slice.communications = [
        ...slice.communications!,
        buildCaringContact({
          id: 'cc-1',
          patientId: 'patient-005',
          sent: '2026-07-21T10:00:00.000Z',
          channel: 'WRITTEN',
          optOut: true,
        }),
      ]
      const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'caring-contact-within-30-days')
      expect(g.populations['denominator-exclusion']).toBe(true)
      expect(g.inDenominator).toBe(false)
    })
  })
})

// ─── Measure 7: referral loop closure ────────────────────────

describe('referral loop closure', () => {
  const spec = specFor('ReferralCompletion')

  it('counts a completed referral', () => {
    const slice = emptySlice()
    slice.serviceRequests = [referral({ id: 'r1', authoredOn: INDEX, status: 'completed' })]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'referral-completion')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(true)
  })

  it('fails an active referral — sent is not received', () => {
    const slice = emptySlice()
    slice.serviceRequests = [referral({ id: 'r1', authoredOn: INDEX, status: 'active' })]
    expect(groupOf(evaluateMeasure(spec, slice, PERIOD), 'referral-completion').inNumerator).toBe(false)
  })

  it('does NOT treat revoked as success', () => {
    const slice = emptySlice()
    slice.serviceRequests = [referral({ id: 'r1', authoredOn: INDEX, status: 'revoked' })]
    expect(groupOf(evaluateMeasure(spec, slice, PERIOD), 'referral-completion').inNumerator).toBe(false)
  })

  it('excludes a patient whose only referral is entered-in-error', () => {
    const slice = emptySlice()
    slice.serviceRequests = [referral({ id: 'r1', authoredOn: INDEX, status: 'entered-in-error' })]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'referral-completion')
    expect(g.populations['denominator-exclusion']).toBe(true)
    expect(g.inDenominator).toBe(false)
  })

  it('requires ALL referrals completed, not just one', () => {
    const slice = emptySlice()
    slice.serviceRequests = [
      referral({ id: 'r1', authoredOn: INDEX, status: 'completed' }),
      referral({ id: 'r2', authoredOn: INDEX, status: 'active' }),
    ]
    expect(groupOf(evaluateMeasure(spec, slice, PERIOD), 'referral-completion').inNumerator).toBe(false)
  })
})

// ─── Measure 4: lethal means counseling ───────────────────────

describe('lethal means counseling', () => {
  const spec = specFor('LethalMeansCounseling')

  it('counts a completed counseling Procedure inside the episode', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.procedures = [
      {
        resourceType: 'Procedure',
        id: 'proc-1',
        status: 'completed',
        meta: { profile: [LETHAL_MEANS_PROFILE] },
        subject: { reference: 'Patient/patient-005' },
        performedDateTime: '2026-07-05T10:00:00.000Z',
      },
    ]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling').inNumerator,
    ).toBe(true)
  })

  it('fails a patient in an episode with no counseling Procedure', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling')
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(false)
  })

  // ── The #324 exception ──
  // Two open episodes can carry no counseling without the ED having failed:
  // the patient went to a higher level of care (not yet due, and owed by the
  // receiving facility) or left before disposition (no opportunity).

  function encounterWith(disposition: string) {
    return {
      resourceType: 'Encounter' as const,
      id: 'enc-1',
      status: 'finished',
      subject: { reference: 'Patient/patient-005' },
      period: { start: '2026-07-02T08:00:00.000Z', end: '2026-07-03T09:00:00.000Z' },
      hospitalization: {
        dischargeDisposition: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/discharge-disposition',
              code: disposition,
            },
          ],
        },
      },
    }
  }

  it.each([
    ['psy', 'transferred to inpatient psychiatry — counseling not yet due'],
    ['aadvice', 'left against advice before disposition — no opportunity'],
  ])('excepts a patient discharged as %s (%s)', disposition => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.encounters = [encounterWith(disposition)]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling')
    expect(g.populations['denominator-exception']).toBe(true)
    expect(g.removedByException).toBe(true)
    expect(g.inDenominator).toBe(false)
    expect(g.inNumerator).toBe(false)
  })

  // THE reason #324 chose an exception over an exclusion. An exclusion removes
  // the case outright; an exception removes it only when the numerator is not
  // met, so counseling delivered before a transfer still counts as a pass
  // rather than disappearing from the measure.
  it('keeps a patient who WAS counseled before the transfer, and counts them', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.encounters = [encounterWith('psy')]
    slice.procedures = [
      buildLethalMeansCounseling({
        id: 'counseling-1',
        patientId: 'patient-005',
        performed: '2026-07-02T18:00:00.000Z',
      }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling')
    expect(g.populations['denominator-exception']).toBe(true)
    expect(g.removedByException).toBe(false)
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(true)
  })

  it('leaves an ordinary home discharge in the denominator', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.encounters = [encounterWith('home')]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling')
    expect(g.populations['denominator-exception']).toBe(false)
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(false)
  })

  it('subtracts exceptions from the scored denominator, but not passes', () => {
    const counseledThenTransferred = emptySlice()
    counseledThenTransferred.episodes = [episode({ start: '2026-07-02' })]
    counseledThenTransferred.encounters = [encounterWith('psy')]
    counseledThenTransferred.procedures = [
      buildLethalMeansCounseling({ id: 'c1', patientId: 'patient-005', performed: '2026-07-02T18:00:00.000Z' }),
    ]
    const transferredUncounseled = emptySlice()
    transferredUncounseled.episodes = [episode({ start: '2026-07-02' })]
    transferredUncounseled.encounters = [encounterWith('psy')]
    const plainMiss = emptySlice()
    plainMiss.episodes = [episode({ start: '2026-07-02' })]

    const tally = tallyMeasure(
      [counseledThenTransferred, transferredUncounseled, plainMiss].map(s =>
        evaluateMeasure(spec, s, PERIOD),
      ),
      spec,
    )
    const g = tally.groups[0]
    expect(g.denominator).toBe(3)
    // Only ONE case was removed: the transferred patient who was counseled is
    // still being scored. Counting the raw population flag would say 2 here and
    // the score would read 1/1 = 100%.
    expect(g.denominatorException).toBe(1)
    expect(g.numerator).toBe(1)
    expect(g.score).toBeCloseTo(1 / 2, 5)
  })

  // As with the caring contact above: the fixture proves the criterion, this
  // proves something in the app can satisfy it. Before the TL-008 recorder
  // landed (#210) nothing could, so this numerator was structurally
  // unreachable no matter what the demo data said.
  it('counts what the TL-008 recorder actually writes', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.procedures = [
      buildLethalMeansCounseling({
        id: 'counseling-1',
        patientId: 'patient-005',
        performed: '2026-07-05T10:00:00.000Z',
      }),
    ]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling').inNumerator,
    ).toBe(true)
  })

  // The counseling is the process measure; the per-means Observations are
  // richer detail a site reports separately. Securing a firearm without
  // recording that counseling happened must not score.
  it('does NOT count means-safety action Observations on their own', () => {
    const slice = emptySlice()
    slice.episodes = [episode({ start: '2026-07-02' })]
    slice.observations = [
      buildMeansSafetyAction({
        id: 'action-1',
        patientId: 'patient-005',
        effective: '2026-07-05T10:00:00.000Z',
        method: 'firearm',
        action: 'safely-disposed',
        completed: true,
      }),
    ]
    expect(
      groupOf(evaluateMeasure(spec, slice, PERIOD), 'lethal-means-counseling').inNumerator,
    ).toBe(false)
  })
})

// ─── Aggregation + report assembly ───────────────────────────

describe('tally and report assembly', () => {
  const spec = specFor('ReferralCompletion')

  function sliceWith(status: string, id: string): PatientSlice {
    const slice = emptySlice()
    slice.serviceRequests = [referral({ id, authoredOn: INDEX, status })]
    return slice
  }

  it('scores numerator / (denominator - exclusion)', () => {
    const evaluations = [
      evaluateMeasure(spec, sliceWith('completed', 'r1'), PERIOD),
      evaluateMeasure(spec, sliceWith('completed', 'r2'), PERIOD),
      evaluateMeasure(spec, sliceWith('active', 'r3'), PERIOD),
      evaluateMeasure(spec, sliceWith('entered-in-error', 'r4'), PERIOD),
    ]
    const tally = tallyMeasure(evaluations, spec)
    const g = tally.groups[0]
    expect(g.denominator).toBe(4)
    expect(g.denominatorExclusion).toBe(1)
    expect(g.numerator).toBe(2)
    // 2 / (4 - 1) — the exclusion is subtracted, not ignored.
    expect(g.score).toBeCloseTo(2 / 3, 5)
  })

  it('scores null rather than dividing by zero on an empty denominator', () => {
    const tally = tallyMeasure([evaluateMeasure(spec, emptySlice(), PERIOD)], spec)
    expect(tally.groups[0].denominator).toBe(0)
    expect(tally.groups[0].score).toBeNull()
  })

  it('builds an individual report carrying EVERY defined population', () => {
    const evaluation = evaluateMeasure(spec, sliceWith('completed', 'r1'), PERIOD)
    const report = buildIndividualMeasureReport(
      spec,
      evaluation,
      'patient-005',
      PERIOD,
      '2026-08-01T00:00:00.000Z',
    ) as unknown as {
      type: string
      measure: string
      group: Array<{ code: { coding: Array<{ code: string }> }; population: Array<{ code: { coding: Array<{ code: string }> } }> }>
    }
    expect(report.type).toBe('individual')
    expect(report.measure).toBe(spec.url)
    const populations = report.group[0].population.map(p => p.code.coding[0].code)
    // Matches the Measure's own population set — a report missing one cannot be
    // validated against its definition.
    expect(populations.sort()).toEqual(Object.keys(spec.groups[0].criteria).sort())
  })

  it('builds a summary report whose group codes match the measure', () => {
    const evaluations = [evaluateMeasure(spec, sliceWith('completed', 'r1'), PERIOD)]
    const tally = tallyMeasure(evaluations, spec)
    const report = buildSummaryMeasureReport(
      tally,
      spec,
      PERIOD,
      '2026-08-01T00:00:00.000Z',
      'Riverside Health',
    ) as unknown as {
      type: string
      reporter?: { display?: string }
      group: Array<{ code: { coding: Array<{ code: string }> } }>
    }
    expect(report.type).toBe('summary')
    expect(report.reporter?.display).toBe('Riverside Health')
    expect(report.group.map(g => g.code.coding[0].code)).toEqual(spec.groups.map(g => g.code))
  })

  it('evaluates and tallies every measure across a cohort without throwing', () => {
    const cohort = [emptySlice(), emptySlice()].map(s => evaluateAllMeasures(s, PERIOD))
    const tallies = tallyAll(cohort)
    expect(tallies).toHaveLength(8)
    expect(tallies.flatMap(t => t.groups)).toHaveLength(11)
  })
})

describe('trailingPeriod', () => {
  it('produces a window ending now', () => {
    const now = new Date('2026-07-31T00:00:00.000Z')
    const period = trailingPeriod(30, now)
    expect(period.end).toBe('2026-07-31T00:00:00.000Z')
    expect(period.start).toBe('2026-07-01T00:00:00.000Z')
  })
})

// ─── Measure 8 — reassessment on time ────────────────────────

describe('reassessment on time', () => {
  const spec = specFor('ReassessmentOnTime')
  const GROUP = 'reassessment-on-time'

  /** Two assessments `gapDays` apart, the earlier one at `tier`. */
  // NOTE: the period is July only, so both assessments must land inside it —
  // an earlier assessment that falls outside simply is not in the denominator,
  // which silently turns an interval test into an eligibility test.
  function pair(gapDays: number, tier: string, latest = '2026-07-29T09:00:00.000Z'): PatientSlice {
    const latestMs = Date.parse(latest)
    const earlier = new Date(latestMs - gapDays * 86400000).toISOString()
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 'a1', effective: earlier, stage: 'clarify-risk', tier }),
      riskConcept({ id: 'a2', effective: latest, stage: 'clarify-risk', tier }),
    ]
    return slice
  }

  it('excludes a patient with only one assessment — no gap exists yet', () => {
    // Not a late reassessment: a patient who has not been reassessed. Whether
    // they are currently OVERDUE is the work queue's question, not a measure's.
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 'a1', effective: '2026-07-10T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), GROUP)
    expect(g.inDenominator).toBe(false)
  })

  it('counts a high-risk gap of exactly 7 days as on time', () => {
    const g = groupOf(evaluateMeasure(spec, pair(7, 'high'), PERIOD), GROUP)
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(true)
  })

  it('counts a high-risk gap of 8 days as late', () => {
    const g = groupOf(evaluateMeasure(spec, pair(8, 'high'), PERIOD), GROUP)
    expect(g.inDenominator).toBe(true)
    expect(g.inNumerator).toBe(false)
  })

  it('uses the tier’s own interval, not one global window', () => {
    // 20 days is late for high (7) and moderate (14) but on time for low (30).
    expect(groupOf(evaluateMeasure(spec, pair(20, 'high'), PERIOD), GROUP).inNumerator).toBe(false)
    expect(groupOf(evaluateMeasure(spec, pair(20, 'moderate'), PERIOD), GROUP).inNumerator).toBe(false)
    expect(groupOf(evaluateMeasure(spec, pair(20, 'low'), PERIOD), GROUP).inNumerator).toBe(true)
  })

  it('reads the interval off the EARLIER assessment, not the patient’s tier today', () => {
    // Was low (30 days owed), stepped up to high. A 20-day gap met the 30 days
    // the site actually owed; judging it on today's high tier would fail a site
    // for care it delivered correctly.
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 'a1', effective: '2026-07-01T09:00:00.000Z', stage: 'clarify-risk', tier: 'low' }),
      riskConcept({ id: 'a2', effective: '2026-07-21T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), GROUP)
    expect(g.inNumerator).toBe(true)
  })

  it('excludes rather than fails a tier with no published cadence', () => {
    // imminent is escalated, not scheduled; scoring it as a miss would penalise
    // a site for correctly escalating.
    for (const tier of ['imminent', 'no-risk']) {
      const g = groupOf(evaluateMeasure(spec, pair(10, tier), PERIOD), GROUP)
      expect(g.populations['denominator-exclusion'], tier).toBe(true)
      expect(g.inDenominator, tier).toBe(false)
    }
  })

  it('excludes an administratively closed episode', () => {
    const slice = pair(21, 'high')
    slice.episodes = [
      episode({ start: '2026-07-01T00:00:00.000Z', end: '2026-07-25T00:00:00.000Z', status: 'finished', closure: 'administrative' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), GROUP)
    expect(g.inDenominator).toBe(false)
  })

  it('indexes on the most recent gap, not the worst one', () => {
    // A late gap early in the period followed by an on-time one scores as on
    // time — the measure reports current practice, not permanent history.
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 'a1', effective: '2026-07-01T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
      riskConcept({ id: 'a2', effective: '2026-07-14T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
      riskConcept({ id: 'a3', effective: '2026-07-19T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), GROUP)
    expect(g.inNumerator).toBe(true)
  })

  it('ignores assessments outside the measurement period', () => {
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 'old', effective: '2026-05-01T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
      riskConcept({ id: 'a1', effective: '2026-07-20T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
    ]
    // Only one assessment falls inside the period, so there is no measurable gap.
    expect(groupOf(evaluateMeasure(spec, slice, PERIOD), GROUP).inDenominator).toBe(false)
  })

  it('drops a pair recorded at the same instant rather than scoring it', () => {
    const slice = emptySlice()
    slice.observations = [
      riskConcept({ id: 'a1', effective: '2026-07-20T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
      riskConcept({ id: 'a2', effective: '2026-07-20T09:00:00.000Z', stage: 'clarify-risk', tier: 'high' }),
    ]
    const g = groupOf(evaluateMeasure(spec, slice, PERIOD), GROUP)
    // Two assessments exist, so the denominator criterion is met, but no
    // preceding assessment can be identified — so it cannot be called on time.
    expect(g.inNumerator).toBe(false)
  })
})
