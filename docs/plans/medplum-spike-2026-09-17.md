# Medplum spike — results

**Status:** spike complete, 2026-09-17. Answers the four questions in
[`medplum-as-host-research.md`](medplum-as-host-research.md) and reports what
running them found. Four defects in SPiER, one of them architectural.

SPiER's IG and its whole demo population now live in a Medplum project, and the
app launches from Medplum into a working chart. **Reads are portable. Writes are
not**, and the reason is a design decision rather than a bug.

⚠️ The research note said `medplum.com` was blocked by this environment's egress
proxy and its findings needed confirming. It is reachable now, and everything
below was verified against the live hosted service at `api.medplum.com` and
against the Medplum source, not against summaries.

## What the spike did

| | |
|---|---|
| Conformance uploaded | 151 — CodeSystems, ValueSets, StructureDefinitions, ConceptMaps |
| Demo population loaded | **148 of 148**, all 14 patients |
| Launch | SMART EHR launch, public client + PKCE, patient context resolved |
| Chart | rendered Maria Alvarez's ED episode from Medplum's copies |
| Writes | **blocked** — see [The write finding](#the-write-finding) |

Two scripts do the loading, both default to a dry run and need `--apply`:
[`scripts/medplum-upload.mjs`](../../scripts/medplum-upload.mjs) and
[`scripts/medplum-load-population.mjs`](../../scripts/medplum-load-population.mjs).
Neither is a gate and neither is in any `verify` — both need credentials and a
network.

## The four questions, answered

**1. Does Medplum hold the resource types SPiER reads and writes?** Yes, all of
them, and it validated 73 of the 148 loaded resources against SPiER's own
profiles on the way in.

**2. Does `/metadata` advertise what the writeback ladder probes?** Yes —
`create` on all 146 resource types. ⚠️ **The ladder was never the blocker, and
this is worth knowing before debugging a write failure against a real server:**
capability probing passes cleanly and the write still fails, for reasons the
CapabilityStatement cannot express.

**3. Will it frame SPiER cross-origin?** Not tested — the spike launched
top-level rather than framed. `ClientApplication.allowedOrigin` is the field that
matters and it is set; `PANEL_FRAME_ANCESTORS` would still need the Medplum
origin for an embedded launch.

**4. Does its CDS Hooks story reach our hosted service?** **No, and it
structurally cannot.** Medplum is a CDS *service host* — services are `Bot`
resources with a `Bot.cdsService` block, served at `/cds-services`. It is not a
CDS *client*: no surface in `packages/app`, `packages/react` or
`examples/medplum-provider` renders CDS cards. So Medplum will never invoke
SPiER's `/cds-services` endpoint, and the chart page's cards have no home there.
⚠️ Medplum's CDS Hooks also needs **Bots**, which are **not enabled on the free
tier** — that path starts at the $2,000/mo plan or at self-hosting.

## The write finding

Every save goes through `saveAgainstEncounter`, which calls `ensureEncounter()`
**first**. That builds an Encounter with a client-minted id
(`encounters.ts`: `` id: params.id ?? `encounter-${makeId()}` ``) and, because
`Encounter` is one of the eight
[`LIFECYCLE_RESOURCE_TYPES`](../../packages/core/src/lib/dataSource/lifecycleTypes.ts),
writes it with `PUT <Type>/<client id>` — FHIR **update-as-create**.

Medplum refuses it, and refuses the obvious repair too:

| Request | Result |
|---|---|
| `PUT Encounter/encounter-<uuid>` — what the app actually sends | **400 Invalid id** |
| `PUT Encounter/<bare, well-formed UUID that does not exist>` | **404 Not found** |

⚠️ **So the id format is not the problem.** `makeId()` is already
`crypto.randomUUID()` — these ids are a real UUID behind a type prefix, one
`replace` away from being legal. Strip the prefix and the 400 becomes a 404,
because Medplum has no update-as-create at all. The *write method* is what does
not port, not the identifier.

And because `ensureEncounter()` runs first, this fails **every** write, not just
the lifecycle ones. The QuestionnaireResponse is never reached. The app does
surface it — `EHR data error.` with the full OperationOutcome — so this is loud,
not silent.

### Why SPiER's own testing could not have caught it

[`services/mock-ehr/README.md`](../../services/mock-ehr/README.md) says it in as
many words:

> ⚠️ **`PUT` exists because a browser found it, not because the spec asked.** The
> plan's §4 lists `POST` only, but `SmartDataSource.saveArtifact` PUTs the eight
> LIFECYCLE types so open→close converges. Following the spec exactly produced a
> panel whose save aborted.

**The mock was changed to accommodate the app.** That is the structural hazard of
validating against a server you wrote: when the app and the server disagree, the
server moves. Every write has passed ever since, against a server reshaped until
it agreed. No gate can see this, because both sides of the contract are ours.

## Three defects found before that one

**1. `_savedAt` on resources presented as FHIR.** SPiER's client-side capture
stamp had leaked into 7 CarePlans and 3 Communications in the demo scenarios.
Medplum refused all 10. Fixed by giving the CarePlans `created` — their real FHIR
record-time field — which two of them already carried, set to exactly their
`_savedAt`. ⚠️ Not a tidy-up: five of the seven had no other date, so deleting
`_savedAt` alone would have undated them in the chart, the documents list and the
activity feed.

**2. A `client_id` that only ever worked against our own mock.** It was the
literal `'spier-client'`, which is in the mock's `DEFAULT_CLIENT_IDS`. A SMART
app is registered per EHR and each registration mints its own id, so Medplum
refused it at `/authorize`. Now `clientIdForIssuer(iss)`, keyed on issuer origin.

**3. A scope request covering 4 of 13 resource types.** `getSlice` searches 13
and `saveArtifact` writes the same set; the request named four. ⚠️ **Two servers
said yes and neither proved anything** — the mock does not enforce read scopes
and says so, and Medplum granted the blanket `user/*.read` the app asks for on
every launch, covering the gap by accident. The chart came up with 7 of 8 stages
populated off a token never asked for most of what it used. Found by reading the
granted scope against the code, not by any server complaining. Now gated by
`web/src/components/smartScopes.test.ts`, which derives both sides from the
source.

## What Medplum actually does, as observed

Useful beyond this spike, because these are the behaviours a second real server
may differ on:

- **Grants exactly the scopes requested**, without narrowing them to the resolved
  context. A chart launch keeps `user/*.read` if it asked for it — the mock
  deliberately drops it, so SPiER's model of an EHR is stricter than this real
  one.
- **Enforces write scopes; did not enforce read scopes** in what we saw. That
  asymmetry is why defect 3 stayed invisible while the writes broke at once.
- **Resource ids must be UUIDs**, on read as well as write, with no escape hatch.
- **Validates `meta.profile` against uploaded StructureDefinitions** — and
  `validateProfiles()` logs `'Unknown profile referenced'` and **continues** when
  a profile will not load, so an unresolvable profile degrades to a PASS. ⚠️ A
  green write is never evidence on its own; you must have watched a rejection.
- ⚠️ **It cannot read SUSHI's extension slices.** FHIR slices extensions on `url`
  while SUSHI expresses the slice as `type[0].profile` and emits no element
  constraining that url; Medplum's `matchDiscriminant` matches only against
  `pattern` or `fixed`. Every sliced extension therefore reads as absent —
  it rejected all 8 EpisodeOfCare fixtures for an extension all 8 carried.
  `medplum-upload.mjs` restates the url at upload time; verified in both
  directions, so a conformant resource is accepted and a non-conformant one is
  still refused.
- **Two Project feature flags are not settable on hosted**: `validate-terminology`
  (required-binding enforcement — off, so a code outside a required binding is
  accepted) and `transaction-bundles` (our loads ran with batch semantics, so a
  failure is partial rather than atomic). **Self-hosting is the way to get both.**

## What to do about writes

Conditional update was tested against Medplum and works — `PUT ?identifier=…`
returned 201 then 200 on the same server id, converging to one resource.

### Option A — POST to create, PUT by the server's id

Uses only `create` and `update-by-id`, the two write interactions every FHIR
server that accepts writes at all supports. The app learns the server id from the
create response, and already does exactly this shape elsewhere: `executeWritePlan`
remaps `QuestionnaireResponse/<client id>` inside `Observation.derivedFrom` after
a POST. Across reloads nothing needs remembering, because `findOpenEncounter`
reads the slice back from the server and gets server ids for free.

### Option B — conditional update by identifier

Move the client-minted id into `identifier` and write
`PUT <Type>?identifier=<system>|<id>`. Less code, no id-mapping, preserves the
convergence semantics exactly, proven on Medplum.

### Recommendation: A's write method, B's identifier

**Not B alone, and the reason is the whole point of this exercise.** Conditional
update is an *optional* FHIR capability. B would replace a dependency on one
optional capability (update-as-create) with a dependency on another — and we
would have chosen it because it works on the single real server we have tested.
That is the same move the mock EHR made when it grew a `PUT` handler to satisfy
the app, one level up. It would very likely work, and it would leave the
portability question exactly as open as it is today, while feeling settled.

So: **POST to create and PUT by server id** (A), **and stamp the client-minted id
as a business identifier** (the good half of B). The identifier is legitimate
FHIR, gives correlation across sessions without a map, and leaves conditional
update available as an optimisation on servers that advertise it — rather than as
the thing the write path rests on.

⚠️ Whatever is chosen, the mock EHR should stop accepting update-as-create, or it
will keep certifying a write path no real server accepts.

## Still unproven

- **Writes of any kind**, hence the conformance of what SPiER writes. The
  CarePlan mappers stamp `meta.profile` and would be genuinely validated; the
  observation mappers and workflow recorders stamp nothing, so those writes would
  be checked against base R4 only — the gap CLAUDE.md records as *"instrument
  mappers stamp no profile, so 12 profiles are allowlisted."*
- **Framed/embedded launch**, FHIRcast against Medplum's hub, and required-binding
  validation (needs self-hosting).
- **Whether the mock EHR should keep the capability switch.** It still answers a
  question Medplum will not: *what happens when the server says no.* Keeping it
  was the research note's conclusion and nothing here changes it.
