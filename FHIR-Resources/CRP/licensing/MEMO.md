# Crisis Response Plan (CRP) — Licensing Audit Memo

> **Status: GO — SPiER holds the license/permission (maintainer-confirmed 2026-07-15).** The CRP is a published clinical intervention technique (Bryan & Rudd). SPiER encodes it with attribution to the authors. This memo records the basis and the attribution obligations. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Crisis Response Plan (CRP)
**Short name / abbreviation:** CRP
**SPiER tool ID:** TL-015
**SPiER pathway stage(s):** document-safety-actions (Stage 4 — Document Safety Actions)
**Repository location:** `FHIR-Resources/CRP/`
**Precedent:** modeled on the Stanley-Brown Safety Plan CarePlan encoding (`spier-stanley-brown-safety-plan`, TL-007).

## Instrument provenance

**Original author(s):** Craig J. Bryan, PsyD, ABPP; M. David Rudd, PhD, ABPP.
**Origin / description:** A brief crisis-planning intervention disseminated through Bryan & Rudd's work (e.g., *Brief Cognitive-Behavioral Therapy for Suicide Prevention*, Guilford Press) and widely taught (e.g., VA/DoD, national training programs). It is a clinical **technique/format** — a five-section personalized plan the patient authors and keeps — rather than a proprietary scored instrument.
**Primary distribution source today:** Bryan & Rudd publications and associated training materials.

## Licensing status

**Underlying instrument license:** The CRP is a clinical intervention technique. It is freely used in practice with attribution; there is no per-use scored-instrument license fee analogous to a proprietary questionnaire.
**Source of license claim:** **Maintainer confirmation (2026-07-15)** that the SPiER project holds the necessary license/permission to encode and distribute the CRP within the IG. SPiER attributes the CRP to Bryan & Rudd in the `Questionnaire.copyright`, the FSH header, and this memo.
**License text on file:** Held by the SPiER project (maintainer-confirmed); a copy should be filed here if a written grant exists.

## Sign-off status

**Sign-off required to publish FHIR derivatives:** Covered by the SPiER project's license/permission (maintainer-confirmed).
**Contact for sign-off:** SPiER project lead (holds the license); original authors Bryan & Rudd for attribution questions.
**Date sign-off confirmed:** 2026-07-15 (maintainer, via project direction).
**Sign-off artifact on file:** Maintainer confirmation; file any written grant here if available.

## Conditions on redistribution

**Attribution required?** Yes — attribute the CRP to Bryan & Rudd.
**Modifications permitted?** The CRP is a flexible format; SPiER encodes the five canonical sections. The patient-authored content is free text.
**Commercial use permitted?** Per the SPiER project's license (maintainer-confirmed).
**Other constraints:** The patient should retain a copy of their plan; SPiER's app is DEMO ONLY and does not persist patient data.

## FHIR artifact metadata reflection

- `Questionnaire.copyright`: attributes the CRP to Bryan & Rudd and notes use under the SPiER project's license.
- Output: `SPiERCrisisResponsePlan` CarePlan profile (one activity per section); LOINC reused from the Stanley-Brown panel where concepts overlap.
- FSH source attribution: `ig/input/fsh/crp.fsh` header documents authorship, licensing basis, and the maintainer confirmation date.

## Open questions

- If a written permission/license grant exists, file it in this directory for the record.
- Confirm the preferred citation for the CRP (book chapter vs. journal article).

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Encoded TL-015 CRP as a CarePlan (modeled on Stanley-Brown) after maintainer confirmed SPiER holds the license/permission for the Wave 3 gated tools. Attribution to Bryan & Rudd carried in all artifacts. |
