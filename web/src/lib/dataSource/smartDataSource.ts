/**
 * SmartDataSource — the SMART on FHIR implementation of `FhirDataSource`,
 * backed by an authorized fhirclient `Client`. Where `LocalDataSource` reads
 * and writes a localStorage store, this source reads the launch patient's real
 * chart resources from the connected FHIR server — QuestionnaireResponses,
 * Observations, CarePlans, Communications, the Stage-7 episode/flag/task set,
 * the Stage-5 handoff artifacts (DocumentReference, ServiceRequest,
 * Appointment, Consent), and the Stage-4 lethal-means counseling Procedure —
 * and writes submissions back.
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
import { parseCapabilityStatement } from '../writeback/capability'
import { buildConditionProposal } from '../writeback/conditionProposal'
import { buildDocumentReference } from '../writeback/documentReference'
import { executeWritePlan } from '../writeback/execute'
import { buildWritePlan, resolveConfig } from '../writeback/ladder'
import type {
  ServerCapabilities,
  WritebackArtifacts,
  WritebackConfig,
  WritebackReport,
  WritebackTarget,
} from '../writeback/types'
import type { DerivedArtifacts, FhirDataSource } from './types'
import type {
  AppointmentResource,
  CarePlanResource,
  CommunicationResource,
  ConsentResource,
  DocumentReferenceResource,
  EncounterResource,
  EpisodeOfCareResource,
  FlagResource,
  ProcedureResource,
  ServiceRequestResource,
  TaskResource,
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

/**
 * Turn a create failure into a scorecard-friendly message. fhirclient throws an
 * `HttpError`-ish value carrying a status (`statusCode`/`status`) and a message
 * that usually includes the server's OperationOutcome; we surface whatever is
 * present rather than a bare "request failed".
 */
function describeCreateError(resourceType: string, err: unknown): string {
  const e = err as { status?: number; statusCode?: number; message?: string; response?: { status?: number } }
  const status = e?.statusCode ?? e?.status ?? e?.response?.status
  const detail = e?.message ?? (typeof err === 'string' ? err : String(err))
  return status
    ? `Failed to create ${resourceType} — HTTP ${status}: ${detail}`
    : `Failed to create ${resourceType}: ${detail}`
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

/**
 * Which element carries the patient reference for a given resource type.
 *
 * Most SPiER artifacts use `subject`, but EpisodeOfCare and Consent use
 * `patient` and Task uses `for`. Writing `subject` onto those would produce
 * invalid FHIR that a strict server rejects (and a lenient one silently drops,
 * losing the patient link entirely).
 *
 * `null` means the type has no patient element at all — see `withPatientLink`.
 */
function patientRefField(resourceType: string): 'subject' | 'patient' | 'for' | null {
  switch (resourceType) {
    case 'EpisodeOfCare':
    case 'Consent':
      return 'patient'
    case 'Task':
      return 'for'
    // Appointment carries the patient as a participant.actor, not as a
    // top-level element. Handled by withPatientLink.
    case 'Appointment':
      return null
    default:
      return 'subject'
  }
}

/**
 * Attach the patient link in whichever element this resource type actually
 * uses.
 *
 * Appointment is the awkward one: it has neither `subject` nor `patient` — the
 * patient is one of `participant.actor`. The builders already produce that
 * participant, so here we only ensure the reference points at the server's
 * patient id (which differs from the client-side population id), and add the
 * participant if a resource arrived without one.
 */
function withPatientLink<T extends FhirResource>(resource: T, patientId: string): T {
  const reference = `Patient/${patientId}`
  const field = patientRefField(resource.resourceType)
  if (field) return { ...resource, [field]: { reference } }

  type Participant = { actor?: { reference?: string; display?: string }; status?: string }
  const participants = ((resource as { participant?: Participant[] }).participant ?? []).slice()
  const patientIdx = participants.findIndex(p => p.actor?.reference?.startsWith('Patient/'))
  if (patientIdx === -1) {
    participants.unshift({ actor: { reference }, status: 'accepted' })
  } else {
    participants[patientIdx] = {
      ...participants[patientIdx],
      actor: { ...participants[patientIdx].actor, reference },
    }
  }
  return { ...resource, participant: participants }
}

/**
 * Resources whose writes are lifecycle updates rather than appends: the Stage-7
 * episode/flag/task, plus the Stage-5 handoff artifacts, all of which are
 * tracked past creation (a referral to completed, an appointment to
 * fulfilled/noshow, a consent to revoked, a packet to superseded).
 */
const LIFECYCLE_RESOURCE_TYPES = new Set([
  'EpisodeOfCare',
  'Flag',
  'Task',
  'DocumentReference',
  'ServiceRequest',
  'Appointment',
  'Consent',
  // #263: an Encounter is opened, gains its episode reference when one opens,
  // gains Appointment references as they are booked, and is closed.
  'Encounter',
])

export class SmartDataSource implements FhirDataSource, WritebackTarget {
  private readonly listeners = new Set<() => void>()
  private readonly client: Client
  /** Writeback policy. Injected so the Tier-3 confirm flow can opt in per-write. */
  private readonly writebackConfig: WritebackConfig
  /**
   * The most recent writeback run, for the scorecard. Held here rather than
   * returned from `saveResponse` because `FhirDataSource.saveResponse` is
   * `Promise<void>` for every source, and widening that interface would push a
   * SMART-only concern onto LocalDataSource and every caller. Readers pick it
   * up through the existing `subscribe` notification.
   */
  private lastWriteback: WritebackReport | null = null

  constructor(client: Client, writebackConfig: WritebackConfig = {}) {
    this.client = client
    this.writebackConfig = writebackConfig
  }

  /** The last writeback run, or null before the first submission this session. */
  get writebackReport(): WritebackReport | null {
    return this.lastWriteback
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
    const [
      qrs,
      surveyObservations,
      procedureObservations,
      carePlans,
      communications,
      episodes,
      flags,
      tasks,
      documentReferences,
      serviceRequests,
      appointments,
      consents,
      procedures,
      encounters,
    ] = await Promise.all([
      this.search('QuestionnaireResponse', pid),
      this.search('Observation', pid, '&category=survey'),
      // Stage-4 means-safety actions are category `procedure`, not `survey` —
      // they record what was secured, not an instrument's answers. Best-effort
      // so a server that rejects the second query still returns a usable chart.
      this.search('Observation', pid, '&category=procedure').catch(() => [] as FhirResource[]),
      this.search('CarePlan', pid).catch(() => [] as FhirResource[]),
      this.search('Communication', pid).catch(() => [] as FhirResource[]),
      // Stage 7 (Track Risk Over Time). Best-effort like CarePlan/Communication:
      // a server may not grant these scopes, and the chart still works without them.
      this.search('EpisodeOfCare', pid).catch(() => [] as FhirResource[]),
      this.search('Flag', pid).catch(() => [] as FhirResource[]),
      this.search('Task', pid).catch(() => [] as FhirResource[]),
      // Stage 5 (Coordinate Handoffs) — best-effort for the same reason.
      this.search('DocumentReference', pid).catch(() => [] as FhirResource[]),
      this.search('ServiceRequest', pid).catch(() => [] as FhirResource[]),
      this.search('Appointment', pid).catch(() => [] as FhirResource[]),
      this.search('Consent', pid).catch(() => [] as FhirResource[]),
      // Stage 4 (Document Safety Actions) — the lethal-means counseling
      // Procedure the Stage-8 measure counts. Best-effort for the same reason.
      this.search('Procedure', pid).catch(() => [] as FhirResource[]),
      // #263 correlation hinge. Best-effort like the rest: without it the chart
      // still renders, it just cannot group artifacts by contact.
      this.search('Encounter', pid).catch(() => [] as FhirResource[]),
    ])

    // A server may return the same Observation under both category queries.
    const observations = [...surveyObservations, ...procedureObservations].filter(
      (o, i, all) => !o.id || all.findIndex(x => x.id === o.id) === i,
    )

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
      episodes: episodes as EpisodeOfCareResource[],
      flags: flags as FlagResource[],
      tasks: tasks as TaskResource[],
      documentReferences: documentReferences as DocumentReferenceResource[],
      serviceRequests: serviceRequests as ServiceRequestResource[],
      appointments: appointments as AppointmentResource[],
      consents: consents as ConsentResource[],
      procedures: procedures as ProcedureResource[],
      encounters: encounters as EncounterResource[],
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
   * WritebackTarget — create a single resource, scoped to the launch patient,
   * surfacing failures as thrown Errors that carry the HTTP status (and any
   * OperationOutcome detail fhirclient captured) so the writeback executor can
   * record a readable outcome in the scorecard. Unlike the private `create`,
   * this is the public, per-resource primitive the ladder drives.
   */
  async createResource(resource: FhirResource): Promise<{ id?: string }> {
    const pid = this.resolvePatientId(null)
    const payload = this.toCreatePayload(resource, pid)
    try {
      return { id: await this.create(payload) }
    } catch (err) {
      throw new Error(describeCreateError(resource.resourceType, err))
    }
  }

  /**
   * Fetch + parse the connected server's CapabilityStatement so the ladder can
   * probe which discrete tiers are supported. Best-effort: any failure yields
   * empty capabilities (the ladder then relies on the Tier-0 floor).
   */
  async fetchCapabilities(): Promise<ServerCapabilities> {
    try {
      return parseCapabilityStatement(await this.client.request<unknown>('metadata'))
    } catch {
      return {}
    }
  }

  /**
   * Strip client-only fields before POST: servers reject or ignore a
   * client-supplied `id` on create, and `_savedAt` is a local persistence
   * stamp that FHIR JSON would misparse as a primitive extension.
   */
  private toCreatePayload<T extends FhirResource>(resource: T, patientId: string): T {
    const clean = withPatientLink(resource, patientId)
    delete (clean as { id?: string }).id
    delete (clean as { _savedAt?: string })._savedAt
    return clean as T
  }

  /**
   * Write a lifecycle resource with PUT (update-as-create), keeping the
   * client-supplied id.
   *
   * These are the resources that are *mutated* rather than appended — an
   * episode is opened then closed, a flag raised then cleared, a task created
   * then completed, a referral tracked through to completed, an appointment
   * resolved to fulfilled or noshow. POSTing each transition would leave the
   * superseded version on the server, so a closed episode would still read as
   * open and a completed referral as outstanding. Keeping the client id and
   * PUTting makes the server converge on the same upsert-by-id semantics the
   * local store uses.
   *
   * Caveat: this relies on the server permitting update-as-create (FHIR allows
   * it, but a server may reject a client-supplied id). Failures propagate to the
   * caller's save-error handling rather than being swallowed.
   */
  private async put(resource: FhirResource): Promise<void> {
    await this.client.request({
      url: `${resource.resourceType}/${resource.id}`,
      method: 'PUT',
      body: JSON.stringify(resource),
      headers: { 'content-type': 'application/fhir+json' },
    })
  }

  /**
   * Probe the server's create capabilities, distinguishing "it told us nothing"
   * from "we could not ask".
   *
   * `fetchCapabilities` (the public WritebackTarget-side helper) collapses both
   * into `{}`, which is fine for the ladder — either way it degrades to the
   * Tier-0 floor — but NOT for the scorecard, whose whole job is explaining why
   * a tier did not land. Reporting a failed probe as "the EHR does not support
   * QuestionnaireResponse" would be a false readiness claim.
   */
  private async probeCapabilities(): Promise<{ caps: ServerCapabilities; ok: boolean }> {
    try {
      const caps = parseCapabilityStatement(await this.client.request<unknown>('metadata'))
      // A real FHIR server always advertises something; an empty parse means the
      // body was not a readable CapabilityStatement.
      return { caps, ok: Object.keys(caps).length > 0 }
    } catch {
      return { caps: {}, ok: false }
    }
  }

  /**
   * A `WritebackTarget` bound to an explicit patient id.
   *
   * The public `createResource` resolves the patient from the launch context
   * (`resolvePatientId(null)`), which is right for an unscoped caller but wrong
   * here: `saveResponse` receives the slice key and must scope its writes to
   * that patient even if it differs from `client.patient.id`.
   */
  private targetFor(pid: string): WritebackTarget {
    return {
      createResource: async (resource: FhirResource) => {
        try {
          return { id: await this.create(this.toCreatePayload(resource, pid)) }
        } catch (err) {
          throw new Error(describeCreateError(resource.resourceType, err))
        }
      },
    }
  }

  /**
   * Persist a completed instrument by climbing the writeback ladder
   * (`lib/writeback/`), recording every outcome for the scorecard.
   *
   * This replaced a hand-rolled Tier-1 + Tier-2 sequence that did the same two
   * writes with the same QR-id remapping, but had no capability probing, no
   * Tier-0 floor, and no record of what failed — so a server that rejected
   * Observations lost the data silently. The ladder is a strict generalization
   * of that code; see docs/plans/smart-filler-writeback-ladder.md.
   *
   * Failures do NOT reject: the ladder records them as step outcomes so a
   * partial writeback is visible rather than fatal. A total failure is still
   * reported — see the throw at the end — because PatientContext's save-error
   * surface is what tells the user nothing landed.
   */
  async saveResponse(
    patientId: string | null,
    entry: StoredResponse,
    derived: DerivedArtifacts | null,
  ): Promise<void> {
    const pid = this.resolvePatientId(patientId)
    const cfg = resolveConfig(this.writebackConfig)

    // `authored` must be set before the Tier-0 narrative is rendered: it
    // supplies the DocumentReference date and the "Completed:" line.
    const qr: QuestionnaireResponseResource = {
      ...entry.resource,
      ...(entry.resource.authored ? {} : { authored: entry.completedAt }),
    }

    // The Tier-0 attachment embeds this QR as recoverable FHIR JSON, so it goes
    // through `toCreatePayload` — the same transform the POSTed copy gets. That
    // is deliberate on both halves:
    //  - it adds the patient link, because an extracted QR that does not say who
    //    it is about is not recoverable in any useful sense; and
    //  - it strips the client-minted `id` and `_savedAt`, the latter being a
    //    local persistence stamp that a FHIR parser reads as a primitive
    //    extension for a nonexistent `savedAt` element. Embedding it would put
    //    invalid FHIR inside the artifact whose whole purpose is recoverability.
    // So the attachment is exactly the resource SPiER would have written.
    const documentReference = buildDocumentReference({
      qr: this.toCreatePayload(qr, pid),
      patientId: pid,
      title: entry.questionnaireName,
      riskAlert: derived?.riskAlert ?? null,
    })

    // Tier 3 is built only when enabled — `WritebackArtifacts.condition` present
    // means "a proposal was warranted", and buildWritePlan reads it that way.
    // buildConditionProposal returns null for a negative screen.
    const condition =
      cfg.enableConditionProposal && derived?.riskAlert
        ? buildConditionProposal({
            riskAlert: derived.riskAlert,
            patientId: pid,
            derivedFromRefs: [`QuestionnaireResponse/${entry.id}`],
            recordedDate: entry.completedAt,
          })
        : null

    const artifacts: WritebackArtifacts = {
      // Keeps the client id: `executeWritePlan` needs it to remap the
      // `QuestionnaireResponse/<id>` references inside the Observations and the
      // Condition proposal to the server-assigned id. `toCreatePayload` strips
      // it before the POST.
      qr,
      observations: derived?.observations ?? [],
      documentReference,
      ...(condition ? { condition } : {}),
    }

    const { caps, ok } = await this.probeCapabilities()
    const plan = buildWritePlan(caps, this.writebackConfig, artifacts)
    const result = await executeWritePlan(plan, this.targetFor(pid), artifacts, this.writebackConfig)

    this.lastWriteback = {
      at: new Date().toISOString(),
      config: cfg,
      capabilities: caps,
      capabilitiesKnown: ok,
      result,
    }
    // derived.riskAlert is not persisted — getSlice recomputes alerts from
    // the QRs, so the alert reappears on the post-save refresh.
    this.notify()

    // Nothing landed at all — not even the universal floor. That is a failed
    // save, not a degraded one, so it must reach the caller's error surface
    // instead of being reported only in the scorecard.
    if (!result.steps.some(step => step.outcome === 'written')) {
      const detail = result.steps
        .map(step => `${step.resourceType}: ${step.error ?? step.reason ?? step.outcome}`)
        .join('; ')
      throw new Error(`Writeback failed — no resource was created. ${detail}`)
    }
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
    if (LIFECYCLE_RESOURCE_TYPES.has(resource.resourceType) && resource.id) {
      // Preserve the client id so open→close converges on one resource.
      await this.put({ ...payload, id: resource.id })
    } else {
      await this.create(payload)
    }
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
