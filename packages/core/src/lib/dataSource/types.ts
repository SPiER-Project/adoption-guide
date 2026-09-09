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
import type { RegistryPatient } from '../registry'
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
   * The cohort this source can answer for — the roster a population app indexes
   * across (#401, blocker 2's second half).
   *
   * ⚠️ **OPTIONAL, and its absence is meaningful.** A source that cannot serve a
   * cohort must not pretend to: a patient-bound SMART session is exactly such a
   * source, and the population lens has to SAY it is showing one patient rather
   * than silently rendering a caseload of one — or, worse, falling back to
   * bundled demo rows and presenting them as a server read. That was blocker 1
   * (#390). So this returns `null` for "I cannot answer that", which is a
   * different answer from `[]` ("I can, and it is empty").
   *
   * ⚠️ **Deliberately NOT a FHIR search contract.** No paging, no filters, no
   * `_count`. The question a worklist asks is "who is on the panel", and on this
   * demo's scale the answer is a list. Modelling paging here would be inventing
   * a contract with one implementation and no caller — and
   * `mock-patient-smart-launch.md` §8 is explicit that how a registry scopes
   * itself on a real server is design work, not a refactor. The settled answer
   * for a `user/*.read` grant against the mock is "every patient it holds"
   * (`user-scoped-smart-launch.md`); a narrower panel concept is new product
   * scope, and it would arrive as a parameter here rather than a reshape.
   *
   * ⚠️ `recommendedNextStep` is `null` from any server-backed source, and that
   * is not a gap to paper over. It is the one registry field no FHIR resource
   * carries — hand-curated in `patients.json` for the demo — so a cohort read
   * over real Patients cannot produce it, and callers derive the next step from
   * the pathway instead. See `RegistryPatient`.
   */
  listCohort?(): Promise<RegistryPatient[] | null>

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
