#!/usr/bin/env node
/**
 * Anti-drift check for the demo registry's hand-authored QuestionnaireResponses.
 *
 * `packages/demo-population/src/scenarios/patient-*.json` carries QuestionnaireResponse
 * resources written by hand. They drive the Population and chart views and are fed
 * to the observation mappers, but nothing validated them against the Questionnaire
 * they claim to answer — so a renamed linkId, a regrouped item, an answer code that
 * is not one of the offered options, or an out-of-range rating all landed silently.
 *
 * `scripts/validate-fhir.mjs` (the HL7 validator gate) has unwrapped these since
 * #414 and checks them in full — but only in `ig.yml`, path-filtered and with
 * Java. This is the offline half that runs in every `npm run verify`.
 *
 * For every entry in every scenario's `responses` bucket, this asserts:
 *   0. the entry's `resource` IS a QuestionnaireResponse. An entry that is not
 *      used to be skipped, so a `resourceType` typo dropped the response from this
 *      gate, from the patient-link check and from the runtime emitter at once,
 *      and the patient silently lost an instrument result with everything green.
 *   1. `resource.questionnaire` resolves (version-stripped) to a canonical
 *      Questionnaire JSON,
 *   2. every answered linkId exists in that Questionnaire,
 *   3. each item sits under the same parent chain as in the Questionnaire — the
 *      failure the CAMS Section A scenarios actually had, flattening six
 *      per-construct groups into one. Items nested under `answer[].item` are
 *      walked too, and their chain must match the Questionnaire's like any
 *      other: R4 nests a QUESTION item's children under its answer, so such an
 *      item is legal only where the Questionnaire gives a non-group item
 *      children. None does today, so any answer-nested item fails.
 *   4. answers to an item offering `answerOption`s are one of those options —
 *      coded, and NOT a valueString / valueInteger smuggled past the option
 *      list (R4: "if answerOption is present, answer must be one of them"),
 *   5. integer answers respect the item's `minValue` / `maxValue` extensions, and
 *   6. the answer's value[x] type agrees with `item.type`.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const scenariosDir = join(root, 'packages/demo-population/src/scenarios')
const questionnaireDirs = [join(root, 'ig/input/resources/questionnaires'), join(root, 'packages/fhir-artifacts/generated')]

const MIN_VALUE_EXT = 'http://hl7.org/fhir/StructureDefinition/minValue'
const MAX_VALUE_EXT = 'http://hl7.org/fhir/StructureDefinition/maxValue'

/** R4 Questionnaire.item.type → the answer.value[x] key(s) it permits. */
const ALLOWED_VALUE_KEYS = {
  boolean: ['valueBoolean'],
  decimal: ['valueDecimal'],
  integer: ['valueInteger'],
  date: ['valueDate'],
  dateTime: ['valueDateTime'],
  time: ['valueTime'],
  string: ['valueString'],
  text: ['valueString'],
  url: ['valueUri'],
  choice: ['valueCoding', 'valueString', 'valueInteger', 'valueDate', 'valueTime'],
  'open-choice': ['valueCoding', 'valueString'],
  attachment: ['valueAttachment'],
  reference: ['valueReference'],
  quantity: ['valueQuantity'],
}

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

const stripVersion = (canonical) => {
  const pipe = canonical.indexOf('|')
  return pipe === -1 ? canonical : canonical.slice(0, pipe)
}

// --- Index every canonical Questionnaire by url ----------------------------
function* walkJson(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return // packages/fhir-artifacts/generated/ is a build artifact; absent on a clean checkout
  }
  for (const entry of entries.sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walkJson(full)
    else if (entry.endsWith('.json')) yield full
  }
}

/** url → { file, itemsByLinkId: Map(linkId → { item, parents: string[] }) } */
const questionnaires = new Map()

function indexItems(items, parents, into, file) {
  for (const item of items ?? []) {
    if (typeof item.linkId !== 'string') continue
    if (into.has(item.linkId)) {
      fail(`${file}: duplicate linkId '${item.linkId}' in the Questionnaire itself`)
    }
    into.set(item.linkId, { item, parents })
    indexItems(item.item, [...parents, item.linkId], into, file)
  }
}

for (const dir of questionnaireDirs) {
  for (const full of walkJson(dir)) {
    let json
    try {
      json = JSON.parse(readFileSync(full, 'utf8'))
    } catch (err) {
      fail(`${relative(root, full)}: not parseable JSON — ${err.message}`)
      continue
    }
    if (json?.resourceType !== 'Questionnaire' || typeof json.url !== 'string') continue
    const itemsByLinkId = new Map()
    indexItems(json.item, [], itemsByLinkId, relative(root, full))
    questionnaires.set(stripVersion(json.url), {
      file: relative(root, full),
      itemsByLinkId,
    })
  }
}

if (questionnaires.size === 0) {
  console.error('✗ no canonical Questionnaires found — is ig/input/resources/questionnaires/ present?')
  process.exit(1)
}

// --- Validate each scenario response --------------------------------------
const codingKey = (c) => `${c?.system ?? ''}|${c?.code ?? ''}`

/**
 * Walk a QuestionnaireResponse's items, yielding each with its parent chain and
 * whether it was reached through an answer.
 *
 * ⚠️ `answer[].item` is walked too. It used not to be, so an item placed under an
 * answer was never looked at — not its linkId, not its place, not its value.
 */
function* responseItems(items, parents = [], underAnswer = false) {
  for (const item of items ?? []) {
    yield { item, parents, underAnswer }
    yield* responseItems(item.item, [...parents, item.linkId], false)
    for (const answer of Array.isArray(item.answer) ? item.answer : []) {
      yield* responseItems(answer?.item, [...parents, item.linkId], true)
    }
  }
}

function checkAnswer(answer, defn, where) {
  const valueKeys = Object.keys(answer).filter((k) => k.startsWith('value'))
  if (valueKeys.length === 0) return // an answer carrying only nested items is legal
  const allowed = ALLOWED_VALUE_KEYS[defn.type]
  if (!allowed) {
    fail(`${where}: item.type '${defn.type}' cannot carry an answer`)
    return
  }
  for (const key of valueKeys) {
    if (!allowed.includes(key)) {
      fail(`${where}: ${key} is not valid for item.type '${defn.type}' (expected ${allowed.join(' | ')})`)
      continue
    }

    // Rule 4. An item that offers answerOptions takes one of them. The check
    // used to run for `valueCoding` only, so a `valueString: "Maybe"` on a
    // coded yes/no item passed — `choice` permits valueString in general, but
    // not when the options on offer are Codings. `open-choice` is the one
    // exception R4 makes: free text is its point, so a valueString there is
    // legal whatever the options are.
    const options = Array.isArray(defn.answerOption) ? defn.answerOption : []
    const freeTextAllowed = defn.type === 'open-choice' && key === 'valueString'
    if (options.length > 0 && !freeTextAllowed) {
      const sameKind = options.filter((o) => o[key] !== undefined)
      const matches =
        key === 'valueCoding'
          ? sameKind.some((o) => codingKey(o.valueCoding) === codingKey(answer.valueCoding))
          : sameKind.some((o) => o[key] === answer[key])
      if (!matches) {
        const shown =
          key === 'valueCoding'
            ? `${answer.valueCoding?.system ?? ''}#${answer.valueCoding?.code ?? ''}`
            : `${key} ${JSON.stringify(answer[key])}`
        fail(
          `${where}: answer ${shown} is not one of the item's ${options.length} answerOption(s)` +
            (sameKind.length === 0 ? ` (none of which is a ${key})` : ''),
        )
      }
    }

    if (key === 'valueInteger') {
      const min = defn.extension?.find((e) => e.url === MIN_VALUE_EXT)?.valueInteger
      const max = defn.extension?.find((e) => e.url === MAX_VALUE_EXT)?.valueInteger
      if (min !== undefined && answer.valueInteger < min) {
        fail(`${where}: ${answer.valueInteger} is below the item's minValue of ${min}`)
      }
      if (max !== undefined && answer.valueInteger > max) {
        fail(`${where}: ${answer.valueInteger} is above the item's maxValue of ${max}`)
      }
    }
  }
}

let responsesChecked = 0
let itemsChecked = 0

// ⚠️ A check that reads nothing must fail, not pass. This gate read the
// scenario directory by path and said nothing when the directory was empty —
// so a path change (this file's own move to packages/demo-population, #388)
// would have turned it green while checking zero fixtures. That is the #232 /
// #261 failure mode, and it was confirmed by emptying the directory and
// watching this script exit 0. Do not remove the floor: it is the only thing
// standing between a moved path and a silent pass.
const scenarioFiles = readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort()
if (scenarioFiles.length === 0) {
  console.error(
    `\u2717 no scenario JSON found in ${scenariosDir} — this gate reads that directory, ` +
      'so an empty read would make it pass having checked nothing.',
  )
  process.exit(1)
}

for (const file of scenarioFiles) {
  const scenario = JSON.parse(readFileSync(join(scenariosDir, file), 'utf8'))
  let n = 0

  for (const [i, entry] of (scenario.responses ?? []).entries()) {
    const qr = entry?.resource
    const label = `scenarios/${file} responses[${i}] (${entry?.id ?? 'no id'})`
    // Rule 0 — never skip. This line was a bare `continue`, so a misspelled
    // resourceType took the response out of every check at once.
    if (qr?.resourceType !== 'QuestionnaireResponse') {
      fail(
        `${label}: resource.resourceType is ${JSON.stringify(qr?.resourceType)} — the \`responses\` ` +
          'bucket holds QuestionnaireResponses only, and nothing reads any other type out of it',
      )
      continue
    }
    n++
    responsesChecked++

    const canonical = typeof qr.questionnaire === 'string' ? stripVersion(qr.questionnaire) : undefined
    if (!canonical) {
      fail(`${label}: no questionnaire canonical — nothing to validate against`)
      continue
    }
    const q = questionnaires.get(canonical)
    if (!q) {
      fail(`${label}: questionnaire '${canonical}' does not resolve to any canonical Questionnaire`)
      continue
    }

    for (const { item, parents, underAnswer } of responseItems(qr.item)) {
      if (typeof item.linkId !== 'string') {
        fail(`${label}: an item has no linkId`)
        continue
      }
      itemsChecked++
      const defn = q.itemsByLinkId.get(item.linkId)
      const where = `${label} → ${[...parents, item.linkId].join('/')}`

      if (!defn) {
        fail(`${where}: linkId not found in ${q.file}`)
        continue
      }

      // The parent chain must match. A flattened response still "answers" the
      // right linkIds, so only this catches it.
      const expected = defn.parents.join('/')
      const actual = parents.join('/')
      if (expected !== actual) {
        fail(
          `${where}: wrong place — the Questionnaire nests '${item.linkId}' under ` +
            `${expected || '(root)'}, the response puts it under ${actual || '(root)'}`,
        )
        continue
      }

      // Same chain, right CONTAINER. R4 puts a group's children in `item.item`
      // and a question's children in `answer[].item`, so the Questionnaire
      // parent's type decides which is correct. No Questionnaire here gives a
      // question children today, so every answer-nested item fails.
      const parentDefn = parents.length ? q.itemsByLinkId.get(parents.at(-1))?.item : undefined
      if (parentDefn) {
        const parentIsGroup = parentDefn.type === 'group'
        if (underAnswer && parentIsGroup) {
          fail(
            `${where}: nested under an ANSWER of '${parents.at(-1)}', which is a group — a group's ` +
              'children belong in item.item',
          )
          continue
        }
        if (!underAnswer && !parentIsGroup) {
          fail(
            `${where}: nested in item.item of '${parents.at(-1)}', a ${parentDefn.type} question — ` +
              "a question's children belong under its answer[].item",
          )
          continue
        }
      }

      for (const answer of item.answer ?? []) checkAnswer(answer, defn.item, where)
    }
  }

  if (n > 0) console.log(`✓ scenarios/${file}: ${n} response(s) checked`)
}

console.log(
  `\n${responsesChecked} QuestionnaireResponse(s), ${itemsChecked} item(s) checked against ` +
    `${questionnaires.size} canonical Questionnaire(s).`,
)

if (failures) {
  console.error(`\nscenario-response drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('scenario-response drift check passed.')
