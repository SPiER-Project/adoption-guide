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
| `phq9-questionnaire.json` | The FHIR R4 Questionnaire — LOINC panel `44249-1`, per-item LOINC codes, standard LOINC answer codes (`LA6568-5`–`LA6571-9`) with point values as `ordinalValue` extensions, an SDC `calculatedExpression` total, and the functional-difficulty item (`69722-7`) |

The PHQ-9 is the one instrument here whose item and answer codes are **fully
published LOINC**, so nothing is SPiER-local and no item table is restated in
this file — read the Questionnaire.

Everything else is in [`ig/input/fsh/phq9.fsh`](../../ig/input/fsh/phq9.fsh): the
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
