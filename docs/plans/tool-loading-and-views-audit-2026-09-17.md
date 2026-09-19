# How SPiER loads, encodes and displays its clinical tools

**Audit — 2026-09-17.** Filed as two requests (how Questionnaires and CarePlans
are *loaded*; how the tool *views* are defined) and folded into one, because both
halves meet at the same declaration and neither can see the join alone.

⚠️ **A second pass over the same files landed on `main` while this one was open**
— #528, whose reasoning lives in
[`docs/internals/tool-views.md`](../internals/tool-views.md). Read that first for
the recorders' *shape*; this document is about the FHIR **contract** over them.
Where the two overlapped they agreed, and #528 got there first on one point: the
Stanley-Brown registry bypass in [§8](#8-what-this-audit-changed), and the
verdict that `StanleyBrownView` was a fork rather than a load-bearing recorder
([§4](#4-which-of-the-10-bespoke-recorders-are-load-bearing-nine-of-them)).

Everything below was read against the repo on the date in the title. The three
code changes this audit made are listed in [§8](#8-what-this-audit-changed); every
other finding is scoped, not fixed.

---

## 0. The one-paragraph answer

The loading half is in better shape than it looks and the view half is in worse
shape than it looks, for the same reason: **SPiER already declares, in FHIR, what
each tool consumes and what it produces — and only the consuming half is
checked.** `ActivityDefinition.relatedArtifact` names the Questionnaire a tool
administers, and `check:catalog` resolves all 19 references both ways.
`PlanDefinition.action.output` names the *type and profile* of the resource each
tool produces — 39 declarations across 46 actions, 38 of them carrying a profile
— and **nothing relates a single one of them to what the app writes.** Two tools
were wrong as a direct result, one of them at the root of the Stage-8 measure
set. Both are **fixed**, and so is the gap itself: **`check:outputs`** now relates
every declared output profile to what the app emits
([§8](#8-what-this-audit-changed)). Its first run found a third gap nobody had
noticed — TL-005 (BSSA) was the one launchable recorder in the catalogue with no
`output` declaration at all. Its first run also made the
last gap legible — 12 of 29 profiles had to be exempted because the instrument
mappers stamped no `meta.profile` at all — and writing that exemption down is
what got it closed the same day. **Both of the gate's allowlists are now
empty.**

---

## 1. Should Questionnaires be resolved by canonical from the launched server?

### What is true today

[`packages/core/src/data/questionnaires.ts`](../../packages/core/src/data/questionnaires.ts)
holds 18 build-time static JSON imports from `ig/input/resources/questionnaires/` (17 before this
audit — see [§8](#8-what-this-audit-changed)), casts each `as unknown as
QuestionnaireResource`, and builds `QUESTIONNAIRE_BY_URL` keyed by
version-stripped canonical.

**The `FhirDataSource` seam does not cover Questionnaire, and it is not an
oversight in the interface — it is the interface's whole subject.**
[`smartDataSource.ts`](../../packages/core/src/lib/dataSource/smartDataSource.ts)
searches thirteen resource types — QuestionnaireResponse, Observation, CarePlan,
Communication, EpisodeOfCare, Flag, Task, DocumentReference, ServiceRequest,
Appointment, Consent, Procedure, Patient — every one of them **patient-scoped**.
`FhirDataSource`'s three verbs are `getSlice(patientId)`, `saveResponse` and
`saveArtifact`; `listCohort` is a roster of patients. There is no shape in it for
a definitional artifact, and adding `Questionnaire` to a *patient slice* would be
a category error. Definitional resources (Questionnaire, ActivityDefinition,
PlanDefinition, Measure) are 100% build-time in SPiER, on both surfaces.

### The assessment

**Yes — but as a second seam, not as a fourteenth entry in this one.** The FHIR
answer is unambiguous: a Questionnaire is identified by a canonical URL precisely
so a consumer can resolve it against whatever server it is talking to, and a
SMART app that hard-codes the form it renders is asserting that its copy is the
one the site uses. That assertion is exactly what SPiER's Adoption Guide exists
to stop a site from making by accident.

What it would need is small and shaped like the existing seam:

```ts
interface DefinitionSource {
  /** Resolve a Questionnaire by canonical. `null` = the server has none. */
  getQuestionnaire(canonical: string): Promise<QuestionnaireResource | null>
}
```

with a `BundledDefinitionSource` (today's map, synchronous, the fallback) and a
`SmartDefinitionSource` (`GET Questionnaire?url=…&version=…`, falling through to
the bundled copy on 404 or on a `capabilities` gap). The precedent for the
fallback decision is already written: `listCohort` returns `null` for "I cannot
answer that" rather than pretending, and `smartDataSource.ts:419` refuses to make
"a false readiness claim". The same rule applies here — **a form resolved from
the server and a form shipped in the bundle are different provenance and the UI
must be able to say which**, because "we rendered our copy of the PHQ-9" and "we
rendered yours" are different demos.

⚠️ **Three things would have to be decided before writing it, and none is a
refactor:**

1. **The renderer takes a resource, not a promise.** `QuestionnaireView` receives
   `questionnaire` as a prop from a ready-to-render element in
   [`toolViews.tsx`](../../packages/tool-views/src/data/toolViews.tsx). An async resolve has to
   land above that — either the map becomes slug → *canonical*, and a loader
   component resolves before rendering, or the element keeps its bundled copy as
   the initial value and swaps. The first is correct and is a real change to the
   file both route families read.
2. **`ordinalForAnswer` must join against the form the answers came from.**
   Today it looks the canonical up in the bundled map. If a server-supplied form
   is what was filled in, the weight join must use *that* resource or it scores
   one instrument's answers against another's weights.
3. **A version mismatch stops being invisible.** See below.

### What `stripCanonicalVersion` costs

`QUESTIONNAIRE_BY_URL` is keyed version-stripped, and so are both lookups. The
QR itself is stamped with the version — `QuestionnaireView` writes
`` `${qUrl}|${qVersion}` `` — so the information is recorded and then discarded
at every read. Measured today:

| | |
|---|---|
| Questionnaires on disk carrying a `version` | 18 of 18 |
| Distinct versions | `1.0.0` (16), `1.1.0` (Stanley-Brown), `1.1.0-pilot` (ASQ) |
| AD `relatedArtifact.resource` pins that disagree with the file | **0** |
| Gates comparing the AD's pinned version to the file's | **none** — `check:catalog` strips the version on both sides |
| Instruments where the version actually changes a score | **2** (PHQ-9, SBQ-R — the only two carrying `ordinalValue`) |

So the cost has two parts:

- **Today, internally: nothing, and nothing is watching.** The AD pins
  `…/PHQ-9|1.0.0` and the file says `1.0.0`; if someone bumped one, no gate
  would notice. That is a one-line addition to `check:catalog` check C (compare
  the version part when the reference carries one) and is worth doing whether or
  not server resolution ever lands.
- **Against a host server: a silent mis-score, bounded to two instruments.** A
  host holding `PHQ-9|2.0.0` whose item-9 `answerOption` weights differ would
  produce a QR that `toolForQuestionnaireUrl` happily resolves to SPiER's tool
  and `ordinalForAnswer` happily scores against `1.0.0`'s weights. No error, a
  wrong total. The blast radius is small *because* only PHQ-9 and SBQ-R carry
  ordinals — but PHQ-9 item 9 is the trigger for the demo's flagship C-SSRS
  workflow, so it is the wrong two to be relaxed about.

**Recommendation.** Keep version-stripping as the *dispatch* rule (it is what
lets a foreign QR find its mapper at all, which is `fallbackDispatch`'s whole
purpose) and make it explicit as a *scoring* rule: `ordinalForAnswer` should take
the resolved Questionnaire, not a canonical, so the join can never silently
resolve to a different version than the one that was filled in.

### The `as unknown as QuestionnaireResource` casts

Nothing ties the casts to validation, and nothing can, because
`QuestionnaireResource` is
`{ resourceType: 'Questionnaire'; url?: string; version?: string }` over
`[k: string]: unknown`. The cast is not hiding a stricter type — **there is no
stricter type to hide.** `scripts/validate-fhir.mjs` validates the files with
the HL7 validator, which is the real check, and the TypeScript type is a handle,
not a contract. That is a deliberate and documented choice
([`packages/core/src/types/fhir.ts`](../../packages/core/src/types/fhir.ts):
"We don't pull in `@types/fhir` to keep the dep surface small").

**No change recommended**, with one caveat worth writing down: because the type
is that loose, `InstrumentHeader` takes `name?: unknown` and narrows with a
`typeof value === 'string'` guard. That pattern is the thing keeping the
looseness honest, and anything new that reads a field off a Questionnaire should
copy it rather than cast.

---

## 2. Are the two `ig/input/resources/questionnaires/` CarePlan templates live?

**No. Nothing reads them at runtime, and they do not belong in the Questionnaire
registry — they are not Questionnaires.**

| | `CAMS/Stabilization_CarePlan_Template.json` | `Stanley-Brown/Hybrid_CarePlan.json` |
|---|---|---|
| `resourceType` | CarePlan | CarePlan |
| `id` | `cams-stabilization-careplan-example` | `stanley-brown-safety-plan-hybrid-example` |
| `meta.profile` | `spier-cams-stabilization-plan` | `spier-stanley-brown-safety-plan` |
| `status` | `active` | `active` |
| Imported by any `.ts`/`.tsx` | no | no |
| Referenced anywhere | two READMEs and two plan docs | same |

Both are **IG example instances that happen to live in the tool folder rather
than in FSH.** Their ids end `-example`, they each claim one of the app's own
CarePlan profiles, and they are published by the IG because their folder is a
`path-resource` entry — which `sushi-config.yaml` calls out as correct and
intentional: *"The two CarePlan templates and the ASQ yes/no ValueSet that sit
beside the Questionnaires come along as examples, which is correct: they are FHIR
resources the app ships."*

They relate to
[`packages/core/src/lib/carePlanMappers/`](../../packages/core/src/lib/carePlanMappers/)
as **target and generator**: the mappers turn a QuestionnaireResponse into a
CarePlan stamped with the same profile these templates claim
(`carePlanMappers/shared.ts` sets `meta.profile: [options.profileUrl]`, with the
profile URL type generated from the FSH). The templates are the hand-authored
"here is what one looks like"; the mappers are the runtime path. Both READMEs
already say exactly this ("kept for reference; the conformance target is the
`…` profile").

**Recommendation: leave them where they are.** The one thing worth noting is
what they are *not* covered by: `check:scenarios` walks
`packages/demo-population/src`, and these are not scenario fixtures, so the only
thing checking them is `validate-fhir.mjs` (structure) and the IG Publisher
(profile conformance, once a release runs). That is adequate for reference
material and would not be for anything the app read.

---

## 3. Which SDC operations are genuinely applicable?

### The census

| SDC feature | Declared in `ig/input/resources/questionnaires/` | Implemented | Gated |
|---|---|---|---|
| `sdc-questionnaire-observationExtract` | **36 items across 10 Questionnaires** | by hand, in `observationMappers/` | `check:extract` |
| `ordinalValue` + `weight()` join | 2 Questionnaires (PHQ-9, SBQ-R) | `ordinalForAnswer` | indirectly, via `check:readers` |
| `sdc-questionnaire-calculatedExpression` | 2 Questionnaires (PHQ-9, SBQ-R) | not executed — the mapper sums | no |
| `initial` / `initialExpression` (`$populate`) | **0 occurrences** | not implemented | n/a |

### `$extract` — applicable to about half of what the mappers do, and already declared

This is the strongest part of the loading story and is easy to under-credit.
SPiER does not merely hand-roll extraction; it **declares the contract in the
Questionnaire and gates the implementation against the declaration.**
`check:extract` asserts that every item carrying `observationExtract` also
carries a `code`, and that the declared code set per Questionnaire equals the
literal Observation codes its mapper emits.

What `$extract` could *not* do, and what the gate's own header correctly says is
deliberately undeclared: the **computed** Observations — the ASQ composite
disposition, the C-SSRS risk level, the PHQ-9 item-9 ordinal, every
crosswalk-derived concept-layer Observation. Those are not extractions of an
answer; they are clinical logic over several answers. `$extract` is defined for
the literal case, and SPiER's mappers do the literal case *plus* the derivation.
Splitting them to use a real `$extract` for the literal half would mean two
mechanisms producing one patient's Observations, and the derivation half would
still be code.

**Assessment: correctly hand-rolled, and unusually well documented as such.**
The one thing a server-side `$extract` would buy is the ability to point a host
at the Questionnaire and have *its* engine produce the Observations — which is a
real interoperability claim SPiER could make and currently cannot. That is
product scope, not a refactor.

⚠️ **One concrete gap found — since fixed ([§8](#8-what-this-audit-changed)).**
`check:extract`'s `EXPECTED` map was a hand-written list of ten Questionnaire
paths, and **nothing asserted that every mapper's Questionnaire appeared in it.**
Four did not — a Questionnaire absent from the list was not *checked and found
empty*, it was **never opened**:

- `camsSectionA.ts` emits six literal per-item Observations from linkIds
  `1-score`…`6-score`, coded against
  `http://thespierproject.org/fhir/CodeSystem/cams-ssf`. Those are textbook
  literal extractions. `cams-ssf5-section-a.json` declares **zero**
  `observationExtract` items and is **absent from `EXPECTED`**.
- `camsOutcomeDisposition.ts` — same six, same absence.
- `camsSectionB.ts` — emits suicide-driver **Conditions**, so `observationExtract`
  cannot apply even in principle; that is a decision, and nothing recorded it.
- `cssrsFull.ts` — emits one computed risk tier from the C-SSRS triage ladder
  over twelve items; likewise a decision nothing recorded.

This is precisely the failure class `docs/internals/web-gates.md` catalogues: the
gate is not wrong, it is *scoped*, and the scope is a hand list that goes stale
silently. The fix is one rule, and it mirrors `check:prose`'s `NON_PROSE`
classification and `check:catalog`'s `MULTI_AD_TOOLS` allowlist.

### `$populate` — not applicable yet, and the reason is worth stating

Zero `initial` and zero `initialExpression` across all 18 Questionnaires: nothing
in SPiER pre-fills a form from patient data. `$populate` is therefore not
"hand-rolled instead" — **it is a capability the app does not have.**

Whether it should: the instruments SPiER carries are mostly ones where
pre-filling is clinically wrong. A C-SSRS asked "since last contact" must be
asked, not inferred; an ASQ pre-populated from last month's answers is a
documentation artifact, not a screen. The two places it would genuinely help are
the *recorders*, not the instruments — a discharge packet already reads the
patient's live CarePlan/Observation/Appointment to build `context.related`
(`DischargePacketView`), and a follow-up appointment view already derives its
tracking summary. Those are population-from-context done in TypeScript against
resources already in the slice, which is what `$populate` does, without the round
trip.

**Assessment: correctly not implemented. Revisit only if a host asks SPiER to
render *its* Questionnaire, at which point `$populate` and server-side
Questionnaire resolution ([§1](#1-should-questionnaires-be-resolved-by-canonical-from-the-launched-server)) are the same project.**

### `weight()` — correctly hand-rolled, and the header already says why

`ordinalForAnswer` is the TypeScript reference implementation of the SDC
`weight()` FHIRPath join, written because `@formbox/renderer` does not copy
`answerOption.extension[ordinalValue]` onto the captured answer. That is a
renderer limitation, not a standards choice, and the module header states it.
Nothing to change.

⚠️ Worth recording for scale: `QUESTIONNAIRE_BY_URL` has 18 entries and **two
live consumers** (`ordinalForAnswer`, `answerCodingForOrdinal`, plus one test
fixture), and only PHQ-9 and SBQ-R carry `ordinalValue`. So the "registry" is
really two things wearing one name — a 18-entry *named-import list* that the
renderer consumes, and a canonical index that serves *two* instruments. That is
fine, but it explains why the map could lose an entry for months without anyone
noticing (see [§8](#8-what-this-audit-changed)).

---

## 4. Which of the 10 bespoke recorders are load-bearing? (Nine of them.)

**Nine of ten. Every one has its reason written in its own header, and the
reasons are not stylistic — each names a different FHIR resource type or a
profile a measure reads.**

⚠️ **The tenth was a fork, and #528 found it while this audit was in flight.**
`StanleyBrownView` was a near-copy of `QuestionnaireView` whose divergence was
*not* load-bearing: it had drifted out of four things the shared view had grown
(the `?tool=` launch-stage stamp, the observation summary, the writeback panel,
and honouring a care plan's `isEmpty`), and it was also the one instrument
bypassing the Questionnaire registry. `stanley-and-brown` now renders
`QuestionnaireView` with `carePlanMapper={generateCarePlan}` like its three CAMS
and CRP siblings. This audit had it in the load-bearing column, on the strength
of its header — which is the lesson: a documented reason is evidence that
someone thought about it, not that the conclusion still holds.

| Slug | Component | Writes | Reason it is not `WorkflowActionView` |
|---|---|---|---|
| `caring-contact` | `CaringContactView` | Communication + `SPiERCaringContact` + opt-out ext | The generic recorder stamped neither, so `SPiERCaringContactAdherence` could not see it and its `denominator-exclusion` could never fire (#211) |
| `referral` | `SafetyReferralView` | ServiceRequest | A Communication cannot be tracked past "sent"; `ServiceRequest.status` models `draft → active → completed \| revoked` natively |
| `discharge-packet` | `DischargePacketView` | DocumentReference | The handoff is an *event*, the packet is an *object*; `context.related` points at live resources; the one screen where a recorded preference changes an artifact (#227) |
| `follow-up-appointment` | `FollowUpAppointmentView` | Appointment | TL-034 mints no resource of its own — `Appointment.status`/`start` already carry everything, so tracking upserts the same resource |
| `sharing-consent` | `SharingConsentView` | Consent | "Patient declined" is a **deny provision**, not a status; the nested deny expresses "share with the clinic, not with this support person" |
| `outreach` | `OutreachAttemptView` | Communication + `SPiEROutreachAttempt` | `Communication.status` says a message was sent, never whether anyone answered — the outcome rides as a 1..1 extension |
| `risk-episode` | `RiskEpisodeView` | EpisodeOfCare + Flag | Modal by design: one open episode at a time, made structural rather than validated |
| `safety-tasks` | `SafetyTaskView` | Task | One shape, three tools, differentiated by `Task.code`; overdue computed, never stored |
| `lethal-means` | `LethalMeansCounselingView` | Procedure + Observation(s) | Two halves because the FHIR has two: the counseling (`SPiERLethalMeansCounselingCompleted`'s numerator, structurally unreachable before this existed — #210) and what was secured, with `status` separating *done* from *agreed* |

**Do not merge any of them.** The right generalisation is not "make the generic
recorder do more"; the nine are already thin — eight of nine build no FHIR at all,
they call a builder in `packages/core/src/lib/` (`followUp.ts`, `handoffs.ts`,
`riskEpisode.ts`) and render a form over it. The FHIR shape is already factored;
what differs is the form, and a form over `Consent.provision` and a form over
`Task.restriction.period.end` do not usefully share a parameterisation.

### The finding is the other way round: the **two** `WorkflowActionView` users — now fixed

Both remaining generic recorders were the caring-contact defect, unfixed. They
are fixed now — this section keeps the diagnosis in the present tense because it
is the reasoning the [proposed `check:outputs` gate](#6-could-the-views-be-derived-from-the-activitydefinition)
is written against, and because the same shape can recur on the next tool.

`WorkflowActionView` emitted a Communication with `meta: { tag: [stage] }` — **no
`meta.profile`** — and `category: [{ text: … }]` — **no coding**. Both tools it
serves declare a profile:

| Tool | Slug | Declared output (`PlanDefinition.action.output`) | What the recorder wrote | Now |
|---|---|---|---|---|
| TL-009 | `transition` | `Communication` / `spier-safety-handoff` | untyped, unprofiled Communication | `buildSafetyHandoff` → `SafetyHandoffView` |
| TL-013 | `crisis-resources` | `Communication` / `spier-crisis-resources-shared` | untyped, unprofiled Communication | `buildCrisisResourcesShared` → `CrisisResourcesView` |

Both profiles `insert SuicideRiskDomainCategory`, which contributes
`category contains suicideRisk 1..1` fixed to `SPiERConceptDomain#suicide-risk`.
`WorkflowActionView`'s `category: [{ text }]` carries no coding, so its output
**cannot** satisfy either profile even ignoring `meta.profile`.
`SPiERCrisisResourcesShared` additionally requires `payload 1..*`, and the
recorder writes `payload` only when the optional Notes field is non-empty.

⚠️ **TL-009 is the serious one, and it is not "a measure can't see one tool".**
`spier-safety-handoff` appears in exactly two non-test source lines in the whole
repo — `measures.ts:77` (the constant) and `measures.ts:404` (the filter). It is
**read by the measure engine and written by nothing.** There is no
`buildSafetyHandoff` in `handoffs.ts` (its four builders are the packet,
referral, appointment and consent). And `measure-and-share.fsh` is explicit about
what that Communication is for:

> Stage 5 `SPiERSafetyHandoff` / `SPiERDischargeSafetyPacket` → the **INDEX
> EVENT for every post-transition measure** … a site that has not adopted
> TL-009 / TL-030 cannot compute the follow-up measures at all. That is a true
> finding about their pathway, not a gap in the measure.

That reasoning is right, and SPiER's own app is currently the counter-example it
was not written for: SPiER **has** adopted TL-009, ships a recorder for it, and
still reads as not having adopted it. The measure family is not structurally
unreachable — `transitionDates` is `[...handoffDates, ...packetDates]`, and
`DischargePacketView` *does* stamp `spier-discharge-safety-packet` — so a site
that assembles packets computes its follow-up measures and a site that records
transition checkpoints does not. **Half-blind is harder to notice than blind**,
and three scenario fixtures (`patient-008`, `-010`, `-011`) carry
`spier-safety-handoff` by hand, so the demo dashboard shows a healthy numerator
while the live recorder produces nothing that feeds it.

TL-013 is the same defect with lower stakes: no measure reads
`spier-crisis-resources-shared` and no fixture carries it, so the damage is a
conformance claim the IG makes (the AD's own description says the output is "a
SPiERCrisisResourcesShared Communication") that the app does not honour.

⚠️ The handoff profile's published `Description` still says it is *"Deliberately
a LOW floor — the existing demo recorder emits a plain stage-tagged
Communication, and this profile is written so that output stays conformant."*
That sentence was true when written and stopped being true when `#262` added the
1..1 domain-category slice. It is published IG prose, so correcting it is an IG
change — but the right correction is to make the recorder conformant and delete
the sentence, not to soften the profile.

**Fixed 2026-09-17** — `buildSafetyHandoff` and `buildCrisisResourcesShared` in
`packages/core/src/lib/handoffs.ts` and `crisisResources.ts`, thin views over
each, `WorkflowActionView` deleted with its last caller. The HL7 validator now
checks both builders' output against the profiles they claim, and the measure
suite builds its index transition with the production builder rather than a
literal. Details and the plants in [§8](#8-what-this-audit-changed).

⚠️ **What the fix does NOT do is stop the class recurring**, and that is still
the gate in [§6](#6-could-the-views-be-derived-from-the-activitydefinition).
Nothing yet relates a `PlanDefinition.action.output.profile` to a recorder; the
next tool added without one fails exactly the same way, silently.

### One smaller inconsistency

Nine of the ten recorders' FHIR builders live in `packages/core/src/lib/`. The
tenth, `LethalMeansCounselingView`, builds its Procedure and Observations from
`packages/tool-views/src/lib/lethalMeans.ts`. The module is React-free and DOM-free, so it would
move as-is — but where it sits today it is invisible to `check:core-boundary` and
unreachable from both Workers and from any non-React consumer. It is the only
FHIR-shape module outside core. Low priority, trivially fixed.

---

## 5. Is a `JSON.stringify` gate worth building?

### Current state

`JSON.stringify` in `web/src`, non-test, is eight call sites and they are all
accounted for:

| Site | Kind |
|---|---|
| `FhirJsonViewer.tsx:48` | the gated leaf |
| `CarePlanDisplay.tsx:34, :88` | self-gated (`useInspect()` at :27), and its header names this exact hole |
| `ToolConfigProvider.tsx:53`, `useLocalStorage.ts:17`, `localDataSource.ts:100, :158` | localStorage serialisation — not rendering |

**There is no live defect.** The question is recurrence.

### Verdict: build a narrow one, and not the obvious one

The obvious gate — "stringifies FHIR but has no `useInspect()` in the same file"
— is the wrong gate, for the reason the brief names: file-locality is not the
property. Thirteen non-test files render `FhirJsonViewer` or `CodeDrawer`; five
call `useInspect` and **eight are correct without it**, three inheriting through
`CodeDrawer` (`WorkflowForm`, `QuestionnaireView`, and — until #528 collapsed it
into `QuestionnaireView` — `StanleyBrownView`) and five
through the leaf itself (`PathwayView`, `ToolDetail`, `MeasureDashboard`,
`CarePathway`, `CdsServiceGuide`). Eight false positives on a gate whose whole
value is that a failure means something.

And the real property — *reachable from a clinician route, or only from
`/guide`* — cannot be computed from the import graph.
`check-guide-boundary.mjs`'s technique walks imports **downward from a known
entry set** (`guideSections.ts`) to catch a *forbidden import*; the question here
is the reverse, "which routes reach this component", which needs the route table
and a call graph. Worth being blunt: that is a static-analysis project, it would
need an allowlist the moment a component is reached from both, and a gate whose
answer is "it depends where it's rendered" cannot fail usefully.

So: **two cheap lexical gates that together cover the two real failure modes,
and an honest statement of what neither sees.**

**Gate A — the provider is exclusive.** `<InspectContext.Provider value…>`
appears in exactly two non-test files: `pages/AdoptionGuide.tsx` (the `/guide`
layout) and `pages/ToolTryIt.tsx` (which provides its own because it is a
*sibling* of that layout, not a child). Assert that set, by filename. This is
four lines of script and catches the catastrophic case — a provider added on a
clinician route turns inspection on for a whole subtree at once, and no leaf gate
would ever fire.

**Gate B — the leaf is exclusive.** No file except `FhirJsonViewer.tsx` and
`CodeDrawer.tsx` may render a `JSON.stringify(…)` into JSX or into a `Blob`,
unless it is on a declared allowlist whose entry carries a reason and a
`useInspect()` call in the same file. `CarePlanDisplay` is that allowlist's one
entry today, and its header already contains the reason verbatim.

Both are provable by planting, both fail loudly, and neither needs reachability.

### What they could not see — state this in the gate's own header

1. **A component that renders FHIR as formatted text.** `CarePlanDisplay`'s
   non-JSON half does exactly that and is *supposed* to — a CarePlan rendered as
   prose is the clinical view. The invariant is about the wire format, so
   "JSON serialisation" is the invariant's own wording, not a proxy for it. A
   component that laid out `Observation.code.coding[0].system` in a table would
   be showing raw FHIR and would pass.
2. **Laundering.** `const dump = (x) => JSON.stringify(x)` in a helper, a YAML or
   `structuredClone` round-trip, or a vendor component that pretty-prints.
   `@formbox/renderer` is not scanned by anything.
3. ⚠️ **An unguarded wrapper.** `ToolDetail` renders an `<h4>FHIR Examples</h4>`
   heading and a `.tool-detail-examples` container around `FhirJsonViewer`, with
   no `useInspect()`. It is safe **only** because its single caller is
   `PatientJourney`, which is `/guide/tools` inside the guide layout. Move it or
   render it from a second place and a clinician sees an empty section under a
   heading that says "FHIR Examples" — the same defect the four guarded call
   sites exist to prevent. Gate B does not fire on it (it renders no
   `JSON.stringify` of its own) and should not be made to: the honest treatment
   is a third, *declared* list — files that wrap the viewer in chrome of their
   own must be classified `GUARDED` (calls `useInspect`) or `GUIDE_ONLY` (with
   the route that makes it so, named). That is a comment with a linter, which is
   what several of SPiER's better gates already are.

---

## 6. Could the views be derived from the ActivityDefinition?

**No — and the reason is a hard FHIR R4 constraint, not an implementation gap.
But the declaration the views should be *checked against* already exists in the
repo, on the PlanDefinition, and nothing reads it.**

### Why the AD cannot drive a view

An `ActivityDefinition` says what a tool *is* and what it *consumes*:

```
* identifier[+].value = "TL-025"                      → the tool id (derived, per CLAUDE.md)
* kind = #ServiceRequest                              → see below
* relatedArtifact[=].resource = "…/Questionnaire/SBQ-R|1.0.0"   → what it consumes
* extension[instrument-licensing-status] + copyright  → licensing (derived, per CLAUDE.md)
```

⚠️ **`ActivityDefinition.kind` is not the output type, and reading it as one
would be wrong.** R4 binds `kind` to `RequestResourceType` — the kind of
*request* `$apply` would mint. Across SPiER's 43 ADs it takes four values
(ServiceRequest ×25, Task ×10, CommunicationRequest ×6, Appointment ×2), and it
disagrees with what the recorder writes in most cases by construction: TL-008 is
`#ServiceRequest` and writes Procedure + Observation; TL-030 is `#ServiceRequest`
and writes DocumentReference; TL-032 is `#ServiceRequest` and writes Consent;
TL-038 is `#Task` and writes EpisodeOfCare + Flag. The value set simply has no
member for most of those.

R4 *does* have the right slot — `ActivityDefinition.profile`, "the profile the
resulting resource must conform to". **It is unused on all 43 ADs.**

### What already exists

`PlanDefinition.action.output` is a `DataRequirement`, so it carries both `type`
and `profile`, and `ig/input/fsh/pathway-stages.fsh` uses it:

- **46 actions**, **39 `output` entries**, **38 carrying a `profile`**,
  **28 distinct profile canonicals**.
- Types span Observation (16), Communication (5), CarePlan (4), Task (4),
  Appointment (2), and one each of Condition, Consent, DocumentReference,
  EpisodeOfCare, Flag, MeasureReport, Procedure, ServiceRequest.

`check:pathway` resolves the pathway PlanDefinition's tier codes, stage codes and
`definitionCanonical`s. It does not look at `output` at all.

Of the 28 declared output profiles as this audit found them, **13 were claimed by
nothing the app wrote** — 12 absent from `packages/core/src`, `web/src` and
`services/` entirely, plus `spier-safety-handoff`, which appeared only in
`measures.ts` as a reader. **All 13 are now claimed** (29 of 29, counting the
BSSA output the gate's first run added):

| Formerly unstamped | What it was, and what fixed it |
|---|---|
| `spier-safety-handoff`, `spier-crisis-resources-shared` | the two recorder defects — `buildSafetyHandoff` / `buildCrisisResourcesShared` |
| `spier-phq9-total-score`, `spier-phq9-item9`, `spier-sbqr-total-score`, `spier-asq-result`, `spier-bssa-disposition-result`, `spier-pss3-result`, `spier-cssrs-risk-level`, `spier-safet-risk-level`, `spier-pss-full-risk-level`, `spier-cams-ssf-vital`, `spier-cams-outcome-disposition` | `makeObservation` stamped nothing at all; it now takes a `profile` typed by a union **generated from the FSH** |
| `spier-cams-suicide-driver` | the one Condition — stamped, *and* given the required concept-domain category it had been missing since #271, *and* given the IG example that finally exercised it |

The reasoning that had looked defensible — "instrument Observations are queried
by `code`, and measures read the concept-layer Observation" — was true about how
the data is *consumed* and beside the point about whether it is *checked*. See
[§8](#8-what-this-audit-changed).

### The assessment

Generating a *UI* from the AD is the wrong ambition. The nine bespoke recorders
differ in what a clinician has to decide — a deny provision with a named actor, a
per-means table with done-vs-agreed, a modal open/close — and none of that is
expressible in an ActivityDefinition or worth inventing an extension for. The
seventeen `QuestionnaireView` entries already *are* derived in every sense that
matters: one component, parameterised by the Questionnaire the AD names.

The achievable and valuable version is the **conformance direction**, and it
closes exactly the class of defect this audit found twice:

> **`check:outputs`** — for every `PlanDefinition.action.output` with a
> `profile`, the tool's recorder must stamp that profile. Read the output
> declarations from the generated PlanDefinitions, map action →
> `definitionCanonical` → AD → tool id → `TOOL_VIEWS` slug (the chain
> `check:catalog` already walks), and assert the profile is claimed. Profiles
> deliberately not claimed go on an allowlist with the reason, the way
> `check:prose` classifies `NON_PROSE`.

**Built 2026-09-17** — `scripts/check-output-profiles.mjs`, four rules, in
`verify` after `npm test`. One thing the sketch above got **wrong** and the
implementation had to change: it proposed asserting the canonical appears "as a
`meta.profile` literal in the view's reachable builder", which is a lexical
test — and a lexical test *passes the TL-009 defect*, because
`spier-safety-handoff` was in `packages/core/src` the whole time it was broken,
in `measures.ts`, as the constant a filter reads. The gate reads the **emitted
corpus** (`.runtime-fhir`) instead, which cannot confuse "named" with
"written". See [web-gates.md](../internals/web-gates.md#checkoutputs--the-producing-half-of-a-tools-contract).

That is a genuine answer to "could the two halves be one mechanism": **the
catalog already knows the canonical it consumes *and* the profile it produces;
what is missing is not a generator, it is the second gate.** It would have
caught #211 (caring contact) before it shipped, and it catches TL-009 and TL-013
today.

⚠️ The load-bearing rule, stated in advance and kept: **it fails on "this tool
has no `output` declaration" as loudly as on a mismatch.** The scope that makes
that workable is *tools whose launch path lands on a `TOOL_VIEWS` slug* — a tool
with no recorder writes nothing, so demanding a declaration of it would demand a
statement about a capability that does not exist. That leaves rule 1 with an
**empty allowlist**, and on its first run it found TL-005.

---

## 7. Summary of findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | TL-009's declared profile `spier-safety-handoff` is read by the Stage-8 measure engine and written by nothing; the transition recorder is the generic `WorkflowActionView` | **high** — the index event for every post-transition measure is half-blind, and fixtures hide it | **fixed**, [§8](#8-what-this-audit-changed) |
| 2 | TL-013 likewise emits a Communication that cannot satisfy `spier-crisis-resources-shared` | medium — a conformance claim the IG makes and the app breaks | **fixed**, [§8](#8-what-this-audit-changed) |
| 3 | Nothing relates `PlanDefinition.action.output.profile` (38 declarations) to what the app writes | **high** — the mechanism that would have caught #1, #2 and #211, and will catch the next one | **fixed** — `check:outputs`, [§8](#8-what-this-audit-changed) |
| 4 | `check:extract`'s `EXPECTED` is a hand list; **4** mappers' Questionnaires are absent — two of which emit literal per-item Observations with no `observationExtract` declaration, and two whose absence of one was an unrecorded decision | medium | **fixed**, [§8](#8-what-this-audit-changed) |
| 5 | The Questionnaire registry claimed to be the single owner of the `ig/input/resources/questionnaires/` imports and was not — `StanleyBrownView` held its own | low (no live consequence: no `ordinalValue`) but exactly the drift CLAUDE.md warns about | **fixed by #528**, and **gated here** — [§8](#8-what-this-audit-changed) |
| 6 | `check:catalog` strips the version on both sides, so an AD pinning a version the file does not carry would pass | low (0 disagreements today) | one-line addition, [§1](#1-should-questionnaires-be-resolved-by-canonical-from-the-launched-server) |
| 7 | `spier-safety-handoff`'s published profile Description still claims the generic recorder's output "stays conformant"; `#262`'s 1..1 domain-category slice made that false | low — IG prose | **fixed**, [§8](#8-what-this-audit-changed) |
| 8 | `ToolDetail` is an unguarded wrapper, safe only by its single caller's route | low | classify in the proposed gate, [§5](#5-is-a-jsonstringify-gate-worth-building) |
| 9 | `lethalMeans.ts` is the only FHIR-shape builder outside `packages/core` | low | trivial move, [§4](#4-which-of-the-10-bespoke-recorders-are-load-bearing-nine-of-them) |
| 10 | TL-005 (BSSA) was the one launchable recorder with no `output` declaration, while the action's own description named the profile and the comment above it called BSSA "fully FHIR-modelled" | medium | **fixed** — found by `check:outputs`' first run |
| 11 | The instrument mappers stamp no `meta.profile`, so ~80 emitted Observations are validated against base `Observation` only and 12 declared profiles' runtime conformance is verified by nothing | medium | **fixed** — [§8](#8-what-this-audit-changed) |
| 12 | `camsSectionB` built `Condition.id` from a label containing `#`, an illegal FHIR id character, on every driver it has ever produced | medium | **fixed** — found the first time that Condition was validated |
| 13 | `deriveFromResponse` stamped `derivedFrom` on every derived resource, including the Section B Conditions, where R4 does not define it | medium | **fixed** — same run |
| 14 | The CAMS driver Condition never carried the `category:suicideRisk` slice #271 made required; #302 fixed every other runtime builder and missed this one, because a resource claiming no profile validates against nothing | medium | **fixed** — same run |
| 15 | The demo scenarios exercise 9 of the 14 mapped instruments, so five mappers ran in no fixture at all | medium | **fixed** — the emitter now also derives from the IG's example QuestionnaireResponses, and a new test names every mapped canonical |

Explicitly **not** findings, recorded so the next audit does not re-open them:
the two CarePlan templates (reference material, correctly placed —
[§2](#2-are-the-two-fhir-resources-careplan-templates-live)); nine of the ten
bespoke recorders (load-bearing — [§4](#4-which-of-the-10-bespoke-recorders-are-load-bearing-nine-of-them));
the `as unknown as` casts ([§1](#1-should-questionnaires-be-resolved-by-canonical-from-the-launched-server));
`$populate` ([§3](#3-which-sdc-operations-are-genuinely-applicable)); and the
`weight()` hand-roll ([§3](#3-which-sdc-operations-are-genuinely-applicable)).

---

## 8. What this audit changed

Two passes. The verification for both: the repo root's `npm run verify` green (89 test
files, 977 tests, one pre-existing `react-hooks/exhaustive-deps` warning in
`MeasureDashboard.tsx`), `check-sushi-output.mjs` 0 errors / 6 expected warnings,
`check-ig-narrative.mjs`, `check-md-links.mjs`, and `validate-fhir.mjs --also
.runtime-fhir` at **657 resources / 0 errors**, of which 207 are emitted by
the app's own builders.

### Pass 1 — the registry bypass (audit findings)

1. **The Stanley-Brown registry bypass.** `StanleyBrownView` held its own
   `import … from '../../../ig/input/resources/questionnaires/…'`, so eighteen Questionnaires
   shipped and `packages/core/src/data/questionnaires.ts` — whose header says it
   is "the single owner of the hand-authored Questionnaire JSON imports" — held
   seventeen. No behaviour depended on it: the safety plan carries no
   `ordinalValue`, which is why the absence had no visible symptom and why it
   survived. **#528 landed the same fix independently while this branch was open**
   (it deleted the view outright as a fork of `QuestionnaireView`), so what
   remains from this branch is the second half — the gate.
2. **`check:catalog` check C gained a third direction**: every Questionnaire JSON
   under `ig/input/resources/questionnaires/` must be imported by that registry module. Matched on
   the **file path**, read as text — deliberately not on the canonical, because a
   canonical-based check passes on a second importer resolving the same URL,
   which is the defect. Proved by planting both defects: removing the
   Stanley-Brown import fails with one named error; changing the import specifier
   fails with eighteen.
3. **A stale comment in `check-careplan-readers.mjs`** said the
   canonical→carePlanMapper association "lives in `App.tsx`'s route props". It
   moved to `packages/tool-views/src/data/toolViews.tsx` on 2026-09-17.

### Pass 2 — TL-009 and TL-013 get real builders (findings 1, 2, 7)

`WorkflowActionView` is **deleted**; the three tools that used to share it each
have a builder in `packages/core` that stamps what its own IG page says it
produces.

| | |
|---|---|
| `packages/core/src/lib/handoffs.ts` | `SAFETY_HANDOFF_PROFILE` (moved here from `measures.ts`, which now re-exports it), `HANDOFF_CHANNELS`, `buildSafetyHandoff`, `safetyHandoffs` |
| `packages/core/src/lib/crisisResources.ts` | new Stage-4 module: `CRISIS_RESOURCES`, `buildCrisisResourcesShared`, `crisisResourceCodes`, `crisisResourceShares` |
| `packages/tool-views/src/components/SafetyHandoffView.tsx` | the TL-009 recorder — channel, recipient, the shared TL-009/TL-030 content checklist, summary, note |
| `packages/tool-views/src/components/CrisisResourcesView.tsx` | the TL-013 recorder — the coded resource checklist, a site-specific local-line field, note |
| `web/src/components/WorkflowActionView.tsx` | **deleted** with its last caller |

Both builders stamp `meta.profile`, `stageTag()` and `suicideRiskCategory()` —
the last being the half a profile check alone misses, since `#262` made
`category:suicideRisk` a required 1..1 slice and the generic recorder wrote
`category: [{ text }]` with no coding.

**Design notes worth keeping:**

- `HANDOFF_CHANNELS` is deliberately **not** the Stage-6 patient-facing channel
  list. A handoff goes to the next clinician, so SMS and email are out and
  face-to-face is in. All four `v3-ParticipationMode` displays were checked
  against the published CodeSystem, because `validate-fhir.mjs` checks every
  `Coding.display` and a wrong one is a validator failure one commit later. An
  unrecognised channel code produces **no** `medium` rather than a coding with a
  guessed display.
- The handoff's content checklist is `0..*` and the builder accepts an empty
  list: a transition recorded with nothing itemised is still a transition and
  still starts the follow-up clock.
- The crisis-resource profile is `payload 1..*`, and the builder does **not**
  paper over an empty selection — inventing a payload would assert that
  something was handed to the patient. The recorder disables its submit instead,
  and the empty case is unit-tested so the builder cannot quietly grow a
  fallback.
- `Communication.payload.content[x]` has no coded choice, so which resource was
  shared rides on the `crisis-resource-code` extension beside the
  patient-readable line — exactly what `ExampleCrisisResourcesShared` does. The
  coded `display` and the patient-facing text are separate strings on purpose: a
  display names the service, the payload has to say how to reach it.
- The recipient is `Reference.display` with no `reference`. The demo holds no
  Organization resources, and asserting one would be a dangling reference rather
  than a missing optional — the same choice `buildSafetyReferral` makes.

**Three things were proved by planting, not assumed:**

1. **The validator really checks the new output against its profile.** Dropping
   `suicideRiskCategory()` from `buildSafetyHandoff` turns all four emitted
   handoff variants red; restoring it returns 657/0. (Note what this could *not*
   have proved: removing `meta.profile` instead makes the resource validate
   against nothing and **pass** — the degradation `docs/internals/fhir-conformance.md`
   warns about. The plant has to break a requirement, not the claim.)
2. **The measure suite is now wired to the builder.** `measures.test.ts`'s
   `handoff()` fixture was a hand-authored literal carrying `meta.profile` —
   which is precisely how the post-transition measure family stayed green while
   the app wrote nothing it could count. It now calls `buildSafetyHandoff`, and a
   planted profile-drop fails eight tests across `measures.test.ts` and
   `handoffs.test.ts` rather than none.
3. **Both builders' output reaches the HL7 validator.** Added to
   `runtimeFhir.emit.test.ts` — every handoff channel and every crisis-resource
   code, one resource each, so an unbound code or a wrong display fails there
   rather than on a chart. The families list in that file is an exact `toEqual`,
   so a builder that stops being emitted fails loudly.

**IG prose corrected** (three false statements, none of which any gate could see):

- `SPiERSafetyHandoff`'s published `Description` said it was "deliberately a LOW
  floor — the existing demo recorder emits a plain stage-tagged Communication,
  and this profile is written so that output stays conformant". True when
  written; false from `#262` onward, since the domain-category slice made that
  output non-conformant. Replaced with what the profile actually requires and
  why the checklist is optional.
- `handoffs.fsh`'s header still said the referral recorder "still emits a
  Communication" at `/patient/workflow/rapid-referral`. It has emitted a
  ServiceRequest since `SafetyReferralView` landed.
- `ExampleCrisisResourcesShared` carried no `meta.tag`, while its own profile's
  description says the resource is "tagged to the Document Safety Actions
  pathway stage via meta.tag" — so the only published instance of the profile
  contradicted it, and an implementer copying it got a resource
  `patientPathway.ts` cannot stage. A missing optional element is not a
  validation error, so nothing caught it.
- `docs/plans/stage-5-coordinate-handoffs.md`'s open follow-up ("the handoff
  recorder still emits a plain stage-tagged Communication … that is conformant")
  is closed, and the doc now records why the "conformant" half was also wrong.

### Pass 3 — `check:outputs` (finding 3)

`scripts/check-output-profiles.mjs`, wired as `npm run check:outputs` and
added to `verify` **after `npm test`**, because `npm test` is what writes the
`.runtime-fhir` tree it reads. Documented in
[web-gates.md](../internals/web-gates.md#checkoutputs--the-producing-half-of-a-tools-contract);
four rules, summarised in [§6](#6-could-the-views-be-derived-from-the-activitydefinition).

**The one design change from the §6 sketch.** That sketch said to assert the
canonical "appears as a `meta.profile` literal in the view's reachable builder".
That is lexical, and **a lexical gate passes the very defect it was written for**:
`spier-safety-handoff` sat in `packages/core/src` the whole time it was broken,
in `measures.ts`, as the constant a filter *reads*. The gate reads the emitted
corpus instead — the same tree `validate-fhir.mjs --also` validates — so "named"
and "written" cannot be confused. The source is still consulted, but only to tell
the reader which of the two failure shapes they have.

**It found a third defect on its first run.** TL-005 (BSSA) was the only
launchable recorder in the catalogue with no `output` declaration — while the
action's own `description` named `SPiERBSSADispositionResult`, the comment three
lines above called BSSA "fully FHIR-modelled", and `bssa.fsh` had published the
profile all along. Prose and structure disagreed and nothing had ever compared
them. Declared now, which leaves rule 1's allowlist **empty** — the only kind
#500's lesson says cannot go stale.

**Twelve plants, each restored to green**, covering every rule and every way the
gate could check nothing: the builder stops stamping while the constant is still
read (the TL-009 shape, verbatim); a profile nothing writes at all; two profiles
stamped on each other's `resourceType`; a recorder losing its `output` block
through a real SUSHI round-trip; an allowlist entry for a profile nothing
declares; one for a profile the app now claims; one whose reason is too short;
a stale emitted tree; a missing emitted tree; a thinned emitted tree (floor); a
changed `TOOL_VIEWS` shape; a renamed `launchActions` key. The first run also
printed a ✓ over a ✗ it had just emitted — the failure
`check-catalog-integrity.mjs` warns about in its launch-path section — so both
summary lines now count their own section's failures before claiming success.

### Pass 4 — `makeObservation` stamps the profiles (findings 11–15)

The allowlist did its job: naming the twelve exemptions made the hole legible,
and closing it was smaller than it looked. `makeObservation` gained an optional
`profile`, typed by **`ObservationProfileUrl` — a union generated from the FSH**
by `copy-fhir.mjs`, so a mistyped canonical is a compile error rather than a
claim on a profile nobody published. The generator that already emitted
`care-plan-profiles.generated.ts` was parameterized by resource type rather than
copied; both outputs are registered in the staleness manifest.

⚠️ **The parameter is per-CALL, not per-mapper**, and `phq9.ts` is what settles
that: its two calls claim two *different* profiles. A mapper emits a **result**
(the disposition, the tier, the total score — what the IG declares as the tool's
output) and the **per-item** Observations beside it, and only the first has a
published profile.

**Stamping turned the validator on over 28 resources and it immediately found
three defects**, all on code paths that had shipped unvalidated — because a
resource claiming no profile validates against nothing and passes:

1. `camsSectionB` built `Condition.id` as `cams-driver-<ts>-Driver-#1`. `#` is
   not a legal FHIR id character. **Every** CAMS driver Condition the app has
   ever written carried an invalid id.
2. `deriveFromResponse` stamped `derivedFrom` on everything in the derived array
   — and that array is not purely Observations, because `camsSectionB` returns
   its Conditions through it. `Condition.derivedFrom` is not an R4 element. It is
   now Observation-only, with `Condition.evidence.detail` named as the different
   assertion it would be rather than guessed at.
3. The driver Condition never carried the `category:suicideRisk` slice #271 made
   required. #302 fixed every other runtime builder and missed this one, and
   nothing could have caught it.

**Getting there needed the fixtures too.** Five mappers — SBQ-R, PSS-3,
PSS-Full, SAFE-T, the C-SSRS Screener — ran in no fixture at all; the demo
scenarios cover 9 of the 14 mapped canonicals. The emitter now also derives from
the IG's own example QuestionnaireResponses, which are hand-authored *and*
validated by the IG build — precisely the property the bad fixture in #263 phase
4 lacked. CAMS Section B had neither a scenario nor an example, so
`ExampleCAMSSectionBResponse` was authored; it is what exposed all three defects
above. A new test, **`covers every mapper in the registry`**, names every
canonical in `MAPPED_QUESTIONNAIRE_URLS` rather than counting resources — a count
would not have noticed, since there were 116 Observations either way — and its
own exemption list is empty.

**Both of `check:outputs`' allowlists are now empty**, and the gate reads
**29/29 claimed**. Re-proved by planting: removing the one line in
`makeObservation` that stamps the profile fails eleven tools at once; removing
one mapper's `profile:` argument fails exactly that tool, with the
"appears nowhere in the source" diagnosis.

### Pass 5 — `check:extract` opens every mapper's Questionnaire (finding 4)

The same shape as pass 4's fixture gap, one gate over: `EXPECTED` was a hand
list of ten paths, and a Questionnaire absent from it was **never opened** —
which is indistinguishable, in the gate's green output, from *checked and found
empty*. The gate printed ten ✓ lines and said nothing about the other four.

**Rule 3** now derives the set that ought to be checked from
`MAPPER_BY_QUESTIONNAIRE_URL` — read as text, since the gate is a node script and
the registry is TypeScript — resolves each canonical to its file through
`Questionnaire.url`, and requires every one to be classified as either `EXPECTED`
(with the literal codes its mapper emits) or `NO_LITERAL_EXTRACTS` (with the
reason). A classification for a Questionnaire no mapper serves fails too, and a
`NO_LITERAL_EXTRACTS` claim is *checked*, not trusted: the file must really
declare none.

The four unclassified mappers, and what each turned out to be:

| Mapper | Verdict |
|---|---|
| `camsSectionA` | **six literal extractions, undeclared.** Each SSF Core Assessment rating's Observation carries the 1–5 answer as its value and the item's own code — textbook `$extract`. Declared now, against the SPiER-local `cams-ssf` CodeSystem (no LOINC concepts exist for the SSF scale) |
| `camsOutcomeDisposition` | **seven.** The same six re-rated vitals plus the disposition, which is also literal: its `valueCodeableConcept` is the answer's own coding and its code is the item's (LOINC 93374-7) |
| `cssrsFull` | genuinely none — one risk tier computed by walking the published C-SSRS triage ladder across twelve lifetime/recent items. Now says so |
| `camsSectionB` | genuinely none — it emits **Conditions**, and `observationExtract` is defined for Observations. Now says so |

⚠️ **One judgement the gate deliberately does not make.** `camsSectionA` emits a
*seventh* Observation, re-coding the same `6-score` answer under LOINC 93374-7.
That is **not** declared, because SDC `$extract` yields one Observation per item
— an item with two codes produces one Observation with two codings, not two
resources. A second resource from one answer is mapper logic. That reasoning is
a comment in `EXPECTED`, not a rule the gate can enforce: it can check that
declarations and emissions agree, never that a declaration is the right one.

Five plants, each restored: a mapper's Questionnaire falling out of both lists;
an item losing its `observationExtract` (code drift); a file claimed
`NO_LITERAL_EXTRACTS` that declares some; a classification for a Questionnaire
nothing maps; and a registry shape change that would have made rule 3 vacuous.

### Still open

Nothing from this audit's findings.
