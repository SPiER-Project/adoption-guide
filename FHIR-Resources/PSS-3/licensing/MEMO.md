# PSS-3 — Licensing Audit Memo

> **Status:** Free public resource (NIMH-funded ED-SAFE study; distributed by SAMHSA and SPRC). No permission or fee is required to publish the SPiER FHIR derivatives. This memo records the basis for that conclusion. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Patient Safety Screener 3 (PSS-3)
**Short name / abbreviation:** PSS-3
**SPiER tool ID:** TL-011
**SPiER pathway stage(s):** identify-possible-risk (Stage 1 — Identify Possible Risk)
**Repository location:** `FHIR-Resources/PSS-3/`
**Tracking issue:** TL-011 roadmap epic (see `web/src/data/roadmap.generated.json`)

## Instrument provenance

**Original author(s) / authoring institution:** Developed through the Emergency Department Safety Assessment and Follow-up Evaluation (**ED-SAFE**) study (Boudreaux et al.), a multi-site suicide-screening research program funded by the National Institute of Mental Health (NIMH).
**Year of original publication:** ED-SAFE PSS validation work published c. 2015; the PSS-3 has been distributed as a free tool since.
**Canonical citation:** Boudreaux ED, et al. Improving suicide risk screening and detection in the emergency department (ED-SAFE). *Am J Prev Med.* 2016;50(4):445–453 (and related ED-SAFE PSS validation papers). Full citation to be confirmed for the IG page.
**Primary distribution source today:** [SAMHSA DBHIS](https://www.samhsa.gov/resource/dbhis/patient-safety-screener-pss-3-brief-tool-detect-suicide-risk-acute-care-settings) and the [Suicide Prevention Resource Center (SPRC)](https://sprc.org/) printable tool + tip sheet.

## Licensing status

**Underlying instrument license:** Open / no fee required. The PSS-3 is disseminated as a free public tool by SAMHSA and SPRC for use in acute-care settings. As NIMH-funded research output distributed by federal/federally-supported bodies, it is provided without a use fee or per-distribution license.
**Source of license claim:** SAMHSA and SPRC public distribution of the printable PSS-3 tool and tip sheet with no stated fee or permission requirement. The verbatim item wording used here is transcribed from the SPRC "Printable PSS-3 Tool" PDF.
**License text on file:** Not separately distributed — SAMHSA/SPRC publish the materials openly rather than under a discrete license file.

## Sign-off status

**Sign-off required to publish FHIR derivatives:** No, per the free public distribution.
**Contact for sign-off:** N/A (not required).
**Date sign-off requested:** Not applicable.
**Date sign-off received:** Not applicable.
**Sign-off artifact on file:** Not applicable.

## Conditions on redistribution

**Attribution required?** Not strictly required, but SPiER attributes the PSS-3 to the ED-SAFE study / SAMHSA / SPRC as a courtesy and for provenance (see `Questionnaire.copyright` and the FSH header).
**Modifications permitted?** The tip sheet instructs administering the three questions **exactly as worded**; the SPiER FHIR Questionnaire reproduces the item wording verbatim. The recency options and positive-screen logic are likewise preserved.
**Commercial use permitted?** Yes (free public tool; no stated restriction).
**Other constraints:** Should be administered with its scoring/interpretation guidance (a positive screen calls for a secondary risk-stratification tool) rather than excerpted as a stand-alone question set. The SPiER encoding keeps the positive-screen rule and the Clarify-Risk trigger intact.

## FHIR artifact metadata reflection

- `Questionnaire.copyright`: "The Patient Safety Screener (PSS-3) was developed through the ED-SAFE study (funded by the National Institute of Mental Health) and is distributed as a free, public resource by SAMHSA and the Suicide Prevention Resource Center. No permission or fee is required for use."
- `Questionnaire.useContext`: `focus` = SNOMED 225337009 (Suicide risk assessment); `venue` = Emergency Room / Hospital.
- IG page attribution block: not yet authored (no dedicated `ig/input/pagecontent/pss3.md` in this PR); provenance is carried in the FSH header and this memo.
- FSH source attribution: `ig/input/fsh/pss3.fsh` header documents ED-SAFE/SAMHSA provenance and free-use status; `AdministerPSS3.publisher = "SPiER (HTD Health)"`.

## Open questions

- Confirm the preferred canonical citation for the PSS-3 (ED-SAFE validation paper vs. SAMHSA tool page).
- Confirm whether SAMHSA/SPRC attach any attribution wording they prefer on reproduced copies.
- Whether the depression lead-in item (item 1) should feed a separate depression concept Observation in addition to the suicide-risk result (deferred).

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Created memo while encoding TL-011 PSS-3. Free-use basis confirmed from SAMHSA/SPRC distribution; item wording transcribed verbatim from the SPRC Printable PSS-3 Tool. |
