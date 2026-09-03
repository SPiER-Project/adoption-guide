# The embedded panel: SPiER as a SMART app launched from a host chart

Written 2026-08-18, from the proposal *"deliver the care path and its tools as a
SMART on FHIR application that launches from the patient chart, into the right
third of the screen."*

Two things follow from that framing, and only one of them is about layout.

The layout half is a panel shell and a navigation stack. **The half that matters
is that it splits the app by audience** — a clinician-facing SMART app (pathway
+ tools) and an implementer-facing guide (population, measures, rubric, data
dictionary, roadmap) — a boundary the current single sidebar leaves implicit, so
a clinical reviewer has to be *told* which half is for them.

## Status

| Decision | State |
|---|---|
| **1 — panel is a chrome mode of the existing app, not a second app** | **PROVEN 2026-08-19.** One route table, one shell switch; the panel ran embedded in a host chart with no second app and no forked routes. §3 |
| **2 — the host is a mock EHR we write, serving real FHIR** | **DECIDED 2026-08-18.** Reverses [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §6; the Medplum variant is rejected. Reason, guardrails and costs in §8. |
| **3 — cross-origin: host and panel on separate `workers.dev` hostnames** | **PROVEN 2026-08-19** in a browser, both directions: the panel renders framed from the permitted origin, and a non-permitted origin is refused by `frame-ancestors`. §6 |
| **4 — claim the demo makes is "SMART activity", not "persistent sidebar"** | **DECIDED.** §2 |
| **5 — panel submit drives the writeback ladder** | **PROVEN 2026-08-20.** A real submit against the mock wrote QR + 4 Observations; flipping the profile degraded the same submit to QR + the DocumentReference floor. §5.1 |
| **6 — the mock ships NO consent screen; `/authorize` auto-approves** | **DECIDED 2026-08-19.** Reason, the variant that would be theatre, and what would reopen it: §10.1 |

| Phase | State |
|---|---|
| 0 — width spike: one long instrument at panel width | **DONE 2026-08-18 — passes at 470px.** §9.1 |
| 1 — mock EHR read API over the existing fixtures | **DONE** — `services/mock-ehr/`. Spec + what building it found: [`mock-ehr-read-api.md`](archive/mock-ehr-read-api.md). §7 |
| 2 — SMART authorize/token stub, cross-origin iframe launch | **DONE.** `/authorize` + `/token` with PKCE S256 verified, launch contexts, patient-bound tokens, `frame-ancestors` on the panel host. The iframe half was unproven until step 5 framed it; **both halves are now observed in a browser — §6.1.** §4 |
| 3 — `PanelShell`, navigation stack, code drawer | **DONE 2026-08-18.** `PanelShell` in #358 (`3832e18`): 252px of chrome above the first question → **76px**, chrome-mode context, `INSET_OWNERS` declared to `check:template`. Code drawer in #360 (`1901c0e`): the stranded sidebar (§9.1 finding 3) becomes a bottom drawer, one tap from any scroll position. §3 |
| 4 — writes + the capability-degradation demo | **DONE 2026-08-20.** `POST /fhir/{Type}` + `PUT /fhir/{Type}/{id}`, validated against the SAME rules as `check-scenario-resources.mjs`, capability-gated, persisted in a Durable Object with a visible reset. What a browser found: §5.1 |
| 5 — mock EHR chrome, launch button, CDS card with `type: "smart"` | **DONE 2026-08-19.** `/chart` + `/chart/{id}` in `services/mock-ehr/src/chartPage.ts`, `type: "smart"` links from the hosted CDS service, `intent` → tool routing. What a browser found: §6.1 |
| 6 — FHIRcast across the origin boundary | **DONE 2026-08-20.** A real hub in a Durable Object; host and panel subscribe to one topic across two origins. §6.2 |

---

## 1. This reverses a decision made five days ago

[`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §6 evaluated
"write our own mock FHIR + SMART auth endpoints on the existing Worker" and
recorded it **NOT RECOMMENDED**. Its argument is not about effort, and it is
good:

> a mock we write will be lenient, and leniency here attacks SPiER's strongest
> claim.

A lenient server accepts writes a real EHR rejects — a wrong `patientRefField`,
a missing required slice, a `Coding.display` that does not match its CodeSystem.
The demo looks *better* while proving *less*, and the failure is invisible from
inside the demo. That is the same shape as every silent pass this repo has
catalogued. `smartDataSource.ts`'s own comment on `patientRefField` already says
a lenient server "silently drops" the patient link.

**That argument still stands, and this plan does not refute it. It narrows what
the mock is allowed to be evidence of.**

The reversal rests on a distinction the earlier document did not need to draw,
because it was answering a different question. It asked *"what would prove
SPiER's data is portable?"* — for which a mock we control is worthless. This
plan asks *"what would show a clinician the workflow in situ?"* — for which the
host is stage furniture, and its FHIR-serving is a means of exercising SPiER's
real code path rather than a claim about anyone else's server.

So the two documents divide as follows, and neither supersedes the other:

| Claim | Proved by | Not proved by |
|---|---|---|
| SPiER's data is conformant and portable | validated per-patient Bundles + a strict third-party server (`mock-patient-smart-launch.md` §4–5) | anything we host |
| SPiER works as an embedded SMART app | a host we control, cross-origin, over real SMART + real FHIR reads/writes | a screenshot, or a same-origin fake |
| SPiER degrades correctly against a limited server | a host whose **CapabilityStatement we can turn down on purpose** (§5) | a permissive server of any provenance |

⚠️ **Three guardrails are conditions of the reversal, not nice-to-haves.** Drop
any one and §6's objection reasserts itself in full:

1. **The mock validates writes before accepting them**, reusing the profile
   checks in `web/scripts/check-scenario-resources.mjs` rather than inventing a
   second, laxer opinion. §6's own stated mitigation.
2. **Prove it can reject.** Plant an invalid write — wrong `Coding.display`, a
   missing required slice — and watch it 422 before the mock is trusted. A mock
   nobody has seen reject anything is not evidence of anything.
3. **The demo never claims interoperability from this host.** Conformance
   evidence stays where the earlier plan put it: validated Bundles, loaded into
   somebody else's server. §8 describes a variant that gets both at once.

## 2. The UX

### The claim being made

**A SMART activity, not a persistent sidebar.** Epic and Cerner both support
embedded SMART activities; "a panel that follows the clinician everywhere in the
chart" is a stronger, more vendor-specific claim, and the difference matters to
whoever has to implement it. Confirm the specifics against the target vendor's
current documentation before the demo asserts anything about either.

### The launch

Two entry points, and the second is the interesting one:

- an EHR-native activity button (vendor-configured; boring; real), and
- **a CDS Hooks card whose link is `type: "smart"`.** `CdsLink.type` in
  [`web/src/lib/cdsHooks/types.ts`](../../web/src/lib/cdsHooks/types.ts) already
  declares `'smart'` with the comment *"unused by SPiER today"*. This is what it
  was left open for: `patient-view` fires → a card says "positive PSS-3, C-SSRS
  Full indicated" → the link opens the panel already scoped to that tool. It
  answers *how did the button know which instrument to name* with a standard
  rather than a hard-coded button.

### Inside the panel

```
Pathway overview  ──launch──▶  Tool  ──submit──▶  Result  ──▶  back to overview
      ▲                                                            │
      └────────────────────────────────────────────────────────────┘
```

Three levels, no deeper. A **directed** launch (`intent` names a tool) opens at
*Tool*, and back from there goes to *overview* — not out of the app. A clinician
sent to do one thing therefore lands in the pathway afterward and sees what is
next.

⚠️ **Do not teleport away from the result.** `QuestionnaireView` already renders
a risk-tier summary with a suggested next action on submit, and that summary is
the payoff — it is where *capture → translate → act* lands. Keep it as a
confirmation beat, then return to the overview **with the pathway visibly
advanced**. The advance is the money shot; the eye must be on the overview when
it happens.

### Panel chrome

Patient identity strip · back affordance · connected-server indicator · code
drawer toggle.

The server indicator is not decoration. Once the panel is genuinely talking to a
different origin, naming the server is the difference between a demo and a
mockup — and `AppShell.tsx` already carries a comment marking that slot as "the
natural slot for a SMART-connection indicator later."

The identity strip is **conditional on `need_patient_banner`** (§4). SMART has a
standard answer for "the host already shows a banner, don't draw a second one";
honoring it is two lines and tells an informaticist the spec was read.

### The code drawer

Today the FHIR view is a `.debug-sidebar` `<aside>` inside `.form-wrapper`
([`QuestionnaireView.tsx`](../../web/src/components/QuestionnaireView.tsx)). It
cannot survive beside a form at panel width. It becomes a **bottom drawer with
three tabs**:

| Tab | Shows | Answers |
|---|---|---|
| Definition | the Questionnaire | "is this real FHIR?" |
| Live response | the QR as it fills | "what is the structure?" |
| **Written** | the resources created, the ladder tier chosen, the server's response | "what lands in my database?" |

The third tab is only truthful because of §5 — it reports what *happened*, not
what would have. It is the tab worth the real estate.

## 3. System shape

Three deployables, one repo, **one copy of every fixture**:

| | What | Origin |
|---|---|---|
| SPiER panel app | today's `web/` — the SMART app | `spier-adoption-guide.…workers.dev` |
| **Mock EHR** | new `services/mock-ehr/` — FHIR API + SMART stub + host chrome | `spier-mock-ehr.…workers.dev` |
| CDS Hooks service | existing `services/cds-hooks/` | unchanged |

**Two Workers give two origins for free.** No DNS work, no
`thespierproject.org` subdomain — which matters, because there is no DNS access
to that domain.

The mock EHR serves the *same* `packages/demo-population/src/scenarios/patient-0NN.json`
fixtures the app ships. No second copy of any patient. `collectScenarioResources`
in [`scripts/validate-fhir.mjs`](../../scripts/validate-fhir.mjs) already does
the bucket-unwrapping walk the read path needs.

### One shell, two chrome modes

**Do not fork the route table** — thirty-odd routes is too many to duplicate.
Keep the single `<Route element={<Shell/>}>` in `App.tsx` and let `Shell` choose
chrome from a presentation context established at `/redirect` (with an
`?embed=1` override for testing). `AppShell` for the implementer lenses,
`PanelShell` when embedded.

⚠️ **This is scoped to the demo build.** "One app, two chrome modes" answers
what the *demo* is; it does not answer what a client receives, and a client does
not want the guide lenses or the 14 synthetic patients that
`PatientProvider` bundles eagerly on every build. A third axis — **build
surface** (`demo` / `clinical`) — is orthogonal to chrome mode and belongs in
the same seam. See [`surfaces-and-distribution.md`](surfaces-and-distribution.md)
§3, which also corrects the scope of `repo-and-package-boundaries.md` §5 that
this section inherited.

⚠️ **`check:template` gains a second page-inset owner.** `.app-shell__body` is
currently its *sole* owner by gate, and `PageHeader` the only page-title
implementation. `PanelShell`'s body is a legitimate second owner — it must be
**declared** to `web/scripts/check-page-template.mjs` with a reason, in the same
allowlist-with-reasons style as `LENSES`. Working around the gate instead is how
the panel becomes the place template drift lives.

✅ **Done in #358** — `INSET_OWNERS` in that script, and RULE 4a now asserts
*every* declared owner pads unconditionally, so a chrome whose inset silently
disappears fails rather than passing vacuously. The compact panel header also had
to live in `PageHeader.css` (RULE 1 rejects `.page-header` selectors anywhere
else), which is the right home: the panel is a variant of the one header.

## 4. What the mock EHR has to implement

The read side is mechanical. The SMART stub is where the credibility is.

| Endpoint | Notes |
|---|---|
| `GET /fhir/.well-known/smart-configuration` | discovery |
| `GET /fhir/metadata` | **load-bearing — see below** |
| `GET /fhir/Patient/{id}`, `GET /fhir/{Type}?patient=` | `SmartDataSource.getSlice` issues 14 patient-scoped searches across 13 resource types; that list *is* the required surface, and it is not small |
| `POST /fhir/{Type}` | strict — §1 guardrail 1 |
| `PUT /fhir/{Type}/{id}` | ⚠️ **missing from this table until step 4 built it.** `saveArtifact` PUTs the eight lifecycle types (update-as-create) so open→close converges; without it the panel's save aborts on the CORS preflight. §5.1 |
| `GET /authorize`, `POST /token` | PKCE S256, launch context |

**`/metadata` is the one to get right.** `parseCapabilityStatement`
([`web/src/lib/writeback/capability.ts`](../../web/src/lib/writeback/capability.ts))
reads it to decide what SPiER may create. Make the CapabilityStatement
**runtime-configurable from the mock EHR's own UI** and the writeback ladder
stops being a slide — see §5.

**Do PKCE properly.** `fhirclient` sends S256 by default; verifying it is a few
lines of WebCrypto. A stub that ignores PKCE is exactly the shortcut that makes
the demo prove nothing.

**Use the launch-context parameters SMART already defines.** Two of them answer
open UX questions directly:

- **`intent`** — the standard carrier for *"open C-SSRS Full."* Preferred over a
  bespoke query param, because it is what a real EHR would send. (The app
  already reads a `?tool=` param for `stampLaunchStage`; `intent` is the outer,
  spec-blessed form of the same information.) **Live since step 5.** The
  vocabulary is `open-<launch-path-slug>` and is **derived from the tool catalog
  in both directions** ([`web/src/lib/smartIntent.ts`](../../web/src/lib/smartIntent.ts)),
  so a new tool is reachable by intent the day it has a launch action and nothing
  has to be kept in sync. An intent this build does not know resolves to null and
  lands on the pathway — the host is a different system on a different release
  cycle, and "open something I have never heard of" must not be a dead end.
- **`need_patient_banner: false`** — the host telling the panel not to draw its
  own banner. §2. **Honored since step 5**: `SmartRedirect` reads it off the token
  response and `PanelShell` drops its identity strip. Only an explicit `false`
  does so — absent means "app decides", and the app's answer is to name the
  patient, because a panel that stops identifying whose chart it shows is a safety
  problem rather than a layout one.

**Persistence and reset.** ✅ **Done in step 4** — a Durable Object (`DemoStore`),
one instance named `demo`, plus a **Reset written data** control on both the
control page and the chart. Not keyed per session: the mock has no session
identity to key on (the access token is patient-bound and carries nothing else),
so two concurrent demos share writes and reset is the mitigation.

⚠️ **The capability profile moved into the same store, and that was a correctness
fix rather than tidying.** It was module-local and therefore per-isolate: the
operator flips it in whichever isolate serves the control page, and the panel
reads `/metadata` from whichever serves that — so the presenter says "this EHR
refuses Observations" while the panel is told it accepts them. Every local test
passes, because `wrangler dev` runs one isolate.

## 5. The writeback ladder is already built — and already driven, on a branch

Correcting a belief worth not re-deriving: the ladder is **not** dead code, and
its caller is **not** outstanding work.

| Piece | State on `main` |
|---|---|
| `SmartDataSource implements FhirDataSource, WritebackTarget` | **wired** |
| per-resource `create` primitive, patient-scoped | **wired** |
| `fetchCapabilities()` → `parseCapabilityStatement` | **wired** |
| `buildWritePlan` / `executeWritePlan` | built + tested, **driven from `saveResponse` on `main`** |

**The caller is on `main`.** PR #351 (squash-merged as `6f37e0d`,
2026-08-18, closing #350) has `SmartDataSource.saveResponse` driving
`buildWritePlan` + `executeWritePlan`, plus a `WritebackScorecard` on the patient
chart. It also corrects an **inverted tier model** that #348's commit message
recorded and #350 reproduced: Tier 1 is `QuestionnaireResponse` and Tier 2 is
`Observation`, not the reverse. QR-first is load-bearing — `execute.ts` writes the
QR first to capture the server-assigned id, then remaps `Observation.derivedFrom`
and `Condition.evidence` onto it, so the inverted order would point every
provenance reference at an id no server issued.

⚠️ **This paragraph has now been wrong twice, in opposite directions.** It was
filed saying the ladder needed a caller (true of `main` at the time, false of the
project — the work was on an unmerged branch), then corrected to say the caller
was unmerged (true when written at 15:xx, false by 16:22 when #351 merged).
**Read `main` before trusting either sentence** — `git fetch origin main` first,
because a stale local ref is what produced the second error.

**Consequence for this plan: phase 4 is a server, not a build.** Confirmed —
what was missing was something that answers `/metadata` and accepts writes, and
building it changed no app code except extracting one constant. What #351 left
open and step 4 did **not** close: live sandbox validation, the Tier-3
confirmation UI, and whether the demo sets `alwaysWriteDocument` (it does not —
run 1 wrote no DocumentReference, because the discrete tiers fully captured the
data; run 2's floor fired only because Tier 2 was refused, which is the more
persuasive demo anyway).

### The degradation demo

With a runtime-configurable CapabilityStatement, the same submit runs twice:

| Server says | SPiER does |
|---|---|
| `Observation.create` supported | full ladder — QR, derived Observations, CarePlan |
| `Observation.create` refused | degrades to the Tier-0 `DocumentReference` floor — **and says so, in the *Written* tab** |

That is the most persuasive thing in the whole proposal for an integration lead,
because it answers the question they actually ask — *what can you write into my
system, and what do you do when I won't let you?* — by demonstration rather than
assertion. It costs almost nothing once the stub exists, and it is a capability
*negotiation* claim, which a mock can legitimately make (§1).

### 5.1 Step 4 result — the ladder against a real server, measured 2026-08-20

Method: the same two local origins as §6.1, with the mock's writes persisted in a
Durable Object. A **real PSS-3 filled in the panel and submitted**, twice: once
with the server advertising `full`, once with `no-observation`. Nothing stubbed,
nothing simulated — the app's own `saveResponse` → `buildWritePlan` →
`executeWritePlan` path, over HTTP, cross-origin.

**Run 1 — profile `full`.** Six resources landed:

| | |
|---|---|
| `Encounter/encounter-22e6376c…` | **PUT**, client id preserved |
| `QuestionnaireResponse/srv-2` | POST — Tier 1 |
| `Observation/srv-3` … `srv-6` | POST — Tier 2, four of them |

⚠️ **The ids are the finding.** All four Observations came back with
`derivedFrom: ["QuestionnaireResponse/srv-2"]` — the **server's** id, not the
client's. That is `execute.ts`'s remap working, checked by reading the resources
back off the mock rather than by trusting the scorecard.

⚠️ **And the first explanation of why that matters was wrong.** This section said
the remap "is untestable against a server that echoes the client's id back". It
was planted and it changed nothing: `toCreatePayload` **deletes** the client's id
before POSTing, so no server on this path is ever sent an id to echo, and every
create necessarily gets a fresh one. The real value of a live server is the
opposite direction — a **failed** remap becomes observable, because the written
Observations then carry `QuestionnaireResponse/p011-asq`, a dangling reference.
That is now a CI-gated integration test (see below), and disabling the remap
fails it.

**Run 2 — profile `no-observation`, same instrument, same answers.** Two
resources, and the panel's own report says why:

```
capabilities: Observation.create=false, QuestionnaireResponse.create=true, DocumentReference.create=true
capabilitiesKnown: true
Tier 1 QuestionnaireResponse → written  srv-7
Tier 2 Observation           → skipped  "Server does not support create for this type"
Tier 0 DocumentReference     → written  srv-8   (the floor)
```

The server's independent account (`GET /_admin/writes`) agrees: `srv-7` and
`srv-8`, no Observation. **Two statements about the same event** — the ladder
reporting on itself and the server reporting on what it stored — which is the
difference between a demo and an assertion.

#### What a browser found that the spec did not

⚠️ **§4's endpoint table is incomplete, and following it exactly produces a demo
that cannot save.** It lists `POST /fhir/{Type}`. But
`SmartDataSource.saveArtifact` **PUTs** the eight LIFECYCLE types
(`LIFECYCLE_RESOURCE_TYPES` — Encounter, EpisodeOfCare, Flag, Task,
ServiceRequest, Appointment, Consent, DocumentReference) so that an episode
opened and later closed converges on one resource instead of leaving the open
version behind. Three separate defects followed, each hidden by the one before:

1. **CORS blocked the preflight.** `allowHeaders` did not list `Prefer`, which
   `SmartDataSource.create` sends as `return=representation`; and `allowMethods`
   did not list `PUT`. The first real submit died with
   `Method PUT is not allowed by Access-Control-Allow-Methods`, i.e. a message
   about configuration rather than about a missing route — and every `curl`
   succeeded throughout.
2. **The capability profiles were modelled on the ladder alone.** `CREATABLE`
   holds the four ladder types; gating PUT against it refused every lifecycle
   write **even under `full`**. Fixed by making `update` a second axis
   (`updatableTypes`) — permitted by every profile except `read-only`, which has
   to refuse everything or the label is a lie. The CapabilityStatement now
   advertises `update` for those types, because a statement that omits an
   interaction the server performs is one a client cannot trust.
3. **The merged read view double-counted upserts.** Fixtures + writes were
   concatenated, so a PUT replacing a fixture by id returned *both* versions and
   a chart would show one episode as active and finished at once. Now keyed by
   `Type/id` with the written version winning.

#### Guardrail 1, and why the mock is not lenient

§1 makes the reversal conditional on the mock *"reusing the profile checks in
`check-scenario-resources.mjs` rather than inventing a second, laxer opinion"*.

The README used to say that would have to be a **port**, "not a reuse of it (that
script is Node reading StructureDefinitions off a filesystem)". That was true of
the script and false of the rules: the rules need the conformance resources only
as **data**, and `import.meta.glob` inlines them into a Worker exactly as it
already inlines the Patients. So the rules moved to
[`web/scripts/lib/fhir-resource-rules.mjs`](../../web/scripts/lib/fhir-resource-rules.mjs)
and both callers share them **verbatim** — the bodies were moved unchanged into a
closure that supplies `fail` and `structureDefs`, so the diff on the rules
themselves is empty and this refactor cannot have quietly loosened one. Proven by
planting one defect per rule class (bad status, missing required element,
unresolvable profile, bad date, wrong patient link, min-cardinality,
required-binding) and watching the scenario gate still fail all seven.

Guardrail 2 — "prove it can reject" — is `write.test.ts`: six invalid payloads,
each produced by breaking **one** thing in a resource the repo's own gate already
accepts, so none of them proves the validator rejects something nobody would
send. Plus the case that matters most: pointing the conformance glob at a
nonexistent prefix makes the module **fail to load** rather than accept
everything, which is the #232 / #261 silent-pass shape in the one place this
service is supposed to be strict.

⚠️ **A stated hole: an UNPROFILED resource is checked far less.** No
`meta.profile` means base-R4 checks only — no min-cardinality, no fixed values,
no bindings. The ladder's own artifacts do carry profiles, but "the mock accepted
it" is a weaker statement than it looks, and it is never conformance evidence
(guardrail 3). Pinned by a test so the hole is written down rather than
discovered.

#### Gated, not just observed

⚠️ **A browser run is evidence, not a gate.** Everything above was watched once,
by hand. `services/mock-ehr/src/smartDataSource.integration.test.ts` now drives
the **real** `SmartDataSource.saveResponse` against this server over a real
socket for all three profiles, so the degradation, the provenance remap and the
floor each fail a test when someone breaks them.

That also closed the case the browser run skipped: **`read-only`**. The answer is
not "it degrades" — every tier including the floor is refused and `saveResponse`
**throws**, which is correct (nothing landed *is* a failed save) and is now
pinned rather than assumed.

⚠️ One trap in writing those tests, worth repeating because it is the #327 shape:
the first draft built the derived Observations with `mapResponseToObservations`
instead of `deriveFromResponse`. The raw mapper emits **no** `derivedFrom` — the
business logic stamps it — so the provenance assertion would have been testing
nothing against artifacts the app never produces.

#### ✅ Verified on the deployed host — 2026-08-20

The one property `wrangler dev` structurally cannot show is **Durable Object
persistence across isolates**, because it runs a single isolate. Checked against
the deployed Worker after `npm run deploy`, through a real PKCE launch:

| | |
|---|---|
| `POST /fhir/Observation` under `full` | **201**, `Location: …/fhir/Observation/srv-1`, id minted by the server (the client sent none) |
| read back by id, fresh connection | 200 |
| `Observation?patient=patient-011` — the search the chart issues | contains it in **10/10** requests on fresh connections |
| `/_admin/writes` — the server's own account | `count: 1, {Observation: 1}` |
| durable profile: `/fhir/metadata` after flipping to `no-observation` | **15/15** fresh connections agree |

And the three refusals, on the deployed host rather than in a test:

| | |
|---|---|
| `POST /fhir/Observation` under `no-observation` | **405**, naming the profile |
| `DocumentReference` with `status: "not-a-real-status"` and no `content` | **422**, listing **both** problems |
| a resource whose `subject` is another patient | **403** |

That second table is guardrail 2 discharged where it counts — "a mock nobody has
seen reject anything is not evidence of anything", now watched rejecting three
different things on the public origin.

⚠️ **One trap in doing this, worth knowing before anyone repeats it.** The first
`PUT /_admin/capabilities` after the deploy returned `durable: false` and
`/metadata` kept reporting `full` — which reads exactly like the DO binding being
absent. It was **deploy propagation**: that request was still served by the
previous version, whose `durable` was a hardcoded `false`. Re-running a minute
later was correct in every respect. Do not debug a Worker for the first few
seconds after `wrangler deploy`.

#### Not verified

⚠️ **This list used to open with "Durable Object persistence across isolates",
and that bullet survived the section above being written — which contradicted
it thirty lines earlier.** Introduced by the very commit that verified the
property (#377): the ✅ block was inserted and the superseded bullet was not
deleted. Recorded rather than quietly removed, because it is the exact failure
this repo keeps cataloguing, committed by the change that was documenting a
success.

- **Concurrent demos.** One store instance named `demo`, so two people
  demonstrating at once share written resources. Reset is the mitigation.

## 6. What cross-origin costs

- ✅ **`frame-ancestors` — settled, and tested in both directions (§6.1).** It
  was the first thing predicted to break and it did not; what mattered was
  confirming the header is load-bearing rather than decorative, which needed a
  deliberately wrong value and a blocked frame.
- ✅ **FHIRcast left `BroadcastChannel` — and took the better option, not the
  floor.** This bullet proposed `postMessage` with strict origin checks as the
  floor and a real hub as the better version. The Durable Object that step 4 added
  for writes made the better version the *cheaper* one: it already speaks
  WebSocket. So `postMessage` was never written. The hub is
  `services/mock-ehr/src/fhircastHub.ts`; the app subscribes to it with the
  `hub.url` / `hub.topic` the EHR puts in the token response. §6.2.
- **`check:template`** — §3.
- ⚠️ **A new deployable outside the gate net will rot.** `services/cds-hooks/`
  has its own CI-gated `verify` precisely because `web/`'s does not cover it.
  `services/mock-ehr/` needs the same on day one — more urgently, because it
  reads the scenario fixtures and will break silently when those are re-anchored
  by `web/scripts/shift-scenario-dates.mjs`.

### 6.1 Step 5 result — the framed panel, measured 2026-08-19

Method: both Workers run locally on separate origins — the mock EHR on
`http://localhost:8787`, the panel Worker (SPA + CDS API, exactly as deployed) on
`http://localhost:8788` — in a 1440×900 viewport. `.dev.vars` in each service
points them at each other; the deployed values are unchanged. Not a same-origin
iframe and not a proxy: two origins, a real OAuth round trip, a real CSP.

**The claim holds.** `http://localhost:8787/chart/patient-011` frames the panel;
the full SMART sequence completes *inside the frame* (`/launch` → `authorize()` →
the mock's `/authorize` → back with a code → `ready()` exchanges it at `/token`
with PKCE); the pathway renders from **15 live patient-scoped reads against the
mock**, all 200, cross-origin from within the frame. Zero console errors.

| Observed | |
|---|---|
| Panel chrome inside the frame | yes — no app header, no lens sidebar |
| Identity strip | **absent**, because the launch sent `need_patient_banner: false` and the host draws its own |
| Activity button → panel | opens on the pathway overview |
| CDS card `type: "smart"` → panel | opens **directly on Stanley-Brown**, from `appContext` `{"intent":"open-stanley-and-brown"}` |
| Code drawer (#360) | reachable, pinned at the foot of the panel |
| Widths | 380 / 470 / 700 all render; the form wraps rather than truncating at 380 |

⚠️ **`frame-ancestors` was then proven to bite.** With the panel's CSP pointed at
a *different* port, the same page logged
`Framing 'http://localhost:8788/' violates the following Content Security Policy
directive: "frame-ancestors 'self' http://localhost:9999". The request has been
blocked.` A header that has only ever been observed permitting things is not
evidence of anything — this is the negative half.

Three findings, and the first two are defects a browser was the only way to see:

1. ⚠️ **`fhirclient` asks to be told how to complete an authorization inside a
   frame, and guessing right is not the same as working.** Launched embedded, it
   warned *"please be explicit and provide a `completeInTarget` option"* and then
   inferred `true` from being framed. The inference happened to be correct; the
   *wrong* value fails in the least debuggable way available — `false` makes it
   `postMessage` the callback URL to `parent` with the **panel's** origin as
   `targetOrigin`, which a cross-origin host frame can never receive, so the
   launch hangs with no error and no failed request. `SmartLaunch` now sets
   `completeInTarget: true` explicitly, which is a no-op for the top-level launch.
2. ⚠️ **Two tools sharing a launch path put two identical links on a card, and
   had since the cards were built.** TL-042 (KPI Reporting) and TL-043
   (Dashboard) both launch `/population/measures` with the same label (it was
   `/guide/measures` until step D moved it, #391), and the stage
   card's link list ran over *tools*, so every patient at `measure-and-share` got
   two byte-identical "Open measure dashboard" entries — in the app too. Nothing
   caught it because `spier-router-paths` is keyed by URL and silently collapsed
   the pair: only the *visible* list was doubled. It surfaced here because a host
   renders each link as a button that mints an OAuth launch, which makes the
   duplicate loud. `buildCdsCards` now emits one link per destination.
3. ⚠️ **The embed flag cannot survive the redirect in the URL.** `?embed=1`
   arrives on the framed launch URL, and the OAuth leg replaces the whole query
   string with `?code&state` — a redirect URI carries no fragment and the app
   registers its bare base. Without persistence the panel comes back up in full
   EHR chrome *inside the host's iframe*, with a second header and a second
   patient banner. `PresentationProvider` now records it in `sessionStorage` for
   the tab. Note the cost: under full third-party storage blocking (Safari's
   default) that access throws — and so does `fhirclient`'s own OAuth state, so
   in that browser the launch does not complete at all. **Untested there**, and
   the first thing to check before demonstrating on someone else's laptop.

### 6.2 Step 6 result — context crosses the boundary, measured 2026-08-20

Method as §6.1: two Workers on two origins locally, real SMART launch, real CSP.

**A real hub, not a simulation.** `POST /fhircast` is a spec-shaped subscription
request (`hub.channel.type=websocket`, `hub.mode`, `hub.topic`, `hub.events`)
answered with a `hub.channel.endpoint`; the app connects a WebSocket to it and
ACKs what it receives. The topic is minted with the launch and travels to the
panel in the token response, which is how both sides end up in **one** session.

| Observed | |
|---|---|
| Host chart subscribes | hub confirms the subscription on its topic |
| Panel launched into the iframe | sockets go **1 → 2, same topic, two origins** |
| Host announces `patient-open` for another patient | `delivered: 2`, **`acked: 2`** — the panel received it and acknowledged |
| Panel's reaction | the out-of-scope notice, *"The chart moved to Nia Barrett … relaunch from their chart"* |

⚠️ **The policy inverted, and the old comment was right for its time.**
`FhircastListener` used to ignore every event under a live SMART session — "the
connected EHR owns patient context, not this simulation". True of a
`BroadcastChannel`, which reaches other tabs of *this app*. False of the EHR's own
hub. The rule was never "ignore under SMART"; it was "do not let a simulation
override the system of record", and the two transports fall on opposite sides of
it. Both halves are now gated (`FhircastListener.test.tsx`).

⚠️ **"Follow" cannot mean "read that patient", and this is what makes an embedded
panel different.** The panel's token is bound to one patient, so a `patient-open`
for another cannot be followed — navigating would render a chart of 403s. The
panel says the session no longer matches and stops claiming its data is current.
That is a constraint of the security model, not a limitation of FHIRcast, and it
is the most useful thing this step surfaced.

#### Two defects found, one of them a regression of §9.1

1. ⚠️ **The panel's fixed chrome was stranded again — from the host side this
   time.** The dock inherited `align-items: stretch`, so the iframe grew to the
   height of the chart column: **1961px tall in a 1000px window**. The FHIRcast
   notice and the code drawer are `position: fixed`, which pins them to the bottom
   of the *iframe's* viewport — a thousand pixels below the fold. They rendered
   correctly and invisibly. This is §9.1 finding 3 ("the code drawer is not merely
   cramped at panel width — it is stranded") arriving from the other direction:
   step 3 fixed it inside the panel, and **step 4's additions to the host page
   reintroduced the symptom**. The dock is now `position: sticky` at
   `height: 100vh` with `align-self: flex-start` — an embedded activity gets a
   viewport, so the frame has to be one.
2. **The hub's `sent` / `acked` counters reset on hibernation while the sockets
   survive** — which is `acceptWebSocket` working as designed, and makes those two
   numbers mean "since this instance last woke". Seen as `sockets: 2, sent: 0`
   moments after two delivered-and-ACKed notifications. Documented rather than
   moved to storage; `sockets` and `topics` are derived from the live socket set
   and are the trustworthy fields.

#### ✅ The hub, on the deployed host — 2026-08-20

The browser run above used `wrangler dev`, which runs **one** isolate — so it
could show context crossing two origins and could *not* show the hub's actual
fan-out surviving real infrastructure. `fhircast.test.ts` says the same thing
about itself: `WebSocketPair` and `ctx.acceptWebSocket` do not exist outside the
Workers runtime, so a green offline suite is not evidence of relaying anything.

Checked against the deployed Worker after `npm run deploy` (migration `v2`), with
three real WebSockets from a Node client:

| | |
|---|---|
| Subscription | `202`, advertising `wss://spier-mock-ehr…/fhircast/ws?topic=<topic>&events=patient-open` |
| Sockets connected | **3** — two on topic A, one on topic B; `/_admin/fhircast` agreed |
| `POST /fhircast/{topic A}` | `delivered: 2` |
| Both topic-A subscribers | received `patient-011` |
| The topic-B subscriber | received **nothing** — topic isolation holds between real sockets |
| ACKs | `sent: 2, acked: 2` |

⚠️ **The hibernation caveat reproduced, which is the useful part.** After the
three clients disconnected, `/_admin/fhircast` read
`{"sockets":0,"topics":[],"sent":0,"acked":0}` — the counters had gone back to
zero while the delivery they counted had definitely happened. That is the
in-memory-counter behaviour documented in finding 2 above, observed on the
deployed host rather than inferred. `sockets` and `topics` are the fields to
trust.

The demo was left clean afterwards: 0 writes, profile `full`, hub idle.

#### What this hub deliberately is not

No `hub.secret` and no HMAC signatures, so **it authenticates nothing** — the same
class of shortcut as the missing `id_token` in the auth stub, and recorded in
`fhircastProtocol.ts` beside it. No webhook channel, no SSE, no lease expiry, no
authorization on the hub at all: anyone who can reach the Worker can subscribe to
a topic they know. The topic is an unguessable per-session value, which is a
demo's worth of protection and not a security control.

### 6.3 The front door, and the embedded population dashboard

⚠️ **The demo was hard to start, and that was a defect worth more than it looks.**
Reported directly: *"I don't understand what [the mock EHR] is doing… it was very
difficult for me to understand what to do."* The mock's root URL served the
**operator's bench** — a capability switch and a launch form — while the thing
worth looking at, a chart with the panel embedded in it, was two clicks away at
`/chart/{id}`. Every visitor landed on the least illustrative page on the server.

Worth separating the two failures, because only one of them was about layout:

1. **The way in was not first.** Fixed: `/` is the patient list, `/settings` is
   the bench, `/chart` redirects (it is published in this repo's docs, so a 404
   would be a worse answer than a redirect).
2. **The page never said what the server was.** A visitor cannot tell a fake EHR
   from SPiER by looking, and the two are styled differently precisely so they can
   be told apart — which only helps if something says which is which. The first
   sentence now does: *"A stand-in for a vendor chart… **This is not SPiER** —
   SPiER is what appears in the panel on the right of a patient's chart."*

**Keeping the two visual languages apart is deliberate**, and confirmed as such.
The moment the host looks like SPiER, every screenshot becomes ambiguous about
which half is the product, and an audience cannot see what SPiER contributes.

3. **The chart had the same defect one level down.** The launch button — the one
   thing to do on a chart — was the *last* element on the page, under an
   `<h2>Activity</h2>` below the CDS cards, the capability switch and the
   FHIRcast log. It is now directly under the patient banner, which is also where
   a vendor hangs an activity button, and the page's controls moved off it: the
   capability profile and the write reset to `/settings` (where they already
   were), and the panel-width choice to `/settings` as a stored preference, so
   every viewer gets the measured middle width without deciding anything.
   ⚠️ Removing the chart's capability switch **inverts** an earlier decision here
   ("flipping the profile mid-demo should not mean leaving the chart"), and what
   makes that safe is the Durable Object: the live profile was per-isolate module
   memory when the switch was added to the chart, so a flip elsewhere could leave
   the panel reading something else. It is durable now, so `/settings` in a
   second tab changes what an open chart's panel is told.

4. **The pages explained how they were built instead of what to do (2026-09-01).**
   Reviewed as a user after 1–3 above had landed: *"there's a lot of technical
   information about how the thing is built, but it doesn't make it easy to
   understand what the heck I'm supposed to do."* Three causes, one fix each:
   - **The front door led with the thing it disclaimed.** The caseload widget sat
     first (where an EHR hangs an activity), followed by a warning box saying it
     proved nothing, and only then "open a chart". Now: *Start here* (three named
     charts with a reason and a thing to notice — `demoStories.ts`,
     `TRY_IT_ORDER`), the patient list with a one-line story per chart, then the
     widget, then a closed *About this demo* drawer holding every caveat in full.
   - **Nothing said which chart to open.** Fourteen names with demographics, and
     the natural first click (the first row) is a finished episode with nothing
     left to do — so the demo's most compelling move, fill in an assessment and
     watch the host confirm the write, had no motivation anywhere. The picks are
     an empty chart (patient-002), a high-risk chart with the stabilization plan
     still owed (patient-006) and the complete ED episode (patient-011).
   - **The chart's evidence had the launch's weight.** The CDS endpoint URL, the
     hub topic, the write log and the announce control sat inline under the
     launch. They are all still on the page, in a closed *Under the hood* drawer;
     the CDS cards stay out of it because they are the second launch path.
   The caveats are demoted, not softened: §1 requires the pages to SAY what they
   do not prove, which a closed drawer still does. The panel's own copy has the
   same problem one origin over and is a separate change.

#### The embedded activity is the caseload SUMMARY, and is NOT a SMART launch

The front door embeds SPiER the way an EHR hosts an activity on a worklist page.
It is an `<iframe>` at `?embed=1#/population/summary` — **panel chrome, no `iss`,
no `launch`** — and the page says so in a warning box rather than in a comment
nobody reads.

⚠️ **It framed the whole Population lens until 2026-08-23, and that was a layout
defect of the same family as the front door above it.** The lens contains a
sortable caseload table, and the host page has a patient list of its own, so the
page carried **two patient lists** — and the better-looking one was the one that
went nowhere, because a row click inside the frame navigates *within the frame*
rather than opening `/chart/{id}` in the host.

What a host cannot compute for itself is the part above a worklist: the summary
tiles, the risk-tier census and the alert groups. So the frame is now
`PopulationSummaryEmbed` (`/population/summary`) — those two panels, no table, no
page header — it sits **after** the host's own list (see item 4 above for why it
no longer comes first), and the host's own plain table is the
only list. Both consumers share `useCaseloadSummary`, so the widget and the lens
cannot disagree about how many patients are high-risk.

⚠️ **Calling it a SMART view would still be false, and the reason is now ONE
reason rather than two. This section named two until 2026-08-23 and the first had
been closed for weeks:**

- ~~`PopulationView` imports `localDataSource` **directly** rather than reading
  through the `FhirDataSource` seam.~~ **Closed by step C (#390).** The lens and
  the widget both read through `useRegistrySlices`, i.e. through whatever source
  the provider made active. The frame renders bundled demo data because it
  carries **no launch at all**, so the active source is the local one — which is
  a different fact with a different fix, and leaving the old wording in place
  described a refactor that had already happened as a prerequisite.
- **A population is not one patient, and every token this server issues is bound
  to one** (`denyForeignPatient`). A genuine embedded worklist needs a
  *user-scoped* launch — no patient in context, `user/*.read` — which the auth
  stub does not do, plus a cohort read this server does not offer. That is #401,
  and it is the whole remaining blocker.

So this frame demonstrates the **shape** of a hosted activity and nothing about
interoperability. That is the honest claim and it is the one printed on the page.

**The upgrade still has a real payoff.** A user-scoped launch is what would make
this a genuine SMART panel *and* what would let the adoption guide retire its own
`/population` and `/patient/chart` routes — the stated long-term direction, since
those two views are EHR surfaces rather than implementer ones. Until that lands,
the frame stays labelled.

⚠️ **The demo patient data does NOT move with them.** It is tempting to conclude
that if the population and chart views belong to the EHR, so do the fixtures.
They do not: `packages/demo-population/` has consumers in all three packages and at
the repo root — the gate net (`check-scenario-*`, `check-stage-ids`,
`check-population-patients`, `shift-scenario-dates`, `validate-fhir`), the HL7
use-case workbook's walkthrough linkage, the CDS service's fallback path, and the
Stage-8 measure engine and dashboard, **which stay in the adoption guide**. The
canonical Patients are `ig/input/fsh/population-patients.fsh` either way. One
home with three consumers is the shape it already has; moving the files would
invert the dependency (`services/mock-ehr` imports *from* `web` today) for no
gain.

## 7. The prerequisite nobody will see coming

⚠️ ~~**Phase 1 is blocked: there are no `Patient` resources to serve.**~~ **UNBLOCKED 2026-08-18** — the 14 `Patient` resources exist and are gated; see the note at the end of this section. What remains of the prerequisite is phase 2 (per-patient transaction Bundles), which a mock reading the fixtures directly may not even need.

`patients.json` is app-shaped (`id`, `displayName`, `dob`, `mrn`, `gender`,
`recommendedNextStep`). Every `subject: Patient/patient-001` across the scenarios
points at an id with nothing behind it; the only real `Patient` in the tree is
`DEMO_PATIENT` in [`web/src/data/demoPatient.ts`](../../web/src/data/demoPatient.ts).
There are no `Practitioner` or `Organization` resources either, though artifacts
name performers.

⚠️ **Measured 2026-08-18: that does not block a mock EHR.** Performers are
`display` text only, so nothing dangles but `Patient`. The prerequisite below is
14 `Patient` resources, which is smaller than this section implies — see
[`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §2 deficit 1.

A mock EHR cannot serve `GET /fhir/Patient/patient-001` from resources that do
not exist. So **phases 1–2 of [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md)
— mint the subject resources, emit validated per-patient Bundles — are a
dependency of this plan, not an alternative to it.** That earlier plan already
recommends doing them "regardless of everything below," on their own conformance
merits. This is the thing that makes them urgent rather than merely correct.

A lesser dependency, worth naming so it is not discovered late: `PopulationView.tsx`
and `MeasureDashboard.tsx` import `localDataSource` **directly**, bypassing the
`FhirDataSource` abstraction. Those are implementer lenses and therefore outside
the panel, so this plan does not need them — but "the whole demo runs on the
connected server" is not true until they are fixed
([`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §8, phase 4).

## 8. DECIDED — the mock serves FHIR

**Settled 2026-08-18 (Brad).** §1's reversal stands: `services/mock-ehr/` serves
real FHIR and the SMART stub. The Medplum variant below is **rejected**, and
`mock-patient-smart-launch.md` §5 ("stand up a real FHIR server") is no longer
the target for the demo path.

> *"medplum feels like it would be massive overkill. we're really just trying to
> show a patient list/registry, patient page, and patient encounter page."*

### ⚠️ The reason is NOT the one this section originally proposed

This section framed the choice as hinging on **whether the capability-degradation
demo earns its keep** — if it did not, Medplum was "strictly better". That is not
the criterion the decision was made on, and recording only the conclusion would
invite someone to reopen it on a test nobody applied.

The actual reason is **scope of what the host has to be**. The mock EHR needs to
show a patient list, a patient page and an encounter page. That is a small,
well-understood surface, and standing up a full clinical data platform to sit
behind it is disproportionate to it.

The degradation demo survives as a *benefit* of the decision rather than its
justification — we control `/metadata`, so it stays easy.

### One clarification that did not change the answer

Worth recording because it came up and will come up again: **in the Medplum
variant, Medplum would not have been "our demonstration application".** It would
have been an invisible FHIR server and auth provider behind SPiER's own mock
chrome — the audience would still see the panel and our fake chart. The choice
was never "our demo app vs. a full EHR"; it was *who implements FHIR + OAuth
underneath the chrome we write either way*.

The decision holds regardless: an external platform is still an operational
dependency (an instance to run or an account to hold, its own CORS and framing
settings, a third origin) for a host that only has to render three screens.

### What this actually costs, measured rather than estimated

The build is **not** evenly distributed, and the cheap-looking half really is
cheap:

| Piece | Cost | Why |
|---|---|---|
| Read API (13 resource types) | **cheap** | `SmartDataSource.getSlice` issues patient-scoped `GET Type?patient=X`. Serving that from the scenario fixtures is one route, a filter and a Bundle envelope. `services/cds-hooks` already imports those fixtures via `import.meta.glob`. |
| `/metadata` | **trivial**, and load-bearing | It is the degradation demo. |
| authorize / token / PKCE stub | **moderate** | Well-trodden but fiddly, and where `frame-ancestors` and cross-site storage bite (§6). |
| **Strict write validation** | **the expensive part** | And the one that decides whether the mock is credible. |

⚠️ **The guardrail's cost has been understated everywhere it is stated.** §1 says
strict writes "reusing `check-scenario-resources.mjs`". That script is **Node,
reading generated StructureDefinitions off the filesystem**, and a Worker has no
filesystem. Reusing it means bundling those StructureDefinitions through the Vite
build — feasible (`services/cds-hooks` already does exactly this for the catalog
and scenarios), but it is a **port, not reuse**. Budget it on day one. If it
slips, the mock ships lenient, which is precisely the failure
`mock-patient-smart-launch.md` §6 predicted and this guardrail exists to prevent.

### The guardrails are now binding conditions, not advice

§1 permits a mock we control **only** with all three. They are conditions of this
decision:

1. **Strict validation on writes**, reusing the profile checks
   `check-scenario-resources.mjs` performs (see the porting note above).
2. **A planted invalid write seen to 422** before the mock is trusted — the
   repo's standing "prove a gate can fail" rule, applied to a server.
3. **No interoperability claim ever made from a host we control.**

### How the portability claim gets made instead

`mock-patient-smart-launch.md` §6's objection — *a mock we control proves nothing
about portability* — is correct and is **not** answered by the guardrails. It is
answered by doing the claim somewhere else:

**Load the same phase-2 Bundles into a public sandbox** (the SMART Health IT
sandbox, or a prospect's own). That is nearly free once the Bundles exist, it is
a third party's server rejecting or accepting our data, and it keeps Medplum out
of the demo path entirely. Recorded here as intent rather than scheduled work.

So the two claims are made by two different artifacts, which is what §6 was
really asking for:

| Claim | Made by |
|---|---|
| "Here is the workflow in situ" | the mock EHR — a host we control, making no interoperability claim |
| "Our data is portable" | the Bundles, loaded into somebody else's server |

### The rejected variant, kept for the record

Let a strict third-party server hold the data and let the mock EHR be only host
chrome. Medplum has SMART launch built in; load the phase-2 Bundles into it, and
the mock Worker supplies the fake chart, the launch button and the iframe.

| | Mock serves FHIR (**chosen**) | Medplum serves FHIR (rejected) |
|---|---|---|
| Build cost | authorize + token + PKCE + 13-resource read surface + strict writes | Bundle load + host chrome |
| Rejections | ours, and only as strict as we made them | real |
| Capability-degradation demo (§5) | **easy — we control `/metadata`** | hard; needs a second, deliberately-limited server |
| Operational dependency | one more Worker | an external platform to run or hold an account on |
| §6's portability objection | answered separately, by the sandbox above | does not arise |

## 9. Build order

Sequenced to kill unknowns first.

| # | Step | Why here |
|---|---|---|
| **0** | ~~Width spike~~ — **done, §9.1** | C-SSRS Full renders at 470px with zero horizontal overflow. Geometry confirmed; nothing downstream shifts. |
| 1 | Mock EHR read API + `/metadata` + discovery, no auth | Prove `SmartDataSource` reads a scenario patient over HTTP. **Unblocked** — #356 minted the `Patient` resources. Executable spec: [`mock-ehr-read-api.md`](archive/mock-ehr-read-api.md) |
| 2 | SMART stub: authorize, token, PKCE, `patient` / `intent` / `need_patient_banner` | Prove `/launch` → `/redirect` → chart works cross-origin *in an iframe*. Where `frame-ancestors` bites. |
| 3 | ~~`PanelShell`, navigation stack, code drawer~~ **DONE (#358, #360)** | Now it looks like the product. Measured: 252px → 76px of chrome, and the FHIR view from ~3000px below the form to one tap away. |
| 4 | ~~Writes on the mock; degradation demo~~ **DONE — §5.1** | It was a server, as predicted, plus three defects the spec's endpoint table hid (a PUT path, a second capability axis, upsert-aware reads). Guardrail 2 landed here: six planted rejections, and the validator fails to load rather than accept everything when its inputs are missing. |
| 5 | ~~Mock EHR chrome, launch button, CDS card `type: "smart"`~~ **DONE — §6.1** | Slotted **before** step 4, because it carried the one unproven claim in the proposal: nothing had ever loaded the panel in a frame. Two defects found that no suite could see. |
| 6 | FHIRcast across origins | §6. |

⚠️ **Two tracks, because the near-term goal is a conference demo, not a client
ship.** Steps **0, 3, 5** on `LocalDataSource` give the entire *visible* demo —
launch from a chart, fill an instrument in the panel, submit, watch the pathway
advance, open the code drawer — offline, with no OAuth in it. Steps **1, 2, 4**
add the claim that this is the production code path, plus the capability-
degradation demo, and can land later **without changing what the audience sees**.

That property only holds if **the panel never assumes a connected server** — it
reads through `FhirDataSource` as the chart already does, a directed launch works
from a query param when there is no `intent`, and the *Written* tab degrades
honestly to "what would be written" rather than implying a write that did not
happen. Cheap now, expensive later. See
[`surfaces-and-distribution.md`](surfaces-and-distribution.md) §8.

Steps 1–2 are UI-independent and can run in parallel with 0 and 3.

### 9.1 Step 0 result — measured 2026-08-18

Method: C-SSRS Full (the longest instrument in the repo) loaded in a **470px
same-origin iframe inside a 1440×900 viewport** — not a 470px browser window,
because a narrow window also triggers touch/mobile-device emulation that an
embedded panel does not have. The iframe reproduces the real case exactly: the
panel gets its own viewport, so its own media queries apply.

| Measure | 470px | 700px |
|---|---|---|
| Horizontal overflow | **none** | none |
| Elements wider than viewport | **0** | 0 |
| Document height (all sections revealed) | 6088px | 5237px |
| Chrome above the first form card | **252px** | 252px |

**It passes, and the predicted failure mode does not exist.** `@formbox/renderer`
renders `choice` items as comboboxes, not radio matrices — so there is no grid to
break. Option popovers stay inside the panel, and the longest labels in the
instrument (the Duration scale: *"More than 8 hours / persistent or continuous"*)
**wrap to two lines rather than truncating**.

Three findings worth more than the pass:

1. ⚠️ **The hardest layout case is behind `enableWhen`.** Answering Q2 *yes*
   takes the form from 13 controls to 23 and from 3297px to 6088px, revealing the
   Intensity-of-Ideation scales that carry the long labels. **A spike that only
   loads the form tests none of it** — still zero overflow after expansion, but
   that had to be provoked to be true.
2. **The panel's real constraint is vertical, not horizontal.** 252px of chrome
   sits above the first question — header, patient banner, patient switcher,
   breadcrumb, `PageHeader` — identical at both widths. In a 900px-tall panel
   that is **28% of the viewport spent before a single question**. This is the
   thing `PanelShell` (§3) has to fix, and it is a bigger win than any width
   choice.
3. ⚠️ **The code drawer is not merely cramped at panel width — it is stranded.**
   ✅ **Fixed in #360** — `CodeDrawer` renders a bottom-anchored drawer in panel
   chrome (EHR chrome keeps the sidebar unchanged). The finding below is kept
   because it is the argument for the design, not a live defect.
   `.form-wrapper` is `flex-direction: row` and wraps, so `.debug-sidebar` lands
   **below** the form: at 470px its top is **5604px** down. The FHIR view is
   effectively unreachable mid-demo. That is the argument for the bottom drawer in
   §2 — reachability, not overflow.

**Decision: a third (~470px) is viable, so the choice is free.** 700px buys
one-line option labels and ~14% less scrolling (5237 vs 6088). Recommend building
`PanelShell` **width-agnostic** and defaulting to ~"a third, resizable" — nothing
in the renderer forces the wider default, so it can be a presentation preference
rather than an architectural constraint.

*Also observed:* mobile breakpoints fire inside the iframe (the shell's hamburger
appears below 768px). Harmless for `PanelShell`, which will not carry the lens
sidebar, but it should be deliberate rather than inherited.

## 10. Open decisions

- ~~**Panel width.**~~ **Answered by §9.1: 470px works, so the choice is free.**
  Build width-agnostic; default to a third, resizable.
- ~~**Does the mock ship a login/consent screen?**~~ **DECIDED 2026-08-19: no.**
  `/authorize` auto-approves. See §10.1 — the reasoning is not "skipping it is
  faster".
- ~~**§8.** Mock-serves-FHIR versus Medplum-serves-FHIR~~ — **DECIDED 2026-08-18, see §8.** Originally framed as decided on whether the
  capability-degradation demo earns its keep.
- **Where the subject resources live** (§7) — `ig/` as example Instances versus
  beside the scenarios. `mock-patient-smart-launch.md` §7 recommends `ig/`.

### 10.0 How much scope enforcement the mock does — ONE axis

**Decided 2026-08-21 (#404, option A): the mock enforces exactly one scope
question — may this token read a patient other than its own?** A `user/…` read
scope says yes; on a patient-scoped token it is a 403. Nothing else about scopes
is interpreted, and `smart.ts` says so where someone will read it.

**Why so narrow.** Guardrail 3 of §1 is *"no interoperability claim ever made from
a host we control"*, so enforcement here can never license "SPiER works with SMART
scopes" — that claim is not available from this server at any level of effort.
What it *does* buy is **guardrail 1's reasoning applied to reads**: that guardrail
demands strict write validation because a lenient mock accepts writes a real EHR
would reject, so the demo looks better while proving less. A server that never
refuses an under-scoped cross-patient read lets SPiER's own client look correct
when it may be asking for more than it was granted. This is a guardrail against
self-flattery, not a conformance statement.

**Why not the fuller grammar.** A half-correct scope implementation is worse than
none, because it *looks* like it proves something — and this is an auth surface
designed and reviewed by the same sessions, which is already the weakest spot in
this plan.

⚠️ **One thing building it corrected, worth keeping because the wrong version is
the intuitive one.** The obvious hole — "a patient-bound token could enumerate
every chart by omitting `patient=`" — **never existed**. `parseSearch` requires
`patient` and answers a patient-less search with a 400 (*"This server has no
all-patients search"*) before auth is consulted. A scope check there would have
been unreachable code; one was written on that assumption and removed. The axis
that matters is per-patient permission, because SPiER's own registry read is N
per-patient searches.

**So what does this leave for #401?** The permission now exists; the *capability*
does not. A worklist needs either a genuine cohort search on this server or a
launch with no patient in context, and both are #401 — along with the design
question §8 of `mock-patient-smart-launch.md` refuses to hand-wave, about what a
caseload even is on a server where it is not a static list of 14. **This decision
unblocks that work; it does not do it.**

### 10.1 Why there is no consent screen

Decided 2026-08-19, while building step 2. The original framing above — "skipping
it is faster" — is not the reason, and deciding on speed would have been the
wrong call.

**A per-launch consent screen is not what this scenario looks like.** SPiER's
demo is a *clinician* launching an embedded panel from a chart. Provider-facing
apps are approved by the organization at registration time; the clinician does
not re-consent on every launch. Per-launch consent is the norm for
**patient-facing standalone** launches, which this is not. So auto-approve is
the more realistic behaviour here, not a shortcut — which is the opposite of how
§10 originally framed it.

⚠️ **The granular version would be theatre today, and it is worth knowing why
before someone builds it.** Nothing in the writeback path reads granted scopes:
`buildWritePlan` decides each tier from `/metadata` capabilities via
`canCreate`, and the mock enforces no scopes at all. So per-scope checkboxes
would let a demo un-tick `Observation.write`, and the ladder would still plan
Tier 2, the mock would still accept the POST, and the Observation would still be
written. Making it real needs **two** things that do not exist: scope
enforcement on the mock (403 on a write outside the grant), and the ladder
consulting granted scopes alongside capabilities. It would also overlap the
capability-degradation demo, which already shows "the server decides what the
app may do" and is built.

**What would reopen this.** Two things, and only these:

1. **A governance-minded audience.** A consent screen is where the scope request
   becomes legible, and SPiER asks for `patient/Condition.write` on every launch
   — even though Tier 3 is default-OFF and requires human confirmation before
   anything is created. Showing that request, and a human approving it, may be
   worth more to a governance audience than the saved click is worth to anyone.
   ⚠️ Either way, **be ready for the question**: the scope is requested on every
   launch whether or not a screen displays it.
2. **Scope enforcement landing** (most likely with step 4's strict writes). At
   that point the granular variant stops being theatre and becomes a second,
   genuine degradation axis.

If it is reopened, the **informational** variant — scope list, Authorize/Cancel,
no per-scope toggles — is the one to build. It needs no enforcement to be
honest, because it claims nothing about what happens if you say no to part of it.

## 11. Risks

| Risk | Mitigation |
|---|---|
| A lenient mock quietly weakens SPiER's central claim | §1 guardrails — strict writes, prove a rejection, never claim interop from this host |
| ~~Long instruments unusable at panel width~~ | **Retired** — measured, §9.1. Its replacement — 252px of chrome above the first question — is **also retired**: `PanelShell` (#358) cut it to 76px, measured the same way |
| `services/mock-ehr/` drifts out of the gate net | Its own CI-gated `verify` on day one (§6) |
| Two chrome modes double the layout surface | Declare the second inset owner to `check:template` rather than routing around it (§3) |
| Demo breaks on a strict-privacy laptop | `workers.dev` is on the Public Suffix List, so two Workers are cross-**site**, not just cross-origin — the stricter category for storage partitioning. Test Safari and Chrome before any live presentation, and keep the track-1 offline path working as the fallback (`surfaces-and-distribution.md` §8) |
| §7 discovered mid-build | It is called out here; treat phases 1–2 of the earlier plan as gating |

## Related

- [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — **read
  §6 alongside §1 here.** Its phases 1–2 are this plan's prerequisite (§7); its
  §8 is the scope this plan deliberately excludes.
- [`docs/smart-sandbox-testing.md`](../smart-sandbox-testing.md) — the current
  SMART walkthrough and its three known limitations.
- [`surfaces-and-distribution.md`](surfaces-and-distribution.md) — the corrected
  surface inventory, the demo/clinical build split (§3 here is scoped by it), and
  the hosting topology.
- [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) — a mock
  server as a third consumer of shared code.
- [`ux-navigation-improvements.md`](archive/ux-navigation-improvements.md) — the
  navigation work the panel's stack builds on.
- #350 / PR #351 (`6f37e0d`) — the ladder's caller and scorecard, and the
  tier-model correction. **On `main` since 2026-08-18**; phase 4 builds on it.
- #230 — mapper dispatch past PHQ-9; governs how much foreign data derives.
