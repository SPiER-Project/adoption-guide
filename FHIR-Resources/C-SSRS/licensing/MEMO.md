# C-SSRS — Licensing Audit Memo

> **Status:** Registration / permission-based. The Columbia-Suicide Severity Rating Scale is free to use but is copyrighted by The Research Foundation for Mental Hygiene, Inc. and requires registration (and, for some settings, training) via the Columbia Lighthouse Project (cssrs.columbia.edu). This memo covers the whole C-SSRS family encoded in SPiER. Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Columbia-Suicide Severity Rating Scale (C-SSRS)
**Short name / abbreviation:** C-SSRS
**SPiER tool IDs (family):** TL-003 (Screener/Recent), TL-004 (Full Lifetime/Recent), **TL-019 (Since Last Visit / Since Last Contact)**, TL-027 (Pediatric / Adolescent — see the dedicated section below)
**SPiER pathway stage(s):** identify-possible-risk (TL-003, TL-027), clarify-risk (TL-004, TL-019)
**Repository location:** `FHIR-Resources/C-SSRS/`
**Tracking issue:** C-SSRS roadmap epics (see `web/src/data/roadmap.generated.json`)

## Instrument provenance

**Original author(s) / authoring institution:** Posner, K.; Brent, D.; Lucas, C.; Gould, M.; Stanley, B.; Brown, G.; Fisher, P.; Zelazny, J.; Burke, A.; Oquendo, M.; Mann, J. Developed at Columbia University with the University of Pennsylvania and the University of Pittsburgh.
**Year of original publication:** 2008 (C-SSRS); Posner et al., *Am J Psychiatry* 2011 for the validation study.
**Canonical citation:** Posner K, Brown GK, Stanley B, et al. The Columbia-Suicide Severity Rating Scale: initial validity and internal consistency findings from three multisite studies with adolescents and adults. *Am J Psychiatry.* 2011;168(12):1266–1277.
**Primary distribution source today:** The Columbia Lighthouse Project — [cssrs.columbia.edu](https://cssrs.columbia.edu/) — distributes the official versions (Screener, Full, Since Last Visit, Children/Youth, and translations).

## Licensing status

**Underlying instrument license:** Free to use, but **copyrighted** (© The Research Foundation for Mental Hygiene, Inc.). Use requires **registration** through the Columbia Lighthouse Project; certain administration contexts require training. It is NOT public domain — item wording may not be altered, and the copyright notice must be retained.
**Source of license claim:** Columbia Lighthouse Project terms of use (cssrs.columbia.edu). The copyright line is carried verbatim in every C-SSRS `Questionnaire.copyright` and FSH artifact.
**License text on file:** Not redistributed here; the governing terms live at cssrs.columbia.edu. The required copyright attribution is embedded in each FHIR artifact.

## Sign-off status

**Sign-off required to publish FHIR derivatives:** Registration with the Columbia Lighthouse Project is required to USE the C-SSRS; the SPiER encoding preserves item wording verbatim and retains the copyright notice. Formal confirmation that the FHIR representation (as a derivative/representation) is covered by SPiER's registration should be filed here.
**Contact for sign-off:** The Columbia Lighthouse Project (cssrs.columbia.edu; posnerk@nyspi.columbia.edu).
**Date sign-off requested:** *To be filed.*
**Date sign-off received:** *To be filed.*
**Sign-off artifact on file:** *Pending — registration confirmation to be added to this directory.*

## Conditions on redistribution

**Attribution required?** **Yes** — the © 2008 Research Foundation for Mental Hygiene notice and author list must be retained on every version.
**Modifications permitted?** **No** — item wording is fixed and must not be paraphrased. The SPiER Questionnaires reproduce the validated wording verbatim. The Since-Last-Visit version differs only in its administration **reference period** (expressed via title/description/instruction), not in item wording; the ideation item set and LOINC codes are identical to the Screener.
**Commercial use permitted?** Free for use across settings subject to the Lighthouse Project terms; confirm for any commercial redistribution.
**Other constraints:** Training may be required for certain administration contexts. Translations and the pediatric/youth versions are separately maintained by the Lighthouse Project and carry their own wording.

## FHIR artifact metadata reflection

- `Questionnaire.copyright`: carries the © 2008 Research Foundation for Mental Hygiene notice + author list on the Screener, Full, and Since Last Visit versions.
- `Questionnaire.code`: LOINC panel 93373-9 (Screener/Since-Last-Visit share the screener panel), 93245-9 (Full); per-item LOINC on ideation/behavior items.
- FSH source attribution: `ig/input/fsh/cssrs.fsh` documents the family; the derived risk level uses the shared `SPiERCSSRSRiskLevel` profile and dual-codes with LOINC LL465-6 answers for HL7 interop.
- IG page attribution block: not yet authored as a dedicated page.

## TL-027 — Pediatric / Adolescent version (licensing gate)

The C-SSRS **Children/Youth (pediatric/adolescent)** version has its own age-appropriate wording maintained by the Columbia Lighthouse Project. Before publishing verbatim younger-child pediatric item wording, **confirm the pediatric-version terms with the Lighthouse Project** (per the SSC rollout plan).

**Decision (2026-07-15):** TL-027 is authored per option (a) — it **reuses the validated C-SSRS screener item set** (the same wording validated for adolescents, already registered/used in this repo) under the same registration, with the copyright notice retained and pediatric `useContext` (age = Child). The Questionnaire `description` explicitly states this and flags that the Lighthouse Project's separate younger-child "Children's" simplified wording is a **pending gate** — SPiER does not fabricate that unverified wording. When the Children's-version terms are confirmed, TL-027 can be upgraded to the age-simplified wording. TL-027 reuses the shared `SPiERCSSRSRiskLevel` profile and the `cssrs-risk-level → tier` crosswalk (no new profile/crosswalk).

## Open questions

- File the Columbia Lighthouse Project registration confirmation covering SPiER's use of the C-SSRS family (including the FHIR representation).
- Confirm whether the Since-Last-Visit behavior item should be scoped to the interval only (current encoding) or retain a recency sub-question.
- Confirm pediatric/adolescent wording terms before authoring TL-027 verbatim.

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Created the C-SSRS family licensing memo while encoding TL-019 (Since Last Visit). Recorded registration/permission basis, verbatim-wording constraint, and the TL-027 pediatric-wording gate. Registration confirmation still to be filed. |
