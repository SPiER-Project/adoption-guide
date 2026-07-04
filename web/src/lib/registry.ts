/**
 * Population registry derivation — turns a patient's static demographics
 * (patients.json) plus their live FHIR slice into the row Population View
 * renders. `currentStage` / `completedStages` / `currentRiskLevel` /
 * `lastActivity` are all computed from the same slice PatientChart already
 * reads, so submitting an assessment on a patient's chart is immediately
 * reflected in their registry row — this is a query over FHIR data, not a
 * hand-curated snapshot.
 *
 * `recommendedNextStep` is the one field patients.json still hand-curates: it's
 * editorial rationale text, not something derivable from artifacts.
 */
import { STAGES } from '../data/catalog'
import { derivePathwayStatus, type PatientArtifacts, type FhirResourceLike } from './patientPathway'
import { highestRiskLevel } from './observationMappers'
import type { RiskAlert } from './observationMappers'
import type { PatientSlice } from '../types/fhir'

export interface RegistryPatient {
  id: string
  displayName: string
  dob: string
  mrn: string
  gender: string
  recommendedNextStep: { stageId: string; label: string; rationale: string }
}

export interface RegistryActivity {
  date: string
  label: string
}

export interface DerivedRegistryRow extends RegistryPatient {
  /** Null once every stage (including the last) is complete — see derivePathwayStatus. */
  currentStage: string | null
  completedStages: string[]
  currentRiskLevel: RiskAlert['level']
  /** Null when the slice has no dated artifact at all. */
  lastActivity: RegistryActivity | null
}

function bestArtifactDate(resource: FhirResourceLike): string | undefined {
  const r = resource as { authored?: string; effectiveDateTime?: string; issued?: string; sent?: string; _savedAt?: string }
  return r.authored ?? r.effectiveDateTime ?? r.issued ?? r.sent ?? r._savedAt
}

function careplanLabel(resource: FhirResourceLike): string {
  const cp = resource as { title?: string; id?: string }
  if (typeof cp.title === 'string') return cp.title
  if (cp.id?.includes('stanley-brown')) return 'Stanley-Brown Safety Plan'
  if (cp.id?.includes('cams-stabilization')) return 'CAMS Stabilization Plan'
  return 'Care plan'
}

function communicationLabel(resource: FhirResourceLike): string {
  const c = resource as { reasonCode?: { text?: string }[]; category?: { text?: string; coding?: { display?: string }[] }[] }
  return c.reasonCode?.[0]?.text ?? c.category?.[0]?.text ?? c.category?.[0]?.coding?.[0]?.display ?? 'Communication'
}

function observationLabel(resource: FhirResourceLike): string {
  const o = resource as { code?: { text?: string; coding?: { display?: string }[] } }
  return o.code?.text ?? o.code?.coding?.[0]?.display ?? 'Observation'
}

/**
 * True when an Observation's `derivedFrom` points at a QuestionnaireResponse
 * already present in this slice's responses. A single submitted assessment
 * (e.g. ASQ) can mint half a dozen item-level Observations within
 * milliseconds of each other and of the response itself — surfacing one of
 * them as "last activity" instead of the response reads as noise. The
 * response is the more meaningful summary of that event.
 */
function isDerivedFromKnownResponse(resource: FhirResourceLike, responseIds: Set<string>): boolean {
  const derivedFrom = (resource as { derivedFrom?: { reference?: string }[] }).derivedFrom
  return derivedFrom?.some(d => responseIds.has(d.reference?.replace('QuestionnaireResponse/', '') ?? '')) ?? false
}

/** Newest dated artifact across the whole slice, or null if nothing has a date. */
function deriveLastActivity(slice: PatientSlice): RegistryActivity | null {
  const candidates: RegistryActivity[] = []
  const responseIds = new Set(slice.responses.map(r => r.id))

  for (const r of slice.responses) {
    if (r.completedAt) candidates.push({ date: r.completedAt, label: r.questionnaireName })
  }
  for (const o of slice.observations) {
    if (isDerivedFromKnownResponse(o, responseIds)) continue
    const date = bestArtifactDate(o)
    if (date) candidates.push({ date, label: observationLabel(o) })
  }
  for (const cp of slice.carePlans) {
    const date = bestArtifactDate(cp)
    if (date) candidates.push({ date, label: careplanLabel(cp) })
  }
  for (const c of slice.communications ?? []) {
    const date = bestArtifactDate(c)
    if (date) candidates.push({ date, label: communicationLabel(c) })
  }

  if (candidates.length === 0) return null
  return candidates.reduce((newest, c) => (new Date(c.date) > new Date(newest.date) ? c : newest))
}

export function deriveRegistryRow(patient: RegistryPatient, slice: PatientSlice): DerivedRegistryRow {
  const artifacts: PatientArtifacts = {
    responses: slice.responses,
    carePlans: slice.carePlans,
    observations: slice.observations,
    communications: slice.communications ?? [],
  }
  const { statuses, activeStageId } = derivePathwayStatus(artifacts)
  const completedStages = STAGES.filter(s => statuses[s.id] === 'complete').map(s => s.id)

  return {
    ...patient,
    currentStage: activeStageId,
    completedStages,
    currentRiskLevel: highestRiskLevel(slice.riskAlerts),
    lastActivity: deriveLastActivity(slice),
  }
}
