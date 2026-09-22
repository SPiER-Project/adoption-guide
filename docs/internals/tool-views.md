# The tool views: 29 fillers and recorders, and what holds them apart

`packages/tool-views/src/data/toolViews.tsx` is the whole entry surface — every instrument a
clinician fills in and every workflow step they record, one element per tool
slug, rendered by both the clinician's `/patient/*` routes and the guide's
tool pages (`/guide/tools/TL-0NN`, which resolve a tool's launch-path slug
against the map; `apps/guide/src/data/toolForms.ts`).

Written 2026-09-17, after the clean-clinical-surface work
([`docs/plans/archive/production-clinical-surface.md`](../plans/archive/production-clinical-surface.md))
surfaced two things worth an audit rather than a fix: the inventory of "what
renders FHIR" could not be built mechanically, and the 29 views were
heterogeneous in a way nobody had checked was intentional.

Three questions, answered in order:

- **§2** — which of the bespoke recorders have a load-bearing reason, and which
  were accumulated.
- **§3** — whether the `JSON.stringify` hole is worth a gate, and what the gate
  that now exists cannot see.
- **§5** — whether a view can be derived from the catalog instead of written.
- **§6** — the fillers' own two beats, added 2026-09-22: a computed item is hidden
  in the artifact, and submit stopped meaning save.

**§4 was the one open decision.** Brad settled it the same day — the recorder
describes the act — so it is now a rule with a gate rather than a question.

---

## 1. The inventory

29 views. **18 instrument fillers**, all `QuestionnaireView`; **11 workflow
recorders**, of which 2 are the generic `WorkflowActionView` and 9 are bespoke.

| Slug | View | Writes |
|---|---|---|
| `phq-9` `asq` `bssa` `pss-3` `pss-full` `safe-t` `sbq-r` `cssrs-screener` `cssrs-full` `cssrs-since-last-contact` `cssrs-pediatric` `cams-section-a` `cams-section-b` `cams-outcome-disposition` | `QuestionnaireView` | QuestionnaireResponse (+ Observations via the mappers) |
| `cams-stabilization-plan` `cams-therapeutic-worksheet` `crisis-response-plan` `stanley-and-brown` | `QuestionnaireView` + `carePlanMapper` | …and a CarePlan |
| `transition` (TL-009) `crisis-resources` (TL-013) | `WorkflowActionView` | a stage-tagged Communication |
| `caring-contact` (TL-010) | `CaringContactView` | Communication on `SPiERCaringContact`, + opt-out extension |
| `outreach` (TL-033/035) | `OutreachAttemptView` | Communication + outcome (1..1) / prompt / safety-concern extensions |
| `referral` (TL-017) | `SafetyReferralView` | ServiceRequest, advanced in place |
| `discharge-packet` (TL-030) | `DischargePacketView` | DocumentReference, gated by the sharing consent |
| `follow-up-appointment` (TL-031/034) | `FollowUpAppointmentView` | Appointment, advanced in place |
| `sharing-consent` (TL-032) | `SharingConsentView` | Consent with permit/deny provisions |
| `risk-episode` (TL-038) | `RiskEpisodeView` | EpisodeOfCare **and** Flag, as one act |
| `safety-tasks` (TL-036/039/040/041) | `SafetyTaskView` | Task, `Task.code` says which of the four |
| `lethal-means` (TL-008) | `LethalMeansCounselingView` | Procedure **and** one Observation per means |

Note the last column. **Nine distinct resource types across eleven recorders**
is not accumulated variety — it is the shape of Stages 4–7, and it is most of
the answer to §2 and all of the answer to §5.

---

## 2. Bespoke, or merely old?

The question for each: would `WorkflowActionView` plus a profile or extension
parameter cover it?

### Nine are load-bearing, and eight of the nine for the same reason

`WorkflowActionView` writes **one `Communication`**. Six of the nine bespoke
recorders write something else entirely — ServiceRequest, DocumentReference,
Appointment, Consent, Task, Procedure — and two of those six write *two*
resources in one submit (`risk-episode` → EpisodeOfCare + Flag;
`lethal-means` → Procedure + 1..n Observations). Parameterising a
Communication recorder into any of them is not a parameter; it is a different
component with the same name.

Three of them additionally do something no generic recorder has a shape for:

- **`referral`** advances a resource **in place** — same id, upserted by the
  store — because the SSC scores TL-017 on tracking a referral past *sent*
  through to accepted or completed. `Communication` records that something was
  sent and cannot answer that at all. `follow-up-appointment` does the same for
  `Appointment.status`, which is also why TL-034 mints no resource of its own.
- **`discharge-packet`** reads the TL-032 sharing consent *before* asserting
  what the packet carries, and records each exclusion with its basis. It is the
  only screen in SPiER where a recorded preference **changes** an artifact
  rather than sitting beside it (#227).
- **`risk-episode`** is modal by construction — "open" only when nothing is
  open — so the one-open-episode rule is structural rather than a validation
  message, and its `positive-screen` entry enforces a profile invariant (#263)
  by disabling submit until the evidencing artifact is named.

The two remaining Communication writers are the interesting cases, because a
generic recorder *could* emit their resource type — and both were on the
generic recorder once, and both were measurably wrong there:

- **`caring-contact`** was `WorkflowActionView`. It stamped neither the
  `SPiERCaringContact` profile nor the opt-out extension, so
  `SPiERCaringContactAdherence` could not see its output and the measure's
  `denominator-exclusion` could never fire (#211) — an adherence measure that
  scores a site *down* for honouring a patient's request to stop being
  contacted. ⚠️ **This is the demonstration that "it is only a Communication"
  is not sufficient grounds to merge a recorder.**
- **`outreach`** carries a **1..1** outcome extension, because
  `Communication.status` says a message was sent and never whether anyone
  answered. A recorder whose outcome is optional produces attempts that are not
  useful data, and "safety concern identified" is a separate axis from the
  outcome rather than another outcome code.

### One was accumulated: `StanleyBrownView` — **merged in this commit**

`StanleyBrownView` was a fork of `QuestionnaireView` with no divergence anyone
could name, and it had drifted out of four things the shared view grew after
the fork:

1. no `stampLaunchStage` — the `?tool=` launch-stage stamp;
2. no `mapResponseToObservations`, so no post-submit risk summary;
3. no writeback-ladder panel in the code drawer;
4. it created a CarePlan unconditionally, ignoring `GeneratedCarePlan.isEmpty`,
   so a blank submit wrote an empty safety plan to the chart.

It also **imported the Questionnaire JSON straight out of `ig/input/resources/questionnaires/`** —
the one instrument of eighteen to bypass `packages/core/src/data/questionnaires.ts`,
whose header calls itself "the single owner of the hand-authored Questionnaire
JSON imports". That claim was true of seventeen. The consequence was that
Stanley-Brown was absent from `QUESTIONNAIRE_BY_URL`; nothing read the gap,
because it has no ordinal-scored answers, but the registry was quietly
incomplete.

⚠️ **What was checked before merging, and is the checklist for the next one.**
A near-copy is only safe to merge once its *differences* are accounted for, not
once it *looks* similar:

- The care-plan mapper matches the prop's signature exactly
  (`generateCarePlan(qr) => GeneratedCarePlan`).
- There is **no** Stanley-Brown observation mapper, so (2) changes nothing
  today — it is a capability gained, not a behaviour changed.
- The canonical-URL stamp is **not** a difference: `@formbox/renderer` already
  sets `QuestionnaireResponse.questionnaire` from `questionnaire.url` when it
  builds the snapshot, which is why `QuestionnaireView`'s stamp is guarded by
  `!base.questionnaire`. Reading the shared view's code alone suggests the fork
  was dropping provenance. It was not; the renderer was doing it.

What did change: (4) is now honoured, so a blank Stanley-Brown submit no longer
writes an empty CarePlan.

### The two generic recorders are correct as they are

`transition` (TL-009) and `crisis-resources` (TL-013) each record that a
Communication happened, with a stage tag and free text. Neither has a profile,
an extension, a lifecycle or a second resource. That is what
`WorkflowActionView` is for, and two callers is enough to keep it.

---

## 3. The `JSON.stringify` hole: gated, at `npm run check:fhir-render`

**Worth building — but not in the shape the question implies.**

The invariant is `packages/tool-views/src/context/InspectContext.ts`: inspection on inside
`/guide`, off everywhere else. `FhirJsonViewer` and `CodeDrawer` self-gate, so a
new call site gets the clinician's answer by default. The hole was
`CarePlanDisplay`, which renders its own `<pre>{JSON.stringify(carePlan.resource)}</pre>`
plus a JSON download and went through neither.

⚠️ **The real defect was the inventory method, not the missing gate.** The list
in the plan doc was built from `FhirJsonViewer`'s call sites, so a component
that did not call it could not appear on a list of components that call it. Any
fix that leaves the list hand-written has the same hole. So the gate derives it.

### Why the rule is file-local and the reachability version does not work

The sketch — walk the non-guide routes transitively, as `check:guide-boundary`
walks the guide's, and fail on a dump in anything reachable without a
`useInspect()` — **cannot be made to work**, and the reason is the same one that
made `InspectContext` a context instead of a prop. `QuestionnaireView`,
`WorkflowForm`, `CarePlanDisplay` and `FhirJsonViewer` itself are **one
implementation each**, reached from `/patient/assessments/*` and from the
guide's tool pages alike. A walk from the clinician's routes reaches all
four, including the leaf whose entire job is the dump. The audience is a
property of the render, not of the module graph.

What is checkable per file is whether the file **asked**. So: a non-test `.tsx`
under `web/src` that calls `JSON.stringify` or renders a `<pre>` must call
`useInspect()`, or carry an entry in `NOT_A_RESOURCE_VIEW` saying why it is not
a resource view. Three entries today, each a sentence:
`ToolConfigProvider` (serializes a settings object *into* localStorage),
`PathwayView` (the `<pre>` holds an error string), `CdsServiceGuide` (a guide
page; the `<pre>` blocks are curl invocations).

### Proved by planting, including the blind spot

Four plants, each run and reverted:

| Planted | Result |
|---|---|
| a new component dumps a resource, no `useInspect` | ✗ named the file and both patterns |
| `CarePlanDisplay`'s hook call replaced by `const inspect = true` — the real 2026-09-17 defect | ✗ |
| the directory scan silently stops recursing (2 files, not 0) | ✗ on all three floors **and** on all three now-unresolvable allowlist paths |
| an allowlist entry repointed at a file that no longer matches | ✗ on the stale entry *and* on the file it stopped covering |

And one plant that **passed**, deliberately recorded rather than fixed:
disconnecting `CarePlanDisplay`'s three `inspect &&` guards while leaving the
`useInspect()` call. This is a "did you think about it" gate, not a proof that
the answer is used.

### What it cannot see

1. **Whether the guard guards** — above, proved.
2. **A dump assembled elsewhere.** A `.ts` helper returning pretty-printed JSON,
   rendered by a `.tsx` that never writes `JSON.stringify`. Only `.tsx` is
   scanned: a `.ts` cannot render, so scanning it would buy nothing for this
   invariant and would charge an allowlist entry for every
   `localStorage.setItem(k, JSON.stringify(v))`.
3. **A resource rendered without being serialized.** A table over
   `Object.entries(resource)`, a `<code>` holding a coding, a syntax
   highlighter fed a resource. All read as raw FHIR to a clinician; none match
   either pattern.
4. **An unguarded wrapper around `FhirJsonViewer`.** The leaf returns `null`
   on its own, so a call site that renders it bare is correct and needs no
   `useInspect()` — but a call site that wraps it in chrome leaves the chrome
   behind when the leaf disappears. `PatientDocuments`, `PatientPathway` and
   `CarePlanDisplay` each check for that reason. ⚠️ **This had a live instance
   until 2026-09-20: `ToolDetail` wrapped its examples in a `<section>` with an
   "FHIR Examples" heading and called nothing**, safe only because its one
   caller was the Tools page inside the guide layout (corrected in CLAUDE.md by
   #527, which is also where the "four self-gating call sites" claim was fixed
   to three). The accordion is gone; the tool page's "FHIR examples" drawer
   wraps the viewer the same way but PROVIDES `InspectContext` itself, in the
   same file, so the leaf cannot disappear under it. Neither RULE 1 nor RULE 2
   could see the old instance, and neither would see a new one: a wrapper
   neither serializes nor renders a `<pre>`. A rule for it would have to ask
   whether a `<FhirJsonViewer>` has a *sibling or ancestor inside the same
   conditional* — answerable with the RULE 3 parser, and not attempted here.
4. **Prose.** Which is §4.

---

## 4. Settled: the recorder describes the act, not the resource

The clean-surface work removed the JSON and left the words. `WorkflowForm`
renders its `lede` through `PageHeader` **unconditionally** — on
`/patient/workflow/*`, to a clinician, with no `useInspect()` anywhere near it —
and every one of the eleven recorders opened by naming its resource type:

> Records a **Communication** tagged to the **Track Follow-Up** stage.
> Records a **ServiceRequest** … trackable past *sent*.
> Records an **EpisodeOfCare** plus its **Flag** chart banner.
> Records a **DocumentReference** … the packet is a retrievable artifact.

Three went further into the wire format in field help a clinician reads *while
filling in the form*: `caring-contact-opt-out` and `episode-trigger` as
`<code>`, and the discharge packet's related-resource picker, which printed
`CarePlan/{id}` and `Observation/{id}` beside each checkbox. Elsewhere:
`Appointment.status`, `Task.code`, "a nested deny provision", "SNOMED codes this
as counseling", "the Stage-8 adherence measure excludes them from its
denominator", and a bare `TL-032`.

**This is the same class of thing as the JSON and it survived the sweep** — the
JSON was found by grepping for a *mechanism*, and prose has none.

### The decision (Brad, 2026-09-17) and the split it produced

**The recorder describes the act.** A resource type, a profile name, an
extension id or an `Element.path` may not appear in anything a clinician reads.

The implementer's half is not deleted, because the argument is worth keeping and
the guide's tool pages exist to show it — it moves to a new `fhirNote` prop on
`WorkflowForm`, rendered **inside the `CodeDrawer`**, which is already gated by
`useInspect()` along with the draft. So "a ServiceRequest, because `status`
models `draft → active → completed | revoked` natively and a Communication
cannot express that at all" now sits beside the ServiceRequest it is describing,
which is where it always belonged.

| | renders | audience |
|---|---|---|
| `lede` | `PageHeader`, always | the clinician: what this records, under which stage |
| `fhirNote` | `CodeDrawer`, gated | the implementer: what it writes, and why that shape |
| `draftTitle` + `draft` | `CodeDrawer`, gated | unchanged |

### The two beats around the form — settled 2026-09-21

The prose rule above is about the form. The clinical-app audit (§1.8, §4.6)
found the two moments either side of it saying the wrong thing, and both are
now the frame's, once.

⚠️ **Before a submit, the question is "is there a patient in CONTEXT", not "is
there an id in the URL".** `WorkflowForm` keyed its hint on `activePatientId`,
which is read off the route, so under a live launch — where the patient comes
from the launch context and the route carries no id — every recorder opened by
telling the clinician *"No patient selected — this will be recorded in the
scratch chart"* while `SmartDataSource` was correctly writing to that patient's
chart. There are three answers and the old code had two: a session with a
patient says nothing, a session with NO patient (a worklist launch, which has a
server and no chart) says the write has nowhere to land, and only the local
no-patient case is a scratch chart.

⚠️ **After a submit, there is ONE next action and it is the pathway's.** A
filler offered its mapper's `suggestedAction` and *View in chart* side by side;
a recorder offered *View in chart* and, on the risk episode, a second link. All
of it is `NextStep` now — the risk summary, then `evaluatePathway`'s primary for
the record as it stands, then *Back to chart*, which means the landing screen.
The mapper's suggestion is not deleted and is not rendered: it rides on the
`RiskAlert`, which is part of the record the evaluator reads, so it informs the
one answer instead of standing beside it.

Two things this cost, both worth knowing:

- **`NextStep` takes a `pending` record, and it is not a nicety.** A save is
  asynchronous and against a SMART server it is a round trip, while the beat
  renders the instant the submit lands. Evaluating the context's buckets alone
  answers from the chart as it was BEFORE the submit — so a clinician who has
  just completed the screen is told, for as long as the write takes, to
  complete the screen. Every recorder passes what it wrote
  (`useRecorderNotice`'s `report(notice, ...resources)` → `justRecorded`),
  including the eight whose output the protocol does not read today: which
  resource kinds it reads is the EVALUATOR's business and has moved once
  already.
- **A plant passed, and the suite is larger because of it.** Rewiring the beat
  to prefer `riskAlert.suggestedAction` — the exact defect this removes — left
  every assertion green, because the fixture was an empty chart and an empty
  chart carries no `RiskAlert` at all. A test for "A and not B" has to run where
  A and B disagree; `WorkflowForm.test.tsx` now builds a record where they do.

### And it *is* gated — `check:fhir-render` RULE 3

⚠️ **A text scan cannot do this one**, and shipping one that looked like it
could would be worse than nothing. `Appointment` is a resource type in
`<strong>Appointment</strong>`, an identifier in `AppointmentResource`, and a
reference prefix in `` `Appointment/${a.id}` `` — one token, three meanings, and
only the first is prose. So RULE 3 parses each recorder with **TypeScript's own
parser** and reads **JSXText nodes only**: what is rendered as words.
Identifiers, imports, template literals and string attributes are invisible to
it by construction, which is why `draftTitle="Live FHIR Communication"` needs no
exemption. The `fhirNote={…}` subtree is skipped whole.

⚠️ **A word list could not have caught the field help, so the tag is the rule
there.** `caring-contact-opt-out` is a kebab-case slug and nothing distinguishes
it from "no-show follow-up" or "care-gap" by spelling. What distinguishes it is
the *element*: a recorder reaching for `<code>` is quoting an identifier at
someone who has no identifier to be shown. So a recorder view may not render
`<code>` outside `fhirNote` — full stop, no word list involved.

Six plants, each run and reverted, and the first two are the **original text**
restored verbatim rather than a synthetic defect:

| Planted | Caught by |
|---|---|
| `SafetyReferralView`'s original lede | resource type — `ServiceRequest`, `Communication` |
| `CaringContactView`'s original opt-out help | the `<code>` rule |
| `Appointment.status` in a lede | resource type **and** element path |
| `SPiERRiskEpisode` in a lede | profile name |
| a resource type moved into the lede beside a correct `fhirNote` | resource type — the carve-out is the attribute, not the file |
| the `<WorkflowForm>` detection stops matching | throws: "it would now check nothing" |

### What RULE 3 still cannot see

- **A resource type it has not been taught.** The list is 15 names. A recorder
  writing an `AllergyIntolerance` would pass.
- **A recorder that is not one.** The view set is derived from "renders
  `<WorkflowForm>`", which is right today and is why the detection throws rather
  than passing when it matches nothing — but a recorder built on some other
  frame is outside the rule.
- **`QuestionnaireView` and the fillers.** They render no lede, so there is
  nothing to check; if one grows prose, RULE 3 will not be looking.
- **Jargon that is not FHIR.** "denominator", "SHALL", "TL-032" and "SNOMED
  codes this as counseling" were all fixed by hand in the same pass and none of
  them is gated. A reader who writes "excluded from the measure denominator"
  tomorrow gets a green build.

## 5. Deriving the view from the ActivityDefinition: **no**

The appeal is real — the AD already declares the tool's stage and, for the
fillers, its Questionnaire, and `Tool.questionnaireUrls` is genuinely derived
from `relatedArtifact` rather than retyped. Three findings say stop anyway.

### 5.1 `ActivityDefinition.kind` does not say what the recorder writes

It is bound to R4's **RequestResourceType**: it names the *request* an activity
is an instance of, not the resource its execution produces. In SPiER:

| Tool | `kind` | Actually writes |
|---|---|---|
| TL-008 lethal means | `ServiceRequest` | Procedure + 1..n Observations |
| TL-030 discharge packet | `ServiceRequest` | DocumentReference |
| TL-038 risk episode | `Task` | EpisodeOfCare + Flag |
| every instrument filler | `ServiceRequest` | QuestionnaireResponse |

`workflowTypeFromAD()` already reflects this honestly — it maps `default →
'questionnaire'`, which is to say *the kind did not tell us*. Deriving a view
from `kind` would derive the wrong one in at least three places, and the
resulting bug would be a recorder writing a conformant resource of the wrong
type.

### 5.2 Nothing declares the output profile — `ActivityDefinition.profile` is unused

There is no `* profile` on any of the 43 ADs. The output profiles
(`SPiERCaringContact`, `SPiERSafetyReferral`, `SPiERDischargeSafetyPacket`,
`SPiERLethalMeansCounseling`, …) exist and the recorders stamp them, but the
link from activity to output lives only in the AD's `description` **prose** and
in `tool-ui-metadata.ts`'s `recordingPattern.resources[].type`.

⚠️ **`recordingPattern` is hand-typed and ungated.** 36 entries state what each
tool writes, and no gate compares any of them to what the recorder writes. It is
the same shape as the licensing field before #127 — a clinical claim typed into
TypeScript with no link to the artifact it describes — and it is the thing here
most worth fixing.

### 5.3 The tool↔view relation is many-to-many, so a per-tool derivation cannot produce the map

```
4 tools → 1 view    TL-036 / 039 / 040 / 041  →  safety-tasks     (Task.code differentiates)
2 tools → 1 view    TL-031 / 034              →  follow-up-appointment
2 tools → 1 view    TL-033 / 035              →  outreach
1 tool  → 3 views   TL-020 (CAMS SSF-5)       →  cams-section-a / -b / -outcome-disposition
```

A derivation keyed on the tool produces four safety-task views or one CAMS view,
and both are wrong. The collapses are clinical judgements — *a no-show follow-up
IS an outreach attempt*, *TL-034 stores nothing TL-031 did not* — and the
expansion is the reverse one. Neither is recoverable from any field in the FSH.

### Recommendation

**Keep `toolViews.tsx` hand-written, and make `recordingPattern` honest
instead.** The map is 29 lines of intent and is already pinned both ways by
`toolViews.test.ts` and `check:catalog`'s launch-path resolution; there is no
drift for a derivation to prevent. The unguarded claim is one layer down.

Two candidates, in order:

1. **Add `* profile` to the workflow ADs** and derive `recordingPattern`'s
   resource type from it. This makes "TL-030 produces a
   `SPiERDischargeSafetyPacket`" a FHIR statement instead of a comment, and it
   is what `ActivityDefinition.profile` is for.
2. **Gate `recordingPattern.resources[].type` against the recorder** — the
   `resourceType` literals in the view's builder, the way `check:readers`
   compares a mapper's reads to the Questionnaire's declared item types. It
   cannot see a *wrong* description, only a wrong type, which is the half that
   matters.

Both are now unblocked: §4 is settled, and the `fhirNote` prop it produced is
where a derived resource type would be rendered.

---

## 6. The filler's own beats — settled 2026-09-22

§4's two beats are the RECORDERS'. The fillers had a third problem that neither
covers, and Brad named both halves of it on 2026-09-22.

### 6.1 A computed item is hidden in the ARTIFACT, not filtered in React

The C-SSRS Screener's *Suicide Risk Level* is derived from q1–q6 by
`observationMappers/cssrsScreener.ts` — no mapper reads the item, and no
clinician is asked for it. It nonetheless rendered as an empty radio group at
the bottom of the form, in the same typeface as the six items they answer, which
reads as a seventh question.

**The fix is the standard R4 `questionnaire-hidden` extension in
`ig/input/resources/questionnaires/`**, and the reason it is not a filter in
`QuestionnaireView` is the one that decides most questions in this repo: the
Questionnaire is what SPiER *publishes*. A React filter hides the item in
SPiER's own filler and nowhere else, so an EHR rendering the same artifact would
still put the empty radio group in front of its clinicians. `@formbox/renderer`
honours the extension (`hidden` on the item store; verified in the browser
2026-09-22).

⚠️ **Hidden is not absent from the response, and that distinction is
load-bearing.** formbox gates the response snapshot on `enableWhen` alone
(`buildItemSnapshot`), never on hidden — so the PHQ-9 and SBQ-R totals still
compute from their `calculatedExpression` and still land in the
QuestionnaireResponse, which is what keeps their declared `observationExtract`
contract true. Measured rather than assumed: nine PHQ-9 items at *Nearly every
day* produced `total-score: 27` in the live response with the item rendering
nowhere.

**The class, not the list.** The rule is derived both ways in
`tests/questionnaireComputedItems.test.ts`: every `readOnly` item in every
hand-authored Questionnaire is hidden, and nothing hidden is answerable. Five
items today — three C-SSRS risk levels and the two totals. The two `risk-level`
items that are **not** hidden are the distinction the rule turns on: SAFE-T's
and the full PSS's are `tier-derivation: clinician-assigned`, which is the
clinician's own formulation and the point of those instruments.

### 6.2 Submit stopped meaning save

The form wrote on submit and rendered its summary *under* the still-filled form,
so there was no moment between completing a suicide-risk instrument and it being
in the patient's chart. The flow is now three phases in `QuestionnaireView`:
fill in → **Submit** → a screen carrying the results and the recommendation →
**Save to the chart**, or start the form again.

⚠️ **The writeback ladder did not move.** `addResponse` still runs the whole of
it in the order it always has — QuestionnaireResponse first so the
server-assigned id can be remapped into what references it, then the derived
Observations ([`../plans/smart-filler-writeback-ladder.md`](../plans/smart-filler-writeback-ladder.md)).
Only the *trigger* changed: a button the clinician presses rather than the
renderer's submit. Everything the review screen shows is computed by pure
functions over the submitted response — `mapResponseToObservations` and the
instrument's `carePlanMapper` — which is what makes a review step possible
without touching the chart at all.

⚠️ **The review screen offers no way off itself but its two buttons**, and that
is why `NextStep` grew `preview`. The response exists only in component state
until the save, so a link out of that screen discards a completed suicide-risk
instrument silently. The recommendation still renders — same sentence, same
`evaluatePathway` over the record with the submit folded in — without the button
that leaves.

⚠️ **The one real defect this uncovered, found in the browser and not by any
gate: the 18 fillers are ONE component instance.** `TOOL_VIEWS` holds one
`<QuestionnaireView>` element per slug and both apps render them from the same
position in the tree, so walking from the PHQ-9's page to the C-SSRS's changes
`questionnaireUrl` and keeps every piece of state. The form body was always fine
— formbox rebuilds from the `questionnaire` prop — so the old code's version of
this was a stale summary under a correct form, mild enough that nobody saw it.
With the results *replacing* the form it became the previous instrument's
results under the new instrument's name, with no form in sight.
`QuestionnaireView` resets on the prop change during render, and
`QuestionnaireView.test.tsx` pins it by rerendering with a different instrument.

### 6.3 What the tests can and cannot see

Seven cases in `QuestionnaireView.test.tsx`, every one verified against a
planted defect (submit writes again; `NextStep` ignores `preview`; the results
render beside the form instead of replacing it; *Start over* does not leave the
review screen; the instrument-change reset removed) plus two over the artifact
rule (the C-SSRS hidden extension removed; a clinician-assigned tier hidden).

⚠️ **`@formbox/renderer` does not load under vitest** — its bundle imports a
`fhirpath/fhir-context/r4` DIRECTORY, which Node's ESM resolver refuses — so
every one of those cases runs against a mock. What that mock cannot see is
anything about the real renderer: that it honours `questionnaire-hidden`, that a
`calculatedExpression` still fires for a hidden item, and that its store is
rebuilt rather than reset. All three were checked in the browser instead, and
all three are the kind of thing that changes on a vendor upgrade with the suite
still green.

⚠️ **The mock reports its mount**, deliberately. "A blank form" is not a
property of any DOM the test can read — the answers live in formbox's store — so
it is asserted as "a different instance", which a stateless stub would have
passed for free.

---

## Where the rules live

| Thing | File |
|---|---|
| the map, and why it is one definition | `packages/tool-views/src/data/toolViews.tsx` |
| the inspection invariant | `packages/tool-views/src/context/InspectContext.ts` |
| the gate, its allowlist and its blind spots | `scripts/check-fhir-render.mjs`, [`web-gates.md`](web-gates.md) |
| the recorder frame every view shares | `packages/tool-views/src/components/WorkflowForm.tsx` |
| the confirmation beat both fillers and recorders end on | `packages/tool-views/src/components/NextStep.tsx` |
| which chart a submit lands in, for fillers and recorders alike | `packages/tool-views/src/components/PatientChartHint.tsx` |
| a filler's fill → review → save phases | `packages/tool-views/src/components/QuestionnaireView.tsx` |
| every computed item is hidden in the published artifact | `tests/questionnaireComputedItems.test.ts` |
| a recorder's success sentence + what it wrote, as one state | `packages/tool-views/src/lib/useRecorderNotice.ts` |
| tool → launch path | `packages/core/src/data/catalog/tool-ui-metadata.ts` |
| tool → stage, Questionnaire, licensing | `ig/input/fsh/` (derived in `tools.ts`) |


## Notes moved from `CLAUDE.md` (2026-09-20)

The one-definition rule, the fourth axis and the sibling route are stated with
the other surface rules in [`surfaces-and-routing.md`](surfaces-and-routing.md)
§ *The clinician-facing app shows no raw FHIR*. Two recorder rules that
`CLAUDE.md` carried inline:

⚠️ **"It is only a Communication" is not grounds to merge a recorder** —
`caring-contact` WAS the generic recorder, and stamped neither its profile nor
the opt-out extension, so a Stage-8 measure's exclusion could never fire (§2
above has the full account).

⚠️ **The prose is part of "no raw FHIR".** Settled 2026-09-17: a recorder's
`lede`, labels and help describe the act — no resource type, profile name,
extension id or `Element.path`, and no `<code>` at all. The wire format goes in
`WorkflowForm`'s `fhirNote`, which renders inside the `useInspect()`-gated
`CodeDrawer`. `check:fhir-render` RULE 3 parses the JSX text to enforce it (§4).
