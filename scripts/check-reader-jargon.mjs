#!/usr/bin/env node
/**
 * No repo vocabulary in reader copy — the Adoption Guide's strings, and the
 * `documentation` the pathway artifact publishes.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * The mock-EHR UX pass (#461-#463) found the pages explaining how they were
 * BUILT rather than what to do, and fixed it once, there. The guide never got
 * that pass, and the adoption-guide UX audit
 * (docs/plans/adoption-guide-ux-audit-2026-09-20.md §1.3) found the same class
 * across it:
 *
 *   - the CDS Service page named `observationMappers`, `derivePathwayStatus`,
 *     `buildCdsCards`, `packages/core/src/lib/` and `npm run
 *     check:core-boundary` — five pieces of this repo's machinery in two
 *     paragraphs of an implementer's introduction;
 *   - Adoption Readiness explained a missing badge by naming the gate that
 *     makes it impossible;
 *   - the Provider App page dated its own rename, twice;
 *   - the Population Dashboard cited an issue number.
 *
 * ⚠️ **And three of them were in the ARTIFACT.** `documentation[=].display` on
 * PlanDefinition/SPiERSuicideSaferCarePathway said "which is what npm run
 * check:reassessment exists to prevent", pointed at the header of a `.fsh`
 * file, and cited a path under `docs/`. Those strings render on the Care
 * Pathway page AND ship in the published IG, where the reader is an HL7
 * reviewer with no checkout. PR 3 rewrote them; nothing stopped the next one.
 *
 * ── Why no other gate saw it ──────────────────────────────────────────────
 *
 * `check:fhir-render` is the closest relative and reads the same JSX: it asks
 * whether a RECORDER's words name a resource type, profile or element path,
 * on the clinical surface, where raw FHIR is forbidden. Its subject is the
 * wire format and its tree is `packages/tool-views`. Repo machinery is not the
 * wire format, and the guide is not a recorder — so every string above sat
 * outside it by construction. Nothing else reads reader strings at all.
 *
 * ── What counts as a reader string ────────────────────────────────────────
 *
 * Parsed, not grepped, because the alternative was tried: a line scan reads a
 * comment quoting a gate name as reader copy, and blanking `{…}` to find JSX
 * text blanks every element returned from a `.map()` callback — which is most
 * of this app. The walk (`ts.ScriptKind.TSX`, the shape `check:fhir-render`
 * established) collects, per module under `apps/guide/src`:
 *
 *   - every `JsxText` node — the words on the page, `<code>` included, since
 *     that is exactly where a function name gets quoted at a reader;
 *   - every string and template literal that is not in a position the reader
 *     never sees: an import specifier, a `throw new Error()` argument, a
 *     code-ish JSX attribute (`className`, `to`, `id`, …), a code-ish object
 *     property (`path`, `href`, `system`, `code`, …), or a bare path, URL or
 *     fragment.
 *
 * The exclusions are a DENY list on purpose. An allow list of "reader-facing"
 * positions would silently drop a string the day someone renders prose from a
 * new property, and dropping input is the failure this repo's gates keep
 * finding in themselves. Over-reading costs a false positive, which is loud.
 *
 * Plus, from `ig/input/fsh/*.fsh`, every `documentation[…].label` and
 * `documentation[…].display` — the artifact's own prose, rendered by the guide
 * and published in the IG.
 *
 * ── The seven rules, and where each came from ─────────────────────────────
 *
 *   an npm script      `npm run copy-fhir`      — the pathway load error, §1.2
 *   a gate name        `check:reassessment`     — the artifact, §1.3
 *   a repo path        `packages/core/src/lib/` — the CDS page, §1.3
 *   a source file      `suicide-related-conditions.fsh` — the artifact, §1.3
 *   a repo identifier  `buildCdsCards`          — the CDS page, §1.3
 *   an issue number    `(#64)`, `issue #401`    — licensing.ts, the dashboard
 *   a repo date        `until 2026-09-17`       — the Provider App page, §1.3
 *
 * ⚠️ **"A repo identifier" means one this repo DEFINES, checked against an
 * index of its own exports, file names and directory names — not "any
 * camelCase word".** The shape rule was written first and was wrong in both
 * directions at once: it fired on `localStorage`, `hookInstance` and
 * `patientId` (a browser API and two CDS Hooks wire fields, all legitimately
 * shown to an implementer) while proving nothing about the tokens it did
 * catch. The index makes the rule mean what its name says, and it grows with
 * the repo rather than with this file.
 *
 * ── What it cannot see ────────────────────────────────────────────────────
 *
 * ⚠️ **The 29 shared tool views.** `packages/tool-views` renders on guide tool
 * pages, so its strings reach a guide reader, and a scan of that tree finds
 * five issue numbers, a rename date and an identifier in drawer prose today.
 * They are out of this gate's subject because they are equally the CLINICIAN's
 * copy, where the audit's rule has not been applied and where three of the
 * nine hits are `throw new Error()` messages a reader never meets. Widening
 * this gate is the right move AFTER that copy pass, not before it.
 *
 * ⚠️ **The rest of the FSH.** `Description` and `copyright` are published too,
 * and carry `docs/instruments/…/MEMO.md` citations, a `web/src/…` path that
 * has not existed since #553, and `issue #64` roughly fifteen times. Those are
 * provenance for a licensing claim rather than an explanation of a page, which
 * is a different argument to have; `documentation` is what the audit named and
 * what the guide renders.
 *
 * ⚠️ **Prose that names no machinery and still explains the build.** "It was
 * called the Patient App until 2026-09-17" fails on the date; the same
 * sentence without one would pass and be just as much about this repo. Rule 3
 * is a vocabulary, and a vocabulary catches vocabulary.
 *
 * Exits non-zero on a hit so it can gate CI.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'

import { appRoot, relRepo, REPO_ROOT, walkExt } from './lib/app-roots.mjs'
import { reportFloors } from './lib/floors.mjs'

let failures = 0
function fail(msg) {
  console.error(`✗ ${msg}`)
  failures++
}

// ── The repo's own camelCase identifiers ───────────────────────────────────

/**
 * Trees whose names are "this repo's machinery". `docs/` is absent because a
 * doc's file name is caught by the source-file rule, and `ig/` because a FHIR
 * artifact's file name is too.
 */
const SYMBOL_ROOTS = ['apps', 'packages', 'scripts', 'services', 'shims', 'tests']

/**
 * ⚠️ **Installed and generated trees, which are not "this repo's machinery".**
 * Each Worker under `services/` has its own `node_modules`, so on a machine
 * where they are installed the index went from 454 names to 976 — every
 * camelCase export of every dependency, which would ban `createRoot` or
 * `useSyncExternalStore` from reader copy and mean nothing when it fired.
 * Caught because the gate prints the count on every run and the floor called it
 * out as slack; it would otherwise have depended on whether someone had run
 * `npm install` in a service.
 */
const NOT_OURS = /(?:^|\/)(?:node_modules|dist|dist-[^/]+|fsh-generated|generated|\.wrangler)(?:\/|$)/

/** camelCase with at least one interior capital — `buildCdsCards`, not `tools`. */
const CAMEL = /^[a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*)+$/
const CAMEL_TOKEN = /\b[a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*)+\b/g

/**
 * Every camelCase name this repo defines: exported bindings, plus file and
 * directory names (`observationMappers` is a directory, and was quoted at a
 * reader as one).
 */
function indexRepoIdentifiers() {
  const names = new Set()
  for (const root of SYMBOL_ROOTS) {
    for (const file of walkExt(join(REPO_ROOT, root), ['.ts', '.tsx', '.mjs'])) {
      const rel = relRepo(file)
      if (NOT_OURS.test(rel)) continue
      for (const segment of rel.split('/')) {
        const base = segment.replace(/\.(tsx?|mjs)$/, '')
        if (CAMEL.test(base)) names.add(base)
      }
      const src = readFileSync(file, 'utf8')
      const decl = /\bexport\s+(?:async\s+)?(?:const|let|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g
      for (const m of src.matchAll(decl)) if (CAMEL.test(m[1])) names.add(m[1])
    }
  }
  return names
}

const repoIdentifiers = indexRepoIdentifiers()

// ── The rules ──────────────────────────────────────────────────────────────

const RULES = [
  { name: 'an npm script', re: /\bnpm run [a-z][a-z:-]*/ },
  { name: 'a gate name', re: /\bcheck:[a-z][a-z-]*/ },
  { name: 'a repo path', re: /\b(?:apps|packages|services|scripts|docs|shims|tests|web)\/[A-Za-z0-9._/-]+/ },
  { name: 'a source file', re: /\b[A-Za-z0-9_-]+\.(?:tsx?|mjs|fsh|md)\b/ },
  { name: 'an issue number', re: /(?:^|[\s(])#\d{2,4}\b/ },
  { name: 'a repo date', re: /\b20\d\d-\d\d-\d\d\b/ },
]

/** The first rule `text` breaks, or null. The identifier rule is last: it needs the index. */
function jargonIn(text) {
  for (const rule of RULES) {
    const m = rule.re.exec(text)
    if (m) return { rule: rule.name, match: m[0].trim() }
  }
  for (const m of text.matchAll(CAMEL_TOKEN)) {
    if (repoIdentifiers.has(m[0])) return { rule: 'a repo identifier', match: m[0] }
  }
  return null
}

// ── Half one: the guide's reader strings ───────────────────────────────────

/** JSX attributes whose value is a class, a route or a DOM hook — never prose. */
const CODE_ATTRS = new Set([
  'className', 'to', 'href', 'id', 'key', 'htmlFor', 'type', 'role', 'rel',
  'target', 'name', 'src', 'value', 'pattern', 'style',
])

/** Object properties holding the same kinds of value. */
const CODE_KEYS = new Set([
  'path', 'href', 'to', 'id', 'key', 'slug', 'className', 'icon', 'kind',
  'group', 'width', 'system', 'code', 'url', 'canonical', 'profile', 'anchor',
])

/** A bare path, URL, hash or package specifier is not a sentence. */
const NOT_PROSE = /^(?:https?:|\/|\.{1,2}\/|#|@|data:|mailto:)/

/**
 * Every string a reader of this module could meet.
 *
 * @returns {{line: number, text: string}[]}
 */
function readerStrings(rel, src) {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out = []
  let sawJsx = false

  const push = (node, raw) => {
    const text = raw.replace(/\s+/g, ' ').trim()
    if (!text || !/[a-zA-Z]/.test(text) || NOT_PROSE.test(text)) return
    out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text })
  }

  const walk = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) sawJsx = true
    // Never rendered: the module graph, and a message only a developer reads.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isNewExpression(node) && /Error$/.test(node.expression.getText(sf))) return
    if (ts.isJsxText(node)) return push(node, node.getText(sf))
    if (ts.isJsxAttribute(node)) {
      if (CODE_ATTRS.has(node.name.getText(sf))) return
      return ts.forEachChild(node, walk)
    }
    if (ts.isPropertyAssignment(node) && CODE_KEYS.has(node.name.getText(sf).replace(/['"]/g, ''))) return
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return push(node, node.text)
    if (ts.isTemplateExpression(node)) {
      // The literal halves are prose; the `${…}` halves are code, and walked as such.
      push(node.head, node.head.text)
      for (const span of node.templateSpans) {
        push(span.literal, span.literal.text)
        walk(span.expression)
      }
      return
    }
    ts.forEachChild(node, walk)
  }

  walk(sf)
  return { runs: out, sawJsx }
}

const GUIDE_SRC = appRoot('apps/guide/src')
const guideFiles = walkExt(GUIDE_SRC, ['.ts', '.tsx']).filter((f) => !/\.test\.tsx?$/.test(f))

let guideStrings = 0
let guideHits = 0
for (const file of guideFiles) {
  const rel = relRepo(file)
  const { runs, sawJsx } = readerStrings(rel, readFileSync(file, 'utf8'))
  // A page module that parsed to no JSX is a parse that stopped reading.
  if (rel.includes('/pages/') && !sawJsx) {
    fail(`${rel}: the parser found no JSX in a page module — this gate has stopped reading it`)
  }
  guideStrings += runs.length
  for (const run of runs) {
    const hit = jargonIn(run.text)
    if (!hit) continue
    guideHits++
    fail(
      `${rel}:${run.line} names ${hit.rule} in reader copy — "${hit.match}"\n` +
        `    …${run.text.slice(0, 120)}${run.text.length > 120 ? '…' : ''}\n` +
        `    A reader of the Adoption Guide has no checkout. Say what the thing DOES, not what\n` +
        `    builds it (audit §5 rule 3). The wire format belongs in a code drawer or a JSON viewer.`,
    )
  }
}

// ── Half two: what the artifact publishes ──────────────────────────────────

const FSH_DIR = join(REPO_ROOT, 'ig/input/fsh')
const fshFiles = walkExt(FSH_DIR, ['.fsh'])
const DOC_STRING = /^\s*\*?\s*documentation\[[^\]]*\]\.(label|display)\s*=\s*"((?:[^"\\]|\\.)*)"/

let fshStrings = 0
let fshHits = 0
for (const file of fshFiles) {
  const rel = relRepo(file)
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const m = DOC_STRING.exec(line)
    if (!m) return
    fshStrings++
    const text = m[2].replace(/\\"/g, '"')
    const hit = jargonIn(text)
    if (!hit) return
    fshHits++
    fail(
      `${rel}:${i + 1} names ${hit.rule} in documentation.${m[1]} — "${hit.match}"\n` +
        `    …${text.slice(0, 120)}${text.length > 120 ? '…' : ''}\n` +
        `    This string renders on /guide/pathway AND ships in the published IG, where the reader\n` +
        `    is an HL7 reviewer with no checkout. State the clinical claim (audit §5 rule 3).`,
    )
  })
}

// ── Liveness ───────────────────────────────────────────────────────────────

/**
 * Halved and rounded down from the live counts on the day this landed:
 * 30 guide modules / 835 reader strings, 48 documentation strings, 454
 * identifiers. Per source AND per dimension, per lib/floors.mjs rule 1.
 */
const floorsHeld = reportFloors(
  [
    { source: 'apps/guide/src', dimension: 'module(s) parsed', actual: guideFiles.length, floor: 15 },
    { source: 'apps/guide/src', dimension: 'reader string(s)', actual: guideStrings, floor: 400 },
    { source: 'ig/input/fsh', dimension: 'documentation string(s)', actual: fshStrings, floor: 24 },
    { source: 'the repo', dimension: 'camelCase identifier(s) indexed', actual: repoIdentifiers.size, floor: 200 },
  ],
  fail,
)

if (failures === 0 && floorsHeld) {
  console.log(
    `✓ no repo vocabulary in reader copy: ${guideStrings} reader string(s) across ` +
      `${guideFiles.length} Adoption Guide module(s) and ${fshStrings} documentation string(s) in ` +
      `${fshFiles.length} FSH file(s), against ${RULES.length + 1} rules ` +
      `(${repoIdentifiers.size} repo identifiers indexed)`,
  )
  process.exit(0)
}

console.error(
  `\n✗ ${guideHits} reader string(s) and ${fshHits} documentation string(s) name this repo's machinery.`,
)
process.exit(1)
