/**
 * Retry a synchronous step that fails for reasons outside this repo.
 *
 * ── The failure this was written against (2026-09-15) ───────────────────────
 *
 * The Cloudflare Workers build for `spier-adoption-guide` deploys the public
 * demo, and it failed on the merge of #501 — not on anything in the commit:
 *
 *     15:24:35  Attempting to download hl7.fhir.r4.core#4.0.1 …
 *     15:26:45  error Failed to load hl7.fhir.r4.core#4.0.1: Failed to download
 *               error Valid StructureDefinition resource not found.
 *               [copy-fhir] sushi failed — aborting copy
 *
 * `packages.fhir.org` was degraded for a few minutes. SUSHI pulls seven FHIR
 * packages on a cold cache; six arrived slowly (hl7.terminology took 58s where
 * it normally takes ~2s) and the seventh hung for 2m10s and gave up. The
 * "cache may be corrupt" line is a consequence, not the cause — the cache was
 * fine, the package simply never arrived.
 *
 * ⚠️ **The exposure is asymmetric, and that is the point of this file.** GitHub
 * Actions barely feels a registry outage: it caches the generated FHIR tree on
 * `copy-fhir.mjs --print-input-fingerprint`, so most jobs never invoke SUSHI at
 * all. Cloudflare has no equivalent — its build log says "Restoring from build
 * output cache" and SUSHI still runs from scratch. So every deploy of the public
 * demo bets on seven sequential downloads from a third-party registry, and any
 * one of them timing out takes the deploy with it.
 *
 * ── Why this retries EVERYTHING rather than sniffing for a network error ────
 *
 * The precise version of this would capture SUSHI's output and retry only on a
 * recognised transient signature ("Failed to download … from the registry").
 * That was deliberately not built, for two reasons:
 *
 *   1. **A signature list is a mechanism that can silently stop working.** When
 *      the registry's error text changes, a signature-matching retry quietly
 *      stops retrying and nobody learns that until a deploy fails. This repo has
 *      a standing rule against checks that can pass while checking nothing; the
 *      same objection applies to a guard that can stop guarding.
 *   2. **Capturing output to match against costs the live log.** SUSHI runs with
 *      `stdio: 'inherit'` so a four-minute compile shows progress in CI. Piping
 *      it to inspect the text would hold all of it until the process exits.
 *
 * The cost of retrying indiscriminately is small and bounded: a genuinely broken
 * FSH file fails again, and fails FAST the second time, because the first
 * attempt populated the package cache that made the first attempt slow. So a
 * real error surfaces a few seconds later than it used to, and a flake stops
 * costing a deploy. A retry that cannot tell the two apart never reports the
 * wrong answer — it only ever spends time.
 */

/**
 * Sleep without async, so this composes with `spawnSync`.
 *
 * `Atomics.wait` on a throwaway buffer is the only way to block a synchronous
 * Node script; the alternative (a busy loop on `Date.now()`) pins a core for the
 * whole backoff, which on a build box is the thing you are trying not to do.
 */
export function sleepSync(ms) {
  if (!(ms > 0)) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Run `attempt()` until it reports success, up to `attempts` times.
 *
 * `attempt` is called with the 1-based attempt number and must return
 * `{ ok: boolean }`; anything else it wants to hand back (an exit status, say)
 * rides along on that object and is returned from here. It is called at least
 * once even if `attempts` is 0 or nonsense — a miscounted config must not turn
 * this into a no-op that silently skips the work entirely.
 *
 * `backoffMs(n)` is the pause BEFORE attempt n+1; the default is 10s then 30s,
 * chosen against the outage above, which ran a little over two minutes. Nothing
 * here is a retry budget for a registry that is down for an hour — that is a
 * failed deploy, correctly.
 *
 * `onRetry({ attempt, attempts, waitMs })` is where the caller says so out loud.
 * A build log that silently runs the same command three times is worse than one
 * that failed once, so this has no default: callers pass a logger.
 */
export function retrySync(attempt, { attempts = 3, backoffMs = defaultBackoff, onRetry } = {}) {
  const total = Number.isInteger(attempts) && attempts > 0 ? attempts : 1
  let result
  for (let n = 1; n <= total; n++) {
    result = attempt(n)
    if (result?.ok) return { ...result, attemptsUsed: n }
    if (n < total) {
      const waitMs = backoffMs(n)
      onRetry?.({ attempt: n, attempts: total, waitMs })
      sleepSync(waitMs)
    }
  }
  return { ...result, attemptsUsed: total }
}

/** 10s before the second attempt, 30s before the third and any beyond it. */
export function defaultBackoff(n) {
  return n === 1 ? 10_000 : 30_000
}
