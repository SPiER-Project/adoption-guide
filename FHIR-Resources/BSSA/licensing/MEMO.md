# BSSA — Licensing Audit Memo

> **Status:** Public domain (U.S. federal government work). No permission or sign-off is required to publish the SPiER FHIR derivatives. This memo records the basis for that conclusion. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Brief Suicide Safety Assessment (part of the Ask Suicide-Screening Questions Toolkit)
**Short name / abbreviation:** BSSA
**SPiER tool ID:** TL-005
**SPiER pathway stage(s):** clarify-risk (Stage 2 — Clarify Risk)
**Repository location:** `FHIR-Resources/BSSA/`
**Tracking issue:** TL-005 roadmap epic (see `web/src/data/roadmap.generated.json`)

## Instrument provenance

**Original author(s) / authoring institution:** National Institute of Mental Health (NIMH), a U.S. federal research institution, as part of the ASQ Toolkit. The ASQ/BSSA research was led by NIMH intramural investigators.
**Year of original publication:** BSSA worksheets distributed as part of the ASQ Toolkit (ASQ instrument originally published 2012; BSSA clinical pathway materials released and periodically revised thereafter — the worksheet transcribed here is dated 12/8/2025).
**Canonical citation:** NIMH Ask Suicide-Screening Questions (ASQ) Toolkit — Brief Suicide Safety Assessment worksheets (Adult/Youth × Outpatient/ED/Inpatient).
**Primary distribution source today:** [NIMH ASQ Toolkit](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials) (worksheets published as free downloadable PDFs).

## Licensing status

**Underlying instrument license:** Public domain. As a work of the U.S. federal government (NIMH), the ASQ Toolkit — including the BSSA worksheets — is not subject to copyright in the United States and is published for free use without permission. This is the same basis on which the SPiER ASQ artifacts (TL-001) are published.
**Source of license claim:** NIMH ASQ Toolkit public materials, which state the tools are free and no permission is required to use them. The transcribed source is the Adult Outpatient BSSA worksheet PDF from the toolkit page above.
**License text on file:** Not separately distributed — NIMH publishes the materials openly on the toolkit page rather than under a discrete license file.

## Sign-off status

**Sign-off required to publish FHIR derivatives:** No, per NIMH's posted public-domain terms.
**Contact for sign-off:** N/A (not required). NIMH publishes the toolkit for open use.
**Date sign-off requested:** Not applicable.
**Date sign-off received:** Not applicable.
**Sign-off artifact on file:** Not applicable.

## Conditions on redistribution

**Attribution required?** Not legally required (public domain), but SPiER attributes the BSSA to NIMH as a courtesy and for provenance — see the `Questionnaire.copyright` string and the FSH header.
**Modifications permitted?** Yes. NIMH publishes multiple setting-specific worksheet variants and encourages adaptation to local workflows. The SPiER FHIR representation preserves the worksheet's clinical prompts and its four dispositions; it is a *representation* of the guide, not a re-scoring of it (the BSSA is not a scored instrument).
**Commercial use permitted?** Yes (public domain; no restriction).
**Other constraints:** The BSSA is a clinical *guide* intended for use by trained clinical professionals after a positive screen. It should be distributed together with its disposition guidance rather than excerpted as a stand-alone form. The SPiER Questionnaire keeps the disposition options and safety-plan guidance intact for this reason.

## FHIR artifact metadata reflection

- `Questionnaire.copyright`: "The Brief Suicide Safety Assessment is part of the Ask Suicide-Screening Questions (ASQ) Toolkit, a public domain resource developed by the National Institute of Mental Health (NIMH). No permission is required for use."
- `Questionnaire.useContext`: `focus` = SNOMED 225337009 (Suicide risk assessment); `venue` = Outpatient / ED / Hospital / Primary Care.
- IG page attribution block: not yet authored (no dedicated `ig/input/pagecontent/bssa.md` in this PR); provenance is carried in the FSH header and this memo.
- FSH source attribution: `ig/input/fsh/bssa.fsh` header documents NIMH provenance and public-domain status; `AdministerBSSA.publisher = "SPiER (HTD Health)"`.

## Open questions

- Whether a dedicated IG narrative page (`ig/input/pagecontent/bssa.md`) should be authored to carry the full attribution and the disposition-guidance context; deferred from this PR.
- Whether the setting-specific worksheet variants (Youth ED, Adult Inpatient, etc.) should each be modeled, or whether the single generalized Questionnaire (Adult Outpatient wording) with a `useContext` venue set is sufficient. Current decision: one generalized Questionnaire.
- Confirm the canonical publication citation format NIMH prefers for the BSSA specifically (vs. the ASQ screening instrument).

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Created memo while encoding TL-005 BSSA. Public-domain basis confirmed from the NIMH ASQ Toolkit; item wording transcribed from the Adult Outpatient BSSA worksheet (dated 12/8/2025). |
