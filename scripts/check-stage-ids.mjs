#!/usr/bin/env node
/**
 * Anti-drift check for PATHWAY STAGE IDs in the demo population data.
 *
 * The registry's curated next steps (packages/demo-population/src/next-steps.json)
 * reference a pathway stage by hand-typed id in `stageId` — the one field the
 * registry still curates (demographics are derived from the Patient JSON;
 * current stage / risk / last activity from FHIR data at runtime, see
 * lib/registry.ts). The per-patient
 * scenario files (packages/demo-population/src/scenarios/*.json) reference stages
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
import { join } from 'node:path'
import { readStageCodes, REPO_ROOT, STAGE_SYSTEM } from './lib/stage-codes.mjs'

const root = REPO_ROOT
const populationDir = join(root, 'packages/demo-population/src')
const scenariosDir = join(populationDir, 'scenarios')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

// ---- canonical stage list from FSH ------------------------------------------
// Parsed out of ig/input/fsh/spier-codesystem.fsh by the shared reader, which
// `check:pathway` also calls — one parser, one source of truth. It throws
// rather than returning an empty set, so a rename or a move fails loudly here
// instead of passing over an unread file.
let stageCodes
try {
  stageCodes = readStageCodes()
} catch (e) {
  console.error(`✗ ${e.message}`)
  process.exit(1)
}
console.log(`pathway stages: ${[...stageCodes].join(', ')}`)

const check = (stageId, where) => {
  if (!stageCodes.has(stageId)) fail(`${where}: stage "${stageId}" is not a pathway-stage code`)
}

// ---- next-steps.json ---------------------------------------------------------
const nextSteps = JSON.parse(readFileSync(join(populationDir, 'next-steps.json'), 'utf8'))
// ⚠️ Same reasoning as the scenario floor below — an empty registry would let
// every stage-id assertion pass having examined nothing.
const nextStepEntries = nextSteps && typeof nextSteps === 'object' && !Array.isArray(nextSteps) ? Object.entries(nextSteps) : []
if (nextStepEntries.length === 0) {
  console.error(`\u2717 no next steps parsed from ${populationDir}/next-steps.json`)
  process.exit(1)
}
let patientRefs = 0
for (const [id, step] of nextStepEntries) {
  if (step?.stageId != null) {
    patientRefs++
    check(step.stageId, `next-steps.json ${id}.stageId`)
  }
}
console.log(`✓ next-steps.json: ${patientRefs} stage reference(s) across ${nextStepEntries.length} patient(s)`)

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

// ⚠️ A check that reads nothing must fail, not pass. This gate read the
// scenario directory by path and said nothing when the directory was empty —
// so a path change (this file's own move to packages/demo-population, #388)
// would have turned it green while checking zero fixtures. That is the #232 /
// #261 failure mode, and it was confirmed by emptying the directory and
// watching this script exit 0. Do not remove the floor: it is the only thing
// standing between a moved path and a silent pass.
const scenarioFiles = readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort()
if (scenarioFiles.length === 0) {
  console.error(
    `\u2717 no scenario JSON found in ${scenariosDir} — this gate reads that directory, ` +
      'so an empty read would make it pass having checked nothing.',
  )
  process.exit(1)
}

for (const file of scenarioFiles) {
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
