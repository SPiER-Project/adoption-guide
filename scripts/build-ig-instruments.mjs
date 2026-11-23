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
 *
 * ─── What --check gates ─────────────────────────────────────────────────────
 *
 *   coverage — every published Questionnaire has an activity, every activity a
 *              result profile, a worked response and a licensing status, and
 *              every profile and status it names is one the IG publishes.
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
 * reproduced here faithfully. It also says nothing about how a result reaches
 * the harmonized tier — a StructureMap names no source profile in a form this
 * can read — so the page sends readers to Conformance for that.
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
for (const { dir, recursive } of parsePathResource(readConfig(), bail)) {
  const abs = resolve(ROOT, 'ig', dir)
  if (!existsSync(abs)) bail(`path-resource directory ${rel(abs)} does not exist`)
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
const exampleResponses = []
let licensingDisplay = null
for (const name of readdirSync(FSH_GENERATED).sort()) {
  if (!name.endsWith('.json')) continue
  const doc = readJson(join(FSH_GENERATED, name))
  if (doc.resourceType === 'ActivityDefinition') activities.push(doc)
  else if (doc.resourceType === 'PlanDefinition') planDefinitions.push(doc)
  else if (doc.resourceType === 'StructureDefinition') profileTitle.set(doc.id, doc.title ?? doc.name)
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

// ─── 3. Join ────────────────────────────────────────────────────────────────

const problems = []
const cell = (text) => String(text).replace(/\|/g, '\\|')
const link = (text, page) => `[${cell(text)}](${page})`

/** @type {Map<string, string[]>} tool folder → table rows */
const rowsByTool = new Map()
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

  const row = [
    link(q.title, `Questionnaire-${q.id}.html`),
    mine.map((a) => link(a.title ?? a.name, `ActivityDefinition-${a.id}.html`)).join('<br/>'),
    [...profiles].sort().map((p) => link(profileTitle.get(p), `StructureDefinition-${p}.html`)).join('<br/>'),
    responses.map((r) => link('response', `QuestionnaireResponse-${r.id}.html`)).join('<br/>'),
    [...statuses].sort().map((s) => cell(licensingDisplay.get(s))).join('<br/>'),
  ]
  if (!rowsByTool.has(q.tool)) rowsByTool.set(q.tool, [])
  rowsByTool.get(q.tool).push(`| ${row.join(' | ')} |`)
}

// ─── 4. Render ──────────────────────────────────────────────────────────────

const slug = (tool) => tool.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const tools = [...rowsByTool.keys()].sort((a, b) => a.localeCompare(b))
const slugs = new Set(tools.map(slug))
if (slugs.size !== tools.length) bail(`two tool folders share an anchor: ${tools.join(', ')}`)

const out = [BEGIN, '']
out.push(tools.map((t) => `[${t}](#${slug(t)})`).join(' · '), '')
for (const tool of tools) {
  out.push(`### ${tool} {#${slug(tool)}}`, '')
  out.push('| Form | Activity | Result profile | Worked example | Licensing status |')
  out.push('|---|---|---|---|---|')
  out.push(...rowsByTool.get(tool), '')
}
out.push(END)
const block = out.join('\n')

// ─── 5. Write or check ──────────────────────────────────────────────────────

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
console.log(`✓ build-ig-instruments: ${summary}; every form has an activity, a result profile, a worked example and a licensing status; block current.`)
