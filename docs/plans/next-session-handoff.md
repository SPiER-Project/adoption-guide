# Handoff — next session

Rewritten **2026-08-18 (fourth rewrite that day)**. `main` was at **`266fd5f`**
when this was written; check rather than trust that.

⚠️ **This file's own warning has now fired three times in one day.** The version
before last opened with "no open PRs" and called the writeback ladder dead code;
both were false hours later. The version after *that* said the outstanding ladder
work had "none of it with an issue yet — file one before starting", when #350 was
open holding three of the five items — an instruction that would have produced
duplicate issues (corrected in #355). **A handoff is stale the moment work lands,
not a week later, and its confident sentences are the dangerous ones.**

The rule now has three halves:

1. **Rewrite this file in place at the end of a session.** Do not leave a new one
   in a worktree — one version was never committed at all.
2. **Rewrite it when the work it describes lands**, not only when a session ends.
3. **Verify its claims before restating them.** Every number below was re-derived
   against `266fd5f` this session, not copied forward — including the ones that
   did not change.

## State of the repo

- **No open PRs.** 37 open issues. (Both counted with an explicit `--limit`;
  `gh issue list` defaults to 30 and silently truncates.)
- `web` — `npm run verify` exits 0, **re-run on `266fd5f`**: every `check:*` gate
  green (**15** of them now — `check:patients` is new), **55 test files / 658
  tests**.
- `services/cds-hooks` — its own `verify` exits 0, **re-run on `266fd5f`**, 24
  tests. **`web`'s verify does not cover it.**
- CI green on `main`, including the post-merge `Deploy to GitHub Pages` for
  `266fd5f` — which **genuinely re-rendered** the IG rather than reusing cache
  (`ig/input` changed, so the cache key missed; `Run IG Publisher`, the CQL gate
  and the QA gate all executed). The PR-time `IG Publisher` job passed too.
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
| **#353** (`d479759`) | Handoff rewrite |
| **#354** (`25a5e36`) | Handoff reading map — the panel plans are not self-contained |
| **#355** (`e831709`) | **Four false spec-doc claims corrected**, from a conflict audit across the nine required-reading docs. Details below |
| **#356** (`266fd5f`) | **The 14 demo patients are real FHIR now.** 116 dangling `subject` references closed; two new gates |

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

### ⚠️ Read this before building `PanelShell` — the stated constraint is CONTESTED

The sentence this section used to carry, verbatim, was:

> **The one constraint to honor while building it: the panel must never assume a
> connected server.** Track 1 (the conference demo) runs on `LocalDataSource` with
> no network and no OAuth.

**That premise is under active revision as of 2026-08-18 and should not be built
to as written.** Brad's direction: the conference demo interacts with a **fake EHR
hosted on a Cloudflare Worker**, and *"don't try and solve for problems involving
lack of network connectivity."* `surfaces-and-distribution.md` §8 still defines
Track 1 as offline `LocalDataSource`, so the doc and the direction disagree. **The
decision is not recorded yet — do not resolve it by building.**

What is worth separating, because the docs conflate them and only one half is in
question:

- **Track 1 as a demo deliverable** — a rehearsed offline demo. This is what is
  being retired.
- **The interface discipline** — the panel reads through `FhirDataSource` rather
  than binding to `SmartDataSource`. This costs approximately nothing and is
  *probably* worth keeping regardless: the chart already works both ways,
  `LocalDataSource` cannot be removed anyway (all 658 tests and every gate run
  against it, and it is the no-patient "play with the forms" mode), and a demo
  with no fallback makes the mock EHR a single point of failure for the talk.

Until it is settled, build `PanelShell` so it reads through `FhirDataSource` —
that choice is cheap, is what the chart already does, and is not invalidated by
either answer.

The *Written* tab has the same fork, and it resolves automatically once Track 1
does: panel §2 says the tab "is only truthful because of §5 — it reports what
happened, not what would have", while §9 says it must degrade to "what would be
written". If there is always a mock EHR, §2 stands and §9's clause is dead.

## The embedded panel work — orientation

Two plan docs landed in #352, but **they are not self-contained** — both argue
against, re-scope, or depend on four older documents, and a session reading only
the new pair will hit references it cannot resolve. The full set, in reading
order:

### Read first — the new pair

1. **[`surfaces-and-distribution.md`](surfaces-and-distribution.md)** — shorter, and
   it frames the other. What is and is not an application (the IG is **not**; it is
   upstream of everything), the demo-vs-clinical build surface, hosting topology,
   and §8's two-track split.
2. **[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md)** — the
   panel itself. **Read §1 before agreeing to anything** (see next entry).

### Read with them — the docs they argue against or depend on

3. **[`mock-patient-smart-launch.md`](mock-patient-smart-launch.md)** —
   **not optional.** Its §6 recorded "write our own mock FHIR + SMART endpoints"
   as NOT RECOMMENDED, and the panel plan's §1 *reverses* it. Reading the reversal
   without the argument it reverses gets you a decision with no reasoning attached.
   Its §7 also carries the `Patient`-resource prerequisite and its §8 the
   population-lens gap.
4. **[`repo-and-package-boundaries.md`](repo-and-package-boundaries.md)** — §1 is
   why the IG is not an application; §5 rejected splitting the guide from the
   clinical demo, and `surfaces-and-distribution.md` §2 re-scopes that rejection
   rather than overturning it. Both new docs cite it.
5. **[`smart-filler-writeback-ladder.md`](smart-filler-writeback-ladder.md)** — the
   ladder's own plan (re-derived by #351; a reconstruction, not the lost original).
   Phase 4 of the panel plan builds directly on it.
6. **[`../smart-sandbox-testing.md`](../smart-sandbox-testing.md)** — the current
   SMART walkthrough and its three known limitations. **The panel work touches all
   three**, so this is the baseline any change is measured against.

### Read before writing code

7. **`CLAUDE.md`** (repo root) — the gate landscape. Which of the five gate classes
   catches what, why a clean SUSHI run is not a quiet one, and the standing
   "prove a gate can fail" rule. Not optional for anyone editing code here.
8. **[`fhircast-two-way-sync.md`](fhircast-two-way-sync.md)** — the existing
   FHIRcast demo. Panel plan §6 requires moving it off `BroadcastChannel`, which is
   same-origin only and will not cross the boundary the cross-origin decision
   introduces.

### Read before making claims outside the repo

9. **[`../best-practices/licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md)**
   — `surfaces-and-distribution.md` §6. Gates distribution outright and applies in
   reduced form to a conference demo.
10. **[`../use-cases/README.md`](../use-cases/README.md)** and
    [`ed-scenario-11.md`](../use-cases/ed-scenario-11.md) — the HL7 working-group
    scenario and the four ED patients (`patient-011`–`014`) whose walkthroughs a
    demo is most likely to use. ⚠️ **`ed-scenario-11.json` is the source; the `.md`
    and everything in `dist/` are generated** — edit the JSON.

### Also cited, lower priority

11. **[`ux-navigation-improvements.md`](ux-navigation-improvements.md)** — the
    navigation work the panel's stack builds on.
12. **[`code-based-mapper-dispatch-fallback.md`](code-based-mapper-dispatch-fallback.md)**
    — #230, which governs how much *foreign* QR data derives rather than landing in
    "Other activity." Matters as soon as the panel reads a real server.

[`../MANIFEST.md`](../MANIFEST.md) indexes the wider doc set, though it does not
list every plan.

### What is decided

- Deliver the pathway + tools as a SMART app in a **panel**, launched from a host
  chart. Claim is an **embedded activity**, not a persistent sidebar.
- **Cross-origin** — mock EHR on its own Worker, its own `*.workers.dev` origin.
  No DNS needed.
- The mock EHR **serves real FHIR** (reversing `mock-patient-smart-launch.md` §6).
- Guide and panel stay **one app**; the split is a build surface, not a second app.

### What is open, and matters before building

- ⚠️ **§8 — mock-serves-FHIR vs Medplum-serves-FHIR.** Still not formally
  recorded, but **leaning hard toward the mock.** Brad, 2026-08-18: *"medplum
  feels like it would be massive overkill — we're really just trying to show a
  patient list/registry, patient page, and patient encounter page."*
  **Do not build phase 4 without writing the decision down.**
  - Note the reasoning differs from §8's own criterion. §8 frames the choice as
    hinging on whether the capability-degradation demo earns its keep; the actual
    reason is scope of what the host must show. Record the real reason, or this
    gets re-litigated on a criterion nobody used.
  - Worth knowing when it is written up: in the §8 variant **Medplum would not be
    the demo application** — it would be an invisible FHIR server behind SPiER's
    own mock chrome. The choice is who implements FHIR + OAuth underneath, not
    whether to demo a full EHR.
  - The cheap-looking half is genuinely cheap: `SmartDataSource.getSlice` issues
    patient-scoped `GET Type?patient=X` across 13 types, servable from the
    existing fixtures. **The expensive half is strict write validation**, and the
    guardrail's "reuse `check-scenario-resources.mjs`" is a *port*, not reuse —
    that script is Node reading StructureDefinitions off the filesystem, and a
    Worker has no filesystem. Budget it on day one or the mock ships lenient,
    which is exactly what the guardrail exists to prevent.
- ~~§7's blocker: there are no `Patient` resources for the 14 demo patients.~~
  **CLOSED by #356.** The 14 exist as example Instances in
  `ig/input/fsh/population-patients.fsh`; the 116 `subject` references that
  dangled now resolve, gated by `check:patients` and check 8 of `check:scenarios`.
  **Phase 1 of `mock-patient-smart-launch.md` is done. Panel phase 1 is
  unblocked.**
  - Phase 2 (per-patient transaction Bundles) is still open — but **question
    whether it is needed** rather than building it because the plan lists it: a
    mock EHR reading the scenario fixtures directly may never require it.
  - Measured while doing it: there are **zero** `Practitioner`/`Organization`
    references. Performers are `display` text only, so `Patient` was the only
    subject type missing. Three docs implied otherwise (corrected in #355).
- Whether the mock ships a consent screen; where subject resources live.

### ⚠️ The reversal's guardrails are conditions, not suggestions

§1 permits a mock we control **only** with: strict validation on writes reusing
`check-scenario-resources.mjs`; a planted invalid write **seen to 422** before the
mock is trusted; and no interoperability claim ever made from a host we control.
Skip any of them and `mock-patient-smart-launch.md` §6's objection reasserts in
full — a lenient mock makes the demo look better while proving less.

## Needs a human decision, not a patch

**The two at the top block the most work.** Both came out of the #355 spec-doc
conflict audit; both are one sentence of decision and then mechanical to apply.

- ⚠️ **Is Track 1 (offline, `LocalDataSource`) retired or deferred?** See the
  `PanelShell` section above. This single answer unblocks **three** threads: the
  `PanelShell` guidance, #350's CDS `type:'smart'` link (a SMART launch link's
  whole point is the real launch path), and the *Written*-tab contradiction
  between panel §2 and §9. Until it lands, `surfaces-and-distribution.md` §8 and
  the stated direction disagree in writing.
- ⚠️ **Write down the §8 mock-vs-Medplum decision, with its real reason.** See
  above. It is "leaning mock" in conversation and "genuinely undecided" in the
  docs, which is the worst of both.
- **Four more corrections from the #355 audit are queued behind those two** and
  are mechanical once they land: panel §2 vs §9 (resolves automatically from
  Track 1), the three different urgency framings of the `Patient` task (now moot
  — #356 did it), `surfaces-and-distribution.md` §4's "transitional" IG-redirect
  comment (drop the word or file the move), and re-scoping §8's phase table.
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

Still outstanding from the ladder work. ⚠️ **Three of these are already tracked
on #350 — do not file duplicates.** #350 stayed open after #351 with exactly
these unchecked:

- **#350** — the CDS card `type:'smart'` link (which the panel plan §2 also
  wants), the adoption-pathways guide page, and live sandbox validation.
- **No issue yet** — the Tier-3 confirmation UI, and whether the demo should set
  `alwaysWriteDocument`. File before starting either.

(This paragraph previously said "none of it with an issue yet," which would have
produced three duplicate issues. `gh issue view 350` is the authority.)

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
