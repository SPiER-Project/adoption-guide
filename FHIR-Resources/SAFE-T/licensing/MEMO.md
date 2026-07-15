# SAFE-T — Licensing Audit Memo

> **Status:** Public resource of SAMHSA. Distributed free; no permission or fee is required to publish the SPiER FHIR derivatives. This memo records the basis for that conclusion. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Suicide Assessment Five-Step Evaluation and Triage (SAFE-T)
**Short name / abbreviation:** SAFE-T
**SPiER tool ID:** TL-006
**SPiER pathway stage(s):** define-risk-picture (Stage 3 — Define the Risk Picture)
**Repository location:** `FHIR-Resources/SAFE-T/`
**Tracking issue:** TL-006 roadmap epic (see `web/src/data/roadmap.generated.json`)

## Instrument provenance

**Original author(s) / authoring institution:** Developed by Douglas Jacobs, MD, in collaboration with Screening for Mental Health, Inc.; published and distributed by the Substance Abuse and Mental Health Services Administration (SAMHSA).
**Year of original publication:** SAFE-T pocket card first released c. 2009; current SAMHSA edition PEP24-01-036 (2024).
**Canonical citation:** SAMHSA. *SAFE-T: Suicide Assessment Five-Step Evaluation and Triage for Clinicians* (Pocket Card, PEP24-01-036).
**Primary distribution source today:** [SAMHSA SAFE-T pocket card page](https://www.samhsa.gov/resource/dbhis/safe-t-pocket-card-suicide-assessment-five-step-evaluation-triage-safe-t-clinicians) and the SAMHSA Library (free downloadable flyer/card).

## Licensing status

**Underlying instrument license:** Open / no fee required. The SAFE-T pocket card is a free public resource distributed by SAMHSA (a U.S. federal agency) for clinician use. No use fee or per-distribution license applies.
**Source of license claim:** SAMHSA's free public distribution of the SAFE-T pocket card and flyer with no stated fee or permission requirement. The verbatim card content used here is transcribed from the SAMHSA SAFE-T flyer (PEP24-01-036).
**License text on file:** Not separately distributed — SAMHSA publishes the materials openly rather than under a discrete license file.

## Sign-off status

**Sign-off required to publish FHIR derivatives:** No, per the free public distribution.
**Contact for sign-off:** N/A (not required).
**Date sign-off requested:** Not applicable.
**Date sign-off received:** Not applicable.
**Sign-off artifact on file:** Not applicable.

## Conditions on redistribution

**Attribution required?** Not strictly required, but SPiER attributes SAFE-T to SAMHSA (and its authors) as a courtesy and for provenance (see `Questionnaire.copyright` and the FSH header).
**Modifications permitted?** SAFE-T is a clinician guide; the SPiER FHIR Questionnaire reproduces the five steps, the risk-factor / protective-factor lists, the suicide-inquiry prompts, and the three risk-level tiers with their described suicidality and interventions. The card itself notes its risk-level/intervention chart is "an example of a range of risk levels and interventions, not actual determinations."
**Commercial use permitted?** Yes (free public resource; no stated restriction).
**Other constraints:** Should be used as a whole clinical formulation (all five steps) rather than excerpted; the SPiER encoding preserves the full five-step structure and the documentation step.

## FHIR artifact metadata reflection

- `Questionnaire.copyright`: "The SAFE-T (Suicide Assessment Five-Step Evaluation and Triage) pocket card is a public resource of the Substance Abuse and Mental Health Services Administration (SAMHSA), developed with Screening for Mental Health, Inc. and Douglas Jacobs, MD. Distributed free by SAMHSA; no permission or fee is required for use."
- `Questionnaire.useContext`: `focus` = SNOMED 225337009 (Suicide risk assessment); `venue` = Outpatient / ED / Hospital.
- IG page attribution block: not yet authored (no dedicated `ig/input/pagecontent/safet.md` in this PR); provenance is carried in the FSH header and this memo.
- FSH source attribution: `ig/input/fsh/safet.fsh` header documents SAMHSA provenance and free-use status; `AdministerSAFET.publisher = "SPiER (HTD Health)"`.

## Open questions

- Confirm the preferred canonical citation for the current SAMHSA SAFE-T edition (PEP24-01-036).
- Whether the risk-factor / protective-factor local CodeSystems should later bind to a standard vocabulary (e.g. SNOMED) where equivalents exist.
- Whether the SAFE-T result should be authored as a full `SPiERSuicideRiskConcept` (concept-layer) Observation rather than a SAFE-T-specific risk-level profile whose value already binds to the shared tier. (Current decision: SAFE-T-specific profile, value bound to `spier-suicide-risk-tier-vs`.)

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Created memo while encoding TL-006 SAFE-T. Free public-resource basis confirmed from SAMHSA distribution; card content transcribed verbatim from the SAMHSA SAFE-T flyer (PEP24-01-036). |
