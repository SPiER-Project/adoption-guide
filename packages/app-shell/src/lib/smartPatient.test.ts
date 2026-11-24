import { describe, expect, it } from 'vitest'
import type { SmartClient } from '@spier/core/types/smartClient'
import { MRN_SYSTEM } from '@spier/core/lib/fhircast'
import { readSmartPatientSummary } from './smartPatient'

/** A client whose Patient read resolves to `body`. */
function clientReading(body: unknown, id: string | null = 'p1'): SmartClient {
  return {
    request: () => Promise.reject(new Error('not used')),
    patient: { id, read: () => Promise.resolve(body) },
    state: { serverUrl: 'https://ehr.test/fhir' },
  }
}

describe('readSmartPatientSummary', () => {
  it('summarises a Patient, preferring the SPiER MRN', async () => {
    const summary = await readSmartPatientSummary(
      clientReading({
        resourceType: 'Patient',
        id: 'p1',
        name: [{ given: ['Maria', 'L'], family: 'Alvarez' }],
        birthDate: '1990-01-02',
        gender: 'female',
        identifier: [{ system: 'urn:other', value: 'X9' }, { system: MRN_SYSTEM, value: '11011' }],
      }),
    )
    expect(summary).toEqual({ id: 'p1', name: 'Maria L Alvarez', dob: '1990-01-02', gender: 'female', mrn: '11011' })
  })

  it('reads nothing when the launch carried no patient', async () => {
    expect(await readSmartPatientSummary(clientReading({ resourceType: 'Patient' }, null))).toEqual({})
  })

  // The client types the body `unknown`; these are the bodies that are not a Patient.
  it.each([
    ['an OperationOutcome', { resourceType: 'OperationOutcome', issue: [] }],
    ['a string', 'Not Found'],
    ['null', null],
  ])('keeps the launch id and names nobody when the body is %s', async (_label, body) => {
    expect(await readSmartPatientSummary(clientReading(body))).toEqual({ id: 'p1', name: 'Unknown Name' })
  })
})
