# Handoff — next session

Rewritten **2026-08-18 (sixth rewrite that day)**. `main` was at **`1901c0e`**
when this was written; check rather than trust that.

⚠️ **Six rewrites in one day is itself the finding.** Four of the last five
merges made this file wrong within the hour — twice it still said "take
`PanelShell` first" or "take the code drawer first" after those merged. The
durable fix is probably to shrink this file to the open *decisions* and the
standing *rules*, and let `git log` and the plan docs' own status tables carry
state. Until someone does that, assume the "what landed" and "take this first"
sections are the stalest things here and check them against `main` first.

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
- `web` — `npm run verify` exits 0, **re-run on `1901c0e`**: every `check:*` gate
  green (**15** of them; `check:patients` is the newest), **57 test files / 673
  tests**. `check:template` reports **2 inset owners**.
- `services/cds-hooks` — its own `verify` exits 0, **re-run on `1901c0e`**, 24
  tests. **`web`'s verify does not cover it.**
- CI green on `main`, including the post-merge deploys for `266fd5f` and
  `3832e18`. The `266fd5f` deploy **genuinely re-rendered** the IG rather than
  reusing cache (`ig/input` changed, so the key missed; `Run IG Publisher`, the
  CQL gate and the QA gate all executed).
- ⚠️ **A `web/src/App.tsx` change triggers `use-case-workbook.yml`**, which is
  easy to be surprised by. That gate resolves tool launch paths against
  `App.tsx`, so a route-table edit is within its blast radius — #358's shell swap
  set it off, and it passing is what confirmed launch-path resolution still
  worked.
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
| **#357** (`02e7671`) | Handoff refresh — flagged the contested `PanelShell` premise |
| **#358** (`3832e18`) | **`PanelShell` — 252px of chrome above the first question down to 76px.** Chrome-mode seam, `INSET_OWNERS` gate |
| **#359** (`e94bfc5`) | Handoff + panel plan re-pointed at the code drawer |
| **#360** (`1901c0e`) | **Code drawer — the FHIR view was stranded ~3000px below the form; now one tap from any scroll position.** Panel step 3 complete |

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

## Take this first — `services/mock-ehr/`, the read API (panel step 1)

⚠️ **The previous version of this file said nothing on the panel path was
unblocked. That is no longer true — §8 was settled 2026-08-18.**

Two decisions landed, and between them they unblock everything:

- **§8 — the mock serves FHIR.** `services/mock-ehr/` on its own Worker; the
  Medplum variant is rejected. Reason, costs and binding guardrails in
  [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §8.
- **Track 1 — the offline demo is retired**, the interface discipline is kept.
  [`surfaces-and-distribution.md`](surfaces-and-distribution.md) §8.

| Panel step | State |
|---|---|
| 0 — width spike | **Done** (§9.1) |
| **1 — mock EHR read API + `/metadata`** | **NEXT.** Was blocked on `Patient` resources; #356 closed that |
| 2 — SMART authorize/token stub | Unblocked, after 1 |
| **3 — `PanelShell`, nav stack, code drawer** | **Done** — #358, #360 |
| 4 — writes + capability degradation | Unblocked, after 2. The ladder driver is already on `main` |
| 5 — host chrome, launch button, CDS `type:"smart"` card | Unblocked |
| 6 — FHIRcast across the origin boundary | Unblocked |

### What step 1 is, and the one thing that will be underestimated

`SmartDataSource.getSlice` issues patient-scoped `GET Type?patient=X` across **13
resource types**. Serving them from the scenario fixtures is one route, a filter
and a Bundle envelope — `services/cds-hooks` already imports those fixtures via
`import.meta.glob`, so the pattern exists. `/metadata` is trivial and is also the
degradation demo, since we control it.

⚠️ **The expensive part is strict write validation (step 4), and its cost is
understated everywhere it is written down.** The guardrail says "reuse
`check-scenario-resources.mjs`" — that script is **Node, reading generated
StructureDefinitions off the filesystem**, and a Worker has no filesystem. It is
a **port**, not reuse. Budget it when step 4 starts, or the mock ships lenient,
which is exactly the failure `mock-patient-smart-launch.md` §6 predicted.

### Three guardrails that are conditions of the §8 decision, not advice

1. **Strict validation on writes**, reusing the profile checks
   `check-scenario-resources.mjs` performs (see the porting note above).
2. **A planted invalid write seen to 422** before the mock is trusted — the
   repo's "prove a gate can fail" rule, applied to a server.
3. **No interoperability claim ever made from a host we control.** The
   portability claim is made separately, by loading the same Bundles into a
   *public* sandbox.

⚠️ **A new deployable outside the gate net will rot.** `services/cds-hooks/` has
its own CI-gated `verify` because `web/`'s does not cover it. `services/mock-ehr/`
needs the same **on day one** — more urgently, because it reads the scenario
fixtures and will break silently when those are re-anchored by
`web/scripts/shift-scenario-dates.mjs`.

### What step 3 settled, so it is not re-derived

- **Chrome mode is a context, not a route fork.** `PresentationContext` + `Shell`
  behind one `<Route element={<Shell/>}>`, so every route is reachable in both
  chromes by construction. `?embed=1` on the **real query string** (not the hash
  — that is what survives `HashRouter` navigation) is the testing path;
  `setChromeMode` is the seam for `/redirect` to set from a SMART `intent`.
- **The panel reads through `FhirDataSource`**, so it is not coupled to a
  connected server whichever way Track 1 lands.
- **`check:template` has `INSET_OWNERS`** — an allowlist-with-reasons. RULE 4a
  asserts every declared owner pads unconditionally. **A third entry should feel
  expensive.**
- **Panel `.page-header` rules live in `PageHeader.css`**, because RULE 1 rejects
  them anywhere else. The panel is a *variant of the one header*.
- **`CodeDrawer` replaced `.debug-sidebar` in all 12 views**, same children, so
  EHR chrome is unchanged. Panel gets a bottom drawer, collapsed until asked for.

### Two z-index decisions that are now deliberate, and must stay so

Touching panel CSS means touching these. Both were measured, not reasoned:

- `.panel-shell__patient` is **`z-index: 1`** — *below* the renderer's combobox
  popover (`10`). It shipped at `10`, which left them equal, so paint order
  decided rather than intent. A combobox low in a long instrument flips to open
  upward into the strip's band, so the popover must win. (Recorded honestly: the
  hazard was fixed by construction, never observed firing.)
- `.code-drawer` is **`z-index: 20`** — *above* the popover, the opposite answer
  to the same question, because the drawer is something the user explicitly
  opened.

### One measurement lesson worth keeping

The drawer's clearance shipped as `padding-bottom: var(--space-8)` (32px) against
a bar rendering 34px — **-2px**, invisible only because the content happened not
to reach that low. It is now `--code-drawer-bar-height`, one definition and two
consumers. **A padding guessed to match a height maintained elsewhere is the
hand-duplicated-constant failure this repo keeps catching**; derive it instead.

### The *Written* section — fork resolved, nothing to build

It renders only a real `WritebackReport`. §9's "what would be written" fallback
was forked on Track 1; **with the offline track retired there is always a server**,
so panel §2 governs — the tab reports what *happened*, never a hypothetical. The
existing empty state ("nothing written back yet") is the correct and final
behaviour. ✅ Nothing further to build here.

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

- ✅ ~~**§8 — mock-serves-FHIR vs Medplum-serves-FHIR.**~~ **DECIDED 2026-08-18:
  the mock serves FHIR.** `embedded-panel-smart-launch.md` §8 records the reason
  (scope of what the host must be — NOT the degradation-demo criterion the
  section originally proposed), the cost breakdown, and three binding guardrails.
  The Medplum variant is rejected; the portability claim moves to a public
  sandbox instead.
- Whether the mock ships a consent screen; where subject resources live.

### ⚠️ The reversal's guardrails are conditions, not suggestions

§1 permits a mock we control **only** with: strict validation on writes reusing
`check-scenario-resources.mjs`; a planted invalid write **seen to 422** before the
mock is trusted; and no interoperability claim ever made from a host we control.
Skip any of them and `mock-patient-smart-launch.md` §6's objection reasserts in
full — a lenient mock makes the demo look better while proving less.

## Needs a human decision, not a patch

**The two that blocked the most work are now settled** (2026-08-18) and kept here
struck through, because both had been "decided in conversation, undecided in the
docs" — the state that produced the contradictions the #355 audit found.

- ✅ ~~**Is Track 1 retired or deferred?**~~ **SETTLED 2026-08-18** — the offline
  demo is retired, the `FhirDataSource` discipline is kept (already true of
  `PanelShell`). `surfaces-and-distribution.md` §8.
- ✅ ~~**Write down the §8 mock-vs-Medplum decision.**~~ **SETTLED 2026-08-18** —
  the mock serves FHIR. `embedded-panel-smart-launch.md` §8, which records the
  real reason (scope of what the host must be) rather than the criterion the
  section originally proposed.
- **Two corrections from the #355 audit remain**, now unblocked by the above and
  mechanical: `surfaces-and-distribution.md` §4's "transitional" IG-redirect
  comment (drop the word or file the move), and §8's phase table, which still
  lists phases B–D as deferred "because no client ship is near-term" — true, but
  it now sits beside a retired track split and should be re-read as a whole.
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
