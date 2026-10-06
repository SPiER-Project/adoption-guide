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
 * The first rule `text` breaks, or null. The repo-identifier rule is not here:
 * it needs an index of the repo's own exports, which only the script builds.
 *
 * @param {string} text
 * @returns {{ rule: string, match: string } | null}
 */
export function repoJargonIn(text) {
  for (const rule of REPO_RULES) {
    const m = rule.re.exec(text)
    if (m) return { rule: rule.name, match: m[0].trim() }
  }
  return null
}
