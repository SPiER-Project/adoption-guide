/**
 * What the server holds. These assertions are about the DATASET, not the HTTP
 * surface — the shape mistakes they catch (a StoredResponse wrapper served as
 * if it were a QuestionnaireResponse, a bucket nobody unwrapped) would each
 * look like a working server returning a well-formed empty Bundle.
 */
import { describe, expect, it } from 'vitest'
import { HELD_RESOURCES, HELD_TYPES, RESOURCES_BY_KEY } from './fixtures'

describe('fixtures', () => {
  it('holds the 14 minted Patients', () => {
    const patients = HELD_RESOURCES.filter(h => h.resource.resourceType === 'Patient')
    expect(patients).toHaveLength(14)
    expect(RESOURCES_BY_KEY.get('Patient/patient-011')).toMatchObject({
      resourceType: 'Patient',
      id: 'patient-011',
    })
  })

  it('unwraps the responses bucket into QuestionnaireResponses', () => {
    // The bucket holds StoredResponse wrappers — { id, questionnaireName,
    // completedAt, resource }. Serving the wrapper would give the client an
    // object with no resourceType, which fhirclient's flat:true drops silently.
    const qrs = HELD_RESOURCES.filter(h => h.resource.resourceType === 'QuestionnaireResponse')
    expect(qrs.length).toBeGreaterThan(0)
    for (const { resource } of qrs) {
      expect(resource).not.toHaveProperty('questionnaireName')
      expect(resource).not.toHaveProperty('completedAt')
      expect(resource.status).toBeTruthy()
    }
  })

  it('serves no app-only buckets and no client-only fields', () => {
    for (const { resource } of HELD_RESOURCES) {
      expect(resource.resourceType).toBeTruthy()
      expect(resource).not.toHaveProperty('_savedAt')
    }
    // riskAlerts / walkthrough are not FHIR and must never appear as resources.
    expect(HELD_TYPES).not.toContain('ScenarioEncounter')
    expect(HELD_TYPES).not.toContain('undefined')
  })

  it('serves every resource already patient-linked — nothing is stamped on (#364)', () => {
    // ⚠️ This assertion replaced `expect(NORMALIZED_LINKS).toHaveLength(20)`.
    // The fixtures carry `subject` now, so the stamp is DELETED rather than
    // left in place returning zero — a fallback that never fires reads exactly
    // like a fixture that is correct, and that is how the gap survived in the
    // first place. `assertPatientLink` throws at load, so a regressed fixture
    // fails this whole suite on import; these assertions state the invariant
    // the loader enforces.
    const linkOf: Record<string, string> = {
      EpisodeOfCare: 'patient', Consent: 'patient', Task: 'for',
    }
    let checked = 0
    let skipped = 0
    for (const { patientId, resource } of HELD_RESOURCES) {
      // A Patient IS the patient; it carries no link to one, which is why
      // PATIENT_ELEMENT has no entry for it either.
      if (resource.resourceType === 'Patient') { skipped++; continue }
      const wanted = `Patient/${patientId}`
      if (resource.resourceType === 'Appointment') {
        const parts = (resource.participant ?? []) as { actor?: { reference?: string } }[]
        expect(parts.some(p => p.actor?.reference === wanted), `${resource.id} is unlinked`).toBe(true)
      } else {
        const el = linkOf[resource.resourceType] ?? 'subject'
        const ref = (resource[el] as { reference?: string } | undefined)?.reference
        expect(ref, `${resource.resourceType}/${resource.id} ${el}`).toBe(wanted)
      }
      checked++
    }
    // An empty HELD_RESOURCES would satisfy every assertion above.
    expect(checked).toBeGreaterThan(100)
    expect(skipped, 'the 14-patient roster is held too').toBe(14)
  })

  it('serves QRs whose `authored` comes from the fixture, not the wrapper (#364)', () => {
    // Replaces `expect(NORMALIZED_AUTHORED).toHaveLength(20)`. The chart showed
    // "Invalid Date Invalid Date" for every SMART-read QuestionnaireResponse
    // while the wrapper held `completedAt` and the resource held nothing.
    let qrs = 0
    for (const { resource } of HELD_RESOURCES) {
      if (resource.resourceType !== 'QuestionnaireResponse') continue
      qrs++
      expect(typeof resource.authored, `${resource.id} has no authored`).toBe('string')
      expect(Number.isNaN(new Date(String(resource.authored)).getTime())).toBe(false)
    }
    expect(qrs).toBe(20)
  })

  it('holds every type the panel searches for', () => {
    // The 13 searched types, from SmartDataSource.getSlice. Patient is read by
    // id rather than searched.
    for (const type of [
      'QuestionnaireResponse', 'Observation', 'CarePlan', 'Communication', 'EpisodeOfCare',
      'Flag', 'Task', 'DocumentReference', 'ServiceRequest', 'Appointment', 'Consent',
      'Procedure', 'Encounter',
    ]) {
      expect(HELD_TYPES, `${type} missing from the dataset`).toContain(type)
    }
  })
})
