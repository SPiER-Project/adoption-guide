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

import { fhirR4TypeNames, RESOURCE_TYPES, WIRE_ONLY_RESOURCE_TYPES } from './fhir-vocabulary.mjs'
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
 * ⚠️ **The type list is no longer the 18 SPiER writes (2026-10-09).** It is
 * those plus every FHIR R4 name with a lower-to-upper hump, in the singular or
 * the plural (`lib/fhir-vocabulary.mjs`): "A partial CodeSystem would read as
 * complete" reached a clinician because `CodeSystem` was not one of the 18, and
 * "item-9 Observations" because the rule stopped at a word boundary before the
 * `s`. These rules are applied to RENDERED clinical pages too
 * (`apps/clinical/src/pages/pageLength.test.tsx`), which is what sees text a
 * page reads from the published artifact at runtime.
 *
 * ⚠️ **What it cannot see.** A one-word R4 type that is also English
 * (`Measure`, `Group`) used as the type; a string assembled from parts, which is how
 * `${type} · ${status}` would read to it as two harmless halves; and prose that
 * is wrong for a clinician without naming any of these five things — "the
 * denominator excludes them" passes, and it is exactly what the recorder pass
 * had to fix by hand.
 */
export const CLINICAL_RULES = [
  {
    name: 'a FHIR resource type',
    // `WIRE_ONLY_…`, not the whole list — see `lib/fhir-vocabulary.mjs` for the
    // eight names that are ordinary English in this copy and why RULE 3 keeps
    // them while this scan does not.
    re: new RegExp(`\\b(?:${WIRE_ONLY_RESOURCE_TYPES.join('|')})s?\\b`),
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
