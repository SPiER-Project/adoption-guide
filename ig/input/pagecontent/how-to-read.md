# Reading the artifacts

This guide follows the layout of [HL7 US Core](https://hl7.org/fhir/us/core/),
so if you have read a FHIR IG before it will be familiar. This page explains
the model the artifacts share and the clinical terms they use.

## Reading a profile page

Each profile (for example *SPiER ASQ Screening Result Observation*) shows the
base resource it constrains, a formal element table (cardinality, type,
bindings) and links to examples.

- **Cardinality** — `1..1` means required; `0..*` optional and repeating.
- **Bindings** — `required` means the value **must** come from the named value
  set; `extensible` and `preferred` are looser.
- **`draft` / `experimental`** — every SPiER profile carries these flags. They
  are correct for a pre-publication IG and mean definitions may still change.
- **Must-Support** — flagged on SPiER profiles and defined operationally, by
  system role; see [Conformance](conformance.html).

<a id="two-layer-model"></a>

## The Capture → Translate → Act model {#capture-translate-act}

The artifacts fall into three steps that build on each other:

| Step | What it holds | FHIR artifacts | Coding / fidelity |
|---|---|---|---|
| **Capture** (per instrument) | Every question and answer | `Questionnaire` / `QuestionnaireResponse`, instrument profiles | Instrument LOINC / SNOMED, local item codes — high fidelity |
| **Translate** (harmonized) | "Positive screen, this severity tier, this date" | derived `Observation`, `ConceptMap` / `StructureMap` | One common suicide-risk tier on generic LOINC `93374-7` — lower, universally consumable |
| **Act** (response) | "Given that tier, recommend this next step" | `PlanDefinition`, `ActivityDefinition`, CDS Hooks | Encodes already-settled protocol; recommends, does not decide |

The Translate layer is **derived from** the Capture layer and linked back via
`Observation.derivedFrom`; it never replaces it. Which instruments cross into
the harmonized tier by ConceptMap and which by StructureMap is listed under
[Harmonization status](conformance.html#harmonization-status). The derived
concept is a **screening-level, unconfirmed** signal — it flags a need for
follow-up, not a diagnosis. The pattern follows the HL7
[Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/) and
[SDC](https://hl7.org/fhir/uv/sdc/). Act encodes the response a risk tier
already calls for in published guidelines; the clinician, or the institution's
configured policy, remains the decision-maker.

### Where the tier comes from {#tier-derivation}

Every instrument lands on the same tier, carried on LOINC `93374-7`, but not
by the same route — and the route decides whether a form filler is expected
to collect an answer at all:

| | How the tier is reached | The `risk-level` item |
|---|---|---|
| **C-SSRS** (screener, pediatric, since-last-contact) | **Computed** from the item ladder | `required: false`, `readOnly: true` — no filler produces it, so an absent answer is *expected* |
| **SAFE-T**, **PSS-Full** | **Assigned by the clinician** — SAFE-T's Step 4 is *"Determine risk level & intervention (based on clinical judgment)"* | `required: true` — a consumer reads the tier from the response, so an absent answer *is* missing data |

The item says which case it is: a
[Tier Derivation](StructureDefinition-tier-derivation.html) extension valued
`computed` or `clinician-assigned`, so a filler, a validator or a UI can tell
the two apart without knowing which tool it is holding.

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

The conformance consequence — a `computed` item is never `required` — is
stated on [Conformance](conformance.html#tier-derivation).

## Clinical primer (for non-clinical engineers) {#clinical-primer}

You do not need clinical training to implement SPiER. The instruments, one
line each:

- **ASQ** (Ask Suicide-Screening Questions) — a 4+1-item yes/no screen; a positive item plus the acuity question yields negative / non-acute-positive / acute-positive.
- **BSSA** (Brief Suicide Safety Assessment) — a post-positive-screen clinician interview that derives a coded disposition.
- **C-SSRS** (Columbia-Suicide Severity Rating Scale) — graded ideation/behavior items yielding a none/low/moderate/high risk level; a Screener and a fuller Lifetime/Recent variant.
- **PHQ-9** — a depression screen whose **Item 9** ("thoughts of being better off dead or self-harm", scored 0–3) is the suicide-relevant signal.
- **PSS-3** (Patient Safety Screener, 3-item) — a universal acute-care screen (depression, active ideation, lifetime attempt/recency) yielding a binary suicide-risk result.
- **PSS-Full** — the PSS-3 plus a site-defined risk-stratification step, yielding a risk level directly on the shared tier.
- **SAFE-T** (Suicide Assessment Five-Step Evaluation and Triage) — a five-step structured clinical formulation yielding a risk level directly on the shared tier.
- **SBQ-R** (Suicide Behaviors Questionnaire-Revised) — a 4-item total score (3–18) with validated cutoffs (≥7 general population, ≥8 inpatient).
- **CAMS** (Collaborative Assessment and Management of Suicidality) — a patient-completed Suicide Status Form (Section A: six vital ratings including self-rated overall risk) plus a clinician-completed driver assessment (Section B).
- **CRP** (Crisis Response Plan) — a collaboratively completed crisis plan recorded as a CarePlan, an alternative to Stanley-Brown.
- **Stanley-Brown Safety Plan** — a collaboratively completed seven-step safety plan recorded as a CarePlan.

All of these map onto the common suicide-risk tier described above.
