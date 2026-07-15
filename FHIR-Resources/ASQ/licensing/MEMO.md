# ASQ — Licensing Audit Memo

> **Status:** Placeholder. Sign-off correspondence exists in non-repository storage and needs to be filed here before this memo is complete. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking issue: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Ask Suicide-Screening Questions (ASQ)
**Short name / abbreviation:** ASQ
**SPiER tool ID:** TL-001
**SPiER pathway stage(s):** identify-possible-risk (1)
**Repository location:** `FHIR-Resources/ASQ/`
**Tracking issue:** [#18](https://github.com/SPiER-Project/adoption-guide/issues/18)

## Instrument provenance

**Original author(s) / authoring institution:** Originating research team at a federal mental-health research institution.
**Year of original publication:** 2012
**Canonical citation:** *Original publication of the ASQ instrument in a peer-reviewed pediatric journal — full citation to be filed alongside the permission letter.*
**Primary distribution source today:** The originating institution's public-facing toolkit page (link to be filed here).

## Licensing status

**Underlying instrument license:** Open — no fee required, redistribution permitted. The originating institution publishes the instrument as a public-domain screening tool.
**Source of license claim:** *Permission letter from the originating researcher (verbal commitment confirmed during planning conversation on 2026-05-29). Letter on file in non-repository storage; needs to be added to this directory.*
**License text on file:** `pending — permission letter to be added as permission-letter.pdf`

## Sign-off status

**Sign-off required to publish FHIR derivatives:** No, per the originating institution's posted terms. The permission letter on file is a courtesy artifact rather than a legal precondition.
**Contact for sign-off:** Originating researcher at the federal research institution.
**Date sign-off requested:** *Prior to 2026-05-29 (exact date in correspondence).*
**Date sign-off received:** *Prior to 2026-05-29.*
**Sign-off artifact on file:** `pending — permission letter to be filed here as permission-letter.pdf`

## Conditions on redistribution

**Attribution required?** Yes — must attribute to the originating institution and cite the canonical publication.
**Modifications permitted?** UNKNOWN — needs clarification. Item wording for the five core ASQ questions is canonical and should not be paraphrased. The FHIR Questionnaire reproduces item wording verbatim.
**Commercial use permitted?** UNKNOWN — needs clarification, though the instrument is widely used commercially in EHR implementations without apparent restriction.
**Other constraints:** Item wording must be preserved verbatim. The instrument should be distributed together with its scoring/follow-up guidance to avoid being used as a stand-alone screener without protocol context.

## FHIR artifact metadata reflection

- Questionnaire.copyright: "The ASQ is a public domain instrument developed by the National Institute of Mental Health (NIMH). No permission is required for use." (To be updated with the canonical citation once finalized.)
- `Questionnaire.useContext`: *Not yet set.*
- IG page attribution block: *Not yet authored — will live in `ig/input/pagecontent/asq.md` when that page is created.*
- FSH source attribution: *Not yet set in `ig/input/fsh/asq.fsh`.*

## Open questions

- Locate and file the original permission-letter PDF in this directory.
- Confirm canonical citation format from the originating institution's toolkit page.
- Resolve whether the FHIR derivative work is treated as a "modified version" or a "representation" of the instrument, and whether that distinction affects attribution language.
- Confirm whether SNOMED-bound Yes/No representations of the response items (versus the canonical text answers) are a "modification" under the instrument's terms.
- Confirm whether translations of the ASQ (Spanish, others) carry their own licensing or share the open license.

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-05-29 | Project lead | Created placeholder memo from the template. Permission-letter PDF still to be filed. Several "UNKNOWN" fields flagged for follow-up. |
