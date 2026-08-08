import { describe, it, expect } from 'vitest'
import {
  buildLethalMeansCounseling,
  buildMeansSafetyAction,
  isLethalMeansCounseling,
  meansSafetyActionCode,
  meansSafetyActions,
  meansSafetyMethod,
  COUNSELING_PROFILE,
  COUNSELING_TEXT,
  LETHAL_MEANS_METHOD_SYSTEM,
  MEANS_SAFETY_ACTION_PROFILE,
  MEANS_SAFETY_ACTION_SYSTEM,
} from './lethalMeans'
import { stageForArtifact } from './patientPathway'
import type { ObservationResource } from '../types/fhir'

describe('lethal means counseling Procedure (TL-008)', () => {
  const counseling = buildLethalMeansCounseling({
    id: 'counseling-1',
    patientId: 'patient-005',
    performed: '2026-07-15T16:30:00.000Z',
    note: 'Patient and spouse present.',
  })

  it('is a completed Procedure staged to Document Safety Actions', () => {
    expect(counseling.resourceType).toBe('Procedure')
    // The profile fixes status to completed: counseling that has not happened
    // is a task, not a Procedure.
    expect(counseling.status).toBe('completed')
    expect(counseling.subject).toEqual({ reference: 'Patient/patient-005' })
    expect(counseling.performedDateTime).toBe('2026-07-15T16:30:00.000Z')
    expect(stageForArtifact(counseling)).toBe('document-safety-actions')
  })

  it('claims the profile the Stage-8 measure matches on', () => {
    expect((counseling.meta as { profile?: string[] }).profile).toEqual([COUNSELING_PROFILE])
    expect(isLethalMeansCounseling(counseling)).toBe(true)
  })

  it('carries the general SNOMED counseling code with clarifying text', () => {
    // SNOMED has no means-safety-counseling concept, so the specificity lives
    // in code.text rather than in a code SPiER would have had to invent.
    const code = counseling.code as { coding?: { system?: string; code?: string }[]; text?: string }
    expect(code.coding?.[0]).toEqual({
      system: 'http://snomed.info/sct',
      code: '409063005',
      display: 'Counseling',
    })
    expect(code.text).toBe(COUNSELING_TEXT)
  })

  it('lets a site name its own protocol in code.text', () => {
    const other = buildLethalMeansCounseling({
      id: 'c2',
      patientId: 'p',
      performed: '2026-07-15T16:30:00.000Z',
      text: 'Means safety counseling — local protocol',
    })
    expect((other.code as { text?: string }).text).toBe('Means safety counseling — local protocol')
  })

  it('omits note entirely when none was given', () => {
    const bare = buildLethalMeansCounseling({
      id: 'c3',
      patientId: 'p',
      performed: '2026-07-15T16:30:00.000Z',
    })
    expect(bare.note).toBeUndefined()
  })
})

describe('means safety action Observation (TL-008)', () => {
  const secured = buildMeansSafetyAction({
    id: 'action-1',
    patientId: 'patient-005',
    effective: '2026-07-15T16:30:00.000Z',
    method: 'firearm',
    action: 'transferred-to-other-party',
    completed: true,
    note: "Patient's brother; stored off-site until follow-up.",
  })

  it('codes the MEANS in code and the ACTION in the value', () => {
    // The axis split is the design: one Observation per means, so "firearm →
    // transferred" is queryable instead of buried in narrative.
    const code = secured.code as { coding?: { system?: string; code?: string; display?: string }[] }
    expect(code.coding?.[0]).toEqual({
      system: LETHAL_MEANS_METHOD_SYSTEM,
      code: 'firearm',
      display: 'Firearm',
    })
    expect(secured.valueCodeableConcept?.coding?.[0]).toEqual({
      system: MEANS_SAFETY_ACTION_SYSTEM,
      code: 'transferred-to-other-party',
      display: 'Transferred to a trusted party',
    })
    expect((secured.meta as { profile?: string[] }).profile).toEqual([MEANS_SAFETY_ACTION_PROFILE])
    expect(stageForArtifact(secured)).toBe('document-safety-actions')
  })

  it('distinguishes a secured means (final) from an agreed one (preliminary)', () => {
    // Not cosmetic: "agreed to lock the medications" and "medications locked"
    // are different facts, and only the second is a secured means.
    expect(secured.status).toBe('final')
    const agreed = buildMeansSafetyAction({
      id: 'action-2',
      patientId: 'patient-005',
      effective: '2026-07-15T16:30:00.000Z',
      method: 'medication',
      action: 'locked-and-secured',
      completed: false,
    })
    expect(agreed.status).toBe('preliminary')
  })

  it('is categorised procedure, not survey — it is not instrument output', () => {
    const category = secured.category as { coding?: { system?: string; code?: string }[] }[]
    expect(category[0].coding?.[0]).toEqual({
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'procedure',
    })
  })
})

describe('reading means safety actions off a chart', () => {
  const first = buildMeansSafetyAction({
    id: 'a1',
    patientId: 'p',
    effective: '2026-07-01T10:00:00.000Z',
    method: 'medication',
    action: 'locked-and-secured',
    completed: true,
  })
  const later = buildMeansSafetyAction({
    id: 'a2',
    patientId: 'p',
    effective: '2026-07-15T10:00:00.000Z',
    method: 'firearm',
    action: 'safely-disposed',
    completed: true,
  })
  const unrelated: ObservationResource = {
    resourceType: 'Observation',
    id: 'phq9',
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '44261-6' }] },
  }

  it('picks out actions by their method CodeSystem, most recent first', () => {
    // Matched on the code system rather than meta.profile so an action written
    // by another system — which is unlikely to populate meta.profile — is not
    // silently dropped.
    const found = meansSafetyActions([first, unrelated, later])
    expect(found.map(o => o.id)).toEqual(['a2', 'a1'])
  })

  it('reads back the method and action codes', () => {
    expect(meansSafetyMethod(later)).toBe('firearm')
    expect(meansSafetyActionCode(later)).toBe('safely-disposed')
    expect(meansSafetyMethod(unrelated)).toBeUndefined()
    expect(meansSafetyActionCode(unrelated)).toBeUndefined()
  })
})
