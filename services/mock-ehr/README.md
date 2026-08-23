# `@spier/mock-ehr` — a mock EHR FHIR server

Serves SPiER's own synthetic population as a real FHIR read API, on its **own
Worker and therefore its own origin**, so the embedded SMART panel can be
launched cross-origin against a server rather than against localStorage.

Panel **steps 1, 2, 4 and 5**. The spec is [`docs/plans/mock-ehr-read-api.md`](../../docs/plans/mock-ehr-read-api.md);
the decision that permits a mock we control at all is
[`embedded-panel-smart-launch.md`](../../docs/plans/embedded-panel-smart-launch.md) §8,
and it is permitted only with the guardrails in §1 of that plan.

> ⚠️ **Nothing observed here is evidence of interoperability.** This server is
> controlled by the project it is demonstrating. The portability claim is made
> separately, by loading the same Bundles into a public sandbox we do not
> control. That is a condition of the decision, not a caveat.

## What it serves

| | |
|---|---|
| FHIR base | `/fhir` |
| Discovery | `GET /fhir/.well-known/smart-configuration` |
| Read | `GET /fhir/{Type}/{id}` |
| Search | `GET /fhir/{Type}?patient={id}[&category={token}]` → searchset `Bundle` |
| Capability | `GET /fhir/metadata` |
| Authorize | `GET /authorize` — PKCE S256 required |
| Token | `POST /token` |
| Control page | `GET /` — mint a launch, switch the capability profile |
| Profile API | `GET`/`PUT /_admin/capabilities` |
| Launch API | `POST /_admin/launch` |

Data is the app's own files, with **no second copy of anything**: the scenarios
from `web/src/data/population/scenarios/patient-0NN.json` and the 14 Patients
from the FSH-generated `packages/fhir-artifacts/generated/Patient-patient-0NN.json`. Both are
inlined by the Vite build, because a Worker has no filesystem — the same
arrangement `services/cds-hooks` uses, and the reason `main` in `wrangler.jsonc`
points at `dist/index.js` rather than at source.

**`npm run copy-fhir` in `web/` is a prerequisite.** Without it there are no
Patient resources; the loader throws rather than serving an empty server that
looks like a working one.

## What it refuses to do, and why

Each of these is a case where a lenient mock returns something plausible and
wrong, which is the exact failure `mock-patient-smart-launch.md` §6 predicted.

- **An unknown search parameter is a 400**, not an ignored one. Ignoring
  `_count` answers a question nobody asked and the caller cannot tell.
- **A type it does not implement is a 404**, not an empty Bundle. An empty
  Bundle is indistinguishable from a patient who has none.
- **`category` genuinely filters.** `category=survey` and `category=procedure`
  are two different searches feeding two different parts of the chart; a mock
  that ignores the parameter puts one in the other's bucket, and the chart looks
  subtly wrong rather than broken.
- **No `link.next` is ever emitted.** `SmartDataSource` searches with
  `pageLimit: 0`, which means "follow every `next`" — a link this server cannot
  serve would loop the client rather than fail it.

## The capability switch

`/fhir/metadata` is the smallest endpoint here and the most load-bearing: the
writeback ladder reads it and attempts only the tiers it advertises `create`
for. Four profiles, switchable from the control page at runtime:

| Profile | Creates | What the ladder does |
|---|---|---|
| `full` | QR, Observation, Condition, DocumentReference | every tier lands |
| `no-observation` | QR, DocumentReference | Tier 2 `unsupported`; the floor carries it |
| `documents-only` | DocumentReference | Tiers 1–3 `unsupported` |
| `read-only` | — | nothing is attempted |

Flip it, relaunch the panel, submit the same instrument, and the scorecard
changes. ⚠️ The active profile lives in **module memory**: per-isolate, gone on a
cold start. Flip immediately before launching. Durable state (KV / a Durable
Object) is a later step; the seam that would have been costly to retrofit is
`src/capability.ts`, not its storage.

## The SMART launch (step 2)

`GET /` mints a launch: pick a patient, optionally an `intent`, and get the URL
an EHR would open — the app's `launch_uri` carrying `iss` and `launch`. From
there the app runs the ordinary authorization-code flow against `/authorize` and
`/token`.

What is actually verified, because a stub that skips these proves nothing:

- **PKCE S256** — required at `/authorize`, and the verifier is checked with
  real SHA-256 at `/token`.
  ⚠️ It can be skipped by *omission*: fhirclient only sends a challenge when
  discovery advertises `code_challenge_methods_supported: ["S256"]`. Remove that
  and PKCE silently stops happening while the login still works. The discovery
  document and the `/authorize` requirement are two halves of one decision, and
  both are asserted.
- **`redirect_uri`** — exact match against a registered list, and an
  unregistered one is *refused without redirecting*. Bouncing an error to
  whatever URI was asked for is the open-redirect bug.
- **`aud`** — must name this server's FHIR base, or the parameter is decorative.
- **Patient binding** — a token is issued for one patient, and reaching for
  another is a `403`. Otherwise one token reads all 14 charts and
  "patient-scoped" is a claim this server does not support.
- **Code replay** — best effort only, and honestly so: see below.

`/fhir` requires a bearer token by default (`MOCK_AUTH_ENFORCE=off` reopens it
for curl exploration). `/metadata` and discovery stay pre-auth, because a client
reads them to learn how to authorize at all.

### What the auth stub does NOT prove

- **No `id_token`.** `openid fhirUser` is requested by the app and not honoured.
  A real one needs a signing key and a published JWKS; a fake one is exactly the
  shortcut named above. `client.user` is null — honest and harmless.
- **No scope enforcement.** Granted scopes are echoed and carried on the token,
  but no read is refused for a missing scope. **Do not describe this mock as
  proving SMART scopes work.** The patient binding is a different thing, and it
  is enforced.
- **No refresh tokens.**
- **No consent screen** — `/authorize` auto-approves. Decided, not skipped: a
  clinician launching from a chart does not re-consent per launch, so this is
  the realistic behaviour for the scenario being demonstrated. Per-scope consent
  would be theatre while nothing enforces scopes.
  [`embedded-panel-smart-launch.md` §10.1](../../docs/plans/embedded-panel-smart-launch.md).
- **Replay is only best-effort.** Every artifact is a signed, self-contained
  blob rather than a row in a table, because a Worker has no shared memory and
  `/authorize` and `/token` can land in different isolates — a table there
  fails the login intermittently, in front of an audience. The cost is that
  "used" cannot be written down: an authorization code is replayable inside its
  60-second window across isolates. Acceptable for synthetic data on a demo
  host, and nowhere else. Step 4 needs a Durable Object for writes anyway; this
  should move behind it then.

## The host chrome (step 5)

| Route | |
|---|---|
| `GET /` | **the front door** — SPiER's caseload summary embedded as a hosted activity, then the host's own patient list |
| `GET /chart/{id}` | one chart: host banner, the **launch** front and centre, CDS Hooks cards, and the panel **in an iframe** |
| `GET /settings` | the operator's bench — capability switch, panel-width preference, top-level launch, FHIR base |
| `GET /chart` | 301 to `/` (this URL was the list before the list became the front door) |

⚠️ **`/` and `/chart/{id}` are the demo; `/settings` is the bench.** These were
the other way round, and it was a real defect: the root served a capability switch
and a launch form while the thing worth looking at was two undiscoverable clicks
away. See the panel plan §6.3. The bench keeps the top-level launch, because a
top-level launch is the useful thing to compare an embedded one against and it can
send an arbitrary `intent`.

⚠️ **The embedded activity is the caseload SUMMARY, not the whole Population lens,
and that is a correction rather than a trim.** The lens contains a sortable
caseload table, so framing it put **two patient lists** on this page — and the
better-looking one went nowhere, because a row click inside the frame navigates
*within the frame* rather than opening `/chart/{id}` here. The frame is now
`?embed=1#/population/summary` (`PopulationSummaryEmbed`): the summary tiles, the
risk census and the alert groups — the part a host cannot compute for itself — with
no table and no page header. It comes first on the page, and the host's own plain
table is the only list. Both it and the full lens read `useCaseloadSummary`, so
they cannot disagree about the numbers.

⚠️ **It is still NOT a SMART launch**, and the page says so: panel chrome, no
`iss`, no `launch`. The remaining blocker is **one** thing, a user-scoped launch —
a caseload is not one patient and every token here is bound to one — plus a cohort
read this server does not offer (#401). ⚠️ This README previously also blamed
`PopulationView` for importing `localDataSource` directly. **That was closed by
step C (#390)** and stayed written down here for weeks: the lens and the widget
both read through the `FhirDataSource` seam, and the frame shows bundled data
because it carries no launch, so the active source is the local one. Panel plan
§6.3 has the reasoning and what the upgrade unlocks.

⚠️ **After you launch a panel, going back to `/` in the SAME TAB shows the widget
scoped to one patient — and that is truthful, not a bug.** The SMART session lives
in `sessionStorage` on the *panel's* origin, and a same-origin iframe in the same
tab shares it, so the widget's active data source is a token bound to the patient
you just launched. It says so ("Showing the patient in context only") and reports a
caseload of one. Pre-existing — the full-lens embed did the same — but it is more
visible now that the widget is the first thing on the page. **Demonstrate the
caseload from a fresh tab**, or expect a one-patient census after a launch.

⚠️ **The chart leads with the launch, and carries no controls.** The launch button
was the last element on `/chart/{id}` — below the CDS cards, the capability switch
and the FHIRcast log, under an `<h2>Activity</h2>` — which is the front door's old
defect one level down. It now sits directly under the patient banner. The
capability switch and the write reset went to `/settings` (they were already
there), and the three panel-width buttons became a `/settings` preference stored in
`localStorage` under `spier-mock-ehr:panel-width`; a chart reads it, validates it
against the three measured widths, and falls back to **470px** — so a viewer who
never opens `/settings` gets the middle one and decides nothing.

⚠️ Dropping the chart's capability switch **inverts** the decision that put it
there ("flipping the profile mid-demo should not mean leaving the chart"), and the
Durable Object is what makes that safe: the live profile was per-isolate module
memory then, so a flip elsewhere could leave the panel told something different.
It is durable now, so `/settings` in a second tab changes what an open chart's
panel reads from `/metadata`. The write log **stays** on the chart, because a
readout is not a control — and it is the server's own account of what the panel
wrote, which is the only thing that corroborates the panel's scorecard.

Two entry points, which are the two the panel plan names (§2): an activity button
that knows only the patient, and a **CDS Hooks card whose link is
`type: "smart"`** — the card names the instrument, so the panel opens already
scoped to it. The card comes from the *panel* host's `/cds-services` endpoint
(one Worker serves the SPA and that API), and its `appContext` carries
`{"intent":"open-…"}` which this server copies into the SMART launch context.
The division of labour is the spec's: the CDS service proposes, the EHR mints
the launch.

Every embedded launch sends **`need_patient_banner: false`**, because the chart
draws a banner two inches to the left, and **`embed=1`** on the launch URL, which
is what puts the app in panel chrome. Both are visible on the page as "launch
context sent", so what the host claimed can be read off the screen.

⚠️ **`embed=1` goes in the query, before the `#`.** The app reads it from
`location.search` (under `HashRouter` that is what makes it survive in-app
navigation); appended after the fragment it becomes part of the route and is
silently ignored, and the panel renders full EHR chrome inside the frame with
nothing failing. `chartPage.test.ts` pins the ordering.

### Local dev against a local panel

`wrangler dev` loads `.dev.vars` (gitignored). To frame a locally-served panel:

```
# services/mock-ehr/.dev.vars
MOCK_PANEL_BASE_URL=http://localhost:8788/
MOCK_REDIRECT_URIS=http://localhost:8788/

# services/cds-hooks/.dev.vars
PANEL_FRAME_ANCESTORS='self' http://localhost:8787
```

Then `npm run dev -- --port 8787` here and `npm run dev -- --port 8788` in
`services/cds-hooks` (`.claude/launch.json` has both as `mock-ehr` and
`panel-worker`). Both halves are needed: an unregistered `redirect_uri` is
refused **without a `Location` header**, and a panel whose `frame-ancestors` does
not name this origin renders as a blocked frame. ⚠️ `wrangler dev` does **not**
hot-reload `.dev.vars` — restart it.

## Writes (step 4)

| Route | |
|---|---|
| `POST /fhir/{Type}` | create — capability-gated, validated, patient-scoped. 201 + representation + `Location`, with a **server-minted** id (`srv-N`) |
| `PUT /fhir/{Type}/{id}` | update-as-create for the lifecycle types, keeping the **client's** id. 201 first, 200 on replacement |
| `GET /_admin/writes` | the server's own account of what it stored |
| `POST /_admin/reset` | discard the writes; the capability profile survives |

Reads reflect writes: the fixtures and the store are merged keyed by `Type/id`,
with a written resource replacing a fixture of the same id, so an episode opened
and later closed converges on one resource instead of appearing twice.

⚠️ **`PUT` exists because a browser found it, not because the spec asked.** The
plan's §4 lists `POST` only, but `SmartDataSource.saveArtifact` PUTs the eight
LIFECYCLE types so open→close converges. Following the spec exactly produced a
panel whose save aborted on the CORS preflight — with a console error about
`Access-Control-Allow-Methods`, which reads as configuration rather than a
missing route. `Prefer` had to join `allowHeaders` for the same reason.

⚠️ **`POST` must mint an id, and cannot do otherwise.**
`SmartDataSource.toCreatePayload` deletes the client's `id` before POSTing, so
there is nothing to echo. `executeWritePlan` then remaps
`QuestionnaireResponse/<client id>` to the server's id inside
`Observation.derivedFrom`. What a real server buys is that a **failed** remap
becomes visible: disable it and the written Observations point at
`QuestionnaireResponse/p011-asq`, a resource this server has never held. (An
earlier version of this note claimed a server echoing the client's id back would
hide the bug — planted, and it changed nothing, because no id is ever sent.)

### Two capability axes, not one

`creatableTypes(profile)` is the writeback ladder (Tiers 0–3: QuestionnaireResponse,
Observation, Condition, DocumentReference) — what the degradation demo turns down.
`updatableTypes(profile)` is the lifecycle set, permitted by every profile except
`read-only`. Collapsing them refused every lifecycle write **even under `full`**;
they overlap only at `DocumentReference`.

### Validation is not this service's opinion

Guardrail 1 of the plan's §1 requires the mock to reuse
`check-scenario-resources.mjs`'s checks *"rather than inventing a second, laxer
opinion"* — because **a lenient mock accepts writes a real EHR rejects, and the
demo then looks better while proving less**. The rules live in
[`web/scripts/lib/fhir-resource-rules.mjs`](../../web/scripts/lib/fhir-resource-rules.mjs)
and both callers share them verbatim.

⚠️ This README previously said that would have to be a *port*, "not a reuse of it
(that script is Node reading StructureDefinitions off a filesystem)". True of the
script, false of the rules: they need the conformance resources only as data, and
`import.meta.glob` inlines them into this Worker exactly as it already inlines the
Patients.

Two things follow, and both are deliberate:

- **An invalid write is a 422 listing EVERY problem**, not the first one. A 422
  naming one defect invites fixing that one and re-POSTing forever.
- **An empty conformance index is a startup crash, not a permissive validator.**
  Point the glob at a nonexistent prefix and the module throws; without that,
  `copy-fhir` not having run would make this endpoint accept anything and look
  like a working server.

⚠️ **An accepted write is still not conformance evidence** (guardrail 3), and an
**unprofiled** resource is checked far less deeply — no `meta.profile` means
base-R4 checks only. Pinned by a test so the hole is written down rather than
discovered.

## Not here

**No transaction Bundle, no delete, no search beyond `patient` + `category`** —
the writeback ladder POSTs one resource at a time, and an endpoint nothing
exercises is an endpoint nobody has watched reject anything. **No encounter page, no user, no login**
— `patient-view` needs a patient, and a fabricated practitioner would be theatre.
**No CDS prefetch**: the chart page sends context only, so the service takes its
documented fallback path and serves the bundled scenario for that patient id.
Same data either way, and it keeps the page from needing a bearer token for this
server's own API — but it does silently select a different code path in the
service, so it is a decision rather than an omission.

## Verify

```
npm install && npm run verify   # copy-fhir + typecheck + eslint + vitest
```

## Deploy

⚠️ **This Worker is NOT deployed by CI.** The panel host redeploys itself from
`main` through the Cloudflare dashboard integration; this one does not. After
merging anything under `services/mock-ehr/`:

```
npm install && npm run deploy
```

Otherwise the live host keeps serving the old build, and the symptom is a demo
that behaves like the previous commit — which reads as a code bug rather than a
deploy that never happened.

⚠️ **`npm install` is not belt-and-braces here — this package has its own
`node_modules` and nothing else installs it.** This line said `npm run deploy`
alone, and in a checkout where only `web/` had ever been installed it fails at
`vite: command not found` — which reads as a broken build script rather than a
missing install. Same rule as `CLAUDE.md`'s note about `web/`, one directory
over. Nor is CI cover: the `mock-ehr` job installs into its *own* runner, so a
green PR says nothing about whether your machine can build this.

⚠️ **Deploy AFTER the panel host has redeployed, not before.** They are two
Workers and only one is automatic, so between a merge and this command the pair
is briefly mismatched. That direction is the harmless one — an old host framing a
new panel. The other direction is not: deploy this first and the front door
frames `#/population/summary` on a panel build that has no such route, and
`HashRouter` answers an unknown route with the app's fallback rather than an
error, so the frame renders something plausible and wrong.

`web/`'s `npm run verify` does **not** cover this package. CI runs the same
`verify` as its own `mock-ehr` job in `.github/workflows/web-lint.yml`, which
triggers on `services/**` — this service reads the scenario fixtures that
`web/scripts/shift-scenario-dates.mjs` periodically re-anchors, and that break
would otherwise be silent and show up as an empty chart mid-demo.

Every test that reads `/fhir` obtains its token through the **real**
`/authorize` → `/token` flow (`src/__fixtures__/launch.ts`), never a hand-minted
one — so the auth stub is exercised by the whole suite rather than by the
handful of cases that name it.

`src/smartDataSource.integration.test.ts` is the one to keep working: it stands
the app up on a loopback HTTP server and drives the **real** `SmartDataSource`
through a **real** fhirclient against it. The read API was specified by reading
that class, so every other test can only confirm the same reading — this one is
what caught the missing `QuestionnaireResponse.subject` (see `NORMALIZED_LINKS`
in `src/fixtures.ts`). It also asserts the failure direction: a 500 on a
load-bearing search must reject, and a 500 on a best-effort one must degrade.

`fhirclient` is deliberately **not** a dependency here — it is aliased to
`web/node_modules` in `vitest.config.ts` and `tsconfig.json`. A second copy
could drift from the version the app ships, and the test would then exercise a
client the panel never uses.

`wrangler` is pinned to `~4.107.0` to match `services/cds-hooks`; 4.124+ peer-
depends on `@cloudflare/workers-types` v5, which conflicts with the v4 types
both services use.
