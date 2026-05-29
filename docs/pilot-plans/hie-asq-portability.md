# Pilot Plan: Cross-EHR Suicide Risk Portability (ASQ)

> **Public, sanitized draft.** Named partner organizations, vendors, individuals, grants, and specific federal initiatives are referenced by role only. The fully-named planning document lives outside this repository.

**Anchor epic:** [#60 — HIE Pilot: ASQ cross-EHR portability (two-phase)](https://github.com/bbthorson/SPiER/issues/60)

---

## 1. Executive Summary

The objective of this pilot is to demonstrate that a structured suicide risk screening — specifically the Ask Suicide-Screening Questions (ASQ) panel — captured at one care site running EHR vendor A can be seamlessly transmitted across a state Health Information Exchange and viewed as actionable data within a second care site running EHR vendor B.

By anchoring the pilot on a federal Behavioral Health interoperability dataset and an active federal regulator's behavioral-health IT initiative, the pilot is not just a local demonstration. It is intended to produce a national blueprint for behavioral-health data portability.

---

## 2. The Clinical Artifact: ASQ Panel

The pilot's primary data payload is the **ASQ panel (LOINC 93373-9)**.

The ASQ panel is the referenced example for "Suicide Risk Screen" in the active federal Behavioral Health dataset, though it is not explicitly required. The pilot treats this as both leverage (the dataset already names ASQ) and risk (example status is weaker than required status). One pitch element to the federal regulator is the case for promoting the screen from example to required.

- **Standardization:** Full ASQ panel coded to LOINC at the panel and per-item level.
- **Precision coding:** Patient Yes/No responses bound to SNOMED CT codes rather than booleans. This preserves the conditional logic of the acuity follow-up item — the SNOMED-bound representation distinguishes "not asked" from "negative," which a boolean representation cannot.
- **Source:** The SPiER FHIR Questionnaire and supporting artifacts for ASQ live at [`FHIR-Resources/ASQ/`](../../FHIR-Resources/ASQ/).

---

## 3. Technical Roadmap: Two-Phase Implementation

The pilot is structured as two phases. The contrast between the two phases is the measurement.

### Phase 1 — Transport Benchmark (document-based)

- **Goal:** Prove discrete ASQ observations can move across the state.
- **Mechanism:** The originating site's EHR emits a Consolidated Clinical Document Architecture (C-CDA) containing the ASQ panel as **discrete observations**, not as embedded narrative. The HIE ingests via its existing interface-engine pipeline.
- **Outcome:** ASQ data is viewable at the receiving site as an external-record document.

### Phase 2 — Actionability Benchmark (FHIR API)

- **Goal:** Prove the data can land in the native clinician workflow at the receiving site.
- **Mechanism:** The HIE surfaces the ASQ observations via FHIR API using its existing bulk FHIR infrastructure.
- **Outcome:** ASQ results render as discrete data points in the receiving site's patient chart, sitting alongside other clinical assessments rather than buried inside a viewable PDF.

The hard step in Phase 2 is the receiving side's write-back to discrete chart fields. This is treated as its own milestone, separately from the FHIR-API surfacing itself.

---

## 4. Roles & Governance

A "lanes of responsibility" model defines accountability:

| Lane | Primary Responsibility |
|---|---|
| **SPiER (project sponsor + clinical lead + standards lead)** | Clinical content leadership, FHIR Questionnaire maintenance, project management, and the HL7 / federal-regulator track. |
| **HIE partner** | HIE infrastructure, data ingestion and parsing, and consent management under 42 CFR Part 2. |
| **External evaluator** | Independent evaluation across both phases — implementation difficulty, vendor friction, data fidelity, format utility. |
| **Originating care site** | EHR-side configuration to emit discrete ASQ observations; clinician feedback. |
| **Receiving care site** | EHR-side configuration to ingest discrete ASQ observations into the chart; clinician feedback. |

---

## 5. Workstreams & Milestones

### Workstream A — Data Specification (Month 1)

- Finalize LOINC and SNOMED bindings for the ASQ panel.
- Publish the pilot-specific ASQ Implementation Guide covering both C-CDA and FHIR profiles.
- Resolve open LOINC verification questions documented in [`web/src/data/pilot-plans/asq.md`](../../web/src/data/pilot-plans/asq.md).

### Workstream B — HIE and originating-site integration (Months TBD)

- Configure the originating EHR's outbound clinical-summary documents to include the ASQ section as discrete observations.
- Validate the HIE's parsing of those observations into its clinical data architecture.

### Workstream C — Receiving-site integration and retrieval (Months TBD)

- Configure the receiving EHR to ingest and display data from the HIE.
- Execute the Phase 1 demonstration (C-CDA path) end-to-end.
- Execute the Phase 2 demonstration (FHIR API path) end-to-end, including the discrete write-back milestone.

### Workstream D — Evaluation and reporting (Months TBD)

- External evaluator performs the implementation-difficulty assessment.
- Final report delivered.

Workstream B/C/D timelines are open. The kickoff strategy call between SPiER, the HIE partner, and the external evaluator's technical lead is the next decision point.

---

## 6. Evaluation Framework

The pilot moves beyond "did it work?" to "what did it cost, and which transport format is more useful?" The evaluation measures:

- **Effort.** Analyst and clinician hours required for the originating-side configuration vs. the receiving-side configuration, separately for Phase 1 and Phase 2.
- **Vendor friction.** The degree of dependency on EHR-vendor professional services vs. work the local site can do on its own configuration surface.
- **Data fidelity.** The proportion of payload elements that survive the trip from originating site to receiving site as discrete, queryable data rather than free text.
- **Format utility.** A head-to-head comparison of C-CDA-based ingestion vs. FHIR-API-based ingestion as inputs to downstream clinician decision support.

For the comparison to be defensible, both phases share an identical payload definition and a documented receiving-site configuration baseline. Locking that in is a Workstream A deliverable.

---

## 7. Next Steps

1. Execute the bilateral agreement between SPiER and the HIE partner (Layer 1 MOU).
2. Introduce the receiving-site clinical lead and the originating-site partner to the two-phase roadmap and confirm site-level participation (Layer 2 — site-level agreements).
3. Schedule the kickoff strategy call referenced under Workstream B/C/D.
4. Finalize the federal-regulator briefing material (tracked under [#65](https://github.com/bbthorson/SPiER/issues/65)) — the pilot is the empirical anchor.

---

## Related epics

- [#60](https://github.com/bbthorson/SPiER/issues/60) — Anchor epic for this pilot.
- [#61](https://github.com/bbthorson/SPiER/issues/61) — ED Functional Profile. The ED scenario shares tools and downstream artifacts with this pilot.
- [#64](https://github.com/bbthorson/SPiER/issues/64) — Tool licensing audit. ASQ licensing letter must be on file before the IG is publicly hosted.
- [#65](https://github.com/bbthorson/SPiER/issues/65) — Federal-regulator briefing. This pilot is the demo flow.
