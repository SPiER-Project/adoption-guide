# SPiER documentation

The index of every narrative document in this repository. It replaces the two
indexes that used to sit here (`README.md` and `MANIFEST.md`), which had drifted
apart and between them named eight paths that no longer existed.

## How this folder is organized

Each kind of prose has **one** home. Everywhere else either links to it or is
generated from it — that is what keeps a claim from being true in one file and
false in another.

| Kind of prose | Home | Everything else |
|---|---|---|
| Element definitions, bindings, why a profile is shaped this way | FSH `Description` / `^purpose` in `ig/input/fsh/` (renders in the published IG) | FSH `//` comments hold repo mechanics only |
| How to read, query, or conform to the artifacts | `ig/input/pagecontent/` | the app links to it, never restates it |
| Build commands, gates, tooling, repo history | [`CLAUDE.md`](../CLAUDE.md); a folder README links to it | never in an IG page |
| Mission and pitch | [`../README.md`](../README.md) | the IG index keeps two sentences and a link |
| Stage names and tool ids | the pathway-stage CodeSystem and the ActivityDefinitions | docs quote by code, or link to the IG artifact page |
| Adoption guidance, readiness, rubric | the app, as data modules | not JSX paragraphs |
| Plans and status | GitHub issues, plus each plan doc's own status table | finished plans move to [`plans/archive/`](plans/archive/) with a banner |
| Licensing evidence | `FHIR-Resources/<tool>/licensing/MEMO.md` | the FSH extension states the *status*; the MEMO is the evidence — both are kept |

⚠️ **Docs have no CI gate** — only [`use-cases/`](use-cases/) and
[`outreach/`](outreach/) are checked by a workflow. Everything else here is
ungated prose, so a claim written into one of these files stays wrong until a
person reads it. Verify before you write, and prefer a link to a restatement.

A new doc goes in `reference/` if it transcribes an external source, `plans/`
if it proposes work, `research/` if it reports an investigation,
`best-practices/` if it is guidance, and nowhere at all if the fact belongs in
the FSH or in `CLAUDE.md`.

## Strategy and education

* [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) — mission statement and technical roadmap.
* [`engagement-strategy.md`](engagement-strategy.md) — the three-tier engagement model (HIE / mid-range aggregator / direct EHR) plus the cross-cutting standards-body and federal-regulator layer.
* [`one-pager.md`](one-pager.md) — a short prose pitch. The **outreach** one-pager that gets sent to people is built from HTML instead; see [`outreach/README.md`](outreach/README.md).
* [`standards-landscape.md`](standards-landscape.md) — the surrounding standards ecosystem SPiER sits inside: US Core, SDC, Gravity, USCDI+ BH, and the federal behavioral-health IT initiatives.
* [`best-practices/consent-vs-ds4p.md`](best-practices/consent-vs-ds4p.md) — educational guide on FHIR Consent and data-segmentation standards.
* [`best-practices/strategy-consent.md`](best-practices/strategy-consent.md) — architectural plan for cross-practice data sharing.
* [`best-practices/validation-guide.md`](best-practices/validation-guide.md) — how to validate the artifacts, technically and clinically.
* [`best-practices/concept-harmonization.md`](best-practices/concept-harmonization.md) — conformance rationale for the cross-instrument concept layer: mapping disparate instruments (ASQ, C-SSRS, PHQ-9) into one common suicide-risk-tier representation, modeled on HL7 Gravity + SDC. Pairs with the `concept-harmonization` skill.
* [`best-practices/licensing-audit-template.md`](best-practices/licensing-audit-template.md) — the per-tool licensing-audit memo template, instantiated as `FHIR-Resources/<tool>/licensing/MEMO.md`.
* [`best-practices/licensing-verification-backlog.md`](best-practices/licensing-verification-backlog.md) — what is still owed on instrument licensing. Every status published by [#127](https://github.com/SPiER-Project/adoption-guide/issues/127) is traceable in-repo, but **none is verified against the rights holder's current terms**. Standing list under epic [#64](https://github.com/SPiER-Project/adoption-guide/issues/64), which gates the org transfer.

## Demos and operations

* [`mock-ehr-demo-script.md`](mock-ehr-demo-script.md) — the ten-minute walkthrough of the hosted demo, with SPiER launched inside the mock EHR over a real SMART launch. Who you are, which of the three "start here" charts to open and why, what to click, what you should see on the host after a write, and what the demo does and does not prove. This is the *what to click*; [`services/mock-ehr/README.md`](../services/mock-ehr/README.md) is the *why*.
* [`smart-sandbox-testing.md`](smart-sandbox-testing.md) — how to exercise the app's SMART on FHIR live read/write path against the public SMART App Launcher sandbox, including what the hash router costs the OAuth redirect.
* [`scheduled-checks-triage.md`](scheduled-checks-triage.md) — the timer-driven workflow (`terminology-nightly.yml`): its schedule, its named reader, and what to do when it goes red. Distinguishes real terminology drift (fix the code) from a `tx.fhir.org` outage (re-run). Linked from every issue the workflow files.

## Requirements sources

Verbatim transcriptions of external specs. Keep them faithful; put editorial
judgment in the matching plan instead.

* [`reference/ssc-stage-tiles-question-set.md`](reference/ssc-stage-tiles-question-set.md) — source spec for the eight-tile pathway stage/tool structure adopted July 2026. The stage PlanDefinitions and the tool catalog mirror its tiles.
* [`reference/suicide-care-dashboard-spec.md`](reference/suicide-care-dashboard-spec.md) — the *Suicide Care Dashboard* deck (2026-08-11) transcribed: 12 panels, per-tier reassessment intervals, 17 requested EHR data elements. A **Collaborative Care Model** registry — three panels and four filters are scoped by the PCP / BH care manager / psychiatric consultant triad, which SPiER has no role model for. ⚠️ Carries a terminology-verification finding: the deck's `Z91.82` is *personal history of military deployment*, not self-harm history — do not propagate it (the same failure mode as [#220](https://github.com/SPiER-Project/adoption-guide/issues/220)).
* [`reference/suicide-safer-care-pathway-spec.md`](reference/suicide-safer-care-pathway-spec.md) — the *Suicide Safer Care Pathway* diagram (NCT Consulting, ©2023; now SPiER-owned) transcribed verbatim: three care events, the PHQ-9 Q9 positivity rule, four risk tiers with their exact C-SSRS question/timeframe rules, per-tier obligation rows, the high-risk extras, the milestone events, and the three KPIs. ⚠️ Carries the **same `Z91.82` error** on its Historical-tier row, and states the corrected pair (`Z91.51`/`Z91.52`). Its Phase-1b section checks the diagram's C-SSRS triage ladder against the published instrument and finds the **diagram right and the shipped mapper drifted**.

## Plans

Each plan carries its own status table, which is the source of truth for what
has landed. A finished plan moves to [`plans/archive/`](plans/archive/) with a
`> Archived <date>: work complete (PR #NNN).` banner rather than being deleted.

* [`plans/next-session-handoff.md`](plans/next-session-handoff.md) — start here. Deliberately short: it says which plan to read first and why, and records what happens when a plan doc is not kept current.
* [`plans/docs-and-ig-content-consolidation.md`](plans/docs-and-ig-content-consolidation.md) — this consolidation: repo mechanics leaked into the IG pages, normative rationale leaked out into FSH `//` comments the publisher never renders, and the pitch and stage list were each copied five to seven times. Three phases; its Status table says what has landed.
* [`plans/structure-simplification-scope.md`](plans/structure-simplification-scope.md) — phased simplification of the repo's layout; one PR per phase, never combined.
* [`plans/repo-and-package-boundaries.md`](plans/repo-and-package-boundaries.md) — one repo with declared packages, and why the answer to "separate repos?" turned out to be a different question.
* [`plans/surfaces-and-distribution.md`](plans/surfaces-and-distribution.md) — what counts as an app, what ships to whom, and where each surface runs.
* [`plans/embedded-panel-smart-launch.md`](plans/embedded-panel-smart-launch.md) — SPiER as a SMART app launched from a host chart into the right third of the screen.
* [`plans/mock-patient-smart-launch.md`](plans/mock-patient-smart-launch.md) — mock patients for a SMART launch: a Bundle first, a server maybe.
* [`plans/user-scoped-smart-launch.md`](plans/user-scoped-smart-launch.md) — close [#401](https://github.com/SPiER-Project/adoption-guide/issues/401) and retire the guide's bundled patient data. Scoped 2026-09-01; wants its own clean session.
* [`plans/smart-filler-writeback-ladder.md`](plans/smart-filler-writeback-ladder.md) — the SMART Form-Filler writeback ladder, re-derived from the code for [#350](https://github.com/SPiER-Project/adoption-guide/issues/350).
* [`plans/suicide-care-dashboard.md`](plans/suicide-care-dashboard.md) — implementation analysis of the dashboard deck, under epic [#277](https://github.com/SPiER-Project/adoption-guide/issues/277): five modeling gaps, a panel-by-panel disposition, the Population-view redesign, and a five-phase order that front-loads everything needing no new FHIR.
* [`plans/suicide-safer-care-pathway.md`](plans/suicide-safer-care-pathway.md) — encode PHQ-9 → C-SSRS → tier → per-tier obligations as a published PlanDefinition that *references* (never restates) `SPiERReassessmentSchedule`, split the guide's catalog from a rendered-from-the-artifact pathway page, and surface problem-list guidance via CDS cards.
* [`plans/stage-5-coordinate-handoffs.md`](plans/stage-5-coordinate-handoffs.md), [`plans/stage-6-track-follow-up.md`](plans/stage-6-track-follow-up.md), [`plans/stage-7-track-risk-over-time.md`](plans/stage-7-track-risk-over-time.md) — per-stage FHIR design for the Stage 5/6/7 tools.

## Research

* [`research/2026-07-terminology-crosswalk-research.md`](research/2026-07-terminology-crosswalk-research.md) — terminology, crosswalk-evidence, licensing and prior-art report. ⚠️ **Read its verification annex first** — several codes in the report body were checked against live terminology servers and found to be fabricated; the annex overrides the body.
* [`research/2026-08-us-behavioral-health-profiles-ig.md`](research/2026-08-us-behavioral-health-profiles-ig.md) — direct inspection of the HL7/ASTP **US Behavioral Health Profiles IG** CI build: what it actually contains (three profiles; the rest is unconstrained examples), the verified item-for-item C-SSRS and PHQ-9 LOINC alignment with SPiER, three structural gaps (all closed by [#325](https://github.com/SPiER-Project/adoption-guide/pull/325), which also uncovered the category data-loss bug), five dated defects in the CI build, and the SAMHSA pilot cohort. ⚠️ Carries a correction to itself: the first version inferred an unattended upstream tracker from `open_issues_count: 0`, when issues are in fact *disabled* there.

## Pilots and use cases

* [`pilot-plans/hie-asq-portability.md`](pilot-plans/hie-asq-portability.md) — sanitized two-phase pilot plan for cross-EHR ASQ portability via a state HIE. Anchors epic [#60](https://github.com/SPiER-Project/adoption-guide/issues/60). The named-partner version is kept private.
* [`use-cases/README.md`](use-cases/README.md) — the HL7 behavioral-health use-case workbook. ⚠️ `ed-scenario-11.json` is the **source**; the `.md` and everything in `dist/` are generated by `node scripts/build-use-case-workbook.mjs` and gated by `--check`. Read that README before editing anything in the folder.
* [`outreach/README.md`](outreach/README.md) — outreach assets, including the two-sided one-pager built from `web/public/SPiER-Overview-Care-Pathway.html` (the PDF and `onepager.build.json` are generated), plus the standing question lists for the dashboard author and the Zero Suicide Institute.

## Where the artifacts themselves live

Prose about *how the repo is built* belongs in [`CLAUDE.md`](../CLAUDE.md);
these are just the pointers.

* **FHIR Implementation Guide** — `ig/`. FSH sources in [`ig/input/fsh/`](../ig/input/fsh/) are the canonical, machine-readable definition of every profile, ValueSet, CodeSystem, ActivityDefinition and PlanDefinition. Narrative pages are in `ig/input/pagecontent/`. See [`ig/README.md`](../ig/README.md) for how to compile and verify it; `.github/workflows/ig.yml` compiles the FSH on every PR.
* **Pathway stages** — the eight stage codes are defined once, in `ig/input/fsh/spier-codesystem.fsh`, and assembled into PlanDefinitions in `ig/input/fsh/pathway-stages.fsh`. Quote them by code rather than by name; three of the display names changed in July 2026.
* **Hand-authored Questionnaires** — [`FHIR-Resources/README.md`](../FHIR-Resources/README.md), one folder per tool, with the tool→stage table and the per-tool provenance READMEs.
* **Demo app** — `web/`. The React-free domain layer is `packages/core/`, the demo patients are `packages/demo-population/`, and SUSHI's output is copied into `packages/fhir-artifacts/generated/` (gitignored) by `npm run copy-fhir`.
* **Workers** — `services/cds-hooks/` (the live `/cds-services` endpoint) and `services/mock-ehr/` (the host the demo launches from), each with its own README and its own `npm run verify`.

## Roadmap and issue tracking

* **Source of truth:** [GitHub Issues](https://github.com/SPiER-Project/adoption-guide/issues) — one `type:epic` issue per tool (`tool:TL-XXX` label), plus cross-cutting priority epics (`priority:p1|p2|p3`) and workstream epics.
* **Cross-cutting workstream epics (2026-05):** [#60](https://github.com/SPiER-Project/adoption-guide/issues/60) HIE pilot (two-phase ASQ portability), [#61](https://github.com/SPiER-Project/adoption-guide/issues/61) ED Functional Profile, [#62](https://github.com/SPiER-Project/adoption-guide/issues/62) Inpatient Functional Profile, [#63](https://github.com/SPiER-Project/adoption-guide/issues/63) Mid-range engagement, [#64](https://github.com/SPiER-Project/adoption-guide/issues/64) Tool licensing audit, [#65](https://github.com/SPiER-Project/adoption-guide/issues/65) Federal-regulator briefing.
* **Bundle labels:** `bundle:ed-profile` groups the issues the ED Functional Profile needs in order to ship — six gating tool epics plus [#52](https://github.com/SPiER-Project/adoption-guide/issues/52) (non-Questionnaire workflows) and [#53](https://github.com/SPiER-Project/adoption-guide/issues/53) (IG profile pages).
* **No site mirror.** GitHub Issues is the only place the roadmap lives. The `/guide/roadmap` page, its committed snapshot, the fetch script and the weekly refresh workflow were all removed — the snapshot was 356KB, 84% of it issue bodies rendered as short excerpts, and it shipped as a 116KB gzip chunk pulled in by any page that imported it. `/guide/roadmap` now redirects to Adoption Readiness, which derives build status from the tool catalog instead of from epic labels.

## Claude Code skills

* `.claude/skills/fhir-questionnaire-quality/` — review-time skill for evaluating a single FHIR R4 Questionnaire's portability.
* `.claude/skills/assessment-to-ig/` — authoring skill: converts a validated assessment into the full SPiER artifact set (Questionnaire JSON, FSH, IG page, catalog wiring).
* `.claude/skills/concept-harmonization/` — cross-instrument skill: enforces the concept layer that spans instruments (common risk-tier CodeSystem/ValueSet, ConceptMap/StructureMap crosswalks, harmonized derived-Observation conformance).
