/**
 * The canonical pathway-stage list, read from the one place that defines it.
 *
 * `ig/input/fsh/spier-codesystem.fsh` is canonical for `SPiERPathwayStage`.
 * `check:stages` has parsed it straight out of the FSH since it was written —
 * no SUSHI compile needed, so the gate runs on a clean checkout — and
 * `check:pathway` needs exactly the same list. Two hand-rolled parsers of one
 * file is the drift shape this repo keeps catching one layer up, so the parser
 * lives here and both gates call it.
 *
 * Reading nothing is a THROW, not an empty set. A gate handed `[]` would report
 * green having checked nothing, which is the #232 / #261 failure mode; the same
 * rule `scripts/lib/vite-alias.mjs` follows for the same reason.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Repo root, from `scripts/lib/`. */
export const REPO_ROOT = resolve(here, '../..')

/** Canonical system URL for the pathway-stage codes. */
export const STAGE_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'

/** The FSH file that defines the CodeSystem. */
export const STAGE_FSH = resolve(REPO_ROOT, 'ig/input/fsh/spier-codesystem.fsh')

/**
 * @returns {Set<string>} every `SPiERPathwayStage` concept code.
 * @throws if the CodeSystem block is absent or yields zero concepts.
 */
export function readStageCodes() {
  // ⚠️ Comments stripped FIRST. SUSHI ignores `/* … */` and `// …`, and this
  // reader did not: block-commenting `* #track-risk-over-time` out of the
  // CodeSystem removed it from the IG and from the generated StageId union, while
  // `check:stages` still listed eight stages and passed the sixteen fixture
  // references to it. (A `//` after a `:` is a URL, not a comment.)
  const fsh = readFileSync(STAGE_FSH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  // The file may hold several CodeSystems — isolate this one's block, then
  // collect its `* #code "Display" …` concept lines.
  const block = fsh.split(/^CodeSystem:\s*/m).find((b) => b.startsWith('SPiERPathwayStage'))
  if (!block) {
    throw new Error(`CodeSystem SPiERPathwayStage not found in ${STAGE_FSH}`)
  }
  const codes = new Set([...block.matchAll(/^\* #([A-Za-z0-9-]+)\s+"/gm)].map((m) => m[1]))
  if (codes.size === 0) {
    throw new Error(
      `no concepts parsed from SPiERPathwayStage in ${STAGE_FSH} — refusing to hand back an empty ` +
        'stage list, which would make every caller pass having checked nothing',
    )
  }
  assertMatchesGenerated(codes)
  return codes
}

/** The CodeSystem SUSHI compiled from that FSH, when copy-fhir has run. */
export const STAGE_GENERATED = resolve(REPO_ROOT, 'packages/fhir-artifacts/generated/CodeSystem-spier-pathway-stage.json')

/**
 * The FSH parse above is a second reader of a file SUSHI also reads, and two
 * parsers of one file can disagree — the comment case is how they did. When
 * the generated CodeSystem is present (every `verify` run; not the fast
 * `lint-css` job, which skips copy-fhir) the two lists must be identical, so
 * any FSH form this regex mis-reads fails here instead of reporting stages the
 * IG does not publish.
 */
function assertMatchesGenerated(codes) {
  if (!existsSync(STAGE_GENERATED)) return
  const generated = new Set(
    (JSON.parse(readFileSync(STAGE_GENERATED, 'utf8')).concept ?? []).map((c) => c.code),
  )
  const onlyFsh = [...codes].filter((c) => !generated.has(c))
  const onlyGenerated = [...generated].filter((c) => !codes.has(c))
  if (onlyFsh.length || onlyGenerated.length) {
    throw new Error(
      `the FSH parse of SPiERPathwayStage disagrees with the compiled CodeSystem (${STAGE_GENERATED}): ` +
        `only in the FSH parse [${onlyFsh.join(', ')}], only in SUSHI's output [${onlyGenerated.join(', ')}]. ` +
        'Either the generated tree is stale (run `npm run copy-fhir`) or scripts/lib/stage-codes.mjs is ' +
        'misreading the FSH — fix the reader, do not trust the list.',
    )
  }
}
