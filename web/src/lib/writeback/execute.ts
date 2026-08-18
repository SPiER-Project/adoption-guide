/**
 * execute — run a write plan against a target, recording every outcome.
 *
 * This is where the ladder actually climbs and degrades. It:
 *   1. writes the Tier-1 QuestionnaireResponse first and captures its
 *      server-assigned id;
 *   2. remaps the client-minted `QuestionnaireResponse/<id>` reference inside
 *      the Tier-2 Observations (`derivedFrom`) and Tier-3 Condition
 *      (`evidence`) to that server id, so provenance links resolve on the
 *      server — the same fixup `SmartDataSource.saveResponse` does today;
 *   3. runs the Tier-0 DocumentReference floor when the discrete tiers did not
 *      fully capture the data (or when `alwaysWriteDocument` is set).
 *
 * Failures are caught and recorded as `outcome: 'failed'` with a readable
 * message — never swallowed, never thrown past the caller. The returned
 * `WritebackResult.steps` is what the scorecard renders.
 */
import { resolveConfig } from './ladder'
import type {
  FhirResource,
  ObservationResource,
} from '../../types/fhir'
import type {
  WritebackArtifacts,
  WritebackConfig,
  WritebackResult,
  WritebackTarget,
  WriteStep,
  WriteStepResult,
} from './types'

/** Deep-remap the QR reference (client id → server id) inside a resource. */
function remapQrReference<T extends FhirResource>(
  resource: T,
  clientId: string | undefined,
  serverId: string | undefined,
): T {
  if (!clientId || !serverId || clientId === serverId) return resource
  const from = `QuestionnaireResponse/${clientId}`
  const to = `QuestionnaireResponse/${serverId}`
  return JSON.parse(JSON.stringify(resource).split(from).join(to)) as T
}

/** Render an unknown thrown value as a scorecard-friendly message. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

export async function executeWritePlan(
  plan: WriteStep[],
  target: WritebackTarget,
  artifacts: WritebackArtifacts,
  config: WritebackConfig = {},
): Promise<WritebackResult> {
  const cfg = resolveConfig(config)
  const steps: WriteStepResult[] = []
  const clientQrId = artifacts.qr.id
  let serverQrId: string | undefined
  // Outcomes of the in-scope discrete tiers (disposition !== 'disabled'),
  // used to decide whether the Tier-0 floor must fire.
  const inScopeDiscreteOutcomes: WriteStepResult['outcome'][] = []

  const discreteSteps = plan.filter(s => s.role === 'discrete')
  const floorStep = plan.find(s => s.role === 'floor')

  for (const step of discreteSteps) {
    if (step.disposition === 'disabled') {
      steps.push({ ...base(step), outcome: 'skipped', reason: 'Tier not enabled' })
      continue
    }
    if (step.disposition === 'unsupported') {
      steps.push({ ...base(step), outcome: 'skipped', reason: 'Server does not support create for this type' })
      inScopeDiscreteOutcomes.push('skipped')
      continue
    }

    // disposition === 'attempt'
    if (step.resourceType === 'QuestionnaireResponse') {
      const result = await tryCreate(target, artifacts.qr)
      if (result.ok) serverQrId = result.id
      const stepResult = toStepResult(step, result)
      steps.push(stepResult)
      inScopeDiscreteOutcomes.push(stepResult.outcome)
    } else if (step.resourceType === 'Observation') {
      const stepResult = await writeObservations(target, artifacts.observations, clientQrId, serverQrId)
      steps.push(stepResult)
      inScopeDiscreteOutcomes.push(stepResult.outcome)
    } else if (step.resourceType === 'Condition' && artifacts.condition) {
      const payload = remapQrReference(artifacts.condition, clientQrId, serverQrId)
      const stepResult = toStepResult(step, await tryCreate(target, payload))
      steps.push(stepResult)
      inScopeDiscreteOutcomes.push(stepResult.outcome)
    }
  }

  // Tier-0 floor: run when nothing discrete landed cleanly, or on demand.
  if (floorStep) {
    const runFloor =
      cfg.alwaysWriteDocument ||
      inScopeDiscreteOutcomes.length === 0 ||
      inScopeDiscreteOutcomes.some(o => o !== 'written')
    if (runFloor) {
      steps.push(toStepResult(floorStep, await tryCreate(target, artifacts.documentReference)))
    } else {
      steps.push({
        ...base(floorStep),
        outcome: 'skipped',
        reason: 'Discrete tiers captured the data; floor not needed',
      })
    }
  }

  return { steps }
}

function base(step: WriteStep): Pick<WriteStepResult, 'tier' | 'resourceType' | 'role'> {
  return { tier: step.tier, resourceType: step.resourceType, role: step.role }
}

type CreateResult = { ok: true; id?: string } | { ok: false; error: string }

async function tryCreate(target: WritebackTarget, resource: FhirResource): Promise<CreateResult> {
  try {
    const { id } = await target.createResource(resource)
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

function toStepResult(step: WriteStep, result: CreateResult): WriteStepResult {
  return result.ok
    ? { ...base(step), outcome: 'written', id: result.id }
    : { ...base(step), outcome: 'failed', error: result.error }
}

/**
 * Write every derived Observation (remapping its QR provenance to the server
 * id). One aggregate step result: `written` only if all succeeded; otherwise
 * `failed`, with a `reason` recording how many of how many landed so a partial
 * write is visible in the scorecard.
 */
async function writeObservations(
  target: WritebackTarget,
  observations: ObservationResource[],
  clientQrId: string | undefined,
  serverQrId: string | undefined,
): Promise<WriteStepResult> {
  const step: WriteStep = { tier: 2, resourceType: 'Observation', role: 'discrete', disposition: 'attempt' }
  const ids: string[] = []
  const errors: string[] = []
  for (const obs of observations) {
    const payload = remapQrReference(obs, clientQrId, serverQrId)
    const result = await tryCreate(target, payload)
    if (result.ok) {
      if (result.id) ids.push(result.id)
    } else {
      errors.push(result.error)
    }
  }
  const total = observations.length
  if (errors.length === 0) {
    return {
      ...base(step),
      outcome: 'written',
      id: ids[0],
      ...(total > 1 ? { reason: `${ids.length} Observations written` } : {}),
    }
  }
  return {
    ...base(step),
    outcome: 'failed',
    error: errors.join('; '),
    reason: `${ids.length}/${total} Observations written`,
  }
}
