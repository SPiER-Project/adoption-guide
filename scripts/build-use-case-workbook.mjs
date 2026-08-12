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
 * ⚠️ **Never hand-edit the generated .xlsx, .csv or .md** — same rule as
 * `web/src/data/fhir/`. A comment typed into the workbook is lost on the next
 * build with nothing going red, which is exactly the failure that motivated
 * this script. Review notes belong in the source JSON's `reviewNotes`, where
 * they are rendered into a visible column on the mapping sheet.
 *
 * ─── Usage ──────────────────────────────────────────────────────────────────
 *
 *   node scripts/build-use-case-workbook.mjs            # write .xlsx + .csv + .md
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
 * trains people to bump it. Closing a declared gap means deleting its
 * `walkthroughGapReason` and adding the narration — the gate then requires them
 * to stay in step.
 *
 *   proposed  — a step SPiER is adding rather than one the working group wrote
 *               must be marked `origin: "spier-proposed"` and give a
 *               `rationale`, and is rendered "(proposed)" everywhere its id
 *               appears. Presenting a SPiER proposal unmarked inside their own
 *               document would misrepresent what they authored.
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
    md: join(USE_CASES, 'ed-scenario-11.md'),
  },
]

/**
 * FHIR resource types the mapping is allowed to name. The list is an allowlist
 * rather than the full R4 set on purpose: `fhirResources()` below picks type
 * names out of free prose by shape, so without a check a typo (`Questionaire`)
 * or a stray capitalised backtick term would silently become a "resource type"
 * on the mapping sheet. Add a row when a step legitimately needs a new type.
 */
const KNOWN_RESOURCES = new Set([
  'Appointment',
  'Bundle',
  'CarePlan',
  'CareTeam',
  'Organization',
  'Patient',
  'RelatedPerson',
  'Communication',
  'CommunicationRequest',
  'Composition',
  'Condition',
  'Consent',
  'DocumentReference',
  'Encounter',
  'EpisodeOfCare',
  'Flag',
  'List',
  'Observation',
  'PlanDefinition',
  'Procedure',
  'Provenance',
  'Questionnaire',
  'QuestionnaireResponse',
  'ServiceRequest',
  'Task',
])

const SCENARIO_DIR = join(ROOT, 'web', 'src', 'data', 'population', 'scenarios')

/** Column widths, in Excel's character units, matching the circulated workbook. */
const WG_WIDTHS = [12, 17, 19, 30, 34, 34, 40, 34]
const MAP_WIDTHS = [16, 26, 34, 40, 11, 20, 22, 40, 52]

const MAP_COLUMNS = [
  'Event Step',
  'FHIR resource(s)',
  'Profile binding',
  'HL7 EHR-S FM',
  'SPiER profile',
  'CDS Hooks hook',
  'Demo walkthrough step',
  'Review notes',
  'Proposed — rationale',
]

/**
 * Steps SPiER is proposing, as distinct from the ones the clinical lead wrote.
 *
 * The circulated scenario has 27 steps. Anything added here is a SPiER
 * proposal that the working group has not seen, and presenting it unmarked
 * inside their own document would misrepresent what they authored — so every
 * such step is labelled "(proposed)" wherever its id is rendered, and owes a
 * `rationale` explaining the gap it closes.
 */
const PROPOSED = 'spier-proposed'

function isProposed(step) {
  return step.origin === PROPOSED
}

/** The id as a reader sees it. `step.step` itself stays clean, for joins and gates. */
function displayStep(step) {
  return isProposed(step) ? `${step.step} (proposed)` : step.step
}

const STEP_ID = /^\d+\.\d+-\d+[A-Z]$/

function fail(messages) {
  for (const m of messages) console.error(`  ✗ ${m}`)
  console.error(`\n${messages.length} problem${messages.length === 1 ? '' : 's'}.`)
  process.exit(1)
}

function allSteps(doc) {
  return doc.sections.flatMap(section => section.steps.map(step => ({ section, step })))
}

/**
 * Markdown is the authoritative form of the mapping prose, because it is the
 * only one that can carry a link to the artifact it is talking about. The
 * spreadsheet gets this flattened — the reverse would lose those links with
 * nowhere to recover them from.
 */
function stripMarkdown(text) {
  return String(text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The FHIR resource types a step names, picked out of its prose by the
 * backticks already around them. `encounter` and `restriction.period` are
 * elements, not resources, and are excluded by the leading-capital test;
 * `CarePlan.activity` contributes CarePlan.
 */
function fhirResources(step) {
  const found = []
  for (const [, token] of String(step.fhirText).matchAll(/`([^`]+)`/g)) {
    const type = token.split('.')[0]
    if (/^[A-Z][A-Za-z]+$/.test(type) && !found.includes(type)) found.push(type)
  }
  return found
}

/** A step is a gap when its binding says so — one source for the fact. */
function isGap(step) {
  return /\*\*gap\*\*/.test(step.profileBinding)
}

function issueUrl(number) {
  return `https://github.com/SPiER-Project/adoption-guide/issues/${number}`
}

/** "Scenario 11.2 – Screening and Identification" -> "11.2 — Screening and Identification" */
function sectionTitle(section) {
  const name = section.heading.split(/\s+[–—]\s+/).slice(1).join(' — ')
  return `${section.id} — ${name}`
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
          displayStep(step),
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
        { value: displayStep(step), style: STYLE.bodyMono },
        { value: fhirResources(step).join('; '), style: STYLE.body },
        { value: stripMarkdown(step.profileBinding), style: STYLE.body },
        { value: step.ehrsFm.join('; '), style: STYLE.body },
        { value: isGap(step) ? 'gap' : 'built', style: STYLE.body },
        { value: stripMarkdown(step.cdsHook ?? ''), style: STYLE.body },
        { value: demo, style: STYLE.body },
        { value: notes, style: STYLE.body },
        { value: isProposed(step) ? step.rationale : '', style: STYLE.body },
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
        displayStep(step),
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

/* ── The mapping document ───────────────────────────────────────────────────
 *
 * Same source, third output. This document is the one a human reads to answer
 * "what FHIR does step 11.3-1B need, and do we have it" — and before it was
 * generated, its EHR-S FM column was the only place those references existed
 * while the working group's own column H sat empty. Deriving both from one
 * file is the whole point.
 *
 * Two lists at the foot are derived rather than restated: the consolidated
 * profile gaps come from each step's `profileGaps` in step order, and the
 * gating-tool promotions from each step's `gatingIssues`, de-duplicated. They
 * used to be hand-maintained tallies of the tables above them, which is the
 * classic place for a count to go quietly stale.
 */
const MD_COLUMNS = [
  'Step',
  'Actor',
  'Actor Role',
  'FHIR resources',
  'Profile bindings',
  'HL7 EHR functional model',
  'CDS Hooks',
]

function markdownRow(cells) {
  for (const cell of cells) {
    // An unescaped pipe silently splits the row into extra columns, and the
    // table still renders — just wrongly, and only in the published view.
    if (cell.includes('|')) throw new Error(`Table cell contains an unescaped pipe: ${cell}`)
  }
  return `| ${cells.join(' | ')} |`
}

function renderMarkdown(doc) {
  const m = doc.mapping
  const out = [`# ${m.title}`, '']

  out.push(m.preamble.map(p => `> ${p}`).join('\n>\n'), '', '---', '')

  out.push('## Scenario summary', '', m.summaryIntro, '')
  doc.sections.forEach((section, i) => out.push(`${i + 1}. ${section.summary}`))
  out.push('', '---', '')

  for (const section of doc.sections) {
    out.push(`## ${sectionTitle(section)}`, '')
    out.push(markdownRow(MD_COLUMNS))
    out.push(markdownRow(MD_COLUMNS.map(() => '---')))
    for (const step of section.steps) {
      out.push(
        markdownRow([
          displayStep(step),
          step.actor,
          step.actorRole,
          step.fhirText,
          step.profileBinding,
          step.ehrsFm.join('; '),
          step.cdsHook ?? 'n/a',
        ]),
      )
    }
    out.push('')
    if (section.note) out.push(section.note, '')
    out.push('---', '')
  }

  const proposed = allSteps(doc).filter(({ step }) => isProposed(step))
  if (proposed.length) {
    out.push('## Proposed additions', '', m.proposedIntro, '')
    for (const { step } of proposed) {
      out.push(`- **${step.step} — ${step.event}** (${step.actor} / ${step.actorRole})`)
      out.push(`  ${step.rationale}`)
    }
    out.push('', '---', '')
  }

  out.push('## Profile gaps consolidated', '', m.gapsIntro, '')
  let n = 0
  for (const { step } of allSteps(doc)) {
    for (const gap of step.profileGaps ?? []) out.push(`${++n}. ${gap}`)
  }
  out.push('', m.gapsFooter, '')

  out.push('## Gating tool promotions', '', m.gatingIntro, '')
  const seen = new Set()
  for (const { step } of allSteps(doc)) {
    for (const issue of step.gatingIssues ?? []) {
      if (seen.has(issue.number)) continue
      seen.add(issue.number)
      out.push(`- [#${issue.number} ${issue.label}](${issueUrl(issue.number)})`)
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
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

    if (!step.fhirText || !step.profileBinding) {
      problems.push(`${at}: missing fhirText or profileBinding`)
    }

    for (const type of fhirResources(step)) {
      if (!KNOWN_RESOURCES.has(type)) {
        problems.push(`${at}: "${type}" is not in KNOWN_RESOURCES — typo, or add it`)
      }
    }

    // A step whose binding says **gap** owes the reader a way to track it:
    // either a named profile for the consolidated list, or the tool epic that
    // has to be promoted first. Without this the two foot-lists drift from the
    // tables they summarise, which is how they were maintained before.
    if (isGap(step) && !(step.profileGaps?.length || step.gatingIssues?.length)) {
      problems.push(`${at}: marked **gap** but names no profileGaps and no gatingIssues`)
    }
    if (!isGap(step) && step.profileGaps?.length) {
      problems.push(`${at}: names profileGaps but its binding is not marked **gap**`)
    }

    // A proposal the working group has not seen must say what gap it closes,
    // or it is indistinguishable from the scenario they actually wrote.
    if (isProposed(step) && !step.rationale) {
      problems.push(`${at}: origin is ${PROPOSED} but it gives no rationale`)
    }
    if (!isProposed(step) && step.rationale) {
      problems.push(`${at}: has a rationale but is not marked as proposed`)
    }
    if (step.origin && step.origin !== PROPOSED) {
      problems.push(`${at}: unknown origin "${step.origin}"`)
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
    const md = Buffer.from(renderMarkdown(doc), 'utf8')

    if (check) {
      for (const [path, fresh] of [
        [scenario.xlsx, xlsx],
        [scenario.csv, csv],
        [scenario.md, md],
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
      for (const [path, fresh] of [
        [scenario.xlsx, xlsx],
        [scenario.csv, csv],
        [scenario.md, md],
      ]) {
        writeFileSync(path, fresh)
        console.log(`  ${relative(ROOT, path)}  ${fresh.length} bytes`)
      }
      built++
    }
  }

  if (problems.length) fail(problems)

  console.log(check ? '\nUse-case workbooks are current.' : `\nBuilt ${built} workbook(s).`)
}

main()
