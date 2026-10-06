/**
 * execute — run a write plan against a target, recording every outcome.
 *
 * This is where the ladder actually climbs and degrades. It:
 *   1. writes the Tier-1 QuestionnaireResponse first and captures its
 *      server-assigned id;
 *   2. remaps every client-minted reference to something already written —
 *      the QuestionnaireResponse, and each Observation as it lands — to the
 *      server's id, so provenance links resolve on the server. An Observation
 *      can point at another one: a harmonized concept is `derivedFrom` the
 *      instrument result written just before it (`riskConcept.ts`), so the
 *      Observations are written in order and each id is learned before the
 *      next one is sent;
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

/** `Type/<client id>` → `Type/<server id>`, for everything written so far this run. */
type ServerRefs = Map<string, string>

function learn(refs: ServerRefs, type: string, clientId: string | undefined, serverId: string | undefined): void {
  if (clientId && serverId && clientId !== serverId) refs.set(`${type}/${clientId}`, `${type}/${serverId}`)
}

/**
 * Remap every `reference` naming something written this run to the server's id.
 *
 * ⚠️ **Structural, by exact value — not a text splice.** This used to replace
 * the substring `QuestionnaireResponse/<id>` across the serialized resource,
 * which was safe only while that was the one thing remapped. With Observations
 * remapped too, `Observation/p1` is a prefix of `Observation/p1-concept`, and a
 * splice rewrites both.
 */
function remapReferences<T>(node: T, refs: ServerRefs): T {
  if (refs.size === 0) return node
  if (Array.isArray(node)) return (node as unknown[]).map(n => remapReferences(n, refs)) as unknown as T
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    out[key] = key === 'reference' && typeof value === 'string' && refs.has(value)
      ? refs.get(value)
      : remapReferences(value, refs)
  }
  return out as T
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
  const serverRefs: ServerRefs = new Map()
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
      if (result.ok) learn(serverRefs, 'QuestionnaireResponse', artifacts.qr.id, result.id)
      const stepResult = toStepResult(step, result)
      steps.push(stepResult)
      inScopeDiscreteOutcomes.push(stepResult.outcome)
    } else if (step.resourceType === 'Observation') {
      const stepResult = await writeObservations(target, artifacts.observations, serverRefs)
      steps.push(stepResult)
      inScopeDiscreteOutcomes.push(stepResult.outcome)
    } else if (step.resourceType === 'Condition' && artifacts.condition) {
      const payload = remapReferences(artifacts.condition, serverRefs)
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
 * Write every derived Observation, in order, remapping its references to what
 * has already landed and adding each one's server id as it does. One aggregate
 * step result: `written` only if all succeeded; otherwise
 * `failed`, with a `reason` recording how many of how many landed so a partial
 * write is visible in the scorecard.
 */
async function writeObservations(
  target: WritebackTarget,
  observations: ObservationResource[],
  serverRefs: ServerRefs,
): Promise<WriteStepResult> {
  const step: WriteStep = { tier: 2, resourceType: 'Observation', role: 'discrete', disposition: 'attempt' }
  const ids: string[] = []
  const errors: string[] = []
  for (const obs of observations) {
    const payload = remapReferences(obs, serverRefs)
    const result = await tryCreate(target, payload)
    if (result.ok) {
      learn(serverRefs, 'Observation', obs.id, result.id)
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
