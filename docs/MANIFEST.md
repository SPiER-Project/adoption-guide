# SPiER Project Asset Manifest

This manifest provides a computer-readable and human-readable index of the assets in the SPiER (Suicide Prevention in EHRs) project.

## Project Strategy & Education
*   **`docs/PROJECT_OVERVIEW.md`**: Mission statement and technical roadmap.
*   **`docs/engagement-strategy.md`**: Three-tier engagement model (HIE / mid-range aggregator / direct EHR) plus the cross-cutting standards-body and federal-regulator layer.
*   **`docs/best-practices/strategy-consent.md`**: Architectural plan for cross-practice data sharing.
*   **`docs/best-practices/consent-vs-ds4p.md`**: Educational guide on FHIR Consent and data segmentation standards.
*   **`docs/best-practices/validation-guide.md`**: Instructions for technical and clinical validation of assets.
*   **`docs/best-practices/concept-harmonization.md`**: Conformance rationale for the cross-instrument concept layer — mapping disparate instruments (ASQ, C-SSRS, PHQ-9) to one common suicide-risk-tier representation, modeled on HL7 Gravity + SDC. Pairs with the `concept-harmonization` skill.
*   **`docs/best-practices/licensing-audit-template.md`**: Per-tool licensing-audit memo template. Instantiated as `FHIR-Resources/<tool>/licensing/MEMO.md`.
*   **`docs/best-practices/licensing-verification-backlog.md`**: What is still owed on instrument licensing — every status published by [#127](https://github.com/SPiER-Project/adoption-guide/issues/127) is traceable in-repo but **none is verified against the rights holder's current terms**. Standing list under epic [#64](https://github.com/SPiER-Project/adoption-guide/issues/64), which gates the org transfer.
*   **`docs/mock-ehr-demo-script.md`**: The ten-minute walkthrough of the hosted demo — SPiER launched inside the mock EHR at `spier-mock-ehr.bbthorson.workers.dev`. Who you are, which of the three "start here" charts to open and why, what to click, what you should see on the host after a write, and the four things the demo does and does not prove. The *what to click*; `services/mock-ehr/README.md` is the *why*. Written after the 2026-09-01 user review found the pages explained how they were built rather than what to do (#461, #462).
*   **`docs/repo-audit.md`**: Move 6d structural audit.
*   **`docs/scheduled-checks-triage.md`**: The timer-driven workflow (`terminology-nightly.yml`) — its schedule, its named reader, and what to do when it goes red. Distinguishes real terminology drift (fix the code) from a `tx.fhir.org` outage (re-run). Linked from every issue the workflow files. ⚠️ It described **two** workflows until `roadmap-snapshot.yml` was deleted along with the Roadmap page; the retained section on the org's no-Actions-PRs policy is kept as history for any future workflow that wants to open a PR.

## Requirements Sources & Plans
*   **`docs/reference/ssc-stage-tiles-question-set.md`**: Source spec for the eight-tile pathway stage/tool structure adopted July 2026. The stage PlanDefinitions and the tool catalog mirror its tiles.
*   **`docs/reference/suicide-care-dashboard-spec.md`**: The *Suicide Care Dashboard* deck (2026-08-11) transcribed as a durable spec — 12 dashboard panels, per-tier reassessment intervals, and 17 requested EHR data elements. A **Collaborative Care Model** registry: three panels and four filters are scoped by the PCP / BH care manager / psychiatric consultant triad, which SPiER has no role model for. ⚠️ Carries a terminology-verification finding: the deck's `Z91.82` is *personal history of military deployment*, not self-harm history — do not propagate it (same failure mode as [#220](https://github.com/SPiER-Project/adoption-guide/issues/220)).
*   **`docs/plans/suicide-care-dashboard.md`**: Implementation analysis of the above, tracked under epic [#277](https://github.com/SPiER-Project/adoption-guide/issues/277) with phases 1–2 filed as [#278](https://github.com/SPiER-Project/adoption-guide/issues/278) / [#279](https://github.com/SPiER-Project/adoption-guide/issues/279) — five modeling gaps (no care-team roles, unencoded reassessment intervals, the historical-risk axis, the consultant approval gate, outcome measures), a panel-by-panel disposition, the Population-view redesign, and a five-phase order that front-loads everything needing no new FHIR.
*   **`docs/reference/suicide-safer-care-pathway-spec.md`**: The *Suicide Safer Care Pathway* diagram (NCT Consulting, ©2023; now SPiER-owned per the 2026-09-01 decision recorded in the plan below) transcribed verbatim — three care events, the PHQ-9 Q9 positivity rule, the four risk tiers with their exact C-SSRS question/timeframe rules, per-tier obligation rows (crisis resources, safety planning, reassessment cadence, problem-list codes, contact frequency, step-down criteria), the high-risk extras, the milestone-events list, and the three KPIs. ⚠️ Carries the **same `Z91.82` error** as the dashboard spec (below) on its Historical-tier problem-list row — cites that doc's verification table rather than restating it, and states the corrected pair (`Z91.51`/`Z91.52`). Its "Published-instrument verification (Phase 1b)" section checked the diagram's C-SSRS triage ladder against the CMS-hosted 2008 screener and the Columbia Lighthouse Project's current (2026) Primary Care screener: **the diagram's Q4/Q5 → High and its recency-gating of Q6 are both confirmed** against the published color-coded item table and (for the 2026 document) its explicit textual response-protocol table, while the **shipped mapper's Q4 → moderate and recency-blind Q6 → high are both contradicted** by the same sources. It also found that neither published source defines a fourth "Historical" tier at all — a lifetime-only Q6 response scores Moderate under the published instrument, not the diagram's separate lower Historical tier — evidence for, not a resolution of, the plan's open question on whether Historical risk is a tier or an orthogonal flag.
*   **`docs/plans/suicide-safer-care-pathway.md`**: Plan for the *Suicide Safer Care Pathway* diagram (SPiER-owned; same clinical framework as the dashboard deck, **same `Z91.82` error** — the correction above applies): encode PHQ-9 → C-SSRS → tier → per-tier obligations as a published `PlanDefinition` that *references* (never restates) `SPiERReassessmentSchedule`, split the guide's `/guide/pathway` catalog into a Tools page + a rendered-from-the-artifact pathway page with a mapper-backed C-SSRS simulator, render the same view in the SMART app (Pattern A — artifacts bundled from the IG, the mock EHR serves no definitions), and surface problem-list guidance via CDS cards. Opens with the recorded decisions (one pathway in v1; tools as published; historical as a pending orthogonal flag) and ends with the clinical-team question list. ⚠️ Phase 1b records that the shipped C-SSRS screener mapper's tier ladder (Q4 → moderate; Q6 → high regardless of recency) **disagreed with the diagram**, now verified against the published instrument in the spec doc above — the diagram was right, the mapper is drifted; the mapper fix itself is Phase 1c, a separate PR pending clinical sign-off.

## Research
*   **`docs/standards-landscape.md`**: The surrounding standards ecosystem SPiER sits inside — US Core, SDC, Gravity, USCDI+ BH, and the federal behavioral-health IT initiatives.
*   **`docs/research/2026-07-terminology-crosswalk-research.md`**: Terminology, crosswalk-evidence, licensing and prior-art report. ⚠️ **Read its verification annex first** — several codes in the report body were checked against live terminology servers and found to be fabricated; the annex overrides the body.
*   **`docs/research/2026-08-us-behavioral-health-profiles-ig.md`**: Direct inspection (2026-08-12, defects re-verified 2026-08-13) of the HL7/ASTP **US Behavioral Health Profiles IG** CI build — what it actually contains (three profiles; the rest is unconstrained examples), the verified item-for-item C-SSRS and PHQ-9 LOINC alignment with SPiER, three structural gaps (**all closed by [#325](https://github.com/SPiER-Project/adoption-guide/pull/325)**, which also uncovered the category data-loss bug), five dated defects in the CI build, and the SAMHSA pilot cohort (45 partners, 9 states, testing completes end of 2026). ⚠️ Carries a **correction to itself**: the first version inferred from `open_issues_count: 0` that the upstream tracker was unattended, when in fact issues are *disabled* there — see its "Where to send feedback" table for the three candidate channels and which are live. Outstanding follow-ups are tracked as [#337](https://github.com/SPiER-Project/adoption-guide/issues/337) / [#338](https://github.com/SPiER-Project/adoption-guide/issues/338) / [#339](https://github.com/SPiER-Project/adoption-guide/issues/339); the HL7 Call to Action and the Consent mapping are deliberately unfiled, and the doc says why.

## Pilot Plans
*   **`docs/pilot-plans/hie-asq-portability.md`**: Sanitized two-phase pilot plan for cross-EHR ASQ portability via a state HIE. Anchors epic [#60](https://github.com/SPiER-Project/adoption-guide/issues/60). The named-partner version of this plan is kept private.
*   **`web/src/data/pilot-plans/asq.md`**: Per-tool pilot-prep notes for the ASQ Questionnaire (LOINC binding verification, SNOMED bindings, conditional-logic preservation).

## Use Cases
*   **`docs/use-cases/ed-scenario-11.md`**: First-pass FHIR + HL7 EHR System Functional Model mapping for the 24-step ED suicide-care scenario. Anchors epic [#61](https://github.com/SPiER-Project/adoption-guide/issues/61). Surfaces 22 profile gaps that feed into [#52](https://github.com/SPiER-Project/adoption-guide/issues/52) and [#53](https://github.com/SPiER-Project/adoption-guide/issues/53).

## Roadmap & Issue Tracking
*   **Source of truth:** [GitHub Issues](https://github.com/SPiER-Project/adoption-guide/issues) — one `type:epic` issue per tool (`tool:TL-XXX` label) plus cross-cutting priority epics (`priority:p1|p2|p3`) and workstream epics (HIE pilot, functional-profile bundles, engagement, licensing, briefing).
*   **Cross-cutting workstream epics (2026-05):** [#60](https://github.com/SPiER-Project/adoption-guide/issues/60) HIE pilot (two-phase ASQ portability), [#61](https://github.com/SPiER-Project/adoption-guide/issues/61) ED Functional Profile, [#62](https://github.com/SPiER-Project/adoption-guide/issues/62) Inpatient Functional Profile, [#63](https://github.com/SPiER-Project/adoption-guide/issues/63) Mid-range engagement, [#64](https://github.com/SPiER-Project/adoption-guide/issues/64) Tool licensing audit, [#65](https://github.com/SPiER-Project/adoption-guide/issues/65) Federal-regulator briefing.
*   **Bundle labels:** `bundle:ed-profile` groups the issues required for the ED Functional Profile to ship — the 6 gating tool epics (#21, #22, #24, #25, #26, #28) plus #52 (non-Questionnaire workflows) and #53 (IG profile pages).
*   **No site mirror.** GitHub Issues is the only place the roadmap lives. `/guide/roadmap`, its committed snapshot (`web/src/data/roadmap.generated.json`), the fetch script and the weekly refresh workflow were all removed — the snapshot was 356KB, 84% of it issue bodies rendered as 280-character excerpts, and it shipped as a 116KB gzip chunk pulled in by any page that imported it. `/guide/roadmap` redirects to Adoption Readiness, which now derives build status from the catalog (`launchActions`) instead of from epic labels.

## Skills (Claude Code)
*   **`.claude/skills/fhir-questionnaire-quality/`**: Review-time skill for evaluating FHIR R4 Questionnaire portability.
*   **`.claude/skills/assessment-to-ig/`**: Authoring skill — converts a validated assessment into the full SPiER IG artifact set (Questionnaire JSON, FSH, IG page, catalog wiring).
*   **`.claude/skills/concept-harmonization/`**: Cross-instrument skill — enforces the concept layer that spans instruments (common risk-tier CodeSystem/ValueSet, ConceptMap/StructureMap crosswalks, harmonized derived-Observation conformance, VSAC publication). The counterpart to the two instrument-scoped skills above.

## FHIR Implementation Guide
*   **Location:** `ig/`
*   **FSH sources:** `ig/input/fsh/` — one file per tool plus `pathway-stages.fsh` for all 8 stage PlanDefinitions (`identify-possible-risk`, `clarify-risk`, `define-risk-picture`, `document-safety-actions`, `coordinate-handoffs`, `track-follow-up`, `track-risk-over-time`, `measure-and-share`) and `spier-codesystem.fsh` for the pathway-stage CodeSystem.
*   **Generated FHIR JSON:** `ig/fsh-generated/resources/` (sushi output, gitignored). A subset is copied to `web/src/data/fhir/` by `npm run copy-fhir` for the React app.
*   **CI:** `.github/workflows/ig.yml` compiles FSH on every PR.

## Clinical Tool: Stanley-Brown Safety Plan
*   **Location:** `FHIR-Resources/Stanley-Brown/`
*   **Implementation Guide:** `FHIR-Resources/Stanley-Brown/README.md` (Includes Clinical Mapping Table).
*   **Key Assets:**
    *   `FHIR-Resources/Stanley-Brown/stanley-brown-questionnaire.json`: Data capture with LOINC coding.
    *   `FHIR-Resources/Stanley-Brown/Hybrid_CarePlan.json`: High-interoperability persistence model.
*   **Source:** `FHIR-Resources/Stanley-Brown/references/original-forms/Stanley-Brown-Safety-Plan-8-6-21.pdf`
*   **Primary pathway stage:** Document Safety Actions (4).

## Clinical Tool: CAMS (Collaborative Assessment and Management of Suicidality)
*   **Location:** `FHIR-Resources/CAMS/`
*   **Implementation Guide:** `FHIR-Resources/CAMS/README.md` (Explaining the Driver/Problem lifecycle).
*   **Key Assets:**
    *   `FHIR-Resources/CAMS/cams-ssf5-section-a.json`: Patient Assessment.
    *   `FHIR-Resources/CAMS/cams-ssf5-section-b.json`: Clinician Risk/Driver ID.
    *   `FHIR-Resources/CAMS/cams-stabilization-plan.json`: Safety Planning.
    *   `FHIR-Resources/CAMS/Stabilization_CarePlan_Template.json`: Persistence model.
    *   `FHIR-Resources/CAMS/cams-therapeutic-worksheet.json`: Interim session tool.
*   **Primary pathway stages:** Clarify Risk (2), Define the Risk Picture (3), Document Safety Actions (4), Track Risk Over Time (7).

## Other Clinical Frameworks
*   **ASQ (Ask Suicide-Screening Questions):** `FHIR-Resources/ASQ/` — primary stage: Identify Possible Risk (1).
*   **C-SSRS (Columbia-Suicide Severity Rating Scale):** `FHIR-Resources/C-SSRS/` — primary stages: Identify Possible Risk (1), Clarify Risk (2).
*   **PHQ-9 (Patient Health Questionnaire — 9-item):** `FHIR-Resources/PHQ-9/` — primary stage: Identify Possible Risk (1).
*   **SBQ-R (Suicide Behaviors Questionnaire-Revised):** `FHIR-Resources/SBQ-R/` — primary stage: Identify Possible Risk (1).

## Evaluation
*   **Evaluation:** `Evaluation/SPiER Evaluation Plan_12.23.2025.docx` (Placeholders - pending addition).

---
*Last Updated: 2026-09-01*
