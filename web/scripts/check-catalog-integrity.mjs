#!/usr/bin/env node
/**
 * Anti-drift check for the TOOL CATALOG wiring.
 *
 * The catalog (web/src/data/catalog/tools.ts) merges hand-maintained layers
 * that can silently drift apart:
 *
 *   - generated FHIR (web/src/data/fhir/ActivityDefinition-*.json and
 *     PlanDefinition-*.json, produced by `npm run copy-fhir`)
 *   - TOOL_UI_METADATA (tool-ui-metadata.ts) — UI overlay keyed by Tool id
 *   - AD_TO_TOOL_ID (tools.ts) — maps ActivityDefinition ids to Tool ids
 *
 * Every catalogued tool is FHIR-backed: it derives its clinical fields from an
 * ActivityDefinition and its stage from the PlanDefinition that references it.
 *
 * This script asserts:
 *
 *   A. every PlanDefinition stage useContext is a real code in the
 *      pathway-stage CodeSystem (TOOL_UI_METADATA carries no stageIds —
 *      FHIR-backed tools get theirs from the PlanDefinition that references
 *      their ActivityDefinition)
 *   B. no orphans in the id space:
 *      - every TOOL_UI_METADATA key is a FHIR-backed Tool id (via
 *        AD_TO_TOOL_ID)
 *      - every AD_TO_TOOL_ID key is a generated ActivityDefinition, and every
 *        generated ActivityDefinition has an AD_TO_TOOL_ID entry (otherwise
 *        tools.ts drops it with only a console.warn)
 *      - every FHIR-backed ActivityDefinition is referenced by a
 *        PlanDefinition action (otherwise the tool gets no stageId and is
 *        dropped at runtime)
 *   C. every Questionnaire canonical referenced by an ActivityDefinition
 *      (relatedArtifact or SDC sdc-questionnaire extension) resolves,
 *      version-stripped, to a Questionnaire JSON in FHIR-Resources/
 *   D. every ActivityDefinition carries licensing metadata (issue #127):
 *      a `copyright` notice AND an `instrument-licensing-status` extension
 *      whose code is real, and the ADs of a multi-AD tool agree on it.
 *      Without this a new tool silently ships with no licensing statement,
 *      and the catalog's `Tool.licensing` — derived from this extension since
 *      #127 — quietly becomes undefined
 *
 * Requires `npm run copy-fhir` to have run (reads web/src/data/fhir/).
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..') // repo root
const fhirDir = join(webRoot, 'src/data/fhir')
const catalogDir = join(webRoot, 'src/data/catalog')
const questionnairesDir = join(root, 'FHIR-Resources')

const STAGE_SYSTEM = 'http://spier.org/CodeSystem/spier-pathway-stage'
const SDC_QUESTIONNAIRE_EXT =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire'
const LICENSING_EXT = 'http://spier.org/StructureDefinition/instrument-licensing-status'

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

const stripVersion = (canonical) => {
  const pipe = canonical.indexOf('|')
  return pipe === -1 ? canonical : canonical.slice(0, pipe)
}

// ---- load generated FHIR ---------------------------------------------------
const stageCsPath = join(fhirDir, 'CodeSystem-spier-pathway-stage.json')
if (!existsSync(stageCsPath)) {
  console.error(`✗ ${stageCsPath} not found — run \`npm run copy-fhir\` first.`)
  process.exit(1)
}
const stageCodes = new Set(
  (JSON.parse(readFileSync(stageCsPath, 'utf8')).concept ?? []).map((c) => c.code),
)
console.log(`pathway stages: ${[...stageCodes].join(', ')}`)

const activityDefs = [] // { id, url, questionnaireUrls: string[] }
const pdActionAdUrls = new Set() // version-stripped AD canonicals referenced by PDs
for (const file of readdirSync(fhirDir)) {
  if (!file.endsWith('.json')) continue
  const res = JSON.parse(readFileSync(join(fhirDir, file), 'utf8'))
  if (res.resourceType === 'ActivityDefinition') {
    const questionnaireUrls = [
      ...(res.relatedArtifact ?? []).map((a) => a.resource),
      ...(res.extension ?? [])
        .filter((e) => e.url === SDC_QUESTIONNAIRE_EXT)
        .map((e) => e.valueCanonical),
    ].filter((u) => u && stripVersion(u).includes('/Questionnaire/'))
    activityDefs.push({
      id: res.id,
      url: res.url,
      questionnaireUrls,
      copyright: res.copyright,
      licensing: (res.extension ?? []).find((e) => e.url === LICENSING_EXT)?.valueCode,
    })
  } else if (res.resourceType === 'PlanDefinition') {
    // A: PD stage useContext must be a real stage code
    const stage = (res.useContext ?? [])
      .flatMap((c) => c.valueCodeableConcept?.coding ?? [])
      .find((c) => c.system === STAGE_SYSTEM)?.code
    if (stage && !stageCodes.has(stage)) {
      fail(`${file}: useContext stage "${stage}" is not a pathway-stage code`)
    }
    for (const action of res.action ?? []) {
      if (action.definitionCanonical) pdActionAdUrls.add(stripVersion(action.definitionCanonical))
    }
  }
}
if (activityDefs.length === 0) {
  fail(`no ActivityDefinition-*.json in ${fhirDir} — run \`npm run copy-fhir\``)
}

// ---- parse the hand-maintained catalog TS (regex, no compile) --------------
const uiSrc = readFileSync(join(catalogDir, 'tool-ui-metadata.ts'), 'utf8')
const toolsSrc = readFileSync(join(catalogDir, 'tools.ts'), 'utf8')

// TOOL_UI_METADATA keys
const uiIds = [...uiSrc.matchAll(/^\s*'(TL-\d+)':\s*\{/gm)].map((m) => m[1])
if (uiIds.length === 0) fail('tool-ui-metadata.ts: no TOOL_UI_METADATA keys parsed — has the file shape changed?')

// AD_TO_TOOL_ID block in tools.ts
const adMapBlock = toolsSrc.match(/const AD_TO_TOOL_ID[^=]*=\s*\{([\s\S]*?)\}/)?.[1] ?? ''
const adToTool = [...adMapBlock.matchAll(/(\w+):\s*'(TL-\d+)'/g)]
  .map((m) => ({ adId: m[1], toolId: m[2] }))
if (adToTool.length === 0) fail('tools.ts: no AD_TO_TOOL_ID entries parsed — has the file shape changed?')

// ---- B: id-space integrity --------------------------------------------------
const adIds = new Set(activityDefs.map((ad) => ad.id))
const fhirToolIds = new Set(adToTool.map((m) => m.toolId))

for (const { adId } of adToTool) {
  if (!adIds.has(adId)) {
    fail(`tools.ts: AD_TO_TOOL_ID maps "${adId}" but no ActivityDefinition-${adId}.json is generated`)
  }
}
for (const ad of activityDefs) {
  if (!adToTool.some((m) => m.adId === ad.id)) {
    fail(`ActivityDefinition ${ad.id} has no AD_TO_TOOL_ID entry in tools.ts — tool would be dropped from the catalog`)
  }
  if (!pdActionAdUrls.has(stripVersion(ad.url))) {
    fail(`ActivityDefinition ${ad.id} (${ad.url}) is not referenced by any PlanDefinition action — tool would get no stageId and be dropped`)
  }
}
for (const id of uiIds) {
  if (!fhirToolIds.has(id)) {
    fail(`tool-ui-metadata.ts: "${id}" matches no ActivityDefinition-backed tool — orphan UI metadata`)
  }
}
console.log(`✓ id space: ${activityDefs.length} ActivityDefinition(s), ${uiIds.length} UI metadata entries cross-checked`)

// ---- C: questionnaire canonicals resolve to real Questionnaire JSON --------
function* jsonFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* jsonFiles(p)
    else if (entry.endsWith('.json')) yield p
  }
}
const questionnaireUrls = new Set()
for (const p of jsonFiles(questionnairesDir)) {
  let res
  try { res = JSON.parse(readFileSync(p, 'utf8')) } catch { continue }
  if (res.resourceType === 'Questionnaire' && res.url) questionnaireUrls.add(stripVersion(res.url))
}

let qRefs = 0
for (const ad of activityDefs) {
  for (const canonical of ad.questionnaireUrls) {
    qRefs++
    if (!questionnaireUrls.has(stripVersion(canonical))) {
      fail(`ActivityDefinition ${ad.id}: questionnaire "${canonical}" resolves to no Questionnaire JSON in FHIR-Resources/`)
    }
  }
}
console.log(`✓ questionnaires: ${qRefs} ActivityDefinition reference(s) checked against ${questionnaireUrls.size} Questionnaire(s)`)

// ---- D: licensing metadata (issue #127) ------------------------------------
// The status codes come from the generated CodeSystem, not a list retyped here
// — adding a code to the FSH must not require editing this script, and a typo
// in an AD's valueCode must not pass because the typo was also copied here.
const licCsPath = join(fhirDir, 'CodeSystem-spier-instrument-licensing-status.json')
if (!existsSync(licCsPath)) {
  fail(`${licCsPath} not found — the instrument-licensing CodeSystem is missing from the IG build`)
}
const licensingCodes = existsSync(licCsPath)
  ? new Set((JSON.parse(readFileSync(licCsPath, 'utf8')).concept ?? []).map((c) => c.code))
  : new Set()

for (const ad of activityDefs) {
  if (!ad.licensing) {
    fail(`ActivityDefinition ${ad.id}: no instrument-licensing-status extension — add one in ig/input/fsh/ (see instrument-licensing.fsh). Use #unknown if the #64 audit has not established it; do not omit it.`)
  } else if (!licensingCodes.has(ad.licensing)) {
    fail(`ActivityDefinition ${ad.id}: licensing status "${ad.licensing}" is not a code in spier-instrument-licensing-status`)
  }
  if (!ad.copyright) {
    fail(`ActivityDefinition ${ad.id}: no copyright notice — the coded status alone does not tell an adopter what to do`)
  }
}

// Multi-AD tools are ONE instrument, so their ADs must agree; tools.ts reads
// the status off whichever AD sorts first and only console.warns on a split.
const licensingByTool = new Map()
for (const ad of activityDefs) {
  const toolId = adToTool.find((m) => m.adId === ad.id)?.toolId
  if (!toolId) continue
  const seen = licensingByTool.get(toolId) ?? new Map()
  seen.set(ad.licensing, [...(seen.get(ad.licensing) ?? []), ad.id])
  licensingByTool.set(toolId, seen)
}
for (const [toolId, seen] of licensingByTool) {
  if (seen.size > 1) {
    const detail = [...seen].map(([code, ids]) => `${code}: ${ids.join(', ')}`).join(' | ')
    fail(`tool ${toolId}: its ActivityDefinitions disagree on licensing status (${detail})`)
  }
}
const licCounts = [...licensingCodes]
  .map((code) => [code, activityDefs.filter((ad) => ad.licensing === code).length])
  .filter(([, n]) => n > 0)
  .map(([code, n]) => `${n} ${code}`)
  .join(', ')
console.log(`✓ licensing: ${activityDefs.length} ActivityDefinition(s) carry a status + copyright (${licCounts})`)

if (failures) {
  console.error(`\ncatalog-integrity check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\ncatalog-integrity check passed.')
