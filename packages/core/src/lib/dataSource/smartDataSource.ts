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
import type { SmartClient } from '../../types/smartClient'
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
import type { RegistryPatient } from '../registry'
import { toRegistryPatient } from './registryPatient'
import type { DerivedArtifacts, FhirDataSource } from './types'
import { LIFECYCLE_RESOURCE_TYPES } from './lifecycleTypes'
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
 * Which patient a fetched resource belongs to, read through the same table
 * `patientRefField` writes through.
 *
 * ⚠️ **Needed only by the COHORT read.** A patient-scoped search already knows
 * whose resources came back; a search that asked for fourteen patients at once
 * does not, and has to sort the Bundle out again. Appointment is the awkward
 * one in this direction too — its patient is a `participant.actor` and not a
 * top-level element — so the `null` from `patientRefField` is a real branch
 * here rather than a fall-through.
 */
function patientIdOf(resource: FhirResource): string | undefined {
  const idFrom = (ref: unknown): string | undefined => {
    const value = (ref as { reference?: unknown } | undefined)?.reference
    if (typeof value !== 'string') return undefined
    return /(?:^|\/)Patient\/([^/?]+)$/.exec(value)?.[1]
  }
  const field = patientRefField(resource.resourceType)
  if (field) return idFrom((resource as Record<string, unknown>)[field])
  const participants = (resource as { participant?: Array<{ actor?: unknown }> }).participant ?? []
  for (const p of participants) {
    const id = idFrom(p?.actor)
    if (id) return id
  }
  return undefined
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


/** Where one search's results land while a slice is being assembled. */
type SliceKey =
  | 'questionnaireResponses'
  | 'surveyObservations'
  | 'procedureObservations'
  | 'carePlans'
  | 'communications'
  | 'episodes'
  | 'flags'
  | 'tasks'
  | 'documentReferences'
  | 'serviceRequests'
  | 'appointments'
  | 'consents'
  | 'procedures'
  | 'encounters'

type SliceBuckets = Record<SliceKey, FhirResource[]>

interface SliceRead {
  key: SliceKey
  type: string
  params: string
  /**
   * The chart's core data: a failure here surfaces as the chart's error state.
   * Everything else is best-effort — a server may not grant those scopes, and
   * the chart still works without them — and degrades to an empty bucket.
   */
  core?: true
}

/**
 * The fourteen searches a chart slice is made of.
 *
 * ⚠️ **A table rather than fourteen lines of `Promise.all`, because there are
 * now TWO readers of it** — `getSlice` for one patient and `getSlices` for a
 * whole cohort — and fourteen searches written out twice is exactly the
 * hand-duplicated list this repo has `check:dupes` for. Adding a type here
 * adds it to both reads and to the slice.
 */
const SLICE_READS: SliceRead[] = [
  { key: 'questionnaireResponses', type: 'QuestionnaireResponse', params: '', core: true },
  { key: 'surveyObservations', type: 'Observation', params: '&category=survey', core: true },
  // Stage-4 means-safety actions are category `procedure`, not `survey` — they
  // record what was secured, not an instrument's answers. Best-effort so a
  // server that rejects the second query still returns a usable chart.
  { key: 'procedureObservations', type: 'Observation', params: '&category=procedure' },
  { key: 'carePlans', type: 'CarePlan', params: '' },
  { key: 'communications', type: 'Communication', params: '' },
  // Stage 7 (Track Risk Over Time).
  { key: 'episodes', type: 'EpisodeOfCare', params: '' },
  { key: 'flags', type: 'Flag', params: '' },
  { key: 'tasks', type: 'Task', params: '' },
  // Stage 5 (Coordinate Handoffs).
  { key: 'documentReferences', type: 'DocumentReference', params: '' },
  { key: 'serviceRequests', type: 'ServiceRequest', params: '' },
  { key: 'appointments', type: 'Appointment', params: '' },
  { key: 'consents', type: 'Consent', params: '' },
  // Stage 4 (Document Safety Actions) — the lethal-means counseling Procedure
  // the Stage-8 measure counts.
  { key: 'procedures', type: 'Procedure', params: '' },
  // #263 correlation hinge: without it the chart still renders, it just cannot
  // group artifacts by contact.
  { key: 'encounters', type: 'Encounter', params: '' },
]

function emptyBuckets(): SliceBuckets {
  return Object.fromEntries(SLICE_READS.map(r => [r.key, [] as FhirResource[]])) as SliceBuckets
}

/** One patient's buckets, turned into the slice the app reads. */
function assembleSlice(buckets: SliceBuckets): PatientSlice {
  // A server may return the same Observation under both category queries.
  const observations = [...buckets.surveyObservations, ...buckets.procedureObservations].filter(
    (o, i, all) => !o.id || all.findIndex(x => x.id === o.id) === i,
  )

  const responses = buckets.questionnaireResponses
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
    carePlans: buckets.carePlans as CarePlanResource[],
    communications: buckets.communications as CommunicationResource[],
    episodes: buckets.episodes as EpisodeOfCareResource[],
    flags: buckets.flags as FlagResource[],
    tasks: buckets.tasks as TaskResource[],
    documentReferences: buckets.documentReferences as DocumentReferenceResource[],
    serviceRequests: buckets.serviceRequests as ServiceRequestResource[],
    appointments: buckets.appointments as AppointmentResource[],
    consents: buckets.consents as ConsentResource[],
    procedures: buckets.procedures as ProcedureResource[],
    encounters: buckets.encounters as EncounterResource[],
    riskAlerts,
  }
}

export class SmartDataSource implements FhirDataSource, WritebackTarget {
  private readonly listeners = new Set<() => void>()
  private readonly client: SmartClient
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
  /**
   * `<Type>/<client id>` → the server's id for that resource, learned from the
   * create that produced it (or from a lookup by identifier).
   *
   * ⚠️ **This is what replaced update-as-create, and the replacement was not
   * optional.** SPiER used to write the eight `LIFECYCLE_RESOURCE_TYPES` as
   * `PUT <Type>/<client-minted id>`, which needs the server to create a
   * resource at an id the client chose. FHIR permits that; real servers
   * frequently refuse it. Medplum answers `400 Invalid id` to a prefixed id and
   * `404` to a bare UUID that does not exist yet — so the id FORMAT was never
   * the issue, it has no update-as-create at all. Since `ensureEncounter()`
   * runs before nearly every save, that one refusal blocked EVERY write.
   *
   * POST-to-create plus PUT-by-server-id uses only the two write interactions
   * every FHIR server supports. The cost is that the server's id has to be
   * remembered, which is what this map is.
   */
  private readonly serverIds = new Map<string, string>()

  constructor(client: SmartClient, writebackConfig: WritebackConfig = {}) {
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

  /**
   * Patient-scoped search, following pagination and unwrapping bundle entries.
   *
   * ⚠️ **Takes a LIST of patients, and the comma is the point.** A comma
   * separated list of values on a reference parameter is core FHIR search
   * semantics for OR, and it is what turns a fourteen-patient cohort read from
   * 196 requests into 14 (clinical-app audit §8.8). Each id is encoded on its
   * own and the separators are left literal, because a percent-encoded comma is
   * a comma INSIDE one value on a server that reads the query string strictly.
   */
  private async search(resourceType: string, patientIds: string[], extraParams = ''): Promise<FhirResource[]> {
    const patient = patientIds.map(id => encodeURIComponent(id)).join(',')
    const result = await this.client.request<unknown>(
      `${resourceType}?patient=${patient}${extraParams}`,
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
    const buckets = emptyBuckets()
    await Promise.all(
      SLICE_READS.map(async read => {
        const run = this.search(read.type, [pid], read.params)
        buckets[read.key] = read.core ? await run : await run.catch(() => [] as FhirResource[])
      }),
    )
    return assembleSlice(buckets)
  }

  /**
   * Every cohort patient's slice, in ONE set of searches rather than one set
   * each.
   *
   * ⚠️ **This is a whole-cohort read and it is NOT how a chart is read.** It
   * exists because the caseload and its embedded summary need fourteen slices
   * at once, and asking for them a patient at a time is 196 cross-origin
   * requests — each with a preflight — to draw a page of tiles (clinical-app
   * audit §1.12, measured in §8.8). `getSlice` stays the chart's read: a
   * patient-bound session has one patient and nothing to batch.
   *
   * ⚠️ **What this cannot see: a server that answers a comma list with an empty
   * Bundle instead of an error.** Comma-as-OR is in the base specification, and
   * a server that does not implement it is expected to refuse — which lands in
   * the `catch` below. One that silently narrows to nothing would look exactly
   * like a cohort with no records, which is the failure mode this repo keeps
   * writing gates against. The guard is the cheapest decisive one available: if
   * the batched read finds NOTHING for ANY patient across ALL fourteen
   * searches, it is re-run one patient at a time. That costs nothing when there
   * is data, and a genuinely empty cohort reaches the same answer twice.
   */
  async getSlices(patientIds: string[]): Promise<Map<string, PatientSlice>> {
    const ids = [...new Set(patientIds)].filter(Boolean)
    const slices = new Map<string, PatientSlice>()
    if (ids.length === 0) return slices
    if (ids.length === 1) {
      slices.set(ids[0], await this.getSlice(ids[0]))
      return slices
    }

    const wanted = new Set(ids)
    const buckets = new Map(ids.map(id => [id, emptyBuckets()]))
    let found = 0
    try {
      await Promise.all(
        SLICE_READS.map(async read => {
          const run = this.search(read.type, ids, read.params)
          const rows = read.core ? await run : await run.catch(() => [] as FhirResource[])
          for (const row of rows) {
            // A resource whose patient is not one we asked for is dropped
            // rather than guessed at: a server that ignored `patient` entirely
            // would otherwise put a stranger's record on a caseload row.
            const pid = patientIdOf(row)
            if (!pid || !wanted.has(pid)) continue
            buckets.get(pid)?.[read.key].push(row)
            found++
          }
        }),
      )
    } catch {
      // A refused OR search is the expected shape of "this server does not
      // implement comma-as-OR", and it refuses for the WHOLE cohort at once —
      // so there is no partial result worth keeping.
      return this.slicesOneByOne(ids)
    }
    if (found === 0) return this.slicesOneByOne(ids)

    for (const id of ids) slices.set(id, assembleSlice(buckets.get(id) ?? emptyBuckets()))
    return slices
  }

  /**
   * The per-patient read, kept as the fallback the batched one falls back TO.
   *
   * A patient this session cannot read is OMITTED rather than mapped to an
   * empty slice — a 403 for one chart and a chart with nothing in it are two
   * different answers, and `getSlices`' contract is to keep them apart.
   */
  private async slicesOneByOne(ids: string[]): Promise<Map<string, PatientSlice>> {
    const entries = await Promise.all(
      ids.map(async id => {
        try {
          return [id, await this.getSlice(id)] as const
        } catch {
          return null
        }
      }),
    )
    return new Map(entries.filter((e): e is readonly [string, PatientSlice] => e !== null))
  }

  /**
   * The roster this session can see — `null` when it cannot see one (#401).
   *
   * ⚠️ **A patient-bound session returns `null`, not an empty list and not a
   * list of one.** That is the whole reason the seam's method is optional and
   * nullable: the population lens has to say "showing the patient in context"
   * rather than render a caseload of one, and it certainly must not fall back to
   * bundled demo rows while a server is connected — that was blocker 1 (#390).
   *
   * ⚠️ **A refusal is also `null`, not a throw.** A server that declines the
   * roster (this mock 403s a chart token; a real one may not implement an
   * unscoped Patient search at all) is answering the question, and the honest
   * rendering is the same "cannot serve a cohort" state. Throwing would turn a
   * legitimate answer into the page's error state.
   */
  async listCohort(): Promise<RegistryPatient[] | null> {
    // A worklist launch has no patient in context; a chart launch does. The
    // token's own context is the question, so ask it rather than trying the
    // request and interpreting the failure.
    if (this.client.patient?.id) return null
    try {
      const roster = await this.client.request<unknown>('Patient', { pageLimit: 0, flat: true })
      const patients = (Array.isArray(roster) ? roster : []).filter(
        (r): r is FhirResource =>
          !!r && typeof r === 'object' && (r as FhirResource).resourceType === 'Patient',
      )
      return patients.map(toRegistryPatient)
    } catch {
      return null
    }
  }

  /**
   * POST a resource and return the server-assigned id. Prefers the echoed
   * resource body (`Prefer: return=representation`); falls back to parsing
   * the Location header for servers that return 201 with no body.
   */
  private async create(resource: FhirResource): Promise<string | undefined> {
    resource = this.rewriteReferences(resource)
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
    return clean
  }

  /**
   * Write a lifecycle resource with PUT, against the id the SERVER gave it.
   *
   * ⚠️ This used to PUT the client-minted id (update-as-create). See
   * `serverIds` for why that had to go. **Every caller now passes a server id**
   * — `saveArtifact` only reaches here once `findServerId` or a prior create has
   * produced one — so this is an ordinary update and needs no capability beyond
   * `update-by-id`.
   *
   * These are the resources that are *mutated* rather than appended — an
   * episode is opened then closed, a flag raised then cleared, a task created
   * then completed, a referral tracked through to completed, an appointment
   * resolved to fulfilled or noshow. POSTing each transition would leave the
   * superseded version on the server, so a closed episode would still read as
   * open and a completed referral as outstanding. Converging on one resource is
   * the property; the id it converges on is the server's, and the client's own
   * id rides along as a business `identifier` so it can be found again.
   *
   * Failures propagate to the caller's save-error handling rather than being
   * swallowed.
   */
  private async put(resource: FhirResource): Promise<void> {
    resource = this.rewriteReferences(resource)
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

  /**
   * The system SPiER's client-minted id travels under once it stops being a
   * resource id.
   *
   * A business identifier is the right home for it: it is a value SPiER assigns
   * and needs to recognise again, which is exactly what `identifier` is for,
   * whereas `id` belongs to the server. It also makes a resource traceable back
   * to the session that wrote it without consulting this instance's map.
   */
  private static readonly CLIENT_ID_SYSTEM =
    'http://thespierproject.org/fhir/identifier/client-id'

  /**
   * The server's id for a client-minted one, from this session's map and then —
   * best effort — from a search by identifier.
   *
   * ⚠️ **The search is best effort on purpose.** `?identifier=` is a standard
   * search parameter, but not every server SPiER launches from implements it:
   * SPiER's own mock answers an unknown search parameter with a 400 by design,
   * *"an unknown search parameter is a 400, not an ignored one"*. A server that
   * cannot answer leaves the in-session map, which covers open→close inside one
   * launch — the case that actually arises. Cross-session convergence is what
   * the search buys where it works.
   */
  private async findServerId(resourceType: string, clientId: string): Promise<string | undefined> {
    const key = `${resourceType}/${clientId}`
    const known = this.serverIds.get(key)
    if (known) return known
    try {
      const found = await this.client.request<unknown>(
        `${resourceType}?identifier=${encodeURIComponent(`${SmartDataSource.CLIENT_ID_SYSTEM}|${clientId}`)}`,
        { pageLimit: 0, flat: true },
      )
      const first = (Array.isArray(found) ? found : []).find(
        (r): r is FhirResource => !!r && typeof r === 'object' && typeof (r as FhirResource).id === 'string',
      )
      if (first?.id) {
        this.serverIds.set(key, first.id)
        return first.id
      }
    } catch {
      // The server cannot answer this search. Fall through to the map.
    }
    return undefined
  }

  /**
   * Rewrite `<Type>/<client id>` references to the ids the server actually
   * assigned.
   *
   * ⚠️ **Without this, POST-to-create silently produces dangling references.**
   * `useCorrelatedSave` stamps the Encounter it just wrote onto every artifact
   * that follows (`stampEncounter`), and an Encounter closing an episode names
   * it — all by the id SPiER minted. Once the server assigns its own, those
   * strings point at resources it has never held. The server accepts them
   * (a reference is just a string) and the chart quietly loses its correlation,
   * which is the failure `executeWritePlan` already guards for the narrower
   * `Observation.derivedFrom → QuestionnaireResponse` case.
   *
   * ⚠️ **Applied in `create` and `put` rather than in `saveArtifact`, and that
   * placement is the whole point.** It lived in `saveArtifact` first, which
   * fixed nothing visible: the QuestionnaireResponse and its Observations are
   * written by the writeback LADDER (`saveResponse` → `executeWritePlan` →
   * `createResource`), a path that never goes through `saveArtifact`. The first
   * live write against Medplum landed a chart whose QR and both Observations
   * pointed at `Encounter/encounter-82d1eeff-…`, an id that server has never
   * held. Rewriting at the two primitives every write funnels through is what
   * makes it true of all of them.
   */
  private rewriteReferences<T>(node: T): T {
    // ⚠️ `Array.isArray` on a generic narrows it to `any[]`, so the mapped
    // result is `any` and the recursion returns one. Naming the element type
    // `unknown` keeps the walk honest — this function only ever rebuilds the
    // shape it was handed.
    if (Array.isArray(node)) {
      return (node as unknown[]).map(n => this.rewriteReferences(n)) as unknown as T
    }
    if (!node || typeof node !== 'object') return node
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'reference' && typeof value === 'string' && this.serverIds.has(value)) {
        const slash = value.indexOf('/')
        out[key] = `${value.slice(0, slash)}/${this.serverIds.get(value)}`
      } else {
        out[key] = this.rewriteReferences(value)
      }
    }
    return out as T
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
      // A lifecycle resource is MUTATED rather than appended — an episode opens
      // then closes, a flag is raised then cleared — so every transition has to
      // land on the one resource rather than leaving the superseded version
      // behind. Create it once, then update the server's copy.
      const clientId = resource.id
      const key = `${resource.resourceType}/${clientId}`
      const withIdentifier = this.withClientIdentifier(payload, clientId)
      const serverId = await this.findServerId(resource.resourceType, clientId)
      if (serverId) {
        await this.put({ ...withIdentifier, id: serverId })
      } else {
        const created = await this.create(withIdentifier)
        // ⚠️ A server that returns neither a body nor a Location leaves this
        // unset, and the next transition then creates a SECOND resource rather
        // than updating this one. Nothing can be done about it from here, but
        // it is a duplicate rather than a lost write, and the identifier makes
        // the pair findable afterwards.
        if (created) this.serverIds.set(key, created)
      }
    } else {
      await this.create(payload)
    }
    this.notify()
  }

  /**
   * Carry the client-minted id as a business identifier.
   *
   * Idempotent: a resource written twice in a session (open, then close) passes
   * through here each time, and a second copy of the same identifier would make
   * the lookup ambiguous on servers that reject a multi-match conditional read.
   */
  private withClientIdentifier<T extends FhirResource>(payload: T, clientId: string): T {
    const withId = payload as T & { identifier?: { system?: string; value?: string }[] }
    const existing = withId.identifier ?? []
    if (existing.some(i => i.system === SmartDataSource.CLIENT_ID_SYSTEM && i.value === clientId)) {
      return payload
    }
    return {
      ...payload,
      identifier: [...existing, { system: SmartDataSource.CLIENT_ID_SYSTEM, value: clientId }],
    }
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
