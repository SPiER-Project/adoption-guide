# The SPiER Project

| | |
|---|---|
| **Standards status** | Draft (continuous build) — *not yet balloted or published* |
| **Maturity** | FMM 0–1 (pre–Trial-Use) |
| **Version** | 0.1.0 |
| **FHIR version** | R4 (4.0.1) |
| **Realm** | US |

SPiER publishes the suicide-safer care pathway as FHIR: the validated screening
and assessment instruments as Questionnaires, one instrument-agnostic
suicide-risk tier that every instrument maps into, and the PlanDefinitions,
ActivityDefinitions and Measures that turn the clinical response into
executable logic. The artifacts are free and open, and no vendor owns the
canonical shape. The project story behind them is in the
[repository README](https://github.com/SPiER-Project/adoption-guide#readme).

Written for **software developers and integrators** — EHR vendors, HIE teams
moving suicide-risk data between organizations, and HL7 work groups evaluating
the artifacts.

## Find what you need

| You want to… | Go to |
|---|---|
| Load an instrument's form (ASQ, PHQ-9, C-SSRS, …) | the [instruments group](artifacts.html#1) on the Artifacts page — each Questionnaire is downloadable as JSON |
| Get the package and validate your own resources | [Getting Started](getting-started.html) |
| Query a FHIR server for SPiER data | [Quick Starts](quick-starts.html) |
| Know what conforming to SPiER means | [Conformance](conformance.html) |
| Run the pathway as a protocol | [Care Pathway](care-pathway.html) |
| Score the quality measures | [Measures](measurement.html) |
| Understand the model and the clinical terms | [Reading the artifacts](how-to-read.html) |
| Browse everything | [Artifacts](artifacts.html), in eight groups |

## Status

Profiles, crosswalks and CapabilityStatements are `draft` / `experimental` and
may change before Trial-Use; if you implement now, pin version `0.1.0`. The
cross-instrument risk-tier harmonization is a **proposed reference model**
authored by SPiER and not yet reviewed by suicide-prevention subject-matter
experts or the Zero Suicide Institute — validate the tier assignments against
your own clinical protocols before relying on them (see
[Harmonization status](conformance.html#harmonization-status)). How the
pathway relates to the Zero Suicide framework is on the
[Zero Suicide ↔ SPiER mapping](zero-suicide-mapping.html) page.
