#!/usr/bin/env node
/**
 * IG instrument directory — generate the per-instrument tables on
 * ig/input/pagecontent/instruments.md from the compiled IG, and gate that the
 * page is current.
 *
 *   node scripts/build-ig-instruments.mjs            # rewrite the block between the markers
 *   node scripts/build-ig-instruments.mjs --check    # gate, write nothing
 *
 * ─── Why the page exists ────────────────────────────────────────────────────
 *
 * The Artifacts page files every instrument's artifacts in one group of 130+
 * rows, sorted by resource type inside it, and the publisher gives a group no
 * stable anchor: the pages linked to it as `artifacts.html#1`, a position. An
 * implementer asking "what do I need for the ASQ" had to already know the name
 * of its Questionnaire, its ActivityDefinition and its result profile. This
 * page answers that question in one row per form, under a heading — and so an
 * anchor — per instrument.
 *
 * ─── Why generated, not hand-kept ───────────────────────────────────────────
 *
 * Every cell is already stated by an artifact, so a hand-kept table is a second
 * copy that rots on the next form added (the shape build-ig-groups.mjs exists
 * to prevent). The joins, all read from what SUSHI and the JSON tree publish:
 *
 *   instrument  = the tool folder a Questionnaire sits in, under a
 *                 `path-resource` directory
 *   activity    = every ActivityDefinition whose `relatedArtifact` names that
 *                 Questionnaire's canonical
 *   result      = the `output.profile` of every PlanDefinition action whose
 *                 `definitionCanonical` is one of those activities
 *   example     = every example QuestionnaireResponse answering that
 *                 Questionnaire
 *   licensing   = the activity's instrument-licensing-status code, shown by
 *                 the display its CodeSystem gives it
 *   into the tier = for each Observation result profile, one of:
 *                 "directly" — its value is bound to the tier's own value set;
 *                 a ConceptMap — one whose group.source is a code system of
 *                 the value set the profile binds, and whose target is the tier;
 *                 a StructureMap — an `.fml` whose `uses … as source` names
 *                 the profile.
 *                 Three maps name no SPiER source in a form this can read (two
 *                 `.fml` files declare a plain Observation, and the CAMS
 *                 ConceptMap's source is a code system no profile binds), so
 *                 MAP_SOURCE below says which profile each one reads.
 *
 * ─── What --check gates ─────────────────────────────────────────────────────
 *
 *   coverage — every published Questionnaire has an activity, every activity a
 *              result profile, a worked response and a licensing status, and
 *              every profile and status it names is one the IG publishes.
 *   routes   — every Observation result profile on the page has a route into
 *              the tier or a NO_ROUTE entry saying why not; every ConceptMap
 *              targeting the tier and every `.fml` map is attributed to a
 *              profile or listed in NOT_A_TIER_MAP; and no entry in those three
 *              tables has gone stale.
 *   currency — the block between the markers equals what the joins produce
 *              now, byte for byte.
 *
 * Reading nothing is an ERROR, not a pass (#232, #261): zero Questionnaires,
 * zero ActivityDefinitions, a missing marker pair or an absent fsh-generated/
 * all fail. The links the block emits are resolved a second time by
 * check-ig-narrative.mjs's check H, which reads this page like any other.
 *
 * ─── What it cannot see ─────────────────────────────────────────────────────
 *
 * Whether a join is the RIGHT one: an ActivityDefinition pointed at the wrong
 * Questionnaire, or a PlanDefinition action declaring the wrong output, is
 * reproduced here faithfully. A MAP_SOURCE entry is a hand statement and is
 * checked only for existence. Whether a crosswalk has clinical sign-off is
 * stated by no artifact, so that stays on the hand-kept harmonization table.
 *
 * Node builtins only.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join, basename, dirname } from 'node:path'

import { FSH_GENERATED, PAGECONTENT, ROOT, makeBail, readConfig, parsePathResource, rel } from './lib/ig-config.mjs'

const bail = makeBail('build-ig-instruments')
const check = process.argv.includes('--check')

const PAGE = resolve(PAGECONTENT, 'instruments.md')
const BEGIN = '<!-- BEGIN generated instrument directory: do not edit by hand -->'
const END = '<!-- END generated instrument directory -->'
const LICENSING_EXTENSION = 'http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status'
const LICENSING_SYSTEM_ID = 'spier-instrument-licensing-status'
const TIER_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier'
const SPIER_PROFILE = 'http://thespierproject.org/fhir/StructureDefinition/'

// Maps whose source profile cannot be read from the map itself. Key: the map's
// id. Value: the result profile it reads.
const MAP_SOURCE = {
  // `uses "…/StructureDefinition/Observation" … as source`: a plain Observation.
  PHQ9Item9ToSuicideRiskConcept: 'spier-phq9-item9',
  SBQRTotalScoreToSuicideRiskConcept: 'spier-sbqr-total-score',
  // Its source code system is the overall-risk rating scale, which the SSF
  // vital profile does not bind (one profile serves all six ratings).
  CAMSOverallRiskToRiskTier: 'spier-cams-ssf-vital',
}

// Observation result profiles with no route into the tier, and why.
const NO_ROUTE = {
  'spier-phq9-total-score': 'a depression-severity score; only item 9 maps',
  'spier-cams-outcome-disposition': 'a treatment disposition; no crosswalk is published for it',
}

// Maps that are not a route into the tier at all.
const NOT_A_TIER_MAP = {
  StanleyBrownQRToCarePlan: 'transforms a response into a CarePlan',
  SPiERRiskTierToLOINC: 'maps the tier outward, onto the LOINC answer list',
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    bail(`${rel(file)} is not readable JSON — ${e.message}`)
  }
}
const stripVersion = (canonical) => String(canonical).split('|')[0]
const tail = (canonical) => stripVersion(canonical).split('/').pop()

// ─── 1. The hand-authored Questionnaires, by tool folder ────────────────────

function* jsonUnder(dir, recursive) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (recursive) yield* jsonUnder(full, true)
    } else if (name.endsWith('.json')) yield full
  }
}

/** @type {{id:string, url:string, title:string, tool:string}[]} */
const questionnaires = []
/** @type {{id:string, source:string|null}[]} hand-authored FML maps */
const fmlMaps = []
function* fmlUnder(dir, recursive) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (recursive) yield* fmlUnder(full, true)
    } else if (name.endsWith('.fml')) yield full
  }
}
for (const { dir, recursive } of parsePathResource(readConfig(), bail)) {
  const abs = resolve(ROOT, 'ig', dir)
  if (!existsSync(abs)) bail(`path-resource directory ${rel(abs)} does not exist`)
  for (const file of fmlUnder(abs, recursive)) {
    const text = readFileSync(file, 'utf8')
    const map = /^map\s+"[^"]*\/StructureMap\/([^"]+)"/m.exec(text)
    if (!map) bail(`${rel(file)} has no \`map "…/StructureMap/<id>"\` line this can read`)
    const uses = /^uses\s+"([^"]+)"\s+alias\s+\S+\s+as\s+source/m.exec(text)
    if (!uses) bail(`${rel(file)} has no \`uses … as source\` line this can read`)
    fmlMaps.push({ id: map[1], source: uses[1].startsWith(SPIER_PROFILE) ? uses[1].slice(SPIER_PROFILE.length) : null })
  }
  for (const file of jsonUnder(abs, recursive)) {
    const doc = readJson(file)
    if (doc.resourceType !== 'Questionnaire') continue
    if (!doc.id || !doc.url || !doc.title) bail(`${rel(file)} is a Questionnaire with no id, url or title`)
    questionnaires.push({ id: doc.id, url: doc.url, title: doc.title, tool: basename(dirname(file)) })
  }
}
if (questionnaires.length === 0) bail('found 0 Questionnaires under the path-resource directories — refusing to generate from nothing')

// ─── 2. The compiled IG ─────────────────────────────────────────────────────

if (!existsSync(FSH_GENERATED)) bail(`${rel(FSH_GENERATED)} is missing — run SUSHI first; every join here reads its output`)

const activities = []
const planDefinitions = []
const profileTitle = new Map()
/** profile id → { type, valueSet } */
const profileShape = new Map()
/** value set url → the code systems it draws from */
const valueSetSystems = new Map()
const conceptMaps = []
const exampleResponses = []
let licensingDisplay = null
for (const name of readdirSync(FSH_GENERATED).sort()) {
  if (!name.endsWith('.json')) continue
  const doc = readJson(join(FSH_GENERATED, name))
  if (doc.resourceType === 'ActivityDefinition') activities.push(doc)
  else if (doc.resourceType === 'PlanDefinition') planDefinitions.push(doc)
  else if (doc.resourceType === 'StructureDefinition') {
    profileTitle.set(doc.id, doc.title ?? doc.name)
    const value = (doc.snapshot?.element ?? doc.differential?.element ?? []).find((e) => e.id === `${doc.type}.value[x]`)
    profileShape.set(doc.id, { type: doc.type, valueSet: value?.binding?.valueSet ? stripVersion(value.binding.valueSet) : null })
  } else if (doc.resourceType === 'ValueSet') {
    valueSetSystems.set(doc.url, new Set((doc.compose?.include ?? []).map((i) => i.system).filter(Boolean)))
  } else if (doc.resourceType === 'ConceptMap') conceptMaps.push(doc)
  else if (doc.resourceType === 'QuestionnaireResponse') exampleResponses.push(doc)
  else if (doc.resourceType === 'CodeSystem' && doc.id === LICENSING_SYSTEM_ID) {
    licensingDisplay = new Map((doc.concept ?? []).map((c) => [c.code, c.display]))
  }
}
if (activities.length === 0) bail(`read 0 ActivityDefinitions from ${rel(FSH_GENERATED)}`)
if (planDefinitions.length === 0) bail(`read 0 PlanDefinitions from ${rel(FSH_GENERATED)}`)
if (profileTitle.size === 0) bail(`read 0 StructureDefinitions from ${rel(FSH_GENERATED)}`)
if (!licensingDisplay || licensingDisplay.size === 0) bail(`CodeSystem ${LICENSING_SYSTEM_ID} is absent or has no concepts`)

/** activity id → the profile ids its PlanDefinition actions declare as output. */
const outputs = new Map()
const walkActions = (actions) => {
  for (const action of actions ?? []) {
    const activity = action.definitionCanonical ? tail(action.definitionCanonical) : null
    for (const output of action.output ?? []) {
      for (const profile of output.profile ?? []) {
        if (!activity) continue
        if (!outputs.has(activity)) outputs.set(activity, new Set())
        outputs.get(activity).add(tail(profile))
      }
    }
    walkActions(action.action)
  }
}
for (const plan of planDefinitions) walkActions(plan.action)
if (outputs.size === 0) bail('no PlanDefinition action declares an output profile — the join to result profiles reads nothing')

// ─── 3. Routes into the tier ────────────────────────────────────────────────

const problems = []

/** profile id → links to the maps that carry it into the tier */
const mapsFor = new Map()
const addRoute = (profile, label, page) => {
  if (!mapsFor.has(profile)) mapsFor.set(profile, [])
  mapsFor.get(profile).push(`[${label}](${page})`)
}
const usedMapSource = new Set()
const usedNotATierMap = new Set()

for (const cm of conceptMaps) {
  const groups = cm.group ?? []
  if (!groups.some((g) => g.target === TIER_SYSTEM)) {
    if (cm.id in NOT_A_TIER_MAP) usedNotATierMap.add(cm.id)
    else problems.push(`ConceptMap/${cm.id} does not target the tier and is not in NOT_A_TIER_MAP`)
    continue
  }
  const sources = new Set(groups.filter((g) => g.target === TIER_SYSTEM).map((g) => g.source))
  const derived = [...profileShape].filter(([, shape]) => {
    const systems = shape.valueSet && valueSetSystems.get(shape.valueSet)
    return systems && [...systems].some((s) => sources.has(s))
  })
  if (derived.length && cm.id in MAP_SOURCE) problems.push(`MAP_SOURCE names ConceptMap/${cm.id}, but its source is now derivable — delete the entry`)
  const readers = derived.length ? derived.map(([id]) => id) : cm.id in MAP_SOURCE ? [MAP_SOURCE[cm.id]] : []
  if (!derived.length && cm.id in MAP_SOURCE) usedMapSource.add(cm.id)
  if (readers.length === 0) problems.push(`ConceptMap/${cm.id} targets the tier, but no result profile binds its source code system and MAP_SOURCE does not name one`)
  for (const profile of readers) addRoute(profile, 'ConceptMap', `ConceptMap-${cm.id}.html`)
}

for (const map of fmlMaps) {
  if (map.id in NOT_A_TIER_MAP) {
    usedNotATierMap.add(map.id)
    continue
  }
  if (map.source && map.id in MAP_SOURCE) problems.push(`MAP_SOURCE names StructureMap/${map.id}, but the map now names its source profile — delete the entry`)
  const profile = map.source ?? MAP_SOURCE[map.id]
  if (!map.source && map.id in MAP_SOURCE) usedMapSource.add(map.id)
  if (!profile) {
    problems.push(`StructureMap/${map.id} names no SPiER source profile and is in neither MAP_SOURCE nor NOT_A_TIER_MAP`)
    continue
  }
  addRoute(profile, 'StructureMap', `StructureMap-${map.id}.html`)
}

for (const [id, profile] of Object.entries(MAP_SOURCE)) {
  if (!profileTitle.has(profile)) problems.push(`MAP_SOURCE.${id} names profile "${profile}", which the IG does not publish`)
  if (!usedMapSource.has(id)) problems.push(`MAP_SOURCE.${id} matches no published map — delete the entry`)
}
for (const id of Object.keys(NOT_A_TIER_MAP)) {
  if (!usedNotATierMap.has(id)) problems.push(`NOT_A_TIER_MAP.${id} matches no published map — delete the entry`)
}

const usedNoRoute = new Set()
/** The route cell for one result profile, or null when it has none to show. */
function routeFor(profile) {
  const shape = profileShape.get(profile)
  if (!shape || shape.type !== 'Observation') return null // a CarePlan or Condition is not a risk result
  const direct = shape.valueSet && valueSetSystems.get(shape.valueSet)?.has(TIER_SYSTEM)
  const maps = mapsFor.get(profile) ?? []
  if (profile in NO_ROUTE) {
    usedNoRoute.add(profile)
    if (direct || maps.length) problems.push(`NO_ROUTE names "${profile}", but it has a route into the tier — delete the entry`)
    return null
  }
  if (direct) return maps.length ? `directly, and ${maps.join(' · ')}` : 'directly'
  if (maps.length === 0) {
    problems.push(`result profile "${profile}" has no route into the tier — publish a crosswalk, or add it to NO_ROUTE with the reason`)
    return null
  }
  return maps.join(' · ')
}
const shortTitle = (profile) => profileTitle.get(profile).replace(/^SPiER /, '').replace(/ Observation$/, '')

// ─── 4. Join ────────────────────────────────────────────────────────────────

const cell = (text) => String(text).replace(/\|/g, '\\|')
const link = (text, page) => `[${cell(text)}](${page})`

/** @type {Map<string, string[]>} tool folder → table rows */
const rowsByTool = new Map()
/** @type {Map<string, Set<string>>} tool folder → the licensing statuses of its activities */
const statusesByTool = new Map()
for (const q of [...questionnaires].sort((a, b) => a.title.localeCompare(b.title))) {
  const mine = activities.filter((a) => (a.relatedArtifact ?? []).some((r) => r.resource && stripVersion(r.resource) === q.url))
  if (mine.length === 0) {
    problems.push(`Questionnaire/${q.id} is named by no ActivityDefinition.relatedArtifact — nothing says how it is administered`)
    continue
  }
  const profiles = new Set()
  const statuses = new Set()
  for (const activity of mine) {
    const declared = outputs.get(activity.id)
    if (!declared) problems.push(`ActivityDefinition/${activity.id} is the definition of no PlanDefinition action with an output profile`)
    for (const p of declared ?? []) {
      if (profileTitle.has(p)) profiles.add(p)
      else problems.push(`ActivityDefinition/${activity.id} outputs profile "${p}", which the IG does not publish`)
    }
    const status = (activity.extension ?? []).find((e) => e.url === LICENSING_EXTENSION)?.valueCode
    if (!status) problems.push(`ActivityDefinition/${activity.id} carries no licensing status`)
    else if (!licensingDisplay.has(status)) problems.push(`ActivityDefinition/${activity.id} has licensing status "${status}", which ${LICENSING_SYSTEM_ID} does not define`)
    else statuses.add(status)
  }
  const responses = exampleResponses.filter((r) => r.questionnaire && stripVersion(r.questionnaire) === q.url)
  if (responses.length === 0) problems.push(`Questionnaire/${q.id} has no example QuestionnaireResponse`)

  const sorted = [...profiles].sort()
  const routes = sorted.map((p) => [p, routeFor(p)]).filter(([, route]) => route)
  const tierCell =
    routes.length === 0 ? '—' : sorted.length === 1 ? routes[0][1] : routes.map(([p, route]) => `${cell(shortTitle(p))}: ${route}`).join('<br/>')

  const row = [
    link(q.title, `Questionnaire-${q.id}.html`),
    mine.map((a) => link(a.title ?? a.name, `ActivityDefinition-${a.id}.html`)).join('<br/>'),
    sorted.map((p) => link(profileTitle.get(p), `StructureDefinition-${p}.html`)).join('<br/>'),
    tierCell,
    responses.map((r) => link('response', `QuestionnaireResponse-${r.id}.html`)).join('<br/>'),
  ]
  if (!rowsByTool.has(q.tool)) rowsByTool.set(q.tool, [])
  rowsByTool.get(q.tool).push(`| ${row.join(' | ')} |`)
  if (!statusesByTool.has(q.tool)) statusesByTool.set(q.tool, new Set())
  for (const s of statuses) statusesByTool.get(q.tool).add(s)
}
for (const profile of Object.keys(NO_ROUTE)) {
  if (!usedNoRoute.has(profile)) problems.push(`NO_ROUTE."${profile}" is the result of no form on the page — delete the entry`)
}

// ─── 5. Render ──────────────────────────────────────────────────────────────

const slug = (tool) => tool.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const tools = [...rowsByTool.keys()].sort((a, b) => a.localeCompare(b))
const slugs = new Set(tools.map(slug))
if (slugs.size !== tools.length) bail(`two tool folders share an anchor: ${tools.join(', ')}`)

// No jump list: the template already renders a contents box from the headings.
const out = [BEGIN, '']
for (const tool of tools) {
  out.push(`### ${tool} {#${slug(tool)}}`, '')
  const statuses = [...(statusesByTool.get(tool) ?? [])].sort().map((s) => licensingDisplay.get(s))
  out.push(`Licensing status: ${statuses.join('; ')}.`, '')
  out.push('| Form | Activity | Result profile | Into the tier | Worked example |')
  out.push('|---|---|---|---|---|')
  out.push(...rowsByTool.get(tool), '')
}
out.push(END)
const block = out.join('\n')

// ─── 6. Write or check ──────────────────────────────────────────────────────

if (!existsSync(PAGE)) bail(`${rel(PAGE)} does not exist — the generated block has nowhere to live`)
const pageText = readFileSync(PAGE, 'utf8')
const bi = pageText.indexOf(BEGIN)
const ei = pageText.indexOf(END)
if (bi === -1 || ei === -1 || ei < bi) {
  bail(`${rel(PAGE)} has no marker pair. Add these two lines where the tables should appear:\n    ${BEGIN}\n    ${END}`)
}

const summary = `${tools.length} instruments, ${questionnaires.length} forms, from ${activities.length} ActivityDefinitions and ${planDefinitions.length} PlanDefinitions`

if (!check) {
  if (problems.length) {
    console.error(`✗ build-ig-instruments: ${problems.length} problem(s) — nothing written`)
    for (const p of problems) console.error(`    ${p}`)
    process.exit(1)
  }
  writeFileSync(PAGE, pageText.slice(0, bi) + block + pageText.slice(ei + END.length))
  console.log(`✓ build-ig-instruments: wrote ${summary} to ${rel(PAGE)}`)
  process.exit(0)
}

if (pageText.slice(bi, ei + END.length) !== block) {
  problems.push(`${rel(PAGE)}'s instrument directory is stale — run \`node scripts/build-ig-instruments.mjs\` and commit the result`)
}
if (problems.length) {
  console.error(`✗ build-ig-instruments --check: ${problems.length} problem(s)`)
  for (const p of problems) console.error(`    ${p}`)
  process.exit(1)
}
console.log(`✓ build-ig-instruments: ${summary}; every form has an activity, a result profile, a worked example and a licensing status; every result has a route into the tier or a stated reason; block current.`)
