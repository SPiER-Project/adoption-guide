#!/usr/bin/env node
/**
 * The declared output of a tool is the resource the app writes for it.
 *
 * ─── Why this gate exists ───────────────────────────────────────────────────
 *
 * SPiER declares, in FHIR, both halves of what a tool does:
 *
 *   ActivityDefinition.relatedArtifact  → the Questionnaire it CONSUMES
 *   PlanDefinition.action.output        → the type + profile it PRODUCES
 *
 * `check:catalog` has resolved the consuming half both ways since 2026-08-20.
 * The producing half — 40 `output` entries across the stage PlanDefinitions, 39
 * of them naming a profile — was related to nothing at all, and three tools
 * were wrong as a direct result:
 *
 *   #211  TL-010 caring contacts emitted a Communication with no
 *         `meta.profile`, so `SPiERCaringContactAdherence` matched none of them
 *         and its opt-out exclusion could never fire.
 *   TL-009 the same defect on the suicide-safety handoff — and worse, because
 *         that profile is the INDEX EVENT for every post-transition measure
 *         (`measure-and-share.fsh` says so in those words). It failed QUIETLY
 *         rather than loudly: `transitionDates` also counts the TL-030 packet,
 *         which does claim its profile, so the measure family stayed computable
 *         for any patient who had one, and three demo scenarios carry a
 *         hand-authored handoff with the profile stamped on it. The dashboard
 *         looked healthy for months.
 *   TL-013 crisis resources, same shape; no measure reads it, so the cost was a
 *         conformance claim the guide made and the app broke.
 *
 * All three are fixed. ⚠️ **Fixing them does not stop the class recurring** —
 * that is this file. Nothing else in the repo can see a tool whose recorder
 * writes something other than what its own IG page says it produces.
 *
 * ─── Why `ActivityDefinition.kind` is NOT the thing checked ─────────────────
 *
 * R4 binds `kind` to `RequestResourceType` — the kind of *request* `$apply`
 * would mint — so it cannot name most outputs, and across the 43 ADs it
 * disagrees with the recorder by construction: TL-008 is `#ServiceRequest` and
 * writes Procedure + Observation, TL-030 is `#ServiceRequest` and writes
 * DocumentReference, TL-038 is `#Task` and writes EpisodeOfCare + Flag. R4 does
 * have the right slot — `ActivityDefinition.profile` — and it is unused on all
 * 43. `PlanDefinition.action.output` is where SPiER actually wrote it down.
 *
 * ─── The four rules ─────────────────────────────────────────────────────────
 *
 *  1. DECLARED — every tool the app can launch a recorder for declares at least
 *     one output profile. Its allowlist is EMPTY, which #500's lesson says is
 *     the only kind that cannot go stale. Its first run found TL-005 (BSSA):
 *     the action's own description named `SPiERBSSADispositionResult`, the
 *     comment above it called BSSA "fully FHIR-modelled", bssa.fsh had
 *     published the profile — and the `output` block was simply never written.
 *  2. CLAIMED — every declared output profile appears as `meta.profile` on a
 *     resource the app actually emits.
 *  3. TYPED — and on a resource of the declared `type`. Currently zero
 *     violations; it is here because `Condition/spier-cams-suicide-driver` is
 *     the one output whose type is not Observation, and an instrument mapper
 *     returning it as an Observation instead would satisfy rule 2 while
 *     producing something no consumer expects.
 *  4. The allowlist is built to EXPIRE — an entry naming a profile that is no
 *     longer declared, or one the app has started claiming, is a failure. An
 *     exemption that outlives its reason is how the next TL-009 gets waved
 *     through by a gate that was written to catch it.
 *
 * ─── What rule 2 reads, and why it is the emitted corpus ────────────────────
 *
 * `web/.runtime-fhir/` — what `runtimeFhir.emit.test.ts` produces by running
 * every production builder, and the same tree `validate-fhir.mjs --also` checks
 * against the profiles. That is deliberate: a BEHAVIOURAL answer, not a
 * lexical one.
 *
 * ⚠️ **A lexical scan would have passed the TL-009 defect.**
 * `spier-safety-handoff` appeared in `packages/core/src` the whole time it was
 * broken — in `measures.ts`, as the constant a filter READS. "The canonical
 * appears in the source" and "something writes it" are different questions, and
 * only the second one is the invariant. Reading the emitted resources cannot
 * confuse them.
 *
 * ⚠️ **The cost of that choice is real and is not a bug:** a profile absent
 * from the emitted tree may mean the builder does not stamp it OR that nothing
 * exercises the builder. Both are worth failing on, because a declared output
 * missing from that tree is a declared output the HL7 validator never checks.
 * The failure message distinguishes the two by whether the canonical appears in
 * the source at all, so the reader is told which one they have.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { reportFloors } from '../../scripts/lib/floors.mjs'
import { appRoot, appRootFloors } from './lib/app-roots.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..')
const genDir = join(root, 'packages/fhir-artifacts/generated')
const catalogDir = join(root, 'packages/core/src/data/catalog')
const runtimeDir = join(webRoot, '.runtime-fhir')
const TOOL_ID_SYSTEM_SUFFIX = '/tool-id'

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures += 1
}

const short = (canonical) => String(canonical).split('/').pop()

/**
 * Declared output profiles the app deliberately does not claim.
 *
 * ⚠️ **It is EMPTY, and keeping it that way is the point.** It held twelve
 * entries for about an hour on 2026-09-17 — every instrument Observation profile
 * plus the CAMS suicide-driver Condition — under one shared reason:
 * `observationMappers/shared.ts`'s `makeObservation` factory stamped no
 * `meta.profile` on anything, so ~80 of the Observations the app emits were
 * validated against base `Observation` while twelve published profiles asserted
 * constraints nothing verified. `validate-fhir.mjs` could not have flagged it:
 * an unclaimed profile degrades to a PASS (docs/internals/fhir-conformance.md).
 *
 * Writing the exemptions down is what made the size of the hole legible, and the
 * factory was threaded with a `profile` param the same day. Stamping them turned
 * the validator on over 28 more resources and it immediately found two real
 * defects in `camsSectionB` — an id containing `#`, and a `Condition.derivedFrom`
 * R4 does not define — on a code path that had shipped unvalidated for months.
 *
 * ⚠️ So: an entry here is a claim that a published profile describes something
 * the app does not produce. Before adding one, check that it is not simply a
 * builder that has not been asked to stamp it. Rule 4 below deletes an entry the
 * moment it stops being true.
 */
const UNCLAIMED = {}

// ─── Inputs ─────────────────────────────────────────────────────────────────

function readJsonDir(dir, prefix) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (!entry.startsWith(prefix) || !entry.endsWith('.json')) continue
    try {
      out.push(JSON.parse(readFileSync(join(dir, entry), 'utf8')))
    } catch {
      fail(`${entry}: not readable as JSON`)
    }
  }
  return out
}

if (!existsSync(genDir)) {
  fail(`${genDir} is missing — run \`npm run copy-fhir\` first`)
  process.exit(1)
}

const planDefinitions = readJsonDir(genDir, 'PlanDefinition-')
const activityDefs = readJsonDir(genDir, 'ActivityDefinition-')

/** ActivityDefinition canonical → the tool id(s) it publishes. */
const toolIdsByCanonical = new Map()
for (const ad of activityDefs) {
  if (!ad.url) continue
  const ids = (ad.identifier ?? [])
    .filter((i) => String(i.system ?? '').endsWith(TOOL_ID_SYSTEM_SUFFIX))
    .map((i) => i.value)
    .filter(Boolean)
  if (ids.length) toolIdsByCanonical.set(ad.url, ids)
}

/**
 * Every declared output, keyed by profile canonical.
 * `{ profile → { types:Set, tools:Set, actions:Set } }`
 */
const declared = new Map()
/** Tool id → true when any of its actions declares an output profile. */
const toolDeclaresOutput = new Map()
let actionsWithDefinition = 0
for (const pd of planDefinitions) {
  for (const action of pd.action ?? []) {
    const canonical = action.definitionCanonical
    if (!canonical) continue // a trigger/branch action, not a tool
    actionsWithDefinition++
    const tools = toolIdsByCanonical.get(canonical) ?? []
    if (tools.length === 0) {
      fail(
        `PlanDefinition ${pd.id} action "${action.id ?? '?'}": definitionCanonical "${canonical}" ` +
          `resolves to no ActivityDefinition carrying a tool id. check:catalog owns the id space; ` +
          `this gate cannot attribute the action's output without it.`,
      )
      continue
    }
    for (const output of action.output ?? []) {
      for (const profile of output.profile ?? []) {
        const entry = declared.get(profile) ?? { types: new Set(), tools: new Set(), actions: new Set() }
        entry.types.add(output.type)
        for (const t of tools) {
          entry.tools.add(t)
          toolDeclaresOutput.set(t, true)
        }
        entry.actions.add(`${pd.id}#${action.id ?? '?'}`)
        declared.set(profile, entry)
      }
    }
  }
}

// ─── Which tools the app can actually launch a recorder for ─────────────────
//
// ⚠️ The scope is NOT "every catalogued tool". A tool with no recorder writes
// nothing, so demanding an output declaration of it would be demanding a
// statement about a capability that does not exist — TL-026/028/029 are
// licensing or placeholder entries, TL-037 is a work queue, TL-043/044/045 are
// reporting surfaces. The property that means "this tool records" is that one
// of its launch paths lands on a `TOOL_VIEWS` slug, which is the same set
// `toolViews.test.ts` and `check:catalog` already pin.
// ⚠️ packages/tool-views, not web/src — the map became a package so that ONE
// definition serves every app's route table (see check:tool-view-routes).
const TOOL_VIEWS_TSX = join(root, 'packages/tool-views/src/data/toolViews.tsx')
const viewsSrc = readFileSync(TOOL_VIEWS_TSX, 'utf8')
const slugs = new Set([...viewsSrc.matchAll(/^ {2}'([a-z0-9-]+)':/gm)].map((m) => m[1]))
if (slugs.size === 0) {
  fail(
    'toolViews.tsx: parsed no slugs — this gate reads that map as text, so a changed shape ' +
      'makes rule 1 vacuous rather than red',
  )
}

const uiSrc = readFileSync(join(catalogDir, 'tool-ui-metadata.ts'), 'utf8')
/** Tool id → the recorder slugs it can launch. */
const recorderSlugs = new Map()
for (const [, toolId, block] of uiSrc.matchAll(/^\s*'(TL-\d+)':\s*\{([\s\S]*?)^\s*\},/gm)) {
  const actions = block.match(/launchActions:\s*\[([\s\S]*?)\]/)?.[1]
  if (!actions) continue
  for (const [obj] of actions.matchAll(/\{[^{}]*\}/g)) {
    const path = obj.match(/path:\s*'([^']*)'/)?.[1]
    if (path === undefined) continue
    // A launch path may carry a query string naming which AD the panel opened
    // for — `…/cams-section-a?tool=TL-020`. The slug is the last path segment.
    const slug = path.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop()
    if (!slugs.has(slug)) continue
    recorderSlugs.set(toolId, [...(recorderSlugs.get(toolId) ?? []), slug])
  }
}

// ─── What the app actually emits ────────────────────────────────────────────

if (!existsSync(runtimeDir)) {
  fail(
    `${runtimeDir} is missing. Rule 2 reads the resources the app's own builders produce, so ` +
      `without it this gate would check the declarations against nothing. Run ` +
      `\`npm run emit:runtime-fhir\` first (\`npm run verify\` does it as part of \`npm test\`).`,
  )
  process.exit(1)
}

// ⚠️ A STALE emitted tree is the false green this gate is most exposed to: the
// directory exists, the read succeeds, and every answer describes a build that
// no longer matches the builders. Compared against the newest builder source
// rather than trusted, for the same reason floors exist.
const emittedAt = statSync(runtimeDir).mtimeMs
let newestSource = 0
let newestSourcePath = ''
for (const dir of [join(root, 'packages/core/src/lib'), join(appRoot('web/src'), 'lib')]) {
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.ts')) {
        const m = statSync(p).mtimeMs
        if (m > newestSource) { newestSource = m; newestSourcePath = p.slice(root.length + 1) }
      }
    }
  }
  if (existsSync(dir)) walk(dir)
}
if (newestSource > emittedAt) {
  fail(
    `${runtimeDir.slice(root.length + 1)} is OLDER than ${newestSourcePath}, so it describes builders ` +
      `that have since changed. Re-run \`npm run emit:runtime-fhir\` — a gate reading a stale tree ` +
      `reports on a build nobody has.`,
  )
  process.exit(1)
}

/** Profile canonical → the resourceTypes the app emits claiming it. */
const claimed = new Map()
let emittedCount = 0
for (const entry of readdirSync(runtimeDir)) {
  if (!entry.endsWith('.json')) continue
  const resource = JSON.parse(readFileSync(join(runtimeDir, entry), 'utf8'))
  emittedCount++
  for (const profile of resource.meta?.profile ?? []) {
    const types = claimed.get(profile) ?? new Set()
    types.add(resource.resourceType)
    claimed.set(profile, types)
  }
}

/**
 * Does the canonical appear in the app's source at ALL? Only used to tell the
 * two shapes of a rule-2 failure apart — never to satisfy it, because that is
 * exactly the question a lexical gate gets wrong (see the header).
 */
const sourceText = (() => {
  let text = ''
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.name === 'node_modules') continue
      if (entry.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        text += readFileSync(p, 'utf8')
      }
    }
  }
  walk(join(root, 'packages/core/src'))
  walk(appRoot('web/src'))
  return text
})()

// ─── RULE 1 — every launchable recorder declares an output ──────────────────

// ⚠️ Failures counted for THIS section, so its summary cannot print a ✓ over a
// ✗ it just emitted — the first run of this gate did exactly that, and a green
// line above a red one is how a reader comes away believing the wrong half.
// Borrowed from check-catalog-integrity.mjs's launch-path section.
const rule1FailuresBefore = failures
let rule1Checked = 0
for (const [toolId, launchedSlugs] of [...recorderSlugs].sort()) {
  rule1Checked++
  if (toolDeclaresOutput.get(toolId)) continue
  fail(
    `${toolId} launches a recorder (${launchedSlugs.join(', ')}) but no PlanDefinition action for it ` +
      `declares an \`output\` profile. The app writes a resource for this tool and the IG does not say ` +
      `which — so nothing, here or anywhere, can check that the two agree. Add an \`output\` block with ` +
      `\`type\` and \`profile\` to its action in ig/input/fsh/pathway-stages.fsh.`,
  )
}
if (rule1Checked === 0) {
  fail(
    'tool-ui-metadata.ts: matched no tool whose launch path lands on a TOOL_VIEWS slug, so rule 1 ' +
      'verified nothing. Has the launchActions or TOOL_VIEWS shape changed?',
  )
}
if (failures === rule1FailuresBefore) {
  console.log(
    `✓ declared: ${rule1Checked} launchable recorder(s), each with an output profile on its PlanDefinition action`,
  )
}

// ─── RULES 2 + 3 — every declared profile is claimed, on the declared type ───

const rule23FailuresBefore = failures
let claimedOk = 0
for (const [profile, entry] of [...declared].sort()) {
  const id = short(profile)
  const tools = [...entry.tools].sort().join(', ')
  if (Object.prototype.hasOwnProperty.call(UNCLAIMED, id)) continue
  const types = claimed.get(profile)
  if (!types) {
    const namedInSource = sourceText.includes(profile)
    fail(
      `${tools}: declared output profile "${id}" is claimed by no resource the app emits. ` +
        (namedInSource
          ? `The canonical DOES appear in packages/core/src or web/src, so either the builder names it ` +
            `without stamping \`meta.profile\` (it may only be READ, which is how TL-009 stayed broken), ` +
            `or nothing runtimeFhir.emit.test.ts exercises produces one.`
          : `The canonical appears nowhere in packages/core/src or web/src, so nothing writes it at all — ` +
            `this is the TL-009 shape exactly.`) +
        ` Declared by ${[...entry.actions].sort().join(', ')}. Fix the builder, or add "${id}" to ` +
        `UNCLAIMED in this file with the reason.`,
    )
    continue
  }
  const typeMatch = [...entry.types].some((t) => types.has(t))
  if (!typeMatch) {
    fail(
      `${tools}: declared output profile "${id}" is declared on ${[...entry.types].sort().join('/')} ` +
        `but the app stamps it on ${[...types].sort().join('/')}. A consumer reading the IG expects the ` +
        `declared type; profile conformance alone does not catch this.`,
    )
    continue
  }
  claimedOk++
}
if (failures === rule23FailuresBefore) {
  console.log(
    `✓ claimed: ${claimedOk}/${declared.size} declared output profile(s) are stamped by the app on the ` +
      `declared resource type (${Object.keys(UNCLAIMED).length} deliberately unclaimed)`,
  )
}

// ─── RULE 4 — the allowlist expires ─────────────────────────────────────────

const declaredIds = new Set([...declared.keys()].map(short))
const claimedIds = new Set([...claimed.keys()].map(short))
for (const [id, reason] of Object.entries(UNCLAIMED)) {
  if (!reason || reason.length < 10) {
    fail(`UNCLAIMED["${id}"] carries no usable reason. An exemption without one is indistinguishable from an oversight.`)
  }
  if (!declaredIds.has(id)) {
    fail(
      `UNCLAIMED["${id}"] names a profile that no PlanDefinition action declares as an output any more. ` +
        `Delete the entry — an exemption for something that is not checked is a comment pretending to be a rule.`,
    )
  } else if (claimedIds.has(id)) {
    fail(
      `UNCLAIMED["${id}"] is now CLAIMED by an emitted resource. Delete the entry so the profile is ` +
        `checked from here on — an exemption that outlives its reason is how the next defect gets waved ` +
        `through by the gate written to catch it.`,
    )
  }
}

// ─── Liveness ───────────────────────────────────────────────────────────────
//
// Four independent sources, floored separately: each can collapse on its own,
// and a single total would let any one of them clear the bar alone.
reportFloors(
  [
    ...appRootFloors(),
    { source: 'fhir-artifacts/generated', dimension: 'PlanDefinition action(s) with a definitionCanonical', actual: actionsWithDefinition, floor: 20 },
    { source: 'fhir-artifacts/generated', dimension: 'declared output profile(s)', actual: declared.size, floor: 14 },
    { source: 'packages/tool-views/src/data/toolViews.tsx', dimension: 'recorder slug(s)', actual: slugs.size, floor: 14 },
    { source: 'web/.runtime-fhir', dimension: 'emitted resource(s)', actual: emittedCount, floor: 100 },
  ],
  fail,
)

if (failures) {
  console.error(`\noutput-profile check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\noutput-profile check passed.')
