# Handoff — next session

Rewritten 2026-08-11, after the gate-hardening pass that followed the first
version of this file. `main` is at **d4c8a8e** plus this commit.

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

## In flight — two gates, both green, both awaiting review

| PR | Issue | What it gates |
|---|---|---|
| #308 | #280 | Every `var(--token)` under `web/src` resolves to a real definition |
| #309 | #273 | The *shape* of SUSHI's warnings, so the next real one is not invisible |

Neither touches app behaviour, FSH, or CSS. If they are merged, the notes below
are already true; if not, they describe what those branches do.

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

### Best next pick

- **#272 — extend the concept-domain tag to Appointment, EpisodeOfCare, Task.**
  The remaining pick from the last pass, and it is not purely a code task: phase 7
  changed the calculus. `Task` has both a native `.encounter` and `Task.basedOn` →
  episode, so the case for tagging it is weaker than the issue assumes;
  `Appointment` is reached via `Encounter.appointment`; `EpisodeOfCare` stays
  findable by `type`. **Re-read the issue against
  `docs/plans/episode-correlation-key.md` §7 before starting** — its three rows may
  not want the same answer any more, and the honest outcome may be option 3
  (leave all three to the episode) plus a `quick-starts.md` update.

### Small data/doc cleanups

- **#303 — `p007-stanley-brown` is a stub** (no `activity`) named after a profile it
  doesn't conform to. Currently *limits* how strong #289's invariant can be: it's
  why `spier-episode-trigger-on-positive-screen` covers only `positive-screen` and
  not `elevated-assessment`. Renaming is probably right, but it's a scenario-authoring
  call.
- **#304 — walkthrough steps 11.7-2A/2B** use "caring contact" and "follow-up
  outreach" the opposite way round from the artifacts they reference. The references
  are correct (dates decide it); the titles are loose. **Check
  `docs/use-cases/ed-scenario-11.md` before renaming** or the two drift.
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
  without needing a planted one.
- **Verify against the source, not memory.** #263's proposed element table was six-
  eighths wrong about R4; the fix came from reading
  `~/.fhir/packages/hl7.fhir.r4.core#4.0.1`. Same for search parameters in #299 —
  an element existing does not mean a search parameter exists. Same lesson, smaller
  scale, in #273: the warning count in the issue text was already stale.
- **Stop hand-checking design tokens.** I checked 23 by hand across two sessions
  because no gate existed; `npm run check:tokens` is that gate now.
- **`services/cds-hooks` has its own verify** that `web`'s does not cover.
- The one eslint warning (`MeasureDashboard.tsx` useMemo dep) is **pre-existing**.
