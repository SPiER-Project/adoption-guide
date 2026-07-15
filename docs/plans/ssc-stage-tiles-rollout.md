# SSC Stage-Tiles Rollout Plan

Execution plan for landing the July 2026 pathway restructure, migrating the
GitHub roadmap, and encoding the remaining tools. Written to be executed
**phase by phase in separate AI-agent sessions** — each phase is a
self-contained work order with its own context, steps, acceptance criteria,
and verification. Do not combine phases into one PR.

## Standing context (paste into every session)

> The SPiER repo restructured its suicide-safer care pathway to match the SSC
> Salesforce stage tiles (spec: `docs/reference/ssc-stage-tiles-question-set.md`).
> Stage codes are now: `identify-possible-risk`, `clarify-risk`,
> `define-risk-picture`, `document-safety-actions`, `coordinate-handoffs`,
> `track-follow-up`, `track-risk-over-time`, `measure-and-share`.
> The CAMS SSF-5 is ONE catalogued tool (TL-020 @ clarify-risk) whose session
> forms (Section A/B, Interim, Outcome/Disposition) are separate
> ActivityDefinitions all mapped to TL-020. Tools TL-012 (ED-SAFE), TL-016
> (CALM), TL-018 (Colorado Post-Visit) are retired; TL-026–TL-045 are new
> placeholder tools. Read `CLAUDE.md` first; run `npm install` in `web/` on a
> fresh worktree; finish every change with `npm run verify` in `web/` and
> `npx --no-install sushi ../ig` (run from `web/`), plus `npx vitest run`.
> Workflow: branch per PR, squash-merge, reset branch to origin/main after
> merge. Repo: `SPiER-Project/adoption-guide` (pass `--repo` to `gh`).

Conventions for encoded instruments (mirror ASQ/PHQ-9/SBQ-R/C-SSRS/CAMS):

- Questionnaire JSON hand-authored in `FHIR-Resources/<Instrument>/`
- Full FSH in `ig/input/fsh/<instrument>.fsh`: ActivityDefinition (moved out
  of `pathway-tool-placeholders.fsh`), answer CodeSystems/ValueSets,
  derived-Observation (or CarePlan) profiles, example QuestionnaireResponse +
  Observation instances
- Crosswalk to the shared suicide-risk tier in
  `ig/input/fsh/crosswalk-<instrument>.fsh` where the tool yields a
  risk-comparable result (use the `concept-harmonization` skill)
- Catalog wiring: `AD_TO_TOOL_ID` already maps the AD id — keep the id when
  promoting a placeholder so the TL id and stage PD reference stay stable;
  add launch actions + `recordingPattern` in `tool-ui-metadata.ts`
- Observation mapper in `web/src/lib/observationMappers/` + registration in
  its index; if the instrument has per-item LOINC codes, add an
  `INSTRUMENT_SIGNATURES` entry in `fallbackDispatch.ts` (guarded by
  `npm run check:fallback`)
- Use the `assessment-to-ig` skill for the full artifact set; use
  `fhir-questionnaire-quality` for review passes

---

## Phase 0 — Land the restructure branch  *(small; do first)*

**State:** branch `claude/billings-clinic-pdf-16ca26` holds two uncommitted
bodies of work: (a) the Billings Clinic outreach PDF (`docs/outreach/`), and
(b) the full SSC restructure (FSH + catalog + population + tests + reference
doc). All verification is green.

**Steps**

1. Commit as two commits on the branch (outreach PDF; SSC restructure) or, if
   preferred, split into two PRs — the restructure PR is the one the later
   phases depend on.
2. Open PR(s) against `main`, squash-merge, then reset the local branch to
   `origin/main` (Brad's standing workflow).

**Acceptance:** `main` contains the restructure; `npm run verify` green on
`main`; CI (if any) green.

---

## Phase 1 — GitHub roadmap migration  *(after Phase 0)*

**Problem:** GitHub labels and issues still describe the old structure.
`web/src/pages/Roadmap.tsx` builds label-filter links like
`stage:${tool.stageId}` — those now point at labels that don't exist. The
committed snapshot `web/src/data/roadmap.generated.json` is fetched from
GitHub by `web/scripts/fetch-roadmap.mjs` and must be refreshed **after** the
GitHub-side migration. `scripts/seed-roadmap-issues.mjs` is a historical
record — do not re-run it.

**Steps** (write a new idempotent script `scripts/migrate-roadmap-stages.mjs`
with `--dry-run`, modeled on the seed script's `gh` usage, or run manually):

1. Rename stage labels (renaming preserves issue associations):
   ```bash
   gh label edit "stage:flag-risk"          --name "stage:identify-possible-risk" --description "Stage 1 — Identify Possible Risk" --repo SPiER-Project/adoption-guide
   gh label edit "stage:set-risk-status"    --name "stage:define-risk-picture"    --description "Stage 3 — Define the Risk Picture" --repo SPiER-Project/adoption-guide
   gh label edit "stage:manage-active-risk" --name "stage:track-risk-over-time"   --description "Stage 7 — Track Risk Over Time"    --repo SPiER-Project/adoption-guide
   gh label edit "stage:measure-and-share"  --description "Stage 8 — Measure and Share the Data" --repo SPiER-Project/adoption-guide
   ```
2. Consolidate CAMS issues: comment on and close the TL-022 (CAMS Interim)
   and TL-023 (CAMS Outcome/Disposition) issues as *consolidated into TL-020*
   (link the TL-020 issue); relabel the TL-020 issue `stage:clarify-risk` if
   it isn't already; note in its body that Interim + Outcome/Disposition are
   session forms inside it.
3. Retire dropped tools: close TL-012 (ED-SAFE) and TL-018 (Colorado
   Post-Visit) as superseded by the Stage-6 workflow tools (name TL-033–036);
   close TL-016 (CALM) as merged into TL-008.
4. Restage moved tools: TL-014 (PSS Full) `stage:flag-risk` →
   `stage:clarify-risk`.
5. Create issues for the new tools TL-026–TL-045, matching the existing
   convention — title `[TL-0xx] <name>`, labels `type:epic`, `tool:TL-0xx`,
   `stage:<new-stage-code>`, `status:planned` (Waves 1–2 below) or
   `status:future` (Waves 3–6). Names/stages are in
   `web/src/data/catalog/tool-ui-metadata.ts` + `pathway-tool-placeholders.fsh`.
6. Refresh the snapshot: `node web/scripts/fetch-roadmap.mjs`, commit the
   regenerated `web/src/data/roadmap.generated.json`.
7. Verify: `npm run verify`; load `/#/guide/roadmap` in the dev server — every
   stage group shows its tools, and the epic links filter correctly on GitHub.

**Acceptance:** no `stage:flag-risk` / `stage:set-risk-status` /
`stage:manage-active-risk` labels remain; TL-026–045 issues exist; snapshot
committed; Roadmap page links work.

---

## Phase 2 — Encode remaining tools

One instrument = one session = one PR. Waves order by licensing clarity and
leverage; within a wave, sessions can run in parallel (different files).
Every instrument PR must include: licensing memo
(`FHIR-Resources/<Tool>/licensing/MEMO.md`, template at
`docs/best-practices/licensing-audit-template.md`), Questionnaire JSON, full
FSH, catalog wiring, mapper (+ fallback signature if per-item LOINC exists),
risk-tier crosswalk where applicable, example instances, and a green
`npm run verify` + `sushi` + `vitest`.

### Wave 1 — public-domain questionnaire instruments *(status:planned)*

| Tool | Instrument | Notes for the executing model |
|---|---|---|
| TL-005 | NIMH BSSA | Public domain (NIMH, like ASQ). Disposition-oriented: output is a disposition/recommendation Observation (mirror the ASQ result pattern + `asq-result`-style CodeSystem). Crosswalk disposition → risk tier. |
| TL-011 | PSS-3 | Public domain. 3 items; positive/negative result Observation; simple trigger into Clarify Risk (add a PD trigger analogous to the ASQ one only if a result ValueSet is defined). |
| TL-006 | SAFE-T | Public domain (SAMHSA pocket card). Not a scored survey — model as a structured formulation: risk-level + rationale + disposition. Output = risk-level Observation bound to the shared tier ValueSet (this one lands directly on the concept layer; no crosswalk needed). Supports the SSC questions on override/rationale (SSC-023/024) — capture override reason as a Questionnaire item. |

### Wave 2 — C-SSRS family *(status:planned; registration licensing)*

| Tool | Instrument | Notes |
|---|---|---|
| TL-019 | C-SSRS Since Last Visit / Since Last Contact | Reuse `cssrs.fsh` patterns and LOINC panel codes where published; same risk-level output profile (`spier-cssrs-risk-level`). Confirm registration terms cover the variant (extend the existing C-SSRS licensing memo). |
| TL-027 | C-SSRS Pediatric / Adolescent | Same pattern; verify pediatric wording licensing with the Columbia Lighthouse project before authoring. |

### Wave 3 — licensing-gated instruments *(status:future until cleared)*

| Tool | Instrument | Gate |
|---|---|---|
| TL-028 | CARS-S | **Licensing audit first** — status unknown. Do the MEMO.md audit as its own small PR; only proceed to artifacts if free/registration terms are confirmed. |
| TL-020 | CAMS SSF-5 Outcome/Disposition session form | Guilford/CAMS-care agreement scope must cover the final-session form. Authoring upgrades the existing `AdministerCAMSOutcomeDisposition` placeholder inside `cams.fsh`; keeps mapping to TL-020. |
| TL-015 | Crisis Response Plan | Rudd/Bryan CRP — check permission; CarePlan output modeled on Stanley-Brown (`spier-stanley-brown-safety-plan` precedent). |
| TL-014 | PSS Full | Confirm source/licensing; otherwise keep placeholder. |

### Wave 4 — safety-action documentation tools *(no questionnaire; profile work)*

| Tool | Shape |
|---|---|
| TL-008 Lethal Means Safety | `Procedure` (counseling done) + per-method `Observation`s (means-safety actions: method, plan, responsible party, completed) with a small SPiER CodeSystem for methods/actions; stage-tagged. |
| TL-013 Crisis Resources | `Communication` profile with a resource-code ValueSet (988, Crisis Text Line, Now Matters Now, safety-plan copy) + `sent` timestamp; demo route under `/patient/workflow/…` like caring contacts. |

### Wave 5 — workflow/infrastructure tools (stages 5–7) *(FHIR patterns, not forms)*

These encode as profiles + demo workflow-recorder routes (precedent: TL-009
transition and TL-010 caring contact use stage-tagged `Communication`).
Suggested resource per tool — validate against the SSC question set before
authoring:

- TL-030 Discharge Safety Packet → `DocumentReference` or `Communication`
  bundle listing included artifacts
- TL-017 Referral Handoff → `ServiceRequest` + status tracking
- TL-031 Next-Appointment Scheduling → `Appointment`
- TL-032 Consent / Sharing Status → `Consent`
- TL-033 Outreach Attempts / TL-035 No-Show Follow-Up / TL-036 Escalation →
  `Communication` / `Task` with outcome codes
- TL-034 Appointment Tracking → `Appointment` + `encounter` status derivation
- TL-037 Registry / TL-038 Episode Status → `EpisodeOfCare` (+ `Flag` for the
  chart banner); this is the natural anchor for the whole stage-7 tile
- TL-039 Reassessment Schedule / TL-040 Care Gaps / TL-041 Overdue Escalation
  → `Task` with due dates and owner

Do stage 7 as one design PR first (EpisodeOfCare/Flag/Task pattern), then
implement per-tool. `web/src/lib/patientPathway.ts` already stages any
resource via `meta.tag` — new resource types drop in without resolver changes.

### Wave 6 — Measure and Share (stage 8)

- TL-042 KPI reporting → FHIR `Measure` resources for the SSC measure list
  (screen→assessment, safety plan before discharge, 7/30-day follow-up, …) +
  example `MeasureReport`s; wire into a data-dictionary/IG page
- TL-043 Dashboard → app-side (PopulationView aggregate) — scope as web work
- TL-044 Export / TL-045 Interop Output → primarily documentation + the
  CapabilityStatement (`capabilitystatements.fsh`); align with the existing
  CDS service and SMART read/write paths

After each wave: update the tool's GitHub issue `status:` label
(`planned`→`built`), re-run `node web/scripts/fetch-roadmap.mjs`, and commit
the snapshot.

---

## Session prompt template (per instrument)

> In the SPiER repo (`SPiER-Project/adoption-guide`), encode **<TOOL NAME>
> (TL-0xx)** into the full FHIR artifact set using the `assessment-to-ig`
> skill. The tool currently exists as placeholder ActivityDefinition
> `<ADName>` in `ig/input/fsh/pathway-tool-placeholders.fsh`, referenced by
> the `<stage>` stage PlanDefinition in `pathway-stages.fsh` and mapped to
> TL-0xx in `web/src/data/catalog/tools.ts`. Keep the AD id and canonical URL
> stable; move the AD to a new `ig/input/fsh/<instrument>.fsh` and enrich it.
> Follow the conventions in `docs/plans/ssc-stage-tiles-rollout.md` (standing
> context + per-PR checklist). Source instrument: <attach PDF/link>.
> Licensing: <status or "audit first">.

## Risks / gotchas for executing models

- `web/src/data/fhir/` and `care-plan-profiles.generated.ts` are build
  artifacts — never hand-edit; run `npm run copy-fhir -- --force` when FHIR
  data looks stale.
- Adding per-item LOINC codes touches THREE places: Questionnaire JSON,
  observation mapper, `fallbackDispatch.ts` signatures — `check:fallback`
  guards only PHQ-9-style item-code signatures you register.
- A new AD **must** be referenced by exactly one stage PD action and have an
  `AD_TO_TOOL_ID` entry, or `check:catalog` fails / the tool is dropped.
- Questionnaires shared by tools at different stages need the `?tool=` launch
  stamp (see `launchStage.ts`) — currently only CAMS Section A is shared, and
  within one tool.
- Stanley-Brown and CAMS artifacts carry fidelity/licensing gates (build
  review, Guilford agreement) — reflect them in `licensing` metadata and the
  IG page, not just the memo.
