/**
 * LocalDataSource — the localStorage/scenario-backed implementation of
 * `FhirDataSource`. This is the app's default source and preserves the exact
 * on-disk contract of the pre-abstraction PatientContext:
 *
 *  - `spier-patient-store` — a `Record<patientId, PatientSlice>` of population
 *    patients' chart state.
 *  - `spier-blank-slice` — the single slice backing the "no patient selected"
 *    mode.
 *  - one-time migration from the original single-patient keys
 *    (`spier-demo-responses`, etc.) into a `patient-001` slice.
 *
 * These keys and shapes MUST NOT change — existing browsers must keep their
 * data. Auto-seeding of population scenarios happens on first read of a missing
 * slice, and re-seeding when the fixture behind an UNTOUCHED slice changes
 * (#301 — see `spier-scenario-seeds` below).
 */
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import type { DerivedArtifacts, FhirDataSource } from './types'
import type {
  AppointmentResource,
  CarePlanResource,
  CommunicationResource,
  ConsentResource,
  EncounterResource,
  DocumentReferenceResource,
  EpisodeOfCareResource,
  FhirResource,
  FlagResource,
  ObservationResource,
  PatientSlice,
  ProcedureResource,
  ServiceRequestResource,
  StoredResponse,
  TaskResource,
} from '../../types/fhir'
import type { RiskAlert } from '../observationMappers'

const STORE_KEY = 'spier-patient-store'
const BLANK_SLICE_KEY = 'spier-blank-slice'

/**
 * Which fixture version produced each seeded slice (#301).
 *
 * The problem: seeding was once-only, so a browser that had ever opened the demo
 * kept whatever fixture version it first loaded — forever, including on the
 * deployed site. That is not cosmetic, because the scenarios are dated against a
 * recorded anchor (`scripts/shift-scenario-dates.mjs`) and get re-anchored: a
 * returning visitor saw "Overdue by 143 days" where the shipped fixtures say 3.
 * The staleness grows with every re-anchor, and only for repeat visitors.
 *
 * A blind reseed is not the fix — a visitor's own submitted assessments live in
 * the same slice, which is exactly why the original code never reseeded. So the
 * marker distinguishes the two cases: a slice we seeded and the user has not
 * touched is ours to refresh; a slice the user has written to is theirs, and is
 * left alone forever.
 *
 * Held in its own key rather than on the slice, unlike the `_seed` field #301
 * sketched: `PatientSlice` is chart state that feeds FHIR payloads (and
 * `smartDataSource` writes resources from it), so a non-FHIR bookkeeping scalar
 * has no business travelling inside it. The two keys can only desync in the safe
 * direction — a lost seed record makes a slice look user-owned, which means
 * "never touch it".
 */
const SEEDS_KEY = 'spier-scenario-seeds'

/** The pre-#301 single-patient keys, consumed by `migrateLegacyStorage`. */
const LEGACY_KEYS = [
  'spier-demo-responses',
  'spier-demo-observations',
  'spier-demo-careplans',
  'spier-demo-risk-alerts',
]

type PatientStore = Record<string, PatientSlice>

/** patientId → fingerprint of the scenario that seeded it. */
type SeedRecord = Record<string, string>

/**
 * Content fingerprint of a scenario, so "has this fixture changed" needs no
 * hand-maintained version constant.
 *
 * Deliberately derived rather than a `SEED_VERSION` someone bumps: a manual
 * version is one more thing to remember at exactly the moment attention is
 * elsewhere (editing fixtures), and this repo has already paid for that twice —
 * #232's `check:codings` floor sat stale while the inventory doubled, and #273
 * had to gate warning *shape* precisely because a pinned number trains people to
 * bump without reading. A fingerprint cannot go stale: it is the data.
 *
 * FNV-1a over the serialized scenario. Not cryptographic and does not need to
 * be — the only question is "same bytes or different bytes", and `crypto.subtle`
 * is async, which `getSliceSync` cannot be. Key order is stable because these
 * objects come from imported JSON modules.
 */
function fingerprintScenario(scenario: unknown): string {
  const json = JSON.stringify(scenario)
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    // FNV prime, via shifts so the result stays in 32-bit range.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }
  return `${hash.toString(36)}-${json.length.toString(36)}`
}

const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
  episodes: [],
  flags: [],
  tasks: [],
  documentReferences: [],
  serviceRequests: [],
  appointments: [],
  consents: [],
  procedures: [],
}

/**
 * Replace an existing resource with the same `id`, or append when it's new.
 *
 * Stage-7 resources have a LIFECYCLE — an episode is opened and later closed,
 * a flag is raised and later cleared, a task is created and later completed —
 * and each transition is another `saveArtifact` of the same logical resource.
 * Appending (the behaviour used for Observations/CarePlans/Communications,
 * which are immutable point-in-time records) would leave the superseded copy
 * behind, so a closed episode would still show as open in the registry.
 * Resources with no `id` are always appended.
 */
function upsertById<T extends { id?: string }>(list: T[] | undefined, next: T): T[] {
  const current = list ?? []
  if (!next.id) return [...current, next]
  const idx = current.findIndex(r => r.id === next.id)
  if (idx === -1) return [...current, next]
  const copy = [...current]
  copy[idx] = next
  return copy
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage full or unavailable — silently fail, matching prior behavior.
  }
}

// One-time migration from the original single-patient keys into a patient-001
// slice so existing demo data isn't lost when this build first runs in a browser.
function migrateLegacyStorage(): PatientStore | null {
  const responses = readJson<StoredResponse[]>('spier-demo-responses') ?? []
  const observations = readJson<ObservationResource[]>('spier-demo-observations') ?? []
  const carePlans = readJson<CarePlanResource[]>('spier-demo-careplans') ?? []
  const riskAlerts = readJson<RiskAlert[]>('spier-demo-risk-alerts') ?? []
  if (responses.length || observations.length || carePlans.length || riskAlerts.length) {
    return { 'patient-001': { responses, observations, carePlans, riskAlerts } }
  }
  return null
}

export class LocalDataSource implements FhirDataSource {
  private store: PatientStore
  private blankSlice: PatientSlice
  private seeds: SeedRecord
  private readonly listeners = new Set<() => void>()

  constructor() {
    this.store = readJson<PatientStore>(STORE_KEY) ?? migrateLegacyStorage() ?? {}
    this.blankSlice = readJson<PatientSlice>(BLANK_SLICE_KEY) ?? EMPTY_SLICE
    this.seeds = readJson<SeedRecord>(SEEDS_KEY) ?? {}
  }

  /** Seed (or re-seed) a patient from its scenario and record the fingerprint. */
  private seedFrom(patientId: string, scenario: PatientSlice, fingerprint: string): PatientSlice {
    this.store[patientId] = scenario
    this.seeds[patientId] = fingerprint
    writeJson(STORE_KEY, this.store)
    writeJson(SEEDS_KEY, this.seeds)
    return scenario
  }

  /**
   * Resolve the slice synchronously, seeding a missing population slice from
   * static scenario data and re-seeding one whose fixture has changed *and*
   * which the user has never written to (#301). Both persist but intentionally
   * do NOT notify listeners: the caller is already receiving the value, and
   * notifying during a render-time read would loop.
   *
   * Three cases, and the middle one is the whole point:
   *
   *  - No slice → seed, record the fingerprint.
   *  - Slice + a seed record that no longer matches the fixture → the slice is
   *    still ours, so refresh it. Nothing of the user's is in it.
   *  - Slice with NO seed record → hands off, permanently. Two kinds of slice
   *    land here: one the user has written to (the record is dropped on write),
   *    and one seeded by a build before #301. Those are indistinguishable, and
   *    guessing between them is not worth it — an id-based heuristic ("does this
   *    hold any resource the fixture doesn't?") would still miss an in-place
   *    edit like marking an appointment fulfilled, so it can silently discard
   *    something the user did. `resetLocalDemoData()` is the deliberate,
   *    user-driven way out for those; from this build on, every seeded slice
   *    carries a record and refreshes itself.
   */
  private resolveSlice(patientId: string | null): PatientSlice {
    if (patientId === null) return this.blankSlice
    const existing = this.store[patientId]
    const scenario = POPULATION_SCENARIOS[patientId]

    if (!existing) {
      if (!scenario) return EMPTY_SLICE
      return this.seedFrom(patientId, scenario, fingerprintScenario(scenario))
    }

    const seededFrom = this.seeds[patientId]
    if (seededFrom && scenario) {
      const current = fingerprintScenario(scenario)
      if (seededFrom !== current) return this.seedFrom(patientId, scenario, current)
    }
    return existing
  }

  getSliceSync(patientId: string | null): PatientSlice {
    return this.resolveSlice(patientId)
  }

  getSlice(patientId: string | null): Promise<PatientSlice> {
    return Promise.resolve(this.resolveSlice(patientId))
  }

  /**
   * Apply a functional update to the active slice, persist, and notify. The
   * blank slice and population slices live in separate localStorage keys, so
   * they're persisted independently.
   */
  private updateSlice(
    patientId: string | null,
    updater: (prev: PatientSlice) => PatientSlice,
  ): void {
    if (patientId === null) {
      this.blankSlice = updater(this.blankSlice)
      writeJson(BLANK_SLICE_KEY, this.blankSlice)
    } else {
      this.store = {
        ...this.store,
        [patientId]: updater(this.store[patientId] ?? EMPTY_SLICE),
      }
      writeJson(STORE_KEY, this.store)
      // The slice is the user's now, not the fixture's (#301). Dropping the seed
      // record is what protects their work from a later fixture refresh — it has
      // to happen on EVERY write, which is why it lives here in the one funnel
      // rather than in each of saveResponse/saveArtifact.
      if (this.seeds[patientId] !== undefined) {
        delete this.seeds[patientId]
        writeJson(SEEDS_KEY, this.seeds)
      }
    }
    this.notify()
  }

  saveResponse(
    patientId: string | null,
    entry: StoredResponse,
    derived: DerivedArtifacts | null,
  ): Promise<void> {
    this.updateSlice(patientId, prev => ({
      ...prev,
      responses: [...prev.responses, entry],
      observations: derived
        ? [...prev.observations, ...derived.observations]
        : prev.observations,
      riskAlerts: derived
        ? [...prev.riskAlerts.filter(a => a.tool !== derived.riskAlert.tool), derived.riskAlert]
        : prev.riskAlerts,
    }))
    return Promise.resolve()
  }

  saveArtifact(patientId: string | null, resource: FhirResource): Promise<void> {
    // `_savedAt` is a local persistence stamp (a live source would rely on
    // meta.lastUpdated instead), so it's applied here rather than by callers.
    const stamped = { ...resource, _savedAt: new Date().toISOString() }
    this.updateSlice(patientId, prev => {
      switch (resource.resourceType) {
        case 'Communication':
          return {
            ...prev,
            communications: [...(prev.communications ?? []), stamped as CommunicationResource],
          }
        case 'Observation':
          return { ...prev, observations: [...prev.observations, stamped as ObservationResource] }
        case 'CarePlan':
          return { ...prev, carePlans: [...prev.carePlans, stamped as CarePlanResource] }
        // Stage 4 (Document Safety Actions). Appended, not upserted: the
        // lethal-means counseling Procedure is a completed point-in-time act
        // with no later lifecycle, like the Observation above it. A second
        // counseling session is a second Procedure, not an edit of the first.
        case 'Procedure':
          return {
            ...prev,
            procedures: [...(prev.procedures ?? []), stamped as ProcedureResource],
          }
        // Stage 7 (Track Risk Over Time). The episode is upserted by id rather
        // than appended: opening an episode and later closing it are two saves
        // of the SAME episode, and appending would leave a stale open copy in
        // the slice (and so a phantom row in the registry work queue).
        case 'EpisodeOfCare':
          return { ...prev, episodes: upsertById(prev.episodes, stamped as EpisodeOfCareResource) }
        // Same for the flag: raising then clearing it is one resource's lifecycle.
        case 'Flag':
          return { ...prev, flags: upsertById(prev.flags, stamped as FlagResource) }
        // Tasks are upserted too — completing a task updates it in place.
        case 'Task':
          return { ...prev, tasks: upsertById(prev.tasks, stamped as TaskResource) }
        // Stage 5 (Coordinate Handoffs). All four are upserted by id for the
        // same reason as the Stage-7 types: every one of them is *tracked past
        // its creation*. A referral moves draft → active → completed, an
        // appointment booked → fulfilled | noshow, a consent is revoked, a
        // packet superseded. Appending each transition would leave the stale
        // version behind — a referral would read as still outstanding after it
        // completed, which is precisely the capability TL-017 exists to prove.
        case 'DocumentReference':
          return {
            ...prev,
            documentReferences: upsertById(
              prev.documentReferences,
              stamped as DocumentReferenceResource,
            ),
          }
        case 'ServiceRequest':
          return {
            ...prev,
            serviceRequests: upsertById(prev.serviceRequests, stamped as ServiceRequestResource),
          }
        case 'Appointment':
          return {
            ...prev,
            appointments: upsertById(prev.appointments, stamped as AppointmentResource),
          }
        case 'Consent':
          return { ...prev, consents: upsertById(prev.consents, stamped as ConsentResource) }
        // The #263 correlation hinge. Upserted by id, not appended: an Encounter
        // is opened, gains an episode reference when one opens, gains Appointment
        // references as they are booked, and is closed — all saves of the SAME
        // resource. Appending would leave a stale copy that still reads
        // in-progress, so `findOpenEncounter` would keep filing artifacts into it.
        case 'Encounter':
          return { ...prev, encounters: upsertById(prev.encounters, stamped as EncounterResource) }
        default:
          console.warn(
            `[LocalDataSource] saveArtifact: unhandled resourceType "${resource.resourceType}"`,
          )
          return prev
      }
    })
    return Promise.resolve()
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

/**
 * Discard every locally-stored demo slice so the curated scenarios load fresh.
 *
 * The escape hatch for the one case the fingerprint cannot fix: a slice seeded
 * before #301 has no seed record, so it is treated as user-owned and never
 * refreshed. Without this, the only cure was knowing that `spier-patient-store`
 * exists and clearing it in devtools — which no viewer of the deployed demo will
 * do. It is also useful on its own: someone who has mutated a patient and wants
 * the curated scenario back could not previously get it.
 *
 * Destructive on purpose, so the caller confirms first. Clears the legacy keys
 * too — leaving them would let `migrateLegacyStorage` resurrect the pre-slice
 * data on the next construct, i.e. a "reset" that restores old state.
 *
 * The caller reloads afterwards rather than this notifying listeners: every
 * context, memo and derived registry in the app holds slice-derived state, and a
 * reload is the one way to be sure none of it survives. This runs at most once
 * in a session, so the cost is irrelevant next to the risk of a half-cleared UI.
 */
export function resetLocalDemoData(): void {
  for (const key of [STORE_KEY, BLANK_SLICE_KEY, SEEDS_KEY, ...LEGACY_KEYS]) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Matching readJson/writeJson: storage may be unavailable; nothing to undo.
    }
  }
}

/**
 * Default shared instance. A module singleton so the in-memory store survives
 * provider remounts and is shared across the app, matching the old behavior
 * where the store lived in a single provider's state. Tests and the future
 * SMART source can inject their own instance via the provider's `dataSource`
 * prop.
 */
export const localDataSource = new LocalDataSource()
