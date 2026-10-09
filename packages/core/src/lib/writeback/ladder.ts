/**
 * ladder — the pure write-plan builder.
 *
 * `buildWritePlan` turns (server capabilities, config, artifacts) into an
 * ordered list of `WriteStep`s WITHOUT any I/O. It decides each step's
 * *disposition* (attempt / unsupported / disabled) from three inputs only:
 *   1. config      — which tiers are enabled (defaults: QR + Observation on,
 *                    floor conditional).
 *   2. capabilities — whether the server advertises `create` for the type.
 *   3. artifacts   — whether there is anything to write (no Observations →
 *                    no Tier-2 step).
 *
 * Runtime success/failure and the conditional firing of the Tier-0 floor are
 * NOT decided here — that is `execute`'s job. The plan is the honest statement
 * of intent that the scorecard (Phase 2) renders.
 *
 * Order of the returned steps is the execution order:
 *   Tier 1 QuestionnaireResponse → Tier 2 Observation →
 *   Tier 0 DocumentReference (floor last).
 * QR precedes Observation because the Observations reference the server-assigned
 * QR id; the floor is last because whether it runs depends on the discrete
 * outcomes.
 */
import { canCreate } from './capability'
import { WRITE_TIER_RESOURCE } from './types'
import type {
  ResolvedWritebackConfig,
  ServerCapabilities,
  StepDisposition,
  WritebackArtifacts,
  WritebackConfig,
  WriteStep,
} from './types'

/** Fill in config defaults: discrete tiers 1–2 on, floor conditional. */
export function resolveConfig(config: WritebackConfig = {}): ResolvedWritebackConfig {
  return {
    enableQuestionnaireResponse: config.enableQuestionnaireResponse ?? true,
    enableObservation: config.enableObservation ?? true,
    alwaysWriteDocument: config.alwaysWriteDocument ?? false,
  }
}

/** Disposition of a discrete tier: disabled if off, else attempt/unsupported by capability. */
function discreteDisposition(
  enabled: boolean,
  capabilities: ServerCapabilities,
  resourceType: string,
): StepDisposition {
  if (!enabled) return 'disabled'
  return canCreate(capabilities, resourceType) ? 'attempt' : 'unsupported'
}

export function buildWritePlan(
  capabilities: ServerCapabilities,
  config: WritebackConfig,
  artifacts: WritebackArtifacts,
): WriteStep[] {
  const cfg = resolveConfig(config)
  const steps: WriteStep[] = []

  // Tier 1 — QuestionnaireResponse (foundational discrete capture, written first).
  steps.push({
    tier: 1,
    resourceType: WRITE_TIER_RESOURCE[1],
    role: 'discrete',
    disposition: discreteDisposition(cfg.enableQuestionnaireResponse, capabilities, WRITE_TIER_RESOURCE[1]),
  })

  // Tier 2 — Observation (derived extraction). Only when there are Observations.
  if (artifacts.observations.length > 0) {
    steps.push({
      tier: 2,
      resourceType: WRITE_TIER_RESOURCE[2],
      role: 'discrete',
      disposition: discreteDisposition(cfg.enableObservation, capabilities, WRITE_TIER_RESOURCE[2]),
    })
  }

  // Tier 0 — DocumentReference floor (last; always attempts at runtime — it is
  // the universal fallback, so capability is not a gate here).
  steps.push({
    tier: 0,
    resourceType: WRITE_TIER_RESOURCE[0],
    role: 'floor',
    disposition: 'attempt',
  })

  return steps
}
