#!/usr/bin/env node
/**
 * Drift guard for the Suicide Safer Care Pathway PlanDefinition.
 *
 * `PlanDefinition-SPiERSuicideSaferCarePathway` (ig/input/fsh/suicide-safer-care-pathway.fsh,
 * Phase 2 of docs/plans/suicide-safer-care-pathway.md) is a published clinical
 * protocol assembled almost entirely out of references to OTHER artifacts —
 * stage codes, tier codes, ActivityDefinition and PlanDefinition canonicals.
 * Every one of those is a hand-typed string that SUSHI is happy to compile and
 * the HL7 validator is happy to pass: a `definitionCanonical` naming an artifact
 * that does not exist is not a conformance error, and a tier code that is not in
 * the CodeSystem is only a binding error where a binding is declared, which on
 * `PlanDefinition.action.code` it is not.
 *
 * So the four things that make this artifact mean anything are exactly the four
 * things nothing else checks.
 *
 *   (a) TIER CODES resolve to the generated `spier-suicide-risk-tier` CodeSystem.
 *       A branch gated on a tier that does not exist applies to nobody.
 *   (b) DEFINITION CANONICALS resolve to an artifact in
 *       packages/fhir-artifacts/generated/. This is `check:catalog`'s B/C lesson
 *       one layer up: check C stops a Questionnaire no ActivityDefinition
 *       administers; this stops a pathway step pointing at nothing. And the
 *       artifact must be a TYPE an engine can apply (ActivityDefinition,
 *       PlanDefinition or Questionnaire, per R4) — a CodeSystem's canonical
 *       resolved, and passed, until 2026-10-06.
 *   (c) NO TIMING ANYWHERE. The reassessment cadence has exactly one home
 *       (PlanDefinition/SPiERReassessmentSchedule) and is already stated three
 *       times — that PlanDefinition, packages/core/src/lib/reassessment.ts, and
 *       the CQL's ReassessmentIntervalDays — with `check:reassessment` holding
 *       the three in agreement. A fourth statement, in a document nothing
 *       compares against, is the defect the reference-don't-restate design
 *       exists to prevent. This rule is what makes it mechanical rather than a
 *       request in a comment. It covers every `timing[x]`, not just
 *       `timingDuration`: a `timingTiming` with a period would restate the
 *       cadence just as effectively.
 *   (d) STAGE CODES are in the canonical stage list, read from the same source
 *       `check:stages` reads (ig/input/fsh/spier-codesystem.fsh, via the shared
 *       lib/stage-codes.mjs — not a copy of the list, and cross-checked there
 *       against the compiled CodeSystem).
 *   (f) TIER CONDITIONS agree with their branch: each tier branch's FHIRPath
 *       applicability condition tests `.code = '<its own tier>'` against the
 *       tier system, and every `extension('…')` a condition reads is a
 *       StructureDefinition SPiER publishes. The condition is what an engine
 *       executes; SPiER selects branches by `action.code`, so the two can
 *       disagree with every test green. Since 2026-10-07 both are written
 *       from one parameter by `RuleSet: TierBranch` (concept-layer.fsh), so a
 *       branch built with it cannot disagree; this rule still reads the
 *       compiled JSON, so a branch written WITHOUT the RuleSet is still caught.
 *
 * (e) READING NOTHING IS AN ERROR. A missing generated file, zero parsed
 * actions, zero tier codes, zero stage codes or an empty canonical index all
 * exit non-zero rather than passing vacuously. That is the #232 / #261 family,
 * and each of (a)–(d) was proved able to fail by planting a defect before this
 * gate was trusted.
 *
 * Run from the repo root as `npm run check:pathway`. Reads generated FHIR, so
 * `copy-fhir` must have run first (verify does that).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readStageCodes, STAGE_SYSTEM } from './lib/stage-codes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fhirDir = resolve(here, '../packages/fhir-artifacts/generated')

const PATHWAY = resolve(fhirDir, 'PlanDefinition-SPiERSuicideSaferCarePathway.json')
const TIER_CS = resolve(fhirDir, 'CodeSystem-spier-suicide-risk-tier.json')

const TIER_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier'

/** What PlanDefinition.action.definition[x] may point at, per FHIR R4. */
const DEFINITION_TYPES = new Set(['ActivityDefinition', 'PlanDefinition', 'Questionnaire'])

/**
 * Tiers the branch must NOT carry, and why — the same shape (and two of the
 * same reasons) as check-reassessment.mjs's MUST_HAVE_NO_INTERVAL. Encoded
 * rather than left in a comment: each of these would answer an open clinical
 * question by arriving as a silent diff.
 */
const MUST_NOT_BRANCH = {
  imminent:
    'imminent risk is active escalation, not a routine protocol; whether it stays on this pathway at all is an open question with the diagram author (docs/plans/suicide-safer-care-pathway.md, question 4)',
  'no-risk':
    'a no-risk patient does not enter the suicide-safer care pathway — the diagram\'s own negative-assessment branch says so',
}

const errors = []
const fail = (m) => errors.push(m)

/** A read that finds nothing must stop the run, never degrade to a pass. */
const bail = (m) => {
  console.error(`✗ pathway: ${m}`)
  process.exit(1)
}

/* ─── Inputs, each of which must actually be there ──────────── */

if (!existsSync(PATHWAY)) {
  bail(
    `${PATHWAY} is missing. Run \`npm run copy-fhir\` first ` +
      '(SUSHI must have compiled suicide-safer-care-pathway.fsh).',
  )
}
if (!existsSync(TIER_CS)) bail(`${TIER_CS} is missing. Run \`npm run copy-fhir\` first.`)

const plan = JSON.parse(readFileSync(PATHWAY, 'utf8'))
const tierCs = JSON.parse(readFileSync(TIER_CS, 'utf8'))

const knownTiers = new Set((tierCs.concept ?? []).map((c) => c.code))
if (knownTiers.size === 0) bail(`${TIER_CS} declares no concepts — every tier code would pass unchecked`)

let stageCodes
try {
  stageCodes = readStageCodes()
} catch (e) {
  bail(e.message)
}

/**
 * Every canonical URL the generated artifact set publishes. Built by walking the
 * directory rather than by guessing filenames from the URL, because the two do
 * not correspond: `ActivityDefinition/AdministerPHQ9` is
 * `ActivityDefinition-AdministerPHQ9.json` but a profile's URL ends in its `id`,
 * not its name. An empty index is a startup failure — the same property
 * `assertUsableIndex` enforces in packages/core/fhir-resource-rules.mjs, and for
 * the same reason: an empty index green-lights everything it never read.
 */
const canonicals = new Map() // canonical URL -> resourceType
for (const file of readdirSync(fhirDir).filter((f) => f.endsWith('.json'))) {
  let doc
  try {
    doc = JSON.parse(readFileSync(resolve(fhirDir, file), 'utf8'))
  } catch {
    continue // not every .json in here is a FHIR resource
  }
  if (typeof doc?.url === 'string') canonicals.set(doc.url, doc.resourceType)
}
if (canonicals.size === 0) {
  bail(
    `no canonical URLs indexed from ${fhirDir} — every definitionCanonical would report as dangling ` +
      'or, worse, as fine. Run `npm run copy-fhir -- --force`.',
  )
}

/* ─── Walk every action, at every depth ─────────────────────── */

/** @type {{ action: any, path: string }[]} */
const flat = []
const walk = (actions, prefix) => {
  actions.forEach((action, i) => {
    const path = `${prefix}[${action.id ?? i}]`
    flat.push({ action, path })
    if (Array.isArray(action.action)) walk(action.action, `${path}.action`)
  })
}
if (!Array.isArray(plan.action) || plan.action.length === 0) {
  bail('the pathway has no actions at all — there is no protocol to check')
}
walk(plan.action, 'action')

if (flat.length === 0) bail('walked the pathway and found zero actions — refusing to pass vacuously')

let tierCodeCount = 0
let tierConditionCount = 0
let conditionExtensionCount = 0
let stageCodeCount = 0
let canonicalCount = 0
const branchedTiers = new Map()

for (const { action, path } of flat) {
  const codings = (action.code ?? []).flatMap((c) => c.coding ?? [])

  // (a) Tier codes resolve, and the tiers left out stay out.
  for (const coding of codings.filter((c) => c.system === TIER_SYSTEM)) {
    tierCodeCount++
    if (!knownTiers.has(coding.code)) {
      fail(
        `${path}: action.code names risk tier "${coding.code}", which is not in the ` +
          `spier-suicide-risk-tier CodeSystem (${[...knownTiers].join(', ')}). ` +
          'A branch gated on a tier that does not exist applies to nobody.',
      )
      continue
    }
    if (coding.code in MUST_NOT_BRANCH) {
      fail(
        `${path}: the tier branch must NOT carry tier "${coding.code}" — ${MUST_NOT_BRANCH[coding.code]}. ` +
          'If this is intentional, update MUST_NOT_BRANCH in this script and the rationale in ' +
          'suicide-safer-care-pathway.fsh together.',
      )
    }
    if (branchedTiers.has(coding.code)) {
      fail(
        `${path}: tier "${coding.code}" already has a branch at ${branchedTiers.get(coding.code)} — ` +
          'two groups for one tier means a patient is owed two different sets of obligations',
      )
    } else {
      branchedTiers.set(coding.code, path)
    }
  }

  // (f) A tier branch's CONDITION names the same tier as its code, through a
  // real extension. The condition is the half a CPG engine EXECUTES; SPiER's own
  // runtime selects the branch by `action.code`, so a branch whose condition
  // tested a different tier was invisible to every test (proved 2026-10-06: the
  // tier-low condition rewritten to `= 'moderate'` passed this gate and all of
  // `npm test`).
  const tierCodes = codings.filter((c) => c.system === TIER_SYSTEM).map((c) => c.code)
  if (tierCodes.length > 0) {
    const expressions = (action.condition ?? [])
      .filter((c) => c.kind === 'applicability')
      .map((c) => c.expression?.expression)
      .filter((e) => typeof e === 'string')
    if (expressions.length === 0) {
      fail(`${path}: a tier branch (${tierCodes.join(', ')}) with no applicability condition — nothing an engine can evaluate selects it`)
    }
    for (const expr of expressions) {
      tierConditionCount++
      const tested = [...expr.matchAll(/\.code\s*=\s*'([^']+)'/g)].map((m) => m[1])
      if (tested.length === 0 || tested.some((t) => !tierCodes.includes(t))) {
        fail(
          `${path}: the branch is coded ${tierCodes.join(', ')} but its condition tests ` +
            `${tested.length ? tested.map((t) => `'${t}'`).join(', ') : 'no tier code'} — \`${expr}\`. ` +
            'An engine evaluating the condition would apply this branch to a different tier than the one it names.',
        )
      }
      if (!expr.includes(`system = '${TIER_SYSTEM}'`)) {
        fail(`${path}: the tier condition does not filter on system = '${TIER_SYSTEM}' — \`${expr}\``)
      }
    }
  }
  // Every extension a condition reads must be a StructureDefinition SPiER publishes.
  for (const c of action.condition ?? []) {
    const expr = c.expression?.expression
    if (typeof expr !== 'string') continue
    for (const m of expr.matchAll(/extension\('([^']+)'\)/g)) {
      conditionExtensionCount++
      if (canonicals.get(m[1]) !== 'StructureDefinition') {
        fail(`${path}: condition reads extension('${m[1]}'), which is not a StructureDefinition in packages/fhir-artifacts/generated/ — the expression evaluates to empty and the branch never applies`)
      }
    }
  }

  // (d) Stage codes are real pathway stages.
  for (const coding of codings.filter((c) => c.system === STAGE_SYSTEM)) {
    stageCodeCount++
    if (!stageCodes.has(coding.code)) {
      fail(
        `${path}: action.code names pathway stage "${coding.code}", which is not in SPiERPathwayStage ` +
          `(${[...stageCodes].join(', ')}). The step would not tie back to any stage in the catalogue.`,
      )
    }
  }

  // (b) Every definitionCanonical resolves to a generated artifact.
  const def = action.definitionCanonical
  if (typeof def === 'string') {
    canonicalCount++
    const bare = def.split('|')[0] // strip any |version
    const type = canonicals.get(bare)
    if (!type) {
      fail(
        `${path}: definitionCanonical "${def}" does not resolve to any artifact in ` +
          'packages/fhir-artifacts/generated/ — the step points at nothing a consumer can fetch',
      )
    } else if (!DEFINITION_TYPES.has(type)) {
      // ⚠️ Added 2026-10-06: resolving was the whole rule, so a step pointing at
      // the tier CodeSystem — a real canonical, of a resource no engine can
      // $apply — passed.
      fail(
        `${path}: definitionCanonical "${def}" resolves to a ${type}. PlanDefinition.action.definition ` +
          `must be one of ${[...DEFINITION_TYPES].join(' | ')} (FHIR R4) — a consumer cannot apply a ${type}.`,
      )
    }
  } else if (def != null) {
    fail(`${path}: definitionCanonical is not a string (${typeof def})`)
  }
  if (action.definitionUri != null) {
    fail(
      `${path}: definitionUri is set. This pathway references SPiER artifacts by canonical so they can be ` +
        'resolved and checked; a raw URI is unresolvable and would slip past rule (b).',
    )
  }

  // (c) No timing of any kind, anywhere.
  for (const key of Object.keys(action)) {
    if (/^timing[A-Z]/.test(key)) {
      fail(
        `${path}: carries \`${key}\`. The reassessment cadence has exactly ONE home — ` +
          'PlanDefinition/SPiERReassessmentSchedule — and is already stated three times, held in ' +
          'agreement by `npm run check:reassessment`. A fourth statement here is the drift that design ' +
          'prevents: reference the schedule by definitionCanonical instead.',
      )
    }
  }
}

/* ─── Floors: a rule that examined nothing has not passed ───── */

if (tierCodeCount === 0) {
  fail(
    'no risk-tier codings found on any action — the tier branch is the point of this artifact, so ' +
      'rule (a) examined nothing and would report green over a pathway with no branch at all',
  )
}
if (tierConditionCount < branchedTiers.size || conditionExtensionCount === 0) {
  fail(
    `rule (f) examined ${tierConditionCount} tier condition(s) and ${conditionExtensionCount} extension ` +
      `reference(s) across ${branchedTiers.size} tier branch(es) — a branch without a parsed condition is unchecked`,
  )
}
if (stageCodeCount === 0) {
  fail(
    'no pathway-stage codings found on any action — rule (d) examined nothing. The stage codes are what ' +
      'tie this protocol back to the eight stage PlanDefinitions.',
  )
}
if (canonicalCount === 0) {
  fail(
    'no definitionCanonical found on any action — rule (b) examined nothing, and a pathway that ' +
      'references no activity realizes no step',
  )
}

/* ─── Report ────────────────────────────────────────────────── */

if (errors.length > 0) {
  console.error('✗ pathway check failed:\n')
  for (const e of errors) console.error(`  - ${e}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✓ pathway: ${flat.length} action(s) across ${plan.action.length} top-level group(s) in ` +
    'PlanDefinition-SPiERSuicideSaferCarePathway',
)
console.log(`  ${tierCodeCount} tier coding(s) resolve — branch covers: ${[...branchedTiers.keys()].join(', ')}`)
console.log(
  `  ${Object.keys(MUST_NOT_BRANCH).length} tier(s) correctly absent from the branch: ` +
    `${Object.keys(MUST_NOT_BRANCH).join(', ')}`,
)
console.log(`  ${stageCodeCount} stage coding(s) resolve against SPiERPathwayStage (${stageCodes.size} stages)`)
console.log(`  ${canonicalCount} definitionCanonical(s) resolve against ${canonicals.size} generated canonicals`)
console.log(`  ${tierConditionCount} tier condition(s) test their own branch's tier; ${conditionExtensionCount} condition extension(s) resolve`)
console.log('  0 timing[x] on any action — the reassessment cadence stays referenced, not restated')
console.log('\npathway check passed.')
