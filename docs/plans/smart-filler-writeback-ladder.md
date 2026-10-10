# The SMART Form-Filler writeback ladder

**Re-derived 2026-08-18** from the code, its tests, and PR #348's commit message,
for issue [#350]. The original of this file was written 2026-07-14, never
committed to any branch, and is not recoverable from any dangling commit — it
died with the worktree it was written in. Nothing below is quoted from it.

## ⚠️ The tier model in #348's commit message is the SUPERSEDED draft

This matters more than anything else in this document, because that commit
message has been the only surviving statement of the model, and issue #350
reproduced it faithfully. **Both have Tier 1 and Tier 2 the wrong way round.**

| | #348's message / #350 | The code (authoritative) |
|---|---|---|
| Tier 1 | Observation | **QuestionnaireResponse** |
| Tier 2 | QuestionnaireResponse | **Observation** |

The code states the swap explicitly and gives the reason — `types.ts`:

> *"NOTE the Tier 1/2 ordering: QuestionnaireResponse is the LOWER discrete rung
> (raw capture, easiest, SDC-canonical) and Observation is the HIGHER rung
> (derived extraction, harder, more computable). This is a deliberate swap from
> an earlier draft that had them reversed."*

`ladder.test.ts` pins it in a test named *"tier ordering & swap"*. So the code and
its tests agree, and the prose written *about* them is the outlier.

**This is not cosmetic.** QR-first is load-bearing: `execute.ts` writes the
QuestionnaireResponse first specifically to capture the server-assigned id, then
remaps the client-minted `QuestionnaireResponse/<id>` reference inside
`Observation.derivedFrom` to it. Reordering to match the
commit message would silently break provenance on every write — the references
would point at an id the server never issued.

Do not "correct" the code toward the commit message. If anything reads the other
way, it is wrong.

## The ladder

Climbing = a more capable EHR. Ordered here by tier; **execution** order is
1 → 2 (Observations, then Conditions) → 3 → 0, because the floor's necessity depends on the discrete outcomes.

| Tier | Resource | Role | Default |
|---|---|---|---|
| 0 | `DocumentReference` | The universal floor: a readable HTML rendering **plus** the raw QR as base64 FHIR JSON, so discrete data is recoverable even where no discrete tier landed. | Conditional — fires when the discrete tiers did not all land cleanly, when the form produced no scores (#638), or on `alwaysWriteDocument` |
| 1 | `QuestionnaireResponse` | The discrete capture; SDC-canonical, most broadly supported, and the resource every higher rung references. | On, gated by capability |
| 2 | `Observation` | Scored + harmonized risk-tier Observations — the computable rung. | On, gated by capability |
| 2 | `Condition` | The problems a form **records** — CAMS Section B's suicide drivers, which the published `AdministerCAMSSectionB` says are materialized as Conditions. A second Tier-2 step, only when there are any. | On (`enableRecordedConditions`), gated by the server's **Condition** capability |

There is **no Tier 3**. Until #639 the ladder had an opt-in, default-off
`Condition` *proposal* — a problem-list entry coded with the risk tier and stamped
`unconfirmed`, built from a screen's risk alert. It was retired on 2026-10-09
before its confirmation UI was ever built, because it contradicted a published
rule: **a screen never becomes a Condition**
([`../decisions/suicide-related-problem-set.md`](../decisions/suicide-related-problem-set.md)).
A problem-list entry is the clinician's assertion, from the SNOMED suicide-related
problem set; SPiER's part is the CDS problem-list card that prompts it. CAMS
Section B's driver Conditions are a different thing — clinician-recorded content
of the instrument — and have their own Tier-2 step (the `Condition` row above).

### The recorded Conditions have their own step

**Decided 2026-10-06.** A Tier-2 Condition is what the clinician wrote down in a
clinician-completed form, written only when they press *Save to the chart* — not
an inference from a screen, which is what retired Tier 3. Until that date the CAMS
drivers travelled in the mapper's `observations` array. The Observation step
POSTed them to `/Condition` on the strength of the server's *Observation*
capability, the scorecard counted them as Observations, and nothing read them
back. They now have their own slice bucket (`conditions`). `SmartDataSource`
reads them back, searched by the drivers' marker category so the EHR's wider
problem list stays out. A server without Condition create reports the step
`unsupported`, and the floor carries the drivers' text inside the embedded
QuestionnaireResponse. A form that records problems and no scores also gets the
readable copy, by the same rule as any form with no scores (#638).

### Two decisions that are not implementation details

Both are from the original plan, recorded in #348, and should not be relitigated
as part of ordinary work:

1. **Browser-direct FHIR only.** PHI and tokens are never proxied through the
   Cloudflare Worker. SPiER's own infrastructure does not touch patient data on
   this path.
2. **Incomplete writeback is displayed deliberately**, as a site-readiness
   diagnostic feeding the adoption rubric. It is never hidden, and never retried
   into looking complete. A tier that did not land is the *useful* signal.

### Governance: the ladder writes no Condition

The ladder cannot write a problem-list Condition: `WriteTier` is `0 | 1 | 2`,
`WritebackResourceType` has no `Condition`, and `WritebackArtifacts` has no slot
for one. `ladder.test.ts` and `smartDataSource.writeback.test.ts` pin that no
config and no elevated screen produce a Condition step, and the scorecard test
pins that no problem-list rung is offered. The retired Tier-3 design, and why,
is above the table.

## Wiring (#350, this change)

The ladder sat on `main` from #348 with 28 passing tests and **zero callers**.

### ⚠️ The trigger moved on 2026-09-22; the ladder did not

A filler used to run this on the renderer's submit. It now runs on **Save to the
chart**, a button on the results screen `QuestionnaireView` shows after a submit
(`docs/internals/tool-views.md` §6.2). Nothing below changed: `addResponse` is
still the one call, `saveResponse` is still the seam, and QR-first is still
QR-first. What changed is that the clinician decides, which is worth knowing if
you are reading a session's writeback report and wondering why a completed form
produced none — it produced none because nobody pressed the button.

### The seam is `saveResponse`, not `saveArtifact`

Issue #350 points at `smartDataSource.ts:398`, which is `saveArtifact` — the path
for CarePlans, Flags, Tasks and lifecycle PUTs. That is the wrong method:
`saveArtifact` receives one bare resource and has no risk alert, which
`buildDocumentReference` requires.

`saveResponse` is the seam. It already receives exactly the ladder's inputs —
the QR as `entry.resource`, and `DerivedArtifacts { observations, riskAlert }` —
and its old body was **already a hand-rolled Tier 1 + Tier 2**: create the QR,
capture the server id, remap `Observation.derivedFrom`. The ladder is a strict
generalization of that code, adding capability probing, the Tier-0 floor, and a
record of what happened. So the wiring **replaced** that
body rather than being added beside it.

What the old body lacked, and why it mattered: a server that rejected
Observations lost that data with no trace. The floor now catches it.

### SMART-only, by design

`LocalDataSource` is untouched. The Tier-0 floor is meaningless against
`localStorage`, and capability probing has nothing to probe.

### How the result reaches the UI

`FhirDataSource.saveResponse` returns `Promise<void>` for every source, and
widening that interface would push a SMART-only concern onto `LocalDataSource`
and every caller. Instead `SmartDataSource` holds the last `WritebackReport` and
exposes it as a getter; `PatientProvider` picks it up through the source's
existing `subscribe` notification and puts it on `PatientContext`.

### A failed writeback still fails the save

The ladder records step failures rather than throwing, so a *partial* writeback
degrades instead of erroring. But when **nothing** landed — not even the
universal floor — `saveResponse` throws, so it reaches PatientContext's
save-error surface. A total failure that appeared only in the scorecard would
read as a successful save.

### `capabilitiesKnown`

`fetchCapabilities` returns `{}` both when the probe *failed* and when the server
advertised nothing. That is fine for the ladder — either way it degrades to the
floor — but not for the scorecard, whose job is explaining why a tier did not
land. Reporting a failed probe as "this EHR does not support
QuestionnaireResponse" would be a false readiness claim, so `WritebackReport`
carries the distinction and the UI says *"could not ask"* instead.

## The scorecard

`components/WritebackScorecard.tsx`, rendered on the patient chart beside the
existing `dataSourceError` banner — both are SMART-session feedback, and a
degraded writeback is the case where there is no error to show but still
something the site needs to know.

It is built around explaining **absences**, which it cannot do from
`WritebackResult.steps` alone. One row can have no step to render:

- **Tier 2 with no Observations** — a property of the instrument (some tools
  produce a CarePlan), not a failure of the server, and it must not read as one.
- **Tier 2 Conditions** — the reverse case: the row is shown *only* when the form
  recorded a problem, because only CAMS Section B ever does. Rows are keyed by
  tier **and** resource type; keyed by tier alone, the two Tier-2 steps collided.

## Review status

#348 shipped this library unreviewed, and said so: its tests were written by the
session that wrote the code, so green meant self-consistent, not correct (#327 is
the precedent — `cssrsScreener.test.ts` asserted C-SSRS items were plain booleans
and certified a mapper against input the app never produces).

Reviewed 2026-08-18 as part of #350. What was checked and **held**:

- the five risk-tier codes and displays in `conditionProposal.ts` (retired since, #639) match
  `concept-layer.fsh` exactly, and `SPIER_RISK_TIER_SYSTEM` matches the
  `http://thespierproject.org/fhir` canonical. The hand-duplication CLAUDE.md warns about is
  currently correct.
- `capability.ts`'s defensive parsing is genuinely well covered.
- two suspected #327-shaped defects were **false alarms**: `answerText` reads
  `valueCoding` first, so coded yes/no answers render; and `valueText` is a
  pre-existing repo-wide convention in `types/fhir.ts`, not a writeback invention.

What was **found**: the tier-model inversion at the top of this document.

New tests avoid the #327 trap structurally —
`smartDataSource.writeback.test.ts` builds its QuestionnaireResponse with
`nativeQr` (which derives every `value[x]` from the Questionnaire JSON) and its
derived artifacts with `deriveFromResponse`, the same call `PatientProvider`
makes. Nothing hand-writes a resource shape. Both new suites were verified to
**fail** against planted defects before being trusted.

## Closed since

- **Live validation against a server we did not write** (#640). Run on
  2026-10-09 against the SMART Health IT R4 sandbox (Smile CDR): launch, reads,
  capability probe, server-id remapping and every discrete rung held. It found
  three defects the mock could not show — the chart missing a save while the
  server's search index lagged, responses stored `in-progress`, and a scorecard
  headline counting a not-needed readable copy as unsaved — all fixed in the same
  change. Results and the corrected launch steps:
  [`../smart-sandbox-testing.md`](../smart-sandbox-testing.md). A refusal of one
  rung can still only be exercised against the mock's capability profiles; the
  public sandbox accepts everything.

- **CDS card `type: 'smart'` link** (#375). When the service is configured with
  a SMART launch URL, `cardLink()` in `packages/core/src/lib/cdsHooks/cards.ts`
  emits a `type: 'smart'` link whose `appContext` carries the tool as an
  `intent`. The standalone CDS Worker always is, since it requires
  `SMART_LAUNCH_URL`. `type: 'absolute'` is left only for the in-app cards,
  where SPiER itself follows the link.

- **Adoption-pathways guide page** (#637, PR #645) — `/guide/provider-app/saving-to-the-ehr`:
  the SMART app as the low-floor on-ramp, native EHR documents as the
  recommended end state.
- **When the readable copy is written** (#638, decided 2026-10-09 — the middle
  of three options). The floor now also fires for **any save that derives no
  Observation**, even when the form itself landed. The gap it closes: many EHRs
  *store* a QuestionnaireResponse and render nothing, so a form with no scores —
  a safety plan, a recorder's form — reached the chart as nothing a clinician
  could read; the live sandbox run left a Stanley-Brown plan exactly like that.
  A form WITH scores still skips the copy when everything landed, because the
  EHR shows its results. The two options not taken: `alwaysWriteDocument` on
  for every save (simplest, but a duplicate document beside data the EHR
  already displays), and leaving it fallback-only. The rule is derived from the
  save, not a list of instruments, so a new form needs no entry;
  `alwaysWriteDocument` remains for a site that wants a copy of everything.

## Still open

Nothing. Every item #350 listed is closed.

[#350]: https://github.com/SPiER-Project/adoption-guide/issues/350
