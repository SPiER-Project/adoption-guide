# PHQ-9 — Patient Health Questionnaire-9

## Provenance

A 9-item depression screener scored 0–27, and the most widely used depression
screening tool in primary care. In SPiER it matters for a second reason: **item
9** is the canonical suicide-risk trigger, and in many EHR workflows it is the
gateway through which a patient at risk is first identified at all.

| | |
|---|---|
| **Developers** | Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues |
| **Funding** | Developed with an educational grant from Pfizer Inc. |
| **Licensing** | The Questionnaire records *"No permission required to reproduce, translate, display or distribute."* ⚠️ **No licensing-audit memo is on file** under [#64](https://github.com/SPiER-Project/adoption-guide/issues/64), and there is no `licensing/` folder here, so that notice has **not** been verified against the publisher's current terms. The status and this caveat are both on the `AdministerPHQ9` ActivityDefinition. |

## What's in this folder

| File | What it is |
|---|---|
| `phq9-questionnaire.json` | The FHIR R4 Questionnaire — LOINC panel `44249-1`, per-item LOINC codes with LOINC's own displays, standard LOINC answer codes (`LA6568-5`–`LA6571-9`) with point values as `ordinalValue` extensions, an SDC `calculatedExpression` total, and the functional-difficulty item (`69722-7`) |

The PHQ-9 is the one instrument here whose item and answer codes are **fully
published LOINC**, so nothing is SPiER-local and no item table is restated in
this file — read the Questionnaire.

⚠️ **`item.code[].display` is LOINC's string and `item.text` is the patient-facing
wording; they differ on every item and that is correct.** LOINC's display for q9
is *"Thoughts that you would be better off dead, or of hurting yourself in some
way in last 2 weeks [Reported.PHQ]"*; the form asks *"Thoughts that you would be
better off dead or of hurting yourself in some way?"*. Do not reconcile them.
The nine item codes carried **no** display at all until 2026-09-08 — legal, but it
meant nothing could check them, since there was nothing to compare. They now
match `tx.fhir.org` and the data dictionary, which had carried them all along.
`bash scripts/loinc-audit/loinc-audit.sh . PHQ-9` re-checks them against
Regenstrief.

## Derived from US Core's PHQ-9 — not adopted from it

The Questionnaire's `derivedFrom` points at the PHQ-9 that US Core STU9
publishes: `http://hl7.org/fhir/us/core/Questionnaire/phq-9-example|9.0.0`. The
relationship is *derived from*, not *adopted*: HL7 publishes **no normative**
PHQ-9 — US Core's is an experimental, informative example of the SDC base
Questionnaire profile — so "SPiER uses HL7's PHQ-9" would overstate it.

⚠️ **The `|9.0.0` must match the US Core version in `ig/sushi-config.yaml`.**
`derivedFrom` is a canonical the IG Publisher must resolve, and an unresolvable
one is a QA **error**, which cannot be suppressed. US Core 6.1.0 carried the
same example at version 6.1.0, and the publisher would not resolve a `|9.0.0`
reference against it; the line landed together with the move to 9.0.0. Moving
US Core again means moving this pin in the same change. Only the publisher
checks it: `validate-fhir.mjs` passed the mismatched line.

⚠️ **The derivation type is `inspiredBy`, and must stay that unless the linkIds
change.** The `questionnaire-derivationType` extension on `derivedFrom` says
how strong the relationship is. `extends` and `compliesWith` both promise that a
response to this form is also valid against US Core's, and none is: the linkIds
differ, so no SPiER response answers a single US Core item. Declaring either
would ask the IG Publisher to check the derivation, and that check would fail on
the linkIds. With no type at all, the publisher warns that it did not check.

The two forms already agree on everything interoperable: panel `44249-1`, the
nine item codes, the `LA6568-5`–`LA6571-9` answers with the same `ordinalValue`
weights, and the `69722-7` difficulty item. Adopting the US Core form wholesale
would gain no coded interoperability and would cost three things:

- **No computed total.** US Core's has no `calculatedExpression` and no
  `observationExtract`, and types the total `decimal` rather than `integer`.
- **Item 9 is optional there** (`required: false`) while items 1–8 are required.
  Item 9 is SPiER's trigger into Clarify Risk; an optional item 9 inverts the
  thing the pathway depends on.
- **Different linkIds** (`/44250-9`, not `q1`), which the mappers, the
  reader gates and the scenario fixtures all key on.

A response authored against the US Core form still lands: the fallback dispatch
recognizes an instrument by its **item codes**, not its linkIds.

Everything else is in [`ig/input/fsh/phq9.fsh`](../../../ig/input/fsh/phq9.fsh): the
`SPiERPHQ9TotalScore` profile (whose description carries the five severity
tiers), the discrete `SPiERPHQ9Item9` profile, the `AdministerPHQ9`
ActivityDefinition, and the examples.

## Item 9 is the trigger

Any item-9 value above 0 advances the patient to Clarify Risk. That is stated on
the item-9 profile and on the ActivityDefinition's `purpose`, and it is wired as
a trigger on the Clarify Risk stage PlanDefinition — which is why item 9 gets its
own discrete Observation rather than being left inside the total.

## Informational — not stated by any artifact

The published scoring guide pairs each severity tier with a proposed action. The
tiers themselves are on the total-score profile; these actions are not on any
artifact, are depression-treatment guidance rather than suicide-safer-care
guidance, and should be reconciled with local protocol before use.

| Score | Severity | Proposed action |
|---|---|---|
| 0–4 | Minimal | None |
| 5–9 | Mild | Watchful waiting; repeat at follow-up |
| 10–14 | Moderate | Treatment plan; counseling or pharmacotherapy |
| 15–19 | Moderately severe | Active treatment with pharmacotherapy and/or psychotherapy |
| 20–27 | Severe | Immediate initiation of pharmacotherapy; on severe impairment or poor response, refer to a mental-health specialist |
