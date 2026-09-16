# IG cleanup audit: what an implementer can find, and what is in the way

Written 2026-09-16 from a full read of the ten IG pages, the FSH prose that
renders on artifact pages, the published `artifacts.html`, the content contract
in [`docs-and-ig-content-consolidation.md`](docs-and-ig-content-consolidation.md),
and every place the app and the gates reach into `ig/`. This is a **proposal to
mark up**, not work done. Nothing under `ig/` has changed.

**The reader it is written for:** a FHIR implementer at a vendor or health
system who has one of five jobs — find an instrument's Questionnaire, validate a
resource, query a server for SPiER data, decide what conforming means, or run
the pathway. Every verdict below is "does this help that person do that job in
the next five minutes". Rationale that does not is not deleted; it moves to
`docs/` first and to the app's Adoption Guide later, per the 2026-09-16
decision.

## Status

| Task | State |
|---|---|
| Audit (this document) | marked up 2026-09-16: all five recommendations accepted (remove Design decisions; new `docs/decisions/`; drop the menu prose + retire menu-gate A/B; keep Zero Suicide mapping short; #473 first) |
| 1 — Questionnaires into the IG (#473) | in progress — `ig/input/resources/questionnaires` symlink + `path-resource: input/resources/questionnaires/*`; the publisher refuses `../FHIR-Resources/*` (path must be under the IG root), so the issue's candidate (1) needed the symlink. Publisher 2.3.4 renders all 18 with no `QuestionnaireRenderer` NPE — and its first run surfaced 18 real errors the old suppression had hidden: four CAMS ids not matching their canonical tail (fixed), ten ASQ LOINC 2.83 codes tx.fhir.org cannot resolve yet (`ignoreWarnings.txt` cannot suppress errors — CI proved it — so the publisher's validation of that one Questionnaire is switched off with `no-validate`, deleted together with `PENDING_TX` when the server updates). Narrative gate recurses `/*` and fails on an id-less resource. Full render + QA count come from `ig-publish.yml` on the PR (Jekyll is not installable on this machine's Ruby). |
| 2 — Artifact groups + the exactly-one-group gate | in progress, stacked on #512 — `scripts/build-ig-groups.mjs` generates the `groups:` block from one rule per FSH file / tool folder / `.fml`; `--check` (in `ig.yml`) fails on an unassigned source, a stale block, or a compiled resource with no `groupingId`, each planted and watched to fail. The five FML maps go through `resources:` because SUSHI never loads `.fml`. Nothing pruned, as §4 concluded. |
| 3 — Menu and the onboarding pages | in progress — Home 619→328 words (status table, two sentences of scope, a "Find what you need" table by task), Getting Started 367→396 (Questionnaires group, the four CapabilityStatements), How to Read → *Reading the artifacts* 1,099→811 (menu restatement gone; the tier-derivation rule moved to Conformance § *Tier derivation on the Questionnaire*; the C-SSRS war story is the first `docs/decisions/` record). Landed above the ~550 target because the tier-derivation table, its JSON sample and the 11-line primer stayed whole. Menu: *Reading the artifacts*, *Measures*. `check-ig-menu` checks A/B retired with the prose; C/D kept and re-planted. |
| 4–8 | not started — see *Sequence* |

## 1. What is there today, measured

| Surface | Size |
|---|---|
| Narrative pages (`ig/input/pagecontent/`) | 10 pages, 11,947 words |
| FSH `Description:` text rendered on artifact pages | ~9,000 words across 35 files; profiles average 52 words, 8 profiles over 60 |
| CodeSystem concept definitions | 183 concepts, 2,522 words (fine — none is bloated) |
| `^purpose` (the field the publisher renders for rationale) | used **twice** in the whole IG |
| `artifacts.html` | one flat page, 286 rows in 13 publisher-default sections, 160 KB, no `groups:` |
| Artifacts | 32 profiles · 15 extensions · 56 CodeSystems · 42 ValueSets · 73 definitional instances (43 ActivityDefinitions, 10 PlanDefinitions, 8 Measures, 6 ConceptMaps, 4 CapabilityStatements, 1 Library, 1 NamingSystem) · 63 examples · 5 FML StructureMaps |
| Questionnaires (the Capture layer's central artifact) | **zero in the IG.** All 16 live in `FHIR-Resources/`; the IG only names their canonical URLs, and `ignoreWarnings.txt` suppresses the resulting unresolved-canonical QA messages ([#473](https://github.com/SPiER-Project/adoption-guide/issues/473)) |

## 2. The findings that shape everything else

Ranked by how much they cost the reader described above.

**F1. The thing implementers come for is not there.** Every Quick Start block
opens with a Questionnaire canonical that resolves to nothing on the site.
A reader who wants the ASQ or PHQ-9 form has to know to leave the IG for
GitHub. This is a navigation defect, not a prose one, and no amount of cutting
fixes it. Issue #473 already carries both candidate fixes (`path-resource` on
`FHIR-Resources/`, or FSH `Instance:` wrappers) and the repro recipe; the
publisher NPE that blocked it has not been re-tested on the pinned version.

**F2. The Artifacts page is a 286-row list sorted by resource type.** The
publisher's default groups by *type* (all 43 ActivityDefinitions in one block,
all 56 CodeSystems in another), which is the one axis nobody browses by. US
Core, Gravity and mCODE all declare `groups:` in `sushi-config.yaml` so the
page reads by *purpose*. SPiER declares none. This is the second-largest
navigation cost and costs no words to fix.

**F3. The Guidance menu mixes three audiences in six entries.** *How to Read*
(onboarding), *Relationship to Other IGs* (positioning), *Zero Suicide mapping*
(program leads), *Care Pathway* and *Measurement* (spec), *Design decisions*
(rationale). An implementer opening the dropdown cannot tell which two of the
six they need.

**F4. The pages argue instead of state.** The dominant pattern, on every page,
is *rule, then the defence of the rule, then the history of the defence*. The
reader needs the rule. Examples, with rough word counts:

| Page | Passage | Words | What the reader needs from it |
|---|---|---|---|
| Quick Starts | "Retrieving the whole record" + "one episode's record", before the first instrument block | ~900 | the three query shapes and the one Appointment exception (~200) |
| Measurement | "Measurement is where the Stage 5–7 design calls get tested" | ~450 | nothing — it defends earlier profiles; belongs in `docs/internals/measures.md`, which exists |
| Care Pathway | step-down criteria / milestone / historical-tier table; the "not tidiness" paragraph about drift gates | ~350 | one clause each: "not encoded; open clinical question" |
| Conformance | the `86849004` mis-citation story; CAMS-driver narrative rationale | ~300 | "a screen never becomes a Condition; use the verified set" |
| Relationship to Other IGs | the 2026-08-12 build inspection of the BH Profiles IG | ~200 | already published verbatim in `docs/research/2026-08-us-behavioral-health-profiles-ig.md`, which the paragraph links to |
| How to Read | the C-SSRS `required`-item war story under tier derivation | ~100 | the rule: a `computed` item is `readOnly`, not `required`, and a filler must not demand it |
| Design decisions | the whole page | 1,976 | six SHALL/SHOULD one-liners; the rest is rationale |

**F5. Rationale is in `Description`, not `^purpose`.** The publisher renders
`Description` at the top of every artifact page and `Purpose` further down.
SPiER puts both in `Description`, so a profile page opens with a 100-word
paragraph that starts with what the profile is and ends with why a binding is
extensible. Fourteen artifacts exceed 60 words (8 profiles, 2 CodeSystems, 2
PlanDefinitions, 2 ConceptMaps, 1 extension, 1 MeasureReport). The fix is a
split, not a cut: first two sentences stay as `Description`, the rest becomes
`^purpose`. Structure, codes and bindings do not change; verify with the same
compiled-leaf diff C3 used.

**F6. The Capture → Translate → Act explanation exists three times inside the
IG** (Home bullets, How to Read table, Relationship intro), plus the README and
the app's Overview module. The content contract already says the IG keeps one.

**F7. Project status is restated on six pages.** FMM tables, "not yet reviewed
by the Zero Suicide Institute", "pending clinical sign-off", roadmap-milestone
links. One status block on Home, one line elsewhere.

**F8. Two smaller defects found in passing.** Conformance lists three actor
CapabilityStatements; the FSH publishes four (Quality Reporter is missing from
the list, and Measurement refers to it as if listed). Care Pathway names
`check:pathway`, a repo gate, in a published page; check E's pattern list does
not include the `check:<name>` form, so it passed.

## 3. Proposed information architecture

Mirrors the HL7 convention the config already commits to, with Guidance cut to
what changes an implementer's behaviour.

| Menu | Page | Now | Target | What changes |
|---|---|---|---|---|
| Home | `index.md` | 619 | ~250 | status table, two sentences of scope, a "which page do I need" table by job. Drop the second copy of the three-layer bullets and the companion-resources block (moves to Getting Started). |
| Getting Started | `getting-started.md` | 346 | ~400 | the one page that grows: adds "where the Questionnaires are" (until F1 lands, a GitHub link; after, the artifact group) and the four-CapabilityStatement list. |
| Guidance ▾ Reading the artifacts | `how-to-read.md` | 1,099 | ~550 | keep the profile-reading notes, the three-layer table, the tier-derivation table, the 11-line clinical primer. Drop "The menu" (the nav bar is the menu). Move the tier-derivation *rule* to Conformance; the war story to `docs/`. |
| Guidance ▾ Care Pathway | `care-pathway.md` | 1,284 | ~600 | keep what it encodes, how the branch reads the tier, transportability, the KPI table. Not-encoded table shrinks to one clause per row. |
| Guidance ▾ Measures | `measurement.md` | 1,626 | ~700 | keep the seven-measure table, the denominator and transition-index rules, "choices you may make differently", population basis, the verification note. Design-call defence and the dashboard/export/share essay leave (three one-line bullets stay). |
| Guidance ▾ Relationship to Other IGs | `relationship-to-other-igs.md` | 898 | ~350 | keep shared foundation, the complementary table, the three terminology bullets, one sentence on why no dependency. |
| Guidance ▾ Zero Suicide mapping | `zero-suicide-mapping.md` | 765 | ~400 | the two tables and a status line. The decomposition notes go to `docs/`. **Decision for Brad:** this is the one page for program leads; it can stay short here or move to the app's Learn group. Recommend keep for now. |
| Conformance | `conformance.md` | 1,409 | ~800 | actors (all four), Must Support, screening-level rule, SHALL NOT derive a Condition, harmonization table, egress lossy steps — plus the normative one-liners lifted from Design decisions and How to Read. |
| Quick Starts | `quick-starts.md` | 1,925 | ~1,100 | **instrument blocks first**, then the harmonized query, the domain-category list with its Appointment exception, the episode two-hop, one paragraph on `_revinclude`. R4 element tables go to `docs/`. |
| Artifacts | generated | 286 flat rows | grouped | see §4 |
| *(removed)* Design decisions | `design-decisions.md` | 1,976 | 0 | six normative statements → Conformance; the rationale → `docs/`. ⚠️ Two rendered FSH Descriptions (`safety-plan-section.fsh:22`, `suicide-related-conditions.fsh:27`) and eight FSH comments point at this page; they repoint to Conformance or to the docs file's GitHub URL. |

**Totals:** 11,947 → ~5,150 words (about 57% out), ten pages → nine.

**Decision for Brad — Design decisions page.** The alternative is keeping it as
a short appendix at the end of Guidance. Against: US Core, Gravity and mCODE
publish no such page; rationale that changes nothing an implementer does is the
definition of what F4 removes. For: it is the only place the LOINC 2.82 search
behind the local section codes is published to reviewers. Recommend remove, and
give the moved file a stable GitHub URL the FSH can cite.

**Where the moved prose lands.** `docs/README.md`'s placement rule has no home
for decision records (`reference/` is for transcribed sources, `research/` for
investigations, `best-practices/` for guidance). Propose a new `docs/decisions/`
folder, one file per topic (terminology, problem-list set, safety-plan codes,
interpretation vocabularies, licensing status, measure design, R4 query
limits), and one added row in `docs/README.md`. The measures material already
has a home in `docs/internals/measures.md`; the BH Profiles inspection already
lives in `docs/research/`. **Decision for Brad:** new folder, or fold into
`best-practices/` and accept the category stretch.

## 4. The Artifacts page: group by purpose, prune almost nothing

**Pruning was in scope and the answer is: there is almost nothing safe to
prune.** Checked, not assumed:

- The 43 ActivityDefinitions **are** the tool catalog. `tools.ts` derives every
  tool, its stage, its licensing and its id from them; `check:catalog` fails
  on a missing one. The three placeholders (`TriggerSuicideRiskWorkflow`,
  `AdministerCARSS`, `AdministerLocalRiskAssessment`) document real pathway
  steps and already say what they are.
- The instrument answer CodeSystems (SBQ-R Q1–Q4, nine C-SSRS, PSS-3, BSSA…)
  are bound from `FHIR-Resources/` Questionnaire `answerOption`s. Removing one
  breaks a Questionnaire.
- The app links CodeSystem and ValueSet pages by id from the Data Dictionary
  (`dataElements.ts`), so ids are pinned.
- The 63 examples are what `validate-fhir.mjs` checks QuestionnaireResponse
  structure against, and one per Questionnaire variant is the minimum that
  demonstrates the shape. The only redundancy found is two `ExampleMeasured*`
  instances that duplicate Stage-6 examples to feed the MeasureReport examples,
  and three MeasureReports where two would do. Optional; low value.

So the count stays and the presentation changes. Add `groups:` to
`sushi-config.yaml` so `artifacts.html` reads by the reader's question:

| Group | Holds |
|---|---|
| Screening and assessment instruments (Capture) | the 16 Administer/Author ADs, the ~20 result profiles, instrument CodeSystems and ValueSets, example QRs and Observations — **and the Questionnaires once F1 lands** |
| Suicide-risk concept layer (Translate) | concept profile, tier and domain CS/VS, tier-derivation extension, 6 ConceptMaps, 5 StructureMaps, the four example concept Observations |
| Safety planning and means safety | Stanley-Brown / CRP / CAMS plan profiles, section CS/VS, lethal-means and crisis-resource profiles and ADs |
| Handoffs and follow-up | handoff, packet, referral, appointment, consent, outreach, caring-contact profiles, their CS/VS and ADs |
| Risk episode and registry | episode, encounter, flag, task, condition profiles, their CS/VS and ADs |
| The pathway (Act) | the pathway PlanDefinition, 8 stage PlanDefinitions, reassessment schedule, placeholder ADs, tool-id NamingSystem, licensing and coding-verification extensions |
| Measures | 8 Measures, the Library, MeasureReports, measure-group CS, reporting ADs |
| Conformance | the 4 CapabilityStatements |

A resource can be in exactly one group, and the publisher renders only grouped
resources under grouped headings — so the change needs a gate in
`check-sushi-output.mjs` or a sibling: **every generated resource is assigned
to exactly one group**, asserted as a shape (an unassigned resource fails), not
as a count. This is the same "a gate that quietly checks less" trap the
narrative gate was built against, and it must be planted-and-verified.

## 5. The question about pulling content from another repository

Brad asked whether the IG should pull its prose from some other content
repository. Two recorded decisions bear on it, and one real case for it exists.

- [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §1: the IG
  is **upstream** of everything else — "the canonical, machine-readable source
  everything else derives from". The consolidation plan states in *What this
  plan deliberately does not do* that it does not move `pagecontent/` out of
  `ig/` or generate IG pages from app content.
- The two genres are different. IG prose is spec-shaped: short, normative,
  linked to artifacts. `docs/` prose is long-form rationale. A single source
  generating both would produce the wrong thing for one of them, and the gates
  (menu A–D, narrative E–H) are built for `pagecontent/` as it is.
- **The one place "pull from elsewhere" is right is the Questionnaires** — the
  IG should pull `FHIR-Resources/` in as artifacts via `path-resource`. That is
  F1, and it is content the IG *lacks*, not prose it *restates*.

Recommendation: keep the pages in `ig/input/pagecontent/`, make them short, and
let the app keep linking in. Revisit only if the Adoption Guide grows a
"Learn" page whose text the IG also needs verbatim; today none does.

## 6. What the gates will need

- **`check-ig-menu.mjs` checks A and B** compare How to Read's "The menu" bullets
  to `menu:`. Removing that section fails the gate by design. Retire A and B
  with the section (C and D, which catch the 1,812-broken-links failure, stay).
  The task table on Home replaces the bullets and checks G/H already cover its
  links. **Decision for Brad:** keep the section and the checks instead, at a
  cost of ~100 words.
- **`check-ig-narrative.mjs` check E** gains the `check:<name>` pattern (F8).
- **Every renamed or removed page** is caught by the publisher's broken-link
  gate; the app links the IG only by base URL and by artifact id, and the FSH
  links one page (`conformance.html`), which stays.
- **The Description → `^purpose` split** is verified the way C3 verified its
  move: compile before and after, diff every leaf, and accept only prose
  differences.

## 7. Sequence

Each is its own branch and PR, independently mergeable.

1. **Questionnaires into the IG (#473).** Re-test the publisher NPE on the
   pinned version first; if it reproduces, the `Instance:` route. Largest
   navigation gain, zero prose.
2. **Artifact groups + the exactly-one-group gate.** Independent of prose.
3. **Menu and the onboarding pages** — `index.md`, `getting-started.md`,
   `how-to-read.md`, `sushi-config.yaml`, the menu-gate change. These move
   together because the menu gate ties them.
4. **Conformance absorbs Design decisions** — the six normative statements in,
   the page out, the rationale to `docs/decisions/`, the two FSH Descriptions
   repointed. Together because they are one move.
5. **Quick Starts** reordered and trimmed; R4 element tables to `docs/`.
6. **Care Pathway + Measures** trimmed; defence to `docs/internals/measures.md`
   and `docs/decisions/`.
7. **Relationship + Zero Suicide** trimmed.
8. **FSH Description → `^purpose`** on the fourteen long artifacts.

Every PR runs `npx fsh-sushi .`, `check-sushi-output.mjs`, `check-ig-menu.mjs`,
`check-ig-narrative.mjs`, `check-md-links.mjs` and `validate-fhir.mjs`, and
PRs 1–2 need a publisher run (`gh workflow run ig-publish.yml`) because only the
publisher renders the artifacts page.

## 8. Decisions this audit needs before work starts

1. Remove the Design decisions page, or keep a short appendix?
2. New `docs/decisions/` folder for moved rationale, or fold into `best-practices/`?
3. Drop How to Read's menu section and retire menu-gate checks A/B, or keep both?
4. Zero Suicide mapping: keep short in the IG, or move to the app's Learn group now?
5. Is #473 (Questionnaires in the IG) in this effort's scope? Recommend yes, first.
