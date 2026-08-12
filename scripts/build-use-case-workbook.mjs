#!/usr/bin/env node
/**
 * HL7 behavioral-health use-case workbook — generate the deliverable, gate the drift.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * The HL7 BH working group wants scenarios in a specific tabular shape: one row
 * per event step, columns Event Step / Actor / Actor Role / Event / Data
 * Requirements In / Out / Actions Taken / HL7 EHR System Functional Model. SPiER
 * owes them that format, and separately wants the same scenario to drive a
 * runnable demo (`web/src/data/population/scenarios/patient-011.json`) and a
 * FHIR mapping document (`docs/use-cases/ed-scenario-11.md`).
 *
 * Before this script the workbook was the source of truth, hand-edited in a
 * spreadsheet, and everything else was a hand-copy of it. Three consequences
 * were already visible in the circulated copy:
 *
 *   1. Column H — the EHR-S FM references, the one column that makes it an HL7
 *      deliverable rather than a narrative — was empty in all 27 rows, while a
 *      complete first-pass mapping sat unused in ed-scenario-11.md.
 *   2. The demo had drifted: 24 of the 27 steps had walkthrough narration, four
 *      had none, and one walkthrough step (11.7-1A-confirm) existed in no
 *      scenario at all. Nothing could see this.
 *   3. The circulated CSV export had silently dropped a reviewer's comment on
 *      D7 ("need the vendor agnostic version of this"), because CSV has nowhere
 *      to put one.
 *
 * So the direction is inverted. `docs/use-cases/<id>.json` is the source; the
 * .xlsx and .csv are build outputs; and the demo linkage is asserted rather
 * than assumed.
 *
 * ⚠️ **Never hand-edit the generated .xlsx or .csv** — same rule as
 * `web/src/data/fhir/`. A comment typed into the workbook is lost on the next
 * build with nothing going red, which is exactly the failure that motivated
 * this script. Review notes belong in the source JSON's `reviewNotes`, where
 * they are rendered into a visible column on the mapping sheet.
 *
 * ─── Usage ──────────────────────────────────────────────────────────────────
 *
 *   node scripts/build-use-case-workbook.mjs            # write .xlsx + .csv
 *   node scripts/build-use-case-workbook.mjs --check    # gate, write nothing
 *
 * ─── What --check actually gates ────────────────────────────────────────────
 *
 * Three independent things, reported separately so a failure names its cause:
 *
 *   currency  — regenerate both artifacts in memory and compare bytes to the
 *               committed files. This works because the writer is deterministic
 *               (see scripts/lib/xlsx-writer.mjs); it is a stronger check than
 *               build-onepager.mjs's recorded hashes, which exist only because
 *               Chrome's PDF bytes are not reproducible. Do not "unify" them.
 *
 *   content   — assertions that survive a regeneration: every step has all
 *               eight columns populated (column H is the one that was empty),
 *               step ids are unique and well-formed, section ids agree with the
 *               steps they contain.
 *
 *   demo      — the source's declared linkage to patient-011 is true in both
 *               directions. A step claiming `walkthrough: "ed-11-2-1a"` must
 *               find that id; a step declaring `walkthrough: null` must carry a
 *               `walkthroughGapReason` and must NOT be narrated after all; and
 *               any walkthrough step whose `step` is absent from the scenario
 *               must appear in `extraWalkthroughSteps` with a reason.
 *
 * The demo half is an allowlist-with-reasons, not a completeness count, for the
 * reason argued at length in check-sushi-output.mjs: a pinned number churns and
 * trains people to bump it. Four gaps are declared today. Closing one means
 * deleting its `walkthroughGapReason` and adding the narration — the gate then
 * requires them to stay in step.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

import { buildXlsx, toCsv, STYLE } from './lib/xlsx-writer.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const USE_CASES = join(ROOT, 'docs', 'use-cases')

/**
 * Each scenario: its source JSON, and the population scenario whose walkthrough
 * narrates it. Add a row here when the working group asks for the next one.
 */
const SCENARIOS = [
  {
    source: join(USE_CASES, 'ed-scenario-11.json'),
    xlsx: join(USE_CASES, 'dist', 'HL7_BH_USE_CASES-ED-Scenario-11.xlsx'),
    csv: join(USE_CASES, 'dist', 'HL7_BH_USE_CASES-ED-Scenario-11.csv'),
  },
]

const SCENARIO_DIR = join(ROOT, 'web', 'src', 'data', 'population', 'scenarios')

/** Column widths, in Excel's character units, matching the circulated workbook. */
const WG_WIDTHS = [12, 17, 19, 30, 34, 34, 40, 34]
const MAP_WIDTHS = [12, 26, 34, 40, 11, 20, 22, 46]

const MAP_COLUMNS = [
  'Event Step',
  'FHIR resource(s)',
  'Profile binding',
  'HL7 EHR-S FM',
  'SPiER profile',
  'CDS Hooks hook',
  'Demo walkthrough step',
  'Review notes',
]

const STEP_ID = /^\d+\.\d+-\d+[A-Z]$/

function fail(messages) {
  for (const m of messages) console.error(`  ✗ ${m}`)
  console.error(`\n${messages.length} problem${messages.length === 1 ? '' : 's'}.`)
  process.exit(1)
}

function allSteps(doc) {
  return doc.sections.flatMap(section => section.steps.map(step => ({ section, step })))
}

/* ── Sheet 1: the working group's format, verbatim ──────────────────────────
 *
 * Layout is reproduced from the circulated workbook rather than redesigned: A1
 * is one merged full-width cell holding the title and the whole 11.1 narrative,
 * row 2 is the header, and each section is announced by a merged full-width
 * banner carrying its heading and lead paragraph. Those seven merges are the
 * only ones in the document — nothing inside the data grid is merged, which is
 * why a CSV export of it round-trips cleanly.
 */
function wgSheet(doc) {
  const width = doc.columns.length
  const rows = []
  const merges = []

  rows.push({ cells: [{ value: `${doc.title}\n${doc.narrative}`, style: STYLE.title }] })
  merges.push(`A1:${colLetter(width)}1`)

  rows.push({ cells: doc.columns.map(value => ({ value, style: STYLE.header })) })

  for (const section of doc.sections) {
    rows.push({
      cells: [{ value: `${section.heading}\n${section.narrative}`, style: STYLE.section }],
    })
    merges.push(`A${rows.length}:${colLetter(width)}${rows.length}`)

    for (const step of section.steps) {
      rows.push({
        cells: [
          step.step,
          step.actor,
          step.actorRole,
          step.event,
          step.inputs,
          step.outputs,
          step.actions,
          step.ehrsFm.join('; '),
        ].map(value => ({ value, style: STYLE.body })),
      })
    }
  }

  return { name: doc.sheetName, columns: WG_WIDTHS, rows, merges, freezeRow: 2 }
}

/* ── Sheet 2: SPiER's mapping ───────────────────────────────────────────────
 *
 * Kept off sheet 1 on purpose. The working group asked for eight columns;
 * adding FHIR bindings to their template would hand them a document that is no
 * longer their template. This sheet carries what SPiER knows and the WG did not
 * ask for, joined by Event Step, so either sheet can be read alone.
 */
function mappingSheet(doc) {
  const rows = [{ cells: MAP_COLUMNS.map(value => ({ value, style: STYLE.header })) }]

  for (const { step } of allSteps(doc)) {
    const notes = (step.reviewNotes ?? [])
      .map(n => `${n.author} (${n.date}, ${n.column}): ${n.text}`)
      .join('\n')
    const demo = step.walkthrough
      ? `${doc.demoPatient} / ${step.walkthrough}`
      : `not narrated — ${step.walkthroughGapReason}`

    rows.push({
      cells: [
        { value: step.step, style: STYLE.bodyMono },
        { value: step.fhir.join('; '), style: STYLE.body },
        { value: step.profileBinding, style: STYLE.body },
        { value: step.ehrsFm.join('; '), style: STYLE.body },
        { value: step.profileGap ? 'gap' : 'built', style: STYLE.body },
        { value: step.cdsHook ?? '', style: STYLE.body },
        { value: demo, style: STYLE.body },
        { value: notes, style: STYLE.body },
      ],
    })
  }

  return { name: 'SPiER Mapping', columns: MAP_WIDTHS, rows, merges: [], freezeRow: 1 }
}

function colLetter(index) {
  return String.fromCharCode(64 + index)
}

/**
 * The CSV mirrors sheet 1 only. A merged banner degrades to its text in column
 * A with the rest empty — which is what the circulated CSV did, so downstream
 * readers of the old export keep working.
 */
function wgCsv(doc) {
  const width = doc.columns.length
  const pad = first => [first, ...Array(width - 1).fill('')]
  const rows = [pad(`${doc.title}\n${doc.narrative}`), doc.columns]

  for (const section of doc.sections) {
    rows.push(pad(`${section.heading}\n${section.narrative}`))
    for (const step of section.steps) {
      rows.push([
        step.step,
        step.actor,
        step.actorRole,
        step.event,
        step.inputs,
        step.outputs,
        step.actions,
        step.ehrsFm.join('; '),
      ])
    }
  }

  return toCsv(rows)
}

/* ── Content assertions ─────────────────────────────────────────────────────
 *
 * These hold regardless of whether the artifacts are current, so they run in
 * both modes — a build should refuse to emit a workbook with an empty column H
 * just as loudly as a check refuses to pass one.
 */
function checkContent(doc, label) {
  const problems = []
  const seen = new Set()

  if (doc.columns.length !== 8) {
    problems.push(`${label}: expected 8 columns, found ${doc.columns.length}`)
  }

  for (const { section, step } of allSteps(doc)) {
    const at = `${label} ${step.step}`

    if (!STEP_ID.test(step.step)) problems.push(`${at}: malformed step id`)
    if (seen.has(step.step)) problems.push(`${at}: duplicate step id`)
    seen.add(step.step)

    if (!step.step.startsWith(`${section.id}-`)) {
      problems.push(`${at}: sits under section ${section.id}`)
    }

    for (const field of ['actor', 'actorRole', 'event', 'inputs', 'outputs', 'actions']) {
      if (!step[field] || !String(step[field]).trim()) problems.push(`${at}: empty ${field}`)
    }

    // The reason this script exists. An unmapped step is a hole in the
    // deliverable, not a formatting nit.
    if (!Array.isArray(step.ehrsFm) || step.ehrsFm.length === 0) {
      problems.push(`${at}: no HL7 EHR-S FM reference (column H)`)
    }

    if (step.walkthrough === null && !step.walkthroughGapReason) {
      problems.push(`${at}: walkthrough is null with no walkthroughGapReason`)
    }
    if (step.walkthrough && step.walkthroughGapReason) {
      problems.push(`${at}: has both a walkthrough id and a gap reason`)
    }
  }

  return problems
}

/* ── Demo linkage ───────────────────────────────────────────────────────────
 *
 * Both directions, because each catches a different mistake: source→demo
 * catches a renamed or deleted walkthrough step, demo→source catches narration
 * for a step the working group never defined.
 */
function checkDemoLinkage(doc, label) {
  const problems = []
  const path = join(SCENARIO_DIR, `${doc.demoPatient}.json`)

  if (!existsSync(path)) {
    return [`${label}: demo scenario ${relative(ROOT, path)} not found`]
  }

  const walkthrough = JSON.parse(readFileSync(path, 'utf8')).walkthrough ?? []
  const byId = new Map(walkthrough.map(entry => [entry.id, entry]))
  const byStep = new Map(walkthrough.filter(e => e.step).map(entry => [entry.step, entry]))
  const declared = new Set()
  const scenarioSteps = new Set(allSteps(doc).map(({ step }) => step.step))

  for (const { step } of allSteps(doc)) {
    const at = `${label} ${step.step}`

    if (step.walkthrough) {
      declared.add(step.walkthrough)
      const entry = byId.get(step.walkthrough)
      if (!entry) {
        problems.push(`${at}: declares walkthrough "${step.walkthrough}", absent from ${doc.demoPatient}`)
      } else if (entry.step !== step.step) {
        problems.push(
          `${at}: walkthrough "${step.walkthrough}" is labelled ${entry.step ?? '(none)'}`,
        )
      }
    } else if (byStep.has(step.step)) {
      // The gap reason has gone stale: the demo narrates this after all.
      problems.push(
        `${at}: declared not-narrated, but ${doc.demoPatient} has "${byStep.get(step.step).id}" — ` +
          `drop walkthroughGapReason and set walkthrough`,
      )
    }
  }

  const allowed = doc.extraWalkthroughSteps ?? {}
  for (const entry of walkthrough) {
    if (declared.has(entry.id)) continue
    const key = entry.step ?? entry.id
    // A step the scenario *does* define was already reported precisely by the
    // loop above — as a renamed id, or as a gap reason the demo has outgrown.
    // Saying "matches no scenario step" as well would be both redundant and
    // wrong, and would send the reader to fix the allowlist instead of the id.
    if (scenarioSteps.has(key)) continue
    if (!(key in allowed)) {
      problems.push(
        `${doc.demoPatient} walkthrough "${entry.id}" (${key}) matches no scenario step — ` +
          `add it to the scenario, or to extraWalkthroughSteps with a reason`,
      )
    }
  }

  for (const key of Object.keys(allowed)) {
    if (!walkthrough.some(entry => (entry.step ?? entry.id) === key)) {
      problems.push(`${label}: extraWalkthroughSteps lists "${key}", which no longer exists`)
    }
  }

  return problems
}

function main() {
  const check = process.argv.includes('--check')
  const problems = []
  let built = 0

  for (const scenario of SCENARIOS) {
    const doc = JSON.parse(readFileSync(scenario.source, 'utf8'))
    const label = doc.id

    problems.push(...checkContent(doc, label))
    problems.push(...checkDemoLinkage(doc, label))

    const xlsx = buildXlsx([wgSheet(doc), mappingSheet(doc)])
    const csv = Buffer.from(wgCsv(doc), 'utf8')

    if (check) {
      for (const [path, fresh] of [
        [scenario.xlsx, xlsx],
        [scenario.csv, csv],
      ]) {
        const rel = relative(ROOT, path)
        if (!existsSync(path)) {
          problems.push(`${rel} is missing — run: node scripts/build-use-case-workbook.mjs`)
        } else if (!readFileSync(path).equals(fresh)) {
          problems.push(
            `${rel} is stale (${readFileSync(path).length} bytes committed, ${fresh.length} rebuilt) — ` +
              `run: node scripts/build-use-case-workbook.mjs`,
          )
        }
      }
      const steps = allSteps(doc).length
      console.log(`  ${label}: ${steps} steps, ${doc.sections.length} sections`)
    } else {
      writeFileSync(scenario.xlsx, xlsx)
      writeFileSync(scenario.csv, csv)
      console.log(`  ${relative(ROOT, scenario.xlsx)}  ${xlsx.length} bytes`)
      console.log(`  ${relative(ROOT, scenario.csv)}  ${csv.length} bytes`)
      built++
    }
  }

  if (problems.length) fail(problems)

  console.log(check ? '\nUse-case workbooks are current.' : `\nBuilt ${built} workbook(s).`)
}

main()
