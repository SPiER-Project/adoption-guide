/**
 * Synthetic patients placed ON the edges of every measure window — the cases
 * the 14 demo patients never land on, and so the cases where the CQL and the
 * TypeScript are free to disagree without anything noticing.
 *
 * Each patient states what the TypeScript engine is DESIGNED to answer for the
 * criteria it was built to probe (`expectTs`). The parity test asserts that
 * first, so a fixture that misses its boundary — an appointment a minute the
 * wrong side of the window, a tier the cadence does not know — fails as a
 * fixture instead of quietly agreeing on both engines. The CQL is then compared
 * against the TypeScript, not against `expectTs`.
 *
 * Resources come from the production builders wherever one exists, for the
 * reason tests/measures.test.ts gives: a hand-built resource proves a measure
 * reads a shape, not that anything writes it. The risk-concept Observation and
 * the CarePlan are hand-built because their builders derive them from a
 * QuestionnaireResponse, which is beside the point here.
 */
import { buildSafetyHandoff, buildFollowUpAppointment, buildDischargePacket } from '@spier/core/lib/handoffs'
import { buildCaringContact, buildOutreachAttempt } from '@spier/core/lib/followUp'
import { buildLethalMeansCounseling } from '@spier/core/lib/lethalMeans'
import { buildEpisode, RISK_TIER_SYSTEM } from '@spier/core/lib/riskEpisode'
import { PATHWAY_STAGE_SYSTEM } from '@spier/core/lib/patientPathway'
import { RISK_CONCEPT_LOINC, RISK_CONCEPT_PROFILE } from '@spier/core/lib/riskConcept'
import { STANLEY_BROWN_PROFILE, HANDOFF_CONTENT_SYSTEM } from '@spier/core/lib/measures'
import { HANDOFF_CONTENT_ITEM_EXT } from '@spier/core/lib/handoffs'
import type { FhirResource, PatientSlice } from '@spier/core/types/fhir'

/** Wide enough for every window below, which all open at T0. */
export const BOUNDARY_PERIOD = { start: '2026-07-01T00:00:00.000Z', end: '2026-09-30T23:59:59.000Z' }

/** The index event every window below is measured from. */
const T0 = Date.parse('2026-07-10T12:00:00.000Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function at(offsetMs: number): string {
  return new Date(T0 + offsetMs).toISOString()
}

export interface BoundaryPatient {
  id: string
  /** The edge this patient sits on. */
  why: string
  slice: PatientSlice
  /** criterion name → what the TypeScript engine is designed to answer. */
  expectTs: Record<string, boolean>
}

type Buckets = Partial<Record<Exclude<keyof PatientSlice, 'responses' | 'riskAlerts'>, FhirResource[]>>

function slice(buckets: Buckets): PatientSlice {
  return { responses: [], observations: [], carePlans: [], riskAlerts: [], ...buckets } as PatientSlice
}

function riskConcept(params: {
  id: string
  at: string
  stage?: 'identify-possible-risk' | 'clarify-risk' | 'track-risk-over-time'
  tier?: string
  /** `null` omits interpretation entirely. */
  interpretation?: 'POS' | 'NEG' | 'A' | null
  profiled?: boolean
  /** Where the stage is carried. The CQL reads only `meta.tag`. */
  stageIn?: 'tag' | 'category'
}): FhirResource {
  const stage = params.stage ?? 'track-risk-over-time'
  const stageCoding = { system: PATHWAY_STAGE_SYSTEM, code: stage }
  const interpretation = params.interpretation === undefined ? 'POS' : params.interpretation
  return {
    resourceType: 'Observation',
    id: params.id,
    status: 'final',
    meta: {
      ...(params.profiled === false ? {} : { profile: [RISK_CONCEPT_PROFILE] }),
      ...(params.stageIn === 'category' ? {} : { tag: [stageCoding] }),
    },
    ...(params.stageIn === 'category' ? { category: [{ coding: [stageCoding] }] } : {}),
    code: { coding: [{ system: 'http://loinc.org', code: RISK_CONCEPT_LOINC }] },
    effectiveDateTime: params.at,
    valueCodeableConcept: { coding: [{ system: RISK_TIER_SYSTEM, code: params.tier ?? 'moderate' }] },
    ...(interpretation === null
      ? {}
      : {
          interpretation: [
            {
              coding: [
                { system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: interpretation },
              ],
            },
          ],
        }),
  } as FhirResource
}

function episode(params: { start: string; end?: string }): FhirResource {
  const e = buildEpisode({ id: 'episode', patientId: null, entryReason: 'positive-screen', startDate: params.start })
  return { ...e, period: { start: params.start, ...(params.end ? { end: params.end } : {}) } } as FhirResource
}

const handoff = (sent: string) =>
  buildSafetyHandoff({ id: 'handoff', patientId: null, sent, contentCodes: ['current-risk-status'] }) as FhirResource
const appointment = (start: string) =>
  buildFollowUpAppointment({ id: 'appt', patientId: null, status: 'fulfilled', start }) as FhirResource
const outreach = (sent: string) =>
  buildOutreachAttempt({ id: 'outreach', patientId: null, sent, channel: 'PHONE', outcome: 'no-answer' }) as FhirResource
const caringContact = (sent: string) =>
  buildCaringContact({ id: 'caring', patientId: null, sent, channel: 'PHONE' }) as FhirResource

/** Everything a post-transition window needs: an episode and the index handoff at T0. */
const transitionAtT0 = (): Buckets => ({
  episodes: [episode({ start: at(-DAY) })],
  communications: [handoff(at(0))],
})

function followUpVisit(id: string, offset: number, within7: boolean, within30: boolean): BoundaryPatient {
  const b = transitionAtT0()
  return {
    id,
    why: `attended follow-up ${span(offset)} after the transition`,
    slice: slice({ ...b, appointments: [appointment(at(offset))] }),
    expectTs: { 'Follow Up Visit Within 7 Days': within7, 'Follow Up Visit Within 30 Days': within30 },
  }
}

function outreachAt(id: string, offset: number, within: boolean): BoundaryPatient {
  const b = transitionAtT0()
  return {
    id,
    why: `outreach attempt ${span(offset)} after the transition`,
    slice: slice({ ...b, communications: [...(b.communications ?? []), outreach(at(offset))] }),
    expectTs: { 'Outreach Within 48 Hours Of Transition': within },
  }
}

function caringAt(id: string, offset: number, within: boolean): BoundaryPatient {
  const b = transitionAtT0()
  return {
    id,
    why: `caring contact ${span(offset)} after the transition`,
    slice: slice({ ...b, communications: [...(b.communications ?? []), caringContact(at(offset))] }),
    expectTs: { 'Caring Contact Within 30 Days': within },
  }
}

function assessedAt(id: string, offset: number, within: boolean): BoundaryPatient {
  return {
    id,
    why: `assessment ${span(offset)} after a positive screen`,
    slice: slice({
      observations: [
        riskConcept({ id: 'screen', at: at(0), stage: 'identify-possible-risk' }),
        riskConcept({ id: 'assessment', at: at(offset), stage: 'clarify-risk' }),
      ],
    }),
    expectTs: { 'Positive Screen Assessed Within 24 Hours': within },
  }
}

function reassessedAfter(id: string, tier: string, offset: number, onTime: boolean): BoundaryPatient {
  return {
    id,
    why: `${tier}-tier patient reassessed ${span(offset)} later`,
    slice: slice({
      observations: [
        riskConcept({ id: 'first', at: at(0), tier }),
        riskConcept({ id: 'second', at: at(offset), tier }),
      ],
    }),
    expectTs: { 'Has A Reassessment Interval': true, 'Most Recent Reassessment Was On Time': onTime },
  }
}

function span(ms: number): string {
  const parts: string[] = []
  let rest = ms
  for (const [unit, size] of [['d', DAY], ['h', HOUR], ['min', MINUTE]] as const) {
    const n = Math.floor(rest / size)
    if (n) parts.push(`${n}${unit}`)
    rest -= n * size
  }
  return parts.join(' ') || '0'
}

export const BOUNDARY_PATIENTS: BoundaryPatient[] = [
  // ── Measure 5: the 7- and 30-day follow-up windows ──
  followUpVisit('bp-fu-6d', 6 * DAY, true, true),
  followUpVisit('bp-fu-7d', 7 * DAY, true, true),
  followUpVisit('bp-fu-7d-1min', 7 * DAY + MINUTE, false, true),
  followUpVisit('bp-fu-8d', 8 * DAY, false, true),
  followUpVisit('bp-fu-30d', 30 * DAY, false, true),
  followUpVisit('bp-fu-31d', 31 * DAY, false, false),

  // ── Measure 5: the 48-hour outreach window ──
  outreachAt('bp-outreach-47h', 47 * HOUR, true),
  outreachAt('bp-outreach-48h', 48 * HOUR, true),
  outreachAt('bp-outreach-49h', 49 * HOUR, false),

  // ── Measure 6: the 30-day caring-contact window ──
  caringAt('bp-caring-30d', 30 * DAY, true),
  caringAt('bp-caring-31d', 31 * DAY, false),

  // ── Measure 1: the 24-hour assessment window ──
  assessedAt('bp-assess-23h', 23 * HOUR, true),
  assessedAt('bp-assess-24h', 24 * HOUR, true),
  assessedAt('bp-assess-25h', 25 * HOUR, false),

  // ── Measure 8: each published cadence, one day either side ──
  reassessedAfter('bp-reassess-high-6d', 'high', 6 * DAY, true),
  reassessedAfter('bp-reassess-high-7d', 'high', 7 * DAY, true),
  reassessedAfter('bp-reassess-high-8d', 'high', 8 * DAY, false),
  reassessedAfter('bp-reassess-moderate-13d', 'moderate', 13 * DAY, true),
  reassessedAfter('bp-reassess-moderate-14d', 'moderate', 14 * DAY, true),
  reassessedAfter('bp-reassess-moderate-15d', 'moderate', 15 * DAY, false),
  reassessedAfter('bp-reassess-low-29d', 'low', 29 * DAY, true),
  reassessedAfter('bp-reassess-low-30d', 'low', 30 * DAY, true),
  reassessedAfter('bp-reassess-low-31d', 'low', 31 * DAY, false),
  // An hour past the cadence: late by elapsed time, on time by whole days.
  reassessedAfter('bp-reassess-high-7d-1h', 'high', 7 * DAY + HOUR, false),
  // No published cadence for imminent risk: excluded, never late. The only
  // patient in either cohort who reaches that exclusion.
  {
    ...reassessedAfter('bp-reassess-imminent', 'imminent', 3 * DAY, false),
    why: 'imminent-tier patient reassessed 3d later — a tier with no cadence',
    expectTs: {
      'Has A Reassessment Interval': true,
      'Reassessment Not On A Published Cadence': true,
      'Most Recent Reassessment Was On Time': false,
    },
  },

  // ── Shapes the two engines read differently, one per patient ──
  {
    id: 'bp-positive-by-tier-only',
    why: 'screen with a non-zero tier and no interpretation',
    slice: slice({
      observations: [riskConcept({ id: 'screen', at: at(0), stage: 'identify-possible-risk', interpretation: null })],
    }),
    expectTs: { 'Has A Suicide Risk Screen': true, 'Has A Positive Screen': true },
  },
  {
    id: 'bp-positive-by-abnormal',
    why: "screen interpreted 'A' (abnormal) rather than 'POS'",
    slice: slice({
      observations: [riskConcept({ id: 'screen', at: at(0), stage: 'identify-possible-risk', interpretation: 'A' })],
    }),
    expectTs: { 'Has A Suicide Risk Screen': true, 'Has A Positive Screen': true },
  },
  {
    id: 'bp-stage-in-category',
    why: 'screen whose pathway stage is a category, not a meta.tag',
    slice: slice({
      observations: [riskConcept({ id: 'screen', at: at(0), stage: 'identify-possible-risk', stageIn: 'category' })],
    }),
    expectTs: { 'Has A Suicide Risk Screen': true },
  },
  {
    id: 'bp-unprofiled-concept',
    why: 'risk-level Observation with the LOINC code and a tier but no profile claim',
    slice: slice({
      episodes: [episode({ start: at(-DAY), end: at(10 * DAY) })],
      observations: [riskConcept({ id: 'concept', at: at(0), profiled: false })],
    }),
    expectTs: { 'Risk Tier Documented During Episode': true },
  },
  {
    id: 'bp-concept-in-open-episode',
    why: 'profiled risk concept inside an episode with no end date',
    slice: slice({
      episodes: [episode({ start: at(-DAY) })],
      observations: [riskConcept({ id: 'concept', at: at(0) })],
    }),
    expectTs: { 'Has An Active Suicide Safer Care Episode': true, 'Risk Tier Documented During Episode': true },
  },
  {
    id: 'bp-plan-created-no-period',
    why: 'safety plan dated by `created` only, before the transition',
    slice: slice({
      ...transitionAtT0(),
      carePlans: [
        {
          resourceType: 'CarePlan',
          id: 'plan',
          status: 'active',
          intent: 'plan',
          meta: { profile: [STANLEY_BROWN_PROFILE] },
          created: at(-HOUR),
        } as FhirResource,
      ] as PatientSlice['carePlans'],
    }),
    expectTs: { 'Safety Plan In Place Before Transition': true },
  },
  {
    id: 'bp-plan-period-start',
    why: 'safety plan with a period.start before the transition — the shape both engines read',
    slice: slice({
      ...transitionAtT0(),
      carePlans: [
        {
          resourceType: 'CarePlan',
          id: 'plan',
          status: 'active',
          intent: 'plan',
          meta: { profile: [STANLEY_BROWN_PROFILE] },
          period: { start: at(-HOUR) },
        } as FhirResource,
      ] as PatientSlice['carePlans'],
    }),
    expectTs: { 'Safety Plan In Place Before Transition': true },
  },
  {
    id: 'bp-packet-copy-second-coding',
    why: 'packet whose safety-plan-copy content item is the SECOND coding of its concept',
    slice: slice({
      episodes: [episode({ start: at(-DAY) })],
      documentReferences: [
        (() => {
          const p = buildDischargePacket({ id: 'packet', patientId: null, date: at(0), title: 'Discharge safety packet', contentCodes: [] }) as FhirResource & {
            extension?: unknown[]
          }
          p.extension = [
            ...(p.extension ?? []),
            {
              url: HANDOFF_CONTENT_ITEM_EXT,
              valueCodeableConcept: {
                coding: [
                  { system: 'http://example.org/local-handoff-content', code: 'SP-COPY' },
                  { system: HANDOFF_CONTENT_SYSTEM, code: 'safety-plan-copy' },
                ],
              },
            },
          ]
          return p
        })(),
      ],
    }),
    expectTs: { 'Has A Documented Care Transition': true, 'Patient Copy Of Safety Plan Documented': true },
  },
  {
    id: 'bp-disposition-local-system',
    why: "encounter discharged 'psy' under a local code system, not HL7 discharge-disposition",
    slice: slice({
      episodes: [episode({ start: at(-DAY) })],
      encounters: [
        {
          resourceType: 'Encounter',
          id: 'ed',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER' },
          period: { start: at(-2 * HOUR), end: at(2 * HOUR) },
          hospitalization: { dischargeDisposition: { coding: [{ system: 'http://example.org/local-dispo', code: 'psy' }] } },
        } as FhirResource,
      ] as PatientSlice['encounters'],
    }),
    expectTs: { 'Transferred Or Left Before Means Counseling': false },
  },
  {
    id: 'bp-counseling-period-overruns-episode',
    why: 'counseling performedPeriod that starts inside the episode and ends after it closes',
    slice: slice({
      episodes: [episode({ start: at(-DAY), end: at(2 * DAY) })],
      procedures: [
        {
          ...buildLethalMeansCounseling({ id: 'calm', patientId: null, performed: at(DAY) }),
          performedDateTime: undefined,
          performedPeriod: { start: at(DAY), end: at(3 * DAY) },
        } as FhirResource,
      ] as PatientSlice['procedures'],
    }),
    expectTs: { 'Lethal Means Counseling During Episode': true },
  },
]
