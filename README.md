# SPiER (Suicide Prevention in Electronic Health Records)

## Mission
The SPiER project is a non-profit initiative dedicated to translating research-validated suicide prevention tools from paper-based formats into structured, interoperable healthcare data standards (e.g., HL7 FHIR). 

We organize these tools around an **8-stage Suicide Safer Care Pathway** to ensure that EHR implementations support the full longitudinal journey of a patient at risk.

## The SPiER Pathway
1.  **Flag Risk:** Capture suicide-related signals (e.g., ASQ, PHQ-9 Item 9).
2.  **Clarify Risk:** Detailed assessment (e.g., C-SSRS Full, CAMS SSF-5).
3.  **Set Risk Status:** Clinical formulation and risk level documentation (e.g., SAFE-T).
4.  **Document Safety Actions:** Collaborative safety planning and means counseling (e.g., Stanley-Brown).
5.  **Coordinate Handoffs:** Ensuring safety data follows the patient during transitions.
6.  **Track Follow-Up:** Closed-loop outreach and caring contacts.
7.  **Manage Active Risk:** Ongoing monitoring and treatment updates for in-episode patients.
8.  **Measure and Share:** Pathway analytics and quality improvement.

## Repository Structure
The repository is moving toward a stage-based organization, while maintaining framework-specific technical assets:

*   **`web/`**: The SPiER Dashboard (React/TS), demonstrating the interactive pathway and EHR adoption rubric.
*   **`docs/`**: Global strategy, validation guides, and the project overview.
*   **`FHIR-Resources/`**: Contains the canonical FHIR resources organized by pathway stage (e.g., `1-Flag-Risk/ASQ`, `4-Document-Safety-Actions/Stanley-Brown`).

## Getting Started

See [docs/README.md](docs/README.md) for a guide to the documentation.

## Key Clinical Frameworks
1.  **CAMS (Collaborative Assessment and Management of Suicidality)**
2.  **Stanley-Brown Safety Plan**
3.  **ASQ (Ask Suicide-Screening Questions)**
4.  **CSS-RS (Columbia-Suicide Severity Rating Scale)**

## Contributing
This repository contains the canonical source for SPiER's technical and clinical definitions.

## Roadmap & issue tracking

Tool-level and cross-cutting work is tracked in [GitHub Issues](https://github.com/bbthorson/SPiER/issues). The Roadmap page on the site reads from a committed snapshot at `web/src/data/roadmap.generated.json`.

Workflow:

- One-time seed of the label taxonomy + initial epics: `node scripts/seed-roadmap-issues.mjs` (re-runnable; idempotent).
- Refresh the site's snapshot after editing issues: `node web/scripts/fetch-roadmap.mjs`. The result is committed.

Label conventions: `tool:TL-XXX`, `priority:p1|p2|p3`, `status:built|planned|future`, `type:epic|task`, `stage:<slug>`, `area:<slug>`.

## Authoring new assessments

The `.claude/skills/assessment-to-ig/` skill walks Claude through converting a validated clinical assessment into the full SPiER artifact set (Questionnaire JSON + FSH + IG page + catalog wiring). The `fhir-questionnaire-quality` skill is the review counterpart.
