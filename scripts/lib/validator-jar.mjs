/**
 * Shared resolution of the HL7 `validator_cli.jar`.
 *
 * Two gates need the jar — `scripts/validate-fhir.mjs` (resource conformance)
 * and `scripts/check-fml.mjs` (StructureMap compile + transform parity) — and
 * they must agree on the version, or a map could compile under one validator
 * while the resources it produces are judged by another.
 *
 * The version is pinned deliberately. `ig-publish.yml` resolves the *latest* IG
 * Publisher because that job is informational-until-it-fails and tracking
 * upstream is desirable there. These are hard PR gates, so a new validator
 * release must never be able to turn a PR red on its own. Bump the constant in
 * its own PR, with the new findings triaged.
 */
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

export const VALIDATOR_VERSION = '6.10.0'
export const VALIDATOR_URL = `https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VALIDATOR_VERSION}/validator_cli.jar`

/** The FHIR release every SPiER artifact targets. */
export const FHIR_VERSION = '4.0.1'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Return a path to the pinned validator jar, downloading it into the gitignored
 * `.fhir-validator/` cache on first use.
 *
 * @param {{ explicitPath?: string }} [options] `explicitPath` short-circuits the
 *   cache — used by `--jar` / `SPIER_VALIDATOR_JAR`, and by CI when the jar is
 *   restored from an actions cache.
 * @returns {Promise<string>} absolute path to the jar
 * @throws {Error} if an explicitly supplied path does not exist, or the
 *   download fails
 */
export async function resolveValidatorJar({ explicitPath } = {}) {
  const fromEnv = explicitPath ?? process.env.SPIER_VALIDATOR_JAR
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`validator jar not found at ${fromEnv}`)
    return fromEnv
  }

  const cacheDir = join(repoRoot, '.fhir-validator')
  const jar = join(cacheDir, `validator_cli-${VALIDATOR_VERSION}.jar`)
  if (existsSync(jar)) return jar

  mkdirSync(cacheDir, { recursive: true })
  console.log(`Downloading validator_cli ${VALIDATOR_VERSION} (~190 MB, one time)…`)
  const res = await fetch(VALIDATOR_URL, { redirect: 'follow' })
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText} — ${VALIDATOR_URL}`)
  // Download to a partial file first so an interrupted run cannot leave a
  // truncated jar behind that every later run would happily reuse.
  const partial = `${jar}.partial`
  await pipeline(Readable.fromWeb(res.body), createWriteStream(partial))
  renameSync(partial, jar)
  return jar
}
