# CARS / CARS-S — Licensing Audit Memo (audit-first, NO artifacts yet)

> **Status: NO-GO for FHIR artifact authoring — permission not confirmed.** This is the Wave 3 "audit-first" deliverable for TL-028: the Cultural Assessment of Risk for Suicide (CARS) is a **copyrighted** research measure (APA / the authoring team), not public domain and not a free-registration instrument like the C-SSRS. Until written permission (or a license/purchase) is obtained and filed here, TL-028 **remains a placeholder** — SPiER does not author a Questionnaire that reproduces CARS item wording. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Cultural Assessment of Risk for Suicide (CARS)
**Short name / abbreviation:** CARS (catalogued in SPiER as **CARS-S**, TL-028)
**SPiER tool ID:** TL-028
**SPiER pathway stage(s):** clarify-risk (Clarify Risk)
**Repository location:** `FHIR-Resources/CARS-S/` (licensing audit only; no Questionnaire/FSH authored)
**Placeholder ActivityDefinition:** `AdministerCARSS` in `ig/input/fsh/pathway-tool-placeholders.fsh` (unchanged — remains a placeholder)

## Instrument provenance

**Original author(s):** Joyce P. Chu; Peter Goldblum; Bruce Bongar; and colleagues (Floyd, Diep, Pardo).
**Year of original publication:** 2013.
**Canonical citation:** Chu J, Floyd R, Diep H, Pardo S, Goldblum P, Bongar B. *A tool for the culturally competent assessment of suicide: The Cultural Assessment of Risk for Suicide (CARS) Measure.* Psychological Assessment. 2013;25(2):424–434.
**Instrument shape:** 39-item self-report measure of culturally-informed suicide risk factors and manifestations of suicidal ideation/behavior.
**Primary distribution source today:** Published by the American Psychological Association (APA) in *Psychological Assessment*; indexed with contact/permission guidance in the University of Miami El Centro Measures Library (https://elcentro.sonhs.miami.edu/research/measures-library/cars/).

## Licensing status

**Underlying instrument license:** **Copyrighted — permission required.** The CARS is a peer-reviewed research measure whose item content is under copyright held by the authors and/or APA. It is **not** published as a public-domain or free-registration instrument.
**Source of license claim:** The El Centro Measures Library explicitly directs users to "contact the author or company directly to either obtain permission or purchase the measure if it is not in the public domain," and states the creators hold the copyright to the individual works. No public terms grant free reproduction of the item set.
**License text on file:** None. No permission grant is on file.

## Sign-off status

**Sign-off required to publish FHIR derivatives:** **Yes.** Reproducing the 39 CARS items in a FHIR Questionnaire is a reproduction of copyrighted content and requires the authors'/publisher's written permission (or a purchased license).
**Contact for sign-off:** Dr. Joyce Chu (lead author) and/or APA Permissions (for the *Psychological Assessment* publication). Route via the El Centro Measures Library contact guidance.
**Date sign-off requested:** Not yet requested.
**Date sign-off received:** —
**Sign-off artifact on file:** None.

## Recommendation

**Do NOT author CARS FHIR artifacts at this time.** Keep `AdministerCARSS` (TL-028) as a placeholder ActivityDefinition. Before any Questionnaire/FSH/mapper work:

1. Contact Dr. Chu / APA Permissions to obtain written permission (or purchase a license) for reproducing the CARS items in a FHIR Questionnaire and redistributing it in the SPiER IG.
2. File the permission grant (or license) as `permission-letter.pdf` in this directory and update this memo's sign-off section.
3. Only then proceed with the full `assessment-to-ig` artifact set, carrying the required copyright/attribution in `Questionnaire.copyright` and the FSH header.

If permission cannot be obtained, TL-028 stays a catalogued placeholder (the tool is still listed in the adoption guide as an optional culturally-informed assessment) with no reproduced item content.

## Conditions on redistribution (if permission is later granted)

**Attribution required?** Almost certainly yes — cite Chu et al. (2013) and retain the APA copyright.
**Modifications permitted?** Unknown — must be confirmed in the permission grant (item wording likely must be preserved verbatim).
**Commercial use permitted?** Unknown — must be confirmed.
**Other constraints:** To be captured from the permission grant.

## Open questions

- Obtain written permission or a license from the CARS authors / APA before any authoring.
- Confirm whether a shorter CARS variant exists that the "-S" in the SPiER catalog label refers to, or whether "CARS-S" is simply SPiER's internal short label for the CARS measure. (The placeholder title reads "Cultural Assessment of Risk for Suicide (CARS-S)".)
- Determine the intended derived output if authored (likely a culturally-informed risk formulation Observation, potentially crosswalked to the shared suicide-risk tier).

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Wave 3 audit-first pass for TL-028. Established that the CARS (Chu et al., 2013, *Psychological Assessment*) is copyrighted and permission-gated (El Centro Measures Library guidance). **Recommendation: NO-GO** for artifact authoring; keep placeholder until written permission/license is filed. No CARS item content reproduced in this PR. |
