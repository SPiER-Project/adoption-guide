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
 *
 * ⚠️ There is no Tier 3, and the ladder never writes a problem-list Condition.
 * It had one — an opt-in "Condition proposal" coded with the risk tier and
 * stamped `unconfirmed` — until #639 retired it: it derived a Condition from a
 * SCREEN, which the published rule forbids ("a screen never becomes a
 * Condition", docs/decisions/suicide-related-problem-set.md). A problem-list
 * entry is the clinician's assertion, from the SNOMED suicide-related problem
 * set; SPiER's part is the CDS problem-list card that prompts it. (CAMS Section
 * B's driver Conditions are not this: they are clinician-recorded content of
 * the instrument, and ride the Tier-2 step with the Observations.)
 *
 * NOTE the Tier 1/2 ordering: QuestionnaireResponse is the LOWER discrete rung
 * (raw capture, easiest, SDC-canonical) and Observation is the HIGHER rung
 * (derived extraction, harder, more computable). This is a deliberate swap
 * from an earlier draft that had them reversed — see the plan doc.
 */
import type {
  FhirResource,
  ObservationResource,
  QuestionnaireResponseResource,
} from '../../types/fhir'

/** Numeric tier rank. Higher = more capable EHR / more integrated data. */
export type WriteTier = 0 | 1 | 2

/** The three resource types the ladder writes, one per tier. */
export type WritebackResourceType =
  | 'DocumentReference'
  | 'QuestionnaireResponse'
  | 'Observation'

/**
 * The resource each tier writes — the ladder's rungs, stated once.
 * `buildWritePlan` builds its steps from this, and the guide's page on saving
 * to the EHR keys its copy by `WriteTier`, so a rung added or removed here is a
 * compile error in both rather than a page that quietly describes a ladder the
 * app does not climb.
 */
export const WRITE_TIER_RESOURCE = {
  0: 'DocumentReference',
  1: 'QuestionnaireResponse',
  2: 'Observation',
} as const satisfies Record<WriteTier, WritebackResourceType>

/**
 * What a server can create, distilled from its CapabilityStatement (see
 * capability.ts). Absent keys are treated as unsupported. Only `create` matters
 * for the ladder today.
 */
export type ServerCapabilities = Record<string, { create: boolean }>

/**
 * The resources a completed instrument produces, handed to the ladder. `qr` and
 * `documentReference` are always present; `observations` may be empty (some
 * instruments produce CarePlans, not Observations).
 */
export interface WritebackArtifacts {
  qr: QuestionnaireResponseResource
  observations: ObservationResource[]
  documentReference: FhirResource
}

/**
 * Which tiers to attempt. Defaults encode the plan's policy: discrete tiers 1–2
 * on (still gated by capability). The Tier-0 floor runs when a discrete tier
 * did not land, or when the form produced no scores (#638); `alwaysWriteDocument`
 * forces it on every save, even when the discrete tiers captured everything and
 * the EHR will display the scores.
 */
export interface WritebackConfig {
  /** default true */
  enableQuestionnaireResponse?: boolean
  /** default true */
  enableObservation?: boolean
  /** default false */
  alwaysWriteDocument?: boolean
}

/** Resolved config with every field concrete. */
export interface ResolvedWritebackConfig {
  enableQuestionnaireResponse: boolean
  enableObservation: boolean
  alwaysWriteDocument: boolean
}

/**
 * Planned disposition of a step, decided purely from capability + config +
 * artifact presence (no runtime I/O):
 *  - `attempt`     — supported and enabled; will be POSTed.
 *  - `unsupported` — enabled but the server can't create this type; counts as a
 *                    coverage gap (triggers the Tier-0 floor).
 *  - `disabled`    — turned off by config; NOT a gap.
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
  /**
   * Why a step was skipped, as a code — the one the scorecard words.
   *
   * ⚠️ `reason` and `error` are diagnostics in the wire's own vocabulary ("2
   * Observations written", "Failed to create Observation — HTTP 422: …"), read
   * where inspection is on — the report itself, under `useInspect()`. They
   * reached the clinician verbatim through the scorecard until 2026-10-07. The
   * scorecard reads `skip` and `count` instead and says it in its own words.
   */
  skip?: WriteSkip
  /** How many of how many landed, for a step that writes several resources. */
  count?: { written: number; of: number }
}

/**
 * - `disabled`   — turned off by config.
 * - `unsupported` — the server does not advertise create for this type.
 * - `not-needed` — the Tier-0 floor, when the discrete tiers captured it all.
 */
export type WriteSkip = 'disabled' | 'unsupported' | 'not-needed'

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
 * `result.steps` alone is NOT sufficient for the site-readiness diagnostic:
 * `buildWritePlan` omits the Tier-2 step entirely when there are no
 * Observations, and a disabled tier is a choice, not a gap. Carrying the
 * resolved `config` is what lets the UI distinguish "deliberately off" from
 * "never considered".
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
