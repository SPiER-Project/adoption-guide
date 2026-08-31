# Handoff — next session

**Restructured 2026-08-20**; refreshed **2026-08-21** without needing a shape
change, which is the first evidence the restructure worked. Deliberately no
running tally of rewrites here — a counter is one more number that goes stale, and
the point below is the history, not the score.

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

✅ **Tested 2026-08-21.** Seven PRs merged in one session (#393–#399, the whole
repo reshape) and this file needed **no new "what landed" table** — the state
section changed four numbers, two open decisions became struck-through, and the
durable material was five findings and one standing rule. That is the restructure
working as intended. The temptation each time is to narrate the session; resist
it.

## State of the repo — derived 2026-08-21 (second pass), check it rather than trust it

⚠️ **The SHA below is one commit stale by construction, and chasing it is a
regress.** The commit that writes this file is necessarily the next one after the
`main` it describes — so a session that "corrects" the SHA makes it wrong again,
and the twelve rewrites above are partly that loop. `git log --oneline -1` is
always the authority; this line is a timestamp, not a fact to maintain.

- `main` was at **`fcb9194`** when this was written, plus the commit that wrote
  it. **No open PRs** at that point.
  **42 open issues** (counted with `--limit 200`; `gh issue list` defaults to 30
  and truncates silently).
- **All three `verify` pipelines green**, each run in this session:

  | Package | Exit | Tests | Covered by `web`'s verify? |
  |---|---|---|---|
  | `web` | 0 | 63 files / **732** | — |
  | `services/cds-hooks` | 0 | 3 files / **32** | **No** |
  | `services/mock-ehr` | 0 | 8 files / **138** | **No** |

- The one `eslint` warning (`MeasureDashboard.tsx`, a `useMemo` dep) is
  **pre-existing**.
- ⚠️ **There are now three `packages/` as well as three apps**, and a fresh
  worktree still needs `npm install` in **the three app/service packages only** —
  `packages/*` carry no dependencies of their own, which is the whole reason
  E2b is blocked (see below). Plus `npm run copy-fhir` in `web/`.

  | Package | What |
  |---|---|
  | `packages/core` | the React-free domain layer; **React-free and DOM-free by gate** |
  | `packages/demo-population` | the 14 patients, their scenarios, and their `Patient` resources |
  | `packages/fhir-artifacts/generated/` | SUSHI's output, gitignored |

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
  conformance index, the vacuous post-merge poll, a proof harness whose no-op
  mutation "proved" a passing gate — same bug every time, and **deliberately not
  counted here**: this line said "six" while the reshape section below said
  "five" of its own, which is the pinned-number failure the rest of this file
  warns about. When you add a gate, make an empty read an error.
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

- ✅ ~~**Does `MeasureDashboard` stay in the adoption guide?**~~ **DECIDED
  2026-08-21: measures move to the EHR side.** It is `/population/measures` now
  (#398), the guide keeps no patient data, and `check:guide-boundary` holds that.
- ✅ ~~**Where do the subject resources live?**~~ **DECIDED 2026-08-21: out of the
  IG** (#399). The measurement settled it — **not one example instance in the IG
  referenced them**, so the IG was publishing 14 `Patient` examples that
  illustrated none of its own profiles. They are hand-authored FHIR in
  `packages/demo-population/src/patients/`, and the mock's roster no longer needs
  a SUSHI compile.
- ✅ ~~**#404 — how much SMART scope enforcement should the mock EHR do?**~~
  **DECIDED 2026-08-21: one axis only** — may this token read a patient other than
  its own. A `user/…` read scope says yes; a patient-scoped token gets a 403.
  Per-resource-type scopes are deliberately uninterpreted. Recorded as
  `embedded-panel-smart-launch.md` §10.0, enforced in `smart.ts`'s
  `mayCrossPatients`, and verified on the deployed host: a patient-scoped token
  reads its own patient 200 and another 403, a `user/*.read` token reads both 200.
  ⚠️ **The reasoning matters more than the rule**, because guardrail 3 means this
  can never license "SPiER works with SMART scopes" — what it buys is guardrail 1's
  logic applied to reads, so our own client cannot look correct on a server that
  never says no.
- **Whether E2b is worth reopening the workspaces decision for.** #387 is reopened
  as its blocker. The alias mechanism carries a path, not a dependency, so
  `fsh-sushi` cannot leave `web`'s devDependencies without an install location.
  §9.7 has the three options; the one that needs no new install
  (`npx -y fsh-sushi@<pinned>`) was rejected on offline-reproducibility, and it
  would also fix a real inconsistency — **five workflows install SUSHI unpinned
  today**. Not urgent; it is the last item in the reshape.
- **#303 — `p007-stanley-brown`, the naming half only.** The packet's false claim
  is FIXED (#417): it declared `safety-plan-copy` while pointing at a CarePlan
  with zero `activity`, wrong under either reading, so it went ahead of the
  decision. What remains is whether the stub is renamed or filled in. Brad noted
  2026-08-22 that Stanley-Brown is *"one instrument that can be used in different
  settings"*, which softens it — a different setting can legitimately produce a
  different shape — but does not settle the content. It still *limits* #289's
  invariant: it is why `spier-episode-trigger-on-positive-screen` covers only
  `positive-screen` and not `elevated-assessment`. ⚠️ **p009 is the same question
  one notch weaker** — its packet claims `safety-plan-copy` with no CarePlan
  related at all, which is *unverifiable* rather than false (the copy may be in
  the attachment), and #417's gate deliberately leaves it green.
- ✅ ~~**#413 — the IG's canonical is a third party's live website**~~ **DONE
  2026-08-22.** The canonical is `http://thespierproject.org/fhir` and the package
  id is `thespierproject.fhir`. `spier.org` was never the nonprofit's domain — it
  resolves to an unrelated family's website — and `thespierproject.org` is.
  1,429 references across 181 files, plus `sushi-config.yaml`'s `canonical:`/`id:`
  and `ig.ini`'s ImplementationGuide filename, which SUSHI derives from the id.
  ⚠️ Three things worth knowing if a canonical ever moves again:
  **`web/src/data/roadmap.generated.json` is deliberately untouched** — it is a
  committed snapshot of GitHub issue bodies, so rewriting it would falsify the
  record and be overwritten by the next snapshot; a **regex-escaped** copy in
  `mock-ehr/src/write.test.ts` (`http:\/\/spier\.org`) survived the literal
  replace and only a test caught it; and `@spier/...` package aliases are
  unrelated and must NOT be swept up. A path segment (`/fhir`) was chosen so the
  identifier namespace does not collide with the live marketing site's URL space.
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

- **#392 — E2b**, on #387. See the reshape section.
- **#264 — crosswalk fidelity in the data dictionary**, on #93. The
  `fidelity`-derived-from-ConceptMap half could land early, but presenting
  fidelity as settled is the failure mode the issue warns about. #317 left the
  landing spot: the value cell in both binding tables carries the system and the
  bindable set, and fidelity qualifies exactly that pair. **No column was stubbed
  for it — an empty column is a claim of its own.**

## The reshape is DONE except E2b, which is blocked

Epic **#386**; [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md)
§9 carries the reasoning. Steps 0, A, B, C, D, E1 and E2a merged 2026-08-21 as
#393–#399. What it achieved, beyond moving files:

- the two Workers' deep `../../../web/src` imports went **21 → 0**;
- `packages/core` is React-free and DOM-free **by gate** (`check:core-boundary`);
- the Adoption Guide holds no patient data **by gate** (`check:guide-boundary`,
  which walks the guide's pages *transitively*);
- the population lens and measure dashboard read whatever source the provider made
  active, instead of always the local one;
- the mock EHR's roster no longer needs a SUSHI compile.

⚠️ **E2b — `fsh-sushi` leaving the React app's devDependencies — is BLOCKED on
#387, and #387 is reopened for it.** §6 phase 1's stated content
("`fsh-generated` becomes a package output") was delivered by E1. What remains is
the *dependency*, and the alias mechanism #387 shipped carries a **path, not a
dependency**. Three options and their costs are §9.7; the decision on 2026-08-21
was to defer to the workspaces migration. **Do not solve it with a 4th lockfile
without reopening that decision** — the migration would consolidate it away again.

⚠️ **§7's migration rule earned its billing.** Every step turned up a defect that
had been invisible, and they were all one family — *a check that reads nothing
reporting success*. Five instances, listed under "Findings" below. One deliberate
pass per step; after each, plant the defect each moved gate targets and watch it
go red.

✅ **Two defects in the plan document were found by executing it, and are now
corrected there** (#402 → #403): §9.5's step-D row conflated "the guide" the LENS
with the adoption-guide APP (its literal reading contradicted §5), and §9.3 called
`PopulationView.tsx` "being deprecated" with nothing in the doc set supporting it —
it is #277's redesign target, not slated for removal.

⚠️ **The generalizable half is the vocabulary, and it is still live.** "The guide"
means three different things in this repo — a **lens** (`/guide/*`), an **app**,
and a deployable historically named `adoption-guide`. The step-D row was wrong only
because it did not say which, and a reader could reasonably have split the
deployable on the strength of it. **Say which one you mean anywhere it appears in a
decision.**

That pass also marked §9.1/§9.2/§9.3 resolved at the top (each led with a problem
the reshape had solved), gave §4's table rows for the three shipped packages and
the shared validation rules, and put a historical banner on §6, which read as the
plan of record while §9.5 supersedes it.

One crossing worth knowing: `services/mock-ehr/src/validate.ts` imports
**`packages/core/fhir-resource-rules.mjs`** — a deployable taking a runtime
dependency on what began as a gate's internals. Deliberate (one opinion about
write validity, not two), and step B gave it a home that is no longer an app's
scripts folder.

## Outstanding debt with a named finish line

- ✅ ~~**#364 / #414 — the scenario-fixture debt**~~ **BOTH DONE**, and worth
  reading as one chain rather than two tickets, because each fix exposed the
  next. #364: all 20 QRs carry `subject` and `authored`, and the mock's stamps are
  **deleted** rather than left returning zero. #414: the `responses` bucket now
  reaches `validate-fhir.mjs` (428 → 451 targets), which immediately surfaced 4
  errors nothing had ever read. `risk-level` is `required: false, readOnly: true`
  on the three C-SSRS forms and stays required on SAFE-T and PSS-Full, with a new
  `tier-derivation` extension saying which is which. **Do not re-derive that
  split** — the mappers settle it: C-SSRS computes the tier and never reads the
  answer; SAFE-T and PSS-Full read it.
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

### The 2026-08-22 chain: a mapper reading a shape its own form never emits

The sharpest finding of that session and the one most likely to recur elsewhere.
#418 (runtime) and #419 (the published map) fixed it; #420 was the gate gap that
let it live, and is closed too.

**What it was.** The Stanley-Brown Questionnaire declares its three contact steps
as `type: group, repeats: true`, which FHIR renders as repeated `item` entries
with nested `item[]`. `extractPairs`, the FML map, the mapper's tests and the
golden file **all** read `answer[].item[]` — a shape the HL7 validator rejects:

| shape | validator |
|---|---|
| repeated `item` with nested `item[]` | 0 errors |
| group carrying `answer[]` | 2 errors — *"Items of type question should not have answers"* |

**It was breaking the live demo, verified in a browser rather than reasoned
about.** Filling the real form showed `@formbox/renderer` emits the conformant
shape; an A/B on identical input gave:

    social-distraction    "No distraction contacts provided."   → "RT place (RT 555-0001)"
    crisis-support        "No crisis contacts provided."        → "RT crisis person (RT 555-0002)"
    professional-support  "No professional contacts provided."  → "RT clinician (RT 555-0003)"

Three sections, not two — `professional-support` breaks via the clinician half of
step 5. A **well-formed 7-activity CarePlan with every contact section empty**,
which is the most safety-critical content in a safety plan.

**Why every gate was green.** The transformation exists twice on purpose and is
pinned by a golden file — but by *one fixture, in the shape the readers could
handle*. The map and its fixture agreed with each other and both disagreed with
the Questionnaire. ⚠️ **One fixture in the readable shape is indistinguishable
from a mapper that works.** Both parity gates now run BOTH shapes against the
SAME golden; identical content, so any difference is a defect by definition.

**And no demo data exercised it at all** — all three scenario Stanley-Brown QRs
were empty, so the two "good" plans were hand-authored to look like output the
transformation had never produced. `stanleyBrown.derivation.test.ts` now asserts
each demo plan IS `generateCarePlan(<its QR>)`, plus a second assertion that no
section is a `"No … provided."` placeholder — the bug produced a structurally
perfect, clinically empty plan that a shape-only check waves through.

✅ **The question that mattered — *does any other mapper read a nesting its
Questionnaire does not declare?* — is now ANSWERED, and the sweep is done
(#420).** Every QuestionnaireResponse reader in the repo was audited:

- **two** `extractPairs` call sites exist — Stanley-Brown's three contact groups
  and CAMS's `barrier-solution-group`, which is also `type: group, repeats: true`
  and was broken identically. Both are fixed, because both call the one shared
  helper: **#418 fixed CAMS incidentally, with nothing covering it**, which is
  why its tests now run both shapes.
- `crp.ts` and `camsTherapeutic.ts` read leaves only; `writeback/documentReference.ts`
  already recursed into both nestings. Nothing else was affected.

⚠️ **The reader-gate family now covers both directories, and they ask different
questions — do not merge them.** `check:readers` asks whether the *value reader*
matches an item's declared `type` (#327, observation mappers);
`check:careplan-readers` asks whether the *nesting walked* matches what the
Questionnaire declares (#420, carePlan mappers). A single rule would fit neither.

### A gate rule that cannot work, and how it was caught

⚠️ **A static reader cannot tell a live branch from a dead one.** #420's gate
was drafted with a rule asserting the shared `extractPairs` still reads both
response nestings. Two planted defects showed the rule could not work:
`if (undefined) { readPair(item.item) }` contains every token an honest
implementation does, and the regexes also matched incidental occurrences
(`nested.answer`, `walk(item.item)`).

It was **deleted rather than tightened**, the limit written into the script's
header, and the reader pointed at the both-shapes mapper tests, where the
property is observable. **A gate that looks like protection and is not is worse
than no gate** — and the only reason this one did not ship is that the rule was
planted against before being trusted.

The general form, worth applying to any new gate: *is the property I am
asserting visible in the artifact I am reading?* Behaviour needs a test; static
structure is what a static gate can hold.

### Three mechanical traps from the same session

- ⚠️ **A second `"extension"` key in JSON is silently dropped** — last key wins,
  every parser, no warning. Inserting one into an item that already had an
  `extension` array produced a perfect-looking diff and no extension. **Verify
  fixture edits by re-parsing the JSON, never by reading the diff.**
- ⚠️ **The first `"extension": [` after a linkId is often the wrong one.** On
  SAFE-T and PSS-Full it sits inside the LOINC `Coding` (they carry a
  coding-verification marker), not on the item. Anchor on the item's own
  indentation.
- ⚠️ **`gh pr merge --auto` fires on REQUIRED checks only.** On #421 it merged
  with `fml` and `publish` still running — the two gates that matter most for a
  StructureMap change, and neither is required. Both passed afterwards, so this
  was a near miss rather than a break. If you need the IG Publisher to have
  passed, poll for it; `--auto` will not wait.
- ⚠️ **`git checkout <branch> -- <path>` destroys uncommitted work in that
  path**, silently and unrecoverably — the working-tree twin of the
  `git checkout --` / untracked-files trap already recorded below. It ate this
  file's first rewrite. Commit before switching branches, or copy the file aside.


### The reshape's five, all one failure family

Every step of the 2026-08-21 reshape turned up a defect that had been invisible,
and they are the same bug wearing different clothes: **a check that reads nothing
reporting success.** Kept together because the pattern is the lesson.

1. **`check:scenarios:responses` and `check:stages` passed on an empty scenarios
   directory** — no floors, so the step-A move could have blinded both. Both fail
   on an empty read now.
2. **`check:codings`' `web/src` floor was stale the moment the mappers moved** —
   it expected 49 LOINC and got 11. The gate went red *correctly*, which is what
   caught it; the real hole was that no entry covered `packages/core/src` as a
   whole, so the mappers would have left the scan while every declared floor still
   passed. #261's hole arriving by a **move** rather than by growth.
3. **`check:core-boundary` shipped blind on its own primary rule.** A module
   specifier *is* a string literal, and the scan ran against a string-stripped
   copy — so a planted `import { useMemo } from 'react'` passed and the gate
   reported green. The same mistake had already defeated its feature-detection
   guard. Only *prove a gate can fail* caught it.
4. **Moving the 14 Patients silently dropped them out of `validate-fhir`** — 428
   targets to 414 — because that gate validates the IG's output and they were no
   longer in it. The scenarios' 116 `subject` references would have pointed at
   resources nothing validated.
5. **`validate-fhir`'s `--also` emptiness check had never fired, on any Node
   version.** `const found = walkJson(abs); if (found.length === 0)` — `walkJson`
   is a **generator**, so `found.length` is `undefined` and the comparison is
   always false. The comment directly above it said it existed to prevent exactly
   that. It would have masked a missing runtime-FHIR corpus in `ig.yml`, which
   passes `--also web/.runtime-fhir`.

⚠️ **`Iterator.prototype.map` is Node 22+ and every workflow pins Node 20.**
`walkJson(...).map(...)` passed on a developer machine and threw
`walkJson(...).map is not a function` in CI. Second instance of the class
CLAUDE.md already records from `fs.globSync`. **A plain-node gate is not verified
until it has run on Node 20** — `~/.nvm/versions/node/v20.*/bin/node <script>`
keeps the current PATH so `java` stays available, which `nvm use` in a login shell
did not.

⚠️ **Two of this session's own slips came from the same habit** — reading
indentation out of `sed 's/^/  /'`-prefixed output and pasting it into a string
match, twice. Display prefixes are not source. And a proof harness that restores
with `git checkout --` **silently does nothing for untracked files**, which
damaged two new fixtures before it was noticed: `git add` first.

⚠️ **The same family turned up in a PROOF HARNESS rather than in a gate** (#409),
which is the variant worth naming because it inverts the usual tell. The
harness that plants defects to prove a gate can fail reported two false greens on
its first run: one mutation string did not match the prose it targeted, and one
reused its own `s`/`p` variables so the config edit was discarded before the
write. Both mutations changed nothing, the gate correctly passed unmutated input,
and the harness read that as *the gate missed it* — a check that reads nothing,
reporting a result, inside the tool built to detect exactly that. **A proof
harness needs the same rule as a gate: a mutation that changes no bytes must be
an error, not a data point.** Assert the replacement landed.

⚠️ **A gate's first run tells you as much about the rule as about the code.**
One of #409's rules was wrong on first contact, and the *rule* was what changed,
not the repo: it demanded that a bullet link `how-to-read.html` when that bullet
correctly says "this page", because a page does not link to itself. Writing the
exemption is fine; **writing down the gap the exemption leaves** is what keeps it
from becoming an unexamined hole later.

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

⚠️ **#401 — the embedded population dashboard — is unblocked but NOT smaller.**
#404 settled the scope question, so the *permission* to read across patients now
exists. The *capability* does not: this server has no cohort search (a
patient-less search is a deliberate 400, *"no all-patients search"*), and there is
no patient-less launch. Both are #401's work, and it also carries the design
question §8 of `mock-patient-smart-launch.md` refuses to hand-wave — *how a
registry scopes itself on a real server, where "the caseload" is not a static list
of 14.* **Do not start at the code.** Nothing currently misleads anyone: the
frame's label already says it is not a SMART launch.

| Issue | What | Milestone |
|---|---|---|
| #412 | The IG package is published but unreachable — nothing links `package.tgz` and `thespierproject.fhir` is not in the FHIR registry, so Getting Started §1's instruction cannot be followed | — |
| #125 | Consolidate hardcoded example Observations into IG example instances | M7 |
| #228 | [TL-009] Write the handoff-content-item checklist from the transition recorder | M3 |
| #128 | Export a configured pathway as a FHIR Bundle (Preset → PlanDefinition subset) | M5 |
| #277 | [Epic] Suicide Care Dashboard — a CoCM registry spec and the five gaps it exposes | — |
| #259 | [Epic] Data dictionary: two-layer concept model, cross-stage correlation | — |

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
7. [`mock-ehr-read-api.md`](archive/mock-ehr-read-api.md) — step 1's executable spec: the
   exact 14 searches, which two are load-bearing, the Bundle shape `fhirclient`
   expects, and what building it found that the spec could not have.
8. **`CLAUDE.md`** (repo root) — the gate landscape. Which of the five gate classes
   catches what, and why a clean SUSHI run is not a quiet one. **Not optional for
   anyone editing code here.**
9. [`fhircast-two-way-sync.md`](archive/fhircast-two-way-sync.md) — the original
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
