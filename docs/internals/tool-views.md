# The tool views: 29 fillers and recorders, and what holds them apart

`web/src/data/toolViews.tsx` is the whole entry surface — every instrument a
clinician fills in and every workflow step they record, one element per tool
slug, rendered by both the clinician's `/patient/*` routes and the guide's
`/guide/tools/:slug/try`.

Written 2026-09-17, after the clean-clinical-surface work
([`docs/plans/production-clinical-surface.md`](../plans/production-clinical-surface.md))
surfaced two things worth an audit rather than a fix: the inventory of "what
renders FHIR" could not be built mechanically, and the 29 views were
heterogeneous in a way nobody had checked was intentional.

Three questions, answered in order:

- **§2** — which of the bespoke recorders have a load-bearing reason, and which
  were accumulated.
- **§3** — whether the `JSON.stringify` hole is worth a gate, and what the gate
  that now exists cannot see.
- **§5** — whether a view can be derived from the catalog instead of written.

**§4 is the one open decision**, and it is Brad's, not a gate's.

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

It also **imported the Questionnaire JSON straight out of `FHIR-Resources/`** —
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

The invariant is `web/src/context/InspectContext.ts`: inspection on inside
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
implementation each**, reached from `/patient/assessments/*` and from
`/guide/tools/:slug/try` alike. A walk from the clinician's routes reaches all
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
4. **Prose.** Which is §4.

---

## 4. Open: the recorders name their FHIR resource type to the clinician

The clean-surface work removed the JSON. It did not touch the words, and
`WorkflowForm` renders its `lede` through `PageHeader` unconditionally — on
`/patient/workflow/*`, to a clinician, with no `useInspect()` anywhere near it.
Every one of the eleven recorders says some version of:

> Records a **Communication** tagged to the **Track Follow-Up** stage.
> Records a **ServiceRequest** … trackable past *sent*.
> Records an **EpisodeOfCare** plus its **Flag** chart banner.
> Records a **DocumentReference** … the packet is a retrievable artifact.

and three go further into the wire format in field help a clinician reads while
filling the form: `caring-contact-opt-out` and `episode-trigger` as
`<code>`, and the discharge packet's related-resource picker, which lists
`CarePlan/{id}` and `Observation/{id}` references beside each checkbox.

**This is the same class of thing as the JSON and it survived the sweep**, which
is worth stating plainly: the JSON was found by grepping for a *mechanism*, and
prose has no mechanism to grep for.

⚠️ **Deliberately not gated, and deliberately not changed.** Whether
"Records a Communication tagged to the Coordinate Handoffs stage" is a defect or
a deliberate part of SPiER's pitch is a product decision nobody has made — the
argument for keeping it is that a recorder whose whole point is *this workflow
step has a FHIR shape* may reasonably say so, and the pathway-stage half of
every sentence is clinician-facing regardless. A gate must not decide that. What
the next pass needs is Brad's answer to one question: **does the clinician's
recorder describe the act, or the resource?** If the act, the fix is eleven
ledes and three help strings, and it is mechanical.

---

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

Both are worth doing after §4 is decided, because §4 may rewrite the same
sentences.

---

## Where the rules live

| Thing | File |
|---|---|
| the map, and why it is one definition | `web/src/data/toolViews.tsx` |
| the inspection invariant | `web/src/context/InspectContext.ts` |
| the gate, its allowlist and its blind spots | `web/scripts/check-fhir-render.mjs`, [`web-gates.md`](web-gates.md) |
| the recorder frame every view shares | `web/src/components/WorkflowForm.tsx` |
| tool → launch path | `packages/core/src/data/catalog/tool-ui-metadata.ts` |
| tool → stage, Questionnaire, licensing | `ig/input/fsh/` (derived in `tools.ts`) |
