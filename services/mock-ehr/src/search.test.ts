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

/**
 * The roster (#401) — the ONE unscoped search, and the rules that keep it one.
 *
 * ⚠️ The negative case is the important one. `Patient` is in `SEARCHABLE_TYPES`
 * but deliberately absent from `PATIENT_LINK`, so before the roster branch
 * existed a scoped `GET /fhir/Patient?patient=…` fell through to the patient-link
 * match, found no link, and returned an **empty 200 Bundle** — which this
 * module's own header calls the one thing worse than a refusal, because it is
 * indistinguishable from a patient who does not exist.
 */
describe('the roster search', () => {
  it('is unscoped when the type is Patient', () => {
    const parsed = parseSearch(new URLSearchParams(), { type: 'Patient' })
    expect(parsed.ok).toBe(true)
    expect(parsed.ok && parsed.query.allPatients).toBe(true)
    expect(parsed.ok && parsed.query.patientId).toBeUndefined()
  })

  it('REFUSES a scoped roster search rather than returning an empty Bundle', () => {
    const parsed = parseSearch(new URLSearchParams({ patient: 'patient-011' }), { type: 'Patient' })
    expect(parsed.ok).toBe(false)
    expect(!parsed.ok && parsed.status).toBe(400)
    expect(!parsed.ok && parsed.diagnostics).toContain('takes no \'patient\' parameter')
  })

  it('still requires a patient for every clinical type', () => {
    for (const type of ['Observation', 'QuestionnaireResponse', 'CarePlan']) {
      const parsed = parseSearch(new URLSearchParams(), { type })
      expect(parsed.ok, type).toBe(false)
    }
  })

  it('applySearch returns every resource of the type ONLY on the explicit flag', () => {
    const resources = [
      { resourceType: 'Patient', id: 'patient-001' },
      { resourceType: 'Patient', id: 'patient-002' },
      { resourceType: 'Observation', id: 'o1', subject: { reference: 'Patient/patient-001' } },
    ]
    expect(applySearch(resources, 'Patient', { allPatients: true })).toHaveLength(2)
    // ⚠️ A missing `patientId` must NOT read as "unscoped". A bug that dropped
    // the id would otherwise turn a patient-scoped search into a whole-server
    // one, and the Bundle would look perfectly normal.
    expect(applySearch(resources, 'Patient', {})).toHaveLength(0)
    expect(applySearch(resources, 'Observation', {})).toHaveLength(0)
  })
})
