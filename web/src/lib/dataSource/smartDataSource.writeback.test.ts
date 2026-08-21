/**
 * SmartDataSource.saveResponse → the writeback ladder (#350).
 *
 * This is the seam the ladder was missing: `web/src/lib/writeback/` sat on main
 * with 28 passing tests and zero callers. Those tests cover the ladder's own
 * modules; these cover the thing none of them could — that the data source
 * actually drives it, with the app's real artifacts.
 *
 * ⚠️ Fixture policy, per issue #327: the QuestionnaireResponse is built by
 * `nativeQr` (which derives every `value[x]` from the Questionnaire JSON) and the
 * derived artifacts come from `deriveFromResponse` — the same call PatientProvider
 * makes. Nothing here hand-writes a resource shape. #327 is this repo's proof
 * that hand-built fixtures certify a mapper against input the app never
 * produces; the same trap applies to a writeback driver, whose Tier-0 narrative
 * and Tier-2 provenance both read real artifact structure.
 */
import { describe, it, expect } from 'vitest'
import { SmartDataSource } from '@spier/core/lib/dataSource/smartDataSource'
import { deriveFromResponse } from '@spier/core/lib/deriveFromResponse'
import { nativeQr } from '../observationMappers/__fixtures__/nativeQr'
import type { StoredResponse, FhirResource } from '@spier/core/types/fhir'

const CSSRS_SCREENER = 'http://spier.org/Questionnaire/C-SSRS-Screener'
const PATIENT = 'smart-pt-1'

/** Every type the ladder can write. */
const ALL_TYPES = ['QuestionnaireResponse', 'Observation', 'Condition', 'DocumentReference']

function capabilityStatement(types: string[]) {
  return {
    resourceType: 'CapabilityStatement',
    rest: [
      {
        mode: 'server',
        resource: types.map(type => ({ type, interaction: [{ code: 'read' }, { code: 'create' }] })),
      },
    ],
  }
}

interface FakeOpts {
  /** Types the server advertises `create` for. */
  creatable?: string[]
  /** Resource types whose POST should fail. */
  reject?: string[]
  /** Make the /metadata probe fail outright. */
  metadataFails?: boolean
}

/**
 * A fake fhirclient `Client` covering only the two request forms saveResponse
 * uses: the `'metadata'` string form and the `includeResponse` POST form. It
 * mirrors the real contract — echoing the created resource so `create` reads
 * `body.id` — so the id-remapping path under test is the real one.
 */
function fakeClient(opts: FakeOpts = {}) {
  const posted: FhirResource[] = []
  const counts: Record<string, number> = {}
  const client = {
    patient: { id: PATIENT },
    async request(arg: unknown) {
      if (arg === 'metadata') {
        if (opts.metadataFails) throw new Error('HTTP 404 metadata not found')
        return capabilityStatement(opts.creatable ?? ALL_TYPES)
      }
      const req = arg as { url: string; method?: string; body?: string }
      if (req.method !== 'POST') throw new Error(`unexpected request: ${req.url}`)
      const resource = JSON.parse(req.body ?? '{}') as FhirResource
      if (opts.reject?.includes(resource.resourceType)) {
        throw Object.assign(new Error('rejected by server'), { status: 422 })
      }
      posted.push(resource)
      counts[resource.resourceType] = (counts[resource.resourceType] ?? 0) + 1
      const id = `srv-${resource.resourceType}-${counts[resource.resourceType]}`
      return { body: { ...resource, id }, response: { headers: new Headers() } }
    },
  }
  return { client, posted }
}

/** A real C-SSRS screener response + the artifacts the app derives from it. */
function submission(answers: Record<string, boolean>) {
  const id = 'client-qr-1'
  const resource = { ...nativeQr(CSSRS_SCREENER, answers), id }
  const entry: StoredResponse = {
    id,
    questionnaireName: 'C-SSRS Screener',
    completedAt: '2026-08-18T10:00:00.000Z',
    resource,
  }
  return { entry, derived: deriveFromResponse(resource) }
}

const typesOf = (posted: FhirResource[]) => posted.map(r => r.resourceType)
const step = (source: SmartDataSource, tier: number) =>
  source.writebackReport?.result.steps.find(s => s.tier === tier)

// A guard on the fixture itself: every assertion below about Tier 2 and Tier 3
// assumes this response derives Observations AND an elevated risk alert. If the
// mapper or the Questionnaire changes so it does not, these tests must fail
// here rather than silently testing an empty ladder.
describe('fixture sanity', () => {
  it('a q5-endorsed C-SSRS screener derives Observations and an elevated alert', () => {
    const { derived } = submission({ q1: true, q5: true })
    expect(derived).not.toBeNull()
    expect(derived!.observations.length).toBeGreaterThan(0)
    expect(derived!.riskAlert.level).not.toBe('none')
  })
})

describe('saveResponse — full capability', () => {
  it('writes the QR then the Observations, and skips the floor', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    // QR first — the higher rungs reference its server id.
    expect(typesOf(posted)[0]).toBe('QuestionnaireResponse')
    expect(typesOf(posted)).toContain('Observation')
    // Discrete tiers all landed, so the Tier-0 floor is not needed.
    expect(typesOf(posted)).not.toContain('DocumentReference')
    expect(step(source, 0)?.outcome).toBe('skipped')
    expect(step(source, 1)?.outcome).toBe('written')
    expect(step(source, 2)?.outcome).toBe('written')
  })

  it('remaps Observation.derivedFrom from the client QR id to the server id', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    const observations = posted.filter(r => r.resourceType === 'Observation')
    expect(observations.length).toBeGreaterThan(0)
    const refs = observations.flatMap(
      o => ((o as { derivedFrom?: { reference?: string }[] }).derivedFrom ?? []).map(d => d.reference),
    )
    expect(refs).toContain('QuestionnaireResponse/srv-QuestionnaireResponse-1')
    expect(refs).not.toContain(`QuestionnaireResponse/${entry.id}`)
  })

  it('strips the client id and scopes every write to the patient', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    for (const resource of posted) {
      expect((resource as { id?: string }).id).toBeUndefined()
    }
    const qr = posted[0] as { subject?: { reference?: string } }
    expect(qr.subject?.reference).toBe(`Patient/${PATIENT}`)
  })
})

describe('saveResponse — the Tier-0 floor', () => {
  it('fires when the server cannot create Observations, and records why', async () => {
    const { client, posted } = fakeClient({ creatable: ['QuestionnaireResponse', 'DocumentReference'] })
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    expect(typesOf(posted)).toContain('DocumentReference')
    expect(typesOf(posted)).not.toContain('Observation')
    expect(step(source, 2)?.outcome).toBe('skipped')
    expect(step(source, 2)?.reason).toMatch(/does not support create/i)
    expect(step(source, 0)?.outcome).toBe('written')
  })

  it('fires when a discrete write is attempted and fails', async () => {
    const { client, posted } = fakeClient({ reject: ['Observation'] })
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    expect(step(source, 2)?.outcome).toBe('failed')
    expect(step(source, 2)?.error).toMatch(/HTTP 422/)
    // The data is not lost: the floor carries it as recoverable JSON.
    expect(typesOf(posted)).toContain('DocumentReference')
    expect(step(source, 0)?.outcome).toBe('written')
  })

  it('carries the QR as a patient-linked, recoverable JSON attachment', async () => {
    const { client, posted } = fakeClient({ creatable: ['DocumentReference'] })
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    const doc = posted.find(r => r.resourceType === 'DocumentReference') as {
      content?: { attachment?: { contentType?: string; data?: string } }[]
    }
    const json = doc.content?.find(c => c.attachment?.contentType === 'application/fhir+json')
    expect(json).toBeDefined()
    const recovered = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(json!.attachment!.data!), c => c.charCodeAt(0))),
    ) as {
      resourceType: string
      id?: string
      _savedAt?: string
      subject?: { reference?: string }
      item?: unknown[]
    }
    expect(recovered.resourceType).toBe('QuestionnaireResponse')
    // An extracted QR that does not say who it is about is not recoverable.
    expect(recovered.subject?.reference).toBe(`Patient/${PATIENT}`)
    expect(recovered.item?.length).toBeGreaterThan(0)
    // ...and it must be VALID FHIR: no client-minted id, and no `_savedAt`,
    // which a parser reads as a primitive extension for a nonexistent element.
    expect(recovered.id).toBeUndefined()
    expect(recovered._savedAt).toBeUndefined()
  })
})

describe('saveResponse — Tier 3 governance', () => {
  it('never writes a Condition by default, even on an elevated screen', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    expect(typesOf(posted)).not.toContain('Condition')
    // Absent from the plan entirely — the scorecard states this from the config.
    expect(step(source, 3)).toBeUndefined()
    expect(source.writebackReport?.config.enableConditionProposal).toBe(false)
  })

  it('proposes an unconfirmed Condition when explicitly opted in', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never, { enableConditionProposal: true })
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    const condition = posted.find(r => r.resourceType === 'Condition') as {
      verificationStatus?: { coding?: { code?: string }[] }
      evidence?: { detail?: { reference?: string }[] }[]
    }
    expect(condition).toBeDefined()
    expect(condition.verificationStatus?.coding?.[0]?.code).toBe('unconfirmed')
    // Provenance points at the SERVER-assigned QR id, not the client one.
    expect(condition.evidence?.[0]?.detail?.[0]?.reference).toBe(
      'QuestionnaireResponse/srv-QuestionnaireResponse-1',
    )
    expect(step(source, 3)?.outcome).toBe('written')
  })
})

describe('saveResponse — the capability probe', () => {
  it('reports a failed probe as unknown, not as "unsupported"', async () => {
    const { client, posted } = fakeClient({ metadataFails: true })
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    // The distinction the scorecard depends on: we could not ask, so the tiers
    // below must not be presented as refused by the server.
    expect(source.writebackReport?.capabilitiesKnown).toBe(false)
    // With nothing advertised, only the universal floor is attempted.
    expect(typesOf(posted)).toEqual(['DocumentReference'])
  })

  it('reports a successful probe as known', async () => {
    const { client } = fakeClient()
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, derived)

    expect(source.writebackReport?.capabilitiesKnown).toBe(true)
  })
})

describe('saveResponse — total failure', () => {
  it('throws when not one resource landed, so the UI shows a save error', async () => {
    const { client } = fakeClient({ reject: ALL_TYPES })
    const source = new SmartDataSource(client as never)
    const { entry, derived } = submission({ q1: true, q5: true })

    await expect(source.saveResponse(PATIENT, entry, derived)).rejects.toThrow(/Writeback failed/)
    // The scorecard is still populated — a failed save is exactly when the
    // readiness diagnostic matters most.
    expect(source.writebackReport?.result.steps.every(s => s.outcome !== 'written')).toBe(true)
  })
})

describe('saveResponse — an instrument with no Observations', () => {
  it('omits Tier 2, and the clean QR write satisfies the ladder', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never)
    const { entry } = submission({ q1: true, q5: true })

    // `derived === null` is what deriveFromResponse returns for a QR with no
    // mapper (Stanley-Brown / CAMS produce CarePlans instead).
    await source.saveResponse(PATIENT, entry, null)

    expect(step(source, 2)).toBeUndefined()
    expect(step(source, 1)?.outcome).toBe('written')
    // The floor is conditional, so a clean discrete write skips it — the
    // DEFAULT policy (`alwaysWriteDocument: false`). Worth knowing: an EHR can
    // store a QuestionnaireResponse and still have no viewer that renders one,
    // and the Tier-0 narrative is the only human-readable artifact SPiER writes.
    // A deployment that wants it regardless sets `alwaysWriteDocument`.
    expect(typesOf(posted)).toEqual(['QuestionnaireResponse'])
    expect(step(source, 0)?.outcome).toBe('skipped')
  })

  it('writes the readable narrative anyway when alwaysWriteDocument is set', async () => {
    const { client, posted } = fakeClient()
    const source = new SmartDataSource(client as never, { alwaysWriteDocument: true })
    const { entry } = submission({ q1: true, q5: true })

    await source.saveResponse(PATIENT, entry, null)

    expect(typesOf(posted)).toEqual(['QuestionnaireResponse', 'DocumentReference'])
    expect(step(source, 0)?.outcome).toBe('written')
  })
})
