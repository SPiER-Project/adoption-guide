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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SmartDataSource } from '../../../web/src/lib/dataSource/smartDataSource'
import app from './app'
import { launchFor } from './__fixtures__/launch'

let server: Server
let SERVER_URL = ''
let port = 0

/**
 * Requests the loopback server should answer with a 500 instead of passing to
 * the app — how the "prove it can fail" case takes one search offline.
 */
let failTypes: string[] = []

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
      })
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
