# Conformance

> **Status: draft.** SPiER is a draft IG (FMM 0–1). Must-Support flags and the role CapabilityStatements described below are now defined, but remain draft/experimental — treat them as the intended conformance contract, not yet balloted.

## Actor roles

Rather than a single monolithic specification, SPiER defines conformance per **system role** (the approach used by the HL7 [Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/)). The roles map directly onto SPiER's audiences and its cross-EHR portability pilot:

- **Screening-source EHR** — captures an instrument as a `QuestionnaireResponse` and produces the derived instrument Observation(s) and the harmonized suicide-risk concept Observation.
- **HIE intermediary** — stores and forwards those resources across organizations without losing fidelity or provenance.
- **Risk consumer / client** — reads the harmonized concept (and, optionally, the underlying capture data) to surface actionable suicide-risk information at the point of care.

Each role has a `CapabilityStatement` declaring the resources and interactions it supports:

- [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html) — produces the screening data.
- [HIE Intermediary](CapabilityStatement-hie-intermediary.html) — stores and forwards it.
- [Risk Consumer](CapabilityStatement-risk-consumer.html) — reads the harmonized concept.

## What "Must-Support" means

Following [US Core](https://hl7.org/fhir/us/core/conformance-expectations.html), Must-Support is defined **operationally, by role**:

- A **producer** (screening-source EHR) *SHALL be capable of populating* every Must-Support element.
- A **consumer** (risk client) *SHALL be capable of processing* instances containing those elements *without erroring or failing*.
- **Missing-data semantics:** when an element's absence reason is unknown, a producer SHALL omit the element, and a consumer SHALL interpret a missing element as *data not present* (not as an error).

Must-Support identifies *what must be supported* — it does **not** constrain maximum cardinality, so source systems are never forced to strip data out.

## The concept layer is screening-level

The harmonized suicide-risk tier (generic LOINC `93374-7`) is a **derived, unconfirmed** signal: it indicates a screen result warranting follow-up, not a confirmed clinical finding. Consumers SHOULD treat it as a triage/routing signal and preserve the `derivedFrom` link to the originating `QuestionnaireResponse`. See [How to Read This Guide](how-to-read.html#two-layer-model).

## Maturity

SPiER is FMM 0–1. Advancing maturity requires evidence from **independently developed implementations** (FMM 2 expects interoperability across 3+ such systems); the current HIE portability pilot and planned HL7 Connectathon participation are the path there. Maturity is tracked per artifact, not coupled mechanically to ballot status.
