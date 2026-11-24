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

**By what you are building:**

| You are building… | Start at |
|---|---|
| An EHR that captures screens and writes SPiER data | [Implementing a Screening-Source EHR](implement-screening-source-ehr.html) |
| An HIE or platform that moves SPiER data between organizations | [Exchanging SPiER Data](exchange.html) |
| A client that reads suicide risk at the point of care | [Quick Starts](quick-starts.html) |
| Quality reporting over the pathway | [Measures](measurement.html) |

**By task:**

| You want to… | Go to |
|---|---|
| Find an instrument's form, result profile and worked example (ASQ, PHQ-9, C-SSRS, …) | [Instruments](instruments.html) — each Questionnaire is downloadable as JSON |
| Get the package and validate your own resources | [Getting Started](getting-started.html) |
| Know what conforming to SPiER means | [Conformance](conformance.html) |
| Run the pathway as a protocol | [Care Pathway](care-pathway.html) |
| Understand the model and the clinical terms | [Reading the artifacts](how-to-read.html) |
| See how the pathway relates to Zero Suicide | [Zero Suicide ↔ SPiER mapping](zero-suicide-mapping.html) |
| Browse everything | [Artifacts](artifacts.html), in eight groups |

### Status

Everything here is `draft` / `experimental` and may change before Trial-Use;
if you implement now, pin version `0.1.0`. Two things to know before relying
on it: the risk-tier harmonization is a **proposed reference model** that
suicide-prevention subject-matter experts have not yet reviewed, so validate
the tier assignments against your own clinical protocols; and seven
instruments' results share the harmonized tier's LOINC code, so a search on
that code alone mixes them. Both are explained on
[Harmonization and Limitations](harmonization-and-limitations.html).

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
