/**
 * Search semantics. Every case here is one where a lenient mock returns
 * something plausible and wrong.
 */
import { describe, expect, it } from 'vitest'
import { HELD_RESOURCES } from './fixtures'
import { applySearch, belongsToPatient, matchesIdentifier, matchesToken, parseSearch } from './search'

const ALL = HELD_RESOURCES.map(h => h.resource)

describe('belongsToPatient', () => {
  it('reads the element each type actually uses, not just subject', () => {
    // Matching only `subject` would return zero of these four.
    expect(applySearch(ALL, 'EpisodeOfCare', { patientIds: ['patient-011'] }).length).toBeGreaterThan(0)
    expect(applySearch(ALL, 'Task', { patientIds: ['patient-011'] }).length).toBeGreaterThan(0)
    expect(applySearch(ALL, 'Appointment', { patientIds: ['patient-011'] }).length).toBeGreaterThan(0)
    expect(applySearch(ALL, 'Consent', { patientIds: ['patient-011'] }).length).toBeGreaterThan(0)
  })

  it('does not leak one patient’s resources into another’s search', () => {
    for (const type of ['QuestionnaireResponse', 'Observation', 'Encounter']) {
      const mine = applySearch(ALL, type, { patientIds: ['patient-011'] })
      expect(mine.length).toBeGreaterThan(0)
      for (const r of mine) expect(belongsToPatient(r, 'patient-001')).toBe(false)
    }
  })

  it('returns every listed patient’s resources for an OR search, and nobody else’s', () => {
    const both = applySearch(ALL, 'QuestionnaireResponse', {
      patientIds: ['patient-001', 'patient-011'],
    })
    expect(both.some(r => belongsToPatient(r, 'patient-001'))).toBe(true)
    expect(both.some(r => belongsToPatient(r, 'patient-011'))).toBe(true)
    // The whole cohort read rests on this: a listed patient widens the result
    // and an unlisted one never appears in it.
    expect(both.some(r => belongsToPatient(r, 'patient-002'))).toBe(false)
    const one = applySearch(ALL, 'QuestionnaireResponse', { patientIds: ['patient-001'] })
    expect(both.length).toBeGreaterThan(one.length)
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
      expect(parsed.ok && parsed.query.patientIds).toEqual(['patient-011'])
    }
  })

  it('reads `patient=a,b,c` as the OR a cohort read needs', () => {
    const parsed = parseSearch(new URLSearchParams('patient=patient-001,Patient/patient-002, patient-003 '))
    expect(parsed.ok && parsed.query.patientIds).toEqual(['patient-001', 'patient-002', 'patient-003'])
  })

  it('refuses `patient=` with no value rather than reading it as the roster', () => {
    for (const qs of ['patient=', 'patient=,,']) {
      const parsed = parseSearch(new URLSearchParams(qs))
      expect(parsed.ok).toBe(false)
      expect(parsed.ok === false && parsed.status).toBe(400)
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
    expect(parsed.ok && parsed.query.patientIds).toBeUndefined()
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
    // ⚠️ A missing `patientIds` must NOT read as "unscoped". A bug that dropped
    // the list would otherwise turn a patient-scoped search into a whole-server
    // one, and the Bundle would look perfectly normal.
    expect(applySearch(resources, 'Patient', {})).toHaveLength(0)
    expect(applySearch(resources, 'Observation', {})).toHaveLength(0)
  })
})

/**
 * ⚠️ **`identifier` search exists because the app stopped minting resource ids.**
 * SPiER's lifecycle writes used to be `PUT <Type>/<client id>`, which this server
 * accepted and real servers refuse. The client id is a business identifier now,
 * and `SmartDataSource.findServerId` looks a resource up by it to learn the id
 * the SERVER assigned. That lookup is best-effort in the app, so leaving this
 * unimplemented would not have failed loudly — it would have silently degraded
 * cross-launch convergence, and a second episode would have appeared where one
 * was expected.
 */
describe('identifier search', () => {
  const CLIENT_SYS = 'http://thespierproject.org/fhir/identifier/client-id'
  const held = [
    {
      resourceType: 'EpisodeOfCare',
      id: 'srv-7',
      patient: { reference: 'Patient/patient-001' },
      identifier: [{ system: CLIENT_SYS, value: 'episode-abc' }],
    },
    {
      resourceType: 'EpisodeOfCare',
      id: 'srv-8',
      patient: { reference: 'Patient/patient-001' },
      identifier: [{ system: CLIENT_SYS, value: 'episode-xyz' }],
    },
  ]

  it('is an accepted parameter rather than a 400', () => {
    const parsed = parseSearch(
      new URLSearchParams({ patient: 'patient-001', identifier: `${CLIENT_SYS}|episode-abc` }),
      { type: 'EpisodeOfCare' },
    )
    expect(parsed.ok).toBe(true)
  })

  it('narrows to the one resource carrying that identifier', () => {
    const found = applySearch(held, 'EpisodeOfCare', {
      patientIds: ['patient-001'],
      identifier: `${CLIENT_SYS}|episode-abc`,
    })
    expect(found.map(r => r.id)).toEqual(['srv-7'])
  })

  it('returns nothing for an identifier no resource carries — not everything', () => {
    // The failure a lenient server makes: ignoring the parameter and answering
    // with the whole set, which reads as "found it" to a caller taking [0].
    const found = applySearch(held, 'EpisodeOfCare', {
      patientIds: ['patient-001'],
      identifier: `${CLIENT_SYS}|episode-never-written`,
    })
    expect(found).toEqual([])
  })

  it('matches the three token spellings, and does not confuse systems', () => {
    const ids = [{ system: CLIENT_SYS, value: 'episode-abc' }]
    expect(matchesIdentifier(ids, 'episode-abc')).toBe(true)
    expect(matchesIdentifier(ids, `${CLIENT_SYS}|episode-abc`)).toBe(true)
    expect(matchesIdentifier(ids, `http://elsewhere.example|episode-abc`)).toBe(false)
    // `|value` means "no system", which this one has.
    expect(matchesIdentifier(ids, '|episode-abc')).toBe(false)
  })
})
