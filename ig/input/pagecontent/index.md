### The SPiER Project

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

### Find what you need

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

### Status

Profiles, crosswalks and CapabilityStatements are `draft` / `experimental` and
may change before Trial-Use; if you implement now, pin version `0.1.0`. The
cross-instrument risk-tier harmonization is a **proposed reference model**
authored by SPiER and not yet reviewed by suicide-prevention subject-matter
experts or the Zero Suicide Institute — validate the tier assignments against
your own clinical protocols before relying on them (see
[Harmonization status](conformance.html#harmonization-status)). How the
pathway relates to the Zero Suicide framework is on the
[Zero Suicide ↔ SPiER mapping](zero-suicide-mapping.html) page.

Seven instruments' results share the harmonized tier's LOINC code, so a search
on that code alone mixes the two layers; read
[Known limitations](conformance.html#known-limitations) before you query for
the tier.

### Licensing {#licensing}

The CC0 license covers what SPiER wrote: the profiles, extensions, value sets,
code systems, maps, pathways, measures and narrative. **It does not cover the
instruments.** Several Questionnaires reproduce instruments whose developers
hold the copyright — among them the C-SSRS, CAMS, the Stanley-Brown Safety Plan
and the SBQ-R — and their terms of use are the developers' to set, not SPiER's.
Each Questionnaire states its copyright, and each instrument's
ActivityDefinition carries a coded
[licensing status](StructureDefinition-instrument-licensing-status.html), which
can be `unknown`.

> **Before you deploy any instrument, contact SPiER at
> [ksamuelson@zerooverdose.org](mailto:ksamuelson@zerooverdose.org) about
> licensing**, and confirm the developer's current terms for your use. No
> licensing status in this guide has been checked against what the developers
> publish today.

### Intellectual property statements

{% include ip-statements.xhtml %}

### Dependencies

{% include dependency-table.xhtml %}

### Global profiles

{% include globals-table.xhtml %}

### Cross-version analysis

{% include cross-version-analysis.xhtml %}
