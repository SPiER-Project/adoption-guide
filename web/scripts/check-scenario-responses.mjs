#!/usr/bin/env node
/**
 * Anti-drift check for the demo registry's hand-authored QuestionnaireResponses.
 *
 * `web/src/data/population/scenarios/patient-*.json` carries QuestionnaireResponse
 * resources written by hand. They drive the Population and chart views and are fed
 * to the observation mappers, but nothing validated them against the Questionnaire
 * they claim to answer — so a renamed linkId, a regrouped item, an answer code that
 * is not one of the offered options, or an out-of-range rating all landed silently.
 *
 * `scripts/validate-fhir.mjs` (the HL7 validator gate) does not cover these: the
 * QRs are nested inside a scenario wrapper rather than being standalone resource
 * files, and they are demo fixtures rather than published IG artifacts.
 *
 * For every QuestionnaireResponse in every scenario, this asserts:
 *   1. `resource.questionnaire` resolves (version-stripped) to a canonical
 *      Questionnaire JSON,
 *   2. every answered linkId exists in that Questionnaire,
 *   3. each item sits under the same parent chain as in the Questionnaire — the
 *      failure the CAMS Section A scenarios actually had, flattening six
 *      per-construct groups into one,
 *   4. coded answers are members of the item's `answerOption`,
 *   5. integer answers respect the item's `minValue` / `maxValue` extensions, and
 *   6. the answer's value[x] type agrees with `item.type`.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..')
const scenariosDir = join(webRoot, 'src/data/population/scenarios')
const questionnaireDirs = [join(root, 'FHIR-Resources'), join(webRoot, 'src/data/fhir')]

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
    return // web/src/data/fhir/ is a build artifact; absent on a clean checkout
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
  console.error('✗ no canonical Questionnaires found — is FHIR-Resources/ present?')
  process.exit(1)
}

// --- Validate each scenario response --------------------------------------
const codingKey = (c) => `${c?.system ?? ''}|${c?.code ?? ''}`

/** Walk a QuestionnaireResponse's items, yielding each with its parent chain. */
function* responseItems(items, parents = []) {
  for (const item of items ?? []) {
    yield { item, parents }
    yield* responseItems(item.item, [...parents, item.linkId])
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

    if (key === 'valueCoding' && Array.isArray(defn.answerOption) && defn.answerOption.length > 0) {
      const permitted = new Set(
        defn.answerOption.filter((o) => o.valueCoding).map((o) => codingKey(o.valueCoding)),
      )
      if (permitted.size > 0 && !permitted.has(codingKey(answer.valueCoding))) {
        const { system = '', code = '' } = answer.valueCoding ?? {}
        fail(
          `${where}: answer ${system}#${code} is not one of the item's ${permitted.size} answerOption(s)`,
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

for (const file of readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort()) {
  const scenario = JSON.parse(readFileSync(join(scenariosDir, file), 'utf8'))
  let n = 0

  for (const [i, entry] of (scenario.responses ?? []).entries()) {
    const qr = entry?.resource
    if (qr?.resourceType !== 'QuestionnaireResponse') continue
    n++
    responsesChecked++
    const label = `scenarios/${file} responses[${i}] (${entry.id ?? 'no id'})`

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

    for (const { item, parents } of responseItems(qr.item)) {
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
