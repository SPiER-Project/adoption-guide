# User-scoped SMART launch: close #401, retire the guide's bundled patient data

Status: scoped 2026-09-01, not started. Do this in a fresh session/worktree —
it was scoped in a session already deep into an unrelated body of work
(structure-simplification), and needs its own clean context.

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

## The decision this plan makes (per #401 item 3 — "do not start at the code")

**"The caseload" for a `user/*.read` grant is all 14 demo patients,
unconditionally.** No panel, care-team, or provider-assignment subdivision.
This system has exactly one implicit provider persona and no multi-provider
model anywhere — inventing a narrower cohort concept now would be exactly the
*"baking a wrong answer into the seam"* #401 warns against. If a real panel
concept is ever needed, it is new product scope, not a gap this plan should
guess at.

**Not decided here, and worth raising before Phase D:** `embedded-panel-smart-launch.md`
§6.3 records a stated long-term direction of *retiring* `/population` and
`/patient/chart` from the guide once a user-scoped launch exists, on the
grounds that those are EHR surfaces, not implementer ones. This plan does the
opposite — it keeps those routes and gives them a real token. That's a
legitimate call (Brad's), but it's a deliberate reversal of prior recorded
direction, not a gap-fill, and the doc trail should say so explicitly when this
lands (see Phase D).

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

## Phase B — the guide can initiate a launch, not just receive one

**Problem:** the guide has no UI or routing to start a SMART flow itself; it
only completes one that arrived via query params from an external `iss`+`launch`.

**Steps:**
1. `web/src/main.tsx:57-66`'s routing (`iss && launch` → `#/launch`) is fine for
   the existing EHR-launch path — leave it. Add a new guide-side entry point
   (a link/button, likely near where `Sidebar.tsx:55` currently just links out
   to the mock EHR) that navigates the browser to the mock EHR's
   `/authorize` directly — constructing the URL with `client_id`,
   `redirect_uri` (the guide's own origin — confirm it's already in
   `DEFAULT_REDIRECT_URIS`, `smart.ts:74-79`), `aud`, PKCE challenge, and
   requesting `user/*.read` — with neither `launch` nor `patient` in the
   request, matching Phase A's new context type.
2. Decide whether this reuses `SmartLaunch.tsx`'s existing `FHIR.oauth2.authorize()`
   call (which currently relies on fhirclient reading `iss` off
   `location.search` — check whether fhirclient's `authorize()` also accepts an
   explicit `iss`/`fhirServiceUrl` option for a self-initiated flow rather than
   only sniffing the query string) or needs a small parallel path. Prefer
   extending the existing one — two divergent launch-initiation code paths is
   the kind of drift this repo's CLAUDE.md warns about repeatedly.
3. `SmartRedirect.tsx`'s landing logic (`:80`, `directed ?? '/patient/chart'`)
   assumes a patient is always in context. A user-scoped return has no patient
   — decide the landing route (`/population` is the obvious candidate) and
   make sure `client.patient.id` being absent doesn't get misread as a failed
   launch (today, `:84-85`, no `client.patient.id` → `setSmartData(client, {})`
   → navigate to `/`, which was written for the *failure* case, not this new
   *success-with-no-patient* case — these need to be distinguished).

**Prove it:** click through the new entry point in a real browser (this is
exactly the class of change CLAUDE.md says to verify in a browser, not just by
reading code), land on the population view, and confirm patient-level reads
still work correctly for any patient picked from there (Phase C dependency).

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
2. `services/mock-ehr/src/chartPage.ts:130`'s *"Embedded, but not a SMART
   launch"* label and `chartPage.test.ts`'s assertion of it: update in this
   same commit, per #401's explicit requirement — never before, never as a
   separate follow-up.
3. Record the reversal of `embedded-panel-smart-launch.md` §6.3's "retire
   `/population` and `/patient/chart`" direction explicitly in that doc (an
   ✏️-style correction, matching that doc's own convention) — don't let it sit
   contradicted.
4. Close `#401` referencing whichever PR(s) did this. Update
   `repo-and-package-boundaries.md` §9 / `mock-patient-smart-launch.md` if
   either still describes the guide as reading bundled data.

**Verification for the whole plan:** all three `verify` pipelines green;
`services/mock-ehr` redeployed and the new launch flow exercised against the
live deployment, not just locally (this is exactly the "live sandbox
validation" class of gap this repo's CLAUDE.md repeatedly flags as untested by
anything offline); the planted-403 proofs from Phases A and C both re-run
clean after revert.
