# SPiER Repository Structure Audit

**Status:** Move 6d audit, read-only — produced 2026-05-20 against `main` at commit `6315763` (post-PR #7).

This document inventories the current SPiER repository structure, identifies redundancies and inconsistencies, and proposes a sequenced refactor. It exists to be reviewed *before* any code moves; nothing here has been executed.

## 1. Top-level layout

```
/
├── README.md                  Project overview
├── docs/                      Strategic / methodological documentation (pre-IG)
├── FHIR-Resources/            Hand-authored FHIR Questionnaire JSON, organized by pathway stage
├── ig/                        Sushi/FSH-based FHIR Implementation Guide (NEW since PR #4)
├── web/                       React demo app (Vite + TS)
├── .github/workflows/         CI: deploy.yml (Pages), ig.yml (Sushi)
├── .claude/                   Worktree / session state (not synced to remote)
├── firebase-debug.log         ❗ Looks accidentally committed
└── .DS_Store                  ❗ macOS metadata, should be gitignored
```

### Two cleanup tickets sitting in plain sight

- **`firebase-debug.log` is tracked.** Doesn't belong in source control. Delete and `.gitignore`.
- **`.DS_Store` likely tracked or untracked.** Add to a top-level `.gitignore` if not there already.

## 2. `ig/` — the new FSH IG (PR #4–#7)

```
ig/
├── sushi-config.yaml
├── README.md
├── .gitignore                 (excludes fsh-generated/, output/)
└── input/
    ├── pagecontent/           (index.md, zero-suicide-mapping.md)
    └── fsh/
        ├── spier-codesystem.fsh   (pathway-stage CodeSystem)
        ├── asq.fsh                (ASQ + the 2 stage PlanDefinitions)
        ├── phq9.fsh
        ├── sbqr.fsh
        ├── cssrs.fsh              (Screener + Full)
        ├── stanley-brown.fsh      (+ stage 4 PlanDefinition)
        └── cams.fsh               (5 CAMS tools + stages 3 & 7 PlanDefinitions)
```

**Status:** clean and self-contained. The convention from `ig/README.md` (no explicit `^url`, FSH-first, reference don't duplicate, US Core as baseline) is documented and consistent.

**Open question for the refactor:** the two pathway-stage PlanDefinitions (Flag Risk and Clarify Risk) currently live in `asq.fsh`. Stage 4 lives in `stanley-brown.fsh`. Stages 3 and 7 live in `cams.fsh`. Pathway stages are conceptually orthogonal to specific tools — they could be extracted to a `pathway-stages.fsh` file so each tool file only declares tool artifacts, and pathway assembly happens in one place. **Recommend extracting** during the refactor.

## 3. `FHIR-Resources/` — hand-authored Questionnaires

```
FHIR-Resources/
├── 1-Flag-Risk/
│   ├── ASQ/fhir/questionnaires/questionnaire.json
│   ├── C-SSRS/fhir/questionnaires/{screener,full-lifetime-recent}.json
│   ├── PHQ-9/fhir/questionnaires/questionnaire.json
│   └── SBQ-R/fhir/questionnaires/questionnaire.json
├── 2-Clarify-Risk/
│   └── CAMS/fhir/questionnaires/{SSF5_SectionA,SSF5_SectionB,Therapeutic_Worksheet,Stabilization_Plan}.json
└── 4-Document-Safety-Actions/
    └── Stanley-Brown/fhir/questionnaires/questionnaire.json
        + fhir/careplans/Hybrid_CarePlan.json    (template, not generated)
```

### Findings

- **Stages 3, 5, 6, 7, 8 are missing as directories.** The numbered tree is aspirational. Decision needed: either populate empty stage placeholders documenting "no tools authored yet" or drop the numbering and key by tool id only.
- **Tool placement vs. IG stage logic doesn't match.** `CAMS/Therapeutic_Worksheet.json` lives at `2-Clarify-Risk/CAMS/...` but the IG's `SPiERSetRiskStatusStage` (stage 3) is where the Therapeutic Worksheet's activity actually fires. Similar mismatch for CAMS Stabilization (under stage 2 directory, used at stage 4 in IG). The hierarchical directory implies one stage per tool but reality is many-to-many.
- **Sub-tree shape varies.** Stanley-Brown has `references/` (PDFs, specs) and `docs/data-mapping.md`. CAMS has extensive `references/` (training transcripts, focus groups, build-kit). Screeners have only `README.md` + `fhir/questionnaires/`. Inconsistent depth is fine for v0 but worth normalizing.
- **`careplans/` directory holds template CarePlan JSON** in two places — these are reference templates, not generated examples. The IG examples are the new canonical place for sample CarePlans; these old templates may now be redundant.

### Recommendation

Restructure as **tool-keyed at top level**, with stage as metadata (in README per tool):

```
FHIR-Resources/
├── README.md             (cross-reference table: tool → primary stage)
├── ASQ/
├── PHQ-9/
├── C-SSRS/
├── SBQ-R/
├── CAMS/
├── Stanley-Brown/
└── _stage-index.md       (or live in IG narrative)
```

This matches how `ig/input/fsh/*.fsh` files are organized (one file per tool, not per stage) and removes the placement-vs-actual-stage mismatch.

## 4. `web/src/` — the React app

### Root-level pollution (1,357 LOC across 5 helper files)

```
web/src/
├── App.tsx                                 158 lines  — routing
├── main.tsx                                 13 lines  — entry
├── Home.tsx                                 56 lines  — landing page (odd that this is at root)
├── observationMappers.ts                   782 lines  ❗ MONOLITH
├── carePlanMapper.ts                       187 lines  — Stanley-Brown
├── camsCarePlanMapper.ts                   143 lines  — CAMS Stabilization
├── camsTherapeuticCarePlanMapper.ts        136 lines  — CAMS Therapeutic
├── patientPathway.ts                       109 lines  — derived stage status + bespoke name map
└── vite-env.d.ts                             1 line
```

### Subdirectory layout

```
web/src/
├── components/   (9 files: EhrShell, Sidebar, PatientBanner, QuestionnaireView, StanleyBrownView, …)
├── pages/        (10 files matching app routes)
├── context/      (3 contexts: PatientContext, SmartContext, ToolConfigContext)
├── data/
│   ├── catalog/  (stages.ts, tools.ts, triggers.ts, dataElements.ts, index.ts)
│   ├── mockScenario.ts        (~12 KB demo seed)
│   ├── ehrAdoptionData.ts
│   ├── demoPatient.ts
│   ├── population/patients.json
│   └── pilot-plans/ {asq.md, index.ts}    — orphan?
├── css/          (per-component stylesheets)
├── hooks/        (likely useLocalStorage)
└── assets/
```

### Findings on `web/src/`

1. **`Home.tsx` at root is inconsistent.** Every other page is in `web/src/pages/`. Move.

2. **Five helper files at root should live in a subdirectory.** Proposed:
   ```
   web/src/lib/
   ├── observationMappers/   (split the 782-line monolith — see below)
   ├── carePlanMappers/      (Stanley-Brown, CAMS Stabilization, CAMS Therapeutic)
   └── patientPathway.ts
   ```

3. **`observationMappers.ts` (782 LOC) is a monolith.** It contains 7 distinct tool mappers (PHQ-9, ASQ, SBQ-R, CAMS-A, CAMS-B, C-SSRS Screener, C-SSRS Full) plus shared utilities (`makeObservation`, `walkItems`, `getCodingAnswer`, `getOrdinalValue`, etc.). Each tool's mapper is ~80–120 lines. **Split into `web/src/lib/observationMappers/{phq9,asq,sbqr,camsSectionA,camsSectionB,cssrsScreener,cssrsFull}.ts` + `shared.ts`** for the helpers + `index.ts` for the dispatch.

4. **Three CarePlan mapper files** all emit nearly-identical CarePlan shells with different `activity[]` contents. Could share a `makeSuicidePreventionCarePlan(activities, options)` helper. ~50 lines saved.

5. **`data/catalog/` parallels FSH artifacts.** The bespoke types here will be the heart of the refactor — see §5.

6. **`data/pilot-plans/` appears orphaned.** Single markdown file (`asq.md`) plus index. Was it referenced anywhere? Quick check needed — if not used, remove.

7. **`data/mockScenario.ts` and `data/demoPatient.ts`** are demo seed data. Belong in `data/`. Fine where they are.

8. **`data/ehrAdoptionData.ts` belongs here.** Drives the Adoption Rubric page.

## 5. `data/catalog/` — the bespoke catalog the refactor targets

Currently four files:

| File | Lines | What it defines | FSH equivalent in `ig/` |
|---|---|---|---|
| `stages.ts` | ~60 | `STAGES[]` array of 8 stages | `SPiERPathwayStage` CodeSystem ✓ |
| `tools.ts` | ~503 | `TOOLS[]` array of 25 tools with rich metadata | ActivityDefinitions (10 launchable) + Profiles |
| `triggers.ts` | 153 | `TRIGGERS[]` array of stage-transition rules | `PlanDefinition.action.trigger` (2 encoded) |
| `dataElements.ts` | ? | `DATA_ELEMENTS[]` per-tool data dictionary | No FHIR equivalent yet |
| `index.ts` | 4 | Re-exports | — |

### What `tools.ts` carries that FSH does not (yet)

A `Tool` interface has these fields beyond what `ActivityDefinition` covers:

- `shortName` — could become `ActivityDefinition.title` (short variant) or stored locally
- `inclusionStatus: 'core' | 'optional' | 'future'` — could be `ActivityDefinition.useContext` or a SPiER extension
- `settings: string[]` — `ActivityDefinition.useContext` (clinical setting)
- `badge: { label, variant }` — pure UI metadata; stays in the React app
- `launchActions: [{ label, path }]` — pure UI metadata (in-app routing); stays
- `tags: string[]` — could be `ActivityDefinition.topic` or local
- `targetMaturity` — bespoke EHR-adoption metric; stays
- `recordingPattern.resources[]` — partial overlap with `ActivityDefinition.kind` + the PD action's `output[]` (which IS authoritative)
- `fhirExamples: FhirExample[]` — supplanted by IG `Instance: Example*` resources
- `pilotPlanSlug` — links to `pilot-plans/<slug>.md`; React-app-only

### Refactor target for catalog

Make `tools.ts` an *adapter* over the FSH-generated resources:

```ts
// web/src/data/catalog/tools.ts (after refactor)
import activityDefs from '../fhir/activity-definitions.json'   // copied from ig/fsh-generated/
import { TOOL_UI_METADATA } from './tool-ui-metadata'           // React-only fields

export interface Tool {
  // FHIR-derived
  id: string                  // from ActivityDefinition.id
  name: string                // from ActivityDefinition.title
  purpose: string             // from ActivityDefinition.purpose
  stageId: string             // from PlanDefinition action that references this AD
  questionnaireUrl: string    // from AD's sdc-questionnaire extension
  // UI-only metadata (kept locally)
  shortName: string
  badge: BadgeVariant
  launchActions: LaunchAction[]
  inclusionStatus: InclusionStatus
}

export const TOOLS: Tool[] = buildToolsFromFhir(activityDefs, TOOL_UI_METADATA)
```

Same approach for `stages.ts` (derive from `SPiERPathwayStage` CodeSystem JSON) and `triggers.ts` (derive from PlanDefinition.action.trigger).

`dataElements.ts` stays bespoke — no FSH equivalent yet. Could become a future `StructureDefinition` per data element, but not in scope.

### Build pipeline addition

Need a script that, post-`sushi`, copies a subset of `ig/fsh-generated/resources/*.json` into a location the Vite build can import:

```
ig/                              → npx sushi
  fsh-generated/resources/*.json
web/scripts/copy-fhir.mjs        → copies to web/src/data/fhir/
web/src/data/fhir/
  ActivityDefinition-*.json
  PlanDefinition-*.json
  CodeSystem-*.json
```

Either as a manual `npm run prebuild` step or invoked from the `ig.yml` CI.

## 6. Cross-cutting findings

### Convention drift across mappers

- `observationMappers.ts` builds Observations using a `makeObservation(params)` helper. Good — uniform shape.
- `carePlanMapper.ts` (Stanley-Brown), `camsCarePlanMapper.ts` (Stabilization), `camsTherapeuticCarePlanMapper.ts` each builds its CarePlan inline without a shared helper. Three near-identical 100-line patterns.
- CarePlan profile claims: all three claim `meta.profile = ['http://hl7.org/fhir/us/ecareplan/StructureDefinition/us-ecareplan']` — an external IG we don't actually depend on. After the FSH refactor, these should claim the SPiER profiles instead (`spier-stanley-brown-safety-plan`, `spier-cams-stabilization-plan`, `spier-cams-therapeutic-worksheet`).

### The `RESPONSE_NAME_TO_TOOL_ID` map (Gemini flagged this back in PR #1)

In `patientPathway.ts`:
```ts
const RESPONSE_NAME_TO_TOOL_ID: Record<string, string> = {
  'ASQ Screening': 'TL-001',
  'PHQ-9': 'TL-002',
  // …
}
```

After the refactor: `QuestionnaireResponse.questionnaire` carries the canonical URL → look up Tool by matching the Tool's `questionnaireUrl` (derived from the AD's `sdc-questionnaire` extension). Name map disappears.

## 7. Proposed refactor sequence

Listed smallest/safest first. Each is a separate PR.

| # | Title | Files touched | Risk |
|---|---|---|---|
| 6d.1 | **Repo hygiene** — delete `firebase-debug.log`, add `.gitignore` entries for `.DS_Store` etc., move `Home.tsx` into `web/src/pages/` | ~5 files | Trivial |
| 6d.2 | **Move root helpers to `web/src/lib/`** — relocate `observationMappers.ts`, `carePlanMapper.ts`, the two CAMS mappers, `patientPathway.ts`. Update imports. No internal restructure yet. | ~15 files (imports) | Low |
| 6d.3 | **Split `observationMappers.ts`** into per-tool files under `web/src/lib/observationMappers/`. Shared helpers to `shared.ts`. Public surface (`mapResponseToObservations`) unchanged. | ~10 new files | Low (mechanical) |
| 6d.4 | **Consolidate CarePlan mappers** — share a `makeSuicidePreventionCarePlan()` helper across Stanley-Brown / CAMS Stabilization / CAMS Therapeutic. | 3 mapper files | Low |
| 6d.5 | **Add FHIR-resource copy step** — script that copies `ig/fsh-generated/resources/*.json` into `web/src/data/fhir/` on prebuild. Update CI. | 2 files | Low |
| 6d.6 | **Refactor `data/catalog/`** to consume FHIR resources from `web/src/data/fhir/`. Keep React-only fields in a sibling `tool-ui-metadata.ts`. Drop `RESPONSE_NAME_TO_TOOL_ID` map (use canonical-URL lookup). | ~5 files | **Medium** (touches many consumers) |
| 6d.7 | **Pathway PlanDefinitions to dedicated file** — extract from `asq.fsh`/`stanley-brown.fsh`/`cams.fsh` into `ig/input/fsh/pathway-stages.fsh`. | 4 FSH files | Low |
| 6d.8 | **`FHIR-Resources/` restructure** — flatten to tool-keyed top level; cross-reference stage in README. | ~10 files moved | Medium (paths referenced by App.tsx imports) |
| 6d.9 | **CarePlan mapper profile attribution** — replace external US eCare Plan claim with SPiER profile canonicals. | 3 mapper files | Trivial |

## 8. Things to explicitly leave alone (for now)

- **`docs/best-practices/`** content (validation-guide, strategy-consent, consent-vs-ds4p). Out of audit scope; predates the IG.
- **`web/src/css/`** organization. Already cleaned up in Phase 4 (design tokens).
- **`data/pilot-plans/`** — needs a one-line check whether anything imports `asq.md`. If unused, separate cleanup. If used, untouched.
- **`MANIFEST.md`, `PROJECT_OVERVIEW.md`** in `docs/`. Pre-existing project docs; let Brad decide if they need refreshing post-IG.

## 9. Open questions for review

1. **Tool placement in `FHIR-Resources/`** — keep stage-numbered tree (with empty placeholders for stages 3, 5, 6, 7, 8) or flatten to tool-keyed? My recommendation is flatten; the stage→tool mapping is many-to-many and better expressed as metadata.
2. **`tool-ui-metadata.ts`** name — better as `tool-ui-overlay.ts` or `tool-react-extras.ts`? Just bikeshedding the naming.
3. **Per-PR or merge several?** Steps 6d.1–6d.4 could combine cleanly into one PR. Steps 6d.5–6d.6 are the substantive refactor. Steps 6d.7–6d.9 are independent tidy-ups.
4. **CarePlan profile retrofit** (6d.9) — touches the live React app's persisted CarePlan shapes. Worth doing now or wait until catalog refactor is in?
