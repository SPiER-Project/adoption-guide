# FHIR-Resources

Hand-authored FHIR Questionnaires and a handful of historical CarePlan templates, organized by **tool**. Each tool's folder contains the FHIR resource(s) the React app loads at runtime plus reference material (training transcripts, original forms, dashboards) where applicable.

For the **canonical, machine-readable** SPiER FHIR artifacts — Profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions, and example Instances — see [`ig/input/fsh/`](../ig/input/fsh/). The IG compiles to [`ig/fsh-generated/resources/`](../ig/fsh-generated/) (generated, gitignored) and a subset is copied into [`web/src/data/fhir/`](../web/src/data/fhir/) by the prebuild step for the demo app to consume.

## Tools

| Folder | Primary stage(s) | What's here |
|---|---|---|
| [ASQ/](ASQ/) | Flag Risk (1) | NIMH 5-item suicide screener (4 screening questions + 1 acuity question) Questionnaire + ValueSet + 3 CodeSystems |
| [BSSA/](BSSA/) | Clarify Risk (2) | NIMH Brief Suicide Safety Assessment (post-positive-screen clinician guide) Questionnaire → disposition Observation + disposition→risk-tier crosswalk |
| [SAFE-T/](SAFE-T/) | Define the Risk Picture (3) | SAMHSA 5-step structured formulation → risk-level Observation whose value binds directly to the shared suicide-risk tier (lands on the concept layer, no crosswalk) |
| [PHQ-9/](PHQ-9/) | Flag Risk (1) | 9-item depression screener Questionnaire (Item 9 → Clarify Risk trigger) |
| [PSS-3/](PSS-3/) | Identify Possible Risk (1) | ED-SAFE 3-item universal acute-care suicide screen → positive/negative result Observation (positive → Clarify Risk trigger) + result→risk-tier crosswalk |
| [C-SSRS/](C-SSRS/) | Flag Risk (1), Clarify Risk (2) | Screener + Full (Lifetime/Recent) Questionnaires |
| [SBQ-R/](SBQ-R/) | Flag Risk (1) | 4-item Suicide Behaviors Questionnaire-Revised |
| [CAMS/](CAMS/) | Clarify Risk (2), Set Risk Status (3), Document Safety Actions (4), Manage Active Risk (7) | SSF-5 Section A/B, Therapeutic Worksheet, Stabilization Plan Questionnaires + reference material |
| [Stanley-Brown/](Stanley-Brown/) | Document Safety Actions (4) | 7-step safety plan Questionnaire + a hybrid CarePlan template |
| [CRP/](CRP/) | Document Safety Actions (4) | Crisis Response Plan (Bryan & Rudd) — 5-section Questionnaire → CarePlan (SPiERCrisisResponsePlan); alternative to Stanley-Brown |
| [PSS-Full/](PSS-Full/) | Clarify Risk (2) | Combined acute-care screen — public ED-SAFE PSS-3 items + site-defined stratification → risk-level Observation on the shared tier (no crosswalk) |

Tool-to-stage mapping is many-to-many (CAMS in particular spans four stages), which is why this directory is keyed by tool rather than by stage. The authoritative stage-membership lives in [`ig/input/fsh/pathway-stages.fsh`](../ig/input/fsh/pathway-stages.fsh) — each `PlanDefinition.action.definitionCanonical` points to the `ActivityDefinition` for the tool that performs the action at that stage.

## How resources connect

```
FHIR-Resources/<Tool>/*.json
    ↑
    │  imported directly by web/src/App.tsx (rendered by @formbox/renderer)
    │
ig/input/fsh/<tool>.fsh
    │  declares Profile / ActivityDefinition / ValueSet / CodeSystem / examples
    ↓
ig/fsh-generated/resources/*.json   (sushi output, gitignored)
    ↓
web/src/data/fhir/*.json            (copied by web/scripts/copy-fhir.mjs, gitignored)
    ↓
imported via web/src/data/catalog/tools.ts as ActivityDefinitions, PlanDefinitions, etc.
```

When the FSH and the hand-authored Questionnaire JSON refer to the same logical instrument, the FSH `ActivityDefinition` carries a versioned canonical URL in its `sdc-questionnaire` extension that matches the `Questionnaire.url` + `version` in this directory. That canonical URL is how the React app's catalog links a stored `QuestionnaireResponse.questionnaire` back to its `Tool`.
