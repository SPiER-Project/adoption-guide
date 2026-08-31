// Derived from ig/input/fsh/spier-codesystem.fsh via the copy-fhir prebuild step
// (packages/fhir-artifacts/generated/CodeSystem-spier-pathway-stage.json). FSH is the source
// of truth — to add a stage, edit the FSH and re-run sushi.

import codeSystem from '@spier/fhir-artifacts/generated/CodeSystem-spier-pathway-stage.json'
import { isStageId, type StageId } from '@spier/fhir-artifacts/generated/stage-ids.generated'

export type { StageId }

interface CodeSystemConcept {
  code: string
  display: string
  definition: string
}

interface CodeSystemDoc {
  concept: CodeSystemConcept[]
}

export interface Stage {
  id: StageId
  title: string
  description: string
  orderIndex: number
}

const concepts = (codeSystem as CodeSystemDoc).concept ?? []

export const STAGES: Stage[] = concepts.map((c, i) => {
  // Both `c.code` and STAGE_IDS (which backs `isStageId`) are generated from
  // the same CodeSystem, so this can only fail if copy-fhir's own generators
  // somehow desync with each other — a bug in the build, not in the data. A
  // bare `as StageId` cast here would hide exactly that failure instead of
  // catching it; the checked guard-and-throw is what makes StageId a real
  // safety net rather than a type-system fiction.
  if (!isStageId(c.code)) {
    throw new Error(
      `[stages] CodeSystem-spier-pathway-stage.json concept "${c.code}" is not a recognized StageId — ` +
        'stage-ids.generated.ts is out of sync with the CodeSystem it was generated from. Re-run `npm run copy-fhir -- --force`.',
    )
  }
  return {
    id: c.code,
    title: c.display,
    description: c.definition,
    orderIndex: i,
  }
})

export const stageById = (id: string) => STAGES.find((s) => s.id === id)
export const stageTitleById = (id: string) => stageById(id)?.title ?? id
