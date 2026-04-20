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

## Clinical Mapping Audit Table (LOINC)
The following LOINC codes have been mapped to the Questionnaire steps for semantic interoperability:

| Safety Plan Step | LOINC Code | LOINC Display Name |
| :--- | :--- | :--- |
| Step 1: Warning Signs | `76689-1` | Self-reported crisis warning signs |
| Step 2: Internal Coping | `76690-9` | Self-reported distraction strategies to take mind off problems |
| Step 3: Social Distraction | `76691-7` | Self-reported people and social settings that provide distraction |
| Step 4: Crisis Support | `76692-5` | Self-reported people whom I can ask for help during a crisis |
| Step 5: Professionals | `76693-3` | Self-reported professionals or professional services |
| Step 6: Lethal Means | `76694-1` | Self-reported plan for lethal means safety |
| Step 7: Reason for Living | `81344-4` | Reasons for living |

---
*Last Updated: 2026-02-04*

## Change Log
### 2026-02-04
*   **Refined `Stanley_Brown_FHIR_Questionnaire.json`**:
    *   Added LOINC codes to Steps 1-6 for improved semantic interoperability.
    *   Added Step 7: "The one thing that is most important to me and worth living for" (per the 2021 clinical update).
    *   Updated metadata and publisher information.
*   **Created `Stanley_Brown_Hybrid_CarePlan_Template.json`**:
    *   Implemented the "Hybrid" model for cross-network sharing.
    *   Embedded LOINC codes into CarePlan activities.
