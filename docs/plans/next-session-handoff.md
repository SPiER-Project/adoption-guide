# Handoff — next session

Rewritten **2026-08-20**. `main` was at **`7e5e1ef`** when this was written,
confirmed against `origin/main`; check rather than trust that. **Two stacked PRs
are open on top of it** — see the state section. Every number below was
re-derived, not copied forward.

⚠️ **Eleven rewrites across two days is itself the finding.** Six on 2026-08-18
alone; four of five merges that day made this file wrong within the hour, twice
still saying "take `PanelShell` first" or "take the code drawer first" after
those merged. The durable fix is probably to shrink this file to the open
*decisions* and the standing *rules*, and let `git log` and the plan docs' own
status tables carry state — **that restructure is still not done, and every
rewrite since has made the case for it stronger.** Until someone does it, assume
the "what landed" and "take this first" sections are the stalest things here and
check them against `main` first.

⚠️ **This file's own warning fired three times on 2026-08-18 alone.** The version
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

- **Two open PRs, and the second is STACKED on the first.** #375 (panel step 5,
  `claude/panel-step-5-host-chrome`, all checks green) and the step-4 branch on
  top of it. **37 open issues.**
  ⚠️ Squash-merging #375 will need the rebase recipe below before step 4 can
  merge — this repo does not delete merged branches, so GitHub will not
  auto-retarget and the step-4 diff would re-apply step 5's commits.
  (Both counted with an explicit `--limit`; `gh issue list` defaults to 30 and
  silently truncates.)
- `web` — `npm run verify` exits 0 **on the step-4 branch**: every `check:*` gate
  green, **60 test files / 708 tests**. (No count of the gates here on purpose —
  `CLAUDE.md`'s list is the source of truth, and the number it used to pin went
  stale.)
- `services/cds-hooks` — its own `verify` exits 0, **32 tests**. **`web`'s verify
  does not cover it.**
- `services/mock-ehr` — its own `verify` exits 0, **107 tests**, its own
  `mock-ehr` CI job in `web-lint.yml`. `web`'s verify does not cover it either.
  **There are three `verify`s in this repo and `web`'s covers one of them.**
- ⚠️ **CI now runs `npm run verify` for all three packages** rather than
  re-listing its steps (#368). Before that, the `web` job hand-listed a subset
  and **eight gates ran only on developer machines** — `check:template`,
  `check:patients`, `check:fallback`, `check:measures`, `check:reassessment`,
  `check:dates`, `check:ucum`, `check:fhir-r5`. A gate added to `package.json`
  is now enforced automatically; **do not re-expand that job into individual
  steps.**
- CI green on `main`, **including the post-merge runs for `c501c73`, `9ad230e`,
  `b877e21`, `9d0207d`, `fe5c2cd`, `fa2a503`, `be59ce5` and `9a34eba`** — watched, not
  assumed.
- ⚠️ **A squash-merged stack needs a rebase, and this repo does not delete
  merged branches.** #366 was stacked on #365's branch. Squash-merging #365
  produced a new SHA on `main` while `claude/mock-ehr-read-api` still existed,
  so GitHub did **not** auto-retarget #366 and its diff would have re-applied
  step 1's commits. The fix that worked: `git rebase --onto origin/main <old
  base> <branch>`, confirm `git diff <old tip> HEAD` is **empty** (same content
  CI already validated), re-run the verifies, `--force-with-lease`, then
  `gh pr edit --base main`. Full CI re-ran on the rebased SHA before merging.
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
| **#361** (`7d5356a`) | Handoff: panel step 3 done |
| **#362** (`ad3ffe0`) | **§8 settled — the mock serves FHIR; the offline track is retired** |
| **#363** (`c6af8fd`) | The step-1 read API spec, plus three corrections to what the panel plan said about it |

## What landed 2026-08-19

| PR | What |
|---|---|
| **#365** (`c501c73`) | **Panel step 1 — `services/mock-ehr/`.** A FHIR read API over the app's own scenarios, on its own Worker. Two findings the derived spec could not have had; **filed #364** |
| **#366** (`9ad230e`) | **Panel step 2 — the SMART launch.** `/authorize` + `/token`, PKCE S256 verified, patient-bound tokens, `frame-ancestors` on the panel host. Also settled the consent-screen question |
| **#368** (`b877e21`) | **Eight gates were running only on developer machines**, and one of them could not run on the repo's own Node version. CI now calls `npm run verify` |
| **#367** (`9d0207d`) | Handoff refresh |
| **#369** (`fe5c2cd`) | **Three defects only a browser launch could find** — see below |
| **#370** (`f81cab0`) | Handoff refresh |
| **#371** (`fa2a503`) | **`PatientProvider` decomposed, 558 → 209** — four hooks out, and the #263 save path finally gated. #126's premise had inverted; see below |
| **#372** (`be59ce5`) | Handoff refresh |
| **#373** (`9a34eba`) | **`PatientChart` 531 → 201** — three inline sections out. **#126 is closed** |
| **#374** (`7e5e1ef`) | Handoff refresh |
| **step 5** (#375, open) | **Host chrome + the framed panel.** `/chart` + `/chart/{id}` on the mock, CDS card `type: "smart"`, `intent` → tool routing, `need_patient_banner` honored. **The iframe claim is settled** |
| **step 4** (open, stacked) | **Writes + the degradation demo.** `POST`/`PUT` on the mock, validated by the SAME rules as `check-scenario-resources.mjs`, a Durable Object with reset. **A real submit wrote QR + 4 Observations; flipping the profile degraded it to QR + the floor** — see below |

**Two claims in the previous handoff are now retired**, both of which a session
could otherwise act on:

- ~~"the writeback ladder is on `main` and unreachable"~~ — **wired by #351.**
  `SmartDataSource.saveResponse` drives `buildWritePlan` + `executeWritePlan`.
- ~~"`docs/plans/smart-filler-writeback-ladder.md` is permanently gone"~~ — **#351
  re-derived it.** It is on `main`. The original was lost; the replacement is not
  the same document, so treat it as a reconstruction rather than a recovered
  original.

⚠️ **Nothing on this path has had an outside review, and the pile is growing.**
The ladder, the scorecard, `PanelShell`, the code drawer, `services/mock-ehr/`
and now an **authorization stub** were each written and checked by the same
session that designed them. Planting defects before trusting a gate is the
strongest thing available from inside — 8 were planted against the auth stub
alone, and all 8 were caught — but it is not the same as another reader, and
auth is the worst place for that gap — **and it is now deployed to a public
origin**, which raises the stakes without changing the evidence. Two suspected
#327-shaped defects in the
ladder were checked and are **false alarms** (`answerText` reads `valueCoding`
first; `valueText` is a pre-existing repo-wide convention) — recorded so they
are not re-investigated.

## Take this first — the panel plan is DONE except step 6

✅ **The deploy happened, and the launch works.** This section said for two
rewrites that deploying was the bottleneck. It is done:

| | |
|---|---|
| Mock EHR | **https://spier-mock-ehr.bbthorson.workers.dev** — control page, FHIR API, SMART auth |
| Panel | **https://spier-adoption-guide.bbthorson.workers.dev** — launched from the mock |

Verified in a real browser, end to end: mint a launch on the control page →
the app's `/launch` → fhirclient `authorize()` → the mock's `/authorize` →
back with a code → `ready()` exchanges it at `/token` with PKCE → the chart
renders patient-011 (Maria Alvarez, RISK HIGH, `SMART` badge, 7 of 8 stages
with activity) read live from the mock. No console errors. Also probed over the
network: CORS preflight 204, wrong verifier → 400, foreign patient → 403,
unregistered `redirect_uri` → 400 **with no `Location` header**.

⚠️ **The mock is deployed from local `wrangler deploy`, not from CI.** The panel
redeploys itself from `main` through the Cloudflare dashboard integration; the
mock does not. **After merging anything under `services/mock-ehr/`, run
`npm run deploy` there** or the live host silently keeps serving the old build.
`MOCK_SIGNING_SECRET` is **not set**, so it falls back to the obvious
development value in `tokens.ts` — fine (it protects nothing real, the data is
synthetic) but worth knowing before anyone reasons about it as a control.

| Panel step | State |
|---|---|
| 0 — width spike | **Done** (§9.1) |
| 1 — mock EHR read API + `/metadata` | **Done and deployed** |
| 2 — SMART authorize/token stub | **Done and deployed**, proven in a browser |
| 3 — `PanelShell`, nav stack, code drawer | **Done** — #358, #360 |
| **4 — writes + capability degradation** | **DONE** (open PR, stacked on #375). Three defects the spec's endpoint table hid; two things deliberately NOT verified — see below |
| 5 — host chrome, launch button, CDS `type:"smart"` card | **DONE** (#375). The iframe claim is settled |
| **6 — FHIRcast across origins** | **Unstarted, and now the only panel step left.** §6: `BroadcastChannel` will not cross the boundary, so this is `postMessage` with strict origin checks at the floor — or a real FHIRcast hub on a Durable Object, which is now cheap because step 4 added one |

### ✅ Step 4 — the ladder writes to a real server, and degrades on demand

A real PSS-3 filled in the panel and submitted twice, against two local origins
with writes persisted in a Durable Object. Full numbers in the plan's new **§5.1**;
the short version:

| Profile | What landed |
|---|---|
| `full` | Encounter (PUT, client id) + QuestionnaireResponse `srv-2` + **4** Observations `srv-3…6` |
| `no-observation` | QuestionnaireResponse `srv-7` + **DocumentReference `srv-8`** — Tier 2 skipped, the floor fired |

⚠️ **The provenance check is the part worth keeping.** All four Observations came
back with `derivedFrom: ["QuestionnaireResponse/srv-2"]` — the **server's** id,
not the client's. That is `execute.ts`'s remap, and it is untestable against a
server that echoes the client's id back, which is why the store mints `srv-N`.
Verified by reading the resources off the mock, not by trusting the scorecard.

**Three defects the spec's own endpoint table hid**, each masked by the one
before, and all three invisible to every suite:

1. **§4 lists `POST` only, but the app PUTs.** `saveArtifact` PUTs the eight
   lifecycle types (update-as-create) so open→close converges on one resource.
   The first real submit died on the CORS preflight — `Prefer` was not in
   `allowHeaders`, `PUT` not in `allowMethods` — and every `curl` succeeded
   throughout.
2. **The capability profiles were modelled on the ladder alone.** Gating PUT
   against the *create* list refused every lifecycle write **even under `full`**.
   `update` is now a second axis, permitted by every profile but `read-only`.
3. **The merged read view double-counted upserts** — a PUT replacing a fixture
   returned both versions, so a chart would show one episode active *and*
   finished.

**Guardrail 1 is satisfied by sharing, not porting.** The per-resource rules moved
to `web/scripts/lib/fhir-resource-rules.mjs`; the scenario gate and the mock's
write endpoint now call the same code. The README's claim that this "would have to
be a port, not a reuse" was true of the script and false of the rules — they need
the conformance resources only as data, and `import.meta.glob` gives a Worker
exactly that. Seven planted defects (one per rule class) still fail the scenario
gate after the move, and pointing the glob at a nonexistent prefix makes the
validator **fail to load** rather than accept everything.

⚠️ **Two things were NOT verified, and one of them is the profile a sceptic will
pick.** `read-only` end to end: the server refuses everything (tested), and by
reading the code a submit should then *fail* rather than degrade, because
`saveArtifact`'s PUT sits outside the ladder and throws. Arguably correct —
nothing landed *is* a failed save — but nobody has watched it. And **Durable
Object persistence across isolates**, which is the property the DO exists for and
the one `wrangler dev` cannot show: it runs a single isolate.

### ✅ The frame claim is settled — and what proving it cost

For two rewrites this section said the panel had never been loaded in an iframe,
because the mock had no host chrome to embed it in. **It has now**, on two local
origins with a real OAuth round trip and a real CSP: the panel renders framed,
the SMART sequence completes *inside the frame*, and the pathway draws from 15
live cross-origin reads. Measurements and the full observation table are in the
plan's new **§6.1** rather than restated here.

⚠️ **`frame-ancestors` was also proven to bite**, by pointing it at the wrong
port and watching the browser refuse to frame. A header only ever observed
permitting things is not evidence — this repo's own rule, applied to a config
line rather than a gate.

**Two defects no suite could see, and both are the same shape as #369's:**

1. **`fhirclient` warned that it was guessing.** Launched inside a frame with no
   `completeInTarget`, it logs *"please be explicit"* and infers `true`. The
   inference was right; the wrong value would `postMessage` the callback to
   `parent` with the **panel's** origin as `targetOrigin`, which a cross-origin
   host can never receive — the launch hangs with no error and no failed
   request. Now set explicitly.
2. **Two tools sharing a launch path put two identical links on a card — and had
   since the cards were built.** TL-042 and TL-043 both launch `/guide/measures`
   with the same label, and the link list ran over *tools*, so every patient at
   `measure-and-share` got two byte-identical buttons **in the app too**.
   `spier-router-paths` is keyed by URL and silently collapsed the pair, so only
   the visible list was doubled. Fixed to one link per destination.

⚠️ **A third thing is a known gap rather than a fix: Safari.** The embed flag has
to survive the OAuth redirect (which replaces the query string), so it is kept in
`sessionStorage` — and under full third-party storage blocking that access
throws. So does `fhirclient`'s own OAuth state, so in that browser the *launch*
does not complete at all, not just the chrome. **Untested there.** Check it before
demonstrating on someone else's laptop; it is the one remaining way the framed
panel can fail on a machine that is not this one.

### What #369 found, and why it matters more than the fixes

Three defects, all found by *looking at the deployed thing*, none catchable by
the suites that were passing the whole time:

1. **"Invalid Date Invalid Date" on every SMART-read QuestionnaireResponse.**
   The `StoredResponse` wrapper carries `completedAt`; **not one of the 20
   scenario QRs carries `authored`**. Fixed in both origins — the mock supplies
   it from the wrapper, and `formatDateTime` now returns an em dash for
   anything unparseable, because a real EHR need not send `authored` either.
2. **The banner showed `MRN patient-011`** for a patient whose MRN is `11011`,
   while the local data source showed the real number on the same chart.
   `readSmartPatientSummary` never read `Patient.identifier`.
3. The mock's control page still claimed "no authorization yet".

⚠️ **All three sit in seams no test was looking at**: wrapper metadata the FHIR
resource lacks (1), and presentation nothing asserts (2). 678 web tests, 61 mock
tests and every drift gate were green throughout. **1 and 2 are the same class
as the missing `subject`** — see #364, which now owes three fixture fields, not
one, and whose closure should delete both `NORMALIZED_LINKS` and
`NORMALIZED_AUTHORED` from `services/mock-ehr/src/fixtures.ts`.

### What step 2 built, and what it deliberately did not

Verified, because a stub that skips these proves nothing: **PKCE S256**
(challenge required, verifier checked with real SHA-256), **exact
`redirect_uri`** matching with an unregistered one *refused rather than
redirected to* (the open-redirect bug), **`aud`** naming this server, and a
**token bound to one patient** — reaching for another is a 403.

⚠️ **PKCE can be defeated by omission, not just by laziness.** fhirclient only
sends a challenge when discovery advertises
`code_challenge_methods_supported: ["S256"]`. Delete that array and the client
stops sending PKCE, the server stops requiring what never arrives, and the login
still works. Two halves of one decision; both are asserted.

Deliberately NOT done, and **not to be described as working**: no `id_token`
(so `client.user` is null), **no scope enforcement at all**, no refresh tokens.
Patient binding is enforced and is a different thing.

⚠️ **Replay protection is best-effort and says so.** Launch contexts, codes and
tokens are signed self-contained blobs, not table rows, because a Worker has no
shared memory and `/authorize` and `/token` can land in different isolates — a
table there fails logins intermittently, in front of an audience. The cost:
"used" cannot be written down, so a code is replayable inside its 60-second
window across isolates. **Step 4 needs a Durable Object for writes anyway; move
this behind it then.**

### What step 1 found, which the spec could not have

The read API was **derived** — specified by reading `SmartDataSource` and
reasoning about what it would ask for. Standing it up is what tested the
reading, and it found two things:

1. ⚠️ **Not one of the 20 scenario QuestionnaireResponses carries a `subject`.**
   Twelve of thirteen FHIR buckets are 100% patient-linked; `responses` is 0%.
   So `QuestionnaireResponse?patient=` — the search whose failure fails the
   whole chart — returned nothing for every patient on the first real request.
   Invisible to the gates *by construction*: `check-scenario-resources.mjs`'s
   "points at THIS patient" check does not walk `responses`, and
   `check-scenario-responses.mjs` checks QRs against their Questionnaire, which
   says nothing about `subject`. Neither is wrong; between them the element is
   unowned. **The mock stamps it and pins the list of what it stamped; the
   durable fix is in the fixtures — filed as #364.**
2. **`category=procedure` is empty for all 14 patients** (means-safety is a
   `Procedure`, not an Observation), and the two `category=exam` Observations
   reach no chart at all through SMART — including patient-002's *only*
   artifact, so the never-screened patient's SMART chart is empty where their
   local one is not. A `SmartDataSource` query-set divergence, not a mock bug.

Both are written up in [`mock-ehr-read-api.md`](mock-ehr-read-api.md) under
"What building it found", with the third omission (CORS, unmentioned in the
spec and fatal in a browser).

### Still owed on steps 1 and 2

- ✅ ~~**A browser run, and a deploy.**~~ **Both done.** fhirclient's own
  browser-side `authorize()`/`ready()`, CORS preflight and the whole
  authorization-code exchange are proven against the deployed host.
- ✅ ~~**`PANEL_FRAME_ANCESTORS` is a guess.**~~ The Worker landed on exactly the
  guessed origin, and the header is live on the panel host.
- ⚠️ **Still unproven: the panel INSIDE a frame.** Nothing has embedded it yet —
  the launch opens top-level because the mock has no host chrome. Cross-site
  storage in a third-party frame is the specific risk (a browser partitions or
  blocks it, and fhirclient keeps its state in `sessionStorage`). **This is the
  last untested part of the central claim.** Step 5.
- **#364 — the fixture fixes. It now covers TWO fields, not one.** Filed for the
  missing `subject`; #369 found the same class again in `authored` (0 of 20 QRs
  carry it). Both are worked around in `services/mock-ehr/src/fixtures.ts` and
  both are pinned by tests. Its **last** step is the one that matters (not panel
  step 4): when the fixtures carry both fields, delete the stamping and assert
  **`NORMALIZED_LINKS` and `NORMALIZED_AUTHORED` are empty**, or the workarounds
  outlive the defects they work around. ⚠️ **The issue text still describes only
  `subject`** — update it before starting.
- ✅ ~~**Whether the mock ships a consent screen.**~~ **DECIDED 2026-08-19: no**
  — `/authorize` auto-approves, and the reason is realism, not speed (a
  clinician EHR launch does not re-consent per launch; that is a patient-facing
  standalone-launch norm). `embedded-panel-smart-launch.md` §10.1, which also
  records why the *granular* variant would be theatre today and the two things
  that would reopen it.

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

### Read when building the mock EHR

0. **[`mock-ehr-read-api.md`](mock-ehr-read-api.md)** — step 1's executable spec:
   the exact 14 searches, which two are load-bearing, the Bundle shape fhirclient
   expects, and three corrections to the panel plan.

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
- ✅ ~~Whether the mock ships a consent screen~~ — **decided 2026-08-19: no.**
  §10.1. **Still open: where subject resources live** (`ig/` as example
  Instances versus beside the scenarios). #356 put them in `ig/` in practice,
  so this is now a question of ratifying what already happened rather than an
  unmade choice.

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

### #126 is CLOSED — what it turned out to be, and three things it found

⚠️ **#126's stated priority had inverted, and its own scope-update comment had
gone stale the same way.** Both are corrected on the issue now; the short
version, because it is the kind of thing that gets re-derived:

|  | #126 body (07-29) | its comment | on `fa2a503` |
|---|---|---|---|
| `pages/PatientChart.tsx` | 922, "largest `.tsx`" | ~894, "**entirely open**" | **531** |
| `context/PatientProvider.tsx` | 471 | ~410, "**mostly done**" | **209** (was 558) |

`5c63f70` (#248) had already deleted **532 lines** from `PatientChart` as a side
effect of making the chart one vertical pathway — nobody was working the issue.
Three of the four prescriptions were satisfied elsewhere, and `useSmartPatient`
was superseded twice (`SmartProvider` owns the session, `SmartDataSource` the
I/O), leaving nothing to name it after. What #371 extracted instead was the
concern **no version of the issue mentions**, because #263/#285 added it after
both were written: the Encounter-correlation save path, now
`hooks/useCorrelatedSave.ts`.

**Both halves are done** — #371 took the provider to 209, #373 took the page to
201 by moving `OtherActivitySection`, `EncountersTimeline` and `PatientDocuments`
out. ⚠️ **They went to `src/components/`, not the `PatientChart/` directory the
issue asked for**, because all four children the page already composed were
page-private *and* already there; a new directory would have held three of seven
siblings and split one category across two locations. If that looks like drift
from the issue text, the reasoning is in #373 — it was deliberate.

Three findings worth not re-discovering:

- ⚠️ **The Encounter cache-clear was guarded by nothing.** Four tests were
  written before the extraction and each verified against a planted defect.
  Deleting the three-line `openEncounterRef` clear on `sliceKey` change failed
  **only** the new test — so an artifact being filed against the *previous
  patient's* Encounter, the worst outcome in that file, had no coverage at all.
  The cached Encounter is still open and still same-day, so `findOpenEncounter`
  accepts it without complaint.
- ⚠️ **`localDataSource` is a module singleton, and `localStorage.clear()` does
  not reset it.** It reads storage in its constructor and then holds the store in
  memory, so state leaked between tests in the same file. The existing "files a
  second submission in the SAME contact" test was reading the *first* test's
  episode and passing because `waitFor` caught `responses.length` in transit
  through `2` on its way to `3` — green while asserting almost nothing about its
  own submissions. Tests now inject a fresh `LocalDataSource` through
  `PatientProvider`'s own `dataSource` prop and call `cleanup()`, because
  **auto-cleanup is not enabled in this project's vitest setup** and every prior
  provider stayed mounted and subscribed. Same class as #327.
- ⚠️ **`OtherActivitySection` renders for no demo patient.** It returns `null` on
  an empty bucket, and unstaged artifacts only arrive from a *foreign* EHR, so
  nothing local exercises it — a chart section that ships unlooked-at. #373
  verified it by crafting a foreign QuestionnaireResponse plus a vendor
  Observation, then removing them; **there is still no fixture that covers it.**
  Worth a scenario if the panel work starts reading a real server, which is
  exactly when this section starts mattering.

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
- **A shared fixture that is never reset is the same trap as a wrong assumption.** New, 2026-08-19 (#371): `localDataSource` is a module singleton that reads `localStorage` only in its constructor, so `localStorage.clear()` left its in-memory store intact and a test read the *previous* test's data. It passed because `waitFor` caught a count in transit through the expected value on its way past it. Inject a fresh source through the seam the provider already exposes (`PatientProvider`'s `dataSource` prop), and call `cleanup()` — auto-cleanup is **not** enabled here, so otherwise every prior provider stays mounted and subscribed. ⚠️ **The same singleton bites when crafting demo data by hand:** writing `spier-blank-slice` in devtools and then navigating does nothing, because the hash router does not reload the document and the in-memory store wins — and then overwrites what you wrote. It needs a real reload.
- **A test can encode the wrong assumption and then defend it.** #327 is the sharpest case: `cssrsScreener.test.ts` asserted C-SSRS items are plain booleans and built fixtures to match, so a green suite certified a mapper against input the app never produces. `check:readers` is the class-level fix; `__fixtures__/nativeQr.ts` derives shapes from the Questionnaire rather than restating them.
- **A worktree is scratch space, not storage.** Anything that must survive gets committed to a branch the same session. Untracked files in an abandoned worktree are invisible to every gate, and `git worktree remove` takes them with it. This cost one plan doc permanently (#351 re-derived a replacement, which is not the same thing).
- **Don't pin a count in prose.** `CLAUDE.md` said "eleven drift checks" while `verify` ran fourteen. The list is now the source of truth and carries no number — the same reasoning as matching SUSHI warning *shape* rather than count, and the same failure as a stale `check:codings` floor (#232).
- ⚠️ **`gh issue edit --body-file /dev/null` silently blanks an issue body.** New, 2026-08-19: a stray flag while retitling #126 wiped its body, and `gh` reported success. Recovered from the session's own earlier `gh issue view` output. **Pass only the flags you mean** — `gh issue edit` writes every field it is given, and there is no confirmation step.
- **Watch the post-merge run, not just the PR's.** `pull_request` CI tests the merge with `main` as it stood when the run happened, not at merge time.
  ⚠️ **And `gh run list --commit <short-sha>` returns an empty list**, not an error — it wants the full SHA. A poller that waits for "no run is `in_progress`" therefore reports SETTLED immediately against zero runs, which is how #371's post-merge watch passed vacuously on its first attempt before being redone with `--branch main` and an explicit emptiness guard. Exactly the #232 / #261 shape, in the tooling used to check for it: **a check that reads nothing must fail, not pass.**
- **`services/cds-hooks` has its own verify** that `web`'s does not cover, and
  so does `services/mock-ehr`.
- ⚠️ **A CI job that re-lists a script's steps will drift from it.** New,
  2026-08-19: `web-lint.yml`'s verify job hand-copied part of `npm run verify`,
  and eight gates were never on the list. Nothing could see it, because a
  hand-copied list has nothing to compare itself against — the same shape as the
  stale `check:codings` floor (#232) and the "eleven drift checks" prose. **Call
  the script; do not restate it.**
- ⚠️ **A green suite says nothing about what is on the screen.** New,
  2026-08-19: deploying the mock and launching it in a browser found three
  defects in ten minutes — a date rendering as "Invalid Date Invalid Date" on
  every SMART-read QuestionnaireResponse, an MRN showing a resource id, and a
  page claiming an auth posture that had changed. 678 web tests, 61 mock tests
  and every drift gate were green throughout, because all three sat in seams
  nothing asserted: wrapper metadata the FHIR resource lacks, and presentation
  no test reads. **Look at the deployed thing.** It is not a substitute for
  tests and they are not a substitute for it.
- ⚠️ **"It passes locally" can mean "it cannot run in CI at all."** The same
  session found `check:dates` using `fs.globSync`, which needs **Node 22**,
  while all 14 workflows pin **Node 20** and no package declares `engines`. The
  gate had never run anywhere but on developer machines that happened to be on
  22, and it threw a `SyntaxError` the first time CI executed it. When adding a
  gate, the Node baseline is part of the contract — and a green local run on a
  newer runtime is not evidence about CI.
