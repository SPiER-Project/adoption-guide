# Stanley-Brown Safety Plan

## Provenance

A seven-step collaborative safety plan — the field's most widely used
safety-planning intervention. Steps 1–6 are the original 2008 form; **step 7**
("the one thing most important to me and worth living for") comes from the 2021
clinical update.

| | |
|---|---|
| **Authors** | Barbara Stanley, PhD and Gregory K. Brown, PhD (2008, 2021) |
| **Clinical source of truth** | `references/original-forms/Stanley-Brown-Safety-Plan-8-6-21.pdf` · [suicidesafetyplan.com](https://www.suicidesafetyplan.com) |
| **Licensing** | ⚠️ **Written permission from the authors is required to use the form in an electronic medical record**, or to change it. Individual use of the paper form is permitted; an EHR integration built from this material is exactly the case the notice covers. **No licensing-audit memo is on file** under [#64](https://github.com/SPiER-Project/adoption-guide/issues/64) and **SPiER has filed no such permission**, so an adopting system must obtain its own before deploying this. The full statement is on the `AdministerStanleyBrown` ActivityDefinition's `copyright`. |

## What's in this folder

| File | What it is |
|---|---|
| `stanley-brown-questionnaire.json` | The FHIR R4 Questionnaire — the data-capture tool, with FHIR groups mirroring the seven steps |
| `Hybrid_CarePlan.json` | A hand-authored CarePlan template embedding the safety text directly in activity descriptions. Kept for reference; the conformance target is the `SPiERStanleyBrownSafetyPlan` profile |
| `docs/data-mapping.md` | A pointer at the StructureMap, the runtime mapper and the golden file that hold the QR→CarePlan transformation, plus the reasoning for embedding the text rather than referencing the response |
| `references/original-forms/` | The 2021 source form |
| `references/specs/Stanley_Brown_NY_CCBHC_Dashboard_DataDictionary_v3.xlsx` | Mapping between the clinical fields and the NY CCBHC dashboard / EHR reporting requirements |

Everything about the FHIR shapes is in
[`ig/input/fsh/stanley-brown.fsh`](../../ig/input/fsh/stanley-brown.fsh): the
`SPiERStanleyBrownSafetyPlan` CarePlan profile, which declares all seven steps
as **named slices** on `activity.detail.code` — so the section codes are
readable off the profile — plus the `AdministerStanleyBrown`
ActivityDefinition with its stage membership and licensing, and the example
CarePlan. The transformation is declared in
[`ig/input/resources/maps/StanleyBrownQRToCarePlan.fml`](../../ig/input/resources/maps/StanleyBrownQRToCarePlan.fml)
and executed by `packages/core/src/lib/carePlanMappers/stanleyBrown.ts`.

## Section coding

Each step is identified by a **SPiER-local** section code from
`http://thespierproject.org/fhir/CodeSystem/safety-plan-section`, **shared with
the Crisis Response Plan**, whose five sections are a subset of these seven.
Every use is tagged `no-standard-binding`. At *document* level the CarePlan
carries the one real standard code that applies: LOINC `87626-8` *Suicide
prevention note*, in `CarePlan.category`.

The canonical definition — including the exhaustive LOINC 2.82 search showing
that no published concept exists at this granularity — is
[`ig/input/fsh/safety-plan-section.fsh`](../../ig/input/fsh/safety-plan-section.fsh).

> ### ⚠️ Retracted: the former "Clinical Mapping Audit Table (LOINC)"
>
> Until 2026-08-05 this README published an audit table asserting seven LOINC
> codes for these steps — `76689-1`, `76690-9`, `76691-7`, `76692-5`,
> `76693-3`, `76694-1` and `81344-4` — under the heading *"The following LOINC
> codes have been mapped … for semantic interoperability"*, with invented
> display names.
>
> **That table was wrong and the verification it implied never happened.** The
> six `766xx-x` codes do not exist in LOINC. `81344-4` does exist, but means
> *"Healthcare agent authority to inspect and disclose mental and physical
> health information Narrative - Reported"* — so a receiving system would have
> read reasons-for-living content as healthcare-agent disclosure authority.
>
> The table is recorded here rather than silently deleted because its false
> assurance is *why* the codes survived for months: they were copied onward from
> this file into `Hybrid_CarePlan.json`, the CRP README, the runtime CarePlan
> mappers and the data-element catalog. See
> [#220](https://github.com/SPiER-Project/adoption-guide/issues/220). **Do not
> reintroduce codes to this repo on the strength of an in-repo table** — verify
> against LOINC.

## Informational — not stated by any artifact

**Sharing the plan across settings needs a Consent.** The safety plan is exactly
the kind of content a receiving organization may not be entitled to by default;
see [`docs/best-practices/strategy-consent.md`](../../docs/best-practices/strategy-consent.md)
and [`docs/best-practices/consent-vs-ds4p.md`](../../docs/best-practices/consent-vs-ds4p.md).

**Alignment with US Core and HL7 eCarePlan is an aim, not a claim.** The profile
does not declare a dependency on either. ⚠️ An earlier revision of the CarePlan
mappers asserted US eCare Plan profile canonicals that SPiER does not conform
to; those were replaced with SPiER's own
([#265](https://github.com/SPiER-Project/adoption-guide/issues/265)).
