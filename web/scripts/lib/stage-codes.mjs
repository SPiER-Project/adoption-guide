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
 * rule `web/scripts/lib/vite-alias.mjs` follows for the same reason.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Repo root, from `web/scripts/lib/`. */
export const REPO_ROOT = resolve(here, '../../..')

/** Canonical system URL for the pathway-stage codes. */
export const STAGE_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'

/** The FSH file that defines the CodeSystem. */
export const STAGE_FSH = resolve(REPO_ROOT, 'ig/input/fsh/spier-codesystem.fsh')

/**
 * @returns {Set<string>} every `SPiERPathwayStage` concept code.
 * @throws if the CodeSystem block is absent or yields zero concepts.
 */
export function readStageCodes() {
  const fsh = readFileSync(STAGE_FSH, 'utf8')
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
  return codes
}
