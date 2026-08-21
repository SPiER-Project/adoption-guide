#!/usr/bin/env node
/**
 * Anti-drift check: does each observation mapper read an answer the way its
 * Questionnaire declares it?
 *
 * ── Why this exists (issue #327) ─────────────────────────────
 *
 * Every C-SSRS mapper, and CAMS Section B, read `answer.valueBoolean`. Not one
 * SPiER Questionnaire declares a `boolean` item — each yes/no question is
 * `type: choice` bound to SNOMED Yes (373066001) / No (373067005). So a screener
 * filled in through SPiER's own form read `undefined` for every item, and the
 * risk ladders treat `undefined` as "not endorsed": a patient endorsing q5,
 * "specific plan and intent", derived `tier: none` / "No risk identified".
 *
 * Nothing caught it, and each existing gate had a principled reason not to:
 * the mappers' unit tests built `valueBoolean` responses, so they certified the
 * mappers against input the app never produces; `check:scenarios:responses`
 * does validate `value[x]` against `item.type`, but no scenario fixture carried
 * one of these forms *with items*; and the #230 foreign-payload path normalizes
 * to `valueBoolean` on purpose, so a foreign C-SSRS derived the right tier while
 * a native one did not.
 *
 * Those are all instance-level fixes (and both have landed). This is the
 * class-level one: it reads the mapper source, resolves which linkId each
 * `walkItems` read names and which reader is applied to it, and checks that
 * reader against the item's **declared type** in the Questionnaire. It needs no
 * test to have been written and no fixture to exist.
 *
 * ── What it asserts ──────────────────────────────────────────
 *
 *  1. every mapper file under packages/core/src/lib/observationMappers is either registered
 *     in `MAPPER_BY_QUESTIONNAIRE_URL` or reachable from one that is;
 *  2. every linkId a mapper reads exists in at least one Questionnaire it serves
 *     (a renamed item otherwise reads `undefined` forever, in silence);
 *  3. the reader applied to it is legal for that item's declared `type` — with
 *     `getYesNoBoolean` additionally requiring that a `choice` item really is
 *     bound to the SNOMED Yes/No pair.
 *
 * ── What it does NOT do ──────────────────────────────────────
 *
 * It resolves linkIds statically, so it understands the forms this codebase
 * uses (a literal, a `for…of` over a code table, a `.reduce` over a list of
 * literals, a helper parameter fed by literal call sites) and **fails on
 * anything else** rather than skipping it. A silent skip is how a gate reports
 * green while checking nothing (#232, #261) — an unreadable read is an error
 * here, and the fix is to teach the resolver, not to exempt the site.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..')
const mapperDir = join(root, 'packages/core/src/lib/observationMappers')
const questionnaireDirs = [join(root, 'FHIR-Resources'), join(root, 'packages/fhir-artifacts/generated')]

const SNOMED = 'http://snomed.info/sct'
const SNOMED_YES = '373066001'
const SNOMED_NO = '373067005'

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

/**
 * Reader → the Questionnaire `item.type`s it can legally read.
 *
 * `getYesNoBoolean` is the one with a side condition: on a `choice` item it also
 * requires the SNOMED Yes/No answerOption pair, because reading a five-point
 * severity scale as yes/no is the same defect wearing different clothes.
 */
const READERS = {
  getYesNoBoolean: { types: ['boolean', 'choice'], yesNoChoice: true },
  getCodingAnswer: { types: ['choice', 'open-choice'] },
  valueCoding: { types: ['choice', 'open-choice'] },
  valueBoolean: { types: ['boolean'] },
  valueInteger: { types: ['integer'] },
  valueDecimal: { types: ['decimal'] },
  valueString: { types: ['string', 'text', 'open-choice'] },
  valueDate: { types: ['date'] },
  valueDateTime: { types: ['dateTime'] },
}

// ── Questionnaires ─────────────────────────────────────────────────────────
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

const questionnaireByUrl = new Map()
for (const dir of questionnaireDirs) {
  for (const file of walkJson(dir)) {
    let json
    try {
      json = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    if (json?.resourceType !== 'Questionnaire' || !json.url) continue
    const url = json.url.split('|')[0]
    if (!questionnaireByUrl.has(url)) questionnaireByUrl.set(url, json)
  }
}

function findItem(items, linkId) {
  for (const item of items ?? []) {
    if (item.linkId === linkId) return item
    const nested = findItem(item.item, linkId)
    if (nested) return nested
  }
  return undefined
}

// ── Which Questionnaire(s) does each mapper file serve? ────────────────────
const indexSrc = readFileSync(join(mapperDir, 'index.ts'), 'utf8')

/** `import { mapX, mapY } from './file'` → symbol → file */
const fileForSymbol = new Map()
for (const m of indexSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([\w-]+)'/g)) {
  for (const sym of m[1].split(',').map(s => s.trim().replace(/^type\s+/, '')).filter(Boolean)) {
    fileForSymbol.set(sym, `${m[2]}.ts`)
  }
}

/** `[`${SPIER_Q}/Slug`]: mapX,` → file → canonical URLs */
const canonicalsForFile = new Map()
const SPIER_Q = 'http://spier.org/Questionnaire'
for (const m of indexSrc.matchAll(/\[`\$\{SPIER_Q\}\/([^`]+)`\]:\s*(\w+)/g)) {
  const url = `${SPIER_Q}/${m[1]}`
  const file = fileForSymbol.get(m[2])
  if (!file) {
    fail(`index.ts maps ${url} to ${m[2]}, which is not imported from a sibling module`)
    continue
  }
  if (!questionnaireByUrl.has(url)) {
    fail(`index.ts maps ${url}, for which no Questionnaire JSON was found`)
    continue
  }
  canonicalsForFile.set(file, [...(canonicalsForFile.get(file) ?? []), url])
}

const mapperFiles = readdirSync(mapperDir)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .filter(f => !['index.ts', 'shared.ts', 'fallbackDispatch.ts'].includes(f))
  .sort()

/**
 * A delegating mapper (cssrsPediatric → mapCSSRSScreenerCore) does its reading
 * in the file it imports, so that file's reads are checked against the
 * delegator's Questionnaire too. Since-Last-Contact, for instance, asks no
 * `q6-recent` — so a linkId must exist in *one* of the forms a file serves, and
 * is type-checked against each form that declares it.
 */
const sources = new Map(mapperFiles.map(f => [f, readFileSync(join(mapperDir, f), 'utf8')]))
let grew = true
while (grew) {
  grew = false
  for (const [file, src] of sources) {
    const mine = canonicalsForFile.get(file) ?? []
    if (mine.length === 0) continue
    for (const m of src.matchAll(/from\s*'\.\/([\w-]+)'/g)) {
      const target = `${m[1]}.ts`
      if (!sources.has(target)) continue
      const theirs = canonicalsForFile.get(target) ?? []
      const merged = [...new Set([...theirs, ...mine])]
      if (merged.length !== theirs.length) {
        canonicalsForFile.set(target, merged)
        grew = true
      }
    }
  }
}

for (const file of mapperFiles) {
  if (!canonicalsForFile.get(file)?.length) {
    fail(`${file} is a mapper but serves no Questionnaire — register it in MAPPER_BY_QUESTIONNAIRE_URL (index.ts)`)
  }
}

// ── Static resolution of `walkItems(items, <expr>)` ────────────────────────
const isWalkItems = (node) =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'walkItems'

function stringsOfArray(node) {
  if (!node || !ts.isArrayLiteralExpression(node)) return undefined
  const out = []
  for (const el of node.elements) {
    if (!ts.isStringLiteral(el)) return undefined
    out.push(el.text)
  }
  return out
}

function propsOfObjectArray(node, prop) {
  if (!node || !ts.isArrayLiteralExpression(node)) return undefined
  const out = []
  for (const el of node.elements) {
    if (!ts.isObjectLiteralExpression(el)) return undefined
    const match = el.properties.find(p =>
      ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === prop)
    if (!match || !ts.isStringLiteral(match.initializer)) return undefined
    out.push(match.initializer.text)
  }
  return out
}

/** Every `const <name> = […]` / parameter default in the file, by name. */
function collectArrays(sourceFile) {
  const arrays = new Map()
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let init = node.initializer
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression
      if (ts.isArrayLiteralExpression(init)) arrays.set(node.name.text, init)
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer && ts.isIdentifier(node.initializer)) {
      // `itemCodes: CSSRSItemCoding[] = CSSRS_SCREENER_ITEM_CODES`
      const target = arrays.get(node.initializer.text)
      if (target) arrays.set(node.name.text, target)
    }
    ts.forEachChild(node, visit)
  }
  // Two passes: a parameter default can name a const declared above or below it.
  ts.forEachChild(sourceFile, visit)
  ts.forEachChild(sourceFile, visit)
  return arrays
}

/** The `for…of` / `.reduce(…)` / function binding that introduced `name`, if any. */
function findBinder(node, name) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isForOfStatement(n)) {
      const decl = n.initializer.declarations?.[0]
      if (!decl) continue
      if (ts.isIdentifier(decl.name) && decl.name.text === name) {
        return { kind: 'forOf-element', iterable: n.expression }
      }
      if (ts.isObjectBindingPattern(decl.name) &&
          decl.name.elements.some(e => ts.isIdentifier(e.name) && e.name.text === name)) {
        return { kind: 'forOf-prop', iterable: n.expression, prop: name }
      }
    }
    if ((ts.isArrowFunction(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) &&
        n.parameters.some(p => ts.isIdentifier(p.name) && p.name.text === name)) {
      if (ts.isCallExpression(n.parent) && ts.isPropertyAccessExpression(n.parent.expression)) {
        return { kind: 'callback', iterable: n.parent.expression.expression }
      }
      return { kind: 'parameter', fn: n, param: name }
    }
  }
  return undefined
}

function resolveIterable(expr, arrays) {
  if (ts.isArrayLiteralExpression(expr)) return expr
  if (ts.isIdentifier(expr)) return arrays.get(expr.text)
  return undefined
}

/** Literal linkIds a `walkItems` argument can take, or undefined if unreadable. */
function resolveLinkIds(arg, sourceFile, arrays) {
  if (ts.isStringLiteral(arg)) return [arg.text]

  if (ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression)) {
    // `vital.linkId` / `driver.descLinkId`
    const binder = findBinder(arg, arg.expression.text)
    if (binder?.kind === 'forOf-element') {
      const arr = resolveIterable(binder.iterable, arrays)
      return propsOfObjectArray(arr, arg.name.text)
    }
    return undefined
  }

  if (!ts.isIdentifier(arg)) return undefined
  const name = arg.text

  const binder = findBinder(arg, name)
  if (binder?.kind === 'forOf-prop') {
    return propsOfObjectArray(resolveIterable(binder.iterable, arrays), binder.prop)
  }
  if (binder?.kind === 'forOf-element' || binder?.kind === 'callback') {
    return stringsOfArray(resolveIterable(binder.iterable, arrays))
  }
  if (binder?.kind === 'parameter') {
    // A helper such as safet.ts's `textAnswer(items, linkId)`: the linkIds are
    // the literals its call sites pass.
    const fnName = ts.isFunctionDeclaration(binder.fn) && binder.fn.name
      ? binder.fn.name.text
      : ts.isVariableDeclaration(binder.fn.parent) && ts.isIdentifier(binder.fn.parent.name)
      ? binder.fn.parent.name.text
      : undefined
    if (!fnName) return undefined
    const index = binder.fn.parameters.findIndex(p => ts.isIdentifier(p.name) && p.name.text === name)
    const found = []
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === fnName) {
        const a = node.arguments[index]
        if (!a || !ts.isStringLiteral(a)) {
          found.push(null) // a call site we cannot read — fail rather than skip
        } else {
          found.push(a.text)
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)
    if (found.length === 0 || found.includes(null)) return undefined
    return [...new Set(found)]
  }

  // A plain `const linkId = 'q1'`
  const decl = arrays.get(name)
  if (decl) return stringsOfArray(decl)
  return undefined
}

/** The reader applied to a `walkItems(…)` result: a `getX` call or a `value[x]`. */
function readersFor(call, sourceFile) {
  const fromChain = (start) => {
    let node = start
    for (let p = node.parent; p; node = p, p = p.parent) {
      if (ts.isNonNullExpression(p) || ts.isParenthesizedExpression(p)) continue
      if (ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p)) {
        const name = ts.isPropertyAccessExpression(p) ? p.name.text : undefined
        if (name && name in READERS) return [name]
        continue
      }
      break
    }
    return []
  }

  // 1. `getYesNoBoolean(walkItems(...))`
  const parent = call.parent
  if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text in READERS) {
    return [parent.expression.text]
  }
  // 2. `walkItems(...)?.answer?.[0]?.valueInteger`
  const chained = fromChain(call)
  if (chained.length) return chained

  // 3. `const it = walkItems(...)` — find what the binding is read with.
  let decl = call.parent
  while (decl && (ts.isNonNullExpression(decl) || ts.isParenthesizedExpression(decl))) decl = decl.parent
  if (decl && ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
    const bound = decl.name.text
    const found = new Set()
    const visit = (node) => {
      if (ts.isIdentifier(node) && node.text === bound && node !== decl.name) {
        if (ts.isCallExpression(node.parent) && ts.isIdentifier(node.parent.expression) &&
            node.parent.expression.text in READERS) {
          found.add(node.parent.expression.text)
        } else {
          for (const r of fromChain(node)) found.add(r)
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)
    return [...found]
  }
  return []
}

// ── Check every read ───────────────────────────────────────────────────────
/**
 * Does this `choice` item offer the SNOMED Yes/No pair `getYesNoBoolean` decodes?
 *
 * Containment, not equality — PSS-3 offers the pair **plus** `unable-to-complete`
 * and `patient-refused`, and that is correct: `getYesNoBoolean` returns
 * `undefined` for a non-response, and `pss3.ts` compares `=== true` so a refusal
 * never counts as a "No". What this rule exists to catch is a yes/no reader
 * pointed at an item that offers no yes/no at all — a severity scale, a
 * disposition list — where every read would be `undefined` forever.
 */
const yesNoBound = (item) => {
  const codes = (item.answerOption ?? []).map(o => o.valueCoding)
  return codes.some(c => c?.system === SNOMED && c?.code === SNOMED_YES) &&
    codes.some(c => c?.system === SNOMED && c?.code === SNOMED_NO)
}

let totalReads = 0
for (const file of mapperFiles) {
  const canonicals = canonicalsForFile.get(file) ?? []
  if (!canonicals.length) continue
  const src = sources.get(file)
  const sourceFile = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)
  const arrays = collectArrays(sourceFile)
  let checked = 0

  const visit = (node) => {
    if (isWalkItems(node)) {
      const where = `${file}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
      const linkIds = resolveLinkIds(node.arguments[1], sourceFile, arrays)
      const readers = readersFor(node, sourceFile)

      if (!linkIds) {
        fail(`${where}: cannot statically resolve the linkId of this walkItems() read. ` +
          `Teach scripts/check-mapper-readers.mjs the form, or use a literal — an unreadable read is a hole in the gate.`)
      } else if (!readers.length) {
        fail(`${where}: cannot tell which reader is applied to walkItems(…, ${linkIds.join('/')}). ` +
          `Teach scripts/check-mapper-readers.mjs the form rather than leaving the read unchecked.`)
      } else {
        for (const linkId of linkIds) {
          const declaring = canonicals
            .map(url => ({ url, item: findItem(questionnaireByUrl.get(url)?.item, linkId) }))
            .filter(entry => entry.item)
          if (!declaring.length) {
            fail(`${where}: reads linkId '${linkId}', which none of ${canonicals.join(', ')} declares`)
            continue
          }
          for (const { url, item } of declaring) {
            for (const reader of readers) {
              const rule = READERS[reader]
              if (!rule.types.includes(item.type)) {
                fail(`${where}: ${reader} on '${linkId}', declared as type '${item.type}' in ${url} ` +
                  `(${reader} reads ${rule.types.join(' | ')}). This is #327: the answer reads undefined at runtime.`)
              } else if (rule.yesNoChoice && item.type === 'choice' && !yesNoBound(item)) {
                fail(`${where}: ${reader} on '${linkId}' in ${url}, whose answerOption is not the SNOMED ` +
                  `Yes/No pair (${SNOMED_YES}/${SNOMED_NO}) — it cannot resolve to a boolean`)
              }
            }
          }
          checked++
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sourceFile, visit)
  totalReads += checked
  console.log(`✓ ${relative(webRoot, join(mapperDir, file))}: ${checked} read(s) checked against ${canonicals.length} Questionnaire(s)`)
}

console.log(`\n${totalReads} answer read(s) checked across ${mapperFiles.length} mapper(s) and ${questionnaireByUrl.size} Questionnaire(s).`)
if (failures > 0) {
  console.error(`\nmapper-reader check FAILED with ${failures} problem(s).`)
  process.exit(1)
}
console.log('mapper-reader check passed.')
