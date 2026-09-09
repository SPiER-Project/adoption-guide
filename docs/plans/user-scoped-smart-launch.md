# User-scoped SMART launch: close #401, retire the guide's bundled patient data

Status: scoped 2026-09-01, **re-scoped 2026-09-09** (Phase 0 added, Phase B
replaced), not started. Do this in a fresh session/worktree — it was scoped in a
session already deep into an unrelated body of work (structure-simplification),
and needs its own clean context.

## Why

Today, `web/src/context/PatientProvider.tsx` defaults every patient-level read
(`PatientChart`, every assessment/workflow view, ~30 components) and every
population-level read (`PopulationView`, `MeasureDashboard`) to
`localDataSource` — patient JSON bundled directly into the guide's own JS from
`packages/demo-population` — unless the app happens to be SMART-launched with a
token, in which case it uses the live `SmartDataSource` against the mock EHR.

The decision (Brad, 2026-09-01): **the adoption guide should never hold or
display patient data directly.** Every read — population list included —
should be routed through `services/mock-ehr` over HTTP, the same way it already
is when the app is SMART-launched. The guide keeps zero patient data of its
own; `packages/demo-population` becomes purely the mock EHR's own fixture
source, not something the guide also imports for reads.

**Refined (Brad, 2026-09-09): the guide's two patient-facing URLs become the
*explanation*, and the live apps are launched by the mock EHR.**

> The adoption guide explains the tool and hosts the SMART app(s) to be launched
> by the mock EHR.

`…/#/population` explains the dashboard product and points at the mock EHR to
see it running; `…/#/patient/chart` explains the patient-level SMART app and how
the pathway configuration drives what it recommends. Neither is interactive.
That does not remove any capability from this plan — the population-level SMART
app is still exactly what Phase C builds — it moves it off a guide URL and onto
a launch. The consequences are a new Phase 0 and a deleted Phase B; both are
below, and the reasoning is recorded in
[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §6.3 under
*"The explainer is the page, and the app is a launch"*.

This closes out issue **#401** ("The embedded population dashboard is a
labelled iframe, not a SMART panel — blocker 2"), whose scope turns out to be
exactly what's needed here: a **user-scoped** launch (no patient in context,
`user/*.read`) plus a **cohort read** on the data-source seam. That issue's
blocker (#404: is scope enforcement worth building at all) is **already
resolved and closed** — see below.

## What's already true — read this before touching anything

This was investigated in depth in the scoping session; don't re-derive it.

**#404 is closed. Decision: Option A** — enforce a patient-scoped vs.
user-scoped axis only (no cross-patient reads on a patient-bound token; refuse
a patient-context-free cohort read on a token lacking `user/*.read`).
Explicitly **not** per-resource-type scopes (`user/Observation.read` etc.) —
`#404`'s own reasoning: *"a half-correct scope implementation is worse than
none, because it looks like it proves something."* And explicitly **not** an
interoperability claim — `embedded-panel-smart-launch.md` §1 guardrail 3 ("no
interoperability claim ever made from a host we control") still holds. What
this buys is guardrail 1's logic applied to reads: our own mock refusing an
under-scoped read is what keeps SPiER's own client honest about what it asked
for, not proof SMART scopes work in general.

**Option A is already implemented, more than you'd expect:**
- `services/mock-ehr/src/smart.ts:378-381` — `mayCrossPatients(grant)` returns
  true iff the grant's scope contains a `user/[^.]+\.(read|\*)` pattern.
- `services/mock-ehr/src/app.ts:584-593` — `denyForeignPatient` already
  consults `mayCrossPatients` and skips the patient-binding check when it's
  true.
- So: **if a token is ever issued carrying a `user/*.read`-shaped scope, cross-
  patient reads already work and are already enforced correctly against
  patient-scoped tokens.** Nothing here needs to change. Confirm with a planted
  test before relying on it (ground rule below), but do not re-implement it.

**What does NOT exist yet** (this is the actual scope of this plan):
1. `/authorize` requires either `launch` or `patient` in the query string —
   `services/mock-ehr/src/smart.ts:236-257`. There is no third "neither — just
   a user-scoped, no-patient-in-context grant" path.
2. The guide never *initiates* a SMART flow — `web/src/components/SmartLaunch.tsx`
   only *responds* to being externally launched (an `iss`+`launch` pair
   arriving in the real query string, handled in `web/src/main.tsx:57-66`, which
   requires *both* params — an `iss`-only arrival does not even route to
   `#/launch` today). There is no "connect to the mock EHR" entry point
   anywhere in the guide.
3. `FhirDataSource` (`packages/core/src/lib/dataSource/types.ts`) has no cohort
   read — `getSlice` is per-patient. `useRegistrySlices`
   (`web/src/hooks/useRegistrySlices.ts:88-145`) does N per-patient calls and
   reports `scope: 'in-context'` when SMART is active; there is no
   `scope: 'registry'` path.
4. Mock EHR discovery (`services/mock-ehr/src/smart.ts:135-162`) advertises
   `capabilities: ['launch-ehr', 'client-public', 'context-ehr-patient',
   'permission-patient']` and a patient-scoped-only `scopes_supported`. No
   `launch-standalone`, no `user/*.read` in the advertised list.
5. `services/mock-ehr/src/chartPage.ts:130` prints *"Embedded, but not a SMART
   launch — and the difference matters"* on the embedded population dashboard,
   asserted by `chartPage.test.ts`. This is currently true and must stay true
   until the work below actually lands.

**Six things make the route split (Phase 0) bigger than it looks. Verified in
the code 2026-09-09:**
1. `/patient/chart` is the **panel's landing route**, not just a page:
   `web/src/components/SmartRedirect.tsx:80` defaults to it, and the mock EHR's
   `POST /_admin/launch` (`services/mock-ehr/src/app.ts:709`) points the browser
   at `#/launch`, which lands there.
2. `web/src/components/Shell.tsx` switches `AppShell` / `PanelShell` off
   `chromeMode` over **one** route table — deliberately, so "every route is
   reachable in both chromes by construction". A URL that must be prose in one
   chrome and an app in the other breaks that invariant, which is why the fix is
   two addresses rather than a conditional.
3. **42 `launchActions`** in `packages/core/src/data/catalog/tool-ui-metadata.ts`
   carry `/patient/*` and `/population/measures` paths, and
   `packages/core/src/lib/smartIntent.ts` **derives** every SMART `intent` from
   the *last segment* of those paths. So a prefix change keeps every intent
   string identical (`open-phq-9` stays `open-phq-9`) and the mock EHR's
   `KNOWN_INTENTS` list needs no edit — but `controlPage.test.ts` asserts that
   list equals `knownIntents()`, so confirm rather than assume.
4. **Thirteen** files pass `up="/patient/chart"` to `PageHeader` and **twelve**
   link to `/patient/chart#activity` ("View in chart") — counted, not estimated.
   These are the *filler* screens returning to the chart, so they follow the
   chart to its new address.
5. `web/scripts/check-guide-boundary.mjs` derives the guide's page set from
   `web/src/data/guideSections.ts` **and** `App.tsx`'s route table, then walks it
   transitively forbidding `@spier/demo-population`, either concrete data source,
   and `useRegistrySlices`. **Declaring the two explainers as guide sections
   makes "these pages hold no patient data" gate-backed for free** — this is the
   single strongest reason to put them in the guide's own section list rather
   than hand-rolling two pages. Note the gate regexes
   `<Route path="x" element={<Comp />}>`, so the new sections must be declared in
   exactly that form.
6. `web/src/pages/PopulationView.tsx:4` imports `resetLocalDemoData`, and
   `web/src/context/PatientProvider.tsx:145,171` read `POPULATION_SCENARIOS`
   walkthroughs and `POPULATION_PATIENTS`. The demo walkthroughs are
   fixture-driven narration about specific patients and have **no home** once the
   guide holds no fixtures — see Phase D's open question.

## The decision this plan makes (per #401 item 3 — "do not start at the code")

**"The caseload" for a `user/*.read` grant is all 14 demo patients,
unconditionally.** No panel, care-team, or provider-assignment subdivision.
This system has exactly one implicit provider persona and no multi-provider
model anywhere — inventing a narrower cohort concept now would be exactly the
*"baking a wrong answer into the seam"* #401 warns against. If a real panel
concept is ever needed, it is new product scope, not a gap this plan should
guess at.

**Settled 2026-09-03 (Brad) — this was filed as "not decided, raise before
Phase D".** `embedded-panel-smart-launch.md` §6.3 recorded a long-term direction
of *retiring* `/population` and `/patient/chart` from the guide once a
user-scoped launch exists, on the grounds that those are EHR surfaces rather
than implementer ones. **This plan does the opposite and that is now the
decision, not a tension to resolve later:** the routes stay and get a real
token.

The retirement's reasoning was sound and its conclusion did not follow. The
defect in those two views is that the guide *holds the patient data they
render*, not that it renders them; a user-scoped launch fixes that directly,
while retiring the routes would remove the screens and leave the fixtures.

One refinement on top of what this plan already says, which is new and belongs
in Phase D's scope: **a guide page describing the report/dashboard view is
wanted, separate from the live one.** The description belongs where
implementers read; the dashboard itself belongs against patient data. The guide
was doing both jobs with one screen, which is part of why the surfaces read as
tangled. Filed as **#466**, which is also where the mock-EHR / guide / CDS
service / IG relationship should be stated — nothing in the product says it
today, and #466 does not depend on this plan: the relationship is already true
and already unexplained.

⚠️ **The reversal is already written into `embedded-panel-smart-launch.md`**,
rather than waiting for Phase D as originally instructed. Deferring it is what
let two plan docs hold opposite directions for two days; see Phase D step 3,
which is now a check rather than a task.

### Refined 2026-09-09 — the guide URLs explain, the apps are launched

**The 2026-09-03 note above is right that the routes are not deleted and wrong
that they keep rendering the live screens.** Brad, 2026-09-09: `/population`
"should explain the dashboard product, and point to the mock EHR to see it in
action, rather than being interactive on that page"; `/patient/chart` "should
explain the patient-level smart app and how the care pathways can be configured
by the system to help recommend what to do."

So the division is by **job**, and each surface gets one:

| Surface | Holds | Job |
|---|---|---|
| Mock EHR | all patient data | the system of record; **launches** the apps |
| Adoption Guide | zero patient data | **explains** the tools; **hosts** the apps it serves to the host |
| The apps themselves | nothing at rest | render whatever the launch scoped them to |

⚠️ **Which means "the guide holds no patient data" stops being a property of the
data source and becomes a property of the URL space.** The old plan satisfied it
by re-pointing reads: a guide URL still rendered a caseload, just a fetched one.
This version satisfies it by construction — the guide's pages have nothing to
fetch, and the pages that do fetch are not guide pages. That is a stronger
property, it is the one a gate can see (`check:guide-boundary`, fact 5 above),
and it is why Phase 0 exists.

**What is NOT reduced:** the population-level SMART app "indexing across the
patient panel to determine whether an action needs to take place" is the point
of the whole exercise and is still Phase C, unchanged. It gains an address and
a launch button instead of a guide URL and a self-initiated OAuth dance.

## Ground rules (same as `structure-simplification-scope.md`)

1. Branch per PR, squash-merged. Phases are NOT independent this time — B
   depends on A, D depends on B and C — do them in order.
2. Run all three `verify`s (`web/`, `services/cds-hooks/`, `services/mock-ehr/`)
   for any PR touching `packages/`. Fresh worktree needs `npm install` in each,
   plus `npm run copy-fhir` in `web/`.
3. Prove a change to a security-relevant gate can fail before trusting it. In
   particular: **before this plan is done, a planted under-scoped cohort read
   must be seen to 403** — this is the one property the whole plan exists to
   deliver, and #404 was explicit that shipping the capability without proving
   the refusal "would change nothing observable."
4. `services/mock-ehr` needs a real `npm run deploy` after merge — CI does not
   do this automatically (confirmed in #401's own "Done when" list).
5. Update CLAUDE.md and the relevant plan docs (`repo-and-package-boundaries.md`
   §9, `mock-patient-smart-launch.md`, `embedded-panel-smart-launch.md`) only
   where this work makes something in them false — do not rewrite unrelated
   sections.
6. If anything here contradicts what you find in the code, stop and say so —
   this was scoped by reading the code as of 2026-09-01, but not implemented
   against it.

---

## Phase 0 — split the app's routes from the guide's URLs (NEW, 2026-09-09)

**Problem:** one route table serves both jobs, and two of its URLs are the ones
that must become prose. `/patient/chart` cannot be an explanation *and* the
panel's landing route (fact 1), and `Shell.tsx` deliberately refuses to let a
URL mean two things by chrome (fact 2). Nothing else in this plan can start
until the addresses are settled, because Phase A's launch and Phase B's landing
both have to name one.

**Do this first and alone.** It is a pure re-addressing with no behaviour
change, which makes it the one phase that can be verified by "everything still
works" — and doing it under the same PR as a capability change would hide a
broken link in a diff nobody can read.

**Steps:**
1. **Move the app surfaces under one prefix.** `/app/chart`, `/app/dashboard`,
   `/app/measures`, `/app/assessments/*`, `/app/workflow/*`, `/app/pathway`.
   ⚠️ Keep each path's **last segment** byte-identical — `smartIntent.ts` derives
   intents from it, so every `open-*` string and the mock EHR's `KNOWN_INTENTS`
   survive untouched (fact 3). Confirm via `controlPage.test.ts`, do not assume.
2. Re-point, in the same commit: the 42 catalog `launchActions` (fact 3), the 13
   `up=` props and 12 "View in chart" links (fact 4),
   `SmartRedirect.tsx:80`'s default landing, `FhircastListener`'s navigation
   targets, `AppShell.tsx:51`'s `isPatientView` prefix test, `Sidebar.tsx`'s
   patient-lens children, and `/guide/measures`'s redirect.
3. **Redirect every old path**, and keep them: `/patient/*` and `/population/*`
   are published, linked from CDS cards in the wild, and named in
   `docs/mock-ehr-demo-script.md`. The two exceptions are the two URLs this whole
   change is about — `/population` and `/patient/chart` — which become the
   explainers in step 4 rather than redirecting to the app.
4. **Declare the two explainers as guide sections** in
   `web/src/data/guideSections.ts` (`learn` group), with routes in `App.tsx` in
   the exact `<Route path="x" element={<Comp />}>` form the boundary gate
   regexes (fact 5), and make `/population` and `/patient/chart` redirect to
   them. They get the sidebar entry, the pager, the group heading and the
   `check:guide-boundary` walk for free.

   ⚠️ **Content is not a placeholder here.** `/patient/chart`'s page owes an
   explanation of *"how the care pathways can be configured by the system to help
   recommend what to do"* — which is the one thing about SPiER that no existing
   page states end-to-end, and it spans three that each state a third of it:
   `/guide/pathway` (the published PlanDefinition), `/guide/tool-configuration`
   (what an implementation enabled), and the CDS cards the chart renders. Write
   it as the join, not a fourth restatement. #466 is the sibling page (how the
   four surfaces relate) and should land with or before it.
5. Leave the fillers interactive. They hold no patient data with no patient in
   context, they are the guide's "here is the tool" demonstration, and 42 catalog
   launch actions point at them. ⚠️ **Their "View in chart" link is the one loose
   end** — it points at a chart the unlaunched app no longer has. Suppress it
   when there is no session rather than linking a filler to prose.

**Prove it:** `npm run verify` in `web/` plus the mock EHR's own — and then the
part that matters, because ⚠️ **nothing in the repo currently checks that a
launch path resolves to a route.** Verified 2026-09-09:
`web/scripts/check-catalog-integrity.mjs:494` asserts only that a tool *has* a
`launchActions` entry, never that its `path` is registered in `App.tsx`. So a
stale `/patient/*` path after this re-addressing is a dead launch button that
every gate and all the tests pass over.

**This phase owes that assertion**, and it is cheap: parse `path:` out of
`tool-ui-metadata.ts`, parse the route table out of `App.tsx` (the boundary gate
at `check-guide-boundary.mjs:52` already does exactly this read), and fail on any
launch path with no matching route. Per the standing rule, plant a stale path and
watch the new check go red before trusting it — and note the gate must count a
*redirect* as resolving, or step 3's compatibility redirects will read as
failures.

## Phase A — mock EHR: a user-scoped launch context, no patient bound

**Problem:** `/authorize`'s context resolution
(`services/mock-ehr/src/smart.ts:236-257`) only knows `launch` (EHR-launch) and
`patient` (the existing standalone-testing shortcut). Neither produces a grant
with no patient bound.

**Steps:**
1. Add a third context path: `client_id`+`redirect_uri`+`aud`+PKCE present,
   `launch` and `patient` both absent → mint a `LaunchContext` with
   `patient: undefined` (check how `LaunchContext`/`Grant` currently model an
   absent patient — likely needs `patient?: string`, propagated through
   `/token`'s response building and whatever currently assumes `patient` is
   always a string).
2. This context type should only grant `user/*.read`-shaped scope, never a bare
   patient-scoped grant with no patient — a `patient/*.read` scope with no
   patient bound is a contradiction the token would carry silently. Decide
   whether to reject `patient/*.read` outright on this path or silently drop
   it from the granted scope (silently dropping is closer to today's "granted
   scopes are echoed" behavior, but re-read that comment before assuming it —
   this may be the first time scope filtering, not just echoing, is needed).
3. Add `POST /_admin/launch` support for triggering this from the mock EHR's
   own UI — a "Launch as provider" or similar action on `GET /` (the patient
   list / host page), distinct from the existing per-patient chart launch
   button (`chartPage.ts`/`controlPage.ts` → `POST /_admin/launch` with a bound
   patient). Mirror the existing pattern; the difference is the launch context
   carries no patient.
4. Update discovery (`smart.ts:135-162`): add `launch-standalone` to
   `capabilities`, add `user/*.read` (or the relevant scope string) to
   `scopes_supported`.

**Prove it:** a token minted this way must (a) have no patient bound, (b) carry
`user/*.read`, (c) already pass `mayCrossPatients` — confirm with a test
exercising a read for two different patients on the same token, both
succeeding. Then plant the opposite — a patient-scoped token attempting the
same cross-patient read — and confirm it still 403s (this should already pass;
proves you haven't loosened `denyForeignPatient` by accident).

## Phase B — ~~the guide can initiate a launch~~ the HOST launches the dashboard

⚠️ **Rewritten 2026-09-09. Steps 1 and 2 below are struck: the guide no longer
needs to initiate anything.** They existed because `/population` had to render
live and therefore had to get itself a token. A prose `/population` needs no
token, so the launch goes where a launch belongs — **a "Launch population
dashboard" button on the mock EHR's own front door**, beside the per-chart one it
already has, in place of today's labelled iframe. That is Phase A step 3, which
this phase now merely consumes. An app that OAuths itself so it can show a
caseload was an artifact of the guide owning the screen, and removing it also
removes a second launch-initiation code path — the exact drift the original step
2 was worried about.

**What survives is step 3, and it is the load-bearing part**: a user-scoped
return has no patient in context, and today that is indistinguishable from a
failed launch. Also note the iframe is *replaced*, not relabelled — so
`chartPage.ts`'s warning box and its test change in the commit that adds the
button, and #401's "the frame's label changes" checkbox is superseded.

**Steps:**
1. ~~`web/src/main.tsx:57-66`'s routing (`iss && launch` → `#/launch`) is fine for
   the existing EHR-launch path — leave it. Add a new guide-side entry point
   (a link/button, likely near where `Sidebar.tsx:55` currently just links out
   to the mock EHR) that navigates the browser to the mock EHR's
   `/authorize` directly — constructing the URL with `client_id`,
   `redirect_uri` (the guide's own origin — confirm it's already in
   `DEFAULT_REDIRECT_URIS`, `smart.ts:74-79`), `aud`, PKCE challenge, and
   requesting `user/*.read` — with neither `launch` nor `patient` in the
   request, matching Phase A's new context type.~~ **Struck — the host launches,
   per the note above. `/population` is prose and asks for no token.**
2. ~~Decide whether this reuses `SmartLaunch.tsx`'s existing `FHIR.oauth2.authorize()`
   call (which currently relies on fhirclient reading `iss` off
   `location.search` — check whether fhirclient's `authorize()` also accepts an
   explicit `iss`/`fhirServiceUrl` option for a self-initiated flow rather than
   only sniffing the query string) or needs a small parallel path. Prefer
   extending the existing one — two divergent launch-initiation code paths is
   the kind of drift this repo's CLAUDE.md warns about repeatedly.~~ **Struck
   with step 1 — there is no second initiation path to reconcile.**
3. `SmartRedirect.tsx`'s landing logic (`:80`, `directed ?? '/patient/chart'`)
   assumes a patient is always in context. A user-scoped return has no patient
   — land it on **`/app/dashboard`** (Phase 0's address; `/population` is prose
   now and cannot be the landing route, which is the correction 2026-09-09 makes
   to this step) and make sure `client.patient.id` being absent doesn't get
   misread as a failed launch (today, `:84-85`, no `client.patient.id` →
   `setSmartData(client, {})` → navigate to `/`, which was written for the
   *failure* case, not this new *success-with-no-patient* case — these need to
   be distinguished).
4. Replace the front door's iframe with the launch button, and update
   `chartPage.ts`'s warning box plus its assertion in `chartPage.test.ts` in the
   same commit. ⚠️ The claim that replaces it is narrower than it will be
   tempting to write: this is a real SMART launch **against a host we control**,
   so §1 guardrail 3 still forbids calling it evidence of interoperability.

**Prove it:** click it through in a real browser (this is exactly the class of
change CLAUDE.md says to verify in a browser, not just by reading code), land on
`/app/dashboard`, and confirm patient-level reads still work for any patient
picked from there (Phase C dependency). Then plant the distinguishing defect:
a launch that genuinely fails must still land on `/` rather than on an empty
dashboard that looks like a caseload of zero.

## Phase C — a real cohort read on the `FhirDataSource` seam

**Problem:** `useRegistrySlices` does N per-patient `getSlice` calls and
reports `scope: 'in-context'`. Needs a genuine cohort query.

**Steps:**
1. Add a cohort-read method to `FhirDataSource`
   (`packages/core/src/lib/dataSource/types.ts`) — shape it minimally (e.g.
   "list of patient ids + whatever summary fields the registry needs," not a
   full FHIR search/paging contract; this is a demo with 14 patients, not a
   production registry). This lives in `packages/core`, which must stay
   DOM-free — `check:core-boundary` gates this.
2. Implement it on `SmartDataSource` (`packages/core/src/lib/dataSource/smartDataSource.ts`) —
   a real search against the mock EHR (`GET /fhir/Patient` or similar, no
   `patient=` param, relying on the `user/*.read` grant from Phase A).
3. Implement it on whatever the guide's "local" source becomes after this
   plan — if `localDataSource` is fully retired (see Phase D), this may not be
   needed at all; if any local fallback survives, it can just enumerate
   `packages/demo-population`'s ids directly.
4. Update `useRegistrySlices.ts` to call the cohort read and report
   `scope: 'registry'` when backed by a real server, matching #401's "Done
   when" checklist item precisely.

**Prove it:** plant an under-scoped read (a token requesting only
`patient/*.read`, no `user/*.read`) against the new cohort endpoint and confirm
it 403s — per ground rule 3, this is the one proof the whole plan hinges on.

## Phase D — retire the bundled fallback, and only then relabel

**Problem:** once A–C work, the guide should stop having any bundled-data
fallback path, and the honesty labels that are currently true need to become
false in the same commit that makes them actually false.

**Steps:**
1. Remove (or gate behind an explicit, clearly-labeled "offline demo" mode if
   one is still wanted — decide this explicitly, don't default into keeping it
   by inertia) `PatientProvider.tsx`'s `localDataSource` default.
2. ~~`services/mock-ehr/src/chartPage.ts:130`'s *"Embedded, but not a SMART
   launch"* label and `chartPage.test.ts`'s assertion of it: update in this
   same commit, per #401's explicit requirement — never before, never as a
   separate follow-up.~~ **Moved into Phase B step 4 (2026-09-09): the iframe is
   replaced by a launch button, so the label stops being true at that moment
   rather than at the end of the plan.**
2b. **The gate that makes this stick.** Once step 1 lands, add the assertion that
   *no non-test module under `web/src` imports `@spier/demo-population`*. That is
   the machine-checkable form of "the adoption guide holds no patient data", and
   it is strictly stronger than `check:guide-boundary`, which only walks the
   guide's own page graph. Tests may still import the fixtures — they are not
   shipped. Plant an import in a page and watch it go red.
3. ~~Record the reversal of `embedded-panel-smart-launch.md` §6.3's "retire
   `/population` and `/patient/chart`" direction explicitly in that doc.~~
   **Done 2026-09-03, ahead of this phase** — see the decision section above.
   One correction to the original instruction: that doc has no ✏️ convention
   (zero occurrences). It corrects with `~~strikethrough~~` plus a
   `⚠️ **bold**` paragraph, which is what was used. What remains here is to
   *check* the note still matches what shipped.
4. Close `#401` referencing whichever PR(s) did this. Update
   `repo-and-package-boundaries.md` §9 / `mock-patient-smart-launch.md` if
   either still describes the guide as reading bundled data.

### ⚠️ The open question this phase cannot dodge — demo walkthroughs

`PatientProvider.tsx:145` reads `POPULATION_SCENARIOS[activePatientId].walkthrough`,
and `PatientChart` builds a reference index over it
(`buildWalkthroughRefIndex`). **Walkthroughs are fixture-driven narration about
named patients, so step 1 leaves them with no source.** Three options, and this
is a product call rather than a refactor:

1. **Move them to the mock EHR.** It already holds per-patient narration —
   `demoStories.ts`, whose `TRY_IT_ORDER` picks the three charts to open — so the
   two would live together, which is where a reader would expect them. Costs a
   transport (an extension on the `Patient`, or a non-FHIR `/_admin` read the app
   treats as demo furniture, which needs its own honesty label).
2. **Drop them.** Cheapest, and the demo script (`docs/mock-ehr-demo-script.md`)
   now carries the narration a presenter actually reads aloud.
3. **Keep them in the guide as pathway *examples*, detached from patient ids.**
   Fits "the guide explains" exactly, and is the only option that survives the
   `@spier/demo-population` gate in 2b.

⚠️ **Do not let step 1 decide this by deleting the feature silently.** It is the
one user-visible capability this plan removes, and the option chosen changes
whether 2b's gate can pass at all.

**Verification for the whole plan:** all three `verify` pipelines green;
`services/mock-ehr` redeployed and the new launch flow exercised against the
live deployment, not just locally (this is exactly the "live sandbox
validation" class of gap this repo's CLAUDE.md repeatedly flags as untested by
anything offline); the planted-403 proofs from Phases A and C both re-run
clean after revert.
