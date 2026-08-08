# Scheduled checks: what they are, and who reads them when they go red

Two workflows in this repo run on a timer rather than on a pull request. Both
were written to be loud, and both spent their first weeks unobserved on the
trigger that actually matters — which is what issue #232 was about.

A scheduled check differs from a PR check in one way that governs everything
below: **nobody is standing in front of it.** A PR check has an author waiting on
it. A nightly has an inbox notification and an Actions tab. So each one needs a
named reader and a written response, or it decays into a red badge people learn
to scroll past.

| Workflow | Schedule | Trigger to watch | Reader |
|---|---|---|---|
| [`terminology-nightly.yml`](../.github/workflows/terminology-nightly.yml) | `41 4 * * *` — 04:41 UTC daily | `schedule` | Brad Thorson (repo maintainer) |
| [`roadmap-snapshot.yml`](../.github/workflows/roadmap-snapshot.yml) | `17 13 * * 1` — Mondays 13:17 UTC | `schedule` | Brad Thorson (repo maintainer) |

Both readers are the same person today because the repo has one active
maintainer. That is a fact to change, not a design: when a second maintainer
joins, split the rows rather than leaving "whoever notices".

Two GitHub behaviours worth knowing before diagnosing a schedule that seems dead:

- `schedule` only ever runs from the **default branch**. A cron edited on a
  branch does nothing until it merges to `main`.
- GitHub **disables scheduled workflows in a repo with 60 days of no activity**,
  and emails the maintainer when it does. This repo is nowhere near that, but a
  quiet stretch plus an unread email is a plausible way for both checks to stop
  without anything going red.

Scheduled runs are also queued, not punctual. The first nightly fired at 05:22
UTC against a 04:41 cron — 41 minutes late is normal and not a symptom.

---

## `terminology-nightly.yml` is red

It files (or refreshes) one reusable issue titled **"Terminology drift: external
codes no longer validate"**, and links the run. Start there; the logs are
attached as artifacts for 14 days.

Two causes produce a red run, and they need opposite responses. **Read the table
in the issue body first** — it says which of the two jobs failed, and that is
most of the diagnosis.

### Cause 1 — a code or display actually drifted

Symptom: the log names specific codes with `✗`, and the message quotes what the
publishing authority does allow. Example, from the run that proved this gate
works:

```
✗ 86849004 "Suicide attempt"
    → Wrong Display Name 'Suicide attempt' for http://snomed.info/sct#86849004.
      Valid display is one of 4 choices: 'Suicidal poisoning' (en), …
    in web/src/lib/observationMappers/sbqr.ts
```

Response: **fix the code, not the expectation.** This is the whole discipline
issue #220 produced, and the tempting wrong move — editing the check, or
loosening a floor, so the run goes green — reintroduces exactly the class of
defect the check exists to catch.

1. Confirm the correct code and display yourself before writing either:
   ```bash
   curl -s 'https://tx.fhir.org/r4/CodeSystem/$validate-code?url=http://snomed.info/sct&code=82313006&display=Suicide%20attempt' | jq '.parameter'
   ```
   `$validate-code` gives the exact display. Use `$lookup` as well when the
   *meaning* is in question and not just the spelling — a code can validate
   cleanly and still be the wrong concept. `81344-4` did, in #220, and
   `86849004` does here.
2. Fix every site. Codes are hand-duplicated across `ig/input/fsh/`,
   `web/src/lib/observationMappers/`, `web/src/lib/carePlanMappers/`,
   `web/src/data/population/` and `docs/terminology-manifest.json` — grep the
   whole repo for the old value.
3. Re-run locally: `node web/scripts/check-codings.mjs --tx https://tx.fhir.org`.
4. The tracking issue closes itself on the next clean run.

### Cause 2 — `tx.fhir.org` was unreachable or erroring

Symptom: `?` lines rather than `✗`, and a summary ending
`could not be checked — … unreachable or erroring`. Both checks treat this as
failure on purpose: a check that verified nothing must never report success.

Response: **re-run the workflow.** `tx.fhir.org` fails transiently under load —
one development run died with "validator produced no output" and the identical
invocation succeeded moments later with 0 errors. The resources job already
retries once after 60s; the codings job retries each request three times. A
failure that survives all of that usually means a real outage.

```bash
gh workflow run terminology-nightly.yml --repo SPiER-Project/adoption-guide
```

If it fails the same way twice in a row, check the server is up before spending
time on the repo — nothing in SPiER changed, and there is nothing to fix here.
Leave the tracking issue open; it will close on the next clean night.

### Neither — the check verified almost nothing

Symptom: `✗ <path> yielded N <family> coding(s), expected at least M`, or a
complaint that a SCAN entry declares no floor for a family.

This is the guard on the guard, and it means the *extractor* broke rather than
the terminology: a scanned path moved, a vocabulary family was dropped from
`EXTERNAL_FAMILIES`, or a new family was added without a floor. Fix the scanner
in `web/scripts/check-codings.mjs`. Do not lower a floor to make it pass —
see the long comment on `SCAN` for the three separate times a floor that looked
redundant turned out to be the only thing standing between this check and a
silent pass.

Floors are a **liveness** assertion, roughly half the real count. They need a
deliberate re-check whenever a source grows: #43 doubled the manifest's SNOMED
inventory and its floor stayed put, which is how it quietly fell to a quarter of
the real count without anything going red.

---

## `roadmap-snapshot.yml` opens its own PR — until the PAT expires

The snapshot behind `/guide/roadmap` is committed, so the page builds offline —
and so it goes stale on its own. The Monday run re-fetches GitHub Issues and
proposes a PR when the content actually changed.

**This is working automatically as of 2026-08-08.** The org still forbids GitHub
Actions from opening pull requests (`can_approve_pull_request_reviews: false`),
but the repo now carries a fine-grained PAT as the `ROADMAP_PR_TOKEN` secret,
added 2026-08-08 22:38 UTC, and `roadmap-snapshot.yml` prefers it over
`GITHUB_TOKEN` wherever it needs write access. Verified the same evening: runs
`31282321253` and `31282716568` opened PRs #243 and #244 themselves, three to
twenty seconds after pushing the branch, with `File the manual-PR tracking issue`
skipped rather than taken.

Both PRs also arrived with the full check suite — `verify`, `lint-css`,
`cds-hooks`, Workers Builds. That is the PAT's second benefit and it is not
cosmetic: pushes made with `GITHUB_TOKEN` do not trigger other workflows, so
under the old path the snapshot PR was reviewed with **no checks on it at all**.

### When it goes back to needing a hand

A fine-grained PAT expires — 366 days at the outside — and expiry is the failure
mode this section now exists for. GitHub does not expose a secret's expiry date
through the API, so nothing in this repo can read it back or warn you in advance.
On expiry the workflow falls back to `GITHUB_TOKEN`, the org policy blocks the
PR, and the run goes back to pushing `chore/roadmap-snapshot` and filing a
reusable issue titled **"Roadmap snapshot: branch pushed, PR needs opening by
hand"** with a compare link. Open that PR, then rotate the PAT.

> **`ROADMAP_PR_TOKEN` expiry: not recorded.** Whoever rotates it next should
> write the date here. Until then the tracking issue is the only notice you get,
> and it arrives a week late by construction.

That fallback is now a **regression detector rather than the normal path** —
keep it. It is what makes a silently-expired PAT recoverable instead of
invisible, and it is the same shape the nightly uses. Until #232 the blocked case
produced only a warning inside a green run, which is why a fully green run on
2026-08-07 had silently not opened its PR and nobody knew.

If the page looks stale and there is *no* such issue, the PAT is not the
problem — check whether the schedule ran at all, per the two GitHub behaviours at
the top.

### The other permanent fix

Org Settings → Actions → General → **Allow GitHub Actions to create and approve
pull requests** removes the dependency on a PAT entirely: one checkbox, nothing
to rotate, no expiry to track. The tradeoff is the checks — with `GITHUB_TOKEN`
doing the push, the PR arrives with none, and you would need an empty commit to
get `web-lint` on it.

This is an **org-level** setting on `SPiER-Project`, not a repo one, but note
that the repo's current maintainer (`bbthorson`) holds org `admin` — it is not
blocked on anyone else.
