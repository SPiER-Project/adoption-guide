#!/usr/bin/env node
/**
 * carePlan-mapper reader gate — does the NESTING each mapper walks match the
 * nesting its Questionnaire declares?
 *
 * ─── Why this is separate from `check:readers` ───────────────────────────────
 *
 * `check-mapper-readers.mjs` asks a different question of a different tree:
 * for the **observation** mappers, does the *value reader* applied to a linkId
 * match that item's declared `type` (#327 — every C-SSRS mapper read a
 * `valueBoolean` no Questionnaire declares)? It scans
 * `packages/core/src/lib/observationMappers` and nothing else, which is why the
 * same family recurred one directory over and no gate saw it (#420).
 *
 * The carePlan mappers do not read values off leaves; they read *structure*.
 * `extractAnswers` walks repeating leaves, `extractPairs` walks a repeating
 * group's two child fields. So the property worth gating is the nesting:
 *
 *   - a linkId read by `extractPairs` must be a `type: group` in the
 *     Questionnaire, and its two fields must be leaves inside it;
 *   - a linkId read by `extractAnswer`/`extractAnswers` must be a LEAF, never a
 *     group — pointing a leaf reader at a group silently returns nothing.
 *
 * ─── What it caught, and would have caught ───────────────────────────────────
 *
 * #418/#419: the Questionnaires declare the Stanley-Brown contact steps and
 * CAMS's `barrier-solution-group` as `type: group, repeats: true`. FHIR renders
 * a repeating group as repeated `item` entries with nested `item[]`, and that is
 * what `@formbox/renderer` emits (verified in a browser). `extractPairs` read
 * only `answer[].item[]` — a shape the HL7 validator rejects with "Items of type
 * question should not have answers". A correctly-filled safety plan produced a
 * well-formed CarePlan with every contact section reading "No … provided.":
 * structurally perfect, clinically empty.
 *
 * ⚠️ **That behaviour is NOT gated here, deliberately.** Whether `extractPairs`
 * still *reads* both nestings is a runtime property, and a static reader cannot
 * tell a live branch from a dead one — `if (undefined) { readPair(item.item) }`
 * contains every token an honest implementation does. Two planted defects
 * proved exactly that against an earlier draft of this file, which is why the
 * rule was removed rather than weakened into something that looks like
 * protection. It is covered where it can actually be observed: the both-shapes
 * cases in `stanleyBrown.test.ts` and `camsStabilization.test.ts`, and the
 * derivation and parity suites. Deleting either branch fails eight of them.
 *
 * ─── Rules ───────────────────────────────────────────────────────────────────
 *
 *   1. Every `extractPairs(items, GROUP, A, B)` — GROUP is a declared `group`;
 *      A and B are declared non-group items.
 *   2. Every `extractAnswer(s)(items, LINK)` — LINK is a declared non-group item.
 *   3. Reading nothing is an error. Zero mappers, zero call sites, zero
 *      Questionnaires or an unresolvable linkId argument all fail rather than
 *      pass quietly (#232, #261 — and #420 itself, which was a *scope* that
 *      silently excluded a whole family).
 *
 * A linkId is resolved across EVERY SPiER Questionnaire rather than against one
 * associated form, because the carePlan mappers declare no canonical→mapper
 * registry the way `observationMappers/index.ts` does — the association lives in
 * `App.tsx`'s route props and, for Stanley-Brown, inside its bespoke view. That
 * is sound here because the question is binary (group or leaf) and every linkId
 * these mappers read resolves the same way in every form that declares it. If
 * two forms ever disagree, that is an ERROR, not a coin toss — see AMBIGUOUS.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const mapperDir = join(root, 'packages/core/src/lib/carePlanMappers')
const questionnaireDirs = [join(root, 'FHIR-Resources')]

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures += 1
}

// --- Questionnaires: linkId → is it a group? --------------------------------

/** @type {Map<string, Map<string, boolean>>} linkId → (questionnaire → isGroup) */
const declaredBy = new Map()

function walkQuestionnaire(items, label) {
  for (const item of items ?? []) {
    if (typeof item?.linkId === 'string') {
      if (!declaredBy.has(item.linkId)) declaredBy.set(item.linkId, new Map())
      declaredBy.get(item.linkId).set(label, item.type === 'group')
    }
    walkQuestionnaire(item?.item, label)
  }
}

function loadQuestionnaires(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return 0
  }
  let n = 0
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      n += loadQuestionnaires(full)
      continue
    }
    if (!entry.endsWith('.json')) continue
    let doc
    try {
      doc = JSON.parse(readFileSync(full, 'utf8'))
    } catch {
      continue
    }
    if (doc?.resourceType !== 'Questionnaire') continue
    walkQuestionnaire(doc.item, doc.url ?? relative(root, full))
    n += 1
  }
  return n
}

const questionnaireCount = questionnaireDirs.reduce((n, d) => n + loadQuestionnaires(d), 0)
if (questionnaireCount === 0) {
  fail('no Questionnaires found — every rule below would pass vacuously [treated as a failure]')
}

/**
 * Is this linkId a group? `undefined` when undeclared. Disagreement between
 * forms is an error rather than a guess: it would mean the mapper needs to know
 * WHICH form it is reading, and this gate deliberately does not.
 */
function groupness(linkId, where) {
  const decls = declaredBy.get(linkId)
  if (!decls) return undefined
  const values = new Set(decls.values())
  if (values.size > 1) {
    const detail = [...decls].map(([q, g]) => `${q}=${g ? 'group' : 'leaf'}`).join(', ')
    fail(
      `${where}: linkId "${linkId}" is a group in one Questionnaire and a leaf in another (${detail}) — ` +
        'AMBIGUOUS, so this gate cannot judge the read. Give the carePlan mappers a canonical→mapper ' +
        'registry, or rename the linkId.',
    )
    return undefined
  }
  return values.values().next().value
}

// --- Mapper call sites ------------------------------------------------------

const PAIR_READER = 'extractPairs'
const LEAF_READERS = new Set(['extractAnswer', 'extractAnswers'])

const mapperFiles = readdirSync(mapperDir)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .filter(f => !['index.ts', 'shared.ts'].includes(f))
  .sort()

if (mapperFiles.length === 0) {
  fail(`no mapper files under ${relative(root, mapperDir)} — nothing was read [treated as a failure]`)
}

let callSites = 0

/** The literal string at `argIndex`, or null when it cannot be resolved. */
function literalArg(call, argIndex) {
  const arg = call.arguments[argIndex]
  return arg && ts.isStringLiteral(arg) ? arg.text : null
}

for (const file of mapperFiles) {
  const source = readFileSync(join(mapperDir, file), 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const rel = `${relative(root, mapperDir)}/${file}`

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const where = `${rel}:${line}`

      if (name === PAIR_READER) {
        callSites += 1
        const [group, fieldA, fieldB] = [1, 2, 3].map(i => literalArg(node, i))
        if (!group || !fieldA || !fieldB) {
          fail(`${where}: ${PAIR_READER}(…) has a non-literal linkId argument this gate cannot resolve — ` +
            'teach the resolver rather than exempting the site [not skipped]')
        } else {
          const g = groupness(group, where)
          if (g === undefined) {
            fail(`${where}: ${PAIR_READER} reads "${group}", which no Questionnaire declares`)
          } else if (!g) {
            fail(`${where}: ${PAIR_READER} reads "${group}" as a repeating group, but the Questionnaire ` +
              'declares it a leaf question — the pair fields would never be found')
          }
          for (const field of [fieldA, fieldB]) {
            const fg = groupness(field, where)
            if (fg === undefined) {
              fail(`${where}: ${PAIR_READER} reads field "${field}", which no Questionnaire declares`)
            } else if (fg) {
              fail(`${where}: ${PAIR_READER} reads field "${field}", but it is declared a group, not a leaf`)
            }
          }
        }
      } else if (LEAF_READERS.has(name)) {
        callSites += 1
        const link = literalArg(node, 1)
        if (!link) {
          fail(`${where}: ${name}(…) has a non-literal linkId argument this gate cannot resolve — ` +
            'teach the resolver rather than exempting the site [not skipped]')
        } else {
          const g = groupness(link, where)
          if (g === undefined) {
            fail(`${where}: ${name} reads "${link}", which no Questionnaire declares`)
          } else if (g) {
            fail(`${where}: ${name} reads "${link}", but the Questionnaire declares it a GROUP. ` +
              'A leaf reader returns nothing for a group — read its children, or use extractPairs.')
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

if (callSites === 0) {
  fail('no reader call sites found in any carePlan mapper — the scan read nothing [treated as a failure]')
}

// --- Report -----------------------------------------------------------------
if (failures) {
  console.error(`\ncarePlan-reader check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ check:careplan-readers: ${callSites} reader call site(s) across ${mapperFiles.length} mapper(s) ` +
    `agree with ${questionnaireCount} Questionnaire(s).`,
)
