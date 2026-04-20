# SPiER Project Asset Manifest

This manifest provides a computer-readable and human-readable index of the assets in the SPiER (Suicide Prevention in EHRs) project.

## Project Strategy & Education
*   **`docs/PROJECT_OVERVIEW.md`**: Mission statement and technical roadmap.
*   **`docs/best-practices/strategy-consent.md`**: Architectural plan for cross-practice data sharing.
*   **`docs/best-practices/consent-vs-ds4p.md`**: Educational guide on FHIR Consent and data segmentation standards.
*   **`docs/best-practices/validation-guide.md`**: Instructions for technical and clinical validation of assets.

## Clinical Tool: Stanley-Brown Safety Plan
*   **Location:** `FHIR-Resources/4-Document-Safety-Actions/Stanley-Brown/`
*   **Implementation Guide:** `FHIR-Resources/4-Document-Safety-Actions/Stanley-Brown/README.md` (Includes Clinical Mapping Table).
*   **Key Assets:**
    *   `FHIR-Resources/4-Document-Safety-Actions/Stanley-Brown/fhir/questionnaires/questionnaire.json`: Data capture with LOINC coding.
    *   `FHIR-Resources/4-Document-Safety-Actions/Stanley-Brown/fhir/careplans/Hybrid_CarePlan.json`: High-interoperability persistence model.
*   **Source:** `FHIR-Resources/4-Document-Safety-Actions/Stanley-Brown/references/original-forms/Stanley-Brown-Safety-Plan-8-6-21.pdf`

## Clinical Tool: CAMS (Collaborative Assessment and Management of Suicidality)
*   **Location:** `FHIR-Resources/2-Clarify-Risk/CAMS/`
*   **Implementation Guide:** `FHIR-Resources/2-Clarify-Risk/CAMS/README.md` (Explaining the Driver/Problem lifecycle).
*   **Key Assets:**
    *   `FHIR-Resources/2-Clarify-Risk/CAMS/fhir/questionnaires/SSF5_SectionA.json`: Patient Assessment.
    *   `FHIR-Resources/2-Clarify-Risk/CAMS/fhir/questionnaires/SSF5_SectionB.json`: Clinician Risk/Driver ID.
    *   `FHIR-Resources/2-Clarify-Risk/CAMS/fhir/questionnaires/Stabilization_Plan.json`: Safety Planning.
    *   `FHIR-Resources/2-Clarify-Risk/CAMS/fhir/careplans/Stabilization_CarePlan_Template.json`: Persistence model.
    *   `FHIR-Resources/2-Clarify-Risk/CAMS/fhir/questionnaires/Therapeutic_Worksheet.json`: Interim session tool.

## Other Clinical Frameworks
*   **ASQ (Ask Suicide-Screening Questions):** `FHIR-Resources/1-Flag-Risk/ASQ/`
*   **CSS-RS (Columbia-Suicide Severity Rating Scale):** `FHIR-Resources/1-Flag-Risk/C-SSRS/`
*   **SBQ-R (Suicide Behaviors Questionnaire):** `FHIR-Resources/1-Flag-Risk/SBQ-R/`

## Evaluation
*   **Evaluation:** `Evaluation/SPiER Evaluation Plan_12.23.2025.docx` (Placeholders - pending addition).

---
*Last Updated: 2026-02-22*