/**
 * FhirDataSource — the boundary between "the app wants FHIR resources for a
 * patient" and "where those resources come from."
 *
 * The current localStorage/scenario store is one implementation
 * (`LocalDataSource`); a live SMART-on-FHIR backed source is another. The
 * interface is deliberately async-first — even though `LocalDataSource`
 * resolves synchronously — so an HTTP-backed source can implement it without
 * pretending network reads are instant.
 *
 * Two principles constrain the shape:
 *  1. Derivation (QuestionnaireResponse → Observations / risk alert) is NOT the
 *     data source's job. It's business logic (`deriveFromResponse`). The source
 *     only persists what it's handed.
 *  2. No synchronous returns and no localStorage assumptions leak into the
 *     interface, so an HTTP source is implementable against it. (The one
 *     concession is the OPTIONAL `getSliceSync` hydration hook — see below.)
 */
import type { RiskAlert } from '../observationMappers'
import type {
  FhirResource,
  ObservationResource,
  PatientSlice,
  StoredResponse,
} from '../../types/fhir'

/**
 * The artifacts derived from a QuestionnaireResponse by `deriveFromResponse`.
 * Mirrors `MapperResult` but is the currency the data source persists: the
 * source appends `observations` and upserts `riskAlert` (replacing any prior
 * alert for the same tool). `null` when the QR has no mapper — the source then
 * stores only the response.
 */
export interface DerivedArtifacts {
  observations: ObservationResource[]
  riskAlert: RiskAlert
}

export interface FhirDataSource {
  /**
   * Full artifact slice for a patient. A `null` patientId is the blank
   * "no patient selected" slice. Implementations may seed missing slices from
   * static scenario data (idempotently) as part of this read.
   */
  getSlice(patientId: string | null): Promise<PatientSlice>

  /**
   * OPTIONAL synchronous read, used only for initial state hydration so the
   * first paint isn't an empty chart. Sources that can resolve without I/O
   * (local / in-memory) implement it; async-only sources (HTTP) omit it and the
   * caller falls back to an empty slice until `getSlice` resolves. Must be
   * consistent with `getSlice` (same seeding behavior).
   */
  getSliceSync?(patientId: string | null): PatientSlice

  /**
   * Persist a QuestionnaireResponse plus its pre-derived artifacts. `derived`
   * is `null` when the QR has no mapper (only the response is stored).
   */
  saveResponse(
    patientId: string | null,
    entry: StoredResponse,
    derived: DerivedArtifacts | null,
  ): Promise<void>

  /**
   * Persist a non-QuestionnaireResponse artifact (Communication / Observation /
   * CarePlan), routing it into the right slice array by `resourceType`.
   */
  saveArtifact(patientId: string | null, resource: FhirResource): Promise<void>

  /**
   * Subscribe to change notifications so React state can track mutations
   * (including ones made outside the current render, e.g. another tab or a
   * future live-source push). Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void
}
