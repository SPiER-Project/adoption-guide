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
`Observation.derivedFrom` and `Condition.evidence` to it. Reordering to match the
commit message would silently break provenance on every write — the references
would point at an id the server never issued.

Do not "correct" the code toward the commit message. If anything reads the other
way, it is wrong.

## The ladder

Climbing = a more capable EHR. Ordered here by tier; **execution** order is
1 → 2 → 3 → 0, because the floor's necessity depends on the discrete outcomes.

| Tier | Resource | Role | Default |
|---|---|---|---|
| 0 | `DocumentReference` | The universal floor: a readable HTML rendering **plus** the raw QR as base64 FHIR JSON, so discrete data is recoverable even where no discrete tier landed. | Conditional — fires when the discrete tiers did not all land cleanly, or on `alwaysWriteDocument` |
| 1 | `QuestionnaireResponse` | The discrete capture; SDC-canonical, most broadly supported, and the resource every higher rung references. | On, gated by capability |
| 2 | `Observation` | Scored + harmonized risk-tier Observations — the computable rung. | On, gated by capability |
| 3 | `Condition` | *Proposes* a problem-list entry, stamped `verificationStatus = unconfirmed`. | **OFF.** Opt-in, requires explicit human confirmation |

### Two decisions that are not implementation details

Both are from the original plan, recorded in #348, and should not be relitigated
as part of ordinary work:

1. **Browser-direct FHIR only.** PHI and tokens are never proxied through the
   Cloudflare Worker. SPiER's own infrastructure does not touch patient data on
   this path.
2. **Incomplete writeback is displayed deliberately**, as a site-readiness
   diagnostic feeding the adoption rubric. It is never hidden, and never retried
   into looking complete. A tier that did not land is the *useful* signal.

### Tier 3 governance, and where it is actually enforced

A screening score is an Observation; a problem-list Condition is a clinical
assertion that is patient-visible under information-blocking rules. So the app
only ever *proposes* one.

The guarantee is enforced in **`ladder.ts`**, not in the caller:
`buildWritePlan` omits the Tier-3 step entirely unless
`config.enableConditionProposal` is set *and* a proposal exists.
`SmartDataSource.saveResponse` also declines to build the proposal when the tier
is off, but that is an optimization — verified by planting a defect that removed
it, which changed no observable behavior because the ladder's own gate caught it.
Defense in depth, and worth knowing which layer is load-bearing.

`buildConditionProposal` returns `null` for a negative screen: SPiER does not
propose a problem for a patient who screened negative.

## Wiring (#350, this change)

The ladder sat on `main` from #348 with 28 passing tests and **zero callers**.

### The seam is `saveResponse`, not `saveArtifact`

Issue #350 points at `smartDataSource.ts:398`, which is `saveArtifact` — the path
for CarePlans, Flags, Tasks and lifecycle PUTs. That is the wrong method:
`saveArtifact` receives one bare resource and has no risk alert, which both
`buildDocumentReference` and `buildConditionProposal` require.

`saveResponse` is the seam. It already receives exactly the ladder's inputs —
the QR as `entry.resource`, and `DerivedArtifacts { observations, riskAlert }` —
and its old body was **already a hand-rolled Tier 1 + Tier 2**: create the QR,
capture the server id, remap `Observation.derivedFrom`. The ladder is a strict
generalization of that code, adding capability probing, the Tier-0 floor, the
Tier-3 proposal, and a record of what happened. So the wiring **replaced** that
body rather than being added beside it.

What the old body lacked, and why it mattered: a server that rejected
Observations lost that data with no trace. The floor now catches it.

### SMART-only, by design

`LocalDataSource` is untouched. Tier 0 and Tier 3 are meaningless against
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
`WritebackResult.steps` alone. Two rows have no step to render:

- **Tier 3 disabled** — omitted from the plan entirely, so "off by design" comes
  from the resolved config. This is why `WritebackReport` carries `config`.
- **Tier 2 with no Observations** — a property of the instrument (some tools
  produce a CarePlan), not a failure of the server, and it must not read as one.

## Review status

#348 shipped this library unreviewed, and said so: its tests were written by the
session that wrote the code, so green meant self-consistent, not correct (#327 is
the precedent — `cssrsScreener.test.ts` asserted C-SSRS items were plain booleans
and certified a mapper against input the app never produces).

Reviewed 2026-08-18 as part of #350. What was checked and **held**:

- the five risk-tier codes and displays in `conditionProposal.ts` match
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

## Still open

- **Live sandbox validation.** Nothing offline can test the capability probing or
  the Tier-0 fallback against a real server, and those are the parts most likely
  to be wrong. See [`../smart-sandbox-testing.md`](../smart-sandbox-testing.md).
- **CDS card `type: 'smart'` link.** `cdsHooks/types.ts` already declares it as
  *"unused by SPiER today"*; every card emits `type: 'absolute'`.
- **Adoption-pathways guide page** — the SMART app as the low-floor on-ramp,
  native EHR documents as the recommended end state.
- **Should the demo set `alwaysWriteDocument`?** Currently it does not, so an
  instrument with no Observations writes only a QuestionnaireResponse and no
  readable narrative. Many EHRs can *store* a QR while rendering nothing, which
  is exactly the case Tier 0 exists for. Deliberately left at the module's
  default rather than changed as a side effect of wiring — it is a policy call.
- **Tier-3 confirmation UI.** The config is injectable per-source, so opting in
  is wired; the human-confirmation step it requires is not built.

[#350]: https://github.com/SPiER-Project/adoption-guide/issues/350
