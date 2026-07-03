# SPiER (Suicide Prevention in Electronic Health Records)

**Live:** [Implementation Guide](https://spier-project.github.io/adoption-guide/ig/) · [Companion app](https://spier-project.github.io/adoption-guide/) · [Roadmap](https://github.com/SPiER-Project/adoption-guide/milestones)

## Mission

**SPiER's mission is to make suicide-safer care the standard everywhere.** Front-line professionals encounter people at risk every day, but the tools and supports for suicide-safer care often aren't built into the systems they rely on — so critical opportunities for care get missed.

The reason is that everything that matters in suicide prevention currently lives only in human-readable form — validated screeners on paper, the equivalences between different tools in clinicians' heads, response protocols in plain-text guidelines. SPiER closes that gap by making each layer machine-actionable, in three steps that build on each other:

- **Capture** — translate validated tools (the **ASQ**, **C-SSRS**, **Stanley-Brown Safety Plan**, and others) out of paper and PDF into a single canonical FHIR shape (`Questionnaire` / `QuestionnaireResponse`), so each instrument is recorded identically in every system that uses it.
- **Translate** — define a shared, instrument-agnostic suicide-risk concept that every tool maps *into*, so a receiving system can act on a result **without having to run the same tool that produced it**. This mirrors the approach HL7's Gravity Project took for social-determinants screening.
- **Act** — encode the already-settled response protocols as executable logic (`PlanDefinition` + CDS Hooks), so the right next step surfaces at the right moment. SPiER recommends; the clinician decides.

We organize the work around an **8-stage Suicide Safer Care Pathway** so that implementations support the full longitudinal journey of a patient at risk — not just a single screen.

**How we deliver it.** The standards are **free, open, and vendor-neutral** — Implementation Guides, FHIR profiles, and value sets that any EHR or health system can adopt at no cost, with no vendor owning the canonical shape. Alongside the standards, SPiER partners across healthcare, behavioral health, community-based, and technology settings to embed these tools into the systems people already use, providing subject-matter expertise, training, and technical assistance.

## How SPiER works

The three steps are a dependency chain, and a roadmap: you can't translate a result you never captured in a structured way, and you can't automate a response to a risk tier you can't compute.

- **Capture** is the most mature: National standards like US Core and USCDI cover the basics — demographics, diagnoses, medications — but don't yet specify *how* suicide screeners, risk assessments, and safety plans should be captured. SPiER fills that gap, translating each tool into a canonical FHIR shape and contributing it to the existing HL7 workgroups, paired with a coalition of provider organizations who can collectively *demand* that consistency from their EHR vendors.
- **Translate** is the differentiator: partners don't all use the same instruments, and a result is useless to a system that can't read the instrument behind it. The harmonized concept layer — a common risk tier on a generic LOINC — is screening-level and *unconfirmed*, always linked back to the full-fidelity capture, and is SPiER's most contributable standards artifact.
- **Act** is the frontier: it's an *encoding* problem rather than a *consensus* problem, because the protocol content is already endorsed. The clinician or the institution's configured policy acts; SPiER delivers the right recommendation at the right moment.

**Why this matters.** Captured, translated, and made actionable, a patient's safety information can travel across systems — EHRs hold the data, Health Information Exchanges move it between organizations — and be available wherever the patient shows up next. A patient screened with the ASQ in an ED, assessed with the Columbia Scale, and discharged with a Stanley-Brown Safety Plan is often re-screened from scratch at an outpatient clinic 48 hours later. With SPiER's work in place, the next clinician can see what's already been done — what screener, what risk level, what coping strategies the patient identified — and pick up where the ED left off. The same standardized data also gives systems a foundation for measurement and quality improvement at the population level.

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

*   **`ig/`**: The HL7 FHIR Implementation Guide — FSH sources in `input/fsh/` compiled by SUSHI, plus the IG Publisher configuration. Rendered and published at the [Implementation Guide](https://spier-project.github.io/adoption-guide/ig/) link above.
*   **`web/`**: The SPiER companion app (React/TS) — the interactive pathway demo, patient and population views, and EHR adoption rubric. Deployed to GitHub Pages at `/adoption-guide/`.
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

Tool-level and cross-cutting work is tracked in [GitHub Issues](https://github.com/SPiER-Project/adoption-guide/issues). The Roadmap page on the site reads from a committed snapshot at `web/src/data/roadmap.generated.json`.

Workflow:

- One-time seed of the label taxonomy + initial epics: `node scripts/seed-roadmap-issues.mjs` (re-runnable; idempotent).
- Refresh the site's snapshot after editing issues: `node web/scripts/fetch-roadmap.mjs`. The result is committed.

Label conventions: `tool:TL-XXX`, `priority:p1|p2|p3`, `status:built|planned|future`, `type:epic|task`, `stage:<slug>`, `area:<slug>`.

## Authoring new assessments

The `.claude/skills/assessment-to-ig/` skill walks Claude through converting a validated clinical assessment into the full SPiER artifact set (Questionnaire JSON + FSH + IG page + catalog wiring). The `fhir-questionnaire-quality` skill is the review counterpart.
