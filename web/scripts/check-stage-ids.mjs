#!/usr/bin/env node
/**
 * Anti-drift check for PATHWAY STAGE IDs in the demo population data.
 *
 * The registry (web/src/data/population/patients.json) references a pathway
 * stage by hand-typed id in `recommendedNextStep.stageId` — the one field
 * patients.json still curates (current stage / risk / last activity are
 * derived from FHIR data at runtime, see lib/registry.ts). The per-patient
 * scenario files (web/src/data/population/scenarios/*.json) reference stages
 * as `stageId` on scenario encounters and as codings with the
 * spier-pathway-stage system on CarePlan/Communication/Observation resources
 * — this is the ground truth the registry derives `currentStage` from.
 * Renaming a stage in the CodeSystem silently strands them all.
 *
 * This script parses the CANONICAL stage list straight from the FSH source
 * (ig/input/fsh/spier-codesystem.fsh — no SUSHI compile needed) and asserts
 * that every stage reference in the population data is a real stage code.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..') // repo root
const populationDir = join(webRoot, 'src/data/population')
const scenariosDir = join(populationDir, 'scenarios')
const fshPath = join(root, 'ig/input/fsh/spier-codesystem.fsh')

const STAGE_SYSTEM = 'http://spier.org/CodeSystem/spier-pathway-stage'

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

// ---- canonical stage list from FSH ------------------------------------------
// Isolate the SPiERPathwayStage CodeSystem block (the file may hold several
// CodeSystems), then collect its `* #code "Display" ...` concept lines.
const fsh = readFileSync(fshPath, 'utf8')
const block = fsh.split(/^CodeSystem:\s*/m).find((b) => b.startsWith('SPiERPathwayStage'))
if (!block) {
  console.error(`✗ CodeSystem SPiERPathwayStage not found in ${fshPath}`)
  process.exit(1)
}
const stageCodes = new Set([...block.matchAll(/^\* #([A-Za-z0-9-]+)\s+"/gm)].map((m) => m[1]))
if (stageCodes.size === 0) {
  console.error(`✗ no concepts parsed from SPiERPathwayStage in ${fshPath}`)
  process.exit(1)
}
console.log(`pathway stages: ${[...stageCodes].join(', ')}`)

const check = (stageId, where) => {
  if (!stageCodes.has(stageId)) fail(`${where}: stage "${stageId}" is not a pathway-stage code`)
}

// ---- patients.json -----------------------------------------------------------
const patients = JSON.parse(readFileSync(join(populationDir, 'patients.json'), 'utf8'))
let patientRefs = 0
for (const p of patients) {
  if (p.recommendedNextStep?.stageId != null) {
    patientRefs++
    check(p.recommendedNextStep.stageId, `patients.json ${p.id} recommendedNextStep.stageId`)
  }
}
console.log(`✓ patients.json: ${patientRefs} stage reference(s) across ${patients.length} patient(s)`)

// ---- scenario files ----------------------------------------------------------
// Scenarios reference stages two ways: a literal `stageId` property (encounter
// timelines) and FHIR codings bound to the spier-pathway-stage system
// (Communication.category / meta.tag). Walk the whole JSON tree for both.
function* stageRefs(node, path) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* stageRefs(node[i], `${path}[${i}]`)
  } else if (node && typeof node === 'object') {
    if (typeof node.stageId === 'string') yield { stageId: node.stageId, where: `${path}.stageId` }
    if (node.system === STAGE_SYSTEM && typeof node.code === 'string') {
      yield { stageId: node.code, where: `${path} (${STAGE_SYSTEM.split('/').pop()} coding)` }
    }
    for (const [key, value] of Object.entries(node)) yield* stageRefs(value, `${path}.${key}`)
  }
}

for (const file of readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort()) {
  const scenario = JSON.parse(readFileSync(join(scenariosDir, file), 'utf8'))
  let n = 0
  for (const { stageId, where } of stageRefs(scenario, file)) {
    n++
    check(stageId, where)
  }
  console.log(`✓ scenarios/${file}: ${n} stage reference(s) checked`)
}

if (failures) {
  console.error(`\nstage-id drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nstage-id drift check passed.')
