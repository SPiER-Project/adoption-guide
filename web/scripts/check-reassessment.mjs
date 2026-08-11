#!/usr/bin/env node
/**
 * Drift guard for the reassessment schedule (#279).
 *
 * `PlanDefinition-SPiERReassessmentSchedule` states each tier TWICE by design:
 *
 *   - `action.condition[applicability].expression` — FHIRPath, for a CDS engine.
 *   - `action.code` — a plain Coding, for consumers that read the schedule as
 *     data (the demo app cannot evaluate FHIRPath).
 *
 * Two spellings of one rule is a real duplication cost. It was accepted so that
 * neither consumer has to reimplement the other's job — and accepting it is only
 * defensible if something fails when they disagree. That is this script.
 *
 * It also ties in the CQL. `ig/input/cql/SPiERSuicideSaferCareMeasures.cql`
 * RESTATES the intervals in `ReassessmentIntervalDays`, because that library is
 * `context Patient` and cannot retrieve a definitional resource — #296 assumed it
 * could. So there are THREE representations of one rule (PlanDefinition, the app,
 * the CQL) and this is the one place that asserts they agree.
 *
 * It checks five things:
 *   1. Every action's `code` names a tier that exists in SPiERSuicideRiskTier.
 *   2. Every action's FHIRPath mentions that same tier code.
 *   3. Every action carries a usable `timingDuration` in a unit the app reads.
 *   4. No tier gets two actions, and the tiers deliberately left out stay out —
 *      an interval quietly appearing for `imminent` would answer an open
 *      clinical question by accident (see the FSH comment).
 *   5. The CQL's ReassessmentIntervalDays agrees with the PlanDefinition, tier
 *      for tier and in both directions.
 *
 * Run from web/ as `npm run check:reassessment`. Reads generated FHIR, so
 * `copy-fhir` must have run first (verify does that).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const fhirDir = resolve(here, '../src/data/fhir')

const SCHEDULE = resolve(fhirDir, 'PlanDefinition-SPiERReassessmentSchedule.json')
const TIER_CS = resolve(fhirDir, 'CodeSystem-spier-suicide-risk-tier.json')
const CQL = resolve(here, '../../ig/input/cql/SPiERSuicideSaferCareMeasures.cql')

const TIER_SYSTEM = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

/** UCUM codes web/src/lib/reassessment.ts knows how to convert. Keep in step. */
const READABLE_UNITS = new Set(['d', 'wk', 'mo', 'a'])

/**
 * Tiers that must NOT have an interval, and why. Encoded here rather than only
 * in a comment: if someone adds a cadence for imminent risk, that is a clinical
 * decision an open question with the deck's author is waiting on, and it should
 * not arrive as a silent diff.
 */
const MUST_HAVE_NO_INTERVAL = {
  imminent:
    'imminent risk is handled by escalation, not a routine cadence, and whether it stays in the registry at all is an open question with the deck author',
  'no-risk': 'a no-risk patient is not on the suicide-safer care pathway',
}

const errors = []
const fail = m => errors.push(m)

if (!existsSync(SCHEDULE)) {
  console.error(
    `✗ reassessment: ${SCHEDULE} is missing. Run \`npm run copy-fhir\` first (SUSHI must have compiled risk-episode.fsh).`,
  )
  process.exit(1)
}
if (!existsSync(TIER_CS)) {
  console.error(`✗ reassessment: ${TIER_CS} is missing. Run \`npm run copy-fhir\` first.`)
  process.exit(1)
}

const plan = JSON.parse(readFileSync(SCHEDULE, 'utf8'))
const tierCs = JSON.parse(readFileSync(TIER_CS, 'utf8'))
const knownTiers = new Set((tierCs.concept ?? []).map(c => c.code))

const actions = plan.action ?? []
if (actions.length === 0) fail('the schedule has no actions at all — every tier would lose its cadence')

const seen = new Map()

for (const action of actions) {
  const where = `action "${action.id ?? '(no id)'}"`

  const codings = (action.code ?? []).flatMap(c => c.coding ?? [])
  const tierCodings = codings.filter(c => c.system === TIER_SYSTEM)
  if (tierCodings.length !== 1) {
    fail(`${where}: expected exactly 1 risk-tier coding on action.code, found ${tierCodings.length}`)
    continue
  }
  const tier = tierCodings[0].code

  // 1. The tier exists.
  if (!knownTiers.has(tier)) {
    fail(`${where}: action.code names tier "${tier}", which is not in SPiERSuicideRiskTier`)
  }

  // 4a. One action per tier.
  if (seen.has(tier)) {
    fail(`${where}: tier "${tier}" already has a cadence in action "${seen.get(tier)}"`)
  } else {
    seen.set(tier, action.id ?? '(no id)')
  }

  // 4b. The deliberately-absent tiers stay absent.
  if (tier in MUST_HAVE_NO_INTERVAL) {
    fail(
      `${where}: tier "${tier}" must NOT have a reassessment interval — ${MUST_HAVE_NO_INTERVAL[tier]}. ` +
        `If this is intentional, update MUST_HAVE_NO_INTERVAL in this script and the rationale in risk-episode.fsh together.`,
    )
  }

  // 2. The FHIRPath agrees with the code.
  const conditions = (action.condition ?? []).filter(c => c.kind === 'applicability')
  if (conditions.length === 0) {
    fail(`${where}: no condition[applicability] — a CDS engine would apply this cadence to every patient`)
  }
  for (const c of conditions) {
    const expr = c.expression?.expression ?? ''
    if (c.expression?.language !== 'text/fhirpath') {
      fail(`${where}: condition language is "${c.expression?.language}", expected text/fhirpath`)
    }
    if (!expr.includes(`'${tier}'`)) {
      fail(
        `${where}: action.code says tier "${tier}" but its FHIRPath does not mention '${tier}'. ` +
          `The two spellings of this rule have drifted — the CDS engine and the app would disagree.\n` +
          `      FHIRPath: ${expr}`,
      )
    }
    // A condition naming a DIFFERENT tier than action.code is the drift that
    // matters most, because both spellings look individually valid.
    for (const other of knownTiers) {
      if (other !== tier && expr.includes(`'${other}'`)) {
        fail(`${where}: FHIRPath also mentions tier '${other}' while action.code says '${tier}'`)
      }
    }
  }

  // 3. A usable duration.
  const d = action.timingDuration
  if (!d || typeof d.value !== 'number') {
    fail(`${where}: no timingDuration.value — the app would report no cadence for tier "${tier}"`)
  } else {
    if (d.system !== 'http://unitsofmeasure.org') {
      fail(`${where}: timingDuration.system is "${d.system}", expected http://unitsofmeasure.org`)
    }
    if (!READABLE_UNITS.has(d.code)) {
      fail(
        `${where}: timingDuration unit "${d.code}" is not one web/src/lib/reassessment.ts converts ` +
          `(${[...READABLE_UNITS].join(', ')}). The interval would be silently dropped.`,
      )
    }
    if (d.value <= 0) fail(`${where}: timingDuration.value is ${d.value}, which is not a cadence`)
  }
}

/* ─── The CQL's restatement of the same intervals ───────────── */

let cqlPairs = null
if (!existsSync(CQL)) {
  fail(`${CQL} is missing — the CQL library restates these intervals and cannot be compared`)
} else {
  const cql = readFileSync(CQL, 'utf8')
  const fn = cql.match(/define function ReassessmentIntervalDays\(tier String\):([\s\S]*?)\n\s*end/)
  if (!fn) {
    fail(
      'could not find `define function ReassessmentIntervalDays(tier String)` in the CQL. ' +
        'If it was renamed, update this check — the intervals must stay comparable.',
    )
  } else {
    cqlPairs = new Map()
    for (const m of fn[1].matchAll(/when\s+'([^']+)'\s+then\s+(\d+)/g)) {
      cqlPairs.set(m[1], Number(m[2]))
    }
    if (cqlPairs.size === 0) fail('ReassessmentIntervalDays has no `when <tier> then <days>` branches')

    for (const [tier, days] of cqlPairs) {
      if (!seen.has(tier)) {
        fail(
          `CQL ReassessmentIntervalDays gives tier "${tier}" a ${days}-day cadence, but the ` +
            `PlanDefinition publishes none — the measure would score against an interval no site was told about`,
        )
      }
    }
    for (const [tier, actionId] of seen) {
      const planDays = actions.find((a) => a.id === actionId)?.timingDuration?.value
      if (!cqlPairs.has(tier)) {
        fail(
          `the PlanDefinition publishes a ${planDays}-day cadence for tier "${tier}" but the CQL ` +
            `has no branch for it — SPiERReassessmentOnTime would silently exclude those patients`,
        )
      } else if (cqlPairs.get(tier) !== planDays) {
        fail(
          `tier "${tier}": PlanDefinition says ${planDays} days, CQL says ${cqlPairs.get(tier)} — ` +
            `the measure and the work queue would disagree about the same patient`,
        )
      }
    }
  }
}

if (errors.length > 0) {
  console.error('✗ reassessment schedule check failed:\n')
  for (const e of errors) console.error(`  - ${e}`)
  console.error('')
  process.exit(1)
}

const summary = [...seen.entries()]
  .map(([tier, id]) => `${tier}=${actions.find(a => a.id === id)?.timingDuration?.value}${actions.find(a => a.id === id)?.timingDuration?.code}`)
  .join(', ')
console.log(`✓ reassessment: ${actions.length} tier cadence(s) — ${summary}`)
console.log(
  `  ${Object.keys(MUST_HAVE_NO_INTERVAL).length} tier(s) correctly carry no cadence: ${Object.keys(MUST_HAVE_NO_INTERVAL).join(', ')}`,
)
console.log(
  `  CQL ReassessmentIntervalDays agrees on all ${cqlPairs?.size ?? 0} tier(s) — ` +
    'PlanDefinition, app and measure logic in step',
)
console.log('\nreassessment schedule check passed.')
