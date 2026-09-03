# SAFE-T — Suicide Assessment Five-Step Evaluation and Triage

## Provenance

SAFE-T is a **structured clinical formulation, not a scored survey**, published
by SAMHSA on a pocket card. It walks a clinician through five steps to reach a
documented suicide-risk **level** with its rationale and a disposition.

| | |
|---|---|
| **Source** | [SAMHSA SAFE-T pocket card (PEP24-01-036)](https://www.samhsa.gov/resource/dbhis/safe-t-pocket-card-suicide-assessment-five-step-evaluation-triage-safe-t-clinicians) |
| **Developed with** | Screening for Mental Health, Inc. and Douglas Jacobs, MD |
| **Licensing** | Free public SAMHSA resource; no permission or fee required. The status and its basis are on the `AdministerSAFET` ActivityDefinition; the evidence is in [`licensing/MEMO.md`](licensing/MEMO.md). |

## What's in this folder

| File | What it is |
|---|---|
| `safet-questionnaire.json` | The FHIR R4 Questionnaire — the five steps as they appear on the card, `observationExtract` on the risk-level item only, and the risk-level value bound to the shared tier |
| `licensing/MEMO.md` | The licensing audit |

Everything else is in [`ig/input/fsh/safet.fsh`](../../ig/input/fsh/safet.fsh):
the panel code, the Step 1 risk-factor and Step 2 protective-factor CodeSystems
and ValueSets (each concept carrying the card's own wording), the
`SPiERSAFETRiskLevel` profile, the `AdministerSAFET` ActivityDefinition with its
stage membership and licensing, and the examples.

## Why this tool needs no crosswalk

SAFE-T's risk level is a clinical-judgment determination that already speaks in
tiers, so the derived Observation's **value binds directly** to the shared
`spier-suicide-risk-tier` ValueSet (`low` / `moderate` / `high`) — SAFE-T lands
on the concept layer with no per-instrument ConceptMap in between, the same
design as PSS-Full. The item itself carries LOINC `93374-7` (*Suicide risk
level*); the risk-factor and protective-factor checklists are SPiER-local and
marked `no-standard-binding`, since they are captured for context rather than
extracted. `status: draft` / `experimental: true`.

Because the level is a judgment rather than a computation, the Questionnaire also
captures a `clinical-judgment-override` flag and an `override-rationale`, so a
clinician can document overriding what the factors and the inquiry would
otherwise suggest. The mapper folds both into the result Observation's `note`.

## Informational — the card's triage chart

The risk-level→intervention chart below is transcribed from the SAMHSA card. It
is **not** carried by any artifact, and — in the card's own words, as recorded in
the ActivityDefinition's `copyright` — it is an **example range rather than a
determination**. Do not implement it as a rule.

| Risk level | Suicidality | Possible intervention |
|---|---|---|
| **Low** | Thoughts of death; no plan, intent, or behavior | Outpatient referral with a warm handoff; symptom reduction; 988 Lifeline |
| **Moderate** | Suicidal ideation with a plan, but no intent or behavior | Admission may be necessary; give emergency and crisis numbers including 988 |
| **High** | Ideation with plan, method, and intent to carry it out | Emergency psychiatric treatment in a secure setting may be necessary |

One clinical note the card makes and the artifacts do not: a safety plan is
developed for individuals at **low, moderate and high** risk, not only the top
tier.
