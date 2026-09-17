/**
 * `SmartDataSource.saveArtifact` for the eight `LIFECYCLE_RESOURCE_TYPES`.
 *
 * ⚠️ **This path had no test at all, and it was broken against every real
 * server.** It wrote `PUT <Type>/<client-minted id>` — FHIR update-as-create,
 * which asks a server to create a resource at an id the client chose. Medplum
 * answers `400 Invalid id` to SPiER's prefixed ids and `404` to a bare UUID that
 * does not exist yet, so the id format was never the problem: it has no
 * update-as-create. And because `useCorrelatedSave.ensureEncounter()` runs before
 * nearly every save, that single refusal blocked EVERY write, not just the
 * lifecycle ones.
 *
 * It went unnoticed because the only server it had ever run against was SPiER's
 * own mock, which grew a `PUT` handler specifically to accept it — *"`PUT`
 * exists because a browser found it, not because the spec asked"*
 * (`services/mock-ehr/README.md`). When the app and a server we wrote disagree,
 * the server moves.
 *
 * What replaced it uses only `create` and `update-by-id`, the two write
 * interactions every FHIR server that accepts writes supports at all.
 */
import { describe, it, expect } from 'vitest'
import { SmartDataSource } from '@spier/core/lib/dataSource/smartDataSource'
import type { FhirResource } from '@spier/core/types/fhir'

const PATIENT = 'smart-pt-1'
const CLIENT_ID_SYSTEM = 'http://thespierproject.org/fhir/identifier/client-id'

interface Call {
  method: string
  url: string
  body?: FhirResource
}

/**
 * A fake fhirclient `Client` recording every write, with a server that assigns
 * its own ids — the behaviour the old code could not cope with.
 *
 * `searchable` mirrors a server that implements `?identifier=`; setting it false
 * mirrors one that does not (SPiER's own mock answers an unknown search
 * parameter with a 400 by design), so the fallback to the in-session map is
 * exercised rather than assumed.
 */
function fakeClient({ searchable = true }: { searchable?: boolean } = {}) {
  const calls: Call[] = []
  const stored = new Map<string, FhirResource>()
  let nextId = 1

  const client = {
    patient: { id: PATIENT },
    request: async (arg: unknown, _opts?: unknown) => {
      // Search form: a bare string url.
      if (typeof arg === 'string') {
        calls.push({ method: 'GET', url: arg })
        if (!searchable) throw new Error('400 unknown search parameter')
        const match = /^([A-Za-z]+)\?identifier=(.+)$/.exec(arg)
        if (!match) return []
        const [, type, raw] = match
        const value = decodeURIComponent(raw).split('|')[1]
        return [...stored.values()].filter(
          r =>
            r.resourceType === type
            && ((r as { identifier?: { value?: string }[] }).identifier ?? []).some(
              i => i.value === value,
            ),
        )
      }

      const req = arg as { url: string; method: string; body: string }
      const body = JSON.parse(req.body) as FhirResource
      calls.push({ method: req.method, url: req.url, body })

      if (req.method === 'POST') {
        const id = `srv-${nextId++}`
        const created = { ...body, id }
        stored.set(`${body.resourceType}/${id}`, created)
        return { body: created, response: { headers: new Headers() } }
      }
      // PUT
      stored.set(req.url, body)
      return { body, response: { headers: new Headers() } }
    },
  }
  return { client, calls, stored }
}

function encounter(id: string, status: string): FhirResource {
  return {
    resourceType: 'Encounter',
    id,
    status,
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    period: { start: '2026-09-17T10:00:00.000Z' },
  } as unknown as FhirResource
}

describe('saveArtifact — lifecycle resources', () => {
  it('CREATES with POST rather than PUTting a client-minted id', async () => {
    const { client, calls } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))

    const writes = calls.filter(c => c.method !== 'GET')
    expect(writes).toHaveLength(1)
    expect(writes[0].method).toBe('POST')
    // The thing that broke against Medplum: no client id in the URL, and none
    // in the body either.
    expect(writes[0].url).toBe('Encounter')
    expect(writes[0].body?.id).toBeUndefined()
  })

  it('carries the client-minted id as a business identifier instead', async () => {
    const { client, calls } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))

    const posted = calls.find(c => c.method === 'POST')?.body as {
      identifier?: { system?: string; value?: string }[]
    }
    expect(posted.identifier).toContainEqual({ system: CLIENT_ID_SYSTEM, value: 'encounter-abc' })
  })

  it('UPDATES the server copy on the next transition, converging on one resource', async () => {
    const { client, calls, stored } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))
    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'finished'))

    const writes = calls.filter(c => c.method !== 'GET')
    expect(writes.map(w => w.method)).toEqual(['POST', 'PUT'])
    // Against the SERVER's id, never the client's.
    expect(writes[1].url).toBe('Encounter/srv-1')

    // Converged: one Encounter, in its final state. This is what the old
    // update-as-create bought and what the replacement had to keep.
    const encounters = [...stored.values()].filter(r => r.resourceType === 'Encounter')
    expect(encounters).toHaveLength(1)
    expect((encounters[0] as { status?: string }).status).toBe('finished')
  })

  it('does not duplicate the identifier when a resource is written twice', async () => {
    const { client, calls } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))
    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'finished'))

    const put = calls.find(c => c.method === 'PUT')?.body as {
      identifier?: { system?: string; value?: string }[]
    }
    const mine = (put.identifier ?? []).filter(i => i.system === CLIENT_ID_SYSTEM)
    expect(mine).toHaveLength(1)
  })

  it('rewrites references to a resource the server renamed', async () => {
    const { client, calls } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))
    // An artifact stamped with the Encounter's CLIENT id, exactly as
    // useCorrelatedSave's stampEncounter produces.
    await source.saveArtifact(PATIENT, {
      resourceType: 'Communication',
      id: 'comm-1',
      status: 'completed',
      encounter: { reference: 'Encounter/encounter-abc' },
    } as unknown as FhirResource)

    const comm = calls.filter(c => c.method === 'POST').at(-1)?.body as {
      encounter?: { reference?: string }
    }
    // Without the rewrite this stays 'Encounter/encounter-abc' — a reference the
    // server has never held. It is accepted (a reference is just a string) and
    // the chart silently loses its correlation.
    expect(comm.encounter?.reference).toBe('Encounter/srv-1')
  })

  it('still converges when the server cannot answer an identifier search', async () => {
    const { client, calls, stored } = fakeClient({ searchable: false })
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))
    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'finished'))

    // The in-session map carries it: the search is an optimisation for
    // cross-session convergence, not the mechanism.
    expect(calls.filter(c => c.method !== 'GET').map(w => w.method)).toEqual(['POST', 'PUT'])
    expect([...stored.values()].filter(r => r.resourceType === 'Encounter')).toHaveLength(1)
  })

  /**
   * ⚠️ **The regression this file exists to prevent a second time.** The rewrite
   * was first applied in `saveArtifact`, all of the tests above passed, and the
   * first live write against Medplum still landed a QuestionnaireResponse and
   * two Observations pointing at an Encounter id the server had never held —
   * because the ladder writes through `createResource`, not `saveArtifact`.
   */
  it('rewrites references on the LADDER path too, not just saveArtifact', async () => {
    const { client, calls } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, encounter('encounter-abc', 'in-progress'))
    // What executeWritePlan drives, with the Encounter's CLIENT id stamped on.
    await source.createResource({
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      encounter: { reference: 'Encounter/encounter-abc' },
    } as unknown as FhirResource)

    const qr = calls.filter(c => c.method === 'POST').at(-1)?.body as {
      encounter?: { reference?: string }
    }
    expect(qr.encounter?.reference).toBe('Encounter/srv-1')
  })

  it('leaves non-lifecycle resources as plain creates', async () => {
    const { client, calls } = fakeClient()
    const source = new SmartDataSource(client as never)

    await source.saveArtifact(PATIENT, {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: { text: 'score' },
    } as unknown as FhirResource)

    const writes = calls.filter(c => c.method !== 'GET')
    expect(writes.map(w => w.method)).toEqual(['POST'])
    // An Observation is appended, not mutated, so it gets no client identifier.
    const body = writes[0].body as { identifier?: unknown[] }
    expect(body.identifier).toBeUndefined()
  })
})
