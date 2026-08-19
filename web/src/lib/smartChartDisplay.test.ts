/**
 * The two SMART-vs-local display divergences found by launching the deployed
 * mock EHR in a browser. Both were invisible to every existing test, because
 * nothing asserted what the patient banner and the artifact list actually
 * render — the mappers were right and the presentation was wrong.
 */
import { describe, expect, it } from 'vitest'
import { formatDateTime } from './chartDisplay'
import { formatPatientDisplay } from '../data/demoPatient'

describe('formatDateTime', () => {
  it('never renders "Invalid Date"', () => {
    // What was on screen for every QuestionnaireResponse read over SMART:
    // `toStoredResponse` falls back to '' when a QR carries no `authored`, and
    // not one scenario QR does. A real server need not send one either.
    for (const bad of ['', 'not-a-date', undefined as unknown as string]) {
      const out = formatDateTime(bad)
      expect(out, `formatDateTime(${JSON.stringify(bad)})`).not.toMatch(/Invalid Date/)
      expect(out).toBe('—')
    }
  })

  it('still formats a real instant', () => {
    expect(formatDateTime('2026-08-11T14:30:00.000Z')).not.toBe('—')
    expect(formatDateTime('2026-08-11T14:30:00.000Z')).not.toMatch(/Invalid Date/)
  })
})

describe('formatPatientDisplay — MRN', () => {
  it('uses the SMART summary’s mrn, not the resource id', () => {
    // The banner showed "MRN patient-011" for a patient whose MRN is 11011,
    // while the local data source showed the real number on the same chart.
    const display = formatPatientDisplay({
      name: 'Maria Alvarez',
      id: 'patient-011',
      mrn: '11011',
      dob: '1997-10-12',
      gender: 'female',
    })
    expect(display.mrn).toBe('11011')
  })

  it('falls back to the id only when there is no mrn at all', () => {
    const display = formatPatientDisplay({ name: 'Someone', id: 'patient-011' })
    expect(display.mrn).toBe('patient-011')
  })

  it('reads a raw FHIR Patient’s identifier as before', () => {
    const display = formatPatientDisplay({
      name: [{ given: ['Maria'], family: 'Alvarez' }],
      identifier: [{ value: '11011' }],
      birthDate: '1997-10-12',
    })
    expect(display.mrn).toBe('11011')
  })
})
