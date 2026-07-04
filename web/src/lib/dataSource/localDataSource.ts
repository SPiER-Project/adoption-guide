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
 * slice (idempotent: once a slice exists, even mutated, it never reseeds).
 */
import { POPULATION_SCENARIOS } from '../../data/population/scenarios'
import type { DerivedArtifacts, FhirDataSource } from './types'
import type {
  CarePlanResource,
  CommunicationResource,
  FhirResource,
  ObservationResource,
  PatientSlice,
  StoredResponse,
} from '../../types/fhir'
import type { RiskAlert } from '../observationMappers'

const STORE_KEY = 'spier-patient-store'
const BLANK_SLICE_KEY = 'spier-blank-slice'

type PatientStore = Record<string, PatientSlice>

const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
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
  private readonly listeners = new Set<() => void>()

  constructor() {
    this.store = readJson<PatientStore>(STORE_KEY) ?? migrateLegacyStorage() ?? {}
    this.blankSlice = readJson<PatientSlice>(BLANK_SLICE_KEY) ?? EMPTY_SLICE
  }

  /**
   * Resolve the slice synchronously, auto-seeding a missing population slice
   * from static scenario data. Seeding persists but intentionally does NOT
   * notify listeners: the caller is already receiving the seeded value, and
   * notifying during a render-time read would loop.
   */
  private resolveSlice(patientId: string | null): PatientSlice {
    if (patientId === null) return this.blankSlice
    const existing = this.store[patientId]
    if (existing) return existing
    const scenario = POPULATION_SCENARIOS[patientId]
    if (scenario) {
      this.store[patientId] = scenario
      writeJson(STORE_KEY, this.store)
      return scenario
    }
    return EMPTY_SLICE
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
 * Default shared instance. A module singleton so the in-memory store survives
 * provider remounts and is shared across the app, matching the old behavior
 * where the store lived in a single provider's state. Tests and the future
 * SMART source can inject their own instance via the provider's `dataSource`
 * prop.
 */
export const localDataSource = new LocalDataSource()
