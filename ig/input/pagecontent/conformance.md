# Conformance

> **Status: in progress.** SPiER is a draft IG (FMM 0–1). This page describes the conformance model SPiER is adopting. Formal **Must-Support** flags and **CapabilityStatements** are being authored next; until they land, treat the expectations below as the intended direction, not yet binding conformance.

## Actor roles

Rather than a single monolithic specification, SPiER will define conformance per **system role** (the approach used by the HL7 [Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/)). The roles map directly onto SPiER's audiences and its cross-EHR portability pilot:

- **Screening-source EHR** — captures an instrument as a `QuestionnaireResponse` and produces the derived instrument Observation(s) and the harmonized suicide-risk concept Observation.
- **HIE intermediary** — stores and forwards those resources across organizations without losing fidelity or provenance.
- **Risk consumer / client** — reads the harmonized concept (and, optionally, the underlying capture data) to surface actionable suicide-risk information at the point of care.

Each role will get its own `CapabilityStatement` declaring the resources and interactions it supports.

## What "Must-Support" will mean

Following [US Core](http://hl7.org/fhir/us/core/STU4/conformance-expectations.html), Must-Support will be defined **operationally, by role**:

- A **producer** (screening-source EHR) *SHALL be capable of populating* every Must-Support element.
- A **consumer** (risk client) *SHALL be capable of processing* instances containing those elements *without erroring or failing*.
- **Missing-data semantics:** when an element's absence reason is unknown, a producer SHALL omit the element, and a consumer SHALL interpret a missing element as *data not present* (not as an error).

Must-Support will identify *what must be supported* — it will **not** constrain maximum cardinality, so source systems are never forced to strip data out.

## The concept layer is screening-level

The harmonized suicide-risk tier (generic LOINC `93374-7`) is a **derived, unconfirmed** signal: it indicates a screen result warranting follow-up, not a confirmed clinical finding. Consumers SHOULD treat it as a triage/routing signal and preserve the `derivedFrom` link to the originating `QuestionnaireResponse`. See [How to Read This Guide](how-to-read.html#two-layer-model).

## Maturity

SPiER is FMM 0–1. Advancing maturity requires evidence from **independently developed implementations** (FMM 2 expects interoperability across 3+ such systems); the current HIE portability pilot and planned HL7 Connectathon participation are the path there. Maturity is tracked per artifact, not coupled mechanically to ballot status.
