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
 * runnable demo (`packages/demo-population/src/scenarios/patient-011.json`) and a
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
 * `packages/fhir-artifacts/generated/`. A comment typed into the workbook is lost on the next
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
 *               committed files. This works only because the writer is
 *               deterministic (see scripts/lib/xlsx-writer.mjs). Do not trade
 *               that away for smaller files: a recorded-hash gate would be the
 *               weaker fallback, and is only ever the right answer for a
 *               generator whose output is NOT reproducible.
 *
 *   content   — assertions that survive a regeneration: every step has all
 *               eight columns populated (column H is the one that was empty),
 *               step ids are unique and well-formed, section ids agree with the
 *               steps they contain.
 *
 *   demo      — the source's declared linkage to patient-011 is true in both
 *               directions, and the two flags each step carries in BOTH files —
 *               `proposed` and `profileGap` — agree. `profileGap` is the same
 *               claim as this document's `**gap**` binding; fifteen of them had
 *               drifted apart (#341), every one showing the chart a gap badge
 *               for work that had shipped. A step claiming `walkthrough: "ed-11-2-1a"` must
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
 *
 *   tool      — a `status:planned` claim, or a gating-tool entry, must not name
 *               a tool the app can already launch. This is the half that went
 *               stale in silence (issue #341): the document told the working
 *               group that BSSA, SAFE-T, Means Counseling and Transition were
 *               planned work long after all four were built, shipped and
 *               launchable in the demo — and the one about Means Counseling is
 *               also what made a missing demo artifact look intentional (#324).
 *
 *               "Built" is read from the app rather than asserted here: a tool
 *               is built when `tool-ui-metadata.ts` gives it a launch path AND
 *               that path resolves to a route in App.tsx. A tool with no launch
 *               action is never "built", which is what keeps the three genuine
 *               placeholders (TL-026, TL-028 licensing no-go, TL-029) out of it
 *               — they declare none. Today 34 of 34 tools with a launch action
 *               resolve, and the check prints that count so a wrong parse shows
 *               up as a suspicious number rather than as silence. GitHub's own
 *               `status:` labels are the authority, but they live outside the
 *               repo, so a claim that contradicts the running app is the
 *               strongest offline evidence available — and it is the direction
 *               that actually goes wrong. The reverse (a built tool the doc
 *               never mentions) is not an error.
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

const SCENARIO_DIR = join(ROOT, 'packages', 'demo-population', 'src', 'scenarios')

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

/** Why a step has no demo narration. See the assertion in checkContent(). */
const GAP_KINDS = new Set(['not-narrated', 'branch-exclusive'])

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
    const demo = (step.walkthrough ?? []).length
      ? step.walkthrough.join('\n')
      : `${step.walkthroughGapKind} — ${step.walkthroughGapReason}`

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
  const walkthroughs = new Map() // patient id → entries

  for (const patient of doc.demoPatients) {
    const path = join(SCENARIO_DIR, `${patient}.json`)
    if (!existsSync(path)) {
      problems.push(`${label}: demo scenario ${relative(ROOT, path)} not found`)
      continue
    }
    walkthroughs.set(patient, JSON.parse(readFileSync(path, 'utf8')).walkthrough ?? [])
  }
  if (problems.length) return problems

  /** Every "<patient>/<walkthrough id>" this scenario claims. */
  const declared = new Set()

  for (const { step } of allSteps(doc)) {
    const at = `${label} ${step.step}`
    const refs = step.walkthrough ?? []

    if (!Array.isArray(refs)) {
      problems.push(`${at}: walkthrough must be an array of "<patient>/<id>" refs`)
      continue
    }

    for (const ref of refs) {
      const slash = ref.indexOf('/')
      const patient = ref.slice(0, slash)
      const id = ref.slice(slash + 1)

      if (slash < 0 || !walkthroughs.has(patient)) {
        problems.push(`${at}: walkthrough ref "${ref}" names no demo patient`)
        continue
      }
      declared.add(ref)

      const entry = walkthroughs.get(patient).find(e => e.id === id)
      if (!entry) {
        problems.push(`${at}: declares "${ref}", absent from ${patient}`)
      } else if (entry.step !== step.step) {
        problems.push(`${at}: "${ref}" is labelled ${entry.step ?? '(none)'}`)
      } else if (Boolean(entry.proposed) !== isProposed(step)) {
        // The chart tags a proposed step so a viewer can tell SPiER's additions
        // from the working group's scenario. If the two files disagree, the
        // running demo silently presents a proposal as settled.
        problems.push(
          `${at}: scenario says ${isProposed(step) ? 'proposed' : 'not proposed'}, ` +
            `but ${ref} says the opposite`,
        )
      } else if (Boolean(entry.profileGap) !== isGap(step)) {
        // Same class as `proposed`, and the one that actually drifted: the
        // walkthrough's `profileGap` and this document's `**gap**` binding are
        // the SAME claim about the SAME step — "SPiER has no profile for this
        // yet" — kept in two files. Fifteen of them disagreed, all in the
        // direction of the chart showing a gap badge for work that shipped
        // (#341). The document is the audited side, so it wins.
        problems.push(
          `${at}: this document says ${isGap(step) ? 'gap' : 'no gap'}, but ${ref} ` +
            `sets profileGap: ${Boolean(entry.profileGap)} — they are the same claim, ` +
            `so one of them is telling a reader something untrue`,
        )
      }
    }

    // A step narrated somewhere must not still be declaring why it isn't.
    if (refs.length && (step.walkthroughGapReason || step.walkthroughGapKind)) {
      problems.push(`${at}: is narrated but still declares a walkthrough gap`)
    }
    if (!refs.length) {
      if (!step.walkthroughGapReason) {
        problems.push(`${at}: no walkthrough refs and no walkthroughGapReason`)
      }
      if (!GAP_KINDS.has(step.walkthroughGapKind)) {
        problems.push(`${at}: walkthroughGapKind must be one of ${[...GAP_KINDS].join(' | ')}`)
      }
      // The reason has gone stale if some demo narrates it after all.
      for (const [patient, entries] of walkthroughs) {
        const found = entries.find(e => e.step === step.step)
        if (found) {
          problems.push(
            `${at}: declared not narrated, but ${patient} has "${found.id}" — ` +
              `add "${patient}/${found.id}" to walkthrough and drop the gap fields`,
          )
        }
      }
    }
  }

  // The other direction: nothing narrated may go undeclared. This is exact now
  // that a step can claim refs on several patients — before, a shared step like
  // 11.2-2A had to be skipped, which meant nobody checked it.
  const allowed = doc.extraWalkthroughSteps ?? {}
  for (const [patient, entries] of walkthroughs) {
    for (const entry of entries) {
      if (declared.has(`${patient}/${entry.id}`)) continue
      const key = entry.step ?? entry.id
      if (!(key in allowed)) {
        problems.push(
          `${patient} walkthrough "${entry.id}" (${key}) is declared by no scenario step — ` +
            `add the ref, or add it to extraWalkthroughSteps with a reason`,
        )
      }
    }
  }

  for (const key of Object.keys(allowed)) {
    const live = [...walkthroughs.values()].some(entries =>
      entries.some(e => (e.step ?? e.id) === key),
    )
    if (!live) problems.push(`${label}: extraWalkthroughSteps lists "${key}", which no longer exists`)
  }

  return problems
}

/* ── Tool-status claims ─────────────────────────────────────────────────────
 *
 * See "tool" in the header. Nothing here parses TypeScript properly — it reads
 * two literal shapes out of the catalog and the router, and **fails loudly if
 * it finds neither**, because a regex that silently matches nothing would turn
 * this gate green over an unread file (the #232 / #261 failure mode).
 */
const UI_METADATA = join(ROOT, 'packages', 'core', 'src', 'data', 'catalog', 'tool-ui-metadata.ts')
const APP_ROUTES = join(ROOT, 'web', 'src', 'App.tsx')

/** TL id → launch paths declared in tool-ui-metadata.ts. */
function launchPathsByTool() {
  const src = readFileSync(UI_METADATA, 'utf8')
  const byTool = new Map()
  // `'TL-008': { … launchActions: [{ label: '…', path: '/patient/workflow/lethal-means' }] … }`
  for (const entry of src.matchAll(/'(TL-\d+)':\s*\{/g)) {
    const start = entry.index
    const next = src.slice(start + 1).search(/'TL-\d+':\s*\{/)
    const block = src.slice(start, next === -1 ? undefined : start + 1 + next)
    const paths = [...block.matchAll(/path:\s*'([^']+)'/g)].map(m => m[1])
    if (paths.length) byTool.set(entry[1], paths)
  }
  return byTool
}

/** Route paths declared in App.tsx, nested segments included. */
function declaredRoutes() {
  return new Set([...readFileSync(APP_ROUTES, 'utf8').matchAll(/path="([^"]+)"/g)].map(m => m[1]))
}

/** Is this launch path reachable? `/patient/assessments/bssa` → `assessments/bssa`. */
function pathResolves(path, routes) {
  if (routes.has(path)) return true
  const segments = path.replace(/^\//, '').split('/')
  for (let i = 1; i < segments.length; i++) {
    if (routes.has(segments.slice(i).join('/'))) return true
  }
  return false
}

function checkToolStatusClaims(doc, label) {
  const problems = []
  const byTool = launchPathsByTool()
  const routes = declaredRoutes()

  if (byTool.size === 0) problems.push(`${label}: read no TL launch actions from ${relative(ROOT, UI_METADATA)}`)
  if (routes.size === 0) problems.push(`${label}: read no routes from ${relative(ROOT, APP_ROUTES)}`)
  if (problems.length) return problems

  const built = new Set(
    [...byTool].filter(([, paths]) => paths.some(p => pathResolves(p, routes))).map(([tool]) => tool),
  )
  if (built.size === 0) {
    return [`${label}: no TL launch path resolved to a route — the parse is wrong, not the catalog`]
  }

  /** Issue number → TL id, from the doc's own links: `[TL-010](…/issues/26)`. */
  const toolForIssue = new Map()
  for (const { step } of allSteps(doc)) {
    for (const m of String(step.profileBinding ?? '').matchAll(/\[(TL-\d+)[^\]]*\]\([^)]*\/issues\/(\d+)\)/g)) {
      toolForIssue.set(Number(m[2]), m[1])
    }
  }

  let claims = 0

  for (const { step } of allSteps(doc)) {
    const at = `${label} ${step.step}`
    const binding = String(step.profileBinding ?? '')

    // A `status:planned` claim sits next to the TL link it describes.
    for (const m of binding.matchAll(/\[(TL-\d+)[^\]]*\][^;]*?status:planned/g)) {
      claims++
      if (built.has(m[1])) {
        problems.push(
          `${at}: says ${m[1]} is \`status:planned\`, but it launches at ` +
            `${byTool.get(m[1]).join(', ')} — promote the binding, or the document tells the ` +
            `working group SPiER has a gap it closed`,
        )
      }
    }

    for (const gating of step.gatingIssues ?? []) {
      claims++
      const tool = toolForIssue.get(gating.number)
      if (tool && built.has(tool)) {
        problems.push(
          `${at}: gates on ${gating.label} (#${gating.number} = ${tool}), which launches at ` +
            `${byTool.get(tool).join(', ')} — it no longer gates anything`,
        )
      }
    }
  }

  // Printed, not silent: a gate that says nothing on success is indistinguishable
  // in a CI log from one that read nothing at all.
  console.log(
    `  ${label}: ${claims} tool-status claim(s) checked against ` +
      `${built.size} launchable tool(s) of ${byTool.size} with a launch action`,
  )

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
    problems.push(...checkToolStatusClaims(doc, label))

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
      const steps = allSteps(doc)
      const kinds = steps.filter(({ step }) => !(step.walkthrough ?? []).length)
      const todo = kinds.filter(({ step }) => step.walkthroughGapKind === 'not-narrated')
      console.log(
        `  ${label}: ${steps.length} steps, ${doc.sections.length} sections, ` +
          `${steps.length - kinds.length} narrated ` +
          `(${todo.length} to narrate, ${kinds.length - todo.length} branch-exclusive)`,
      )
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
