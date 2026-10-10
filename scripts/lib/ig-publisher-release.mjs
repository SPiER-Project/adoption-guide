#!/usr/bin/env node
// The HL7 IG Publisher version CI runs — PINNED — and a resolver for the latest
// release, used only to check for a newer one.
//
// ─── Why it is pinned (2026-10-06) ─────────────────────────────────────────
//
// This used to print the LATEST release, so every run picked up whatever HL7
// had just published. 2.3.5 went out at 19:18 UTC on 2026-10-06 ("internal
// processing is moving to be based on R6 not R5") and from the next run on,
// every PR touching ig/ — and the IG render on deploy — failed: the CQL still
// translated, but ELM generation failed with "Unknown FHIRType". The commit
// that had passed on 2.3.4 that morning failed identically when re-run, so it
// was the release and not a change here. A new publisher release could turn
// every PR red on its own, which is the exact reason validator-jar.mjs pins
// the validator. Now both are pinned.
//
// To move to a newer publisher: `node scripts/lib/ig-publisher-release.mjs
// --latest` prints HL7's current latest; bump IG_PUBLISHER_VERSION in its own
// PR, with the IG Publisher job's findings triaged.
//
// ─── What 2.3.5 found, and what still blocks it (triaged 2026-10-06) ───────
//
// A probe run on 2.3.5 sorted the failure into two halves:
//
//   OURS, fixed: the ELM failure was "Unknown FHIRTypes code 'Any'". The
//   publisher reports a define whose type it cannot name as `Any`, and 2.3.5's
//   R6 type enum has no `Any`. Our "Care Transition Dates" was a
//   List<Choice<dateTime, instant>>; it now returns System.DateTime. 2.3.5's new
//   WCAG checks also flagged 37 headings; IG pages now start at `###`.
//
//   UPSTREAM: with both fixed, 2.3.5 still reports 5 errors and
//   19 "broken links", none of them caused by our source:
//     - HL7/fhir-ig-publisher#1384: every FML map loses the R4-required
//       group.typeMode (2.3.4 emitted "none" from the same .fml).
//     - HL7/fhir-ig-publisher#1386: "Broken Links" now counts HTML-checker
//       WARNINGS (template searchform.html, duplicate FHIRHelpers anchors on
//       Measure pages). The link check itself finds 0 broken links.
//     - HL7/fhir-ig-publisher#1385: the ELM failure is only a log line and
//       never a QA error. Our CQL gate caught it; the publisher's QA did not.
//
// #1386 no longer blocks: the QA gate (scripts/lib/ig-qa-counts.mjs) now reads
// the HTML check's own counts instead of the summary's "Broken Links", so those
// warnings are reported and not gated. With it, 2.3.5's probe run fails ONLY on
// #1384's 5 typeMode errors. Bump when a release fixes #1384.
//
// One definition, for the same reason sushi-version.mjs and validator-jar.mjs
// are one definition: this is consumed by TWO workflows on two different paths
// — ig-publish.yml at PR time and deploy.yml on the deploy path — and the
// publisher version is part of a cache key in both. Two copies of the retry
// logic would be two things to keep in agreement, with nothing comparing them.
//
// ─── Why it retries at all ─────────────────────────────────────────────────
//
// Resolving the tag is a network dependency on the critical path of a deploy.
// The old `releases/latest/download` URL needed no API call; keying the jar
// cache by version does. A single GitHub API hiccup should not fail a deploy.
//
// ─── What the shell version got wrong, and why this is a script ────────────
//
// deploy.yml carried this as an inline `bash -e` loop whose two `|| true`
// guards were load-bearing in a way that is invisible unless you know both
// failure modes: a curl timeout yields empty output and `jq` exits 0, so the
// retry works — but an HTML error body (a GitHub API 502, the likelier flake)
// makes `jq` exit 5, which under `bash -e` aborts the step on attempt 1 and the
// loop never runs a second time. ig-publish.yml meanwhile had no loop at all.
// Expressing it here removes the `bash -e` hazard entirely: every failure mode
// below is an explicit branch rather than an exit code that has to be masked.
//
// ⚠️ A malformed or error response must be treated as a RETRYABLE failure and
// never as "no new release" — resolving to an empty tag would key the jar cache
// on `ig-publisher-` and silently reuse whatever jar that matched.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The IG Publisher release both workflows download. Bump deliberately — see the header. */
export const IG_PUBLISHER_VERSION = '3.0.0'

const API = 'https://api.github.com/repos/HL7/fhir-ig-publisher/releases/latest'
const ATTEMPTS = 3
const TIMEOUT_MS = 30_000
const BACKOFF_MS = 5_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {object} [opts]
 * @param {(msg: string) => void} [opts.log] progress sink; stderr by default, so
 *   the CLI's stdout stays exactly the tag and nothing else.
 * @param {number} [opts.backoffMs] pause between attempts. A seam for the tests
 *   only — they assert all five failure modes plus recovery, and three real 5s
 *   backoffs would make that suite ~50s on its own.
 * @returns {Promise<string>} the release tag (e.g. `1.8.14`)
 * @throws if it cannot be resolved after every attempt
 */
export async function resolveIgPublisherTag({ log = console.error, backoffMs = BACKOFF_MS } = {}) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let reason
    try {
      // GITHUB_TOKEN when present: the unauthenticated API is rate-limited per
      // IP, and a shared runner IP can arrive already exhausted. Optional, so a
      // local run still works.
      const headers = { accept: 'application/vnd.github+json' }
      if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
      const res = await fetch(API, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) {
        reason = `HTTP ${res.status}`
      } else {
        // .json() throws on the HTML error body that broke the shell version.
        const body = await res.json()
        const tag = typeof body?.tag_name === 'string' ? body.tag_name.trim() : ''
        if (tag) {
          log(`resolved publisher release: ${tag} (attempt ${attempt})`)
          return tag
        }
        reason = 'response carried no tag_name'
      }
    } catch (err) {
      reason = err?.name === 'TimeoutError' ? `timed out after ${TIMEOUT_MS}ms` : String(err?.message ?? err)
    }
    log(`attempt ${attempt} could not resolve the release tag (${reason})`)
    if (attempt < ATTEMPTS) await sleep(backoffMs)
  }
  throw new Error(`could not resolve the latest fhir-ig-publisher release tag after ${ATTEMPTS} attempts`)
}

// CLI: print the PINNED tag on stdout so a workflow can capture it; with
// `--latest`, resolve and print HL7's latest release instead (a human checking
// for an upgrade — no workflow passes it). Progress and failures go to stderr,
// so `$(...)` captures the tag and nothing else.
//
// ⚠️ `fileURLToPath`, not `import.meta.url === \`file://${process.argv[1]}\``.
// This repo's own checkout path contains a space ("public health"), which
// `import.meta.url` percent-encodes and `process.argv[1]` does not — so the
// string form compares `…public%20health…` against `…public health…`, never
// matches, and the CLI silently prints nothing at all. Observed here before
// this comment was written.
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  try {
    const tag = process.argv.includes('--latest') ? await resolveIgPublisherTag() : IG_PUBLISHER_VERSION
    process.stdout.write(tag + '\n')
  } catch (err) {
    console.error(`::error::${err.message}`)
    process.exit(1)
  }
}
