# SPiER (Suicide Prevention in Electronic Health Records)

**Live:** [Implementation Guide](https://spier-project.github.io/adoption-guide/ig/) · [Companion app](https://spier-project.github.io/adoption-guide/) · [Roadmap](https://github.com/SPiER-Project/adoption-guide/milestones)

This file is the single prose home for what SPiER is and why. Everywhere else in the repository either links here or states only what its own reader needs: the [Implementation Guide](https://spier-project.github.io/adoption-guide/ig/) defines the artifacts, [`CLAUDE.md`](CLAUDE.md) documents the build, and [`docs/README.md`](docs/README.md) indexes everything else.

## Mission

**SPiER's mission is to make suicide-safer care the standard everywhere.** Front-line professionals encounter people at risk every day, but the tools and supports for suicide-safer care often aren't built into the systems they rely on — so critical opportunities for care get missed.

The reason is that everything that matters in suicide prevention currently lives only in human-readable form — validated screeners on paper, the equivalences between different tools in clinicians' heads, response protocols in plain-text guidelines. SPiER closes that gap by making each layer machine-actionable, in three steps that build on each other:

- **Capture** — translate validated tools (the **ASQ**, **C-SSRS**, **Stanley-Brown Safety Plan**, and others) out of paper and PDF into a single canonical FHIR shape (`Questionnaire` / `QuestionnaireResponse`), so each instrument is recorded identically in every system that uses it.
- **Translate** — define a shared, instrument-agnostic suicide-risk concept that every tool maps *into*, so a receiving system can act on a result **without having to run the same tool that produced it**. This mirrors the approach HL7's Gravity Project took for social-determinants screening.
- **Act** — encode the already-settled response protocols as executable logic (`PlanDefinition` + CDS Hooks), so the right next step surfaces at the right moment. SPiER recommends; the clinician decides.

We organize the work around an **8-stage Suicide Safer Care Pathway** so that implementations support the full longitudinal journey of a patient at risk — not just a single screen.

**How we deliver it.** The standards are **free, open, and vendor-neutral** — Implementation Guides, FHIR profiles, and value sets that any EHR or health system can adopt at no cost, with no vendor owning the canonical shape. Alongside the standards, SPiER partners across healthcare, behavioral health, community-based, and technology settings to embed these tools into the systems people already use, providing subject-matter expertise, training, and technical assistance.

## How SPiER works

The three steps are a dependency chain, and a roadmap: you can't translate a result you never captured in a structured way, and you can't automate a response to a risk tier you can't compute.

### Capture — make the tools writable

HL7 is the standards body that defines how healthcare data is structured and exchanged, and FHIR is their modern standard. National standards like **US Core** and **USCDI** already cover the basics — demographics, diagnoses, medications — but they don't yet specify *how* suicide screeners, risk assessments, and safety plans should be captured. Today every EHR captures that information a little differently — same questions, different shapes — which makes the data hard to share, hard to measure, and hard to act on. That's the gap SPiER fills.

SPiER translates each tool into a single canonical FHIR shape and contributes that work to the existing HL7 workgroups already shaping clinical data standards. The path is **draft → test with partners → contribute to HL7 → influence the published standard**, paired with a coalition of provider organizations who can collectively *demand* this consistency from their EHR vendors. Standards work alone is slow; standards plus a clear customer ask is what drives adoption nationwide.

### Translate — make different tools mutually intelligible

Partners don't all use the same instruments. One site screens with the ASQ, another with the Columbia (C-SSRS), another with PHQ-9 Item 9 — and some instruments have no published item-level LOINC codes at all. A receiving system shouldn't have to understand every tool to act on a result. SPiER therefore separates the **capture layer** — every question and answer, in high fidelity, coded to instrument-specific LOINC/SNOMED — from an instrument-agnostic **concept layer**: a lower-fidelity but universally consumable summary (*"positive screen, this severity tier, this date"*) that every instrument maps **into**, derived from the capture layer and linked back to it.

This mirrors HL7's **Gravity Project**, which harmonized SDOH screening instruments to a common set of coded concepts, and rides on **HL7 SDC** extraction mechanics. It is a single common suicide-risk-tier ValueSet carried on a generic LOINC (`93374-7`, *Suicide risk level*), populated from each instrument via a portable FHIR ConceptMap or StructureMap. Lower-fidelity instruments map to the widest defensible tier — the layer never fabricates precision it doesn't have — and the derived concept is treated as an *unconfirmed* screen warranting follow-up, not a diagnosis.

This is also SPiER's most contributable standards artifact. The path is **build it in-IG → prove it in the Big Sky Care Connect pilot → contribute to an HL7 Work Group** (Behavioral Health / Patient Care), with a standalone harmonization IG as a stage-2 ambition contingent on pilot traction. See [`docs/best-practices/concept-harmonization.md`](docs/best-practices/concept-harmonization.md) for the conformance rules.

### Act — make the response protocols executable

The clinical response to a positive screen already exists as endorsed, written protocol — it just can't fire on its own. SPiER encodes it as executable logic (`PlanDefinition` + CDS Hooks) so the right next step surfaces at the right moment: an acute-positive ASQ prompts a safety evaluation and a safety plan; a care transition prompts a caring-contact follow-up. This is the frontier of the work, and notably an *encoding* problem rather than a *consensus* problem, because the protocol content is already settled. Throughout, **SPiER recommends; the clinician — or the institution's configured policy — decides.**

## Why this matters

A patient at risk of suicide moves through many hands: ED, inpatient, outpatient, primary care, crisis line, community provider. Today the safety plan and risk assessment too often stay behind with the system that created them. EHRs hold the data and **Health Information Exchanges move it between organizations** — but exchange is only meaningful once the data is captured in a standard shape, translated into a concept any system can read, and tied to a clear next action.

**A concrete example.** A patient is screened with the ASQ in an emergency department, assessed with the Columbia Scale, and discharged with a Stanley-Brown Safety Plan. Forty-eight hours later they are seen by an outpatient clinician at a different organization. Today that clinician usually starts from scratch — re-screens, re-asks, re-builds the plan. With SPiER's work in place, the next clinician can see what's already been done — what screener, what risk level, what coping strategies and supports the patient already identified — and pick up where the ED left off.

The same standardized data also gives systems a foundation for measuring whether the pathway is working, which is a path to quality improvement at the population level.

**Toward a repeatable workstream across partner types.** The common entry point for every partner conversation is the 8-stage pathway below. Whether the partner is an EHR, an HIE, or another vendor, the opening rubric is the same: *which of these stages do you support today, and where are the gaps?* The specific FHIR artifacts SPiER produces plug in at different points depending on the partner, but the underlying model doesn't change. This is not yet a turnkey playbook — each engagement still teaches us something — but the pattern is consolidating.

## The SPiER Pathway

Eight stages, from the first signal to population measurement, so that an implementation supports the whole longitudinal journey rather than a single screen.

1. **Identify Possible Risk** — capture suicide-related signals (e.g. ASQ, PHQ-9 Item 9).
2. **Clarify Risk** — detailed assessment (e.g. C-SSRS Full, CAMS SSF-5).
3. **Define the Risk Picture** — clinical formulation and risk-level documentation (e.g. SAFE-T).
4. **Document Safety Actions** — collaborative safety planning and lethal-means counseling (e.g. Stanley-Brown).
5. **Coordinate Handoffs** — making safety data follow the patient through transitions.
6. **Track Follow-Up** — closed-loop outreach and caring contacts.
7. **Track Risk Over Time** — ongoing monitoring and treatment updates for patients in an open episode.
8. **Measure and Share the Data** — pathway analytics and quality improvement.

⚠️ **These names are a reading copy.** The stage codes and their official displays are defined once, in `ig/input/fsh/spier-codesystem.fsh`, and assembled into `PlanDefinition`s in `ig/input/fsh/pathway-stages.fsh`. Three of the display names changed in July 2026, so quote a stage by its code (`identify-possible-risk`, `clarify-risk`, `define-risk-picture`, `document-safety-actions`, `coordinate-handoffs`, `track-follow-up`, `track-risk-over-time`, `measure-and-share`) rather than by the wording here.

## What SPiER's technical work is trying to achieve

- **Pathway-driven logic** — automated triggers that move a patient from one stage to the next (a positive screen at Identify Possible Risk surfacing the Clarify Risk assessments, for instance) rather than relying on someone remembering to order the next step.
- **FHIR standardization** — every tool mapped to `Questionnaire`, `Observation`, `CarePlan` and the derived concept-layer resources, with one canonical shape per instrument.
- **An EHR adoption rubric** — a framework vendors and health systems can use to self-assess their support for the eight stages, which doubles as the opening question in every partner conversation.

## Repository structure

* **`ig/`** — the HL7 FHIR Implementation Guide. FSH sources in `input/fsh/` are compiled by SUSHI and are the **canonical, machine-readable** definition of every profile, ValueSet, CodeSystem, ActivityDefinition and PlanDefinition; narrative pages are in `input/pagecontent/`. Rendered at the [Implementation Guide](https://spier-project.github.io/adoption-guide/ig/) link above; see [`ig/README.md`](ig/README.md) to build it.
* **`FHIR-Resources/`** — hand-authored Questionnaire JSON and per-tool reference material, one folder per instrument. [`FHIR-Resources/README.md`](FHIR-Resources/README.md) has the tool→stage table.
* **`web/`** — the SPiER companion app (React/TS): the interactive pathway demo, patient and population views, and the EHR adoption rubric. It is also a SMART on FHIR app, and doubles as the reference implementation.
* **`packages/`** — `core/` (the React-free domain layer shared by the app and both Workers), `demo-population/` (the demo patients and scenario slices), and `fhir-artifacts/generated/` (SUSHI output, gitignored).
* **`services/`** — two Cloudflare Workers: `cds-hooks/` serves the live `/cds-services` endpoint, and `mock-ehr/` is the host chart the demo launches from.
* **`docs/`** — strategy, requirements sources, research, and plans. [`docs/README.md`](docs/README.md) is the index.
* **`scripts/`** — repo-level tooling: the FHIR validator and FML gates, the IG-menu, IG-narrative, markdown-link and SUSHI-output checks, and the use-case-workbook builder.

Build commands, verification gates and the reasoning behind them live in [`CLAUDE.md`](CLAUDE.md), which is the one home for that material.

## Clinical frameworks

Eleven instruments are modeled today: ASQ, BSSA, C-SSRS, CAMS, CRP, PHQ-9, PSS-3, PSS-Full, SAFE-T, SBQ-R and the Stanley-Brown Safety Plan. A twelfth folder, `CARS-S/`, holds a licensing audit and no artifacts — the outcome there was NO-GO pending written permission. Rather than restate stage membership or scoring here, see:

- [`FHIR-Resources/README.md`](FHIR-Resources/README.md) — the tool→stage table and what each folder holds.
- Each tool's `ActivityDefinition` in the IG — the authority for its stage, codes and licensing status.
- [`docs/best-practices/licensing-verification-backlog.md`](docs/best-practices/licensing-verification-backlog.md) — what is and isn't verified about instrument licensing.

## Roadmap and issue tracking

Tool-level and cross-cutting work is tracked in [GitHub Issues](https://github.com/SPiER-Project/adoption-guide/issues), which is the **only** place the roadmap lives — there is no site mirror and no committed snapshot. Create and edit issues in GitHub directly; the label taxonomy already exists on the repo and there is no seed step.

Label conventions: `tool:TL-XXX`, `priority:p1|p2|p3`, `status:built|planned|future`, `type:epic|task`, `stage:<slug>`, `area:<slug>`. Cross-cutting workstreams and per-tool epics are listed in [`docs/README.md`](docs/README.md).

## Contributing

This repository holds the canonical source for SPiER's technical and clinical definitions. Read [`CLAUDE.md`](CLAUDE.md) before changing anything under `ig/`, `packages/` or `web/` — it names the verification gate for each tree, and several of them exist because a defect got through once.

The `.claude/skills/assessment-to-ig/` skill walks through converting a validated clinical assessment into the full SPiER artifact set (Questionnaire JSON + FSH + IG page + catalog wiring); `fhir-questionnaire-quality` is the review counterpart, and `concept-harmonization` covers work that spans instruments.
