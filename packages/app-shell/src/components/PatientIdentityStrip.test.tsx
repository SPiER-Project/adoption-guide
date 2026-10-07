/**
 * @vitest-environment jsdom
 *
 * The identity strip shows the level the caseload shows, for the same chart.
 *
 * ⚠️ Written against the defect it replaced: the strip ranked the instruments'
 * alerts while the caseload read the harmonized tier, so on real demo charts the
 * header said "No suicide-risk screening on file" for patients the caseload
 * listed at imminent risk (013, 014) and High for patients at moderate (001,
 * 006). Every case renders a real scenario slice and compares the pill with the
 * caseload row's own answer, so the two can only agree by sharing the rule.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { POPULATION_PATIENTS as DEMO_PATIENTS, POPULATION_SCENARIOS } from '@spier/demo-population'
import { deriveRegistryRow } from '@spier/core/lib/registry'
import type { PatientSlice } from '@spier/core/types/fhir'
import { RISK_LABEL } from '../lib/riskLabel'
import { PatientIdentityStrip } from './PatientIdentityStrip'

let slice: PatientSlice = { responses: [], observations: [], carePlans: [], riskAlerts: [] }

// Stubbed rather than provided: PatientProvider drags in the tool-config, SMART
// and data-source providers, and none of them are what this asserts.
vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    patientDisplay: { fullName: 'Test Patient', dob: '1990-01-01', mrn: '1', gender: 'female' },
    ...slice,
    communications: slice.communications ?? [],
    procedures: slice.procedures ?? [],
    episodes: slice.episodes ?? [],
  }),
}))

afterEach(cleanup)

function pillFor(s: PatientSlice): HTMLElement {
  slice = s
  render(<PatientIdentityStrip />)
  return screen.getByTitle(/suicide-risk/i)
}

describe('PatientIdentityStrip — the caseload’s level, for every demo chart', () => {
  it.each(['patient-001', 'patient-006', 'patient-013', 'patient-014'])(
    '%s — one of the charts the two used to disagree on',
    id => {
      const patient = DEMO_PATIENTS.find(p => p.id === id)!
      const row = deriveRegistryRow(patient, POPULATION_SCENARIOS[id], new Date())
      expect(pillFor(POPULATION_SCENARIOS[id]).textContent).toBe(RISK_LABEL[row.currentRiskLevel])
    },
  )

  it('shows imminent risk, not "no screening", for an acute ASQ with no alert cached', () => {
    expect(POPULATION_SCENARIOS['patient-013'].riskAlerts).toEqual([])
    const pill = pillFor(POPULATION_SCENARIOS['patient-013'])
    expect(pill.textContent).toBe('Acute')
    expect(pill.title).toBe('Current suicide-risk level: Acute')
  })

  it('says "no screening on file" — not "none" — for a chart with nothing on it', () => {
    const pill = pillFor({ responses: [], observations: [], carePlans: [], riskAlerts: [] })
    expect(pill.textContent).toBe('Unknown')
    expect(pill.title).toMatch(/no suicide-risk screening/i)
  })
})
