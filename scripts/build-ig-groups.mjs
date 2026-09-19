#!/usr/bin/env node
/**
 * IG artifact groups — generate the `groups:` block of ig/sushi-config.yaml
 * from the FSH source tree, and gate that every published resource sits in
 * exactly one group.
 *
 *   node scripts/build-ig-groups.mjs            # rewrite the block between the markers
 *   node scripts/build-ig-groups.mjs --check    # gate, write nothing
 *
 * ─── Why the Artifacts page needs groups at all ─────────────────────────────
 *
 * Without `groups:` the IG Publisher renders `artifacts.html` by RESOURCE TYPE:
 * all 43 ActivityDefinitions in one block, all 56 CodeSystems in another, 300+
 * rows in 15 sections, sorted on the one axis nobody browses by. An implementer
 * looking for "everything about the ASQ" or "everything about handoffs" has to
 * know the type of each thing first. US Core, Gravity and mCODE all declare
 * `groups:` so the page reads by PURPOSE — that is what this produces, and the
 * IG cleanup audit (docs/plans/ig-cleanup-audit-2026-09-16.md §4) is where the
 * eight groups were chosen.
 *
 * ─── Why generated, not hand-kept ───────────────────────────────────────────
 *
 * SUSHI's `groups:` lists every member resource by `<Type>/<id>` — no
 * wildcards — so the block is ~300 lines that must change on every artifact
 * added. Hand-kept, that is the hand-duplicated-constant shape this repo keeps
 * catching (a new Instance lands, nobody adds it to a group, the publisher puts
 * it under a default heading, and nothing goes red). So membership is DERIVED
 * from where an artifact is defined: each FSH file, each ig/input/resources/questionnaires tool
 * folder and each FML map belongs to one group (RULES below), and the block is
 * regenerated from that. Adding an artifact to an existing file needs no edit
 * here; adding a new FSH file or tool folder needs one line in RULES, and
 * `--check` says so by name.
 *
 * ─── Two blocks, because SUSHI only knows what it loaded ────────────────────
 *
 * `groups.<id>.resources` may name only resources SUSHI itself put in the IG:
 * FSH definitions and the path-resource JSON. The five FML StructureMaps are
 * added by the IG PUBLISHER when it compiles input/resources/maps — SUSHI never
 * sees them, and listing one under a group is a SUSHI error ("configured with
 * nonexistent resource"). SUSHI's `resources:` block is the sanctioned way to
 * pre-declare such a resource with a `groupingId`, so the maps are emitted
 * there instead. Same generated block, two YAML keys.
 *
 * ─── What --check gates ─────────────────────────────────────────────────────
 *
 *   coverage  — every FSH definition, every resource JSON under a
 *               `path-resource` directory and every `.fml` map is assigned by a
 *               rule; an unassigned source fails, naming the file.
 *   currency  — the block between the markers equals what the rules generate
 *               now, byte for byte (same discipline as build-use-case-workbook).
 *   published — after SUSHI, every `definition.resource` in the compiled
 *               ImplementationGuide carries a `groupingId` that is one of the
 *               declared groups, and every group has at least one member. This
 *               half needs ig/fsh-generated/ and is what catches a resolver
 *               mistake here (a reference SUSHI spells differently than this
 *               script predicted lands in the IG with no group, and the
 *               publisher would file it under a default heading in silence).
 *
 * Reading nothing is an ERROR, not a pass (#232, #261): zero FSH files, zero
 * definitions, zero path-resource JSON, a missing marker pair, or an empty
 * fsh-generated/ all fail. Shapes are asserted, never counts.
 *
 * ─── What it cannot see ─────────────────────────────────────────────────────
 *
 * Whether a resource is in the RIGHT group. The rules are per source file, and a
 * file that mixes concerns puts everything it defines under one heading. Today
 * every FSH file is single-purpose; keep it that way, or split the file.
 *
 * Node 22 is the floor (`.github/.nvmrc`); Node builtins only, so this runs in
 * milliseconds and needs no install.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CONFIG, FSH_GENERATED, makeBail, readConfig, parsePathResource } from './lib/ig-config.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(here, '..')
const IG = resolve(ROOT, 'ig')
const FSH_DIR = resolve(IG, 'input/fsh')
const rel = (p) => relative(ROOT, p)

const bail = makeBail('build-ig-groups')
const check = process.argv.includes('--check')

// ─── The groups, in the order the Artifacts page shows them ─────────────────
//
// `id` becomes `ImplementationGuide.definition.grouping.id` and every member's
// `groupingId`; `name` is the section heading; `description` is the sentence
// under it. One sentence each: the page is a directory, not a guide page.
export const GROUPS = [
  {
    id: 'instruments',
    name: 'Screening and assessment instruments (Capture)',
    description:
      'Each validated instrument as SPiER publishes it: the Questionnaire itself, the ' +
      'ActivityDefinition that administers it, the profile its result lands in, the ' +
      'answer vocabularies, and one worked QuestionnaireResponse and Observation per form.',
  },
  {
    id: 'concept-layer',
    name: 'Suicide-risk concept layer (Translate)',
    description:
      'The instrument-agnostic risk tier every tool maps into — the concept Observation, ' +
      'its tier and domain vocabularies, and the ConceptMaps and StructureMaps that derive it.',
  },
  {
    id: 'safety-planning',
    name: 'Safety planning and means safety',
    description:
      'The Stanley-Brown and Crisis Response Plan CarePlans, their shared section vocabulary, ' +
      'lethal-means counseling and crisis-resource sharing.',
  },
  {
    id: 'handoffs-follow-up',
    name: 'Handoffs and follow-up',
    description:
      'Transitions of care and what happens after them: the handoff, the discharge safety ' +
      'packet, referral, follow-up appointment, sharing consent, outreach attempts and caring contacts.',
  },
  {
    id: 'risk-episode',
    name: 'Risk episode and registry',
    description:
      'The suicide-safer care episode, its encounters, risk flag, open safety tasks, the ' +
      'reassessment schedule, and the verified problem-list vocabulary for clinician-asserted findings.',
  },
  {
    id: 'pathway',
    name: 'The care pathway (Act)',
    description:
      'The eight stage PlanDefinitions and the Suicide Safer Care Pathway drawn from them, the ' +
      'placeholder steps, and the tool-id, licensing and coding-verification metadata every ' +
      'ActivityDefinition carries.',
  },
  {
    id: 'measures',
    name: 'Measures (Stage 8)',
    description:
      'The quality measures scored over the artifacts above, the CQL Library they share, ' +
      'example MeasureReports, and the reporting, export and sharing activities.',
  },
  {
    id: 'conformance',
    name: 'Conformance',
    description: 'The CapabilityStatement for each system role this guide defines.',
  },
]

// ─── Source → group ─────────────────────────────────────────────────────────
//
// Keys are basenames of `ig/input/fsh/*.fsh`, tool folders under the
// `path-resource` tree (`ig/input/resources/questionnaires/<tool>`), and `.fml` basenames under
// `input/resources/maps`. A source with no rule fails `--check` by name.
const RULES = {
  // instruments
  'asq.fsh': 'instruments',
  'bssa.fsh': 'instruments',
  'cams.fsh': 'instruments',
  'cssrs.fsh': 'instruments',
  'phq9.fsh': 'instruments',
  'pss3.fsh': 'instruments',
  'pss-full.fsh': 'instruments',
  'safet.fsh': 'instruments',
  'sbqr.fsh': 'instruments',
  'questionnaire-answer-codesystems.fsh': 'instruments',
  'ig/input/resources/questionnaires/ASQ': 'instruments',
  'ig/input/resources/questionnaires/BSSA': 'instruments',
  'ig/input/resources/questionnaires/C-SSRS': 'instruments',
  'ig/input/resources/questionnaires/CAMS': 'instruments',
  'ig/input/resources/questionnaires/PHQ-9': 'instruments',
  'ig/input/resources/questionnaires/PSS-3': 'instruments',
  'ig/input/resources/questionnaires/PSS-Full': 'instruments',
  'ig/input/resources/questionnaires/SAFE-T': 'instruments',
  'ig/input/resources/questionnaires/SBQ-R': 'instruments',
  // concept layer
  'concept-layer.fsh': 'concept-layer',
  'coding-verification.fsh': 'concept-layer',
  'crosswalk-asq.fsh': 'concept-layer',
  'crosswalk-bssa.fsh': 'concept-layer',
  'crosswalk-cams.fsh': 'concept-layer',
  'crosswalk-cssrs.fsh': 'concept-layer',
  'crosswalk-pss3.fsh': 'concept-layer',
  'crosswalk-tier-to-loinc.fsh': 'concept-layer',
  'ASQResultToSuicideRiskConcept.fml': 'concept-layer',
  'CSSRSRiskLevelToSuicideRiskConcept.fml': 'concept-layer',
  'PHQ9Item9ToSuicideRiskConcept.fml': 'concept-layer',
  'SBQRTotalScoreToSuicideRiskConcept.fml': 'concept-layer',
  // safety planning
  'stanley-brown.fsh': 'safety-planning',
  'crp.fsh': 'safety-planning',
  'safety-plan-section.fsh': 'safety-planning',
  'lethal-means.fsh': 'safety-planning',
  'crisis-resources.fsh': 'safety-planning',
  'ig/input/resources/questionnaires/Stanley-Brown': 'safety-planning',
  'ig/input/resources/questionnaires/CRP': 'safety-planning',
  'StanleyBrownQRToCarePlan.fml': 'safety-planning',
  // handoffs and follow-up
  'handoffs.fsh': 'handoffs-follow-up',
  'follow-up.fsh': 'handoffs-follow-up',
  // risk episode
  'risk-episode.fsh': 'risk-episode',
  'suicide-related-conditions.fsh': 'risk-episode',
  // pathway
  'pathway-stages.fsh': 'pathway',
  'suicide-safer-care-pathway.fsh': 'pathway',
  'pathway-tool-placeholders.fsh': 'pathway',
  'tool-id-identifier.fsh': 'pathway',
  'instrument-licensing.fsh': 'pathway',
  'spier-codesystem.fsh': 'pathway',
  // measures
  'measure-and-share.fsh': 'measures',
  // conformance
  'capabilitystatements.fsh': 'conformance',
}

// Order of resource types within a group — what a reader wants first.
const TYPE_ORDER = [
  'Questionnaire',
  'ActivityDefinition',
  'PlanDefinition',
  'Measure',
  'Library',
  'CapabilityStatement',
  'StructureDefinition',
  'ConceptMap',
  'StructureMap',
  'CodeSystem',
  'ValueSet',
  'NamingSystem',
]
const typeRank = (t) => {
  const i = TYPE_ORDER.indexOf(t)
  return i === -1 ? TYPE_ORDER.length : i
}

// Resource types the publisher (and SUSHI) treat as definitions rather than
// examples — the same set SUSHI's IGExporter uses for `exampleBoolean`.
const DEFINITIONAL = new Set([
    'ActivityDefinition', 'CapabilityStatement', 'ChargeItemDefinition', 'CodeSystem', 'CompartmentDefinition',
    'ConceptMap', 'EffectEvidenceSynthesis', 'EventDefinition', 'Evidence', 'EvidenceVariable', 'ExampleScenario',
    'GraphDefinition', 'ImplementationGuide', 'Library', 'Measure', 'MessageDefinition', 'NamingSystem',
    'OperationDefinition', 'PlanDefinition', 'Questionnaire', 'ResearchDefinition', 'ResearchElementDefinition',
    'RiskEvidenceSynthesis', 'SearchParameter', 'StructureDefinition', 'StructureMap', 'TerminologyCapabilities',
    'TestScript', 'ValueSet',
  ])

const BEGIN = '# ── BEGIN generated groups — node scripts/build-ig-groups.mjs; do not edit by hand ──'
const END = '# ── END generated groups ──'

// ─── 1. FSH: every definition, with the reference SUSHI will publish it under ─
//
// FSH is read directly rather than fsh-generated/ because the RULES are per
// source FILE and SUSHI's output does not record which file a resource came
// from. What has to be predicted here is exactly what SUSHI computes:
//   Profile / Extension  → StructureDefinition/<Id, else name>
//   ValueSet / CodeSystem → <Type>/<Id, else name>
//   Instance              → <resource type>/<`* id = "…"`, else name>, where the
//                           resource type is InstanceOf resolved through the
//                           local Parent chain to a base FHIR resource.
// The `published` half of --check is what confirms the prediction matched.

if (!existsSync(FSH_DIR)) bail(`${rel(FSH_DIR)} does not exist`)
const fshFiles = readdirSync(FSH_DIR).filter((f) => f.endsWith('.fsh')).sort()
if (fshFiles.length === 0) bail(`no .fsh files in ${rel(FSH_DIR)} — refusing to generate from nothing`)

const HEADER = /^(Profile|Extension|Logical|Resource|ValueSet|CodeSystem|Instance|Invariant|RuleSet|Mapping):\s*(\S+)\s*$/

/** @type {{file:string, kind:string, name:string, id?:string, instanceOf?:string, parent?:string, usage?:string, idOverride?:string}[]} */
const defs = []
for (const file of fshFiles) {
  const lines = readFileSync(join(FSH_DIR, file), 'utf8').split('\n')
  let cur = null
  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, '').trimEnd()
    const h = HEADER.exec(line)
    if (h) {
      cur = { file, kind: h[1], name: h[2] }
      if (!['Invariant', 'RuleSet', 'Mapping'].includes(cur.kind)) defs.push(cur)
      continue
    }
    if (!cur) continue
    let m
    if ((m = /^Id:\s*(\S+)\s*$/.exec(line))) cur.id = m[1]
    else if ((m = /^InstanceOf:\s*(\S+)\s*$/.exec(line))) cur.instanceOf = m[1]
    else if ((m = /^Parent:\s*(\S+)\s*$/.exec(line))) cur.parent = m[1]
    else if ((m = /^Usage:\s*#(\S+)\s*$/.exec(line))) cur.usage = m[1]
    else if ((m = /^\* id = "([^"]+)"\s*$/.exec(line))) cur.idOverride = m[1]
  }
}
if (defs.length === 0) bail(`parsed 0 definitions from ${fshFiles.length} FSH files — the header regex no longer matches SUSHI's syntax`)

// Profiles/Extensions by FSH name and by Id, for the Parent chain.
const sdByName = new Map()
for (const d of defs) {
  if (d.kind === 'Profile' || d.kind === 'Extension' || d.kind === 'Logical' || d.kind === 'Resource') {
    sdByName.set(d.name, d)
    if (d.id) sdByName.set(d.id, d)
  }
}

/** Resolve an InstanceOf / Parent to a base FHIR resource type. */
function baseType(ref, trail = []) {
  if (trail.includes(ref)) bail(`Parent chain loops: ${trail.join(' → ')} → ${ref}`)
  const sd = sdByName.get(ref)
  if (!sd) {
    // Not a local profile: must be a base resource type spelled as such.
    if (!/^[A-Z][A-Za-z]+$/.test(ref)) {
      bail(
        `cannot resolve "${ref}" (via ${trail.join(' → ') || 'InstanceOf'}) to a base resource type — ` +
          `it is neither a Profile/Extension in ig/input/fsh nor a bare FHIR resource name. If it is an ` +
          `external profile, teach this resolver its base type explicitly rather than guessing.`,
      )
    }
    return ref
  }
  if (sd.kind === 'Extension') return 'Extension'
  if (!sd.parent) bail(`${sd.file}: ${sd.kind} ${sd.name} has no Parent: line`)
  return baseType(sd.parent, [...trail, ref])
}

/** @type {Map<string, {ref:string, source:string, type:string, example:boolean, name:string}>} */
const members = new Map()
function addMember(ref, source, type, example, name) {
  if (members.has(ref)) {
    bail(`${ref} is defined twice (${members.get(ref).source} and ${source}) — SUSHI would reject it too`)
  }
  members.set(ref, { ref, source, type, example, name })
}

for (const d of defs) {
  const src = d.file
  switch (d.kind) {
    case 'Profile':
    case 'Extension':
    case 'Logical':
    case 'Resource':
      addMember(`StructureDefinition/${d.id ?? d.name}`, src, 'StructureDefinition', false, d.name)
      break
    case 'ValueSet':
    case 'CodeSystem':
      addMember(`${d.kind}/${d.id ?? d.name}`, src, d.kind, false, d.name)
      break
    case 'Instance': {
      if (!d.instanceOf) bail(`${src}: Instance ${d.name} has no InstanceOf: line`)
      const type = baseType(d.instanceOf)
      if (type === 'Extension') bail(`${src}: Instance ${d.name} is an instance of an Extension, which SUSHI does not publish as a resource`)
      const example = d.usage === 'example' || d.usage === 'inline'
      if (d.usage === 'inline') break // inline instances are not IG resources
      addMember(`${type}/${d.idOverride ?? d.name}`, src, type, example, d.name)
      break
    }
    default:
      bail(`${src}: unexpected definition kind ${d.kind}`)
  }
}

// ─── 2. path-resource: hand-authored JSON and FML the publisher loads ────────
//
// Read from the config's `path-resource` list through the shared parser rather
// than hardcoding ig/input/resources/questionnaires/, so a new directory is seen the day it is
// declared. A `/*` entry recurses, as SUSHI and the publisher do.

const configText = readConfig()
const pathDirs = parsePathResource(configText, bail)
if (pathDirs.length === 0) bail('no `path-resource` directories in sushi-config.yaml — the Questionnaires (#473) should be there')

function* walk(dir, recursive) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name)
    if (e.isDirectory() || (e.isSymbolicLink() && statSync(p).isDirectory())) {
      if (recursive) yield* walk(p, true)
    } else yield p
  }
}

/** Source key for a hand-authored file: `ig/input/resources/questionnaires/<tool>` or the .fml basename. */
function sourceKey(abs) {
  const real = rel(abs)
  if (real.endsWith('.fml')) return basename(real)
  // <root>/ig/input/resources/questionnaires -> symlink to ig/input/resources/questionnaires; resolve
  // the key to the tool folder the reader knows, via the path *inside* the tree.
  const parts = real.split('/')
  const qi = parts.indexOf('questionnaires')
  if (qi !== -1 && parts.length > qi + 2) return `ig/input/resources/questionnaires/${parts[qi + 1]}`
  const fi = parts.indexOf('ig/input/resources/questionnaires')
  if (fi !== -1 && parts.length > fi + 2) return `ig/input/resources/questionnaires/${parts[fi + 1]}`
  return real
}

let handAuthored = 0
for (const { dir, recursive } of pathDirs) {
  const abs = resolve(IG, dir)
  if (!existsSync(abs)) bail(`path-resource ${dir} → ${rel(abs)} does not exist`)
  for (const p of walk(abs, recursive)) {
    if (p.endsWith('.json')) {
      let res
      try {
        res = JSON.parse(readFileSync(p, 'utf8'))
      } catch {
        bail(`${rel(p)} is not readable JSON`)
      }
      if (typeof res?.resourceType !== 'string' || typeof res?.id !== 'string') {
        bail(`${rel(p)} has no resourceType/id — the publisher cannot name its page and this script cannot group it`)
      }
      // Conformance/knowledge resources are definitions; anything else the
      // publisher lists as an example — same test SUSHI applies.
      const example = !DEFINITIONAL.has(res.resourceType)
      addMember(`${res.resourceType}/${res.id}`, sourceKey(p), res.resourceType, example, res.title ?? res.name ?? res.id)
      handAuthored++
    } else if (p.endsWith('.fml')) {
      const m = /^map\s+"[^"]*\/StructureMap\/([^"/]+)"/m.exec(readFileSync(p, 'utf8'))
      if (!m) bail(`${rel(p)} has no \`map "…/StructureMap/<id>"\` header`)
      addMember(`StructureMap/${m[1]}`, sourceKey(p), 'StructureMap', false, m[1])
      handAuthored++
    }
  }
}
if (handAuthored === 0) bail('read 0 hand-authored resources from the path-resource directories — refusing to pass vacuously')

// ─── 3. Assign, and fail on any source with no rule ─────────────────────────

const unassigned = new Set()
const byGroup = new Map(GROUPS.map((g) => [g.id, []]))
for (const m of members.values()) {
  const g = RULES[m.source]
  if (!g) {
    unassigned.add(m.source)
    continue
  }
  if (!byGroup.has(g)) bail(`RULES maps ${m.source} to "${g}", which is not a GROUPS id`)
  byGroup.get(g).push(m)
}
for (const src of Object.keys(RULES)) {
  const known = [...members.values()].some((m) => m.source === src)
  if (!known) unassigned.add(`${src} (named in RULES but defines nothing — delete the rule or check the spelling)`)
}
if (unassigned.size) {
  console.error(`✗ build-ig-groups: ${unassigned.size} source(s) have no group:`)
  for (const s of [...unassigned].sort()) console.error(`    ${s}`)
  console.error('  Add each to RULES in scripts/build-ig-groups.mjs — every artifact must appear under one heading on artifacts.html.')
  process.exit(1)
}

// Within a group: definitions before examples, then by type, then by id.
for (const list of byGroup.values()) {
  list.sort((a, b) => {
    if (a.example !== b.example) return a.example ? 1 : -1
    const t = typeRank(a.type) - typeRank(b.type)
    if (t !== 0) return t
    return a.ref.localeCompare(b.ref)
  })
}

// ─── 4. Render the block ────────────────────────────────────────────────────

const yq = (s) => JSON.stringify(s) // YAML accepts JSON strings; keeps quotes/colons safe
const isPublisherLoaded = (m) => m.source.endsWith('.fml')
const out = [BEGIN]
out.push('groups:')
for (const g of GROUPS) {
  const list = byGroup.get(g.id).filter((m) => !isPublisherLoaded(m))
  if (list.length === 0) bail(`group "${g.id}" has no SUSHI-loaded members — delete it or fix RULES`)
  out.push(`  ${g.id}:`)
  out.push(`    name: ${yq(g.name)}`)
  out.push(`    description: ${yq(g.description)}`)
  out.push('    resources:')
  for (const m of list) out.push(`      - ${m.ref}`)
}
// Publisher-loaded resources (the FML StructureMaps): declared to SUSHI via
// `resources:` so they carry a groupingId — see the header.
const publisherLoaded = GROUPS.flatMap((g) => byGroup.get(g.id).filter(isPublisherLoaded).map((m) => ({ ...m, group: g.id })))
if (publisherLoaded.length) {
  out.push('resources:')
  for (const m of publisherLoaded) {
    out.push(`  ${m.ref}:`)
    out.push(`    name: ${yq(m.name)}`)
    out.push(`    groupingId: ${m.group}`)
  }
}
out.push(END)
const block = out.join('\n')

// ─── 5. Write or check ──────────────────────────────────────────────────────

const bi = configText.indexOf(BEGIN)
const ei = configText.indexOf(END)
if (bi === -1 || ei === -1 || ei < bi) {
  bail(
    `${rel(CONFIG)} has no marker pair. Add these two lines where the block should live (after parameters:, before pages:):\n` +
      `    ${BEGIN}\n    ${END}`,
  )
}
const current = configText.slice(bi, ei + END.length)

const total = [...byGroup.values()].reduce((n, l) => n + l.length, 0)
if (!check) {
  const next = configText.slice(0, bi) + block + configText.slice(ei + END.length)
  writeFileSync(CONFIG, next)
  console.log(`✓ build-ig-groups: wrote ${GROUPS.length} groups, ${total} resources to ${rel(CONFIG)}`)
  for (const g of GROUPS) console.log(`    ${g.id.padEnd(20)} ${String(byGroup.get(g.id).length).padStart(3)}`)
  process.exit(0)
}

const problems = []
if (current !== block) {
  problems.push(
    `${rel(CONFIG)}'s groups block is stale — run \`node scripts/build-ig-groups.mjs\` and commit the result`,
  )
}

// published — needs SUSHI's output.
if (!existsSync(FSH_GENERATED)) {
  bail(`${rel(FSH_GENERATED)} is missing — run SUSHI first; the published half of this gate cannot run without it`)
}
const igFile = readdirSync(FSH_GENERATED).find((f) => f.startsWith('ImplementationGuide-') && f.endsWith('.json'))
if (!igFile) bail(`no ImplementationGuide-*.json in ${rel(FSH_GENERATED)}`)
const ig = JSON.parse(readFileSync(join(FSH_GENERATED, igFile), 'utf8'))
const resources = ig?.definition?.resource ?? []
if (resources.length === 0) bail(`${igFile} lists 0 resources`)
const declared = new Set((ig.definition.grouping ?? []).map((g) => g.id))
if (declared.size === 0) problems.push(`${igFile} declares no grouping — SUSHI did not see a groups: block (is the marker pair inside sushi-config.yaml, and was SUSHI re-run?)`)
const seen = new Map([...declared].map((id) => [id, 0]))
for (const r of resources) {
  const ref = r.reference?.reference
  if (!r.groupingId) problems.push(`${ref} is published with no groupingId — it would render under a default heading`)
  else if (!declared.has(r.groupingId)) problems.push(`${ref} has groupingId "${r.groupingId}", which ${igFile} does not declare`)
  else seen.set(r.groupingId, seen.get(r.groupingId) + 1)
  if (ref && !members.has(ref)) problems.push(`${ref} is in the compiled IG but this script predicted no such resource — its FSH is spelled in a way the resolver here does not read`)
}
for (const [id, n] of seen) if (n === 0) problems.push(`group "${id}" is declared but has no published member`)
for (const ref of members.keys()) {
  if (!resources.some((r) => r.reference?.reference === ref)) {
    problems.push(`${ref} was predicted from source but is not in the compiled IG — the resolver's spelling differs from SUSHI's`)
  }
}

if (problems.length) {
  console.error(`✗ build-ig-groups --check: ${problems.length} problem(s)`)
  for (const p of problems) console.error(`    ${p}`)
  process.exit(1)
}
console.log(
  `✓ build-ig-groups: ${GROUPS.length} groups cover ${total} resources from ${fshFiles.length} FSH files and ` +
    `${handAuthored} hand-authored files; block current; all ${resources.length} published resources grouped.`,
)
