/**
 * SmartDataSource — the SMART on FHIR implementation of `FhirDataSource`,
 * backed by an authorized fhirclient `Client`. Where `LocalDataSource` reads
 * and writes a localStorage store, this source reads the launch patient's
 * real QuestionnaireResponses / Observations / CarePlans / Communications
 * from the connected FHIR server and POSTs submissions back.
 *
 * Design notes:
 *  - Risk alerts are recomputed locally by running each QuestionnaireResponse
 *    through `deriveFromResponse` (the same business logic the local store
 *    uses) rather than trusting server Observations — the alert is a SPiER UI
 *    concept, not a server resource.
 *  - Dispatch is canonical-first: QRs written by SPiER (or servers reusing
 *    SPiER canonicals) map directly. A foreign QR whose canonical doesn't
 *    match now also produces alerts/Observations when its instrument is
 *    recognized from standardized LOINC item codes (Tier 2 — see
 *    observationMappers/fallbackDispatch); such results are stamped as
 *    inferred. We do NOT opt into the Tier-3 shape heuristic here, so a QR
 *    with neither a matching canonical nor recognizable item codes still
 *    renders as unmapped activity ("Other activity" bucket when unstaged).
 *  - Write failures propagate to the caller (PatientContext surfaces them in
 *    the UI). There is deliberately no silent fallback to localStorage.
 */
import type Client from 'fhirclient/lib/Client'
import { toolForQuestionnaireUrl, stripCanonicalVersion } from '../../data/catalog'
import { deriveFromResponse } from '../deriveFromResponse'
import { stageForArtifact, PATHWAY_STAGE_SYSTEM, type FhirResourceLike } from '../patientPathway'
import type { RiskAlert } from '../observationMappers'
import type { DerivedArtifacts, FhirDataSource } from './types'
import type {
  CarePlanResource,
  CommunicationResource,
  FhirResource,
  ObservationResource,
  PatientSlice,
  QuestionnaireResponseResource,
  StoredResponse,
} from '../../types/fhir'

/** Display name for a fetched QR: catalog tool by canonical URL, else the
 *  canonical's last path segment, else the resource id. */
function questionnaireNameFor(qr: QuestionnaireResponseResource): string {
  const tool = toolForQuestionnaireUrl(qr.questionnaire)
  if (tool) return tool.shortName ?? tool.name
  if (qr.questionnaire) {
    const tail = stripCanonicalVersion(qr.questionnaire).split('/').pop()
    if (tail) return tail
  }
  return `QuestionnaireResponse/${qr.id ?? 'unknown'}`
}

function toStoredResponse(qr: QuestionnaireResponseResource): StoredResponse {
  const meta = qr.meta as { lastUpdated?: string } | undefined
  return {
    id: qr.id ?? `qr-${Math.random().toString(36).slice(2)}`,
    questionnaireName: questionnaireNameFor(qr),
    completedAt: qr.authored ?? meta?.lastUpdated ?? '',
    resource: qr,
  }
}

export class SmartDataSource implements FhirDataSource {
  private readonly listeners = new Set<() => void>()
  private readonly client: Client

  constructor(client: Client) {
    this.client = client
  }

  private resolvePatientId(patientId: string | null): string {
    const pid = patientId ?? this.client.patient.id
    if (!pid) throw new Error('The SMART launch did not include a patient context.')
    return pid
  }

  /** Patient-scoped search, following pagination and unwrapping bundle entries. */
  private async search(resourceType: string, patientId: string, extraParams = ''): Promise<FhirResource[]> {
    const result = await this.client.request<unknown>(
      `${resourceType}?patient=${encodeURIComponent(patientId)}${extraParams}`,
      { pageLimit: 0, flat: true },
    )
    // flat:true yields the entry resources; filter defensively (bundles can
    // carry OperationOutcome entries or _included resources of other types).
    return (Array.isArray(result) ? result : []).filter(
      (r): r is FhirResource =>
        !!r && typeof r === 'object' && (r as FhirResource).resourceType === resourceType,
    )
  }

  async getSlice(patientId: string | null): Promise<PatientSlice> {
    const pid = this.resolvePatientId(patientId)
    // QRs and Observations are the chart's core data — failures there surface
    // as the chart's error state. CarePlan/Communication reads are
    // best-effort (a server may not grant those scopes) and degrade to empty.
    const [qrs, observations, carePlans, communications] = await Promise.all([
      this.search('QuestionnaireResponse', pid),
      this.search('Observation', pid, '&category=survey'),
      this.search('CarePlan', pid).catch(() => [] as FhirResource[]),
      this.search('Communication', pid).catch(() => [] as FhirResource[]),
    ])

    const responses = qrs
      .map(qr => toStoredResponse(qr as QuestionnaireResponseResource))
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())

    // Recompute risk alerts from the QRs in chronological order, keeping the
    // latest alert per tool — the same upsert semantics as the local store.
    let riskAlerts: RiskAlert[] = []
    for (const r of responses) {
      const derived = deriveFromResponse(r.resource)
      if (!derived) continue
      riskAlerts = [...riskAlerts.filter(a => a.tool !== derived.riskAlert.tool), derived.riskAlert]
    }

    return {
      responses,
      observations: observations as ObservationResource[],
      carePlans: carePlans as CarePlanResource[],
      communications: communications as CommunicationResource[],
      riskAlerts,
    }
  }

  /**
   * POST a resource and return the server-assigned id. Prefers the echoed
   * resource body (`Prefer: return=representation`); falls back to parsing
   * the Location header for servers that return 201 with no body.
   */
  private async create(resource: FhirResource): Promise<string | undefined> {
    const { body, response } = await this.client.request<{
      body: FhirResource | null
      response: Response
    }>({
      url: resource.resourceType,
      method: 'POST',
      body: JSON.stringify(resource),
      headers: {
        'content-type': 'application/fhir+json',
        prefer: 'return=representation',
      },
      includeResponse: true,
    })
    if (body?.id) return body.id
    const location = response.headers.get('location') ?? response.headers.get('content-location')
    return location?.match(new RegExp(`${resource.resourceType}/([^/]+)`))?.[1]
  }

  /**
   * Strip client-only fields before POST: servers reject or ignore a
   * client-supplied `id` on create, and `_savedAt` is a local persistence
   * stamp that FHIR JSON would misparse as a primitive extension.
   */
  private toCreatePayload<T extends FhirResource>(resource: T, patientId: string): T {
    const clean = { ...resource, subject: { reference: `Patient/${patientId}` } }
    delete (clean as { id?: string }).id
    delete (clean as { _savedAt?: string })._savedAt
    return clean
  }

  async saveResponse(
    patientId: string | null,
    entry: StoredResponse,
    derived: DerivedArtifacts | null,
  ): Promise<void> {
    const pid = this.resolvePatientId(patientId)

    // Create the QR first — the derived Observations' derivedFrom must point
    // at the server-assigned id, not the client-minted one.
    const qr = this.toCreatePayload(entry.resource, pid)
    if (!qr.authored) qr.authored = entry.completedAt
    const serverQrId = await this.create(qr)

    for (const obs of derived?.observations ?? []) {
      const payload = this.toCreatePayload(obs, pid)
      if (serverQrId) {
        const derivedFrom = (payload.derivedFrom ?? []) as { reference?: string }[]
        payload.derivedFrom = derivedFrom.map(d =>
          d.reference === `QuestionnaireResponse/${entry.id}`
            ? { reference: `QuestionnaireResponse/${serverQrId}` }
            : d,
        )
      }
      await this.create(payload)
    }
    // derived.riskAlert is not persisted — getSlice recomputes alerts from
    // the QRs, so the alert reappears on the post-save refresh.
    this.notify()
  }

  async saveArtifact(patientId: string | null, resource: FhirResource): Promise<void> {
    const pid = this.resolvePatientId(patientId)
    const payload = this.toCreatePayload(resource, pid)
    // Make the pathway stage explicit before the resource leaves the client:
    // local stage resolution can rely on client-side id conventions (e.g.
    // CarePlan ids like "careplan-stanley-brown-…"), which the server-assigned
    // id won't preserve. A meta.tag against the pathway-stage system is the
    // self-describing channel stageForArtifact reads first.
    const stageId = stageForArtifact(resource as FhirResourceLike)
    const meta = (payload.meta ?? {}) as { tag?: { system?: string; code?: string }[] }
    const alreadyTagged = meta.tag?.some(t => t.system === PATHWAY_STAGE_SYSTEM)
    if (stageId && !alreadyTagged) {
      payload.meta = { ...meta, tag: [...(meta.tag ?? []), { system: PATHWAY_STAGE_SYSTEM, code: stageId }] }
    }
    await this.create(payload)
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
