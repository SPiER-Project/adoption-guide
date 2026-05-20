// Derived from ig/input/fsh/spier-codesystem.fsh via the copy-fhir prebuild step
// (web/src/data/fhir/CodeSystem-spier-pathway-stage.json). FSH is the source
// of truth — to add a stage, edit the FSH and re-run sushi.

import codeSystem from '../fhir/CodeSystem-spier-pathway-stage.json'

interface CodeSystemConcept {
  code: string
  display: string
  definition: string
}

interface CodeSystemDoc {
  concept: CodeSystemConcept[]
}

export interface Stage {
  id: string
  title: string
  description: string
  orderIndex: number
}

const concepts = (codeSystem as CodeSystemDoc).concept ?? []

export const STAGES: Stage[] = concepts.map((c, i) => ({
  id: c.code,
  title: c.display,
  description: c.definition,
  orderIndex: i,
}))

export const stageById = (id: string) => STAGES.find((s) => s.id === id)
export const stageTitleById = (id: string) => stageById(id)?.title ?? id
