# `@spier/mock-ehr` — a mock EHR FHIR server

Serves SPiER's own synthetic population as a real FHIR read API, on its **own
Worker and therefore its own origin**, so the embedded SMART panel can be
launched cross-origin against a server rather than against localStorage.

Panel **steps 1, 2, 4 and 5**. The spec is [`docs/plans/archive/mock-ehr-read-api.md`](../../docs/plans/archive/mock-ehr-read-api.md);
the decision that permits a mock we control at all is
[`embedded-panel-smart-launch.md`](../../docs/plans/embedded-panel-smart-launch.md) §8,
and it is permitted only with the guardrails in §1 of that plan.

> **Running the demo?** [`docs/mock-ehr-demo-script.md`](../../docs/mock-ehr-demo-script.md)
> is the ten-minute *what to click*. This README is the *why*.

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
| Search | `GET /fhir/{Type}?patient={id}[&category={token}][&identifier={token}]` → searchset `Bundle` |
| Capability | `GET /fhir/metadata` |
| Authorize | `GET /authorize` — PKCE S256 required |
| Token | `POST /token` |
| Control page | `GET /` — mint a launch, switch the capability profile |
| Profile API | `GET`/`PUT /_admin/capabilities` |
| Launch API | `POST /_admin/launch` |

Data is the app's own files, with **no second copy of anything**: the scenarios
from `packages/demo-population/src/scenarios/patient-0NN.json` and the 14 Patients
from `packages/demo-population/src/patients/patient-0NN.json`. Both are
inlined by the Vite build, because a Worker has no filesystem — the same
arrangement `services/guide` uses, and the reason `main` in `wrangler.jsonc`
points at `dist/index.js` rather than at source.

⚠️ **This said the Patients were FSH-generated, read from
`packages/fhir-artifacts/generated/`, and that `copy-fhir` had to run or the
loader would throw for want of them. All of that was the state before #399**, and
it describes the exact dependency step E existed to remove — `fixtures.ts` says
so in place: *"should not depend on a SUSHI compile, and the IG was publishing 14
examples that referenced none of its own profiles."*

`npm run copy-fhir` at the repo root is still a prerequisite for this package's
`verify` — the tool catalog reads generated artifacts — but **not for the Patient
roster**, which no longer needs a SUSHI compile at all.

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
| `GET /` | **the front door** — "Start here" (three named charts with a reason and a thing to notice), the host's patient list with a one-line story per chart, then SPiER's caseload summary embedded as a hosted activity, then a closed "About this demo" drawer holding every caveat |
| `GET /chart/{id}` | one chart: host banner, the **launch** front and centre, CDS Hooks cards, the panel **in an iframe**, and a closed "Under the hood" drawer holding the evidence (CDS endpoint, the SMART launch context the host minted, write log, FHIRcast) |
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
no table and no page header. The host's own plain table is the only list. Both it
and the full lens read `useCaseloadSummary`, so they cannot disagree about the
numbers.

⚠️ **The widget came FIRST on the page until 2026-09, and that was the front
door's defect a third time.** It sat where an EHR hangs a hosted activity, so a
first-time viewer met, in order: "this is not SPiER", a dense registry widget, a
warning box saying the widget proves nothing, and only then "open a chart" — the
one thing the page disclaims was the first thing on it. Reviewed as a user:
*"there's a lot of technical information about how the thing is built, but it
doesn't make it easy to understand what the heck I'm supposed to do."* ⚠️ **The
order moved a third time on 2026-09-15 and now reads caseload → start here →
patient list → about** — not a revert, because #401 deleted the dense frame this
paragraph is about, leaving a heading, two sentences and two buttons. What did
not move: the instruction still outranks every section, and the caveats are still
in the closed drawer. `chartPage.ts`'s ordering comment carries all three passes
and the condition that would send it back down. The rest of this paragraph is
about the content, which is unchanged: `demoStories.ts`
carries a one-line story per patient (host voice, no demographics — not a fifth
copy of the patient data, and `demoStories.test.ts` pins its key set to
`DEMO_PATIENTS`) plus the three `TRY_IT_ORDER` picks, chosen so the "fill one in
and watch it write back" story has somewhere to happen: an empty chart
(patient-002), a high-risk chart with the stabilization plan still to do (patient-006),
and a complete ED episode (patient-011). Every caveat moved into a closed
`<details class="hood">` — still on the page, because the panel plan §1 requires
the page to SAY what it does not prove; it does not require that first.

⚠️ ~~**It is still NOT a SMART launch**, and the page says so: panel chrome, no
`iss`, no `launch`. The remaining blocker is **one** thing, a user-scoped launch —
a caseload is not one patient and every token here is bound to one — plus a cohort
read this server does not offer (#401).~~ **It IS a SMART launch now, and the
frame is gone entirely.** #489 made the auth stub issue a patient-less
`user/*.read` grant, #491 gave this server the cohort read, #494 closed #401. The
page carries a launch button, not an iframe — so the honesty claim narrowed rather
than disappearing: what it does not prove is *interoperability*, because this host
is written and run by the same project as the app it launches. ⚠️ This README
previously also blamed
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

⚠️ **The chart's evidence lives in a closed "Under the hood" drawer.** The CDS
endpoint URL, the write log, the FHIRcast subscription status, the announce
control and its log used to sit inline at the same weight as the launch button,
so the page read as a description of how it was built. All of it is still there,
one click away; the CDS **cards** stay outside the drawer because they are the
second launch path, and a launch path is not evidence. The launch card's lede now
says what launching does (opens SPiER on this patient, shows where they are on
the pathway, writes back what you record) plus this chart's one-line story, with
the protocol note one size down.

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
scoped to it. The card comes from `spier-cds` (`services/cds`) — a **third**
origin, neither the panel's nor this host's, so `DEFAULT_PANEL_BASE_URL` and
`DEFAULT_CDS_BASE_URL` in `src/app.ts` are two separate constants rather than one
derived from the other. Its `appContext` carries
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
# Only if the CDS Hooks service is NOT on the panel's origin (it is, locally):
# MOCK_CDS_BASE_URL=http://localhost:8788/

# services/guide/.dev.vars
PANEL_FRAME_ANCESTORS='self' http://localhost:8787
```

Then `npm run dev -- --port 8787` here and `npm run dev -- --port 8788` in
`services/guide` (`.claude/launch.json` has both as `mock-ehr` and
`panel-worker`). Both halves are needed: an unregistered `redirect_uri` is
refused **without a `Location` header**, and a panel whose `frame-ancestors` does
not name this origin renders as a blocked frame. ⚠️ `wrangler dev` does **not**
hot-reload `.dev.vars` — restart it.

## This host is a CDS Client, and it signs

CDS Hooks 2.0 says a CDS Client SHALL send `Authorization: Bearer <JWT>` on every
service call, signed with its own key, and that the service verifies it. SPiER's
service (`services/cds`) has implemented the verifying half since #147 — and ran
in `warn` mode until 2026-09-20, which logs a failure and then proceeds.

⚠️ **An enforcement mode that never rejects is not authentication; it is a log
line.** And the reason it stayed that way was real: nothing in the demo could
mint a token, so `require` would have turned this chart's cards into a 401. The
missing half is `src/cdsClient.ts`.

| Piece | Where |
| --- | --- |
| ES384 keypair, generated on first use | `DemoStore` Durable Object, `cds-signing-key` |
| Public half | `GET /.well-known/jwks.json` |
| Signed, server-to-server invoke | `POST /_admin/cds` |

⚠️ **The key lives in the Durable Object for the same reason the capability
profile does.** A Worker runs many isolates; a per-isolate keypair would mean the
isolate answering `/.well-known/jwks.json` publishing a key the *signing* isolate
does not hold. The verifier would then reject a token this host had legitimately
minted — intermittently, and never under `wrangler dev`, which is one isolate.
`putCdsKeyIfAbsent` is "if absent" and returns the incumbent precisely because
two isolates can race to generate on a cold start.

⚠️ **A checked-in demo keypair was the obvious alternative and is worse than it
looks.** Not because this key protects anything — it guards synthetic patients,
same as `MOCK_SIGNING_SECRET` — but because a private key in a public repo is
indistinguishable, to every scanner and every reader, from one that does. This
repo is the reference an adopter copies.

⚠️ **The call moved server-to-server, and that is a correctness fix as much as
plumbing.** The chart page used to POST to the CDS service straight from the
browser. That is not how CDS Hooks works — the *EHR* invokes the service — and it
is also why signing was impossible: the only ways to let a browser send a signed
token are to give the browser a key or to mint one for anyone who loads the page,
and both give away the identity the signature is supposed to prove. So the
browser posts to `/_admin/cds` and this host makes the call.

The chart page still **displays** the service's real URL (that is what the reader
wants to see, and `chartPage.test.ts` asserts the three origins stay distinct
through it); only the fetch target changed.

⚠️ **No `jose` here, unlike the service.** A compact JWS is two base64url
segments, a signature and a dot; `tokens.ts` already has the base64url helpers,
and WebCrypto's ECDSA output is *already* the raw `r || s` pair JWS specifies
(Node's `crypto` emits DER for the same call and would need re-encoding). Adding
a library to concatenate three strings would put a dependency in a Worker whose
whole point is to be a small honest fake.

The handshake is proved end to end in **`services/cds/src/cdsClientInterop.test.ts`**,
which imports this module's real minting code and runs it through the real
middleware under the deployed policy — see that service's README for why neither
side's own tests could have caught a mismatch.

## The look of the host

⚠️ **The host is slate and steel; SPiER is plum and raspberry. That is a claim,
not a taste.** Every page here says some version of *"Everything below this bar
is drawn by SPiER, not by the host"* — and until this pass, the host drew its own
**Launch SPiER** button in SPiER's raspberry, on the same page. A viewer had no
way to read the boundary the demo is about, because both sides of it were the
same colour.

So the host now looks like vendor software: a dark slate app bar, steel-blue
actions, tight radii, dense ruled tables, system fonts (SPiER ships Poppins).
SPiER's brand appears on these pages in exactly one role — `--guest-brand`, on
the `.guest__title` wordmark above a frame SPiER drew. Nothing else may use it.

⚠️ **`hostChrome.ts` used to argue the opposite** ("matching the app's palette
makes the screenshot legible") and it is worth knowing that reasoning was
considered and reversed, not overlooked. The file carries the full note.

### It has tokens now, and a gate

The old objection to a design system here was structural, and half right: these
pages are template strings from a Worker with no stylesheet, no build step and no
token file, so stylelint and `check:tokens` cannot see them. But *"cannot use the
app's tokens"* is not *"cannot have tokens"* — custom properties need no build
step.

What the previous arrangement actually produced was the drift `CLAUDE.md` warns
about, arriving inside the fix for it. `hostChrome.ts` was extracted **from**
`controlPage.ts` to give the palette one definition; `controlPage.ts` then went
on building its own `<!doctype>` document with `#5c4a54`, `#f3eef1`, `#d8cdd4`
and `#fdf5f8` typed as literals, plus its own `button`, `.warn`, `code` and `h1`
rules, for as long as it existed. The extraction happened and the adoption did
not.

| | |
|---|---|
| `TOKENS` in `hostChrome.ts` | the palette, spacing ramp, radius, type scale — **the only place in `src/` allowed to contain a hex literal** |
| `COMPONENTS` in `hostChrome.ts` | the app bar, `.page`, `.card`, `.btn`, `.table`, `.form`, `.callout`, `.crumbs`, `.guest` |
| `page()` | emits the app bar and the page inset, so a page cannot forget the chrome |
| a page's own CSS | only what describes *that page's* one arrangement — the chart's dock, the front door's frame height |

`npm run check:host-css` enforces both halves, and is in `verify` (and therefore
in CI, which runs `verify` rather than re-listing its steps):

- **no hex outside `TOKENS`** — this service's stand-in for the app's
  `color-no-hex`;
- **every `var(--…)` resolves** — stylelint's blind spot, which the app hit for
  real in #280: `color: var(--made-up)` satisfies "uses a token" and ships a
  value the browser drops. A fallback does not excuse an undefined token.

Both rules **fail when they read nothing**, which matters more than usual here:
the token block is found by parsing for `export const TOKENS`, so a rename would
otherwise leave the gate checking `var()` against an empty set and passing
everything. It was proved by planting four defects — a raw hex, an undefined
token, an undefined token *with* a fallback, and that rename — and watching each
one fail.

⚠️ **Its one false-negative is written down rather than hidden**: an all-decimal
3- or 4-digit hex (`#000`) is indistinguishable from `#404`, and this repo cites
issue numbers constantly — a naive matcher reported 25 issue references and zero
real findings. Six-digit greys *are* caught. `src/hostCss.test.ts` pins both
directions.

### The one number that is not a token

The front door's framed activity is 46rem tall stacked and 25rem side by side,
because the widget inside it has a breakpoint at **1100px of frame width**. That
rule is a **container query** (`container: guest / inline-size` on `.guest`), and
it is worth knowing why: it was a media query at 1148px — 1100 plus the 48px of
page inset — with a comment warning that getting the offset wrong by 48px would
reintroduce a scrollbar in a band of window sizes nobody would find. Then the
page grew a `max-width`, the frame could no longer exceed 1040px at any window
width, and the side-by-side branch became unreachable. The measurement was always
about the frame, so the query now asks the frame.

## Writes (step 4)

| Route | |
|---|---|
| `POST /fhir/{Type}` | create — capability-gated, validated, patient-scoped. 201 + representation + `Location`, with a **server-minted** id (`srv-N`) |
| `PUT /fhir/{Type}/{id}` | **update only** — 200, or **404** if this server does not already hold that id |
| `GET /_admin/writes` | the server's own account of what it stored |
| `POST /_admin/reset` | discard the writes; the capability profile survives |

Reads reflect writes: the fixtures and the store are merged keyed by `Type/id`,
with a written resource replacing a fixture of the same id, so an episode opened
and later closed converges on one resource instead of appearing twice.

⚠️ **This server did update-as-create for months, and that was the single most
expensive thing it ever got wrong.** It accepted `PUT /fhir/{Type}/{client-minted
id}` and created the resource, because `SmartDataSource.saveArtifact` wrote the
eight LIFECYCLE types that way and the alternative was a demo that did not save.
The note here used to say *"`PUT` exists because a browser found it, not because
the spec asked"* — candid, and candour did not make it safe.

FHIR permits update-as-create; real servers frequently refuse it. Medplum answers
`400 Invalid id` to a prefixed id and `404` to a bare UUID it does not hold, and
because `ensureEncounter()` runs before nearly every save, that one refusal
blocked **every** write. SPiER's entire writeback passed here and failed at the
first server nobody on this project had written — see
[`docs/plans/archive/medplum-spike-2026-09-17.md`](../../docs/plans/archive/medplum-spike-2026-09-17.md).

**That is the hazard of a mock you control: when the app and the server disagree,
the server is what moves.** A `PUT` to an id this server does not hold is a 404
now, and says what to do instead. The app POSTs to create, PUTs against the
server's id, and carries its own id as an `identifier` — which is why
`?identifier=` joined the search surface.

The CORS note survives the rewrite and is unrelated: `PUT` in `allowMethods` and
`Prefer` in `allowHeaders` are still required, and omitting either aborts the
save on the preflight with a console error that reads as configuration rather
than a missing route.

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
[`packages/core/fhir-resource-rules.mjs`](../../packages/core/fhir-resource-rules.mjs)
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

**No transaction Bundle, no delete, no search beyond `patient` + `category` + `identifier`** —
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
npm install && npm run verify   # copy-fhir + typecheck + eslint + check:host-css + vitest
```

⚠️ **CI runs `npm run verify` itself** rather than re-listing its steps, so a gate
added to `package.json` is enforced automatically — the same arrangement, and the
same reason, as the root's. Do not expand the `mock-ehr` job in
`.github/workflows/web-lint.yml` into individual steps: a hand-copied list has
nothing to compare itself against, and eight of `web/`'s gates once ran only on
developer machines for exactly that reason.

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

the repo root's `npm run verify` does **not** cover this package. CI runs the same
`verify` as its own `mock-ehr` job in `.github/workflows/web-lint.yml`, which
triggers on `services/**` — this service reads the scenario fixtures that
`scripts/shift-scenario-dates.mjs` periodically re-anchors, and that break
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

`fhirclient` is deliberately **not** a dependency here: a second copy could
drift from the version the app ships, and the test would then exercise a client
the panel never uses. It used to be *aliased* to the root `node_modules` in
`vitest.config.ts` and `tsconfig.json`; both entries are gone, because fhirclient
3 is exports-only and a prefix alias rewrites the specifier before the export map
is consulted. The ordinary walk-up from `src/` reaches the same root install.

⚠️ **The two client shapes in that test are declared locally now.** They were
`fhirclient.Adapter` and `fhirclient.ClientState`; fhirclient 3.0.0's tarball
omits `types/types.d.ts` while every shipped declaration imports it, so that
namespace does not resolve. Writing the shapes out lost nothing — both were
already reaching the constructor through `as unknown as`, which asserted the fit
rather than checking it.

`wrangler` and `@cloudflare/workers-types` move together across all four
services (`^4.135.0` / `^5`) — see
[`docs/internals/workers.md`](../../docs/internals/workers.md) §
"One toolchain, four hand-mirrored copies".
