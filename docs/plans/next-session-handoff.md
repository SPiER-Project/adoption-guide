# Handoff — next session

Rewritten 2026-08-11, after the gate-hardening pass, #272 and #304. `main` was at
**fb5e5cb** when this was written — and moved four times during the session, so
check rather than trust that.

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

All four merged, all four issues closed, and each gate was seen *running* on
merged `main` rather than merely present: `lint-css` prints `116 defined … 115
distinct referenced … css-token check passed`, and the `sushi` job prints
`31 × sliced-category-numeric-index — expected`.

⚠️ **Four PRs landed from other sessions while this one ran**, none reviewed here:

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

⚠️ **`patient-011.json` and `ed-scenario-11.json` are under concurrent edit by
other sessions** — three of those four PRs touched one or both, and two landed
*during* #304's review. #315 was purely additive so #304's titles survived, but I
checked rather than assumed, and #300 is the precedent for why: it silently
reverted a merged gate by rewriting a file from a stale base. **Diff against the
merge-base before trusting any edit to those two files.**

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

- **The expected-advisory count is 31, not 32.** #273's title says "the 33rd";
  the real numbers were 31 expected today. This is exactly why the gate matches
  *shape* against an allowlist and never a count.
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

**There is no obvious next pick left.** #272, #273, #280 and #304 are all merged,
and nothing in the remaining list is both unblocked and substantial. What follows
is the honest inventory; picking from it is a prioritisation call, not a discovery
one. Note that **#303 is the one item that is explicitly not mine to decide** — it
is a scenario-authoring judgement about what `p007-stanley-brown` is supposed to
represent.

### Small data/doc cleanups

- **#303 — `p007-stanley-brown` is a stub** (no `activity`) named after a profile it
  doesn't conform to. Currently *limits* how strong #289's invariant can be: it's
  why `spier-episode-trigger-on-positive-screen` covers only `positive-screen` and
  not `elevated-assessment`. Renaming is probably right, but it's a scenario-authoring
  call.
- **#281 — dictionary ValueSet canonicals are gated but barely rendered.** Pairs
  naturally with #264 since it's the same table.

### Blocked

- **#264 — crosswalk fidelity in the data dictionary.** Needs #77's clinical
  sign-off, which is not a code task. The `fidelity`-derived-from-ConceptMap part
  could land early, but presenting fidelity as settled is the failure mode the issue
  warns about.

### Open but not assessed in this pass

Listed so they are not mistaken for triaged: **#301** (refreshed scenario fixtures
never reach a browser that already seeded its store), **#230** (extend the mapper
dispatch fallback past PHQ-9), **#231** (decide the CDS service's auth posture —
flip JWT validation to require, or document warn mode). No read on these here;
form your own.

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
- **Read the issue, then re-derive it.** Every issue picked up in this pass had at
  least one premise that had gone stale — #273's warning count, #272's element
  table, #304's claim that a doc would need the same edit. None was wrong when
  filed. Budget for re-deriving the facts before planning the change: twice it made
  the work smaller, once it changed the answer.
- **Stop hand-checking design tokens.** I checked 23 by hand across two sessions
  because no gate existed; `npm run check:tokens` is that gate now.
- **`services/cds-hooks` has its own verify** that `web`'s does not cover.
- The one eslint warning (`MeasureDashboard.tsx` useMemo dep) is **pre-existing**.
