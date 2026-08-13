# Handoff — next session

Rewritten 2026-08-11, covering the gate-hardening pass plus #272, #304, #281,
#301 and #230. `main` was at **fa9236c** when this was written — and moved twelve
times during the session, so check rather than trust that.

⚠️ **The previous version of this file was never committed.** It sat in one
worktree, on an already-merged branch, and no fresh session could see it — a
handoff that is not on `main` does not hand anything off. It is now tracked here.
Keep it that way: rewrite this file in place at the end of a session rather than
leaving a new one behind in a worktree.

## What landed in the correlation epic

Epic #259's correlation work is **done and closed**. Seven PRs implemented #263
(EpisodeOfCare as the correlation key) plus a follow-up gate:

| PR | What |
|---|---|
| #285 | `SPiEREncounter` profile + 24 scenario Encounters |
| #286 | `.encounter` on every linkable artifact, gated |
| #289 | `episode-trigger` extension + the IG's **first** FHIRPath invariant |
| #291 | Runtime: `lib/encounters.ts`, the three write funnels, episode auto-opens on a positive screen |
| #293 | Retired the CarePlan id regex → `meta.profile` → stage map |
| #298 | Retired the walkthrough name/id-substring matching → `relatedRefs` |
| #299 | IG retrieval path documented; stopped implying `_revinclude` works |
| #305 | The read side — `lib/episodeRecord.ts` + the chart's Episode record section |
| #307 | **#302**: validate the FHIR the app emits; fixed the 118 errors it found |

Design record: `docs/plans/episode-correlation-key.md` (decisions, phase table, and
the corrections to #263's original premises).

Closed: #260, #262, #263, #265, #302.

## What landed in this pass

| PR | Issue | What |
|---|---|---|
| #308 (b429a67) | #280 | Every `var(--token)` under `web/src` must resolve to a real definition |
| #309 (9e24ab1) | #273 | The *shape* of SUSHI's warnings, so the next real one is not invisible |
| #311 (411eeae) | #272 | The concept-domain tag on `Appointment.serviceCategory`; `EpisodeOfCare` and `Task` deliberately untouched |
| #314 (78f546e) | #304 | The 11.7-2A/2B naming swap — step titles moved, artifacts left alone |
| #317 (cb777fa) | #281 | Dictionary ValueSet canonicals rendered as links; `Binding.value.valueSet` shown at all |
| #321 (99915e9) | #301 | An untouched demo patient re-seeds when its fixture changes; a deliberate demo reset |
| #323 (fa9236c) | #230 | Foreign C-SSRS payloads derive; ASQ's exclusion recorded with its reasoning |

All seven merged, all seven issues closed, and each gate was seen *running* on
merged `main` rather than merely present: `lint-css` prints `116 defined … 115
distinct referenced … css-token check passed`, the `sushi` job prints
`31 × sliced-category-numeric-index — expected`, and `check:catalog` prints
`all 12 SPiER-local ValueSet(s) referenced have a generated definition`.

⚠️ **Nine PRs landed from other sessions while this one ran**, none reviewed here:

- **#310** — "Stop re-rendering an IG that did not change on every deploy", a keyed
  cache around `deploy.yml`'s IG render. #311 merged on top of it and the combined
  deploy run passed. `CLAUDE.md` carries its rules: the explicit `cache/save` after
  both gates, `publisher.log` cached beside `output/`, and `force_ig_render=true`
  for a `#current` template bump.
- **#312** — the HL7 use-case workbook is now generated from
  `docs/use-cases/ed-scenario-11.json`, with `ed-scenario-11.md` and the `dist/`
  workbook as outputs, plus a `freshness` CI job. **Edit the JSON, never the `.md`.**
- **#313** — drafted the missing actors, exception flows and consent steps into that
  scenario JSON (this is where `11.7-0A`, `11.7-2D` and the `origin:
  spier-proposed` marking came from).
- **#315** — narrated five of those proposed steps in `patient-011` and classified
  the rest; the walkthrough went 24 → 29 steps.
- **#316** — the four guide lenses became one page template, with a new
  `check:template` gate (`verify` is now **nine** drift checks; CLAUDE.md is
  current on this). It landed *between* #317's CI run and #317's merge, so those
  green checks had tested a merge with the older `main` — see the concurrency note
  below.
- **#318 / #320** — three more ED patients for the exception branches, and the
  last un-narrated scenario step; every ED step now has a demo.
- **#319** — the assessment and workflow form views joined that page template, so
  `check:template` now covers them too. Landed between #321's CI run and its
  merge; same story as #316/#317, same resolution (the post-merge run).
- **#325** — named the standard category slices, fixing a **data-loss** bug #271's
  numeric-index pattern had been causing, and aligned against the HL7/ASTP US
  Behavioral Health Profiles IG. It touched two things this session had just
  shipped: the `ALLOWED` reason in `check-sushi-output.mjs` (#309) and
  `fallbackDispatch.ts` (#323). Both changes are improvements; see those notes.

⚠️ **`patient-011.json` and `ed-scenario-11.json` are under concurrent edit by
other sessions** — five of those eight PRs touched one or both, and two landed
*during* #304's review. #315 was purely additive so #304's titles survived, but I
checked rather than assumed, and #300 is the precedent for why: it silently
reverted a merged gate by rewriting a file from a stale base. **Diff against the
merge-base before trusting any edit to those two files.**

⚠️ **A PR's green checks are only as current as the run.** `pull_request` CI tests
the merge with `main` **as it stood when the run happened** — not at merge time. So
a PR that sits through review is not tested against whatever landed meanwhile:
#316 added a new gate (`check:template`) over the very page #317 was editing, and
#317's checks predated it. Nothing broke, and the **post-merge** run on `main` is
what established that — it exercised the new gate against the new page and printed
`✓ page template: 12 pages, 4 lens headers, 13 containers`. **Watch the post-merge
run, not just the PR's, whenever anything landed during review.**

**#308 — `web/scripts/check-css-tokens.mjs`, wired into `npm run verify` (now
**eight** drift checks) and `web-lint.yml`'s fast `lint-css` job.** `lint:css`
enforces that a colour/size/shadow declaration *uses* a token and cannot check
that the token *exists*, so `color: var(--made-up)` shipped as a value the
browser drops. Four things worth knowing before touching it:

- Definitions are scraped from **whole files**, not the `:root` block — tokens are
  also declared in media queries and `[data-theme]` overrides. `src/index.css` is
  in stylelint's `ignoreFiles`, so this check is the only thing that reads it.
- `--patient-banner-height` has no CSS definition on purpose (`PatientBanner.tsx`
  publishes the measured height for `--anchor-scroll-offset`). It is honoured by
  **scraping `setProperty` out of the TypeScript**, not by an allowlist, so the
  exemption cannot outlive the code that earns it. **If you add another JS-set
  custom property, use `setProperty('--x', …)` and it works with no edit here.**
- A fallback does not excuse an undefined token: `var(--x, 1rem)` fails. The
  fallback is what makes the typo invisible.
- Unused tokens are *not* failed on. 116 defined vs 115 referenced is not a
  defect; that direction is a separate decision nobody has made.

**#309 — `scripts/check-sushi-output.mjs`; `ig.yml`'s compile step now tees its
output and a second step gates it.** Two facts that correct the issue text:

- **The expected-advisory count was 31, not the 32/33 in #273's text — and is now
  6.** ⚠️ Do not trust any number here; check. #325 named the standard category
  slices the same day and the count fell to 6, all on `Communication`. This is the
  gate paying for itself twice: matching *shape* rather than a count meant the drop
  needed no edit, and the `ALLOWED` entry's mandatory reason is where #325 had to
  write down which shape is actually benign (`category[+].text` writes a
  sub-element of index 0, so both codings survive) versus which was **losing data**
  (a whole-value `category[+] = <coding>` overwrote the domain slice — 23 of 25
  example Instances). This file previously called all 31 "deliberate, do not
  silence", which was wrong about 25 of them.
- **SUSHI's summary sentence is randomised per run** ("Something smells fishy…",
  "This looks a bit fishy."), so only the `N Errors` / `N Warnings` fields are
  matched. The gate also reconciles its own parse against that banner — if
  SUSHI's line format changes, it goes red instead of silently declaring every
  warning expected.
- A newly expected warning belongs in `ALLOWED`, **with the reason it is
  expected**; that field is required precisely because adding an entry is a
  decision to stop reading a class of warning.

**#311 — the concept-domain tag reached `Appointment`, and only `Appointment`.**
The rationale per row lives in `docs/plans/episode-correlation-key.md` §7 under
*RESOLVED*; three things from it that will matter to the next person:

- **The FSH rule sets are now parameterized on the element name** —
  `SuicideRiskDomainSlicingOn(element)` / `SuicideRiskDomainSliceOn(element)`, with
  the `category` pair delegating to them. **If another resource type ever needs the
  domain tag in a differently-named slot, insert those instead of copying the
  block** — one discriminator is what makes the domain query work at all. Proof
  the refactor was inert: `fsh-generated/` was diffed against the prior build and
  only the Appointment profile plus its two examples changed, the latter populated
  by SUSHI itself from the fixed value on the required slice.
- **A missing tag and a *wrong* tag are caught by different gates.** Deleting
  `serviceCategory` from a scenario Appointment fails `check:scenarios:resources`
  offline (it reads `min` off the generated StructureDefinition — no gate edit was
  needed); a wrong *code* passes that check and is caught only by the HL7
  validator. Both confirmed by planting them. That is the split CLAUDE.md
  documents, now measured on a real case.
- **`Appointment?service-category=` is patient-scoped, not episode-scoped.** It
  cannot tell one episode from another; `Encounter.appointment` is still the only
  episode path, because R4 gives `Appointment` no `.encounter`.

**#314 — the 11.7-2A/2B swap, fixed on the titles.** Four lines in
`patient-011.json`. Two things generalise:

- **`meta.profile` is stronger evidence than a date.** #304 argued the assignment
  from the `sent` dates; the artifacts also claim different profiles
  (`spier-outreach-attempt` vs `spier-caring-contact`), which settles it without
  reference to a rolling date anchor that `check:dates` shifts anyway. When a
  narration and an artifact disagree, ask what the artifact *claims to be*.
- **The issue's stated blocker had evaporated.** It said the step titles might have
  been lifted from `ed-scenario-11.md`, so that file would need the same edit. It
  had not: the titles exist nowhere but `patient-011.json`, and the HL7 scenario's
  own step text was never swapped. An issue's premises go stale in both directions
  — this one had become *easier*, the same way #273's count had drifted.

**#317 — the dictionary's ValueSet canonicals are links now.** `valueSetHref` /
`valueSetLabel` in `dataElements.ts` are siblings of `codeHref` / `systemLabel` and
carry the same contract: derived from the canonical, never hand-written, and
`undefined` when there is nowhere honest to point (external ValueSets return
undefined rather than guessing another publisher's URL pattern). Three notes:

- **`check:catalog` became load-bearing rather than aspirational.** Its comment had
  justified the gate by a rendering that did not exist; now that both
  `Concept.valueSet` and `Binding.value.valueSet` are links, that gate is the only
  thing between a renamed ValueSet id and a 404 in the published IG. The comment
  says so.
- **The `ig/<Type>-<id>.html` convention was checked against the live IG**, not
  assumed from `codeHref`'s parity — two canonicals fetched, both serving real
  expansions. Do the same before adding a third link type.
- **`dataElements.test.ts` is new** and sweeps *every* canonical in the catalog for
  a resolvable href, because one that yields none degrades silently to plain text —
  the exact defect #281 closed. Add an external ValueSet and it goes red on
  purpose, forcing a decision about how to link it.

**#321 — an untouched demo patient re-seeds itself; a written-to one never does.**
The record is a content FINGERPRINT of the scenario (FNV-1a over the serialized
module) in its own `spier-scenario-seeds` key, not a hand-bumped `SEED_VERSION` on
the slice. Three things to carry forward:

- **A pre-#301 slice has no record and is therefore never refreshed**, on purpose:
  it cannot be told apart from a user-modified one, and the obvious heuristic
  ("does it hold a resource the fixture doesn't?") still misses an in-place edit
  like marking an appointment fulfilled. Those browsers rely on the two-click
  **reset** in the Population footnote, which also clears the legacy
  single-patient keys — leaving them lets `migrateLegacyStorage` resurrect
  pre-slice data, i.e. a "reset" that restores old state.
- The record is dropped in `updateSlice`, the single write funnel, so a new
  `saveArtifact` branch cannot forget it.
- Fixtures are dated against a re-anchored constant, which is *why* this mattered:
  staleness grew with every re-anchor, and only for repeat visitors.

**#323 — foreign C-SSRS payloads derive now, and recognition got a real scoring
rule.** The screener's 7 item codes are a strict SUBSET of the full form's 19, so
"first signature over its floor" would have sent every full C-SSRS to the screener
mapper. Recognition now takes the best match — most matched codes, ties broken by
coverage (matched ÷ signature size). Also:

- **Screener and Pediatric are indistinguishable by item code** (byte-identical
  LOINC sets) and one signature covers both, because `cssrsPediatric.ts` delegates
  to the same core — only the label differs. A second entry could never win a
  comparison; it would just make the tie-break look accidental.
- **Fail closed**: an *absent* item is legitimate (`enableWhen`), but an item
  present with an answer we cannot decode is refused outright rather than scored as
  a No — an unparsed "specific plan and intent" must never read as a clean screen.
- ASQ's exclusion is recorded **in the file**, not just the tracker: no per-item
  LOINC exists, the only LOINC is the shared `93374-7` result code, and inventing
  codes is #220. Item-level foreign ASQ belongs to #77's ConceptMap path.
- The `check:codings` LOINC floor for `web/src` moved 34 → 49 in the same change
  that grew the source 86 → 98. Nothing re-checks a floor on its own.
- **#325 has already extended this file**: `itemsByCode` now also reads a `linkId`
  that is itself a LOINC code, because that is the only place the HL7/ASTP US
  Behavioral Health Profiles IG carries a code on its published PHQ-9 and C-SSRS
  QuestionnaireResponses. Its examples are checked in under `__fixtures__/`. So the
  recognition surface is wider than #323 left it — read the file, not this note.

## Three things to know before touching the correlation area

1. **`ig.yml`'s `validate` job now validates runtime output.** It runs
   `copy-fhir --no-compile` → `npm run emit:runtime-fhir` → `validate-fhir.mjs
   --also web/.runtime-fhir`. If you add a **new production builder**, wire it into
   `web/src/lib/runtimeFhir.emit.test.ts` — the "every production builder family"
   assertion fails if you don't, which is deliberate.

2. **Adding a required element or slice in FSH means changing the runtime too.**
   #271 made `category:suicideRisk` required on 28 profiles and updated only the
   fixtures; the app emitted non-conformant resources for weeks. `lib/conceptDomain.ts`
   is where that coding lives now.

3. **#300 silently reverted a merged gate.** It rewrote
   `check-scenario-resources.mjs` from a pre-#298 base and deleted phase 5b's
   `relatedRefs` checks; restored in #305. **Whenever two PRs touch that file in
   parallel, diff it against the merge-base**, and remember `pull_request` CI tests
   the *merge* with main, not your branch alone.

## Open issues, with my read on each

**#272, #273, #280, #281, #301, #304 and #230 are all merged.** What was the
untriaged pile is now assessed, and the highest-value item on the board is one this
session *created* by reading code carefully rather than one that was waiting to be
picked.

### Take this first — #327, filed 2026-08-12

**The C-SSRS and CAMS-Section-B mappers cannot read their own forms' output.**
`getBooleanAnswer` reads only `answer.valueBoolean`, and **not one Questionnaire in
this repo declares a `boolean` item** — every yes/no question is `type: choice` with
SNOMED Yes/No codings. Observed, not inferred: a screener endorsing q1, q2 and **q5
("specific plan and intent")** derives `tier: 'none'`, `"C-SSRS: No risk
identified"`.

Why it survived is as important as the defect, and the issue lists all three:
`cssrsScreener.test.ts` *builds* `valueBoolean` QRs and so proves the mapper works
on input the app never produces; no scenario fixture carries one of these forms with
items, so `check:scenarios:responses` never sees the native shape; and #323's
fallback path deliberately emits booleans, so a **foreign** C-SSRS derives correctly
while a **native** one does not. That inversion is the tell. `asq.ts`, `pss3.ts` and
`safet.ts` use `getYesNoBoolean` and are fine — the fix already exists in the repo.

### Needs a human decision, not a patch

- **#303 — `p007-stanley-brown` is a stub** (no `activity`) named after a profile it
  doesn't conform to. It *limits* how strong #289's invariant can be: it is why
  `spier-episode-trigger-on-positive-screen` covers only `positive-screen` and not
  `elevated-assessment`. Renaming is probably right, but which way depends on what
  that fixture is meant to represent — a scenario-authoring judgement. **Do not
  guess it; ask.**
- **#231 — the CDS service's auth posture.** Triaged this pass, and narrower than
  filed. A tokenless invoke against the live Worker returns **HTTP 200 with a
  `critical` card**, so the claim holds — but the issue's premise that an adopter
  must "infer the posture from the code" does not: the guide page has an
  Authentication section stating warn mode, and the README has a config table, the
  SSRF note and a `Rollout: warn → require` section that already names the
  tokenless-demo blocker. What is actually missing is that both frame warn as
  *transitional* and nobody has scheduled the flip. `require` is implemented and
  unit-tested and is one `wrangler.jsonc` var; the app itself only fetches
  discovery (open either way), so flipping would break the guide's own published
  curl and any CDS Hooks Sandbox trial — not the demo UI. **Option B (declare warn
  deliberate, two-line doc change) looks right, but it is a security posture and so
  is Brad's call.**

### Blocked

- **#264 — crosswalk fidelity in the data dictionary.** Needs #77's clinical
  sign-off, which is not a code task. The `fidelity`-derived-from-ConceptMap part
  could land early, but presenting fidelity as settled is the failure mode the issue
  warns about. #317 left it the obvious landing spot: the value cell in both binding
  tables now carries the system and the bindable set, and fidelity qualifies exactly
  that pair. No column was stubbed for it — an empty column is a claim of its own.

### Filed by other sessions, not triaged here

Listed so they are not mistaken for assessed: **#324** (the lethal-means measure
scores "could not be done" and "not yet done" alike), **#322** (assessment pages
carry two titles, heading order runs h2 → h2), **#326** (clinical review of ED
Scenario 11's 10 proposed steps and 3 new patients — likely not a code task).
#324 reads like a real measure-correctness bug and is probably the one to look at
after #327.

## Standing repo rules that mattered most

- **Prove a gate can fail before trusting it.** Every gate in this stretch was
  verified by planting the defect it targets — including both new ones: #308 was
  proved against a bare `var(--nope)`, one with a fallback, a nested missing token,
  a token named only in comment prose, and a deliberately broken `setProperty`
  call; #309 was proved end to end by planting an empty `Description:` on
  `ExampleStanleyBrownSafetyPlan`, which made SUSHI emit a real 32nd warning of a
  different kind. #289's invariant found three real violations on its first run
  without needing a planted one. #311 was proved three ways — tag deleted from a
  fixture (offline gate red), tag given a bogus code (validator red, offline
  green), tag dropped from the runtime builder (validator red on the emitted
  corpus).
- **Verify against the source, not memory.** #263's proposed element table was six-
  eighths wrong about R4; the fix came from reading
  `~/.fhir/packages/hl7.fhir.r4.core#4.0.1`. Same for search parameters in #299 —
  an element existing does not mean a search parameter exists. Twice more in this
  pass: #273's issue text had the warning count stale before anyone started, and
  #272's table would have had `EpisodeOfCare` tagged a second time and `Task`
  tagged unsearchably. What settled #272 was enumerating the real `SearchParameter`
  files in that package, **including the shared `clinical-*` ones** — a per-type
  `ls` misses them, which is how "EpisodeOfCare has no `type` parameter" almost
  became a finding.
- **A test can encode the wrong assumption, and then defend it.** #327 is the
  sharpest example this repo has: `cssrsScreener.test.ts` states in its first
  comment that "C-SSRS Screener items are plain booleans" and builds QRs to match,
  so a green suite certified a mapper against input the app never produces. Tests
  prove consistency with themselves. When the question is "does this read what the
  app actually emits", read what the app emits — the form's own Live FHIR panel
  answers it in ten seconds.
- **Read the issue, then re-derive it.** Every issue picked up in this pass had at
  least one premise that had gone stale — #273's warning count, #272's element
  table, #304's claim that a doc would need the same edit. None was wrong when
  filed. Budget for re-deriving the facts before planning the change: twice it made
  the work smaller, once it changed the answer.
- **Stop hand-checking design tokens.** I checked 23 by hand across two sessions
  because no gate existed; `npm run check:tokens` is that gate now.
- **`services/cds-hooks` has its own verify** that `web`'s does not cover.
- The one eslint warning (`MeasureDashboard.tsx` useMemo dep) is **pre-existing**.
