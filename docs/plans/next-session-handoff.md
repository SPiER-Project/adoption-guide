# Handoff — next session

Rewritten **2026-08-18 (second rewrite that day)**. `main` was at **`3c01e66`**
when this was written; check rather than trust that.

⚠️ **This file's own warning fired again, within hours.** The previous version
opened with "everything is green and nothing is in flight — **no open PRs**" and
named the writeback ladder as unreachable dead code. Both were true when written
and false by the end of the same day: #351 wired the ladder, #352 landed two plan
docs. **A handoff is stale the moment work lands, not a week later.**

The rule now has three halves:

1. **Rewrite this file in place at the end of a session.** Do not leave a new one
   in a worktree — one version was never committed at all.
2. **Rewrite it when the work it describes lands**, not only when a session ends.
3. **Verify its claims before restating them.** Every "green" below was re-run
   this session, not copied forward.

## State of the repo

- **No open PRs.** 37 open issues.
- `web` — `npm run verify` exits 0, **re-run this session**: every `check:*` gate
  green, **55 test files / 658 tests**.
- `services/cds-hooks` — its own `verify` exits 0, **re-run this session**, 24
  tests. **`web`'s verify does not cover it.**
- CI green on `main` including the post-merge `Deploy to GitHub Pages` for
  `3c01e66`, and `IG — Sushi compile + validate` for `6f37e0d`.
- The one eslint warning (`MeasureDashboard.tsx` useMemo dep) is **pre-existing**.
- ⚠️ A fresh worktree needs `npm install` in **both** `web/` and
  `services/cds-hooks/`, plus `npm run copy-fhir` in `web/`, before anything runs.

## What landed 2026-08-18

| PR | What |
|---|---|
| **#348** (`868e32c`) | Rescued `web/src/lib/writeback/` from an uncommitted worktree — merged deliberately as dead code |
| **#349** (`ff9b2f0`) | Refreshed three docs that had gone stale into saying false things |
| **#351** (`6f37e0d`) | **Wired the ladder** — `saveResponse` drives it, `WritebackScorecard` renders it, tier model corrected |
| **#352** (`3c01e66`) | Two plan docs: the embedded SMART panel, and surfaces/distribution |

**Two claims in the previous handoff are now retired**, both of which a session
could otherwise act on:

- ~~"the writeback ladder is on `main` and unreachable"~~ — **wired by #351.**
  `SmartDataSource.saveResponse` drives `buildWritePlan` + `executeWritePlan`.
- ~~"`docs/plans/smart-filler-writeback-ladder.md` is permanently gone"~~ — **#351
  re-derived it.** It is on `main`. The original was lost; the replacement is not
  the same document, so treat it as a reconstruction rather than a recovered
  original.

⚠️ **The ladder still has never had an outside review.** #351 reviewed it, but
#348's code and its tests were written by the same session. Two suspected
#327-shaped defects were checked and are **false alarms** (`answerText` reads
`valueCoding` first; `valueText` is a pre-existing repo-wide convention) — worth
knowing so they are not re-investigated.

## Take this first — `PanelShell`, for the conference demo

The near-term goal is **demonstrating at conferences**; a client ship is **not**
near-term (PoC only). That decision is recorded in
[`surfaces-and-distribution.md`](surfaces-and-distribution.md) §7–8 and it
reorders everything.

**Next concrete piece: step 3 of [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §9 — build `PanelShell`.**

The width spike (step 0) is **done** and its result is §9.1. It found the target:
**252px of chrome sits above the first question** — header, patient banner,
patient switcher, breadcrumb, `PageHeader` — which is 28% of a 900px panel spent
before anything is asked. `PanelShell` should get that to roughly 60–80px while
keeping a patient identity strip and a back affordance.

Three things the spike settled, so they are not re-litigated:

- **470px works.** Zero horizontal overflow on C-SSRS Full, before *and* after
  `enableWhen` doubles the form. `@formbox/renderer` uses comboboxes, not radio
  matrices, so the predicted narrow-width failure does not exist. Build
  width-agnostic; default to a third, resizable.
- **The panel's constraint is vertical**, not horizontal (above).
- **The code drawer is stranded, not cramped.** `.form-wrapper` is `flex-direction: row`
  and wraps, so `.debug-sidebar` lands 5604px down at panel width. The
  bottom-drawer redesign is about reachability.

⚠️ **The one constraint to honor while building it: the panel must never assume a
connected server.** Track 1 (the conference demo) runs on `LocalDataSource` with
no network and no OAuth. Build `PanelShell` against `SmartDataSource` only and the
conference demo inherits every failure mode of the cross-origin stack — captive
portals, storage partitioning, someone else's laptop. Read through
`FhirDataSource`, accept a query param when there is no SMART `intent`, and make
the *Written* tab degrade honestly to "what would be written."

## The embedded panel work — orientation

Two plan docs landed in #352. A session picking this up should read them in this
order:

1. **[`surfaces-and-distribution.md`](surfaces-and-distribution.md)** — shorter, and
   it frames the other. What is and is not an application (the IG is **not**; it is
   upstream of everything), the demo-vs-clinical build surface, hosting topology,
   and §8's two-track split.
2. **[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md)** — the
   panel itself. **Read §1 before agreeing to anything**: it reverses
   [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §6, which had
   recorded "write our own mock FHIR + SMART endpoints" as NOT RECOMMENDED.

### What is decided

- Deliver the pathway + tools as a SMART app in a **panel**, launched from a host
  chart. Claim is an **embedded activity**, not a persistent sidebar.
- **Cross-origin** — mock EHR on its own Worker, its own `*.workers.dev` origin.
  No DNS needed.
- The mock EHR **serves real FHIR** (reversing `mock-patient-smart-launch.md` §6).
- Guide and panel stay **one app**; the split is a build surface, not a second app.

### What is open, and matters before building

- ⚠️ **§8 — mock-serves-FHIR vs Medplum-serves-FHIR.** Genuinely undecided. It
  turns on whether the capability-degradation demo earns its keep; if it does not,
  the Medplum variant is strictly better and §1's reversal should be undone.
  **Do not build phase 4 without settling this.**
- §7's blocker: **there are no `Patient` resources for the 14 demo patients.**
  `patients.json` is app-shaped display data and every `subject: Patient/patient-001`
  dangles. Phases 1–2 of `mock-patient-smart-launch.md` are a **dependency** of the
  mock EHR, not an alternative.
- Whether the mock ships a consent screen; where subject resources live.

### ⚠️ The reversal's guardrails are conditions, not suggestions

§1 permits a mock we control **only** with: strict validation on writes reusing
`check-scenario-resources.mjs`; a planted invalid write **seen to 422** before the
mock is trusted; and no interoperability claim ever made from a host we control.
Skip any of them and `mock-patient-smart-launch.md` §6's objection reasserts in
full — a lenient mock makes the demo look better while proving less.

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

⚠️ **A conference demo is lower stakes than a client ship, not zero** — a talk is
the most public this project gets. Checking the specific instruments that go on a
projector is a much smaller job than the full backlog, and
[`surfaces-and-distribution.md`](surfaces-and-distribution.md) §6/§8 says so.

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

Still outstanding from the ladder work, **none of it with an issue yet** — file
one before starting: the CDS card `type:'smart'` link (which the panel plan §2
also wants), the adoption-pathways guide page, the Tier-3 confirmation UI, live
sandbox validation, and whether the demo should set `alwaysWriteDocument`.

**Deliberately parked, not drift:** the **ten** `status:built` tool epics (#20,
#23, #24, #25, #26, #168, #170, #172, #175, #176) stay open by design and carry
**no milestone** — milestones hold finishable tasks, and a per-tool epic never
finishes. TL-028/029/044/045 (#166, #167, #182, #183) are unscheduled `status:future`
placeholders, also unmilestoned. **The one exception is #164** (TL-026, Positive
Screen Flag): it is `status:planned` and *does* sit in M4 (CDS automations), so it
is the only one of the group that is actually scheduled.

`measures.narration.test.ts`'s `EXPLAINED_MISSES` allowlist is **empty**, which is
the finding rather than an omission: every remaining measure miss among the ED
patients is a pass, an exclusion or an exception. It does **not** assert that a
step materializes every resource type it names — 21 completed steps name a
SPiER-profiled type with no artifact behind it, filed separately.

## Standing repo rules that keep paying off

- **Prove a gate can fail before trusting it.** Every gate added in the last stretch was verified by planting the defect it targets. There are now several distinct silent-pass mechanisms in this repo; a green gate you have never seen go red is not evidence of anything.
- ⚠️ **A squash merge makes `is-ancestor` lie.** New, 2026-08-18: a plan doc asserted work was unmerged on the strength of `git merge-base --is-ancestor <branch-sha> main`. The work had landed — squash-merged under a *different* SHA — and the local `main` ref was stale besides. That check answers "no" both when work is genuinely unmerged and when it merged under a new hash. **`git fetch origin main` first, and use `gh pr list --head <branch>` to decide;** the local ref is not the authority. This produced two corrections to the same paragraph in one day.
- **Verify against the source, not memory, and re-derive the issue before planning.** Every issue picked up recently had at least one premise that had gone stale — twice that made the work smaller, once it changed the answer. None was wrong when filed.
- **A test can encode the wrong assumption and then defend it.** #327 is the sharpest case: `cssrsScreener.test.ts` asserted C-SSRS items are plain booleans and built fixtures to match, so a green suite certified a mapper against input the app never produces. `check:readers` is the class-level fix; `__fixtures__/nativeQr.ts` derives shapes from the Questionnaire rather than restating them.
- **A worktree is scratch space, not storage.** Anything that must survive gets committed to a branch the same session. Untracked files in an abandoned worktree are invisible to every gate, and `git worktree remove` takes them with it. This cost one plan doc permanently (#351 re-derived a replacement, which is not the same thing).
- **Don't pin a count in prose.** `CLAUDE.md` said "eleven drift checks" while `verify` ran fourteen. The list is now the source of truth and carries no number — the same reasoning as matching SUSHI warning *shape* rather than count, and the same failure as a stale `check:codings` floor (#232).
- **Watch the post-merge run, not just the PR's.** `pull_request` CI tests the merge with `main` as it stood when the run happened, not at merge time.
- **`services/cds-hooks` has its own verify** that `web`'s does not cover.
