import { describe, it, expect } from 'vitest'
import {
  buildPatientOpenEvent,
  parsePatientOpen,
  PATIENT_OPEN_EVENT,
  FHIRCAST_TOPIC,
} from './fhircast'

const TS = '2026-07-05T12:00:00.000Z'

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
