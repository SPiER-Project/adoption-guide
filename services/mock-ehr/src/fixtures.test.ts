/**
 * What the server holds. These assertions are about the DATASET, not the HTTP
 * surface — the shape mistakes they catch (a StoredResponse wrapper served as
 * if it were a QuestionnaireResponse, a bucket nobody unwrapped) would each
 * look like a working server returning a well-formed empty Bundle.
 */
import { describe, expect, it } from 'vitest'
import { HELD_RESOURCES, HELD_TYPES, NORMALIZED_AUTHORED, NORMALIZED_LINKS, RESOURCES_BY_KEY } from './fixtures'

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

  it('supplies a patient link ONLY where the fixtures lack one — the 20 QRs', () => {
    // ⚠️ Pinned deliberately. Twelve of thirteen buckets are 100% patient-linked;
    // `responses` is 0%, so every scenario QuestionnaireResponse needs a stamped
    // `subject` or the most load-bearing search on this server returns nothing.
    // If a resource in ANY other bucket appears here, a fixture lost its patient
    // link and this service quietly papered over it — go fix the fixture.
    expect(NORMALIZED_LINKS).toHaveLength(20)
    for (const key of NORMALIZED_LINKS) {
      expect(key.startsWith('QuestionnaireResponse/'), `${key} is not a QuestionnaireResponse`).toBe(true)
    }
  })

  it('supplies `authored` for all 20 QRs, from their wrapper’s completedAt', () => {
    // ⚠️ Same gap as the patient link, and it was on screen: the chart showed
    // "Invalid Date Invalid Date" for every SMART-read QuestionnaireResponse,
    // because the StoredResponse WRAPPER carries completedAt and the resource
    // carries no `authored`. Pinned so this workaround dies with #364 rather
    // than outliving it.
    expect(NORMALIZED_AUTHORED).toHaveLength(20)
    for (const { resource } of HELD_RESOURCES) {
      if (resource.resourceType !== 'QuestionnaireResponse') continue
      expect(typeof resource.authored, `${resource.id} has no authored`).toBe('string')
      expect(Number.isNaN(new Date(String(resource.authored)).getTime())).toBe(false)
    }
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
