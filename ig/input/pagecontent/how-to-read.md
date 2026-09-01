# How to Read This Guide

This guide follows the information architecture used by [HL7 US Core](https://hl7.org/fhir/us/core/), so if you've read a FHIR IG before, the layout will be familiar.

## The menu

- **Home** — what SPiER is, its status, and who it's for.
- **Getting Started** — how to obtain the artifacts and validate your own resources against them.
- **Guidance** — this page, plus [Relationship to Other IGs](relationship-to-other-igs.html), the [Zero Suicide ↔ SPiER mapping](zero-suicide-mapping.html), the [Care Pathway](care-pathway.html), and [Measurement (Stage 8)](measurement.html).
- **Conformance** — what it means to conform to SPiER: actor roles, the per-role CapabilityStatements, and what Must-Support means here.
- **Quick Starts** — per-instrument RESTful search patterns to read SPiER data.
- **Artifacts** — the full machine-readable list of every profile, extension, value set, code system, and example (generated).

## Reading a profile page

Each profile (e.g. *SPiER ASQ Screening Result Observation*) shows the base resource it constrains, a formal element table (cardinality, type, bindings), and links to examples. Today:

- **Cardinality** — `1..1` means required, `0..*` optional and repeating, etc.
- **Bindings** — `required` means a value **must** come from the named value set; `extensible`/`preferred` are looser.
- **`draft` / `experimental`** — every SPiER profile currently carries these flags. They are correct for a pre-publication IG and signal that definitions may still change; plan for it.
- **Must-Support** — not yet flagged on SPiER profiles. Formal Must-Support (which elements a producer must populate and a consumer must process) is being added next; see [Conformance](conformance.html).

<a id="two-layer-model"></a>

## The Capture → Translate → Act model {#capture-translate-act}

SPiER's organizing idea is that every layer of suicide prevention currently lives only in human-readable form, and the job is to make each one machine-actionable. The artifacts fall into three steps that build on each other:

| Step | What it holds | FHIR artifacts | Coding / fidelity |
|---|---|---|---|
| **Capture** (per instrument) | Every question and answer | `Questionnaire` / `QuestionnaireResponse`, instrument profiles | Instrument LOINC / SNOMED, local item codes — high fidelity |
| **Translate** (harmonized) | "Positive screen, this severity tier, this date" | derived `Observation`, `ConceptMap` / `StructureMap` | One common suicide-risk tier on generic LOINC `93374-7` — lower, universally consumable |
| **Act** (response) | "Given that tier, recommend this next step" | `PlanDefinition`, `ActivityDefinition`, CDS Hooks | Encodes already-settled protocol; recommends, does not decide |

**Capture** and **Translate** are the historical "two-layer model": the Translate (concept) layer is **derived from** the Capture layer and linked back via `Observation.derivedFrom` — it never replaces it. Instruments with a coded disposition (ASQ, C-SSRS) map via **ConceptMaps**; score-based instruments (PHQ-9 Item 9, SBQ-R) map via **StructureMaps**. The derived concept is a **screening-level, unconfirmed** signal — it flags a need for follow-up, not a diagnosis. This pattern is modeled on the HL7 [Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/) and [SDC](https://hl7.org/fhir/uv/sdc/).

### Where the tier comes from, and why an empty answer is not always missing data {#tier-derivation}

Every instrument lands on the *same* tier, carried on LOINC `93374-7`. They do not all get there the same way, and the difference decides whether a system filling the form is expected to collect an answer at all:

| | How the tier is reached | The `risk-level` item |
|---|---|---|
| **C-SSRS** (screener, pediatric, since-last-contact) | **Computed** from the item ladder — the answers to the questions determine the tier | `required: false`, `readOnly: true`. No filler produces it, so an absent answer is *expected* |
| **SAFE-T**, **PSS-Full** | **Assigned by the clinician** — SAFE-T's Step 4 is literally *"Determine risk level & intervention (based on clinical judgment)"* | `required: true`. A consumer reads the tier from the response, so an absent answer *is* missing data |

Both routes are "derivation" in the Translate sense: each produces one comparable tier from an instrument that does not natively speak in tiers. What differs is whether the input is *other answers* or *a clinician's judgment*.

This is stated on the artifact rather than left to instrument knowledge. The item carries a [Tier Derivation](StructureDefinition-tier-derivation.html) extension valued `computed` or `clinician-assigned`, so a filler, a validator, or a UI can tell the two cases apart without knowing which tool it is holding:

```json
{
  "linkId": "risk-level",
  "required": false,
  "readOnly": true,
  "code": [{ "system": "http://loinc.org", "code": "93374-7", "display": "Suicide risk level" }],
  "extension": [
    { "url": "http://thespierproject.org/fhir/StructureDefinition/tier-derivation", "valueCode": "computed" }
  ]
}
```

⚠️ **Marking a computed item `required` is a defect, not a strictness choice.** The three C-SSRS Questionnaires did exactly that, asking a clinician for a value nothing in the pipeline produces and nothing consumes; two SPiER-authored QuestionnaireResponses were non-conformant against their own Questionnaire as a direct result.

**Act** is the newest and least-built step. It is an *encoding* problem rather than a *consensus* problem — the clinical response to a given risk tier is already endorsed in guidelines; SPiER's contribution is rendering it as executable logic so the right recommendation surfaces at the right moment. The clinician, or the institution's configured policy, remains the decision-maker.

## Clinical primer (for non-clinical engineers) {#clinical-primer}

You do not need clinical training to implement SPiER. The instruments, in one line each:

- **ASQ** (Ask Suicide-Screening Questions) — a 4+1-item yes/no screen; a positive item plus the acuity question yields negative / non-acute-positive / acute-positive.
- **C-SSRS** (Columbia-Suicide Severity Rating Scale) — graded ideation/behavior items yielding a none/low/moderate/high risk level; a Screener and a fuller Lifetime/Recent variant.
- **PHQ-9** — a depression screen whose **Item 9** ("thoughts of being better off dead or self-harm", scored 0–3) is the suicide-relevant signal.
- **SBQ-R** (Suicide Behaviors Questionnaire-Revised) — a 4-item total score (3–18) with validated cutoffs (≥7 general population, ≥8 inpatient).

All of these map onto the common suicide-risk tier described above.
