# Handoff — next session

**Restructured 2026-08-20**, which is the twelfth rewrite and the first that
changes the file's *shape* rather than its contents.

## Why this file is now short

Eleven rewrites across three days, and the same failure every time: the "what
landed" tables and the "take this first" section were wrong within the hour of a
merge. Four of five merges on 2026-08-18 alone falsified this file immediately —
twice it still said "take `PanelShell` first" after `PanelShell` had merged. Every
version since diagnosed the cause correctly and did nothing about it:

> The durable fix is probably to shrink this file to the open *decisions* and the
> standing *rules*, and let `git log` and the plan docs' own status tables carry
> state — **that restructure is still not done, and every rewrite since has made
> the case for it stronger.**

**It is done now.** What was cut: the per-PR "what landed" tables for 2026-08-18
and 08-19, the panel step-state table (all six steps are merged), the per-step
retrospectives, and the "take this first" section. All of it is in `git log` and
in the plan docs, which is where state belongs. What was kept: open decisions,
standing rules, and findings that generalize beyond the PR that found them.

**The rule for updating this file has four halves now:**

1. **Rewrite it in place at the end of a session.** Do not leave a new version in
   a worktree — one was never committed at all.
2. **Rewrite it when the work it describes lands**, not only when a session ends.
3. **Verify its claims before restating them.** Every number below was re-derived
   against `9702356`, not copied forward.
4. **Do not re-grow the state sections.** If you find yourself typing a table of
   what merged this week, `git log --oneline` already says it and will not go
   stale. State the *open* things.

## State of the repo — derived 2026-08-20, check it rather than trust it

- `main` is at **`9702356`**, confirmed against `origin/main`. **No open PRs.**
  **37 open issues** (counted with `--limit 200`; `gh issue list` defaults to 30
  and truncates silently).
- **All three `verify` pipelines green**, each run in this session:

  | Package | Exit | Tests | Covered by `web`'s verify? |
  |---|---|---|---|
  | `web` | 0 | 62 files / **728** | — |
  | `services/cds-hooks` | 0 | 3 files / **32** | **No** |
  | `services/mock-ehr` | 0 | 8 files / **138** | **No** |

- The one `eslint` warning (`MeasureDashboard.tsx`, a `useMemo` dep) is
  **pre-existing**.
- A fresh worktree needs `npm install` in **all three** packages, plus
  `npm run copy-fhir` in `web/`.
- **All six embedded-panel steps are merged and deployed**, and the claim was
  proven in a browser end to end rather than inferred. Details live in
  [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md), not here.

  | | |
  |---|---|
  | Mock EHR | https://spier-mock-ehr.bbthorson.workers.dev |
  | Panel | https://spier-adoption-guide.bbthorson.workers.dev |

## Standing rules — the operational ones

⚠️ **`services/mock-ehr/` is not deployed by CI.** The panel redeploys itself from
`main` via the Cloudflare dashboard integration; the mock does not. **After
merging anything under `services/mock-ehr/`, run `npm run deploy` there** or the
live host silently keeps serving the old build. And do not debug the Worker in
the first seconds after a deploy — a stale version answering looks exactly like a
missing binding.

⚠️ **`MOCK_SIGNING_SECRET` is not set**, so the mock falls back to the
development value in `tokens.ts`. Fine — it protects nothing real and the data is
synthetic — but know it before reasoning about it as a control.

⚠️ **A squash merge makes `is-ancestor` lie.** It answers "no" both when work is
genuinely unmerged and when it merged under a new hash. `git fetch origin main`
first and use `gh pr list --head <branch>`; the local ref is not the authority.
This produced two corrections to one paragraph in a single day.

⚠️ **A squash-merged stack needs a rebase, because this repo does not delete
merged branches.** GitHub will not auto-retarget, so the stacked PR's diff
re-applies the parent's commits. The recipe that works: `git rebase --onto
origin/main <old base> <branch>`, confirm `git diff <old tip> HEAD` is **empty**,
re-run the verifies, `--force-with-lease`, then `gh pr edit --base main`.
(Unstacked PRs off the same base with disjoint files need none of this.)

⚠️ **Watch the post-merge run, not just the PR's.** `pull_request` CI tests the
merge with `main` as it stood when the run happened, not at merge time. And
**`gh run list --commit <short-sha>` returns an empty list**, not an error — it
wants the full SHA. A poller waiting for "nothing `in_progress`" therefore reports
SETTLED against zero runs. Use `--branch main`, filter on the **full** SHA, and
**guard explicitly for emptiness**. Exactly the #232/#261 shape, in the tooling
built to catch it.

⚠️ **`gh issue edit --body-file /dev/null` silently blanks an issue body**, and
`gh` reports success. `gh issue edit` writes every field it is given and has no
confirmation step. Pass only the flags you mean.

⚠️ **A `web/src/App.tsx` change triggers `use-case-workbook.yml`**, which resolves
tool launch paths against `App.tsx`. A route-table edit is inside its blast
radius. Likewise **`docs/outreach/**` triggers `onepager.yml`**, and touching
`ig/input/**` invalidates `deploy.yml`'s IG render cache — that last one is
desirable, since the re-render is the gate that validates narrative links.

⚠️ **Commit messages containing backticks need a heredoc, not an inline `-m`.**

## Standing rules — the ones about evidence

- **Prove a gate can fail before trusting it.** There are now several distinct
  silent-pass mechanisms catalogued in this repo; a green gate you have never
  seen go red is not evidence of anything. Every gate added recently was verified
  by planting the defect it targets.
- **A check that reads nothing must fail, not pass.** #232 (a stale `check:codings`
  floor), #261 (a narrower source starving inside a scanned tree), the empty
  conformance index, the vacuous post-merge poll — same bug, six catalogued
  instances. When you add a gate, make an empty read an error.
- **A green suite says nothing about what is on the screen.** Deploying the mock
  and opening it found three defects in ten minutes — a date rendering as "Invalid
  Date Invalid Date", an MRN showing a resource id, a page claiming an auth
  posture that had changed — while 678 web tests, 61 mock tests and every drift
  gate were green, because all three sat in seams nothing asserted. **Look at the
  deployed thing.** It is not a substitute for tests and they are not a substitute
  for it. (Confirmed again 2026-08-20: a new link in the Adoption Rubric rendered
  *invisible* — inherited `--text-muted`, no underline — with 728 tests green.)
- **A test can encode the wrong assumption and then defend it.** #327 is the
  sharpest case: `cssrsScreener.test.ts` asserted C-SSRS items are plain booleans
  and built fixtures to match, so a green suite certified a mapper against input
  the app never produces. `check:readers` is the class-level fix; `__fixtures__/nativeQr.ts`
  derives shapes from the Questionnaire rather than restating them.
- **A shared fixture that is never reset is the same trap as a wrong assumption.**
  `localDataSource` is a module singleton that reads `localStorage` only in its
  constructor, so `localStorage.clear()` leaves its in-memory store intact. A test
  read the previous test's data and passed because `waitFor` caught a count in
  transit through the expected value. Inject a fresh source through
  `PatientProvider`'s `dataSource` prop and call `cleanup()` — **auto-cleanup is
  not enabled here**, so otherwise every prior provider stays mounted and
  subscribed. ⚠️ The same singleton bites when crafting demo data by hand: writing
  to `localStorage` in devtools and navigating does nothing, because the hash
  router does not reload the document and the in-memory store wins — then
  overwrites what you wrote. It needs a real reload.
- **A CI job that re-lists a script's steps will drift from it.** `web-lint.yml`
  hand-copied part of `npm run verify` and **eight gates ran only on developer
  machines**. Nothing could see it, because a hand-copied list has nothing to
  compare itself against. **Call the script; do not restate it.** Same shape:
  CLAUDE.md's "eleven drift checks" prose while `verify` ran fourteen, and
  `how-to-read.md`'s hand-restated IG menu, which was missing two live entries
  (both fixed).
- **"It passes locally" can mean "it cannot run in CI at all."** `check:dates`
  used `fs.globSync` (Node 22) while all 14 workflows pin Node 20 and no package
  declares `engines`. It threw a `SyntaxError` the first time CI ran it. **The
  Node baseline is part of a gate's contract.**
- **Don't pin a count in prose.** Match warning *shape*, not count; keep the gate
  list authoritative and numberless.
- **A worktree is scratch space, not storage.** Anything that must survive gets
  committed the same session. This cost one plan doc permanently.
- **Verify against the source, and re-derive the issue before planning.** Every
  issue picked up recently had at least one premise that had gone stale — twice
  that made the work smaller, once it changed the answer. None was wrong when filed.
- ⚠️ **Orphaned check-runs block merges.** A job can pass every step and never
  finalize, leaving the PR UNSTABLE forever. Trust the run-level conclusion and
  clear it with `gh run rerun <run-id> --job <job-id>`.

## Needs a human decision, not a patch

- **Does `MeasureDashboard` stay in the adoption guide?** This is the one open
  decision gating the repo reshape, and it is a product call.
  [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §9.5: if it
  stays *and* still needs patient-level data, step D leaves the guide importing
  fixtures from somewhere. If measures move to the EHR side — where they would
  live in a real deployment, computed over real data — the guide keeps no patient
  data and D is clean. **It changes step D's shape.**
- **Where do the subject resources live?** #356 minted the 14 demo `Patient`s in
  `ig/input/fsh/population-patients.fsh` to stop 116 dangling `subject`
  references — a *validation* need, not a specification one. §9.3 argues they
  should leave the IG (an IG's examples should illustrate its profiles, not
  populate a demo host's roster; today **the mock EHR's patient roster depends on
  a SUSHI compile**). This is ratifying what already happened, or undoing it.
- **#303 — `p007-stanley-brown` is a stub** (no `activity`) named after a profile
  it does not conform to. It *limits* how strong #289's invariant can be: it is
  why `spier-episode-trigger-on-positive-screen` covers only `positive-screen`
  and not `elevated-assessment`. Renaming is probably right, but which way depends
  on what that fixture is meant to represent. **Do not guess it; ask.**
- **#231 — the CDS service's auth posture.** Narrower than filed. `require` is
  implemented and unit-tested and is one `wrangler.jsonc` var; the app only fetches
  discovery (open either way), so flipping would break the guide's published curl
  and any CDS Hooks Sandbox trial, not the demo UI. The guide page and README
  already state warn mode — what is missing is that both frame it as *transitional*
  and nobody scheduled the flip. Declaring warn deliberate is a two-line doc
  change, but it is a security posture, so it is Brad's call.
- **#326 — clinical review of ED Scenario 11**: 10 proposed steps, 3 new patient
  courses, one open note. Not a code task.
- **#93 — SME sign-off on all six risk-tier crosswalks.** Not a code task, and it
  **blocks #264**.
- **Two corrections from the #355 audit remain**, mechanical:
  `surfaces-and-distribution.md` §4's "transitional" IG-redirect comment (drop the
  word or file the move), and §8's phase table, which still lists phases B–D as
  deferred "because no client ship is near-term" — true, but it sits beside a
  retired track split and should be re-read whole.

## Blocked

- **#264 — crosswalk fidelity in the data dictionary**, on #93. The
  `fidelity`-derived-from-ConceptMap half could land early, but presenting
  fidelity as settled is the failure mode the issue warns about. #317 left the
  landing spot: the value cell in both binding tables carries the system and the
  bindable set, and fidelity qualifies exactly that pair. **No column was stubbed
  for it — an empty column is a claim of its own.**

## The reshape is the next substantial thing

[`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §9 (re-measured
2026-08-20) has the agreed shape and sequencing A–E. **Step C — `PopulationView` +
`MeasureDashboard` onto the `FhirDataSource` seam — is the gate on everything
else**, including making the mock EHR's embedded population dashboard a genuine
user-scoped SMART panel instead of a labelled iframe. Deployables stay at three;
what changes is that shared code stops living inside a consumer.

⚠️ **§7's migration rule is the most important paragraph in that document.** One
deliberate pass per step; after each, plant the defect each moved gate targets and
watch it go red. A half-migrated tree is where a gate quietly starts reading an
empty directory.

Two crossings worth knowing before starting: `services/mock-ehr/src/validate.ts`
imports **`web/scripts/lib/fhir-resource-rules.mjs`** — a deployable taking a
runtime dependency on a gate's internals, which is deliberate (one opinion about
write validity, not two) but has no home in the package table. And
`services/mock-ehr` imports `lib/dataSource/smartDataSource` — a mock *server*
importing the app's FHIR *client*, legitimately, in the best test in the repo.

## Outstanding debt with a named finish line

- **#364 — the fixture fixes. It covers TWO fields, not one.** Filed for the
  missing `subject` (0 of 20 scenario QRs carried it); #369 found the same class in
  `authored` (also 0 of 20). Both are worked around in
  `services/mock-ehr/src/fixtures.ts` and both are pinned by tests. **Its last
  step is the one that matters:** when the fixtures carry both fields, delete the
  stamping and assert **`NORMALIZED_LINKS` and `NORMALIZED_AUTHORED` are empty**,
  or the workarounds outlive the defects they work around. ⚠️ **The issue text
  still describes only `subject`** — update it before starting.
- **#350** holds three ladder items — the CDS card `type:'smart'` link, the
  adoption-pathways guide page, and live sandbox validation. **Do not file
  duplicates**; a previous handoff said "none of it has an issue yet", which would
  have produced three. `gh issue view 350` is the authority.
- **No issue yet** — the Tier-3 confirmation UI, and whether the demo should set
  `alwaysWriteDocument`. File before starting either.
- **Safari is untested and is the one remaining way the framed panel fails on a
  machine that is not this one.** The embed flag has to survive the OAuth redirect,
  so it lives in `sessionStorage` — and under full third-party storage blocking
  that access throws. So does `fhirclient`'s own OAuth state, so in that browser
  the *launch* does not complete at all, not just the chrome. **Check it before
  demonstrating on someone else's laptop.**
- **Nothing on the panel path has had an outside review.** The ladder, the
  scorecard, `PanelShell`, the code drawer, `services/mock-ehr/` and an
  **authorization stub** were each written and checked by the same session that
  designed them, and it is now on a public origin. Planting defects is the
  strongest thing available from inside — 8 against the auth stub, all 8 caught —
  but it is not another reader, and auth is the worst place for that gap.

## Findings that generalize — do not re-derive these

- ⚠️ **The mock's replay protection is best-effort and says so.** Launch contexts,
  codes and tokens are signed self-contained blobs, not table rows, because a
  Worker has no shared memory and `/authorize` and `/token` can land in different
  isolates — a table there fails logins intermittently, in front of an audience.
  The cost: "used" cannot be written down, so a code is replayable inside its
  60-second window across isolates. A Durable Object now exists for writes; **move
  replay protection behind it.**
- ⚠️ **PKCE can be defeated by omission.** `fhirclient` only sends a challenge when
  discovery advertises `code_challenge_methods_supported: ["S256"]`. Delete that
  array and the client stops sending PKCE, the server stops requiring what never
  arrives, and the login still works. Two halves of one decision; both asserted.
- ⚠️ **Deliberately NOT built, and not to be described as working:** no `id_token`
  (so `client.user` is null), **no scope enforcement at all**, no refresh tokens.
  Patient binding *is* enforced and is a different thing.
- ⚠️ **The FHIRcast hub's `sent`/`acked` counters mean "since this instance last
  woke."** After clients disconnect they read `0` while the deliveries certainly
  happened. `sockets` and `topics` derive from the live socket set and are the
  trustworthy fields.
- ⚠️ **A validator warning can mean "nothing was checked."** If the HL7 validator
  cannot resolve a QuestionnaireResponse's Questionnaire, it warns and reports zero
  errors — a context-loading mistake degrades to a PASS. Both traps are guarded in
  `validate-fhir.mjs` now; when you touch it, run it against a deliberately broken
  input and confirm it **fails**.
- ⚠️ **Two z-index decisions are deliberate and must stay so.**
  `.panel-shell__patient` is **1** — *below* the renderer's combobox popover (10),
  because a combobox low in a long instrument opens upward into the strip's band.
  `.code-drawer` is **20** — *above* it, the opposite answer to the same question,
  because the drawer is something the user explicitly opened.
- **A padding guessed to match a height maintained elsewhere is the
  hand-duplicated-constant failure this repo keeps catching.** The drawer's
  clearance shipped as `var(--space-8)` (32px) against a bar rendering 34px. It is
  `--code-drawer-bar-height` now, one definition and two consumers. Derive it.
- **`OtherActivitySection` renders for no demo patient.** It returns `null` on an
  empty bucket, and unstaged artifacts only arrive from a *foreign* EHR — a chart
  section that ships unlooked-at. #373 verified it by hand and removed the props;
  **there is still no fixture covering it.** Worth one as soon as the panel reads a
  real server, which is exactly when it starts mattering.
- ⚠️ **`denominator-exclusion` and `denominator-exception` are not
  interchangeable.** An exclusion is removed outright; an exception is removed
  **only if the numerator is not met**. The exception's count is
  `removedByException`, not the raw flag — tallying the flag subtracts a case still
  being scored and the score can exceed 100%.
- `measures.narration.test.ts`'s `EXPLAINED_MISSES` allowlist is **empty**, which is
  the finding rather than an omission. It does **not** assert that a step
  materializes every resource type it names — 21 completed steps name a
  SPiER-profiled type with no artifact behind it, filed separately.
- **Two suspected #327-shaped defects in the ladder are false alarms**
  (`answerText` reads `valueCoding` first; `valueText` is a pre-existing repo-wide
  convention). Recorded so they are not re-investigated.

## The quietest risk: licensing (#64)

[`../best-practices/licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md)
is blunt about it, and it is worth reading before quoting any licensing status to
a partner. **Zero of 43 ActivityDefinitions have been verified against what the
rights holder publishes today.** Four instruments have no audit memo at all —
CAMS, Stanley-Brown, SBQ-R, PHQ-9 — and two of those are restrictive.
Stanley-Brown's own recorded notice requires written permission "for use of the
form in the electronic medical record", which is precisely what SPiER publishes.
**#64 gates the org-namespace transfer.**

#220 is the cautionary precedent for the whole class: a plausible assertion that
nothing verified reads exactly like a verified one.

⚠️ **A conference demo is lower stakes than a client ship, not zero** — a talk is
the most public this project gets. Checking the specific instruments that go on a
projector is a much smaller job than the full backlog, and
[`surfaces-and-distribution.md`](surfaces-and-distribution.md) §6/§8 says so.

## Untriaged: the upstream Behavioral Health IG thread

Three issues, none started, all from #325's alignment work against the HL7/ASTP US
Behavioral Health Profiles IG. See
[`../research/2026-08-us-behavioral-health-profiles-ig.md`](../research/2026-08-us-behavioral-health-profiles-ig.md);
note #342 corrected it — the upstream tracker is *disabled*, not unattended.

- **#337** — report that IG's build defects upstream (5 findings, 3 candidate
  channels). Outreach, not code.
- **#338** — offer SPiER's C-SSRS Questionnaire as the canonical target for their
  C-SSRS example, which is currently a PDF.
- **#339** — a "BHP bridge" demo: run their own C-SSRS through SPiER's full
  pathway. **This one is real code**, and #323/#325 did the groundwork.

## Actionable code work, unblocked and unclaimed

Nothing here is urgent; listed so it is not re-derived each session.

| Issue | What | Milestone |
|---|---|---|
| #125 | Consolidate hardcoded example Observations into IG example instances | M7 |
| #228 | [TL-009] Write the handoff-content-item checklist from the transition recorder | M3 |
| #128 | Export a configured pathway as a FHIR Bundle (Preset → PlanDefinition subset) | M5 |
| #277 | [Epic] Suicide Care Dashboard — a CoCM registry spec and the five gaps it exposes | — |
| #259 | [Epic] Data dictionary: two-layer concept model, cross-stage correlation | — |

**No issue yet, and small:** `ig/input/pagecontent/how-to-read.md` restates the
IG menu by hand and had drifted from `ig/sushi-config.yaml`'s `menu:` (two live
entries missing, and a Must-Support claim `conformance.md` contradicted). It is
corrected, but nothing compares the two — a gate would be ~25 lines and is the
durable fix. File before building.

**Deliberately parked, not drift:** the ten `status:built` tool epics (#20, #23,
#24, #25, #26, #168, #170, #172, #175, #176) stay open by design and carry **no
milestone** — milestones hold finishable tasks and a per-tool epic never finishes.
TL-028/029/044/045 (#166, #167, #182, #183) are unscheduled `status:future`
placeholders, also unmilestoned. **The one exception is #164** (TL-026, Positive
Screen Flag): `status:planned` and in M4, so it is the only one actually scheduled.

## Orientation — the embedded-panel doc set, in reading order

The two newest plan docs are **not self-contained**: both argue against, re-scope,
or depend on older ones, and a session reading only the new pair will hit
references it cannot resolve.

1. [`surfaces-and-distribution.md`](surfaces-and-distribution.md) — shorter, and it
   frames the other. What is and is not an application (**the IG is not**; it is
   upstream of everything), the demo-vs-clinical build surface, hosting topology.
2. [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) — the panel
   itself, and the record of all six merged steps. **Read §1 before agreeing to
   anything.**
3. [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — **not
   optional.** Its §6 recorded "write our own mock FHIR + SMART endpoints" as NOT
   RECOMMENDED and the panel plan's §1 *reverses* it. Reading the reversal without
   the argument it reverses gets you a decision with no reasoning attached.
   ⚠️ **That reversal's guardrails are conditions, not suggestions:** strict
   validation on writes reusing the scenario gate's rules, a planted invalid write
   **seen to 422**, and no interoperability claim from a host we control. Skip any
   and §6's objection reasserts in full.
4. [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) — §1 is why
   the IG is not an application; §5 rejected splitting the guide from the clinical
   demo; §9 is the current reshape.
5. [`smart-filler-writeback-ladder.md`](smart-filler-writeback-ladder.md) — the
   ladder's own plan (a reconstruction by #351, not the lost original).
   ⚠️ **The tier model is Tier 1 = QuestionnaireResponse, Tier 2 = Observation.**
   #348's commit message has it inverted; QR-first is load-bearing for provenance.
6. [`../smart-sandbox-testing.md`](../smart-sandbox-testing.md) — the SMART
   walkthrough and its three known limitations. The panel work touches all three.
7. [`mock-ehr-read-api.md`](mock-ehr-read-api.md) — step 1's executable spec: the
   exact 14 searches, which two are load-bearing, the Bundle shape `fhirclient`
   expects, and what building it found that the spec could not have.
8. **`CLAUDE.md`** (repo root) — the gate landscape. Which of the five gate classes
   catches what, and why a clean SUSHI run is not a quiet one. **Not optional for
   anyone editing code here.**
9. [`fhircast-two-way-sync.md`](fhircast-two-way-sync.md) — the original
   `BroadcastChannel` demo, now superseded by the real hub for cross-origin.
10. [`../best-practices/licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md)
    and [`../use-cases/README.md`](../use-cases/README.md) — read before making
    claims outside the repo. ⚠️ **`ed-scenario-11.json` is the source; the `.md`
    and everything in `dist/` are generated.**

[`../MANIFEST.md`](../MANIFEST.md) indexes the wider doc set, though not every plan.

⚠️ **Docs have no CI gate here** — only `docs/use-cases/**` and `docs/outreach/**`
are gated. Every plan doc and this handoff are ungated prose, which is why #349
and #355 kept finding docs asserting false things. **Periodic conflict audits are
real work, not tidying.**
