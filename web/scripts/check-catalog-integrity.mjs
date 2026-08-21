#!/usr/bin/env node
/**
 * Anti-drift check for the TOOL CATALOG wiring.
 *
 * The catalog (web/src/data/catalog/tools.ts) merges hand-maintained layers
 * that can silently drift apart:
 *
 *   - generated FHIR (packages/fhir-artifacts/generated/ActivityDefinition-*.json and
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
 *   C. the Questionnaire <-> ActivityDefinition relation holds in BOTH
 *      directions, version-stripped:
 *        - every Questionnaire canonical referenced by an ActivityDefinition
 *          (relatedArtifact or SDC sdc-questionnaire extension) resolves to a
 *          Questionnaire JSON in FHIR-Resources/
 *        - every Questionnaire JSON in FHIR-Resources/ is referenced by some
 *          ActivityDefinition. Check B stops a *tool* from reaching the app
 *          without an AD behind it; this stops the artifact one layer down —
 *          a Questionnaire the app can import while the IG describes no tool
 *          that administers it, and so publishes no stage, no licensing
 *          status and no clinical metadata for it
 *   D. every ActivityDefinition carries licensing metadata (issue #127):
 *      a `copyright` notice AND an `instrument-licensing-status` extension
 *      whose code is real, and the ADs of a multi-AD tool agree on it.
 *      Without this a new tool silently ships with no licensing statement,
 *      and the catalog's `Tool.licensing` — derived from this extension since
 *      #127 — quietly becomes undefined
 *   E. the Tool Configuration presets that are DEFINED by a catalog property
 *      (Common Mid-Tier = every `core` tool; Maximalist = all launchable) have
 *      not been re-frozen into hand-listed ids, and their derivations still
 *      match what the UI tells adopters they mean
 *
 * Requires `npm run copy-fhir` to have run (reads packages/fhir-artifacts/generated/).
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..') // repo root
const fhirDir = join(root, 'packages/fhir-artifacts/generated')
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
// Keyed by version-stripped canonical, valued by the file(s) that declare it —
// the path is what makes the reverse failure below actionable, and a canonical
// declared twice makes the reverse check unable to tell the two files apart.
const questionnaireFiles = new Map()
for (const p of jsonFiles(questionnairesDir)) {
  let res
  try { res = JSON.parse(readFileSync(p, 'utf8')) } catch { continue }
  if (res.resourceType !== 'Questionnaire') continue
  const rel = p.slice(root.length + 1)
  if (!res.url) {
    // Nothing can reference it, so the reverse check below could never see it.
    // Silently skipping it (which this did) is how an unreferenced Questionnaire
    // stays invisible to BOTH directions.
    fail(`${rel}: Questionnaire has no \`url\` — nothing can reference it, and it is unreachable from any ActivityDefinition`)
    continue
  }
  const stripped = stripVersion(res.url)
  questionnaireFiles.set(stripped, [...(questionnaireFiles.get(stripped) ?? []), rel])
}
// A check that reads nothing must fail, not pass (#232 / #261): a moved or
// renamed FHIR-Resources/ would otherwise make both directions vacuous.
if (questionnaireFiles.size === 0) {
  fail(`no Questionnaire JSON found under ${questionnairesDir} — this check reads that tree, so an empty read makes both directions of C vacuous`)
}
for (const [canonical, paths] of questionnaireFiles) {
  if (paths.length > 1) {
    fail(`Questionnaire canonical "${canonical}" is declared by ${paths.length} files (${paths.join(', ')}) — one shadows the other, and a reference cannot say which it meant`)
  }
}

// C-forward: an ActivityDefinition's questionnaire reference resolves.
const referencedQuestionnaires = new Set()
let qRefs = 0
for (const ad of activityDefs) {
  for (const canonical of ad.questionnaireUrls) {
    qRefs++
    const stripped = stripVersion(canonical)
    referencedQuestionnaires.add(stripped)
    if (!questionnaireFiles.has(stripped)) {
      fail(`ActivityDefinition ${ad.id}: questionnaire "${canonical}" resolves to no Questionnaire JSON in FHIR-Resources/`)
    }
  }
}

// C-reverse: a Questionnaire nothing administers. Measured 2026-08-20 as 18 of
// 18 referenced, so there is deliberately NO allowlist here — an exemption list
// starting empty is the only kind that cannot go stale, and an orphan is always
// either a missing ActivityDefinition or a Questionnaire that should not be in
// the tree. If you find yourself adding one, the artifact is the thing to fix.
let orphans = 0
for (const [canonical, [path]] of questionnaireFiles) {
  if (referencedQuestionnaires.has(canonical)) continue
  orphans++
  fail(
    `${path}: Questionnaire "${canonical}" is referenced by no ActivityDefinition — the app could ` +
      `import and render it while the IG publishes no tool that administers it, so it would carry no ` +
      `stage, no licensing status (check D) and no clinical metadata. Author an ActivityDefinition in ` +
      `ig/input/fsh/ naming it (relatedArtifact or the SDC sdc-questionnaire extension), or remove the ` +
      `Questionnaire.`,
  )
}
console.log(
  `✓ questionnaires: ${qRefs} ActivityDefinition reference(s) resolve, and ` +
    `${questionnaireFiles.size - orphans}/${questionnaireFiles.size} Questionnaire(s) in FHIR-Resources/ ` +
    `are administered by an ActivityDefinition`,
)

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

// ---- E: tool-config presets stay derived from the catalog -------------------
// Common Mid-Tier and Maximalist are DEFINED by catalog properties
// (inclusionStatus === 'core', and "all launchable"), not by hand-listed ids.
// They used to be hand-listed, and mid-tier was never revisited as the catalog
// grew: it ended up naming four tools while excluding 17 of the 20 the catalog
// marks core, covering 2 of 8 pathway stages, and still calling itself a
// typical site. Nothing caught that, because nothing compared the two. This
// asserts the derivation is still in force.
const PRESET_FILE = 'src/data/toolPresets.ts'
const presetSrc = readFileSync(join(webRoot, PRESET_FILE), 'utf8')
const DERIVED_PRESETS = ['common-mid-tier', 'maximalist']

// The regexes below are the whole check, so a rename or a move would turn this
// into a silent pass. Assert the shape it depends on before relying on it.
if (!/export const PRESETS/.test(presetSrc) || !/export function presetToolIds/.test(presetSrc)) {
  fail(
    `${PRESET_FILE}: PRESETS / presetToolIds not found — this check greps for them, so a rename ` +
      `silently disables it. Update the patterns below along with the code.`,
  )
}

for (const id of DERIVED_PRESETS) {
  // The preset's own object literal, from its id up to the closing brace.
  const block = presetSrc.match(new RegExp(`id:\\s*'${id}'[\\s\\S]*?\\n\\s*\\},`))?.[0]
  if (!block) {
    fail(`${PRESET_FILE}: preset "${id}" not found — has the PRESETS shape changed?`)
    continue
  }
  const listed = [...block.matchAll(/'(TL-\d+)'/g)].map((m) => m[1])
  if (listed.length > 0) {
    fail(
      `${PRESET_FILE}: preset "${id}" hand-lists ${listed.join(', ')} in toolIds. ` +
        `It must stay derived from the catalog in presetToolIds() — a hand-listed copy is a second ` +
        `source of truth and goes stale as tools are added (that is exactly how mid-tier came to ` +
        `exclude 17 core tools).`,
    )
  }
}

// The derivations themselves must still be the ones the descriptions claim.
if (!/case 'common-mid-tier':[\s\S]*?inclusionStatus === 'core'/.test(presetSrc)) {
  fail(
    `${PRESET_FILE}: presetToolIds() no longer derives "common-mid-tier" from ` +
      `inclusionStatus === 'core'. Its preset description tells adopters it is every core tool; ` +
      `update both together or the UI states a coverage claim the code does not implement.`,
  )
}

// Hand-listed ids anywhere in PRESETS must be real tools, or the preset
// silently enables nothing for that entry.
const knownToolIds = new Set(adToTool.map((m) => m.toolId))
const presetsBlock = presetSrc.match(/export const PRESETS[\s\S]*?\n\]/)?.[0] ?? ''
for (const [, toolId] of presetsBlock.matchAll(/'(TL-\d+)'/g)) {
  if (!knownToolIds.has(toolId)) {
    fail(`${PRESET_FILE}: preset references "${toolId}", which is not a catalogued tool id`)
  }
}

// Informational: a core tool with no launch action cannot be enabled at all, so
// mid-tier silently omits it. Not a failure — that is the normal state for a
// core tool that is catalogued but not yet built — but it should be visible.
const coreIds = [...uiSrc.matchAll(/^\s*'(TL-\d+)':\s*\{([\s\S]*?)^\s*\},/gm)]
  .filter((m) => /inclusionStatus:\s*'core'/.test(m[2]))
  .map((m) => m[1])
const launchableIds = new Set(
  [...uiSrc.matchAll(/^\s*'(TL-\d+)':\s*\{([\s\S]*?)^\s*\},/gm)]
    .filter((m) => /launchActions:\s*\[\s*\{/.test(m[2]))
    .map((m) => m[1]),
)
const coreNotLaunchable = coreIds.filter((id) => !launchableIds.has(id))
console.log(
  `✓ presets: "common-mid-tier" and "maximalist" stay derived from the catalog ` +
    `(${coreIds.length} core tool(s)${
      coreNotLaunchable.length
        ? `, ${coreNotLaunchable.length} not yet launchable so omitted: ${coreNotLaunchable.join(', ')}`
        : ''
    })`,
)

// ─── Data-dictionary links resolve ──────────────────────────
//
// The dictionary renders each code as a link to its definition, and for a
// SPiER-local code that target is a page in OUR OWN IG
// (`/ig/CodeSystem-<id>.html`), which the IG Publisher generates from
// `ig/input/fsh/`. So a SPiER-local system with no generated CodeSystem is a
// link that 404s on the page an implementer is most likely to trust.
//
// That was not hypothetical: `asq-item` lived only in
// FHIR-Resources/ASQ/asq-item.json, which the publisher never builds (it is
// triggered by `ig/**` alone), so `/ig/CodeSystem-asq-item.html` returned 404
// while every sibling resolved. It has since moved into asq.fsh; this check is
// what stops the next one.
//
// Offline by construction — it compares against the generated files in
// packages/fhir-artifacts/generated/ rather than fetching anything, so it belongs in `verify`
// alongside the other drift checks.
const SPIER_CS_PREFIX = 'http://spier.org/CodeSystem/'
const dictSrc = readFileSync(join(catalogDir, 'dataElements.ts'), 'utf8')
// `system:` covers both a Concept/Binding `code` and a Binding `value`, since
// #260 gave the value side its own `{ system, valueSet }` slot rather than the
// interim `answerSystem` field. Kept as a source scrape rather than an import
// because this script is plain Node and the catalog is TypeScript.
const dictSystems = new Set(
  [...dictSrc.matchAll(/\bsystem: '([^']+)'/g)].map((m) => m[1]),
)
if (dictSystems.size === 0) {
  fail('dataElements.ts: no systems parsed — has the Binding shape changed?')
}

// ValueSet canonicals are claims too, and they resolve to a DIFFERENT generated
// file than CodeSystems do. A `valueSet` pointing at nothing would render as a
// bindable set on the page while the IG published no such set — the same class
// of unbacked claim as a dead code link, so it is gated the same way.
//
// That sentence described a rendering that did not exist until #281: the page
// showed `Concept.valueSet` as plain text and `Binding.value.valueSet` not at
// all, so a stale canonical could not have misled anyone. Both are now LINKS
// (`valueSetHref` in dataElements.ts → `ig/ValueSet-<id>.html`), which is what
// makes this gate load-bearing rather than aspirational: it is the only thing
// standing between a renamed ValueSet id and a 404 in the published IG.
const dictValueSets = new Set(
  [...dictSrc.matchAll(/\bvalueSet: '([^']+)'/g)].map((m) => m[1]),
)
const SPIER_VS_PREFIX = 'http://spier.org/ValueSet/'
const generatedVsIds = new Set(
  readdirSync(fhirDir)
    .filter((f) => f.startsWith('ValueSet-') && f.endsWith('.json'))
    .map((f) => f.slice('ValueSet-'.length, -'.json'.length)),
)
let vsLinkable = 0
for (const vs of [...dictValueSets].sort()) {
  if (!vs.startsWith(SPIER_VS_PREFIX)) continue
  const id = vs.slice(SPIER_VS_PREFIX.length)
  if (generatedVsIds.has(id)) {
    vsLinkable++
    continue
  }
  fail(
    `dataElements.ts references ${vs}, but no ValueSet-${id}.json is generated — ` +
      `the dictionary would present a bindable value set the IG does not publish. ` +
      `Define it in ig/input/fsh/.`,
  )
}
console.log(
  `✓ data dictionary: all ${vsLinkable} SPiER-local ValueSet(s) referenced have a generated definition`,
)

const generatedCsIds = new Set(
  readdirSync(fhirDir)
    .filter((f) => f.startsWith('CodeSystem-') && f.endsWith('.json'))
    .map((f) => f.slice('CodeSystem-'.length, -'.json'.length)),
)

let linkable = 0
for (const system of [...dictSystems].sort()) {
  if (!system.startsWith(SPIER_CS_PREFIX)) continue
  const id = system.slice(SPIER_CS_PREFIX.length)
  if (generatedCsIds.has(id)) {
    linkable++
    continue
  }
  fail(
    `dataElements.ts references ${system}, but no CodeSystem-${id}.json is generated — ` +
      `the data dictionary would link to /ig/CodeSystem-${id}.html, which the IG Publisher ` +
      `will not have built. Define it in ig/input/fsh/, not FHIR-Resources/.`,
  )
}
console.log(
  `✓ data dictionary: all ${linkable} SPiER-local CodeSystem(s) referenced have a generated ` +
    `definition, so their IG links resolve`,
)

if (failures) {
  console.error(`\ncatalog-integrity check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\ncatalog-integrity check passed.')
