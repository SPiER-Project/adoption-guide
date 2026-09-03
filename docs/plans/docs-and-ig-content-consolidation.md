# Docs and IG content consolidation: one home per kind of prose

Written 2026-09-03 from a review of every narrative file in the repo — the eight
IG pages, the IG config and READMEs, `docs/` (42 files, ~10.5k lines), the
per-tool READMEs, and the prose the app stores in TSX and TS. The review found
three kinds of leakage rather than one problem:

1. **Repo mechanics and project history leaked *into* the IG pages**, where an
   implementer cannot use them (build switches, `npm run` gates, issue numbers,
   `TL-0NN` ids the IG never defines).
2. **Normative rationale leaked *out* of the IG into FSH `//` comments**, which
   the IG Publisher never renders (~2,150 of ~9,600 FSH lines; six files are
   more than 40% comment).
3. **The pitch and the stage list were copied** — seven and five places
   respectively, three of them with stage names retired in July 2026.

The app is the exception: it already derives stages, tools and licensing from
the FSH. Its problem is prose stored as JSX, not duplication.

⚠️ **Revised the same day.** The review was made in a worktree 65 commits
behind `origin/main`, so the first version named paths that had moved
(`web/src/data/fhir/` → `packages/fhir-artifacts/generated/`; the catalog →
`packages/core/src/data/catalog/`) and proposed two things `main` already had
(#443 archived finished plans; #410 built an IG-menu gate). Every path and
claim below was re-checked against `main` at `80cf932`. Phase A ran against
the stale base and needs a rebase — **task A0, do it first.**

This plan is a **sequenced cleanup**, sized to run as separate sessions. Each
task names the model that should run it, the files it may touch, what "done"
means, and a prompt to start it with. Tasks in a phase are independent unless a
dependency is stated; phases are ordered because later ones rely on earlier
facts being true.

## Status

Rewrite this table at the end of every task — that is the repo's convention,
and `docs/plans/next-session-handoff.md` is the record of what happens when a
plan doc is not kept current.

| Task | Model | State |
|---|---|---|
| A0 — Rebase Phase A onto `main` (supersedes #468) | Opus 5 (done by Sonnet 5, at user's direction) | done — root checkout reset from the corrupted `fc9d334` to `origin/main`; branch `claude/docs-consolidation-phase-a-rebased` created from `origin/main@80cf932`; A3 (`93338d3`) and A5 (`1a821ae`) cherry-picked with `-x`, both clean; A1, A2, A4 redone (see their own rows); plan doc and its `docs/MANIFEST.md` index line added. `git diff origin/main...HEAD --stat` touches only Phase A files + the plan doc + the MANIFEST line. PR [#469](https://github.com/SPiER-Project/adoption-guide/pull/469), superseding (closed, comment posted) [#468](https://github.com/SPiER-Project/adoption-guide/pull/468). |
| A1 — IG pages: fix the false claims and the app links | Sonnet 5 | done, redone against `main` in A0 — Must-Support/CapabilityStatement status fixed in `how-to-read.md` and `index.md`; clinical primer extended from 4 to 11 instruments (descriptions read from each tool's ActivityDefinition); the ConceptMap/StructureMap subset now links `conformance.html#harmonization-status` instead of restating four of its seven rows; the three `#/guide/roadmap` links (dead since #440) retargeted to the GitHub milestones URL the root README uses, plus a stale "roadmap" mention in index.md's app-feature list. Items 2 and 5 confirmed already fixed by #410/#383, untouched. `npx fsh-sushi .` clean; `grep -rn 'implementation-guide' ig/input/pagecontent` empty; `node scripts/check-ig-menu.mjs` passes. PR #469. |
| A2 — Quick Starts: cover every published instrument | Sonnet 5 | done, redone against `main` in A0 with the `http://thespierproject.org/fhir` canonical (#425) — added blocks for BSSA, PSS-3, PSS-Full, SAFE-T, CAMS (Section A / Section B / Outcome-Disposition), CRP, and Stanley-Brown (CarePlan, `_profile`-distinguished from CRP); folded C-SSRS Since-Last-Contact and Pediatric into the existing block. Every Questionnaire url+version and derived-profile id/code read from `main`'s FSH and Questionnaire JSON — none reused from the stale #468 version. `npx fsh-sushi .` and `node scripts/validate-fhir.mjs` clean (452 resources, 0 errors); every `code=`/`_profile=` value verified verbatim against FSH/generated StructureDefinitions; all 16 `Administer*`/`Author*` ADs with a `FHIR-Resources/` Questionnaire now covered. PR #469. |
| A3 — IG pages: remove repo internals and unresolvable tool ids | Sonnet 5 | done — cherry-picked cleanly from #468 (`93338d3`) with no changes needed. PR #469 (superseding #468, where it originally landed). |
| A4 — `ig/README.md` and `ig/drafts/README.md` rewrite | Sonnet 5 | done, redone against `main` in A0 — same content as #468 plus the `http://thespierproject.org/fhir` canonical (#425, already present in the pre-rewrite file) and a new Verification-table row for `node scripts/check-ig-menu.mjs`, which didn't exist when this task was first written. 79 lines (target: under 80). Verified every command from the directory the README names. PR #469. |
| A5 — Retired stage names in root README, PROJECT_OVERVIEW, FHIR-Resources README | Sonnet 5 | done — cherry-picked cleanly from #468 (`1a821ae`) with no changes needed; re-ran the done-when grep against `main`, still clean except the one deliberately-excluded historical narration in `docs/plans/suicide-care-dashboard.md`. PR #469 (superseding #468, where it originally landed). |
| B1 — One `docs/` index; finish the archive #443 started | Sonnet 5 (done by Opus 5, with B2/B3 in one session) | done — `docs/MANIFEST.md` deleted and merged into `docs/README.md`, which now opens with a "How this folder is organized" preamble carrying this plan's content contract. All six dead MANIFEST paths dropped (`Evaluation/…`, `web/src/data/pilot-plans/asq.md`, `web/src/data/fhir/`, `web/src/data/roadmap.generated.json`, `ig/fsh-generated/resources/` as browsable, the literal `<tool>`), as were `docs/README.md`'s two links to the pre-restructure `../CAMS/` and `../Stanley Brown Safety Plan/`. Per-tool stage membership is no longer restated here at all — it links to `FHIR-Resources/README.md` and `pathway-stages.fsh`, per the contract. The index now also covers the 14 live plans, the 8 archived ones, `smart-sandbox-testing.md`, `one-pager.md`, and the two CI-gated folders' own READMEs, none of which either index named. `docs/repo-audit.md` → `docs/plans/archive/repo-audit.md` with #443's banner form; its three inbound links retargeted (`pathway-stages.fsh`, `observationMappers/index.ts` — whose `../../docs/` prefix was already broken — and the index entry). MANIFEST's inbound links retargeted in `PROJECT_OVERVIEW.md`, `.claude/skills/assessment-to-ig/SKILL.md`, `next-session-handoff.md` and two plan docs; the three surviving mentions are historical narration in archived or plan prose. Verified: all 47 relative links in the new index resolve, `build-use-case-workbook.mjs --check` and `build-onepager.mjs --check` pass, `web/ npm run verify` green (858 tests), `check-sushi-output.mjs` 0 errors / 6 expected warnings, `check-ig-menu.mjs` passes. |
| B2 — One home for the pitch: merge PROJECT_OVERVIEW into README | Opus 5 | done — `README.md` is now the single prose home and says so in its second paragraph. PROJECT_OVERVIEW's three unique bodies of content are folded in: the per-step depth under Capture/Translate/Act (the `draft → test → contribute → influence` path, LOINC `93374-7`, the widest-defensible-tier rule, the Big-Sky-to-HL7 contribution path), the *Toward a repeatable workstream* paragraph, and Technical Goals (rewritten as *What SPiER's technical work is trying to achieve*). Its Feb-2026 four-item *Project Phases* list is deliberately **not** carried over — phases 1–2 describe work long finished and the list asserts a sequencing the tree has overtaken; carrying it would have been an unverified claim. PROJECT_OVERVIEW deleted; its one remaining inbound link (`docs/README.md`) retargeted, the other having gone with `MANIFEST.md` in B1. IG `index.md` keeps its status table, its two mission sentences and the three Capture/Translate/Act bullets, with the restated *guiding idea* framing replaced by a one-line pointer at the README and the bullets reframed as vocabulary the guide's own reader needs. `how-to-read.md`'s Capture→Translate→Act section is left alone — it is a FHIR-artifact/fidelity table, scope rather than pitch. `docs/one-pager.md` became a **pointer**: `docs/outreach/README.md` names `web/public/SPiER-Overview-Care-Pathway.html` as the source and never mentioned the `.md`, whose prose last changed at #101 and was superseded by the HTML at #290 — so it was a fourth uncheckable copy of the pitch. ⚠️ **One thing lost a Markdown home:** the draft's *"Who's behind it"* framing (Kelly Samuelson as project director; SPiER as Zero Suicide's technology-enablement counterpart) is now only in git history and, partially, in the outreach HTML's funding credits — a call for the user, not for a task that may not invent claims. Three README claims were false before this and are fixed in passing: the roadmap section still documented `web/src/data/roadmap.generated.json`, `web/scripts/fetch-roadmap.mjs` and `roadmap-snapshot.yml`, all three deleted; `scripts/` was described as roadmap seeding; and *Key Clinical Frameworks* listed 4 tools (one as "CSS-RS") where 11 are modeled and a 12th is a licensing NO-GO placeholder — that section now links to `FHIR-Resources/README.md` and the ActivityDefinitions instead of restating, per the content contract. Verified: all 61 relative links across the three touched Markdown files resolve, `check-ig-menu.mjs` and `check-sushi-output.mjs` pass (0 errors / 6 expected warnings), `build-onepager.mjs --check` still current. |
| B3 — Per-tool READMEs: provenance and folder contents only | Opus 5 | done — **twelve** tool READMEs, not ten (BSSA and CARS-S were added after this task was written). 1,120 lines → 807 across the twelve plus `FHIR-Resources/README.md` and `Stanley-Brown/docs/data-mapping.md`. CARS-S needed **no change** — a licensing-audit placeholder is already exactly provenance-and-contents. Every removal was checked against the artifact first, and the checks kept as much as they cut: the C-SSRS ladder went (`CSSRSRiskLevelCodes`' concept definitions state it, recency rule included, and they render), the BSSA disposition criteria and next steps went (each disposition code's definition carries them verbatim), the PSS-3 positive-screen rule went (`PSS3ResultCodes`), the SBQ-R point weights went (`ordinalValue` on every `answerOption`), the CRP and Stanley-Brown section tables went (both profiles declare every section as a **named slice**, so the codes are readable off the artifact) — while SBQ-R's sensitivity/specificity/AUC figures, PHQ-9's and SAFE-T's action columns, ASQ's age-dependent refusal rule and every tool's "conditional item means *not asked*" rule all **stayed**, under an explicit *Informational — not stated by any artifact* heading. `data-mapping.md` became a pointer at the FML, the runtime mapper and the golden file; the plan's check found the FML's published description did **not** carry the embed-vs-reference rationale, so it was added there (the only `ig/` change) alongside its own stale `web/src/lib/…` mapper path. Nine false claims were found and fixed rather than moved: **eight wrong filenames** across C-SSRS, SBQ-R, PHQ-9, CAMS and Stanley-Brown (`fhir/questionnaires/…`, `CAMS_SSF5_SectionB_Questionnaire.json`, `Stanley_Brown_Hybrid_CarePlan_Template.json` — none of those paths exists); a whole `Not ready/` section describing two files that are gone (the FML is published now); CAMS's "SSF Outcome form (to be built)", which is built, shipped and launchable; ASQ's claim that its root code "is currently `93373-9`" — the **C-SSRS** panel — flatly contradicted by the same file 80 lines earlier and by the Questionnaire; ASQ's pointer at an app Pilot-Plan page that no longer exists; C-SSRS's claim that Since-Last-Contact shares panel `93373-9` (it deliberately carries **no** root code, and `cssrs-interval-item.fsh`'s description says why); a pre-July-2026 stage vocabulary in the PSS-3, C-SSRS and SAFE-T pathway blocks ("the Assessment phase"); `FHIR-Resources/README.md` missing CARS-S entirely and claiming CAMS spans **four** stages including Track Risk Over Time, where `pathway-stages.fsh` puts its ADs in three; and SBQ-R's flat *"Permission for use granted by A. Osman, MD"* — which the FSH deliberately reads as **licensing status UNKNOWN, do not read as free reuse**. The four tools with **no** licensing memo (PHQ-9, SBQ-R, CAMS, Stanley-Brown) now say so, and Stanley-Brown's README now states the condition it never mentioned: written author permission is required for EMR use and **SPiER has filed none**. Also fixed 11 stale paths inside the licensing MEMOs (`web/src/data/catalog/tools.ts` → `packages/core/…`; four references to the deleted `roadmap.generated.json`) — a path correction, not a change to any licensing claim. Verified: `validate-fhir.mjs` 452 resources / 0 errors, `check-fml.mjs --tx` all 5 maps compile and both response shapes match the golden CarePlan, `check-sushi-output.mjs` 0 errors / 6 expected warnings, `web/ npm run verify` green (858 tests), both Workers' `verify` green (35 + 160 tests), all 58 relative links under `FHIR-Resources/` resolve, and `FHIR-Resources/README.md`'s stage table is now **derived** from `pathway-stages.fsh` rather than hand-kept. |
| C1 — Extend `check-ig-menu.mjs` into an IG narrative gate | Opus 5 | done — a SIBLING, `scripts/check-ig-narrative.mjs`, not an extension: checks F and H resolve against `ig/fsh-generated/`, so folding E–H into the menu gate would have pushed the whole thing past the compile, and letting them degrade when `fsh-generated/` is absent is the #232/#261 shape exactly. They share `scripts/lib/ig-config.mjs` (the `pages:` reader, a new `path-resource` reader, `GENERATED_PAGES`). Three things were harder than this task anticipated, each load-bearing: **H needs `path-resource`, not just `fsh-generated/`** — the five FML StructureMaps are hand-authored `.fml` absent from SUSHI's output, so an index built only from `fsh-generated/` called all five StructureMap pages broken, and the natural "fix" would have deleted the guide's only navigation to its own transformations (the directory list is read from the config, not hardcoded); **G's route reader has to be a scanner**, since `App.tsx` nests routes and wraps attribute lists across lines with `element={<X />}` containing its own `>` — it tracks quote state and JSX brace depth and bails on an unterminated tag; and **an index route navigating RELATIVELY is not a redirect away** but a parent picking its default child (`/patient` → `chart`), so without that distinction G reports a false positive on a perfectly good link. F is implemented in its post-C2 form (resolve against published identifiers) rather than as a prohibition, and the plan's step-6 question is answered: `TL-` ids are NOT restored to the prose, because A3's named links to the AD pages are better for a reader, so F enforces resolvability rather than style. Thirteen planted defects each watched to exit non-zero — one per check (E three ways, F, G twice plus the guide-section half, H twice plus a moved `.fml`) and every liveness mode (zero pages, zero `<Route>` tags, an unreadable `GUIDE_SECTIONS`, a missing `fsh-generated/`); three false-positive controls checked to still PASS (`#93374-7` must not read as issue `#93374`; a published `TL-` id and a live route must be accepted). `ig.yml` runs it after the SUSHI-warning gate and now triggers on `web/src/App.tsx` and `web/src/data/guideSections.ts`. CLAUDE.md's `check-ig-menu.mjs` block is extended rather than joined by a second, and its stale claim that that gate owns `.html` links is corrected to check H. |
| C1a — Repo-wide markdown relative-link gate (adjacent to C1, not part of it) | Opus 5 | done — `scripts/check-md-links.mjs` + `docs-links.yml`, the only workflow triggering on `docs/**` and the root `README.md`. Found 14 links left dead by #389/#392 and the Roadmap deletion; #470 had fixed 4 of them by hand, this fixed the other 10 plus `web/README.md`'s deleted `fetch-roadmap` pipeline. **Complementary to C1, not overlapping**: it checks relative *file* links repo-wide and deliberately skips `.html`, which C1's check H owns. All five failure modes planted and watched to fail. |
| C2 — Tool ids as `ActivityDefinition.identifier` | Fable 5.1 (done by Opus 5, in one Phase-C session) | done — all 43 catalogued ADs carry their tool id in `http://thespierproject.org/fhir/identifier/tool-id`. ⚠️ **The system URL in this task's text was stale**: it proposed `http://spier.org/identifier/tool-id`, which predates the #425 canonical and would have introduced a second base. Ids were read from the existing map, not invented — the result (43 ADs, 40 tool ids, one multi-AD tool) reproduces it exactly. The NamingSystem question is answered YES, with the reasoning in `ig/input/fsh/tool-id-identifier.fsh`: without it the system URL appears only inside instances, which is the same "names something unresolvable" problem one level up, and it is where the id space's scope belongs (SPiER-local, non-clinical, not stable across a stage-tile renumbering). `tools.ts` derives via `toolIdFromAD`; the hand map is deleted with no fallback. `check:catalog` grows check F, which **reads the identifier SYSTEM off the NamingSystem rather than retyping it** — a stale copy in the gate *and* in `tools.ts` would agree with each other and pass while the app decatalogued all 43 tools. Its load-bearing rule is the `MULTI_AD_TOOLS` allowlist: a legitimate multi-AD tool (the CAMS SSF-5) and a pasted-in duplicate id are indistinguishable, and the catalog merges the group either way, so the second tool does not go missing loudly — it goes missing inside the first one. Check B's two hand-map directions are dropped, being structural now. Nine planted defects each watched to fail, including one full FSH round-trip through SUSHI and copy-fhir. Verified: `verify` green in `web/` (858), `services/cds-hooks` (35) and `services/mock-ehr` (160); SUSHI 0 errors / 6 expected warnings; `validate-fhir.mjs` 453 resources / 0 errors; `build-use-case-workbook.mjs --check` still resolves its TL ids. |
| C3 — Lift FSH comment rationale into rendered IG content | Fable 5.1 (done by Opus 5) | done — all six files under 30% comment (from 41–61%). ⚠️ **This task's premise was half out of date, and it changed the work.** Phase A had already published most of what C3 set out to lift: `conformance.md` carries the entire scoping decision (screen never becomes a `Condition`, CAMS driver stays narrative, `86849004` is the wrong SCTID, ConceptMap-vs-StructureMap, CAMS never maps to `imminent`, both lossy egress steps), `how-to-read.md#tier-derivation` carries computed-vs-assigned with a better table than the comment had, and `quick-starts.md` carries the domain-category searches including Appointment. So the dominant edit was **delete the restatement and point at the page**, not move rationale out. New `design-decisions.md` (in `pages:` + `menu:` + how-to-read's prose) holds what was genuinely unpublished: the LOINC 2.82 search behind the SPiER-local section codes and the three near-misses rejected; why the safety-plan and CAMS section systems stay separate; that `87626-8` is for discoverability and NOT a claim the CarePlan is a document; why the domain slice is `1..1` (an optional tag is not a queryable guarantee — a consumer cannot tell an untagged resource from an absent one); the `interpretation` POS/NEG-vs-A/H/L split, recorded as the open inconsistency it is rather than as a decision; the per-group reasoning behind the nine problem-list concepts; why depression is verified but not bound; that no licensing status has been checked against current terms and four instruments have no memo; and what a code-less placeholder AD is. **Two published Descriptions were pointing readers at "the file header"** — a file they do not have; both now point at the page. Artifact-specific rationale went onto the artifact (`^purpose` on the egress ConceptMap, the Condition profile's Description). History deleted: 22 "promoted out of this placeholder file" tombstones and 6 stage banners left empty; the placeholder header's claim that tool ids live in a `tools.ts` hand map was false as of C2 and is now true. Warnings kept, one sentence each: the seven fabricated LOINC codes (#220) and the SUSHI category-overwrite trap. **Verified no artifact structure changed rather than assuming it** — compiled before and after and diffed leaf by leaf: 8 differences, all prose, plus the new page's own registration in the ImplementationGuide. `validate-fhir.mjs` 453 / 0 errors; SUSHI 0 / 6; all three doc gates pass; `web/ verify` green. |
| C4 — `Overview.tsx` prose becomes a content module | Opus 5 | done — `web/src/content/overview.ts`, a typed module rather than Markdown via `?raw`, with the reason in its header: `tsc` and eslint stay pointed at the content, so a missing heading, a misspelled `kind` or a lens card without an `href` is a build failure. Five inline-markup rules and no more, rendered by `content/renderInline.tsx` — which is its own file because eslint's `react-refresh/only-export-components` correctly refuses a non-component export from a component file; `IG_HREF` and the `ig` href token moved with it. The three data-driven placements are `kind`s with no text of their own, and the stages still come from the pathway-stage CodeSystem via the catalog. ⚠️ **Verified byte-identical, not eyeballed**: the rendered `.overview` DOM hashed the same (11,834 chars, SHA-256 `930e9f2f…`) before the change, after it, and after the renderer moved files — same text, elements and attribute order. The parser it introduces has 15 tests of its own, server-rendered to a string so the suite stays in the default `node` environment; reversing the `**`/`*` alternation order fails five of them. ⚠️ One thing they do NOT catch, and the test says so: deleting `INLINE.lastIndex = 0` fails nothing, because the loop runs to exhaustion and resets it anyway — the test's claim was narrowed from "is reentrant" to "gives the same result on repeated calls" once that was checked. The stretch goal (deriving the one-pager's pillar text from this module) is deliberately NOT done: that file has a Chrome-driven PDF export, a recorded-hash gate and a screen/print stylesheet split, so it is not the "only if cheap" the task conditioned it on — filed instead. `verify` green (78 files, 873 tests), `check:template` and `check:guide-boundary` undisturbed. |
| C5 — File the Questionnaire-in-the-IG follow-up | Sonnet 5 (done by Opus 5) | done — filed as [#473](https://github.com/SPiER-Project/adoption-guide/issues/473), `area:ig` + `type:task`. The premise was confirmed first rather than assumed: `gh issue list --search` over `QuestionnaireRenderer`, `ignoreWarnings`, `NPE` and `suppressed` found nothing, and the two hits for "Questionnaire rendering" (#338, #350) are about other things — so the suppression's "tracked as a follow-up" comment had pointed at nothing for the whole life of the file. The issue carries what is suppressed (both regex patterns), that the suppression is the ONLY reason a missing Questionnaire is not a QA error, both candidate fixes — `path-resource` first, FSH `Instance:` only if the NPE survives, since it would create a second definition of each Questionnaire and break "one canonical URL, one definition" — and the repro recipe, including the space-free path the publisher requires and that `temp/qa/*-validation.html` is written BEFORE Jekyll. It also records that the NPE has **not** been re-tested against the pinned publisher version, which is the first step and the same trap #201 fell into with the CQL loader. `ignoreWarnings.txt` now names the issue and says what deleting the patterns depends on. |

## How the models were assigned

- **Sonnet 5** — edits whose correctness a script or a grep can confirm: a
  stale sentence replaced by a true one the task states, a link retargeted, a
  file merged. The task text supplies the facts; the model applies them.
- **Opus 5** — edits where the model must *read FSH or TypeScript to decide
  what the true content is* (which codes go in a quick start, which README
  sentences the FSH already states, how a gate should be shaped).
- **Fable 5.1** — changes that alter a cross-tree contract: a new element every
  ActivityDefinition must carry, a gate that reads it, an app and a Worker that
  consume it, and editorial judgment about what is normative. These are the
  tasks where a plausible-looking wrong answer passes every existing gate.

Every task, regardless of model, ends with the verification the repo already
requires: `npm run verify` in `web/` for anything touching `web/`;
`npx fsh-sushi .` plus `node scripts/check-sushi-output.mjs` for anything
touching `ig/`; each Worker's own `npm run verify` (`services/cds-hooks`,
`services/mock-ehr`) when anything under `packages/` changes. A new gate must be **planted-and-verified** — shown to fail on a
deliberate defect — before it is reported green
(`feedback_prove_a_gate_can_fail`).

## The content contract

This is the target every task moves toward. Where a kind of prose has one home,
every other place either links to it or is generated from it.

| Kind of prose | Home | Everything else |
|---|---|---|
| Element definitions, bindings, why a profile is shaped this way | FSH `Description` / `^purpose` (renders in the IG) | FSH `//` comments hold **repo mechanics only** |
| How to read, query, conform | `ig/input/pagecontent/` | the app links to it and never restates it |
| Build, gates, tooling, history | `CLAUDE.md`; a folder README links to it | never in an IG page |
| Mission and pitch | `README.md` | IG `index.md`: two sentences and a link; app Overview loads a content module |
| Stage names, tool ids | the pathway-stage CodeSystem and the ActivityDefinitions | docs quote by code or link to the IG artifact page |
| Adoption guidance, readiness, rubric | the app, as data modules | not JSX paragraphs |
| Plans and status | GitHub issues, plus a plan doc's own status table | finished plans move to `docs/plans/archive/` (#443's folder and banner) |
| Licensing evidence | `FHIR-Resources/<tool>/licensing/MEMO.md` | the FSH extension states the *status*; the MEMO is the evidence — **keep both** |

## Standing rules for every task

- **Never hand-edit generated output**: `packages/fhir-artifacts/generated/`,
  `ig/fsh-generated/`, `docs/use-cases/dist/`, `web/.runtime-fhir/`.
- **`packages/` is real, not a stray.** `packages/core` (the React-free
  domain layer, #389), `packages/demo-population` (#388) and
  `packages/fhir-artifacts/generated/` (SUSHI output, gitignored, #392) are
  `main`'s layout. The first version of this plan called the generated folder
  an untracked stray because the review worktree was 65 commits behind.
- **Do not delete licensing MEMOs**, historical-record docs that say they are
  historical, or the `walkthrough`/`proposed` markers in the use-case workbook.
- **Historical documents keep their historical wording.** `docs/repo-audit.md`
  says "Flag Risk" because that was the name in May 2026; do not modernize it.
- **A claim you did not verify does not go in a file.** Every "X is built" or
  "Y is the canonical" sentence a task writes must be checked against the
  tree in that session, not copied from this plan.
- Branch per task, PR per task (`feedback_branch_per_pr`). End each task by
  updating the Status table above.

---

## Phase A — make the IG pages true (no design decisions)

### A0 — Rebase Phase A onto `main`

**Model: Opus 5**, one session. A1, A2 and A4 must be re-derived against a
tree that changed under them, not conflict-resolved.

**What happened.** PR #468 carried Phase A, but its branch was created from the
root checkout's local `main`, which sat at `4404d59` (#384, 2026-08-20) while
`origin/main` advanced 65 commits to `80cf932` (#467). Worse, the first commit
on that branch, `fc9d334 "updating sidebar UI"`, was committed in the root on
2026-09-02 from a working tree whose files were older than its own HEAD. It
contains no sidebar work at all; it reverts parts of #383 and #384 (the
handoff shrink, the EhrAdoptionRubric change, deletes the ZSI questions doc,
and carries older `CLAUDE.md` and `check-catalog-integrity.mjs`). That is the
"huge git status in the ROOT checkout" gotcha from CLAUDE.md, arriving as a
commit. **#468 must not merge as it stands.**

Of the five Phase A commits, `93338d3` (A3) and `1a821ae` (A5) cherry-pick
cleanly onto `origin/main` (tested 2026-09-03). The other three conflict for
real reasons:

| Commit | Conflicts with | Why redo rather than resolve |
|---|---|---|
| `2a1aeee` (A1) | #410 (menu prose is now gated), #416 (tier-derivation section), #454 (Care Pathway page), #383 (removed the section A1 edited) | two of A1's six items are already satisfied on `main`; one now points at a deleted route |
| `db35e60` (A2) | #425 | the canonical moved from `http://spier.org` to `http://thespierproject.org/fhir`; all 47 URLs A2 wrote are wrong for `main` |
| `82f883f` (A4) | #425 | one-line canonical change in `ig/README.md`; trivial, but re-verify every command against `main`'s `CLAUDE.md` |

**Steps.**

1. Fix the root checkout first. It is on `main` at `fc9d334`. From the root:
   `git fetch origin && git status` (confirm nothing uncommitted is wanted),
   then `git reset --hard origin/main`. `fc9d334` stays reachable from the
   #468 branches if anyone needs to inspect it.
2. `git switch -c claude/docs-consolidation-phase-a-rebased origin/main`
3. `git cherry-pick -x 93338d3 1a821ae` — A3 and A5. Re-run the A3 and A5
   done-when greps on the result.
4. Redo A1 against `main`, with these changes to the task: items 2 and 5 are
   already done (#410, #383); item 6 must retarget `#/guide/roadmap` in
   `index.md`, `getting-started.md` and `zero-suicide-mapping.md` to the
   GitHub Issues / milestones URL the root README uses, because #440 removed
   the Roadmap section; and `node scripts/check-ig-menu.mjs` must pass.
5. Redo A2 against `main`: same task text; canonical
   `http://thespierproject.org/fhir`; every code read from `main`'s FSH and
   Questionnaire JSON.
6. Redo A4 against `main`: same task text; the canonical line changed in #425.
7. Add this plan doc and its `docs/MANIFEST.md` index line to the branch. They
   exist only in the review worktree
   (`.claude/worktrees/structure-simplification-scope-556507/`) today, which is
   why no Phase A session could update the Status table.
8. Open a new PR; close #468 with a comment pointing at it.

Done when: the new PR's file list holds only Phase A files plus the plan doc
and MANIFEST line; `ig.yml` is green; `git diff origin/main...HEAD --stat`
shows no `web/`, `packages/` or handoff changes.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task A0. Create the
> rebased branch from `origin/main`, cherry-pick A3 and A5, redo A1/A2/A4
> against `main` as the task specifies, add the plan doc, and open a new PR
> superseding #468. Do not merge or conflict-resolve `fc9d334`. Update the
> Status table.

### A1 — IG pages: fix the false claims and the app links

**Model: Sonnet 5.** Every correction is stated here; the task is to apply them
and confirm each against the tree.

⚠️ Re-checked against `main` at `80cf932`: items 1, 3 and 4 still stand.
Item 2 is done (#410 gated the menu prose, which now lists all five Guidance
pages). Item 5 is moot (#383 removed the "Build status" section). Item 6's
target changed: `#/guide/roadmap` no longer exists (#440), so three pages on
`main` link a dead route today.

Files: `ig/input/pagecontent/how-to-read.md`, `index.md`,
`zero-suicide-mapping.md`, `conformance.md`, `getting-started.md`.

Findings to fix:

1. `how-to-read.md:22` says Must-Support is "not yet flagged on SPiER
   profiles" and line 10 calls Conformance "in progress". Must-Support is
   flagged (`grep -c ' MS' ig/input/fsh/*.fsh` finds ~100 across ten files) and
   four role CapabilityStatements exist in `capabilitystatements.fsh`.
   `conformance.md` already says so; make how-to-read and `index.md:42` agree
   with it.
2. `how-to-read.md` "The menu" lists Guidance as "this page, plus the Zero
   Suicide mapping". Guidance has four pages (`sushi-config.yaml` `menu:`).
   Describe all four.
3. `how-to-read.md` clinical primer names four instruments. Add one-line
   entries for BSSA, PSS-3, PSS-Full, SAFE-T, CAMS, CRP and Stanley-Brown,
   each derived from that tool's `ActivityDefinition.description` in
   `ig/input/fsh/` — not from memory.
4. `how-to-read.md` says "Instruments with a coded disposition (ASQ, C-SSRS)
   map via ConceptMaps; score-based (PHQ-9, SBQ-R) via StructureMaps".
   `conformance.md`'s harmonization table is the current list (adds PSS-3,
   BSSA, CAMS). Point at that table instead of restating a subset.
5. `zero-suicide-mapping.md:57` says stages 5–8 are "catalogued placeholder
   tools pending full FHIR modelling". `pathway-tool-placeholders.fsh` holds
   three placeholder Instances (`TriggerSuicideRiskWorkflow`,
   `AdministerCARSS`, `AdministerLocalRiskAssessment`); every other stage 5–8
   action resolves to a built ActivityDefinition. Rewrite the paragraph to say
   what is actually placeholder, by name.
6. Every link into the app uses `#/implementation-guide/...`, which resolves
   only through `LegacyGuideRedirect` in `web/src/App.tsx`, and hardcodes
   `spier-project.github.io`. Retarget to `#/guide/<section>` (sections are
   listed in `web/src/data/guideSections.ts`) and to `#/population`. Keep the
   host as it is unless the team has settled a canonical public host — note in
   the PR that both `github.io` and `workers.dev` are live.

Done when: each of the six items is fixed, `npx fsh-sushi .` is clean, and a
`grep -rn 'implementation-guide' ig/input/pagecontent` returns nothing.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task A1. Apply the
> six corrections to the IG pages, verifying each claim against the FSH before
> writing it. Do not touch `measurement.md` or `quick-starts.md` (A2/A3).
> Run `npx fsh-sushi .` in `ig/`. Update the plan's Status table.

### A2 — Quick Starts: cover every published instrument

**Model: Opus 5.** The right codes, canonicals and profile ids must be read out
of the FSH and the Questionnaire JSON; a wrong code here is exactly the #220
failure.

Files: `ig/input/pagecontent/quick-starts.md`.

Today the per-instrument section covers ASQ, C-SSRS (Screener + Full), PHQ-9
and SBQ-R. The IG publishes twenty `Administer*` ActivityDefinitions. Add a
block for each instrument that has a derived Observation profile: BSSA, PSS-3,
PSS-Full, SAFE-T, CAMS (Section A, Section B, the disposition), CRP,
Stanley-Brown (CarePlan, not Observation), and the two C-SSRS variants
(Since-Last-Contact, Pediatric) as sub-bullets of the existing C-SSRS block
since they share their code and `SPiERCSSRSRiskLevel`. (**Correction, made during A2:** this line said `93373-9`. All four C-SSRS
forms derive `SPiERCSSRSRiskLevel`, whose `code` is fixed to LOINC `93374-7` —
`cssrs.fsh:122`. `93373-9` appears nowhere in the tree. Later tasks should not
propagate it.)

For each block: the `Questionnaire.url` + `version` from `FHIR-Resources/`, the
derived profile's id and its `code` from the FSH, and the two `GET` lines in
the existing style. Where a tool lands directly on the concept layer with no
crosswalk (SAFE-T, PSS-Full), say so in one line.

The canonical is `http://thespierproject.org/fhir` since #425 — read it from
`ig/sushi-config.yaml`, never from an older page.

Done when: every `Administer*` ActivityDefinition whose tool has a
`FHIR-Resources/` Questionnaire appears in the page; every `code=` value
appears verbatim in the corresponding profile's FSH; `npx fsh-sushi .` is clean.
Run `node scripts/validate-fhir.mjs` if Java is available, since the page's
canonicals should match what the validator resolves.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task A2. Extend the
> IG Quick Starts page so every published instrument has a block, taking every
> code, canonical and profile id from the FSH and Questionnaire JSON rather than
> from memory. Keep the existing blocks' style. Update the Status table.

### A3 — IG pages: remove repo internals and unresolvable tool ids

**Model: Sonnet 5.** The offending passages are identified below; the
replacement content is stated.

Files: `ig/input/pagecontent/measurement.md`, `relationship-to-other-igs.md`.

1. `measurement.md` "What is and isn't verified" (from ~line 186) recounts the
   `path-binary` discovery (#201/#212), names `sushi-config.yaml`,
   `web/src/lib/measures.ts`, `vitest` and `npm run check:measures`. That
   history already lives in `CLAUDE.md` and
   `docs/plans/stage-8-measure-and-share.md`. Reduce the section to what an
   implementer needs: the CQL is compiled to ELM on every build and a
   translation error fails it; translation proves the logic is well-formed, not
   that it computes the right answer; a reference implementation exists in the
   companion app and CQL-versus-reference equivalence is asserted, not yet
   tested. No file paths, no npm scripts, no issue numbers.
2. `measurement.md` uses nine `TL-0NN` ids (`TL-009`, `-017`, `-030`, `-032`,
   `-034`, `-037`, `-043`, `-044`, `-045`). The IG defines none of them. Until
   C2 gives them a home, replace each with the artifact it means, linked:
   e.g. "TL-009 or TL-030" → "a [SPiERSafetyHandoff](StructureDefinition-…) or
   [SPiERDischargeSafetyPacket](…)"; "TL-043 Reporting Dashboard" → "the
   reporting dashboard". Find the artifact by reading which ActivityDefinition
   `tools.ts` maps that id to.
3. `relationship-to-other-igs.md:46` ends by citing
   `docs/research/2026-08-us-behavioral-health-profiles-ig.md` by repo path.
   Replace with a GitHub `blob/main/...` URL, since the published IG has no
   `docs/`.

Done when: `grep -nE 'web/src|npm run|scripts/|\.mjs|vitest|#[0-9]{2,3}\b|sushi-config|path-binary|TL-0[0-9]{2}' ig/input/pagecontent/*.md`
returns nothing except the `getting-started.md` "clone the repo" line, and
`npx fsh-sushi .` is clean. (C1 turns this grep into a gate.)

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task A3. Remove repo
> internals and `TL-` ids from the two IG pages as specified, replacing each
> tool id with a link to the artifact it denotes (resolve the id through
> `packages/core/src/data/catalog/tools.ts`). Run the done-when grep. Update the Status
> table.

### A4 — `ig/README.md` and `ig/drafts/README.md` rewrite

**Model: Sonnet 5.**

`ig/README.md` is the stalest file in the tree. Specifically: it says
`cd ig && sushi .` (CLAUDE.md: the package is `fsh-sushi`, so use
`npx fsh-sushi .`); it references `./_genonce.sh` and `_genonce.bat`, which do
not exist; it says Java 11+ where the validator needs 17+; its Validation
section shows a raw `validator_cli.jar` command instead of
`node scripts/validate-fhir.mjs`; its Status section says the first artifact set
"targets the ASQ" and later tools "follow once ASQ ships". Since #425 the
canonical it quotes is `http://thespierproject.org/fhir`.

Rewrite it to: the layout tree (already correct), the two "one config line
away from not being built" warnings (already correct), a **Verification**
section that lists the gates by name and links to `CLAUDE.md` for each one's
rationale rather than restating it, the Authoring rules (keep; they are still
right), and a Status line that says draft/continuous build and points at the
Adoption Readiness page for per-tool state. Target: under 80 lines.

`ig/drafts/README.md` is twenty lines describing an empty folder. Reduce to
five: the folder is a deliberate working slot outside the build, `check-fml.mjs`
still compiles any `.fml` parked here, and a file here is a file nothing
publishes — with a link to the promoted-items history in git rather than a
table.

Done when: every command in `ig/README.md` runs as written from `ig/` in a
fresh worktree, and no path it names is missing.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task A4. Rewrite
> `ig/README.md` and `ig/drafts/README.md` as specified. Verify every command
> and path you write by running or `ls`-ing it. Update the Status table.

### A5 — Retired stage names in root README, PROJECT_OVERVIEW, FHIR-Resources README

**Model: Sonnet 5.**

The canonical stage list is the `spier-pathway-stage` CodeSystem in
`ig/input/fsh/spier-codesystem.fsh`. Three prose files still use names retired
in the July 2026 rename: `README.md:30–36`, `docs/PROJECT_OVERVIEW.md:43–67`
and `FHIR-Resources/README.md:11–18` say "Flag Risk", "Set Risk Status" and
"Manage Active Risk" (the FHIR-Resources table mixes old and new in adjacent
rows). Replace each with the CodeSystem `display`, and where a stage number is
given check it against the CodeSystem's order.

Do **not** modernize `docs/repo-audit.md` or `docs/plans/ssc-stage-tiles-rollout.md`
— both are records of the rename and correctly use the old names.

Done when: `grep -rnE 'Flag Risk|Set Risk Status|Manage Active Risk' --include='*.md' . | grep -vE 'node_modules|repo-audit|ssc-stage-tiles-rollout|licensing/MEMO'`
returns nothing (MEMOs are dated evidence; leave them), and `README.md`'s list
order matches the CodeSystem.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task A5. Replace
> retired stage names in the three named files with the displays from
> `ig/input/fsh/spier-codesystem.fsh`. Leave historical documents alone. Run
> the done-when grep. Update the Status table.

---

## Phase B — consolidate `docs/` (depends on A0)

### B1 — One `docs/` index; finish the archive #443 started

**Model: Sonnet 5.**

⚠️ Half of this task landed on `main` while Phase A was in flight. #443
(`docs/plans/structure-simplification-scope.md`, Phase 1) created
`docs/plans/archive/` and moved eight finished plans into it, each with a
`> Archived <date>: work complete (PR #NNN).` banner. Reuse that folder and
that banner; do not create `docs/archive/`.

Still open on `main` at `80cf932`:

1. **Two indexes.** `docs/README.md` still links `../CAMS/README.md` and
   `../Stanley Brown Safety Plan/README.md`, both gone. `docs/MANIFEST.md`
   names six paths that do not exist (`Evaluation/…`,
   `web/src/data/pilot-plans/asq.md`, `web/src/data/fhir/`,
   `web/src/data/roadmap.generated.json`, `ig/fsh-generated/resources/` as a
   browsable path, and a literal `<tool>` placeholder). Merge into **one**
   `docs/README.md`, keeping MANIFEST's richer descriptions where still true;
   delete `MANIFEST.md` and retarget its inbound links (`grep -rl MANIFEST.md`).
2. Every path the merged index names must exist — `ls` each. Drop entries
   whose target is gone; do not invent replacements.
3. `docs/repo-audit.md` declares itself a historical record and still sits at
   the `docs/` root. Move it to `docs/plans/archive/` with the banner and
   retarget its three inbound links.
4. The index gets a short "How this folder is organized" preamble stating the
   content contract from this plan, so the next author knows where a new doc
   goes.

Do not touch `docs/use-cases/` or `docs/outreach/` internals — both are gated
by CI and have their own READMEs. Do not re-judge the plans #443 left in
place; that call was made with its own criteria.

Done when: `docs/README.md` is the only index, every link in it resolves (a
five-line node script or a `for` loop over `grep -o '](…)'`), and
`node scripts/build-use-case-workbook.mjs --check` and
`node scripts/build-onepager.mjs --check` still pass.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task B1. Merge the
> two docs indexes into one accurate `docs/README.md`, archive `repo-audit.md`
> into the existing `docs/plans/archive/` with #443's banner, retarget inbound
> links, and verify every link resolves. Update the Status table.

### B2 — One home for the pitch: merge PROJECT_OVERVIEW into README

**Model: Opus 5.** This is editorial: deciding which sentences survive.

The Capture → Translate → Act narrative exists in `README.md`,
`docs/PROJECT_OVERVIEW.md`, `docs/one-pager.md`, the IG's `index.md` and
`how-to-read.md`, `web/src/pages/Overview.tsx`, and
`web/public/SPiER-Overview-Care-Pathway.html`. README and PROJECT_OVERVIEW are
near-verbatim copies; PROJECT_OVERVIEW carries a few paragraphs README lacks
("Toward a repeatable workstream", the HL7-contribution path).

1. `README.md` becomes the single prose home. Fold in PROJECT_OVERVIEW's
   unique paragraphs, then delete PROJECT_OVERVIEW and retarget its two
   inbound links.
2. IG `index.md` keeps its status table, two sentences of mission, and the
   three-bullet Capture/Translate/Act summary (an IG reader needs the vocabulary
   defined) — but cut anything that is pitch rather than scope, and link to the
   README for the story.
3. `docs/one-pager.md`: determine whether it is the *source* of the outreach
   HTML or a stale draft of it (`docs/outreach/README.md` says how the one-pager
   is built). If the HTML is authoritative, the `.md` either becomes a pointer
   or moves to `docs/plans/archive/`.
4. Do not edit `Overview.tsx` here (C4) or the outreach HTML (it has its own
   build and check).

Done when: the mission text appears in full in exactly one Markdown file,
every other Markdown copy is a link or a two-sentence summary, and the outreach
`--check` still passes.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task B2. Make
> `README.md` the single home for the project narrative, reduce the IG index
> and `docs/one-pager.md` to summaries or pointers as specified, and retarget
> inbound links. Do not touch the app or the outreach HTML. Update the Status
> table.

### B3 — Per-tool READMEs: provenance and folder contents only

**Model: Opus 5.** Each deletion requires confirming the FSH states the same
fact; a README table row with no FSH counterpart must stay.

The ten `FHIR-Resources/<tool>/README.md` files carry scoring tables, LOINC
codes, stage assignments and risk-stratification rules. The ActivityDefinitions
and profiles in `ig/input/fsh/<tool>.fsh` are canonical for stage, codes,
licensing and derived-Observation shape — and the app derives from them, so the
READMEs are the one copy nothing checks.

For each README: keep (a) what is in the folder and why, (b) provenance of the
instrument (authors, source form, the `references/` contents), (c) anything the
FSH does **not** state — a scoring table with no FSH counterpart stays, with a
note that it is informational. Remove restated stage membership (link to the
IG's PlanDefinition page), restated LOINC item tables (link to the Questionnaire
JSON and the IG profile), and restated licensing status (the MEMO and the FSH
extension hold it). Where a README makes a *clinical* claim (a cutoff, a
stratification rule), check it against the Questionnaire JSON's
`answerOption`/`calculatedExpression` before keeping it.

`Stanley-Brown/docs/data-mapping.md` describes the `Hybrid_CarePlan` mapping
that `StanleyBrownQRToCarePlan.fml` now declares; reduce it to a pointer at the
StructureMap and the parity golden file, keeping the "why embed text rather than
reference the QR" rationale, which the FML's description block should also carry
(check; add if absent).

Done when: `node scripts/validate-fhir.mjs` still passes (it reads
`FHIR-Resources/`), and `FHIR-Resources/README.md`'s table matches
`pathway-stages.fsh` for every tool's stage(s).

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task B3. Trim each
> per-tool README to provenance and folder contents, removing only what the FSH
> or Questionnaire JSON already states — confirm each removal against the
> artifact first. Update the Status table.

---

## Phase C — structural changes (depend on A0)

### C1 — Extend `check-ig-menu.mjs` into an IG narrative gate

**Model: Opus 5.** Designing what the gate asserts, and proving it can fail,
is the work; the assertions themselves are small.

⚠️ `main` already has the gate this task was going to create. #410 added
`scripts/check-ig-menu.mjs` (checks A–D: how-to-read's menu prose ↔
`sushi-config.yaml` `menu:` ↔ `pages:`, both directions, fail-when-nothing-
read), wired into `ig.yml`. **Extend it — or add a sibling that reuses its
parsers — rather than writing a second reader of the same files.** Its header
comment is the model for how a gate here explains itself.

Add, as checks E–H over `ig/input/pagecontent/*.md`:

- **E. No repo internals**: fail on `web/src`, `packages/`, `npm run`,
  `scripts/`, `.mjs`, `vitest`, `sushi-config`, `path-binary`, and `#NNN`
  issue references. No opt-out marker until a real need appears.
- **F. No undefined tool ids**: fail on `TL-0NN` until C2 lands; after C2,
  fail on a `TL-` id that no ActivityDefinition `identifier` in
  `ig/fsh-generated/resources/` carries (so F needs `fsh-generated` present,
  like `check-sushi-output.mjs`).
- **G. App links resolve**: every `#/<route>` must match a **non-legacy**
  route in `web/src/App.tsx` — parse `path="…"` under the `<Shell>` block and
  exclude anything rendered by `Legacy*Redirect` or `<Navigate>` — and
  `#/guide/<x>` must match `GUIDE_SECTIONS` in `web/src/data/guideSections.ts`.
  G would fail on `main` today: three pages link `#/guide/roadmap`, a section
  #440 removed. A0 fixes the links; G keeps them fixed.
- **H. Internal IG links resolve**: every `](<name>.html)` is a `pages:`
  entry, a `<ResourceType>-<id>.json` in `fsh-generated/resources/`, or one of
  the publisher-generated pages already allowlisted by check C.

  ⚠️ **H stays the owner of `.html` links.** `scripts/check-md-links.mjs`
  (C1a, landed) checks relative *file* links across every tracked `.md` and
  skips `.html` precisely so this check keeps that half — the IG Publisher
  resolves those at render time from `input/pagecontent/`, which a
  file-existence test cannot model. Do not extend C1a to cover them.

Because G reads `web/src`, add `web/src/App.tsx` and
`web/src/data/guideSections.ts` to `ig.yml`'s path triggers — a route rename
breaks the IG's links without any `ig/` change. Keep it dependency-free (Node
builtins) so it still runs in milliseconds before SUSHI.

Properties, per the repo's gate discipline: fail when nothing was read (zero
pages, zero routes, or an empty `fsh-generated/` is an error — #232/#261);
assert shapes, never counts; plant one defect per check and watch it fail
before reporting green. Update the CLAUDE.md block that describes
`check-ig-menu.mjs` (#410 added one) rather than adding a second.

Done when: the gate passes on `main` after A0, fails on each of four planted
defects (captured in the PR body), and `ig.yml` runs it on both path sets.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task C1. Extend
> `scripts/check-ig-menu.mjs` with checks E–H (or a sibling sharing its
> parsers), keep fail-when-nothing-read, plant one defect per check and record
> each failure in the PR body, add the `web/src` path triggers to `ig.yml`, and
> update its CLAUDE.md block. Update the Status table.

### C2 — Tool ids as `ActivityDefinition.identifier`

**Model: Fable 5.1.** This changes a contract that `tools.ts`, `check:catalog`,
the CDS Hooks Worker, the use-case workbook check (`tool-ui-metadata.ts` TL
ids) and the IG narrative all depend on. A subtly wrong shape passes every
current gate.

Today `TL-0NN` ids exist in `packages/core/src/data/catalog/tools.ts` as a hand-written
map from ActivityDefinition name to id, and in ~80 FSH comment lines. The IG
publishes none of them, so the IG narrative cannot name a tool and the app's
mapping is unchecked against the FSH.

1. Add `* identifier[+].system = "http://spier.org/identifier/tool-id"` and
   `* identifier[=].value = "TL-0NN"` to every `Administer*`/workflow
   ActivityDefinition the catalog maps (read the map in `tools.ts` for the
   pairs; do not invent ids). One id per AD; a multi-AD tool (CAMS, C-SSRS
   family) carries the same id on each of its ADs, which is the existing
   catalog semantics.
2. `tools.ts` derives the id from the identifier; the hand map is deleted, not
   kept as a fallback (a fallback hides the very drift this closes).
3. `check:catalog` asserts: every AD the catalog wires has exactly one tool-id
   identifier; the set of ids is unique per tool; every id in
   `tool-ui-metadata.ts` has an AD behind it (this direction may already exist —
   check before adding).
4. Both Workers import `@spier/core` — run `services/cds-hooks`'s and
   `services/mock-ehr`'s own `npm run verify`.
5. `node scripts/build-use-case-workbook.mjs --check` reads TL ids from
   `tool-ui-metadata.ts`; confirm it still resolves them.
6. Now the IG can name tools: revisit the A3 replacements in `measurement.md`
   and decide whether to restore `TL-` ids as links to the ActivityDefinition
   pages, and update C1's rule 2 to resolve ids from the generated identifiers.

Consider, and record the decision either way in the FSH file header: whether
the id system should be a `NamingSystem` in the IG so the identifier's system
is itself published.

Done when: `npm run verify` passes in `web/`, `services/cds-hooks/` and
`services/mock-ehr/`,
`npx fsh-sushi .` and `check-sushi-output.mjs` are clean, `validate-fhir.mjs`
passes, and deleting one identifier from the FSH fails `check:catalog`.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task C2. Give every
> catalogued ActivityDefinition a `tool-id` identifier read from the existing
> map in `tools.ts`, derive the app's ids from it, delete the hand map, extend
> `check:catalog`, and verify both packages plus the workbook check. Prove the
> gate fails on a removed identifier. Update the Status table.

### C3 — Lift FSH comment rationale into rendered IG content

**Model: Fable 5.1.** Deciding what is normative rationale (belongs in
`^purpose` or a page), what is repo mechanics (stays a comment), and what is
history (belongs in git) is judgment about the spec, and a wrong call publishes
something misleading or deletes something load-bearing.

Six FSH files are more than 40% comment: `concept-layer.fsh` (51%),
`suicide-related-conditions.fsh` (60%), `safety-plan-section.fsh` (60%),
`instrument-licensing.fsh` (49%), `pathway-tool-placeholders.fsh` (48%),
`crosswalk-tier-to-loinc.fsh` (41%). Start with those; `measure-and-share.fsh`,
`risk-episode.fsh` and `cams.fsh` carry the most comment lines in absolute
terms and are the second pass.

For each comment block, sort into one of three bins:

- **Implementer-relevant rationale** (why POS/NEG not A/N; why the concept
  rides on generic `93374-7`; why a screen never becomes a `Condition`; why
  `86849004` is the wrong SCTID; why some crosswalks are ConceptMaps and others
  StructureMaps; why CAMS never maps to `imminent`). Move to the artifact's
  `^purpose` if it is about that artifact, or to a new **Design decisions**
  page (`ig/input/pagecontent/design-decisions.md`, under Guidance) if it spans
  artifacts. Some of this is already in `conformance.md` — link rather than
  duplicate, and consider whether "Suicide-related problems" belongs on the new
  page instead.
- **Repo mechanics** (which gate reads this, why a slice is named this way to
  avoid the #271 overwrite, "grep the repo when you change this code"). Stays
  a comment. Trim to what a maintainer needs.
- **History** ("#77 decided", "this used to say", dated corrections). Delete
  from the FSH; git and the PR carry it. Where the history is a *warning*
  (the #201 CQL silence), one sentence plus the issue number stays.

Do not change any artifact's structure, codes or bindings. This task moves
words. Every `^purpose` written must be true of the artifact as it is today —
read the artifact, not the comment, before writing.

Done when: the six files are under 30% comment, the new page is in
`sushi-config.yaml` `pages:` **and** `menu:` **and** has its bullet in
how-to-read's menu section (`scripts/check-ig-menu.mjs` check D fails
otherwise), `npx fsh-sushi .` and
`check-sushi-output.mjs` are clean, `validate-fhir.mjs` passes, and C1's gate
passes on the new page.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task C3. Sort the
> comment blocks in the six named FSH files into rationale / mechanics /
> history; move rationale into `^purpose` or a new Design decisions page,
> trim mechanics, delete history. Change no artifact structure. Verify with
> SUSHI, the SUSHI-output gate, the validator and the narrative gate. Update
> the Status table.

### C4 — `Overview.tsx` prose becomes a content module

**Model: Opus 5.** Choosing the module shape is the decision; the extraction
is mechanical once chosen.

`web/src/pages/Overview.tsx` holds roughly 35 paragraphs of narrative as JSX.
`web/src/data/guideSections.ts` is the repo's model for doing this right: one
ordered data file, everything derives from it. Do the same for narrative.

1. Create `web/src/content/overview.ts` (a typed array of sections: heading,
   paragraphs as strings with a minimal inline-markup convention, optional
   in-app link) — **or** Markdown imported via Vite `?raw` and rendered by a
   small renderer. Pick one and say why in the file header; a TS module keeps
   `tsc` and eslint on the content, which is the stronger argument here.
2. `Overview.tsx` renders the module. The three "pillar" cards
   (`lead`/`body`) already are data — fold them into the same module.
3. `npm run check:template` reads source text for page-template rules, and
   `npm run check:guide-boundary` walks the guide pages' imports; confirm
   the extraction does not move a `PageHeader` or padding rule out of its view
   (the check states this limit on its rule).
4. Stretch, only if cheap: emit the module's Capture/Translate/Act summary into
   `web/public/SPiER-Overview-Care-Pathway.html`'s build so the one-pager's
   pillar text is derived rather than typed — but that HTML has its own PDF
   build and hash check (`docs/outreach/README.md`), so if it is not cheap,
   file an issue instead.

Done when: `Overview.tsx` contains no paragraph-length string literals or JSX
text, `npm run verify` passes, and the rendered page is visually unchanged
(screenshot before and after in the preview).

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task C4. Move the
> Overview page's narrative into a typed content module modeled on
> `guideSections.ts`, render it from `Overview.tsx`, and confirm the page is
> visually unchanged and `npm run verify` passes. Update the Status table.

### C5 — File the Questionnaire-in-the-IG follow-up

**Model: Sonnet 5.**

`ig/input/ignoreWarnings.txt` suppresses every unresolved
`http://spier.org/Questionnaire/*` canonical because rendering the
Questionnaires inside the IG was blocked by an IG Publisher
`QuestionnaireRenderer` NPE, "tracked as a follow-up". A search of the tracker
(`gh issue list --search QuestionnaireRenderer --state all`) finds no such
issue. The Capture layer's central artifact is therefore absent from the IG's
Artifacts page, and the suppression hides that.

File the issue: what is suppressed and why, that the suppression is the only
reason a missing Questionnaire is not a QA error, the two candidate fixes
(include `FHIR-Resources/` as a `path-resource` and re-test whether the NPE
still reproduces on the pinned publisher version; or publish the Questionnaires
as IG examples via FSH `Instance:` with `InstanceOf: Questionnaire` sourced
from the JSON), and the repro recipe (copy `ig/` to a space-free path; the
publisher refuses paths with spaces). Label `area:ig`, `type:task`. Link it
from `ignoreWarnings.txt`'s comment.

Done when: the issue exists and `ignoreWarnings.txt` names it.

Prompt:
> Read `docs/plans/docs-and-ig-content-consolidation.md`, task C5. Confirm no
> issue tracks the IG's Questionnaire-rendering suppression, then file one with
> the content specified and reference it from `ig/input/ignoreWarnings.txt`.
> Use `--body-file -` for the body (`--body -` stores a literal dash). Update
> the Status table.

---

## What this plan deliberately does not do

- **Does not move `pagecontent/` out of `ig/`** or generate IG pages from app
  content. The IG is upstream of the app
  (`docs/plans/repo-and-package-boundaries.md` §1); the app links to the IG,
  not the reverse.
- **Does not shrink `CLAUDE.md`.** It is long because it records why gates
  exist, and every "this file used to say X" line in it is a defect that was
  found by reading it. A separate pass could split it by area; that is not
  this plan.
- **Does not touch the handoff.** It is rewritten at the end of most sessions
  by whoever ran them (a dozen rewrites since #384); changing it from a cleanup
  PR would collide with that.
- **Does not restructure `.claude/skills/`** (~800 lines of prose). Skills
  are instructions to a tool, not documentation, and have their own
  correctness test (does the skill produce a correct artifact).
