# SBQ-R — Suicide Behaviors Questionnaire-Revised

## Provenance

A 4-item self-report measure in which each item taps a different dimension of
suicidality — lifetime ideation and attempts, ideation frequency over the past
twelve months, threat of an attempt, and self-reported likelihood of future
suicidal behavior — giving a broad range of risk information in a very brief
administration.

| | |
|---|---|
| **Authors** | Osman A, Bagge CL, Gutierrez PM, Konick LC, Kopper BA, Barrios FX |
| **Reference** | Osman A, et al. *The Suicidal Behaviors Questionnaire-Revised (SBQ-R): Validation with clinical and nonclinical samples.* Assessment. 2001;8(4):443–454. |
| **Licensing** | ⚠️ **UNKNOWN, and not free reuse.** The Questionnaire carries the notice *"© Osman et al (1999) Revised. Permission for use granted by A. Osman, MD."* That establishes the instrument is copyrighted and that a permission exists — it does **not** say what an adopting system must do, to whom the permission was granted, or whether it transfers. **No licensing-audit memo is on file** under [#64](https://github.com/SPiER-Project/adoption-guide/issues/64), and there is no `licensing/` folder here. Confirm terms with the author before deployment. The full reasoning is on the `AdministerSBQR` ActivityDefinition's `copyright`. |

## What's in this folder

| File | What it is |
|---|---|
| `sbqr-questionnaire.json` | The FHIR R4 Questionnaire. Point weights are on each `answerOption` as an `ordinalValue` extension and the total is an SDC `calculatedExpression`, so the scoring is executable rather than described |

Everything else is in [`ig/input/fsh/sbqr.fsh`](../../ig/input/fsh/sbqr.fsh): the
`SPiERSBQRTotalScore` profile — whose description carries the 3–18 range and both
published cutoffs — the `AdministerSBQR` ActivityDefinition with its stage
membership and licensing, and the examples.

## Informational — not stated by any artifact

**Two responses can score the same.** On items 1 and 3, distinct answer options
carry identical `ordinalValue`s (both "at one time" options on item 3 score 2,
for instance). A consumer that infers the response from the score will be wrong;
read the coded answer.

**The published validation figures.** The cutoffs live on the profile; their
discrimination statistics do not.

| Population | Cutoff | Sensitivity | Specificity | AUC |
|---|---|---|---|---|
| General population | ≥ 7 | 93% | 95% | 0.96 |
| Psychiatric inpatients | ≥ 8 | 80% | 91% | 0.89 |
