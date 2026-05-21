# Project Overview: SPiER (Suicide Prevention in Electronic Health Records)

## Mission
The SPiER project is a non-profit initiative dedicated to translating research-validated suicide prevention tools from paper-based formats into structured, interoperable healthcare data standards (e.g., HL7 FHIR). The goal is to make these high-quality tools easily accessible to EHR vendors and healthcare systems to improve the identification, assessment, and management of suicide risk.

## The 8-Stage Suicide Safer Care Pathway
We have adopted a standardized 8-stage model for suicide prevention in EHRs, ensuring that clinical workflows are supported from the first signal to the final resolution.

1.  **Flag Risk:** Identifying patients via universal or targeted screening (ASQ, PHQ-9 Item 9).
2.  **Clarify Risk:** Detailed clinical assessment to determine the nature and severity of risk (C-SSRS Full, CAMS SSF-5).
3.  **Set Risk Status:** Documenting a formal risk formulation and setting the clinical disposition (SAFE-T).
4.  **Document Safety Actions:** Creating collaborative safety plans and performing means safety counseling (Stanley-Brown, CAMS Stabilization).
5.  **Coordinate Handoffs:** Ensuring that suicide-specific data is transferred during discharge or transitions of care.
6.  **Track Follow-Up:** Monitoring closed-loop outreach and caring contacts after a transition.
7.  **Manage Active Risk:** Ongoing monitoring and treatment updates for patients currently in a care episode.
8.  **Measure and Share:** Aggregating data for population health, quality reporting, and cross-system sharing.

## Key Clinical Frameworks
1.  **CAMS (Collaborative Assessment and Management of Suicidality):**
    *   **Stages Supported:** Clarify Risk (SSF-5), Set Risk Status (Therapeutic Worksheet), Document Safety Actions (Stabilization Plan), Manage Active Risk (Interim Sessions), Coordinate Handoffs (Outcome/Disposition).
    *   A clinical framework emphasizing collaborative engagement.
2.  **Stanley-Brown Safety Plan:**
    *   **Stages Supported:** Document Safety Actions.
    *   An evidence-based intervention for identifying coping strategies and resources.
3.  **ASQ (Ask Suicide-Screening Questions):**
    *   **Stages Supported:** Flag Risk.
    *   A rapid screening tool used for youth and adults.
4.  **C-SSRS (Columbia-Suicide Severity Rating Scale):**
    *   **Stages Supported:** Flag Risk (Screener), Clarify Risk (Full Scale).
    *   The gold standard for assessing ideation and behavior.

## Technical Goals
*   **Pathway-Driven Logic:** Defining automated triggers that move a patient from one stage to the next (e.g., Flag Risk → Clarify Risk).
*   **FHIR Standardization:** Mapping every tool to Questionnaire, Observation, and CarePlan resources.
*   **EHR Adoption Rubric:** Providing a framework for vendors to self-assess their support for the 8-stage pathway.

## Roadmap & Tracking
Active work is tracked in [GitHub Issues](https://github.com/bbthorson/SPiER/issues): one epic per tool (`tool:TL-XXX`), three cross-cutting priority epics (`priority:p1|p2|p3` — FHIR shapes, terminology coding, CDS automation), and task issues under each epic. The Roadmap page on the site renders a committed snapshot of those issues. See `MANIFEST.md` for the seed/fetch workflow.

## Project Phases
1.  **Indexing & Discovery:** Inventorying existing assets and documentation (See `MANIFEST.md`).
2.  **Strategic Alignment:** Defining the mission and technical architecture.
3.  **Asset Translation:** Ongoing development of FHIR-based versions of core tools.
4.  **Consent & Security:** Developing models for patient-controlled data sharing across health systems.

---
*Created: 2026-02-04*
