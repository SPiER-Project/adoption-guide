# SPiER (Suicide Prevention in Electronic Health Records)

**Live:** [Implementation Guide](https://bbthorson.github.io/SPiER/ig/) · [Companion app](https://bbthorson.github.io/SPiER/) · [Roadmap](https://github.com/bbthorson/SPiER/milestones)

## Mission

**SPiER's mission is to make suicide-safer care the standard everywhere.** Front-line professionals encounter people at risk every day, but the tools and supports for suicide-safer care often aren't built into the systems they rely on — so critical opportunities for care get missed. SPiER exists to close that gap, in two complementary ways:

- **Free, open standards.** We translate research-validated suicide-prevention tools out of paper and PDF into structured, interoperable **HL7 FHIR** artifacts — Implementation Guides, profiles, and value sets — that any EHR or health system can adopt at no cost. The standards are vendor-neutral; nothing needs to be purchased to use them.
- **Partnership and implementation support.** We partner across healthcare, behavioral health, community-based, and technology settings to embed these tools into the systems people already use — providing subject-matter expertise, training, and technical assistance, and helping partners strengthen suicide-safer care over time.

We organize the work around an **8-stage Suicide Safer Care Pathway** so that implementations support the full longitudinal journey of a patient at risk — not just a single screen.

## How SPiER works

SPiER takes research-validated suicide prevention tools — the **ASQ** screener, the **Columbia Suicide Severity Rating Scale**, the **Stanley-Brown Safety Plan**, and others — and turns them into structured, machine-readable forms that any EHR or health system can implement the same way.

The work has two halves that meet in the middle:

- **EHR side (capture):** National standards like US Core and USCDI cover the basics — demographics, diagnoses, medications — but don't yet specify *how* suicide screeners, risk assessments, and safety plans should be captured. SPiER fills that gap by translating each tool into a single canonical FHIR shape and contributing it to the existing HL7 workgroups already shaping clinical data standards. In parallel, we build a coalition of provider organizations who can collectively *demand* that consistency from their EHR vendors.
- **HIE side (exchange):** EHRs hold the data; Health Information Exchanges move it between organizations. A safety plan written in an emergency department is only useful if the patient's next clinician can actually see it. So our work with HIEs is about making suicide-safer-care data *findable and shareable* across organizations — not just locked in the chart that first created it.

The common entry point for every partner conversation — EHR vendor, HIE, or other — is the 8-stage Suicide Safer Care Pathway below. We ask which stages a partner supports today, and where the gaps are. The artifacts SPiER produces plug in at different points depending on the partner, but the underlying model doesn't change.

**Why this matters.** A patient screened with the ASQ in an ED, assessed with the Columbia Scale, and discharged with a Stanley-Brown Safety Plan is often re-screened from scratch when they show up at an outpatient clinic 48 hours later. With SPiER's standards work and HIE work in place, the next clinician can see what's already been done — what screener, what risk level, what coping strategies the patient identified — and pick up where the ED left off. The same standardized data also gives systems a foundation for measurement and quality improvement at the population level.

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

*   **`ig/`**: The HL7 FHIR Implementation Guide — FSH sources in `input/fsh/` compiled by SUSHI, plus the IG Publisher configuration. Rendered and published at the [Implementation Guide](https://bbthorson.github.io/SPiER/ig/) link above.
*   **`web/`**: The SPiER companion app (React/TS) — the interactive pathway demo, patient and population views, and EHR adoption rubric. Deployed to GitHub Pages at `/SPiER/`.
*   **`FHIR-Resources/`**: The canonical Questionnaire JSON and per-tool FHIR assets, organized by instrument (`ASQ/`, `C-SSRS/`, `CAMS/`, `PHQ-9/`, `SBQ-R/`, `Stanley-Brown/`).
*   **`docs/`**: Global strategy, validation guides, and the project overview.
*   **`scripts/`**: Roadmap seeding and other repository tooling.

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
