# Handoff — next session

Rewritten **2026-08-18**. `main` was at **`efd0e5f`** when this was written; check
rather than trust that.

⚠️ **This file went stale for seven days and told three sessions that shipped work
was still pending.** The previous version was written 2026-08-11 and named #327 as
"take this first"; #327 merged 2026-08-13 as #334, #324 as #340, and every issue in
its "not triaged here" list closed the same day. Nothing was wrong when written —
it simply was not rewritten when the work landed, and a handoff that describes a
week-old board is worse than no handoff, because it reads as current.

The rule from the version before this one still stands and now has two halves:
**rewrite this file in place at the end of a session** (do not leave a new one in a
worktree — that version was never committed at all), **and rewrite it when the work
it describes lands**, not only when a session ends.

## State of the repo

Everything is green and nothing is in flight:

- **No open PRs** except the writeback rescue below. All 36 open issues, zero open PRs otherwise.
- `web` — `npm run verify` exits 0: every `check:*` gate green, 48 test files / 607 tests. (The rescue branch below adds 5 files / 28 tests on top, so 53 / 635 there.)
- `services/cds-hooks` — its own `verify` exits 0, 24 tests. **`web`'s verify does not cover it.**
- CI green on `main`, including the nightly external-terminology check.
- The weekly roadmap snapshot opened its own PR (#347), so the `ROADMAP_PR_TOKEN` PAT is still live — when it expires this silently reverts to the hand-opened path.
- The one eslint warning (`MeasureDashboard.tsx` useMemo dep) is **pre-existing**.

### Repo hygiene, done 2026-08-18

Many parallel sessions had left a large mess behind the working tree. It is now clean:

- **Local branches 180 → 2** (`main` plus the rescue branch); **the remote is `main`-only**, down from 77 stale branches. Every deletion was classified first — merged PR, or its diff reverse-applies against `main` — never by age. Four that failed the automated test were checked by hand and all four were stale-base copies of landed work. Tips of all 180 are recorded in `~/spier-branches-backup-2026-08-18.txt`; GitHub also keeps `refs/pull/<n>/head` forever, so any merged-PR branch is recoverable from its PR.
- ⚠️ **41 of those 77 "remote" branches were phantoms** — already deleted on GitHub, lingering as unpruned `org/*` tracking refs, because `origin` and `org` point at the **same URL** and only `origin` had ever been pruned. `git remote prune org` is the fix, and `gh api repos/.../branches` is the authority; `git branch -r` is not.
- Both stale worktrees are gone. Note that `git worktree remove` deletes that worktree's `.git/worktrees/<name>/logs/HEAD` — one of the two records that identify which session moved a ref, per the stale-root note in `CLAUDE.md`. Do the diagnosis before the cleanup, not after.

## Take this first — PR #348, the writeback ladder rescue

**Not a feature; a decision.** `web/src/lib/writeback/` — 7 modules, 5 suites, 28
tests — was written 2026-07-14 and left as **untracked files** in a worktree on a
branch 121 commits behind `main`. No commit, no branch, no PR, no issue, and
nothing named `writeback` anywhere in `main`, so **no gate or CI job could have
surfaced it**; it was found by walking the worktrees by hand. It is now committed
and CI-green on `claude/writeback-ladder-rescue`.

What the reviewer has to decide is whether ~1300 lines of currently-unreachable
code belong in `main`. Merging makes it durable and puts it under CI; leaving it on
the branch keeps `main` free of dead code but is exactly how it was lost the first
time.

Two things to know before touching it:

- ⚠️ **Its plan doc, `docs/plans/smart-filler-writeback-ladder.md`, is permanently gone** — never committed to any branch, absent from every dangling commit, worktree discarded. The commit message and PR body now carry the four tier decisions (DocumentReference floor → Observation → QuestionnaireResponse → opt-in Condition proposal, default OFF) because they are the only surviving record.
- ⚠️ **`smartDataSource.ts` had to be reconciled by hand.** `main` had grown `patientRefField`, `withPatientLink` and `LIFECYCLE_RESOURCE_TYPES` in the interim. All of main's work was kept; the July side contributed only `implements FhirDataSource, WritebackTarget`. Committing the stale copy wholesale would have reverted a month of changes while looking additive — the #300 failure mode. **Never use a stranded worktree's copy of a shared file as the base.**

Still outstanding from the lost plan: the `WritebackScorecard` UI, the CDS card
`type:'smart'` link, the adoption-pathways guide page, live sandbox validation —
and a genuine review, since the code has never had a second pair of eyes.

## Needs a human decision, not a patch

- **#303 — `p007-stanley-brown` is a stub** (no `activity`) named after a profile it doesn't conform to. It *limits* how strong #289's invariant can be: it is why `spier-episode-trigger-on-positive-screen` covers only `positive-screen` and not `elevated-assessment`. Renaming is probably right, but which way depends on what that fixture is meant to represent. **Do not guess it; ask.**
- **#231 — the CDS service's auth posture.** Narrower than filed. `require` is implemented and unit-tested and is one `wrangler.jsonc` var; the app itself only fetches discovery (open either way), so flipping would break the guide's own published curl and any CDS Hooks Sandbox trial, not the demo UI. The guide page and README already state warn mode — what is missing is that both frame it as *transitional* and nobody has scheduled the flip. Declaring warn deliberate (a two-line doc change) looks right, but it is a security posture and so is Brad's call.
- **#326 — clinical review of ED Scenario 11**: 10 proposed steps, 3 new patient courses, one open note. Not a code task.
- **#93 — SME sign-off on all six risk-tier crosswalks.** Not a code task, and it **blocks #264**.

## Blocked

- **#264 — crosswalk fidelity in the data dictionary**, on #93. The `fidelity`-derived-from-ConceptMap half could land early, but presenting fidelity as settled is the failure mode the issue warns about. #317 left the obvious landing spot: the value cell in both binding tables carries the system and the bindable set, and fidelity qualifies exactly that pair. **No column was stubbed for it — an empty column is a claim of its own.**

## Untriaged: the upstream Behavioral Health IG thread

Three issues filed 2026-08-13, none started, all arising from #325's alignment
work against the HL7/ASTP US Behavioral Health Profiles IG:

- **#337** — report that IG's build defects upstream (5 findings, 3 candidate channels). Outreach, not code. See `docs/research/2026-08-us-behavioral-health-profiles-ig.md`; note #342 corrected that doc — the upstream tracker is *disabled*, not unattended.
- **#338** — offer SPiER's C-SSRS Questionnaire as the canonical target for their C-SSRS example, which is currently a PDF.
- **#339** — a "BHP bridge" demo: run their own C-SSRS through SPiER's full pathway. This one is real code, and #323/#325 already did the groundwork (`itemsByCode` reads a `linkId` that is itself a LOINC code, which is the only place their published QRs carry one; their examples are checked in under `__fixtures__/`).

## The quietest risk: licensing (#64)

`docs/best-practices/licensing-verification-backlog.md` is blunt about it, and it
is worth reading before quoting any licensing status to a partner. **Zero of 43
ActivityDefinitions have been verified against what the rights holder publishes
today.** Four instruments have no audit memo at all — CAMS, Stanley-Brown, SBQ-R,
PHQ-9 — and two of those are restrictive. Stanley-Brown's own recorded notice
requires written permission "for use of the form in the electronic medical record",
which is precisely what SPiER publishes. **#64 gates the org-namespace transfer.**

#220 is the cautionary precedent for the whole class: a plausible assertion that
nothing verified reads exactly like a verified one.

## Actionable code work, unblocked and unclaimed

Nothing here is urgent; listed so it is not re-derived each session.

| Issue | What | Milestone |
|---|---|---|
| #126 | Decompose `PatientChart.tsx`; split `PatientContext` concerns | M7 |
| #125 | Consolidate hardcoded example Observations into IG example instances | M7 |
| #228 | [TL-009] Write the handoff-content-item checklist from the transition recorder | M3 |
| #128 | Export a configured pathway as a FHIR Bundle (Preset → PlanDefinition subset) | M5 |
| #277 | [Epic] Suicide Care Dashboard — a CoCM registry spec and the five gaps it exposes | — |
| #259 | [Epic] Data dictionary: two-layer concept model, cross-stage correlation | — |

**Deliberately parked, not drift:** the **ten** `status:built` tool epics (#20,
#23, #24, #25, #26, #168, #170, #172, #175, #176) stay open by design and carry
**no milestone** — milestones hold finishable tasks, and a per-tool epic never
finishes. TL-028/029/044/045 (#166, #167, #182, #183) are unscheduled `status:future`
placeholders, also unmilestoned. **The one exception is #164** (TL-026, Positive
Screen Flag): it is `status:planned` and *does* sit in M4 (CDS automations), so it
is the only one of the group that is actually scheduled. The roadmap `status:`
labels were reconciled and are correct as of 2026-08-18.

`measures.narration.test.ts`'s `EXPLAINED_MISSES` allowlist is **empty**, which is
the finding rather than an omission: every remaining measure miss among the ED
patients is a pass, an exclusion or an exception. It does **not** assert that a
step materializes every resource type it names — 21 completed steps name a
SPiER-profiled type with no artifact behind it, filed separately.

## Standing repo rules that keep paying off

- **Prove a gate can fail before trusting it.** Every gate added in the last stretch was verified by planting the defect it targets. There are now several distinct silent-pass mechanisms in this repo; a green gate you have never seen go red is not evidence of anything.
- **Verify against the source, not memory, and re-derive the issue before planning.** Every issue picked up recently had at least one premise that had gone stale — twice that made the work smaller, once it changed the answer. None was wrong when filed.
- **A test can encode the wrong assumption and then defend it.** #327 is the sharpest case: `cssrsScreener.test.ts` asserted C-SSRS items are plain booleans and built fixtures to match, so a green suite certified a mapper against input the app never produces. `check:readers` is the class-level fix; `__fixtures__/nativeQr.ts` derives shapes from the Questionnaire rather than restating them.
- **A worktree is scratch space, not storage.** Anything that must survive gets committed to a branch the same session. Untracked files in an abandoned worktree are invisible to every gate, and `git worktree remove` takes them with it. This cost one plan doc permanently.
- **Don't pin a count in prose.** `CLAUDE.md` said "eleven drift checks" while `verify` ran fourteen. The list is now the source of truth and carries no number — the same reasoning as matching SUSHI warning *shape* rather than count, and the same failure as a stale `check:codings` floor (#232).
- **Watch the post-merge run, not just the PR's.** `pull_request` CI tests the merge with `main` as it stood when the run happened, not at merge time.
- **`services/cds-hooks` has its own verify** that `web`'s does not cover.
