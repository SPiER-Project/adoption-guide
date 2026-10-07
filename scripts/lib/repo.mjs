/**
 * Where the repo is, and the few file-walking helpers every gate needs.
 *
 * ⚠️ These were defined in each file that needed them — `REPO_ROOT`, `relRepo`
 * and `walkExt` in both `app-roots.mjs` and `style-roots.mjs`, `walkJson` in two
 * gates, a `rel` in six — because `check:dupes` did not scan `scripts/`. It does
 * since 2026-10-07, so a second copy of anything here fails it.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Repo-relative, so a message names a file the same way whichever tree it is in. */
export const relRepo = (p) => relative(REPO_ROOT, p)

/** A test module, in any of the extensions the repo uses. */
export const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f)

/** Every file under `dir` ending in one of `exts`, sorted; `[]` if `dir` is absent. */
export function walkExt(dir, exts) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkExt(full, exts))
    else if (exts.some((e) => full.endsWith(e))) out.push(full)
  }
  return out
}

/**
 * Every `.json` under `dir`, recursively, sorted. Yields nothing when `dir` is
 * absent — `packages/fhir-artifacts/generated/` is a build artifact, missing on
 * a clean checkout — so a caller must floor what it reads.
 */
export function* walkJson(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries.sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walkJson(full)
    else if (entry.endsWith('.json')) yield full
  }
}
