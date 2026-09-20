#!/usr/bin/env node
/**
 * Every profile the IG publishes is one the app actually writes.
 *
 * ─── Why this gate exists, next to `check:outputs` ──────────────────────────
 *
 * `check-output-profiles.mjs` asks: does every **declared** output — a
 * `PlanDefinition.action.output` — get claimed by something the app emits? That
 * catches a tool whose recorder writes something other than its IG page says.
 *
 * It cannot catch a profile that no tool declares. The IG can publish a profile,
 * the app can never write one, and that gate has nothing to compare, because its
 * input is the set of declared outputs rather than the set of published
 * profiles. Both gates read the same emitted corpus; they start from opposite
 * ends of it.
 *
 * ⚠️ **That gap is not hypothetical — it is why this file exists.**
 * `spier-suicide-risk-concept` is published, is read by a Stage-8 measure
 * (`measures.ts`: `if (conformsTo(o, RISK_CONCEPT_PROFILE)) return true`), and is
 * claimed by **nothing the app emits**. The only resources carrying it anywhere
 * in this repo are two hand-authored entries in the demo scenarios — so the
 * measure computes a number off seeded fixtures and would report zero in a real
 * deployment. It is the TL-009 shape one layer up: published, measured, never
 * written, and invisible to every gate that starts from what a tool declares.
 *
 * ⚠️ It is also invisible to `validate-fhir.mjs`, for the reason
 * `docs/internals/fhir-conformance.md` gives: a validator checks a resource
 * against the profiles it CLAIMS, so a profile nothing claims is never the
 * subject of a check. Publishing more profiles cannot fail that gate.
 *
 * ─── The rules ──────────────────────────────────────────────────────────────
 *
 *  1. Every published profile (`kind: resource`, `derivation: constraint`) is
 *     claimed by at least one resource in the emitted corpus, or is named in
 *     `EXEMPT` with a reason.
 *  2. `EXEMPT` EXPIRES: an entry whose profile turns up in the corpus is a
 *     failure, so a fixed gap deletes its own exemption rather than leaving a
 *     stale claim that the app does not write something it now does. Same rule
 *     as `check:outputs`, and for the same reason.
 *  3. Floors on both inputs, so a scan that reads nothing fails instead of
 *     reporting that all zero profiles are emitted.
 *
 * ⚠️ **What this gate cannot see.** It checks that a profile is claimed *at
 * all*, not that every resource which ought to claim it does. Two builders can
 * emit the same shape while only one stamps it, and this passes — the C-SSRS
 * variants are four builders behind one profile, and it would notice nothing if
 * three of them stopped stamping. `check:outputs` has the same blind spot from
 * the other direction. Neither is a substitute for the validator.
 *
 * ⚠️ **Corpus freshness is NOT re-checked here.** `check:outputs` already
 * asserts `.runtime-fhir` is newer than the builders that produce it, runs in
 * the same `verify`, and fails the run before this gate would. A second copy of
 * that logic would drift from the first.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { reportFloors } from './lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const genDir = join(root, 'packages/fhir-artifacts/generated')
const runtimeDir = join(root, '.runtime-fhir')

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures += 1
}
const short = (canonical) => String(canonical).split('/').pop()

/**
 * Published profiles the app deliberately does not write.
 *
 * ⚠️ An entry is a claim that SPiER publishes a conformance statement it never
 * produces a resource for. That is occasionally correct and always worth
 * writing down. Before adding one, check it is not simply a builder that has
 * not been asked to stamp it — that was true of twelve profiles until
 * 2026-09-17, and the fix was one parameter.
 */
const EXEMPT = {
  'spier-suicide-related-condition':
    'Writeback ladder Tier 3, default OFF: SPiER PROPOSES a suicide-related problem-list '
    + 'entry through a CDS card (cdsHooks/problemListCard.ts) and a human asserts it. The '
    + 'corpus is generated with default config, so it contains none by construction. '
    + 'Deliberate — the assertion is the clinician\'s, not the app\'s.',

  'spier-suicide-risk-concept':
    '⚠️ A GAP, not a decision — recorded so it is legible rather than silent. Nothing in '
    + 'the app derives the harmonized cross-instrument risk concept, yet measures.ts reads '
    + 'it (RISK_CONCEPT_PROFILE) and the demo scenarios carry two hand-authored instances, '
    + 'so the Stage-8 measure computes off seeded data and would report zero in a real '
    + 'deployment. Deriving it is a modelling decision (which instruments, what tier '
    + 'mapping, whether a ConceptMap is needed) rather than a stamping fix — note that '
    + 'camsSectionA emits LOINC 93374-7 with both required categories but valueInteger, '
    + 'where this profile requires a coded tier from spier-suicide-risk-tier-vs, so it '
    + 'cannot simply be stamped onto what already exists.',
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

if (!existsSync(genDir)) {
  fail(`${genDir} is missing — run \`npm run copy-fhir\` first`)
  process.exit(1)
}
if (!existsSync(runtimeDir)) {
  fail(
    `${runtimeDir} is missing. This gate reads the resources the app's own builders produce; `
    + 'without it there is nothing to compare the published profiles against.',
  )
  process.exit(1)
}

/** Every profile the IG publishes: a constraint on a resource type. */
const published = []
for (const entry of readdirSync(genDir)) {
  if (!entry.startsWith('StructureDefinition-') || !entry.endsWith('.json')) continue
  let sd
  try {
    sd = JSON.parse(readFileSync(join(genDir, entry), 'utf8'))
  } catch {
    fail(`${entry}: not readable as JSON`)
    continue
  }
  // `kind: resource` excludes Extensions; `derivation: constraint` excludes the
  // base spec's own definitions, should any ever be copied in.
  if (sd.kind !== 'resource' || sd.derivation !== 'constraint' || !sd.url) continue
  published.push({ url: sd.url, type: sd.type })
}

/** Every profile canonical claimed by a resource the app emits. */
const claimed = new Map()
let emittedCount = 0
for (const entry of readdirSync(runtimeDir)) {
  if (!entry.endsWith('.json')) continue
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(runtimeDir, entry), 'utf8'))
  } catch {
    fail(`${entry}: not readable as JSON`)
    continue
  }
  for (const resource of Array.isArray(parsed) ? parsed : [parsed]) {
    if (!resource?.resourceType) continue
    emittedCount += 1
    for (const url of resource.meta?.profile ?? []) {
      if (!claimed.has(url)) claimed.set(url, new Set())
      claimed.get(url).add(resource.resourceType)
    }
  }
}

// ─── RULE 1 — a published profile is written, or exempted ───────────────────

for (const profile of published) {
  const id = short(profile.url)
  if (claimed.has(profile.url)) continue
  if (Object.prototype.hasOwnProperty.call(EXEMPT, id)) continue
  fail(
    `published profile "${id}" (${profile.type}) is claimed by nothing the app emits. `
    + 'The IG asserts constraints on a resource SPiER never writes, so no validator will '
    + 'ever check them and any measure reading the profile counts only hand-authored '
    + `fixtures. Stamp it on the builder that should produce it, or add "${id}" to EXEMPT `
    + 'in this file with the reason it is deliberate.',
  )
}

// ─── RULE 2 — an exemption expires the moment it stops being true ───────────

for (const [id, reason] of Object.entries(EXEMPT)) {
  const profile = published.find((p) => short(p.url) === id)
  if (!profile) {
    fail(
      `EXEMPT names "${id}", which the IG no longer publishes. Delete the entry — an `
      + 'exemption for a profile that does not exist hides nothing and outlives its reason.',
    )
    continue
  }
  if (claimed.has(profile.url)) {
    fail(
      `EXEMPT still names "${id}", but the app now emits ${[...claimed.get(profile.url)].join(', ')} `
      + 'claiming it. Delete the entry: it asserts SPiER does not write something it does. '
      + `(The reason recorded was: ${reason.slice(0, 80)}…)`,
    )
  }
}

// ─── Floors ─────────────────────────────────────────────────────────────────

console.log(
  `✓ published: ${published.length} profile(s), `
  + `${published.length - Object.keys(EXEMPT).length} emitted by the app, `
  + `${Object.keys(EXEMPT).length} exempt`,
)
for (const [id] of Object.entries(EXEMPT)) console.log(`    exempt: ${id}`)

reportFloors(
  [
    { source: 'fhir-artifacts/generated', dimension: 'published profile(s)', actual: published.length, floor: 16 },
    { source: '.runtime-fhir', dimension: 'emitted resource(s)', actual: emittedCount, floor: 100 },
    { source: '.runtime-fhir', dimension: 'distinct profile(s) claimed', actual: claimed.size, floor: 12 },
  ],
  fail,
)

if (failures > 0) {
  console.error(`\n✗ published-profile check failed with ${failures} problem(s).`)
  process.exit(1)
}
console.log('\npublished-profile check passed.')
