/**
 * The `meta.tag` that marks a written resource with its pathway stage.
 *
 * One definition, reading the display from the stage catalog (which is
 * generated from the pathway-stage CodeSystem), so the tag's display can never
 * drift from the CodeSystem's. It was FIVE local `stageTag()` functions, each
 * pairing a module-level `STAGE_ID` with a hand-typed `STAGE_TITLE`: four
 * identical, and riskEpisode.ts's carrying its title as a literal — exactly the
 * drift copying invites (C3 of the 2026-09-20 audit).
 *
 * `StageId` is the generated union, so a caller that names a stage the
 * CodeSystem does not have is a compile error rather than an unresolvable tag.
 */
import type { StageId } from '@spier/fhir-artifacts/generated/stage-ids.generated'
import { stageTitleById } from '../data/catalog/stages'
import { PATHWAY_STAGE_SYSTEM } from './patientPathway'

export interface StageTagCoding {
  system: string
  code: StageId
  display: string
}

export function stageTag(stageId: StageId): StageTagCoding[] {
  return [{ system: PATHWAY_STAGE_SYSTEM, code: stageId, display: stageTitleById(stageId) }]
}
