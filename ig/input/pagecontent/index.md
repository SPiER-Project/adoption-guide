# SPiER — Suicide Prevention in Electronic Records

| | |
|---|---|
| **Standards status** | Draft (continuous build) — *not yet balloted or published* |
| **Maturity** | FMM 0–1 (pre–Trial-Use) |
| **Version** | 0.1.0 |
| **FHIR version** | R4 (4.0.1) |
| **Realm** | US |

A FHIR-native reference implementation of the suicide-safer care pathway, developed in alignment with the **[Zero Suicide framework](https://zerosuicide.edc.org/)**. SPiER turns research-validated suicide-prevention instruments into portable FHIR artifacts so that a screen captured in one system can be **understood and acted on anywhere the patient is next seen**.

> **New here? Read [Getting Started](getting-started.html) and [How to Read This Guide](how-to-read.html).** You should be able to grasp the scope, who it's for, and what implementing it involves in about 30 minutes.

## What's in this guide

SPiER models the screening instruments and the eight technical stages of suicide-safer care as FHIR `Questionnaire`, `Observation`, `CarePlan`, `PlanDefinition`, and `ActivityDefinition` resources. It works in **two layers**:

- **Capture layer** — instrument-specific profiles (ASQ, C-SSRS, PHQ-9, SBQ-R, Stanley-Brown, CAMS) with their native LOINC/SNOMED coding, in full fidelity.
- **Concept layer** — a single, instrument-agnostic *suicide-risk tier* (carried on the generic LOINC `93374-7`) that every instrument maps into, so a downstream system can consume a result without understanding the originating tool. See [How to Read This Guide](how-to-read.html#two-layer-model).

## Who this is for

Written first for **software developers and integrators**:

- **EHR vendors** supporting suicide-safer-care workflows in their products.
- **HIE / interoperability teams** moving suicide-risk data across organizations (this IG anchors a cross-EHR portability pilot with a state HIE).
- **HL7 work groups and IG authors** evaluating SPiER as a basis for standardized suicide-prevention FHIR artifacts.

A short clinical primer for the screening terms is in [How to Read This Guide](how-to-read.html#clinical-primer); the [Conformance](conformance.html) page describes what conforming to SPiER means.

## Companion resources

- **[Interactive companion app](https://bbthorson.github.io/SPiER/)** — a React application demonstrating the pathway in a simulated EHR (8-stage patient chart, population view, tool configuration, roadmap). It doubles as a working **reference implementation**.
- **[GitHub repository](https://github.com/bbthorson/SPiER)** — source for both this IG and the companion app; use [Issues](https://github.com/bbthorson/SPiER/issues) for feedback.

## Status & expectations

**Draft / continuous build.** Profiles are `draft` / `experimental`; the concept-layer crosswalks are drafted but pending clinical sign-off. Formal conformance artifacts (Must-Support, CapabilityStatements) are in progress — see [Conformance](conformance.html). Maturity is signaled honestly: SPiER is early (FMM 0–1) and advancing through real-world piloting toward independent multi-system validation.

See the [Zero Suicide ↔ SPiER mapping](zero-suicide-mapping.html) for how the pathway relates to the broader Zero Suicide framework, and the [Roadmap](https://bbthorson.github.io/SPiER/#/implementation-guide/roadmap) for build status across the catalogued tools.
