#!/usr/bin/env node
/**
 * No repo vocabulary in reader copy — the Adoption Guide's strings and the
 * `documentation` the pathway artifact publishes — and no WIRE vocabulary in
 * the clinician's, across `apps/clinical` and `packages/tool-views`.
 *
 * Two scans, two rule sets, one parser. The guide's reader is an implementer
 * with no checkout; the clinical surface's reader is a clinician with a patient
 * in front of them, and what is wrong in front of each is a different list.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * The mock-EHR UX pass (#461-#463) found the pages explaining how they were
 * BUILT rather than what to do, and fixed it once, there. The guide never got
 * that pass, and the adoption-guide UX audit
 * (docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md §1.3) found the same class
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
 * ⚠️ **The 29 shared tool views were out of the GUIDE's scan, and are in the
 * clinical one** (below). They render on guide tool pages and on
 * `/patient/assessments/*`, so their strings reach both readers; the repo
 * vocabulary a guide reader must not meet there is still unscanned, which is
 * the same argument as before — that copy pass has not happened.
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
import { RESOURCE_TYPES, WIRE_ONLY_RESOURCE_TYPES } from './lib/fhir-vocabulary.mjs'
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

// ── Half three: the clinician's strings ────────────────────────────────────

/**
 * What a clinician may not be shown, and where each rule came from.
 *
 * Clinical-app audit §1.9 measured the clinical surface and found the wire
 * format in the words rather than in the JSON: `QuestionnaireResponse · Sep 3`
 * on every artifact row, `Tier 0 · DocumentReference` under every writeback
 * rung, a canonical URL in monospace leading the protocol page, an issue number
 * as the explanation of an empty measure, `LOINC 93374-7` inside the
 * problem-list card's own sentence. `check:fhir-render` RULE 3 had already
 * settled the rule for the eleven recorders' ledes (`docs/internals/tool-views.md`
 * §4); this is that rule over the rest of the surface.
 *
 *   a FHIR resource type   `QuestionnaireResponse · …`   — every artifact row
 *   a FHIR element path    `Appointment.status`          — a recorder's field help
 *   a LOINC or SNOMED code `LOINC 93374-7`               — the problem-list card
 *   a canonical URL        `http://thespierproject.org/…` — the protocol page
 *   an issue number        `#52`, `(#350)`                — the walkthrough, measures
 *   a tier or rung number  `Tier 0`, `rung 2`             — Saved to the EHR
 *
 * ⚠️ **The rule set is the DIFFERENCE from the guide's, not a superset.** An
 * npm script or a `packages/…` path is just as wrong here, and it is caught by
 * the guide's six rules, which this scan also applies. What it does NOT apply
 * is the repo-identifier rule: `useInspect`, `evaluatePathway` and
 * `stageLeadTools` are this repo's names and they appear in these trees as
 * code, not as words, which is exactly the false-positive class the guide's
 * index was built to avoid — and the deny list below cannot separate them
 * reliably enough in an app tree of this size.
 *
 * ⚠️ **Four positions a reader never sees, beyond the guide scan's.** They are
 * code that happens to be spelled as a string, and every one of them would
 * otherwise fire on `resource.resourceType === 'Observation'`:
 *
 *   - a comparison operand (`=== 'Observation'`) — a discriminator, never prose
 *   - a `switch` case label (`case 'DocumentReference':`) — the same thing
 *   - a type position (`'all' | 'responses'`, `Record<'CarePlan', …>`)
 *   - an argument to a string or collection method (`.replace('CarePlan/', '')`,
 *     `.startsWith`, `.has`, `.get`) — a prefix or a key, never a sentence
 *
 * ⚠️ **What it cannot see.** A resource type not on `RESOURCE_TYPES` (the list
 * is 18 and states its own limit); a string assembled from parts, which is how
 * `${type} · ${status}` would read to it as two harmless halves; and prose that
 * is wrong for a clinician without naming any of these five things — "the
 * denominator excludes them" passes, and it is exactly what the recorder pass
 * had to fix by hand.
 */
const CLINICAL_RULES = [
  {
    name: 'a FHIR resource type',
    // `WIRE_ONLY_…`, not the whole list — see `lib/fhir-vocabulary.mjs` for the
    // eight names that are ordinary English in this copy and why RULE 3 keeps
    // them while this scan does not.
    re: new RegExp(`\\b(?:${WIRE_ONLY_RESOURCE_TYPES.join('|')})\\b`),
  },
  // An element path names the wire format whichever half the type is in.
  { name: 'a FHIR element path', re: new RegExp(`\\b(?:${RESOURCE_TYPES.join('|')})\\.[a-z]\\w*`) },
  { name: 'a SPiER profile name', re: /\bSPiER[A-Z]\w+/ },
  // A LOINC code is digits-dash-digit; SNOMED is 6–18 bare digits, so it is
  // matched only where a word says what it is — a bare "1234567" in clinician
  // copy is a phone number or a total far more often than it is a concept id.
  { name: 'a LOINC code', re: /\b\d{2,6}-\d\b/ },
  { name: 'a SNOMED or LOINC code', re: /\b(?:LOINC|SNOMED|SNOMED CT)\b[^.]{0,20}?\b\d{4,18}\b/i },
  { name: 'a canonical URL', re: /https?:\/\/[^\s"']*\/fhir\/[A-Za-z]/ },
  { name: 'an issue number', re: /(?:^|[\s(])#\d{2,4}\b/ },
  { name: 'a tier or rung number', re: /\b(?:tier|rung)\s+\d\b/i },
]

/**
 * JSX attributes a clinician never meets.
 *
 * ⚠️ **`fhirNote`, `draft` and `draftTitle` are the IMPLEMENTER's half of a
 * recorder, and skipping them is the point rather than a concession.**
 * `docs/internals/tool-views.md` §4 created `fhirNote` precisely so "a
 * ServiceRequest, because `status` models draft → active → completed natively"
 * has somewhere to live; it renders inside `CodeDrawer`, which returns null
 * without inspection. `check:fhir-render` RULE 3 skips the same subtree, and a
 * scan that failed on it would be telling the repo to delete the argument it
 * was just told to keep.
 */
const CLINICAL_CODE_ATTRS = new Set([
  ...CODE_ATTRS, 'data-testid', 'aria-controls', 'fhirNote', 'draft', 'draftTitle',
])

/**
 * JSX elements whose whole subtree is gated on inspection.
 *
 * `CodeDrawer` and `FhirJsonViewer` self-gate on `useInspect()`; a title like
 * "Live FHIR QuestionnaireResponse" inside one is addressed to the implementer
 * reading a guide tool page, which is the only surface where it renders.
 */
const INSPECTION_ONLY_ELEMENTS = new Set(['CodeDrawer', 'FhirJsonViewer', 'PathwayCodeDrawer'])

/**
 * A composite identifier, not a sentence: no whitespace and a `/` in it —
 * `SPiERFollowUpTimeliness/follow-up-within-7-days`, a measure-criterion key.
 *
 * ⚠️ Narrow on purpose. A BARE resource type with no slash (`'Observation'` as
 * a fallback display name) is exactly the defect §1.9's first row was, so it
 * must keep reaching the rules.
 */
const COMPOSITE_ID = /^\S*\/\S*$/

/**
 * Phrases in which a resource type is an instrument's own published name.
 *
 * ⚠️ **Empty, and that is the answer rather than an omission.** The one case
 * — *SBQ-R — Suicide Behaviors Questionnaire* — is handled by `ALSO_ENGLISH` in
 * `lib/fhir-vocabulary.mjs`, which is a rule about a word rather than a list of
 * the sentences it appears in. Kept as the escape hatch for the case that is
 * genuinely a phrase and not a word; adding a second entry should feel like
 * evidence that the word belongs in `ALSO_ENGLISH` instead.
 */
const PUBLISHED_INSTRUMENT_NAMES = []

/**
 * Modules whose clinician copy is a LATER PR's, with the reason.
 *
 * ⚠️ **EMPTY, and it got there by the exemptions being SPENT rather than
 * forgotten.** It held two: `lib/measureGaps.ts` and `lib/populationAlerts.ts`,
 * the measure dashboard's empty-denominator explanations and the caseload's
 * alert provenance — clinical-app audit §1.9's last three rows, scoped to PR 7
 * by decision §7.4 because the caseload was to be audited before it was
 * edited. PR 7 audited it (§8.5) and rewrote both, so both came off. Only one
 * of the two was what the exemption said it was: the alert provenance was the
 * measure's criterion key, printed nineteen times; the measure explanations
 * were ALSO out of date, four of them asserting things about the demo data
 * that the same page disproved three lines below.
 *
 * ⚠️ Keeping the mechanism with nothing in it is deliberate. The next module
 * that needs deferring should have to write down which PR owns it, and a check
 * below fails an entry whose file no longer exists — so a stale one cannot sit
 * here covering a path nobody rechecked.
 */
const DEFERRED = {}

/**
 * Object properties holding a resource type, a code or a reference.
 *
 * ⚠️ **`display`, `wireLabel` and `tierLabel` were on this list and came off,
 * which is the single most useful thing planting found.** They were added
 * while writing this gate, beside the very component whose `tierLabel: 'Tier 0
 * · DocumentReference'` is audit §1.9's fourth row — so restoring that row
 * verbatim as a plant went GREEN. A deny list written while looking at the code
 * it must judge will excuse that code; the names here have to be ones a reader
 * genuinely never meets, and `display` is the word a coded option shows them.
 */
const CLINICAL_CODE_KEYS = new Set([
  ...CODE_KEYS,
  'resourceType', 'reference', 'valueSet', 'stageId', 'toolId',
  'actionId', 'questionnaire', 'extension',
])

/** String/collection methods whose arguments are keys and prefixes, not prose. */
const CODE_METHODS = new Set([
  'replace', 'replaceAll', 'startsWith', 'endsWith', 'includes', 'indexOf',
  'split', 'match', 'test', 'has', 'get', 'set', 'add', 'delete',
  'querySelector', 'querySelectorAll', 'getAttribute', 'setAttribute', 'localeCompare',
])

/**
 * Every string a CLINICIAN could meet in this module.
 *
 * Same walk as `readerStrings`, with the four extra deny positions the header
 * lists. Kept as its own function rather than a flag on that one: the guide's
 * scan is load-bearing for a different tree and widening its deny list to suit
 * this one is how a gate quietly stops reading.
 */
function clinicianStrings(rel, src) {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out = []
  let sawJsx = false

  const push = (node, raw) => {
    const text = raw.replace(/\s+/g, ' ').trim()
    if (!text || !/[a-zA-Z]/.test(text) || NOT_PROSE.test(text) || COMPOSITE_ID.test(text)) return
    out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text })
  }

  const tagOf = (node) =>
    ts.isJsxElement(node)
      ? node.openingElement.tagName.getText(sf)
      : ts.isJsxSelfClosingElement(node)
        ? node.tagName.getText(sf)
        : ''

  const walk = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      sawJsx = true
      // The implementer's half, gated on `useInspect()` by the element itself.
      if (INSPECTION_ONLY_ELEMENTS.has(tagOf(node))) return
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isNewExpression(node) && /Error$/.test(node.expression.getText(sf))) return
    // A type position is never rendered — `'all' | 'responses'`, `Record<'CarePlan', X>`.
    if (ts.isTypeNode(node)) return
    // `inspect && <…>` / `{inspect ? … : …}`: the subtree renders only where
    // inspection is on, which on the clinical surface is nowhere. The name is
    // the repo's own convention (`const inspect = useInspect()`), stated here
    // rather than inferred — a boolean called `inspect` that is not that one
    // would silence this scan over its subtree.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      /^(?:inspect|useInspect\(\))$/.test(node.left.getText(sf))
    ) {
      return
    }
    if (ts.isConditionalExpression(node) && /^inspect$/.test(node.condition.getText(sf))) {
      return walk(node.whenFalse)
    }
    // A discriminator, not a sentence: `resource.resourceType === 'Observation'`.
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind
      if (
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        op === ts.SyntaxKind.EqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsToken
      ) {
        walk(node.left)
        walk(node.right.kind === ts.SyntaxKind.StringLiteral ? node.operatorToken : node.right)
        return
      }
    }
    if (ts.isCaseClause(node)) {
      // The label is a discriminator; the statements under it are not.
      for (const st of node.statements) walk(st)
      return
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (CODE_METHODS.has(node.expression.name.getText(sf))) {
        walk(node.expression.expression)
        for (const arg of node.arguments) {
          if (!ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg)) walk(arg)
        }
        return
      }
    }
    if (ts.isJsxText(node)) return push(node, node.getText(sf))
    if (ts.isJsxAttribute(node)) {
      if (CLINICAL_CODE_ATTRS.has(node.name.getText(sf))) return
      return ts.forEachChild(node, walk)
    }
    if (ts.isPropertyAssignment(node)) {
      if (CLINICAL_CODE_KEYS.has(node.name.getText(sf).replace(/['"]/g, ''))) return
      // The KEY of a lookup table is a code by construction — `{'on-hold': 'On hold'}`.
      return walk(node.initializer)
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return push(node, node.text)
    if (ts.isTemplateExpression(node)) {
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

/** The first rule `text` breaks, over the clinical seven plus the guide's six. */
function clinicalJargonIn(text) {
  let subject = text
  for (const name of PUBLISHED_INSTRUMENT_NAMES) subject = subject.split(name).join('')
  for (const rule of [...CLINICAL_RULES, ...RULES]) {
    const m = rule.re.exec(subject)
    if (m) return { rule: rule.name, match: m[0].trim() }
  }
  return null
}

// ⚠️ `packages/tool-views` is not an APP root — `lib/app-roots.mjs` declares
// the two apps and throws on anything else, which is the guarantee that keeps
// both halves of that file honest. It is joined from the repo root instead, and
// the floor below is what catches a walk that stops reading it.
const CLINICAL_ROOTS = [appRoot('apps/clinical/src'), join(REPO_ROOT, 'packages/tool-views/src')]
const clinicalFiles = CLINICAL_ROOTS.flatMap((root) =>
  walkExt(root, ['.ts', '.tsx']).filter((f) => !/\.test\.tsx?$/.test(f)),
)

let clinicalStrings = 0
let clinicalHits = 0
let clinicalDeferred = 0
for (const file of clinicalFiles) {
  const rel = relRepo(file)
  if (rel in DEFERRED) {
    clinicalDeferred++
    continue
  }
  const { runs, sawJsx } = clinicianStrings(rel, readFileSync(file, 'utf8'))
  if (rel.includes('/pages/') && !sawJsx) {
    fail(`${rel}: the parser found no JSX in a page module — this gate has stopped reading it`)
  }
  clinicalStrings += runs.length
  for (const run of runs) {
    const hit = clinicalJargonIn(run.text)
    if (!hit) continue
    clinicalHits++
    fail(
      `${rel}:${run.line} names ${hit.rule} in clinician copy — "${hit.match}"\n` +
        `    …${run.text.slice(0, 120)}${run.text.length > 120 ? '…' : ''}\n` +
        `    The clinician has a patient in front of them and no wire format to be shown\n` +
        `    (clinical-app audit §1.9, §5 rule 2). Say what was recorded and what to do about it;\n` +
        `    the shape it is stored in belongs in the Adoption Guide, or behind useInspect().`,
    )
  }
}

// An exemption for a module that no longer exists is an exemption nobody will
// notice has gone stale.
for (const rel of Object.keys(DEFERRED)) {
  if (!clinicalFiles.some((f) => relRepo(f) === rel)) {
    fail(`${rel} is exempted from the clinician scan but is not one of the files it walks`)
  }
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
    // Halved and rounded down from the live counts on the day the clinical scan
    // landed: 76 modules walked (74 read, 2 deferred) / 1,118 clinician strings.
    { source: 'apps/clinical + packages/tool-views', dimension: 'module(s) parsed', actual: clinicalFiles.length, floor: 38 },
    { source: 'apps/clinical + packages/tool-views', dimension: 'clinician string(s)', actual: clinicalStrings, floor: 550 },
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
  console.log(
    `✓ no wire vocabulary in clinician copy: ${clinicalStrings} string(s) across ` +
      `${clinicalFiles.length - clinicalDeferred} module(s) in apps/clinical and ` +
      `packages/tool-views, against ${CLINICAL_RULES.length + RULES.length} rules ` +
      `(${clinicalDeferred} deferred with a reason)`,
  )
  process.exit(0)
}

console.error(
  `\n✗ ${guideHits} reader string(s) and ${fshHits} documentation string(s) name this repo's machinery; ` +
    `${clinicalHits} clinician string(s) name the wire format.`,
)
process.exit(1)
