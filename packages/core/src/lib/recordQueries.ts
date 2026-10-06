/**
 * Questions asked of a patient's record — which form an artifact came from,
 * which instrument that was, whether a resource claims a profile — that the
 * pathway evaluator, the measure engine and the chart all need answered the
 * same way.
 *
 * Gathered here on 2026-10-06 from the two modules that had each grown a share
 * of them: `conformsTo` lived in the measure engine and the instrument lookups
 * in the pathway evaluator, so the chart imported its record queries from the
 * module that decides obligations, and the evaluator imported its from the one
 * that scores quality measures. Stage resolution is the other half of the same
 * job and lives with its CodeSystem in `patientPathway.ts`; this module calls it.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import { bestArtifactDate } from './artifactDate'
import { derivedResponseIds, stageForArtifact, toolForResponse, type FhirResourceLike } from './patientPathway'
import type { PatientSlice } from '../types/fhir'

/**
 * Does the resource claim this profile?
 *
 * One definition because the evaluator, the measure engine and the record page
 * ask the same question of the same resources — is this Communication a
 * crisis-resources record, is this Procedure means-safety counseling — and
 * `npm run check:dupes` fails a second copy of a one-line predicate that is
 * really a statement about what `meta.profile` means.
 */
export function conformsTo(
  // Structurally typed rather than `FhirResource`: the pathway evaluator reads
  // the same question off `FhirResourceLike`, whose `resourceType` is optional.
  // This predicate looks at `meta.profile` and nothing else, so requiring more
  // of its argument than it reads would just cost every caller a cast.
  resource: { meta?: { profile?: string[] } } | undefined,
  profile: string,
): boolean {
  const profiles = resource?.meta?.profile
  return Array.isArray(profiles) && profiles.includes(profile)
}

/** A date string as epoch milliseconds, or NaN when absent or unparseable. */
export function timeOf(value: string | undefined): number {
  if (!value) return NaN
  const at = new Date(value).getTime()
  return Number.isFinite(at) ? at : NaN
}

/**
 * The instrument behind an artifact, in the words a clinician uses for it.
 *
 * A QuestionnaireResponse names its own Questionnaire; a derived Observation
 * carries `derivedFrom` back to the response it came from, which is the hop the
 * mappers leave for readers rather than restating the tool on every resource.
 *
 * Shared because *What’s on file* asks the same question of every row it
 * renders, and `check:dupes` fails the paste. Its one heuristic branch is why it
 * is shared rather than reimplemented: a second copy would name a different
 * instrument on the same artifact the day either was tuned.
 */
export function instrumentName(resource: FhirResourceLike, slice: PatientSlice): string | null {
  if (resource.resourceType === 'QuestionnaireResponse') {
    const tool = toolForResponse(resource)
    if (tool) return tool.shortName ?? tool.name
  }
  const stored = sourceResponse(resource, slice)
  if (!stored) return null
  const tool = toolForResponse(stored.resource)
  return tool ? (tool.shortName ?? tool.name) : stored.questionnaireName
}

/**
 * The completed form an artifact came from, or null.
 *
 * ⚠️ **Split out of `instrumentName` on 2026-09-22 rather than copied.** The
 * record page has to LINK a result back to the form that produced it, and the
 * name alone cannot be linked; a second walk would be a second answer to "which
 * form is this from" the day either was tuned, which is what `check:dupes`
 * exists to stop. `instrumentName` is the name of what this returns, and
 * nothing else now resolves it.
 */
export function sourceResponse(
  resource: FhirResourceLike,
  slice: PatientSlice,
): PatientSlice['responses'][number] | null {
  for (const id of derivedResponseIds(resource as { derivedFrom?: Array<{ reference?: string }> }, slice.observations ?? [])) {
    const stored = slice.responses.find(r => r.id === id)
    if (stored) return stored
  }
  // ⚠️ Last resort, and a heuristic rather than a link: the latest response at
  // the same pathway stage, recorded no later than this artifact. The scenario
  // fixtures' Observations predate `derivedFrom` and carry only a stage tag, so
  // without this the chart would say "Aug 6: no risk identified" where a
  // clinician expects "ASQ on Aug 6". Naming the wrong instrument is the risk
  // it carries, which is why it is the last thing tried and why it is confined
  // to one stage, one direction in time and the SAME DAY. Without the day bound
  // it named a CAMS worksheet from two months earlier as the source of a risk
  // status recorded in July — a plausible sentence that was not true.
  const stage = stageForArtifact(resource, slice)
  const date = bestArtifactDate(resource)
  const at = timeOf(date)
  if (!stage || !Number.isFinite(at)) return null
  const day = (value: string | undefined) => (value ? value.slice(0, 10) : null)
  const sameStage = slice.responses
    .filter(r => stageForArtifact(r.resource as FhirResourceLike) === stage)
    .map(r => {
      const on = bestArtifactDate(r.resource as FhirResourceLike)
      return { stored: r, at: timeOf(on), on }
    })
    .filter(r => Number.isFinite(r.at) && r.at <= at && day(r.on) === day(date))
    .sort((a, b) => a.at - b.at)
    .at(-1)
  return sameStage?.stored ?? null
}
