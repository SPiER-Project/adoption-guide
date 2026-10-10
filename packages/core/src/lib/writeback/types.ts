/**
 * writeback — the tiered "writeback ladder" for SPiER-as-SMART-Form-Filler.
 *
 * When SPiER's own app is EHR-launched (SmartDataSource), a completed
 * instrument is written back to the EHR's FHIR server by attempting the
 * highest write tier the server supports and degrading gracefully, recording
 * every outcome. The recorded outcomes drive a "scorecard" (Phase 2) that
 * doubles as a site-readiness diagnostic: an incomplete writeback is shown
 * deliberately, not hidden.
 *
 * ⚠️ PROOF-OF-CONCEPT. Targets are SMART sandboxes, never production EHRs.
 * FHIR traffic is browser-direct (see docs/plans/smart-filler-writeback-ladder.md);
 * SPiER infrastructure never touches PHI.
 *
 * ── Tier ladder (climbing = a more capable EHR) ──────────────────────────
 *   Tier 0 — DocumentReference  the universal floor: a human-readable
 *                               rendering + the raw QR JSON (base64), so the
 *                               discrete data is recoverable even when no
 *                               discrete tier lands.
 *   Tier 1 — QuestionnaireResponse  the Form Filler's canonical output; the
 *                               foundational discrete capture. Easiest and
 *                               most broadly supported discrete write, and it
 *                               MUST be written first so higher tiers can
 *                               reference the server-assigned QR id.
 *   Tier 2 — Observation        scored + harmonized risk-tier Observations
 *                               (SDC "extract"): the more advanced, more
 *                               immediately-consumable rung.
 *            + Condition        the problems an instrument RECORDS (CAMS
 *                               Section B's suicide drivers): a second Tier-2
 *                               step, gated on the server's own Condition
 *                               capability, never on its Observation one.
 *   Tier 3 — Condition          opt-in only, default OFF. Proposes a
 *                               problem-list entry from the harmonized risk
 *                               tier; a human must confirm before it is
 *                               written (governance — see conditionProposal.ts).
 *
 * ⚠️ **Two Condition steps, and they are not the same act.** Tier 3 is the app's
 * own INFERENCE — a screen turned into a problem — which is why it is off by
 * default. A Tier-2 Condition is what the clinician wrote down in a
 * clinician-completed form, persisted when they press Save; the published
 * AdministerCAMSSectionB says each driver is materialized as a Condition. Until
 * 2026-10-06 the drivers rode in the Observation step: POSTed to `/Condition`
 * on the strength of the server's Observation capability, and counted on the
 * scorecard as Observations.
 *
 * NOTE the Tier 1/2 ordering: QuestionnaireResponse is the LOWER discrete rung
 * (raw capture, easiest, SDC-canonical) and Observation is the HIGHER rung
 * (derived extraction, harder, more computable). This is a deliberate swap
 * from an earlier draft that had them reversed — see the plan doc.
 */
import type {
  ConditionResource,
  FhirResource,
  ObservationResource,
  QuestionnaireResponseResource,
} from '../../types/fhir'

/** Numeric tier rank. Higher = more capable EHR / more integrated data. */
export type WriteTier = 0 | 1 | 2 | 3

/** The four resource types the ladder can write, one per tier. */
export type WritebackResourceType =
  | 'DocumentReference'
  | 'QuestionnaireResponse'
  | 'Observation'
  | 'Condition'

/**
 * What a server can create, distilled from its CapabilityStatement (see
 * capability.ts). Absent keys are treated as unsupported. Only `create` matters
 * for the ladder today.
 */
export type ServerCapabilities = Record<string, { create: boolean }>

/**
 * The resources a completed instrument produces, handed to the ladder. `qr` and
 * `documentReference` are always present; `observations` may be empty (some
 * instruments produce CarePlans, not Observations), and `conditions` almost
 * always is (only CAMS Section B records any); `condition` is present only
 * when the Tier-3 proposal is enabled and the screen warrants one.
 */
export interface WritebackArtifacts {
  qr: QuestionnaireResponseResource
  observations: ObservationResource[]
  /** The instrument's recorded problems (Tier 2); usually empty. */
  conditions: ConditionResource[]
  documentReference: FhirResource
  condition?: FhirResource
}

/**
 * Which tiers to attempt. Defaults encode the plan's policy: discrete tiers 1–2
 * on (still gated by capability), Tier 3 off. `alwaysWriteDocument` forces the
 * Tier-0 floor even when the discrete tiers fully captured the data (useful for
 * the demo, where the human-readable rendering is wanted regardless).
 */
export interface WritebackConfig {
  /** default true */
  enableQuestionnaireResponse?: boolean
  /** default true */
  enableObservation?: boolean
  /** default true — the instrument's recorded problems, a Tier-2 step */
  enableRecordedConditions?: boolean
  /** default false — opt-in, needs explicit in-UI confirmation upstream */
  enableConditionProposal?: boolean
  /** default false */
  alwaysWriteDocument?: boolean
}

/** Resolved config with every field concrete. */
export interface ResolvedWritebackConfig {
  enableQuestionnaireResponse: boolean
  enableObservation: boolean
  enableRecordedConditions: boolean
  enableConditionProposal: boolean
  alwaysWriteDocument: boolean
}

/**
 * Planned disposition of a step, decided purely from capability + config +
 * artifact presence (no runtime I/O):
 *  - `attempt`     — supported and enabled; will be POSTed.
 *  - `unsupported` — enabled but the server can't create this type; counts as a
 *                    coverage gap (triggers the Tier-0 floor).
 *  - `disabled`    — turned off by config (e.g. Tier 3 default); NOT a gap.
 */
export type StepDisposition = 'attempt' | 'unsupported' | 'disabled'

/** One planned step in the ladder. `floor` is the Tier-0 backstop. */
export interface WriteStep {
  tier: WriteTier
  resourceType: WritebackResourceType
  role: 'discrete' | 'floor'
  disposition: StepDisposition
}

/** Terminal outcome of a step after execution. */
export type WriteOutcome = 'written' | 'failed' | 'skipped'

export interface WriteStepResult {
  tier: WriteTier
  resourceType: WritebackResourceType
  role: 'discrete' | 'floor'
  outcome: WriteOutcome
  /** Server-assigned id, when written. */
  id?: string
  /** Human-readable failure detail (HTTP status + body summary), when failed. */
  error?: string
  /** Why a step was skipped (unsupported / disabled / redundant floor). */
  reason?: string
}

export interface WritebackResult {
  steps: WriteStepResult[]
}

/**
 * The narrow capability `execute` needs from a data source: create a resource
 * and return its server id, surfacing failures as thrown errors (never
 * swallowed). SmartDataSource implements this; tests supply a fake.
 */
export interface WritebackTarget {
  createResource(resource: FhirResource): Promise<{ id?: string }>
}

/**
 * What the scorecard renders: one writeback run, with enough context to explain
 * every absence as well as every write.
 *
 * `result.steps` alone is NOT sufficient for the site-readiness diagnostic, for
 * a reason that is easy to miss: `buildWritePlan` OMITS the Tier-3 step entirely
 * when the proposal is disabled (ladder.ts) — it does not emit a `disabled`
 * step. So a scorecard reading only `steps` shows silence where the governance
 * story ("a Condition is never auto-written") is the most important thing to
 * say. Carrying the resolved `config` is what lets the UI distinguish
 * "deliberately off" from "never considered".
 */
export interface WritebackReport {
  /** ISO timestamp of the run, so a stale scorecard is recognizable as stale. */
  at: string
  /** Resolved policy — the source of "off by design" statements in the UI. */
  config: ResolvedWritebackConfig
  /** What the server advertised it can create. */
  capabilities: ServerCapabilities
  /**
   * False when the CapabilityStatement probe failed or returned nothing usable.
   * `capabilities` is `{}` in BOTH that case and the (unrealistic) case of a
   * server advertising no creatable types, and conflating them would report a
   * network failure as "the EHR does not support this" — the opposite of a
   * readiness diagnostic. The UI must say "could not ask" instead.
   */
  capabilitiesKnown: boolean
  result: WritebackResult
}
