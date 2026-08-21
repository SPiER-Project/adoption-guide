/**
 * The test this whole service exists to pass: a REAL `SmartDataSource`, driving
 * a REAL fhirclient `Client`, reading patient-011's chart out of this server.
 *
 * ⚠️ Why it is worth the setup. The read API was specified by reading
 * `SmartDataSource` and reasoning about what it would ask for — a derived spec
 * that nothing had exercised. Every unit test above encodes the same reading,
 * so they can only confirm it; they cannot catch a misreading. This one puts
 * the actual consumer in front of the actual server, which is the only thing
 * that can. (It found one: not a single scenario QuestionnaireResponse carries
 * a `subject`, so the most load-bearing search on the server returned nothing
 * for every patient. See `NORMALIZED_LINKS` in fixtures.ts.)
 *
 * The app is served over a real loopback HTTP server rather than called
 * in-process. That is not ceremony: fhirclient captures `fetch` from
 * `cross-fetch` at module scope in any non-browser environment, so stubbing
 * `globalThis.fetch` does not reach it — and going through a socket exercises
 * real headers, status codes and JSON parsing, which is what is being claimed.
 * Only workerd is absent, and nothing here depends on it.
 */
import { createServer, type Server } from 'node:http'
import Client from 'fhirclient/lib/Client'
import type { fhirclient } from 'fhirclient/lib/types'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SmartDataSource } from '../../../web/src/lib/dataSource/smartDataSource'
import { deriveFromResponse } from '../../../web/src/lib/deriveFromResponse'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import type { StoredResponse } from '../../../web/src/types/fhir'
import type { DerivedArtifacts } from '../../../web/src/lib/dataSource/types'
import app, { resetProfile } from './app'
import { launchFor } from './__fixtures__/launch'
import { fakeStore, type FakeStoreBinding } from './__fixtures__/store'

let server: Server
let SERVER_URL = ''
let port = 0

/**
 * Requests the loopback server should answer with a 500 instead of passing to
 * the app — how the "prove it can fail" case takes one search offline.
 */
let failTypes: string[] = []

/**
 * Env the loopback server passes to the app. Writes need a `DEMO_STORE`; the
 * read tests do not, and leaving it unset for them keeps their behaviour
 * identical to before step 4.
 */
let requestEnv: Record<string, unknown> = {}

beforeAll(async () => {
  server = createServer((req, res) => {
    // `port`, not `server.address()`: the address is null once the server is
    // closing, and a late request then crashes the run with an unrelated
    // TypeError instead of the failure under test. (Observed while planting the
    // `next`-link defect, which makes fhirclient chase pages forever.)
    const url = `http://127.0.0.1:${port}${req.url}`
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c as Buffer))
    req.on('end', async () => {
      if (failTypes.some(t => url.includes(`/fhir/${t}?`))) {
        res.writeHead(500, { 'content-type': 'application/fhir+json' })
        res.end('{"resourceType":"OperationOutcome"}')
        return
      }
      const response = await app.request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      }, requestEnv)
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => { headers[key] = value })
      res.writeHead(response.status, headers)
      res.end(Buffer.from(await response.arrayBuffer()))
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as { port: number }).port
  SERVER_URL = `http://127.0.0.1:${port}/fhir`
})

afterAll(async () => {
  await new Promise<void>(resolve => { server.close(() => resolve()) })
})

/**
 * The bits of the fhirclient environment `Client` actually touches on a read
 * path: `fhir` (fhir.js interop — absent), `options`, `btoa`, and storage
 * (only reached on token refresh, which an open server never triggers).
 */
function nodeEnvironment(): fhirclient.Adapter {
  const store = new Map<string, unknown>()
  return {
    options: {},
    fhir: null,
    btoa: (s: string) => Buffer.from(s).toString('base64'),
    atob: (s: string) => Buffer.from(s, 'base64').toString(),
    getStorage: () => ({
      get: async (key: string) => store.get(key),
      set: async (key: string, value: unknown) => { store.set(key, value); return value },
      unset: async (key: string) => store.delete(key),
    }),
  } as unknown as fhirclient.Adapter
}

/**
 * A client holding a token obtained through the REAL `/authorize` → `/token`
 * flow, with a genuine PKCE verifier — not a hand-written `tokenResponse`.
 *
 * fhirclient's own `oauth2.authorize()`/`ready()` are not driven here because
 * they need a browser (a location redirect and sessionStorage). What is
 * exercised is everything after that: the same authorization-code exchange the
 * browser performs, and then every FHIR read carrying the resulting bearer
 * token, which is the part this server implements.
 */
async function clientFor(patientId: string): Promise<Client> {
  const { tokenResponse } = await launchFor(`http://127.0.0.1:${port}`, { patient: patientId })
  return new Client(nodeEnvironment(), {
    serverUrl: SERVER_URL,
    tokenResponse,
  } as fhirclient.ClientState)
}

describe('SmartDataSource against the mock EHR', () => {
  it('carries the SMART launch context on the token response', async () => {
    // `intent` and `need_patient_banner` are how the host tells the panel what
    // to open and whether to draw its own banner (§4). They ride the token
    // response, so this is the only place their round trip can be asserted.
    const launch = await launchFor(`http://127.0.0.1:${port}`, { patient: 'patient-011' })
    expect(launch.tokenResponse).toMatchObject({
      token_type: 'Bearer',
      patient: 'patient-011',
    })
    expect(launch.tokenResponse.access_token).toBeTruthy()
  })

  it('reads the launch Patient', async () => {
    const patient = await (await clientFor('patient-011')).patient.read()
    expect(patient).toMatchObject({ resourceType: 'Patient', id: 'patient-011' })
  })

  it('builds patient-011’s full slice — every bucket the chart renders', async () => {
    const slice = await new SmartDataSource(await clientFor('patient-011')).getSlice(null)

    // The two load-bearing searches.
    expect(slice.responses.length).toBe(5)
    expect(slice.observations.length).toBeGreaterThan(0)

    // The twelve best-effort ones. Non-empty here means the patient link was
    // resolved through the right element — Task uses `for`, EpisodeOfCare and
    // Consent use `patient`, Appointment uses participant.actor.
    expect((slice.encounters ?? []).length).toBeGreaterThan(0)
    expect((slice.episodes ?? []).length).toBeGreaterThan(0)
    expect((slice.tasks ?? []).length).toBeGreaterThan(0)
    expect((slice.appointments ?? []).length).toBeGreaterThan(0)
    expect((slice.consents ?? []).length).toBeGreaterThan(0)
    expect((slice.procedures ?? []).length).toBeGreaterThan(0)
    expect((slice.carePlans ?? []).length).toBeGreaterThan(0)
    expect((slice.communications ?? []).length).toBeGreaterThan(0)
    expect((slice.serviceRequests ?? []).length).toBeGreaterThan(0)
    expect((slice.documentReferences ?? []).length).toBeGreaterThan(0)
    expect((slice.flags ?? []).length).toBeGreaterThan(0)

    // Everything must belong to patient-011 and to no one else.
    for (const qr of slice.responses) {
      expect(qr.resource.subject).toEqual({ reference: 'Patient/patient-011' })
    }
  })

  it('derives risk alerts from the QRs it read — the mapper chain survives the round trip', async () => {
    // The strongest single assertion available: the QRs came off the wire as
    // JSON, went through `deriveFromResponse`, and produced tiers. #327 is the
    // precedent — a QR whose answers are shaped wrong derives "no risk" while
    // looking completely healthy.
    const slice = await new SmartDataSource(await clientFor('patient-011')).getSlice(null)
    expect(slice.riskAlerts.length).toBeGreaterThan(0)
    for (const alert of slice.riskAlerts) {
      expect(alert.tool).toBeTruthy()
      expect(alert.level).toBeTruthy()
    }
    // patient-011 is the ED positive-screen course. `none` across the board
    // would be the #327 signature — a healthy-looking chart that derived no
    // risk from an endorsed screen — so assert the endorsement survives.
    expect(slice.riskAlerts.some(a => a.level !== 'none')).toBe(true)
  })

  it('returns an empty-but-valid slice for the never-screened patient', async () => {
    const slice = await new SmartDataSource(await clientFor('patient-002')).getSlice(null)
    expect(slice.responses).toEqual([])
    expect(slice.observations).toEqual([])
    expect(slice.riskAlerts).toEqual([])
  })

  it('fails the chart when a load-bearing search fails, and not otherwise', async () => {
    // The standing rule, applied to a server: confirm the failure path exists.
    // QuestionnaireResponse has no `.catch` in getSlice, so a 500 there must
    // reject; Flag has one, so the same failure must degrade to an empty bucket.
    try {
      failTypes = ['QuestionnaireResponse']
      const failClient = await clientFor('patient-011')
      await expect(new SmartDataSource(failClient).getSlice(null)).rejects.toThrow()

      failTypes = ['Flag']
      const degraded = await new SmartDataSource(await clientFor('patient-011')).getSlice(null)
      expect(degraded.flags).toEqual([])
      expect(degraded.responses.length).toBe(5)
    } finally {
      failTypes = []
    }
  })
})

/**
 * The writeback ladder, driven by the REAL `SmartDataSource.saveResponse`
 * against this server over a real socket — panel step 4.
 *
 * ⚠️ **This exists because a browser is not a gate.** The degradation demo was
 * observed once, by hand, in a browser (panel plan §5.1): a PSS-3 submitted under
 * `full` wrote a QuestionnaireResponse and four Observations, and the same submit
 * under `no-observation` wrote the QuestionnaireResponse and the
 * DocumentReference floor instead. That is evidence the thing works; it is not
 * something that fails when someone breaks it. This is.
 *
 * It also closes a case the browser run deliberately did not cover — the
 * `read-only` profile — which is the profile a sceptical integration lead will
 * pick, precisely because it is the one where nothing can land.
 *
 * Nothing here is hand-built: the QuestionnaireResponse comes from the population
 * scenarios and its Observations from `deriveFromResponse`, so the payloads are
 * the ones the app actually produces.
 *
 * ⚠️ **`deriveFromResponse`, not `mapResponseToObservations`** — and the first
 * draft of this file got that wrong, which is worth recording because it is the
 * #327 shape exactly. The raw mapper returns Observations with **no**
 * `derivedFrom`; `deriveFromResponse` is the business logic that stamps the
 * back-reference and the pathway-stage tag, and it is what `useCorrelatedSave`
 * calls on submit. Using the mapper directly would have built artifacts the app
 * never produces, and the provenance assertion below — the one thing here that
 * cannot be checked any other way — would have been quietly testing nothing.
 */
describe('the writeback ladder against the mock EHR (step 4)', () => {
  /** A scenario response whose mapper fires, with its real derived artifacts. */
  function submissionFor(patientId: string): { entry: StoredResponse; derived: DerivedArtifacts } {
    for (const entry of POPULATION_SCENARIOS[patientId]?.responses ?? []) {
      const derived = deriveFromResponse(entry.resource)
      if (derived && derived.observations.length > 0) {
        return { entry: entry as StoredResponse, derived }
      }
    }
    throw new Error(`no scenario response for ${patientId} produces Observations`)
  }

  async function submit(profile: 'full' | 'no-observation' | 'read-only') {
    resetProfile()
    const store = fakeStore()
    await store.state.setProfile(profile)
    requestEnv = store as unknown as Record<string, unknown>
    const source = new SmartDataSource(await clientFor('patient-011'))
    const { entry, derived } = submissionFor('patient-011')
    let error: Error | null = null
    try {
      await source.saveResponse('patient-011', entry, derived)
    } catch (err) {
      error = err as Error
    }
    return { store: store as FakeStoreBinding, source, error }
  }

  afterEach(() => {
    requestEnv = {}
    resetProfile()
  })

  it('full: writes the QuestionnaireResponse and the Observations', async () => {
    const { store, source, error } = await submit('full')
    expect(error).toBeNull()

    const written = await store.state.list()
    const types = written.map(w => String(w.resource.resourceType))
    expect(types).toContain('QuestionnaireResponse')
    expect(types.filter(t => t === 'Observation').length).toBeGreaterThan(0)

    const report = source.writebackReport
    expect(report?.result.steps.find(s => s.tier === 1)?.outcome).toBe('written')
    expect(report?.result.steps.find(s => s.tier === 2)?.outcome).toBe('written')
  })

  it('full: remaps derivedFrom onto the id the SERVER assigned', async () => {
    // ⚠️ The property server-minted ids exist for. `executeWritePlan` rewrites
    // `QuestionnaireResponse/<client id>` to the server's id inside
    // `Observation.derivedFrom`; against a server that echoed the client's id
    // back the remap would be a no-op, and a broken one would look identical.
    //
    // ⚠️ **The first version of this test could not fail.** It asserted only
    // that `derivedFrom` names the written QR's id — which stays true when the
    // server echoes the client's id, because then the two ids are the same
    // string. Planting exactly that defect passed. What makes the assertion mean
    // something is pinning the ids APART first: the client's id, the server's,
    // and then which one the reference follows.
    const { entry } = submissionFor('patient-011')
    const clientQrId = String(entry.resource.id)
    const { store } = await submit('full')
    const written = await store.state.list()
    const qr = written.find(w => w.resource.resourceType === 'QuestionnaireResponse')
    const serverQrId = String(qr?.resource.id)
    const observations = written.filter(w => w.resource.resourceType === 'Observation')

    // 1. The server did NOT take the client's id.
    expect(clientQrId).toBeTruthy()
    expect(serverQrId).not.toBe(clientQrId)
    expect(serverQrId).toMatch(/^srv-/)

    // 2. Every derivedFrom followed the server's id, and none kept the client's.
    expect(observations.length).toBeGreaterThan(0)
    for (const observation of observations) {
      const refs = ((observation.resource.derivedFrom as Array<{ reference?: string }> | undefined) ?? [])
        .map(r => r.reference)
      expect(refs).toContain(`QuestionnaireResponse/${serverQrId}`)
      expect(refs).not.toContain(`QuestionnaireResponse/${clientQrId}`)
    }
  })

  it('no-observation: Tier 2 is skipped and the Tier-0 floor carries it', async () => {
    const { store, source, error } = await submit('no-observation')
    expect(error).toBeNull()

    const types = (await store.state.list()).map(w => String(w.resource.resourceType))
    expect(types).toContain('QuestionnaireResponse')
    expect(types).toContain('DocumentReference')
    // The whole point of the demo: no Observation landed, and the data is still
    // recoverable from the floor.
    expect(types).not.toContain('Observation')

    const steps = source.writebackReport?.result.steps ?? []
    expect(steps.find(s => s.tier === 2)).toMatchObject({ outcome: 'skipped' })
    expect(steps.find(s => s.tier === 0)).toMatchObject({ outcome: 'written', role: 'floor' })
  })

  it('no-observation: the ladder learned this from /metadata, not from a flag', async () => {
    // `capabilitiesKnown` distinguishes "the server said it cannot" from "we
    // could not ask" — conflating them would report a network failure as an EHR
    // limitation, which is the opposite of a readiness diagnostic.
    const { source } = await submit('no-observation')
    const report = source.writebackReport
    expect(report?.capabilitiesKnown).toBe(true)
    expect(report?.capabilities.Observation).toEqual({ create: false })
    expect(report?.capabilities.QuestionnaireResponse).toEqual({ create: true })
  })

  it('read-only: nothing lands, and the save FAILS rather than reporting success', async () => {
    // ⚠️ The case the browser run did not cover, and the answer is not "it
    // degrades". Every tier including the floor is refused, and `saveResponse`
    // throws — which is correct: nothing landed IS a failed save, and a UI that
    // showed a green tick here would be lying. Recorded as a defensible
    // behaviour rather than assumed to be one.
    const { store, error } = await submit('read-only')
    expect(await store.state.list()).toEqual([])
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/no resource was created/i)
  })

  it('a written resource is then readable through the real data source', async () => {
    // End to end: the ladder wrote it, and the chart's own read path finds it.
    // Two independent code paths agreeing is the point — the writeback report is
    // SPiER reporting on itself.
    const { store } = await submit('full')
    const qr = (await store.state.list()).find(w => w.resource.resourceType === 'QuestionnaireResponse')
    const slice = await new SmartDataSource(await clientFor('patient-011')).getSlice(null)
    expect(slice.responses.some(r => r.resource.id === qr?.resource.id)).toBe(true)
  })
})
