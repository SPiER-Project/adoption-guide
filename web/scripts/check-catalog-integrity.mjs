#!/usr/bin/env node
/**
 * Anti-drift check for the TOOL CATALOG wiring.
 *
 * The catalog (packages/core/src/data/catalog/tools.ts) merges hand-maintained layers
 * that can silently drift apart:
 *
 *   - generated FHIR (packages/fhir-artifacts/generated/ActivityDefinition-*.json and
 *     PlanDefinition-*.json, produced by `npm run copy-fhir`)
 *   - TOOL_UI_METADATA (tool-ui-metadata.ts) — UI overlay keyed by Tool id
 *
 * The AD → Tool-id pairing used to be a third such layer: a hand-written
 * `AD_TO_TOOL_ID` map in tools.ts that this script parsed and compared against
 * the generated ActivityDefinitions. It could only check the map against
 * itself. The IG published no tool ids, so "AdministerSAFET is TL-006" was an
 * unverifiable claim, and the IG narrative could not name a tool at all. Task
 * C2 published them as `ActivityDefinition.identifier`; the map is deleted and
 * both the app and check F below derive the pairing from the artifact.
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
 *      - every TOOL_UI_METADATA key is a FHIR-backed Tool id
 *      - every FHIR-backed ActivityDefinition is referenced by a
 *        PlanDefinition action (otherwise the tool gets no stageId and is
 *        dropped at runtime)
 *      The two directions that used to compare the hand map against the
 *      generated ADs are now structural rather than checked: an id for a
 *      nonexistent AD cannot be expressed, and an AD with no id fails in F
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
 * *   F. tool ids (`TL-0NN`) are published and derived, not restated: every
 *      generated ActivityDefinition carries exactly ONE identifier in the
 *      system the NamingSystem declares, shaped TL-NNN; tools.ts reads that
 *      system rather than reinstating a hand map; and a tool id carried by
 *      several ActivityDefinitions is in an allowlist with a reason, because a
 *      legitimate multi-AD tool (the CAMS SSF-5) and a pasted-in duplicate id
 *      look identical, and the catalog merges the group either way
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
const catalogDir = join(root, 'packages/core/src/data/catalog')
const questionnairesDir = join(root, 'FHIR-Resources')

const STAGE_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'
const SDC_QUESTIONNAIRE_EXT =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire'
const LICENSING_EXT = 'http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status'

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

// The tool-id identifier SYSTEM is read from the NamingSystem that publishes it
// (ig/input/fsh/tool-id-identifier.fsh), never retyped here. If it were retyped,
// a change to the FSH system URL would leave this gate checking the old string:
// every AD would carry the new system, this check would report 43 ADs missing an
// identifier — or, worse, a matching pair of stale copies here and in tools.ts
// would pass while the app decatalogued every tool at runtime.
const nsPath = join(fhirDir, 'NamingSystem-SPiERToolIdNamingSystem.json')
if (!existsSync(nsPath)) {
  console.error(
    `✗ ${nsPath} not found — the NamingSystem that declares the tool-id identifier system ` +
      `is missing from the IG build. Check F reads the system URL from it, so it cannot run.`,
  )
  process.exit(1)
}
const TOOL_ID_SYSTEM = (JSON.parse(readFileSync(nsPath, 'utf8')).uniqueId ?? []).find(
  (u) => u.type === 'uri' && typeof u.value === 'string' && u.value.length > 0,
)?.value
if (!TOOL_ID_SYSTEM) {
  console.error(
    `✗ ${nsPath} declares no \`uri\` uniqueId — there is no system URL to check identifiers against.`,
  )
  process.exit(1)
}
console.log(`tool-id identifier system: ${TOOL_ID_SYSTEM}`)

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
      identifier: res.identifier ?? [],
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

// ---- F: AD → tool id, read off the published identifiers -------------------
// Until task C2 this pairing was a hand-written `AD_TO_TOOL_ID` map in tools.ts,
// which this script parsed and compared against the generated ActivityDefinitions.
// That could only ever check the map against itself: the IG published no tool ids
// at all, so "the map says AdministerSAFET is TL-006" was an unverifiable claim,
// and the IG narrative could not name a tool. The ids are now
// `ActivityDefinition.identifier` entries in TOOL_ID_SYSTEM, so the artifact
// states them and both the app and this gate derive them.
//
// tools.ts must be READING them, not restating them. These two shape assertions
// are what stop the derivation being quietly reverted: a reinstated hand map
// would satisfy every other check in this file while the identifiers sat unread.
if (!toolsSrc.includes(TOOL_ID_SYSTEM)) {
  fail(
    `tools.ts does not mention "${TOOL_ID_SYSTEM}" — the catalog is not deriving tool ids from ` +
      `the published identifiers. It must read them off ActivityDefinition.identifier; see ` +
      `ig/input/fsh/tool-id-identifier.fsh.`,
  )
}
if (/const\s+AD_TO_TOOL_ID\s*[:=]/.test(toolsSrc)) {
  fail(
    `tools.ts declares AD_TO_TOOL_ID again — the hand map was deleted in favour of the published ` +
      `identifiers, deliberately with no fallback. A fallback absorbs exactly the drift the ` +
      `identifier closes: the map would keep serving a stale pairing with nothing going red.`,
  )
}

const TOOL_ID_SHAPE = /^TL-\d{3}$/

const adToTool = []
for (const ad of activityDefs) {
  const values = ad.identifier
    .filter((i) => i.system === TOOL_ID_SYSTEM)
    .map((i) => i.value)
    .filter((v) => typeof v === 'string' && v.length > 0)
  if (values.length === 0) {
    fail(
      `ActivityDefinition ${ad.id}: no ${TOOL_ID_SYSTEM} identifier — the catalog would drop this ` +
        `tool with only a console.warn. Add \`* identifier[+].system\` / \`* identifier[=].value\` ` +
        `to its FSH instance.`,
    )
    continue
  }
  if (values.length > 1) {
    fail(
      `ActivityDefinition ${ad.id}: ${values.length} tool-id identifiers (${values.join(', ')}). ` +
        `An activity realises exactly one catalogued tool, and the catalog cannot choose between ` +
        `them — it drops the AD instead.`,
    )
    continue
  }
  const [toolId] = values
  if (!TOOL_ID_SHAPE.test(toolId)) {
    fail(
      `ActivityDefinition ${ad.id}: tool id "${toolId}" is not shaped TL-NNN. The app's UI metadata ` +
        `and the use-case workbook both key on that literal form.`,
    )
    continue
  }
  adToTool.push({ adId: ad.id, toolId })
}
if (adToTool.length === 0) {
  fail(
    `no ActivityDefinition carries a tool-id identifier — this check reads them off the generated ` +
      `resources, so an empty read makes every id-space assertion below vacuous`,
  )
}

// A tool id on SEVERAL ActivityDefinitions is legitimate and load-bearing — the
// CAMS SSF-5 is one catalogued tool whose four session forms are four ADs — but
// it is INDISTINGUISHABLE from a copy-paste that pasted one AD's identifier into
// an unrelated one. The catalog silently merges the group and lets whichever AD
// sorts first supply the name, purpose and licensing, so the second tool does not
// go missing loudly; it goes missing quietly, inside another tool. Hence an
// allowlist with reasons rather than a count.
const MULTI_AD_TOOLS = {
  'TL-020':
    'The CAMS SSF-5 is ONE catalogued tool per the SSC stage tiles. Its four session-form ' +
    'ActivityDefinitions (first-session Section A and Section B, the interim re-rating, and the ' +
    'outcome/disposition form) are phases of one instrument, collapsed at the Clarify Risk stage. ' +
    "tools.ts's CLINICAL_OVERRIDES supplies the combined name and purpose, since no single " +
    'session form describes the whole.',
}
const adsByToolId = new Map()
for (const { adId, toolId } of adToTool) {
  adsByToolId.set(toolId, [...(adsByToolId.get(toolId) ?? []), adId])
}
for (const [toolId, ads] of adsByToolId) {
  if (ads.length === 1) {
    if (MULTI_AD_TOOLS[toolId]) {
      fail(
        `tool ${toolId} is allowlisted as a multi-ActivityDefinition tool but only ` +
          `${ads[0]} carries its id now — delete the MULTI_AD_TOOLS entry, or restore the ` +
          `identifier the other ActivityDefinition(s) lost.`,
      )
    }
    continue
  }
  if (!MULTI_AD_TOOLS[toolId]) {
    fail(
      `tool id ${toolId} is carried by ${ads.length} ActivityDefinitions (${ads.join(', ')}) and is ` +
        `not in MULTI_AD_TOOLS. Either these really are phases of one catalogued tool — add an entry ` +
        `saying so, in web/scripts/check-catalog-integrity.mjs — or one of them was given the wrong ` +
        `id, in which case the catalog is silently showing one tool where there should be two: it ` +
        `merges the group and the first AD by sort order wins the name, purpose and licensing.`,
    )
  }
}
console.log(
  `✓ tool ids: ${adToTool.length} ActivityDefinition(s) carry exactly one, ` +
    `${adsByToolId.size} distinct tool id(s), ` +
    `${[...adsByToolId].filter(([, a]) => a.length > 1).length} declared multi-AD tool(s)`,
)

// ---- B: id-space integrity --------------------------------------------------
const fhirToolIds = new Set(adToTool.map((m) => m.toolId))

// The two directions this used to check between the generated ADs and the hand
// map are now structural: tool ids are read OFF the ActivityDefinitions, so an
// id for a nonexistent AD cannot be expressed, and an AD with no id fails in F
// above. What remains is the relation to the PlanDefinitions and to the UI layer.
for (const ad of activityDefs) {
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
const SPIER_CS_PREFIX = 'http://thespierproject.org/fhir/CodeSystem/'
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
const SPIER_VS_PREFIX = 'http://thespierproject.org/fhir/ValueSet/'
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
