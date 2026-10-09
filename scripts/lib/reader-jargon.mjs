/**
 * The repo-vocabulary rules for reader copy, in ONE place.
 *
 * `scripts/check-reader-jargon.mjs` applies them to source strings, to core's
 * loaded values and to the published `documentation`; the guide's
 * rendered-copy test (`apps/guide/src/pages/readerCopy.test.tsx`) applies the
 * same list to what a page actually renders. Two copies of a regex list is
 * the drift this repo keeps writing gates against, so neither keeps its own.
 *
 * Each rule came from a string that shipped to a reader:
 *
 *   an npm script      `npm run copy-fhir`      — the pathway load error
 *   a gate name        `check:reassessment`     — the pathway artifact
 *   a repo path        `packages/core/src/lib/` — the CDS Service page
 *   a source file      `suicide-related-conditions.fsh` — the artifact
 *   an issue number    `(#64)`, `issue #401`    — licensing, the dashboard
 *   a repo date        `until 2026-09-17`       — the Provider App page
 *
 * ⚠️ **`ig/` and the non-code file kinds joined in the 2026-10 gate audit.** A
 * planted "the logic lives in SPiERPathway.cql under ig/input/cql/" passed:
 * the path rule knew every tree but the IG's, and the file rule knew
 * `.ts/.tsx/.mjs/.fsh/.md` but not the `.json` Questionnaires, the `.cql`
 * library, the `.fml` maps or the `.yaml` config a sentence about the build
 * actually names. `ig/` is matched only where it does not continue a URL —
 * `build.fhir.org/ig/HL7/…` is a published address, not this repo's tree.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fhirR4TypeNames } from './fhir-vocabulary.mjs'
import { REPO_ROOT, relRepo, walkExt } from './repo.mjs'

export const REPO_RULES = [
  { name: 'an npm script', re: /\bnpm run [a-z][a-z:-]*/ },
  { name: 'a gate name', re: /\bcheck:[a-z][a-z-]*/ },
  {
    name: 'a repo path',
    re: /\b(?:apps|packages|services|scripts|docs|shims|tests|web)\/[A-Za-z0-9._/-]+|(?<![\w./:-])ig\/[A-Za-z0-9._/-]+/,
  },
  { name: 'a source file', re: /\b[A-Za-z0-9_-]+\.(?:tsx?|mjs|fsh|md|json|jsonc|cql|fml|ya?ml)\b/ },
  { name: 'an issue number', re: /(?:^|[\s(])#\d{2,4}\b/ },
  { name: 'a repo date', re: /\b20\d\d-\d\d-\d\d\b/ },
]

// ── The repo-identifier rule, and the index it needs ───────────────────────

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

/**
 * PascalCase with a lower-to-upper hump — `SmartDataSource`, `WritebackScorecard`,
 * `CSSRSItemCoding`; not `TOOLS`, `HEX` or `Patient`.
 *
 * ⚠️ **Added 2026-10-09, after a planted "SmartDataSource" in the Provider App
 * page's prose passed.** The index was camelCase-only, so every class, React
 * component and exported type — the names a sentence about the build is most
 * likely to quote — was invisible to it. The hump is the shape test: an ALL-CAPS
 * constant (`TOOLS`, `CONFIG`) is also an acronym a reader may meet, and a
 * single capitalised word is English.
 */
const PASCAL = /^[A-Z][A-Za-z0-9]*[a-z][A-Z][A-Za-z0-9]*$/

/** Every word-shaped token; membership in the index is the test, not the shape. */
const WORD_TOKEN = /\b[A-Za-z][A-Za-z0-9]*\b/g

/**
 * ⚠️ **Names a reader of the guide is SUPPOSED to meet, subtracted from the
 * PascalCase half.** Both are derived, neither is typed:
 *
 *   - every FHIR R4 resource and datatype name (`fhirR4TypeNames`, from the R4
 *     model `fhirpath` ships) — guide copy names `QuestionnaireResponse`,
 *     `CapabilityStatement` and `PlanDefinition` as the standard's own words,
 *     and a repo type that shares one is the spec's word first;
 *   - every published artifact's `name` in the generated IG
 *     (`SPiERSuicideRiskConcept`, `AdministerPHQ9`) — the guide shows these as
 *     what an implementer will find in the IG, which is the artifact's identity
 *     and not this repo's machinery. Today no TypeScript export shares one, so
 *     the subtraction removes nothing; it states the decision, so the first
 *     export that does is not a reason to stop naming the profile.
 *
 * check:jargon's clinical scan bans SPiER profile names outright (its own rule);
 * that is a different reader, and this does not loosen it.
 */
function publishedArtifactNames() {
  const names = new Set()
  if (!existsSync(GENERATED_DIR)) return names // check:jargon fails its absence; the floor catches it
  for (const file of walkExt(GENERATED_DIR, ['.json'])) {
    try {
      const r = JSON.parse(readFileSync(file, 'utf8'))
      if (typeof r?.name === 'string' && typeof r?.url === 'string') names.add(r.name)
    } catch {
      // not a resource; copy-fhir's own gates own the tree's shape
    }
  }
  return names
}

const GENERATED_DIR = join(REPO_ROOT, 'packages/fhir-artifacts/generated')

/**
 * Every camelCase or PascalCase name this repo defines: exported bindings
 * (classes, components, types and constants included), plus file and directory
 * names (`observationMappers` is a directory, and was quoted at a reader as one;
 * `SmartDataSource.ts` is a file).
 *
 * ⚠️ **Shared since 2026-10-09** — before that only check:jargon built it, so
 * the rendered-copy test applied the six regex rules and no identifier at all:
 * a page RENDERING `SmartDataSource` from a value no source scan reads passed.
 */
export function indexRepoIdentifiers() {
  const fhirTypeNames = fhirR4TypeNames()
  const artifactNames = publishedArtifactNames()
  const readerVocabulary = new Set([...fhirTypeNames, ...artifactNames])
  const camel = new Set()
  const pascal = new Set()
  const subtracted = new Set()
  const add = (name) => {
    if (CAMEL.test(name)) camel.add(name)
    else if (PASCAL.test(name)) {
      if (readerVocabulary.has(name)) subtracted.add(name)
      else pascal.add(name)
    }
  }
  for (const root of SYMBOL_ROOTS) {
    for (const file of walkExt(join(REPO_ROOT, root), ['.ts', '.tsx', '.mjs'])) {
      const rel = relRepo(file)
      if (NOT_OURS.test(rel)) continue
      for (const segment of rel.split('/')) add(segment.replace(/\.(tsx?|mjs)$/, ''))
      const src = readFileSync(file, 'utf8')
      const decl = /\bexport\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g
      for (const m of src.matchAll(decl)) add(m[1])
    }
  }
  return { camel, pascal, subtracted, fhirTypeNames, artifactNames, all: new Set([...camel, ...pascal]) }
}

/**
 * The first rule `text` breaks, or null: the regex rules above, then — given an
 * index from `indexRepoIdentifiers()` — any word this repo defines.
 *
 * @param {string} text
 * @param {Set<string>} identifiers
 * @returns {{ rule: string, match: string } | null}
 */
export function repoJargonIn(text, identifiers) {
  for (const rule of REPO_RULES) {
    const m = rule.re.exec(text)
    if (m) return { rule: rule.name, match: m[0].trim() }
  }
  for (const m of text.matchAll(WORD_TOKEN)) {
    if (identifiers.has(m[0])) return { rule: 'a repo identifier', match: m[0] }
  }
  return null
}
