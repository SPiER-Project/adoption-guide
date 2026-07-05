import { describe, it, expect } from 'vitest'
import {
  buildPatientOpenEvent,
  parsePatientOpen,
  markFollowing,
  consumeFollowing,
  shouldPublishOnActivation,
  FOLLOW_WINDOW_MS,
  PATIENT_OPEN_EVENT,
  FHIRCAST_TOPIC,
} from './fhircast'

const TS = '2026-07-05T12:00:00.000Z'
const NOW = 1_700_000_000_000

describe('buildPatientOpenEvent', () => {
  it('emits a FHIRcast STU3 patient-open notification with the patient in context', () => {
    const evt = buildPatientOpenEvent(
      { patientId: 'patient-005', mrn: '56789', displayName: 'Elena Rodriguez' },
      TS,
    )
    expect(evt.timestamp).toBe(TS)
    expect(evt.id).toBeTruthy()
    expect(evt.event['hub.event']).toBe(PATIENT_OPEN_EVENT)
    expect(evt.event['hub.topic']).toBe(FHIRCAST_TOPIC)

    const ctx = evt.event.context[0]
    expect(ctx.key).toBe('patient')
    expect(ctx.resource).toMatchObject({
      resourceType: 'Patient',
      id: 'patient-005',
      identifier: [{ system: 'http://hospital.example.org/mrn', value: '56789' }],
      name: [{ given: ['Elena'], family: 'Rodriguez' }],
    })
  })

  it('omits identifier and name when not provided', () => {
    const evt = buildPatientOpenEvent({ patientId: 'patient-009' }, TS)
    const resource = evt.event.context[0].resource!
    expect(resource).toEqual({ resourceType: 'Patient', id: 'patient-009' })
  })
})

describe('parsePatientOpen', () => {
  it('round-trips a built event back to its payload', () => {
    const payload = { patientId: 'patient-005', mrn: '56789', displayName: 'Elena Rodriguez' }
    const parsed = parsePatientOpen(buildPatientOpenEvent(payload, TS))
    expect(parsed).toEqual(payload)
  })

  it('ignores non-patient-open events', () => {
    const evt = buildPatientOpenEvent({ patientId: 'patient-005' }, TS)
    evt.event['hub.event'] = 'patient-close'
    expect(parsePatientOpen(evt)).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parsePatientOpen(null)).toBeNull()
    expect(parsePatientOpen('nope')).toBeNull()
    expect(parsePatientOpen({ event: {} })).toBeNull()
    expect(
      parsePatientOpen({
        event: { 'hub.event': PATIENT_OPEN_EVENT, context: [{ key: 'imagingstudy' }] },
      }),
    ).toBeNull()
  })

  it('resolves a patient with no identifier/name to just the id', () => {
    const parsed = parsePatientOpen(buildPatientOpenEvent({ patientId: 'patient-009' }, TS))
    expect(parsed).toEqual({ patientId: 'patient-009', mrn: undefined, displayName: undefined })
  })
})

describe('follow marker (echo suppression)', () => {
  it('consumes a fresh mark for the same patient exactly once', () => {
    markFollowing('patient-001', NOW)
    // First consume within the window returns true (this was a follow)...
    expect(consumeFollowing('patient-001', NOW)).toBe(true)
    // ...and clears it, so a second activation of the same patient is genuine.
    expect(consumeFollowing('patient-001', NOW)).toBe(false)
  })

  it('ignores (and preserves) a mark for a different patient', () => {
    markFollowing('patient-002', NOW)
    expect(consumeFollowing('patient-003', NOW)).toBe(false)
    // The unrelated mark survives for its own patient.
    expect(consumeFollowing('patient-002', NOW)).toBe(true)
  })

  it('treats a stale mark as not-a-follow but still clears it', () => {
    markFollowing('patient-004', NOW)
    const late = NOW + FOLLOW_WINDOW_MS + 1
    expect(consumeFollowing('patient-004', late)).toBe(false)
    // Cleared even though stale — a subsequent genuine selection publishes.
    expect(consumeFollowing('patient-004', NOW)).toBe(false)
  })

  it('returns false when there is no outstanding mark', () => {
    expect(consumeFollowing('patient-005', NOW)).toBe(false)
  })
})

describe('shouldPublishOnActivation', () => {
  const base = { isSmartConnected: false, lastPublishedId: null, now: NOW }

  it('publishes on a genuine user activation', () => {
    expect(shouldPublishOnActivation({ ...base, activePatientId: 'patient-005' })).toBe(true)
  })

  it('does NOT publish an activation caused by an incoming follow', () => {
    markFollowing('patient-006', NOW)
    expect(shouldPublishOnActivation({ ...base, activePatientId: 'patient-006' })).toBe(false)
    // The mark is consumed, so a later genuine re-selection publishes.
    expect(shouldPublishOnActivation({ ...base, activePatientId: 'patient-006' })).toBe(true)
  })

  it('does NOT publish under a live SMART session (and leaves any mark intact)', () => {
    markFollowing('patient-007', NOW)
    expect(
      shouldPublishOnActivation({ ...base, isSmartConnected: true, activePatientId: 'patient-007' }),
    ).toBe(false)
    // The SMART short-circuit must not have consumed the follow mark.
    expect(consumeFollowing('patient-007', NOW)).toBe(true)
  })

  it('does NOT publish the blank state', () => {
    expect(shouldPublishOnActivation({ ...base, activePatientId: null })).toBe(false)
  })

  it('does NOT re-publish a patient already broadcast by this tab', () => {
    expect(
      shouldPublishOnActivation({ ...base, activePatientId: 'patient-008', lastPublishedId: 'patient-008' }),
    ).toBe(false)
  })
})
