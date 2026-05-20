# SPiER Project Asset Manifest

This manifest provides a computer-readable and human-readable index of the assets in the SPiER (Suicide Prevention in EHRs) project.

## Project Strategy & Education
*   **`docs/PROJECT_OVERVIEW.md`**: Mission statement and technical roadmap.
*   **`docs/best-practices/strategy-consent.md`**: Architectural plan for cross-practice data sharing.
*   **`docs/best-practices/consent-vs-ds4p.md`**: Educational guide on FHIR Consent and data segmentation standards.
*   **`docs/best-practices/validation-guide.md`**: Instructions for technical and clinical validation of assets.
*   **`docs/repo-audit.md`**: Move 6d structural audit.

## FHIR Implementation Guide
*   **Location:** `ig/`
*   **FSH sources:** `ig/input/fsh/` — one file per tool plus `pathway-stages.fsh` for all 5 stage PlanDefinitions and `spier-codesystem.fsh` for the pathway-stage CodeSystem.
*   **Generated FHIR JSON:** `ig/fsh-generated/resources/` (sushi output, gitignored). A subset is copied to `web/src/data/fhir/` by `npm run copy-fhir` for the React app.
*   **CI:** `.github/workflows/ig.yml` compiles FSH on every PR.

## Clinical Tool: Stanley-Brown Safety Plan
*   **Location:** `FHIR-Resources/Stanley-Brown/`
*   **Implementation Guide:** `FHIR-Resources/Stanley-Brown/README.md` (Includes Clinical Mapping Table).
*   **Key Assets:**
    *   `FHIR-Resources/Stanley-Brown/fhir/questionnaires/questionnaire.json`: Data capture with LOINC coding.
    *   `FHIR-Resources/Stanley-Brown/fhir/careplans/Hybrid_CarePlan.json`: High-interoperability persistence model.
*   **Source:** `FHIR-Resources/Stanley-Brown/references/original-forms/Stanley-Brown-Safety-Plan-8-6-21.pdf`
*   **Primary pathway stage:** Document Safety Actions (4).

## Clinical Tool: CAMS (Collaborative Assessment and Management of Suicidality)
*   **Location:** `FHIR-Resources/CAMS/`
*   **Implementation Guide:** `FHIR-Resources/CAMS/README.md` (Explaining the Driver/Problem lifecycle).
*   **Key Assets:**
    *   `FHIR-Resources/CAMS/fhir/questionnaires/SSF5_SectionA.json`: Patient Assessment.
    *   `FHIR-Resources/CAMS/fhir/questionnaires/SSF5_SectionB.json`: Clinician Risk/Driver ID.
    *   `FHIR-Resources/CAMS/fhir/questionnaires/Stabilization_Plan.json`: Safety Planning.
    *   `FHIR-Resources/CAMS/fhir/careplans/Stabilization_CarePlan_Template.json`: Persistence model.
    *   `FHIR-Resources/CAMS/fhir/questionnaires/Therapeutic_Worksheet.json`: Interim session tool.
*   **Primary pathway stages:** Clarify Risk (2), Set Risk Status (3), Document Safety Actions (4), Manage Active Risk (7).

## Other Clinical Frameworks
*   **ASQ (Ask Suicide-Screening Questions):** `FHIR-Resources/ASQ/` — primary stage: Flag Risk (1).
*   **C-SSRS (Columbia-Suicide Severity Rating Scale):** `FHIR-Resources/C-SSRS/` — primary stages: Flag Risk (1), Clarify Risk (2).
*   **PHQ-9 (Patient Health Questionnaire — 9-item):** `FHIR-Resources/PHQ-9/` — primary stage: Flag Risk (1).
*   **SBQ-R (Suicide Behaviors Questionnaire-Revised):** `FHIR-Resources/SBQ-R/` — primary stage: Flag Risk (1).

## Evaluation
*   **Evaluation:** `Evaluation/SPiER Evaluation Plan_12.23.2025.docx` (Placeholders - pending addition).

---
*Last Updated: 2026-05-20*
