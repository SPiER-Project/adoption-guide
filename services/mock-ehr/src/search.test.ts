/**
 * Search semantics. Every case here is one where a lenient mock returns
 * something plausible and wrong.
 */
import { describe, expect, it } from 'vitest'
import { HELD_RESOURCES } from './fixtures'
import { applySearch, belongsToPatient, matchesToken, parseSearch } from './search'

const ALL = HELD_RESOURCES.map(h => h.resource)

describe('belongsToPatient', () => {
  it('reads the element each type actually uses, not just subject', () => {
    // Matching only `subject` would return zero of these four.
    expect(applySearch(ALL, 'EpisodeOfCare', { patientId: 'patient-011' }).length).toBeGreaterThan(0)
    expect(applySearch(ALL, 'Task', { patientId: 'patient-011' }).length).toBeGreaterThan(0)
    expect(applySearch(ALL, 'Appointment', { patientId: 'patient-011' }).length).toBeGreaterThan(0)
    expect(applySearch(ALL, 'Consent', { patientId: 'patient-011' }).length).toBeGreaterThan(0)
  })

  it('does not leak one patient’s resources into another’s search', () => {
    for (const type of ['QuestionnaireResponse', 'Observation', 'Encounter']) {
      const mine = applySearch(ALL, type, { patientId: 'patient-011' })
      expect(mine.length).toBeGreaterThan(0)
      for (const r of mine) expect(belongsToPatient(r, 'patient-001')).toBe(false)
    }
  })

  it('accepts the reference spellings a client may write', () => {
    const base = { resourceType: 'Observation' }
    expect(belongsToPatient({ ...base, subject: { reference: 'Patient/patient-011' } }, 'patient-011')).toBe(true)
    expect(belongsToPatient({ ...base, subject: { reference: 'https://ehr.test/fhir/Patient/patient-011' } }, 'patient-011')).toBe(true)
    expect(belongsToPatient({ ...base, subject: { reference: 'Patient/patient-012' } }, 'patient-011')).toBe(false)
    // A Group or Location subject must not match a patient id.
    expect(belongsToPatient({ ...base, subject: { reference: 'Group/patient-011' } }, 'patient-011')).toBe(false)
  })
})

describe('matchesToken', () => {
  const category = [
    { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey' }] },
    { coding: [{ system: 'http://thespierproject.org/fhir/CodeSystem/spier-concept-domain', code: 'suicide-risk' }] },
  ]

  it('matches bare code, system|code and |code', () => {
    expect(matchesToken(category, 'survey')).toBe(true)
    expect(matchesToken(category, 'http://terminology.hl7.org/CodeSystem/observation-category|survey')).toBe(true)
    expect(matchesToken(category, 'suicide-risk')).toBe(true)
    expect(matchesToken(category, 'procedure')).toBe(false)
    expect(matchesToken(category, 'http://example.org/wrong|survey')).toBe(false)
    expect(matchesToken(category, '|survey')).toBe(false) // has a system
    expect(matchesToken(undefined, 'survey')).toBe(false)
  })
})

describe('parseSearch', () => {
  it('requires patient', () => {
    const parsed = parseSearch(new URLSearchParams(''))
    expect(parsed.ok).toBe(false)
  })

  it('accepts patient, its subject alias, and a Patient/ prefix', () => {
    for (const qs of ['patient=patient-011', 'subject=patient-011', 'patient=Patient/patient-011']) {
      const parsed = parseSearch(new URLSearchParams(qs))
      expect(parsed.ok && parsed.query.patientId).toBe('patient-011')
    }
  })

  it('rejects a parameter it cannot honour rather than ignoring it', () => {
    // The whole point: a mock that ignores _count returns every resource for a
    // query that asked for two, and the caller cannot tell.
    for (const qs of ['patient=patient-011&_count=2', 'patient=patient-011&date=ge2026-01-01']) {
      const parsed = parseSearch(new URLSearchParams(qs))
      expect(parsed.ok).toBe(false)
      expect(parsed.ok === false && parsed.status).toBe(400)
    }
  })
})
