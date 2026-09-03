# FHIR-Resources

Hand-authored FHIR Questionnaires and a couple of historical CarePlan templates, organized by **tool**. Each tool's folder holds the FHIR resource(s) the React app loads at runtime, plus reference material — training transcripts, original forms, dashboard data dictionaries — where any exists.

For the **canonical, machine-readable** SPiER artifacts — Profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions and example Instances — see [`ig/input/fsh/`](../ig/input/fsh/). Each tool's README is deliberately thin: it carries provenance and folder contents, and links to the FSH for anything the FSH already states, so there is one copy of each fact rather than two.

## Tools

| Folder | Primary stage(s) | What's here |
|---|---|---|
| [ASQ/](ASQ/) | Identify Possible Risk (1) | NIMH 5-item suicide screener (4 screening questions + 1 acuity question) Questionnaire + ValueSet + local panel CodeSystem |
| [PHQ-9/](PHQ-9/) | Identify Possible Risk (1) | 9-item depression screener Questionnaire; Item 9 is the canonical Clarify Risk trigger |
| [SBQ-R/](SBQ-R/) | Identify Possible Risk (1) | 4-item Suicide Behaviors Questionnaire-Revised, with `ordinalValue` scoring and a calculated total |
| [PSS-3/](PSS-3/) | Identify Possible Risk (1) | ED-SAFE 3-item universal acute-care suicide screen → positive/negative result Observation (positive fires the Clarify Risk trigger) + result→risk-tier crosswalk |
| [C-SSRS/](C-SSRS/) | Identify Possible Risk (1), Clarify Risk (2) | Four administrations — Screener, Full (Lifetime/Recent), Since Last Contact, and Pediatric/Adolescent — all deriving one shared risk-level Observation. The **Pediatric** form is the stage-1 entry; the other three are Clarify Risk |
| [BSSA/](BSSA/) | Clarify Risk (2) | NIMH Brief Suicide Safety Assessment (the post-positive-screen clinician guide) Questionnaire → disposition Observation + disposition→risk-tier crosswalk |
| [CAMS/](CAMS/) | Clarify Risk (2), Define the Risk Picture (3), Document Safety Actions (4) | SSF-5 Section A/B, interim re-rating, Outcome-Disposition, Therapeutic Worksheet and Stabilization Plan Questionnaires, plus the training and build-kit reference material |
| [PSS-Full/](PSS-Full/) | Clarify Risk (2) | Combined acute-care screen — the public ED-SAFE PSS-3 items plus a site-defined stratification → risk-level Observation on the shared tier (no crosswalk) |
| [CARS-S/](CARS-S/) | Clarify Risk (2) | ⚠️ **No artifacts.** A licensing audit only: the CARS is copyrighted and the outcome was NO-GO pending written permission. The ActivityDefinition is a placeholder |
| [SAFE-T/](SAFE-T/) | Define the Risk Picture (3) | SAMHSA 5-step structured formulation → risk-level Observation whose value binds directly to the shared suicide-risk tier (lands on the concept layer, no crosswalk) |
| [Stanley-Brown/](Stanley-Brown/) | Document Safety Actions (4) | 7-step safety plan Questionnaire, a hybrid CarePlan template, and the 2021 source form. ⚠️ Its licensing requires written author permission for EMR use, which SPiER has not filed |
| [CRP/](CRP/) | Document Safety Actions (4) | Crisis Response Plan (Bryan & Rudd) — 5-section Questionnaire → CarePlan; an alternative to Stanley-Brown, sharing its section CodeSystem |

Tool-to-stage mapping is many-to-many — CAMS spans three stages and C-SSRS two — which is why this directory is keyed by tool rather than by stage. **The authoritative stage membership is [`ig/input/fsh/pathway-stages.fsh`](../ig/input/fsh/pathway-stages.fsh)**, where each `PlanDefinition.action.definitionCanonical` points at the ActivityDefinition for the tool that performs that stage's action. The table above is a reading copy derived from it; when the two disagree, the FSH is right.

Stages 5–8 (Coordinate Handoffs, Track Follow-Up, Track Risk Over Time, Measure and Share the Data) have no folders here, because their activities are workflow steps rather than instruments — they are modeled entirely in the IG (`handoffs.fsh`, `follow-up.fsh`, `risk-episode.fsh`, `measure-and-share.fsh`).

## How resources connect

```
FHIR-Resources/<Tool>/*.json
    ↑
    │  imported directly by web/src/App.tsx (rendered by @formbox/renderer)
    │
ig/input/fsh/<tool>.fsh
    │  declares Profile / ActivityDefinition / ValueSet / CodeSystem / examples
    ↓
ig/fsh-generated/resources/*.json          (sushi output, gitignored)
    ↓
packages/fhir-artifacts/generated/*.json   (copied by web/scripts/copy-fhir.mjs, gitignored)
    ↓
imported via packages/core/src/data/catalog/ as ActivityDefinitions, PlanDefinitions, etc.
```

When the FSH and a hand-authored Questionnaire refer to the same logical instrument, the FSH `ActivityDefinition` carries a versioned canonical URL in its `sdc-questionnaire` extension matching the `Questionnaire.url` + `version` in this directory. That canonical is how the app's catalog links a stored `QuestionnaireResponse.questionnaire` back to its `Tool`.

## Licensing

Every ActivityDefinition carries an `instrument-licensing-status` code and a `copyright` statement — that is the one home for a tool's licensing *status*, and the app derives from it. Where a folder has a `licensing/MEMO.md`, that memo is the *evidence*; both are kept.

⚠️ **No status here has been verified against the rights holder's current published terms**, and four tools have no memo at all (PHQ-9, SBQ-R, CAMS, Stanley-Brown). [`docs/best-practices/licensing-verification-backlog.md`](../docs/best-practices/licensing-verification-backlog.md) is the standing list of what is owed and of why a recorded notice is not a verification.
