## Workflow Overview
1.  **Input:** The clinician/patient completes the `Stanley_Brown_FHIR_Questionnaire.json`.
2.  **Capture:** The results are saved as a `QuestionnaireResponse` resource.
3.  **Extraction:** The structured data is transformed into a `CarePlan` resource (supported by `Observation` and `RelatedPerson` resources) for long-term clinical management.

## Asset Descriptions

### Core Files
*   **`Stanley-Brown-Safety-Plan-8-6-21.pdf`**: The clinical source of truth (located in `references/original-forms/`).
*   **`Stanley_Brown_FHIR_Questionnaire.json`**: The primary data entry tool. It uses FHIR groups and items to mirror the 6 steps of the safety plan (located in `fhir/questionnaires/`).
*   **`Stanley_Brown_Hybrid_CarePlan_Template.json`**: A high-interoperability CarePlan model that embeds critical safety text directly in the activity descriptions (located in `fhir/careplans/`).
*   **`data-mapping.md`**: The definitive guide for how to extract Questionnaire data into the CarePlan (located in `docs/`).
*   **`Stanley_Brown_NY_CCBHC_Dashboard_DataDictionary_v3.xlsx`**: Mapping between the clinical fields and the dashboard/EHR reporting requirements (located in `references/specs/`).

### Under Development (`Not ready/`)
*   **`Stanley Brown Structure Map.json`**: A FHIR Mapping Language (FML) file intended to automate the conversion from the QuestionnaireResponse to a CarePlan. 
*   **`StanleyBrownCarePlan.json`**: A template of the target CarePlan resource, aligned with US Core and eCarePlan profiles.

## Implementation Notes
*   **Persistence:** The `CarePlan` is the recommended resource for storing the active safety plan in the EHR.
*   **Interoperability:** This plan aims to be compliant with the **US Core** and **HL7 eCarePlan** implementation guides.
*   **Consent:** Sharing this plan across settings requires a valid `Consent` resource (see `../../docs/best-practices/strategy-consent.md`).

## Section coding

Each safety-plan step is identified by a **SPiER-local** section code from
`http://thespierproject.org/fhir/CodeSystem/safety-plan-section`, shared with the Crisis Response
Plan. Every use is tagged `no-standard-binding` via the
`coding-verification-status` extension.

| Safety Plan Step | Section Code |
| :--- | :--- |
| Step 1: Warning Signs | `warning-signs` |
| Step 2: Internal Coping | `internal-coping` |
| Step 3: Social Distraction | `social-distraction` |
| Step 4: Crisis Support | `crisis-support` |
| Step 5: Professionals | `professional-support` |
| Step 6: Lethal Means | `lethal-means-safety` |
| Step 7: Reason for Living | `reason-for-living` |

At **document** level the CarePlan additionally carries the one real standard code
that applies: LOINC `87626-8` "Suicide prevention note", in `CarePlan.category`.

The canonical definition, including the exhaustive LOINC 2.82 search showing that
no published LOINC concept exists at this granularity, is
[`ig/input/fsh/safety-plan-section.fsh`](../../ig/input/fsh/safety-plan-section.fsh).

> ### ⚠️ Retracted: the former "Clinical Mapping Audit Table (LOINC)"
>
> Until 2026-08-05 this README published an audit table asserting seven LOINC
> codes for these steps — `76689-1`, `76690-9`, `76691-7`, `76692-5`, `76693-3`,
> `76694-1` and `81344-4` — under the heading "The following LOINC codes have
> been mapped … for semantic interoperability", with invented display names.
>
> **That table was wrong and the verification it implied never happened.** The
> six `766xx-x` codes do not exist in LOINC. `81344-4` does exist, but means
> "Healthcare agent authority to inspect and disclose mental and physical health
> information Narrative - Reported" — so a receiving system would have read
> reasons-for-living content as healthcare-agent disclosure authority.
>
> The table is recorded here rather than silently deleted because its false
> assurance is *why* the codes survived for months: they were copied onward from
> this file into `Hybrid_CarePlan.json`, the CRP README, the runtime CarePlan
> mappers and the data-element catalog. See issue #220. Do not reintroduce codes
> to this repo on the strength of an in-repo table — verify against LOINC.

---
*Last Updated: 2026-08-05*

## Change Log
### 2026-08-05
*   **Withdrew the seven safety-plan LOINC codes** (issue #220). Six did not exist
    in LOINC; `81344-4` resolved to an unrelated concept. Replaced with the
    SPiER-local `safety-plan-section` CodeSystem across the Questionnaire,
    `Hybrid_CarePlan.json`, the runtime mappers and the data-element catalog.
*   **Added LOINC `87626-8` "Suicide prevention note"** to `CarePlan.category` —
    verified against LOINC 2.82.
*   **Retracted the "Clinical Mapping Audit Table (LOINC)"**, which had documented
    the withdrawn codes as verified.

### 2026-02-04
*   **Refined `Stanley_Brown_FHIR_Questionnaire.json`**:
    *   Added LOINC codes to Steps 1-6 for improved semantic interoperability.
    *   Added Step 7: "The one thing that is most important to me and worth living for" (per the 2021 clinical update).
    *   Updated metadata and publisher information.
*   **Created `Stanley_Brown_Hybrid_CarePlan_Template.json`**:
    *   Implemented the "Hybrid" model for cross-network sharing.
    *   Embedded LOINC codes into CarePlan activities.
