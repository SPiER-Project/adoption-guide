# How to Read This Guide

This guide follows the information architecture used by [HL7 US Core](https://hl7.org/fhir/us/core/), so if you've read a FHIR IG before, the layout will be familiar.

## The menu

- **Home** — what SPiER is, its status, and who it's for.
- **Getting Started** — how to obtain the artifacts and validate your own resources against them.
- **Guidance** — this page, plus the Zero Suicide ↔ SPiER mapping.
- **Conformance** — what it means to conform to SPiER (actor roles, Must-Support — in progress).
- **Quick Starts** — per-instrument RESTful search patterns to read SPiER data.
- **Artifacts** — the full machine-readable list of every profile, extension, value set, code system, and example (generated).
- **Downloads** — the IG package and resource definitions for tooling (generated).

## Reading a profile page

Each profile (e.g. *SPiER ASQ Screening Result Observation*) shows the base resource it constrains, a formal element table (cardinality, type, bindings), and links to examples. Today:

- **Cardinality** — `1..1` means required, `0..*` optional and repeating, etc.
- **Bindings** — `required` means a value **must** come from the named value set; `extensible`/`preferred` are looser.
- **`draft` / `experimental`** — every SPiER profile currently carries these flags. They are correct for a pre-publication IG and signal that definitions may still change; plan for it.
- **Must-Support** — not yet flagged on SPiER profiles. Formal Must-Support (which elements a producer must populate and a consumer must process) is being added next; see [Conformance](conformance.html).

## The two-layer model {#two-layer-model}

SPiER deliberately separates **capture** from **concept**:

| Layer | What it holds | Coding | Fidelity |
|---|---|---|---|
| **Capture** (per instrument) | Every question and answer | Instrument LOINC / SNOMED, local item codes | High |
| **Concept** (harmonized) | "Positive screen, this severity tier, this date" | One common suicide-risk tier on generic LOINC `93374-7` | Lower, universally consumable |

The concept layer is **derived from** the capture layer and linked back via `Observation.derivedFrom` — it never replaces it. Instruments with a coded disposition (ASQ, C-SSRS) map via **ConceptMaps**; score-based instruments (PHQ-9 Item 9, SBQ-R) map via **StructureMaps**. The derived concept is a **screening-level, unconfirmed** signal — it flags a need for follow-up, not a diagnosis. This pattern is modeled on the HL7 [Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/) and [SDC](https://hl7.org/fhir/uv/sdc/).

## Clinical primer (for non-clinical engineers) {#clinical-primer}

You do not need clinical training to implement SPiER. The instruments, in one line each:

- **ASQ** (Ask Suicide-Screening Questions) — a 4+1-item yes/no screen; a positive item plus the acuity question yields negative / non-acute-positive / acute-positive.
- **C-SSRS** (Columbia-Suicide Severity Rating Scale) — graded ideation/behavior items yielding a none/low/moderate/high risk level; a Screener and a fuller Lifetime/Recent variant.
- **PHQ-9** — a depression screen whose **Item 9** ("thoughts of being better off dead or self-harm", scored 0–3) is the suicide-relevant signal.
- **SBQ-R** (Suicide Behaviors Questionnaire-Revised) — a 4-item total score (3–18) with validated cutoffs (≥7 general population, ≥8 inpatient).

All of these map onto the common suicide-risk tier described above.
