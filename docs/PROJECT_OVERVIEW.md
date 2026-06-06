# Project Overview: SPiER (Suicide Prevention in Electronic Health Records)

## Mission
The SPiER project is a non-profit initiative dedicated to translating research-validated suicide prevention tools from paper-based formats into structured, interoperable healthcare data standards (e.g., HL7 FHIR). The goal is to make these high-quality tools easily accessible to EHR vendors and healthcare systems to improve the identification, assessment, and management of suicide risk.

## How SPiER's Work Connects to HL7 Standards

HL7 is the standards body that defines how healthcare data is structured and exchanged (FHIR is their modern standard). National standards like **US Core** and **USCDI** already cover the basics — demographics, diagnoses, medications — but they don't yet specify *how* suicide screeners, risk assessments, and safety plans should be captured. That's the gap SPiER fills.

Today, every EHR captures suicide risk information a little differently — same questions, different shapes. That makes the data hard to share, hard to measure, and hard to act on.

SPiER's work has two halves:

- **Standards side:** Translate each tool (ASQ, Columbia, Stanley-Brown, and others) into a single canonical FHIR shape, and contribute that work to the existing HL7 workgroups already shaping clinical data standards. The path is **draft → test with partners → contribute to HL7 → influence the published standard.**
- **Provider side:** Build a coalition of provider organizations who can collectively *demand* this consistency from their EHR vendors. Standards work alone is slow; standards plus a clear customer ask is what drives adoption nationwide.

## How the HIE Work Connects to the EHR Work

EHRs hold the data; **Health Information Exchanges (HIEs) move it between organizations.** A safety plan written in an emergency department is only useful if the patient's outpatient provider, crisis line, or next ED visit can actually see it. The HIE work is the second half of the same workstream:

- **With EHR vendors:** make sure suicide-safer-care data is *captured* in a standard shape.
- **With HIEs:** make sure that data is *findable and shareable* across organizations.

**Toward a repeatable workstream across partner types.** The common entry point for every partner conversation is the 8-stage Suicide Safer Care Pathway (below). Whether the partner is an EHR, an HIE, or another vendor, the opening rubric is the same: *which of these stages do you support today, and where are the gaps?* The specific FHIR artifacts SPiER produces plug in at different points depending on the partner, but the underlying model doesn't change. We are not yet at a turnkey playbook — each engagement still teaches us something — but the pattern is consolidating.

## Why This Matters for Suicide-Safer Care Transitions

A patient at risk of suicide moves through many hands: ED, inpatient, outpatient, primary care, crisis line, community provider. Today, the safety plan and risk assessment too often stay behind with the system that created them.

When SPiER's standards work and HIE work come together, **the patient's safety information becomes available wherever they show up next — not just locked in the chart that first created it.**

**A concrete example.** A patient is screened with the ASQ in an emergency department, assessed with the Columbia Scale, and discharged with a Stanley-Brown Safety Plan. Forty-eight hours later, they are seen by an outpatient clinician at a different organization. Today, that clinician usually starts from scratch — re-screens, re-asks, re-builds the plan. With SPiER's work in place, the clinician can see what's already been done — what screener, what risk level, what coping strategies and supports the patient already identified — and pick up where the ED left off.

The same standardized data also gives systems a foundation for measuring whether the pathway is working — a path to quality improvement at the population level.

## The Concept Layer: Cross-Instrument Harmonization

Partners do not all use the same instruments. One site screens with the ASQ, another with the Columbia (C-SSRS), another with PHQ-9 Item 9 — and some instruments (ASQ item-level) have no published LOINC codes at all. A receiving system shouldn't have to understand every tool to act on a result. SPiER therefore works in **two layers**:

- **Capture layer (instrument):** every question and answer, in high fidelity, coded to instrument-specific LOINC/SNOMED. This is what `assessment-to-ig` and `fhir-questionnaire-quality` already produce and police.
- **Concept layer (harmonized):** an instrument-agnostic, lower-fidelity but universally consumable summary — *"positive screen, this severity tier, this date"* — that every instrument maps **into**, derived from the capture layer and linked back to it.

This mirrors HL7's **Gravity Project**, which harmonized ~135 SDOH screening instruments to a common set of coded concepts, and rides on **HL7 SDC** extraction mechanics. The concept layer is where a "translation layer to a universally known code set" actually lives: a single common suicide-risk-tier ValueSet, carried on a generic LOINC (`93374-7` "Suicide risk level") with a universal `interpretation` flag, populated from each instrument via a portable FHIR ConceptMap/StructureMap. Lower-fidelity instruments map to the widest defensible tier — the layer never fabricates precision it doesn't have, and the derived concept is treated as an *unconfirmed* screen warranting follow-up, not a diagnosis.

This asset is also SPiER's most contributable standards artifact. The path is **build it in-IG → prove it in the Big Sky Care Connect pilot → contribute to an HL7 Work Group (Behavioral Health / Patient Care)**, with a standalone harmonization IG as a stage-2 ambition contingent on pilot traction. See `docs/best-practices/concept-harmonization.md` and the `concept-harmonization` skill for the conformance rules.

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

The **cross-instrument concept layer** (see above) is its own workstream epic — building the common suicide-risk-tier ValueSet, the per-instrument ConceptMap/StructureMap crosswalks, and the harmonized derived-Observation profile, validated through the Big Sky Care Connect pilot.

## Project Phases
1.  **Indexing & Discovery:** Inventorying existing assets and documentation (See `MANIFEST.md`).
2.  **Strategic Alignment:** Defining the mission and technical architecture.
3.  **Asset Translation:** Ongoing development of FHIR-based versions of core tools.
4.  **Consent & Security:** Developing models for patient-controlled data sharing across health systems.

---
*Created: 2026-02-04*
