/**
 * The HTTP surface, driven through the real Hono app.
 *
 * The `/metadata` assertions deliberately run the response through the app's
 * OWN `parseCapabilityStatement` rather than reading fields by hand: the point
 * of that endpoint is that the consumer can read it, and a hand-written
 * assertion would only prove the document matches this test's idea of it.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { parseCapabilityStatement } from '../../../web/src/lib/writeback/capability'
import app, { resetProfile } from './app'
import { authHeaderFor } from './__fixtures__/launch'

const BASE = 'https://mock-ehr.test'

afterEach(() => resetProfile())

/**
 * Tokens for the patients these tests read. Obtained through the real
 * `/authorize` → `/token` flow (see the fixture), so every read below also
 * exercises the auth stub rather than bypassing it.
 */
const auth: Record<string, Record<string, string>> = {}

beforeAll(async () => {
  for (let n = 1; n <= 14; n++) {
    const pid = `patient-${String(n).padStart(3, '0')}`
    auth[pid] = await authHeaderFor(BASE, pid)
  }
})

/** GET as `patient` (default patient-011), carrying that patient's token. */
async function get(path: string, patient = 'patient-011') {
  const res = await app.request(`${BASE}${path}`, { headers: auth[patient] })
  const body = await res.json().catch(() => null)
  return { res, body: body as Record<string, unknown> | null }
}

describe('read', () => {
  it('GET /fhir/Patient/patient-011 returns the minted Patient', async () => {
    const { res, body } = await get('/fhir/Patient/patient-011')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/fhir+json')
    expect(body).toMatchObject({ resourceType: 'Patient', id: 'patient-011' })
  })

  it('404s an unknown id as an OperationOutcome', async () => {
    // Deliberately not `Patient/patient-999`: a Patient id the token is not
    // bound to is now a 403 before it is a 404, which is the correct order
    // (do not disclose whether a patient exists to a token that cannot read
    // them) and is asserted separately below.
    const { res, body } = await get('/fhir/Observation/nonexistent')
    expect(res.status).toBe(404)
    expect(body).toMatchObject({ resourceType: 'OperationOutcome' })
  })
})

describe('search', () => {
  // The 13 searched types from SmartDataSource.getSlice, in its order.
  const SEARCHES = [
    'QuestionnaireResponse?patient=patient-011',
    'Observation?patient=patient-011&category=survey',
    'Observation?patient=patient-011&category=procedure',
    'CarePlan?patient=patient-011',
    'Communication?patient=patient-011',
    'EpisodeOfCare?patient=patient-011',
    'Flag?patient=patient-011',
    'Task?patient=patient-011',
    'DocumentReference?patient=patient-011',
    'ServiceRequest?patient=patient-011',
    'Appointment?patient=patient-011',
    'Consent?patient=patient-011',
    'Procedure?patient=patient-011',
    'Encounter?patient=patient-011',
  ]

  it('answers all 14 searches with a searchset Bundle', async () => {
    for (const search of SEARCHES) {
      const { res, body } = await get(`/fhir/${search}`)
      expect(res.status, search).toBe(200)
      expect(body, search).toMatchObject({ resourceType: 'Bundle', type: 'searchset' })
      expect(Array.isArray(body?.entry), search).toBe(true)
      expect(body?.total, search).toBe((body?.entry as unknown[]).length)
      // pageLimit:0 makes fhirclient follow every `next` it is given.
      expect(body?.link, search).toBeUndefined()
    }
  })

  it('carries real data for the two load-bearing searches, for 13 of 14 patients', async () => {
    // These two have no `.catch` in getSlice — a failure there fails the whole
    // chart, so they are the ones that must genuinely carry data.
    //
    // ⚠️ patient-002 is the exception, and deliberately so: they are the
    // never-screened patient ("No suicide-risk screening on file in the past 12
    // months"), whose only artifact is an `exam` Observation for an annual
    // wellness visit. Both load-bearing searches exclude it by category, so
    // through the SMART path patient-002's chart is EMPTY — a real
    // divergence from the local data source, which shows the wellness visit.
    // Asserted rather than skipped so it cannot become true of a second patient
    // without someone noticing.
    const empty: string[] = []
    for (let n = 1; n <= 14; n++) {
      const pid = `patient-${String(n).padStart(3, '0')}`
      const qrs = await get(`/fhir/QuestionnaireResponse?patient=${pid}`, pid)
      const obs = await get(`/fhir/Observation?patient=${pid}&category=survey`, pid)
      expect(qrs.res.status, pid).toBe(200)
      expect(obs.res.status, pid).toBe(200)
      const count = (qrs.body?.entry as unknown[]).length + (obs.body?.entry as unknown[]).length
      if (count === 0) empty.push(pid)
    }
    expect(empty).toEqual(['patient-002'])
  })

  it('still serves the Observations that neither load-bearing search asks for', async () => {
    // `getSlice` queries only category=survey and category=procedure, so the
    // two `exam` Observations in the scenarios never reach the panel. The
    // server holds them; the client's query set is what excludes them.
    const all = await get('/fhir/Observation?patient=patient-002', 'patient-002')
    expect((all.body?.entry as unknown[]).length).toBe(1)
    const survey = await get('/fhir/Observation?patient=patient-002&category=survey', 'patient-002')
    expect((survey.body?.entry as unknown[]).length).toBe(0)
  })

  it('returns different sets for category=survey and category=procedure', async () => {
    const survey = await get('/fhir/Observation?patient=patient-011&category=survey')
    const procedure = await get('/fhir/Observation?patient=patient-011&category=procedure')
    const all = await get('/fhir/Observation?patient=patient-011')
    expect((survey.body?.entry as unknown[]).length).toBeGreaterThan(0)
    // ⚠️ The scenarios contain NO Observation with category `procedure` — the
    // Stage-4 means-safety artifact is a `Procedure` resource. This asserts the
    // filter runs, which is the thing that can regress; the empty result is a
    // finding about the fixtures, recorded in the plan doc, not a bug here.
    expect((procedure.body?.entry as unknown[]).length).toBe(0)
    expect((all.body?.entry as unknown[]).length).toBeGreaterThan((survey.body?.entry as unknown[]).length - 1)
  })

  it('404s a type it does not implement instead of returning an empty Bundle', async () => {
    const { res, body } = await get('/fhir/MedicationRequest?patient=patient-011')
    expect(res.status).toBe(404)
    expect(body).toMatchObject({ resourceType: 'OperationOutcome' })
  })

  it('400s an unsupported search parameter', async () => {
    const { res, body } = await get('/fhir/Observation?patient=patient-011&_count=1')
    expect(res.status).toBe(400)
    expect(String((body?.issue as [{ diagnostics: string }])[0].diagnostics)).toContain('_count')
  })

  it('sends CORS headers — the panel is on another origin', async () => {
    const res = await app.request(`${BASE}/fhir/Patient/patient-011`, {
      headers: { ...auth['patient-011'], origin: 'https://spier-adoption-guide.test' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('/fhir/metadata', () => {
  it('is readable by the ladder’s own parser, and advertises create', async () => {
    const { res, body } = await get('/fhir/metadata')
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ resourceType: 'CapabilityStatement', fhirVersion: '4.0.1' })
    const caps = parseCapabilityStatement(body)
    expect(caps.QuestionnaireResponse).toEqual({ create: true })
    expect(caps.Observation).toEqual({ create: true })
    expect(caps.DocumentReference).toEqual({ create: true })
    expect(caps.Condition).toEqual({ create: true })
  })

  it('degrades exactly as far as the switched profile says', async () => {
    const put = await app.request(`${BASE}/_admin/capabilities`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: 'no-observation' }),
    })
    expect(put.status).toBe(200)

    const caps = parseCapabilityStatement((await get('/fhir/metadata')).body)
    // The demo: discrete capture still lands, derived extraction does not, and
    // the Tier-0 floor is what carries the data instead.
    expect(caps.QuestionnaireResponse).toEqual({ create: true })
    expect(caps.Observation).toEqual({ create: false })
    expect(caps.DocumentReference).toEqual({ create: true })
  })

  it('read-only advertises no creates at all', async () => {
    await app.request(`${BASE}/_admin/capabilities`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: 'read-only' }),
    })
    const caps = parseCapabilityStatement((await get('/fhir/metadata')).body)
    expect(Object.values(caps).some(c => c.create)).toBe(false)
  })

  it('rejects an unknown profile', async () => {
    const res = await app.request(`${BASE}/_admin/capabilities`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: 'generous' }),
    })
    expect(res.status).toBe(400)
  })

  it('still advertises read + search for every held type when creates are off', async () => {
    await app.request(`${BASE}/_admin/capabilities`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: 'read-only' }),
    })
    const { body } = await get('/fhir/metadata')
    const rest = (body?.rest as [{ resource: { type: string; interaction: { code: string }[] }[] }])[0]
    const encounter = rest.resource.find(r => r.type === 'Encounter')
    expect(encounter?.interaction.map(i => i.code)).toEqual(['read', 'search-type'])
  })
})

describe('control surface', () => {
  it('serves a page with the profile switch', async () => {
    const res = await app.request(`${BASE}/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('data-profile="no-observation"')
    expect(html).toContain('Demonstration host only')
  })

  it('404s anything outside /fhir with an OperationOutcome', async () => {
    const { res, body } = await get('/Patient/patient-011')
    expect(res.status).toBe(404)
    expect(body).toMatchObject({ resourceType: 'OperationOutcome' })
  })
})
