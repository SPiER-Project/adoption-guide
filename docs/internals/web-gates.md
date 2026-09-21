# The repo-root verification gates

What `npm run verify` runs, what each gate's load-bearing rule is, and what it
cannot see.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

At the repo root, the one-shot entry point is **`npm run verify`** — it runs copy-fhir (forced), typecheck, both linters, every `check:*` drift gate listed below, and the unit tests in sequence. (**Deliberately not a count.** This line said "eleven" while `verify` ran fourteen, because a pinned number goes stale silently on every gate added — the same failure as a stale `check:codings` floor in #232. If you add a gate, add it to this list; there is no number to bump.)

⚠️ **CI runs `npm run verify` itself**, rather than re-listing its steps, so a
gate added to `package.json` is enforced automatically. It did not always: the
`verify` job in `web-lint.yml` hand-listed a subset, and **eight gates ran only
on developer machines** — `check:template`, `check:patients`, `check:fallback`
(since deleted: deriving the per-item codes in `copy-fhir.mjs` replaced both the
hand-copied table and its gate with a type error), `check:measures`,
`check:reassessment`, `check:dates`, `check:ucum`, `check:fhir-r5`. All eight
passed and all eight together take ~3s, so cost was never the reason; a
hand-copied list simply has nothing to compare itself
against. **Do not re-expand that job into individual steps.** The fast
`lint-css` job deliberately re-runs the copy-fhir-free gates for quick feedback;
that overlap is intentional, and nothing may live there that is not also in
`verify`. The individual pieces, in the order `verify` runs them:
```
npm run copy-fhir      # compile IG via SUSHI + copy resources into the generated tree (do this FIRST)
npx tsc -b             # typecheck (project references; needs generated files present)
npm run lint           # eslint
npm run lint:css       # stylelint (design-token enforcement)
npm run check:tokens   # every var(--token) resolves to a real definition
npm run check:css-dead # every class selector in src/**/*.css is referenced by a non-test
                       # .ts/.tsx — a literal, or a `root--…${…}` template prefix, with TS
                       # comments blanked first (a doc comment naming `.risk-pill` kept a
                       # `:has(.risk-pill)` selector alive for a whole commit) — or is
                       # a class the formbox renderer emits, SCRAPED from its installed
                       # theme. Written after 148 selectors whose TSX had been deleted
                       # passed both other CSS gates — 92 in App.css, 35 in a Dashboard.css
                       # named for a page that no longer existed. ⚠️ It CANNOT see a class
                       # whose element never renders, a class referenced only from a
                       # test (tests are excluded on purpose), or two files defining the
                       # same class where import order picks the winner.
npm run check:template # page template: one header implementation, one owner of the page
                       # inset, one owner of the page width
npm run check:prose    # the reading MEASURE — `--measure-prose`. Its five rules are each
                       # written against a defect that shipped: the token must be in `em`
                       # and in band (it was 760px, a width where a character count was
                       # meant); every other `max-width` must be a page-width token or
                       # classified NON_PROSE with a reason (`.dd-detail` escaped a column
                       # budget to 52rem = 134 cpl under a comment claiming otherwise);
                       # a `max-width: none` must be declared (`.dd-cell-desc` carried a
                       # 46rem cap that a later `none` had always overridden); and an `em`
                       # cap must know what type it resolves against (`.tool-config-effect`
                       # sat at an inherited 16px while its paragraph was 14px); and RULE 5,
                       # a prose run is set at one of THREE sizes — lg lede, md body, base
                       # note. RULE 4 asks whether a capped run declares a size, RULE 5 asks
                       # WHICH, and that was the gap: 53 runs were spread over seven sizes
                       # (10-15px plus six inheriting) with every character count in band,
                       # because an `em` cap holds the count at any size. It showed up as
                       # width — 41em on 11px is 451px, 38% of a 1200px column — and nine of
                       # the eighteen sub-13px runs were on one page, which is why that page
                       # measured worst. The four INHERITS_TYPE entries stay exempt: choosing
                       # to track the page body size is a different act from picking a size
                       # outside the three.
                       # ⚠️ It CANNOT see a prose run with NO cap — that needs to know
                       # which elements hold long prose, which is content, not CSS. Measure
                       # a wide page's prose by hand after adding it. RULE 5 inherits that
                       # blind spot exactly: an uncapped run has no size for it to check
npm run check:fhir-render # the clinician-facing app shows no raw FHIR. `InspectContext` is the
                       # invariant — inspection ON inside `/guide`, OFF everywhere else — and
                       # `FhirJsonViewer`/`CodeDrawer` self-gate on it, so a new call site gets
                       # the clinician's answer by default. ⚠️ That covers only what goes
                       # THROUGH the leaf: `CarePlanDisplay` wrote its own
                       # `<pre>{JSON.stringify(carePlan.resource)}</pre>` plus a JSON download,
                       # and so was MISSING from the inventory in
                       # `docs/plans/archive/production-clinical-surface.md`, which was built by
                       # listing the viewer's call sites. This derives the list instead: a
                       # non-test `.tsx` under any app root that serializes to JSON or renders a
                       # `<pre>` must call `useInspect()`, or carry an entry in
                       # NOT_A_RESOURCE_VIEW saying why it is not one.
                       # ⚠️ **The rule is FILE-LOCAL, and the reachability version does not
                       # work.** Walking the non-guide routes the way `check:guide-boundary`
                       # walks the guide's reaches `QuestionnaireView`, `WorkflowForm`,
                       # `CarePlanDisplay` and `FhirJsonViewer` itself — all four are ONE
                       # implementation rendered by both `/patient/assessments/*` and
                       # the guide's tool pages. The audience is a property of the render,
                       # not of the module graph, which is the same reason `InspectContext` is
                       # a context and not a prop.
                       # ⚠️ Three things it cannot see, one of them proved by planting:
                       # a file that calls `useInspect()` and ignores the answer PASSES
                       # (disconnecting CarePlanDisplay's three `inspect &&` guards while
                       # leaving the hook call was green); a dump assembled in a `.ts` helper
                       # and rendered by a `.tsx` that never writes `JSON.stringify`; and a
                       # resource rendered without being serialized at all — a table over
                       # `Object.entries(resource)`, a `<code>` holding a coding; and an
                       # UNGUARDED WRAPPER around FhirJsonViewer, which HAD a live instance
                       # until 2026-09-20: ToolDetail wrapped its examples in a <section> with
                       # a heading and called no useInspect(), safe only because its one
                       # caller was a guide page (#527). The tool page that replaced it
                       # provides InspectContext itself, in the same file as the wrapper.
                       # RULE 3 is the prose half, and it PARSES rather than scanning: a
                       # recorder describes the ACT, not the resource (Brad, 2026-09-17).
                       # ⚠️ A text scan cannot do it — `Appointment` is a resource type in
                       # `<strong>Appointment</strong>`, an identifier in `AppointmentResource`
                       # and a reference prefix in `Appointment/${id}`, one token and three
                       # meanings. So it reads TypeScript's own JSXText nodes: what renders as
                       # WORDS. Identifiers, imports, template literals and string attributes
                       # are invisible by construction, which is why draftTitle="Live FHIR
                       # Communication" needs no exemption, and the `fhirNote={…}` subtree —
                       # the implementer's half, rendered inside the useInspect()-gated
                       # CodeDrawer — is skipped whole.
                       # ⚠️ **A word list could not have caught the field help**, so there the
                       # TAG is the rule: `caring-contact-opt-out` is a kebab-case slug and
                       # nothing tells it from "no-show follow-up" by spelling. What does is
                       # the element — a recorder reaching for `<code>` is quoting an
                       # identifier at someone who has no identifier to be shown. So a
                       # recorder view renders no `<code>` outside `fhirNote`.
                       # Six plants, the first two being the ORIGINAL text restored verbatim
                       # rather than a synthetic defect. ⚠️ What RULE 3 still cannot see: a
                       # resource type not on its 15-name list; a recorder built on some other
                       # frame than <WorkflowForm> (the detection THROWS on matching nothing,
                       # which is the half that is covered); the Questionnaire fillers, which
                       # render no lede; and non-FHIR jargon — "denominator", "SHALL", a bare
                       # "TL-032" were all fixed by hand in the same pass and none is gated.
                       # See `docs/internals/tool-views.md` §4
npm run check:ucum     # the UCUM shim is still safe: no quantities in the Questionnaires,
                       # and the shim still covers every method its consumers call
npm run check:fhir-r5  # the R5-model shim is still safe: every fhirVersion is "r4",
                       # and the renderer still imports the specifier we alias
npm run check:crosswalk  # concept-crosswalk validation
npm run check:extract    # the SDC observationExtract contract. Three rules: a declaring item
                         # carries a `code`; the declared code set equals the literal Observation
                         # codes its mapper emits; and EVERY mapper's Questionnaire is classified.
                         # ⚠️ The third was missing and was the whole hole — EXPECTED is a hand
                         # list of paths, and a Questionnaire simply absent from it was not
                         # "checked and found empty" but NEVER OPENED. Four of the fourteen
                         # mappers were in that state, and the gate printed ten green ✓ lines and
                         # said nothing about them. `camsSectionA` and `camsOutcomeDisposition`
                         # each emit six literal per-item SSF-vital Observations (plus, for the
                         # latter, a coded disposition) against Questionnaires declaring ZERO
                         # extracts; `cssrsFull` and `camsSectionB` genuinely have none, but
                         # nothing recorded that as a decision. The "ought to be checked" set is
                         # now DERIVED from `MAPPER_BY_QUESTIONNAIRE_URL`, so a fifteenth mapper
                         # is classified or the gate goes red, and a classification for a
                         # Questionnaire no mapper serves is itself a failure.
                         # ⚠️ What it still cannot see: whether a declared extraction is the RIGHT
                         # one. `camsSectionA`'s seventh Observation re-codes the same `6-score`
                         # answer under LOINC 93374-7 and is deliberately undeclared, because
                         # `$extract` yields ONE Observation per item — that judgement is a
                         # comment in EXPECTED, not a rule
npm run check:core-boundary # packages/core stays React-free and DOM-free — the constraint
                         # that makes the boundary worth drawing. A feature-detected
                         # browser API (`typeof BroadcastChannel === 'undefined'`) is
                         # allowed; an unguarded one is not. `alert` is deliberately
                         # NOT forbidden: `RiskAlert` values are named `alert`
npm run check:guide-boundary # the Adoption Guide holds no patient data — it explains and
                         # configures the pathway; the caseload lives on the EHR side
                         # (#391). Walks the guide's pages TRANSITIVELY, so a guide page
                         # importing a component that reads fixtures is caught too
npm run check:catalog    # tool-catalog wiring (stubs / UI metadata / ActivityDefinitions /
                         # questionnaire URLs BOTH ways / per-AD licensing metadata /
                         # per-AD tool-id identifiers).
                         # Check B stops a TOOL from reaching the app with no
                         # ActivityDefinition; check C stops the artifact one
                         # layer down — a Questionnaire in ig/input/resources/questionnaires/ that
                         # no AD administers, which was ungated until 2026-08-20.
                         # ⚠️ Check F reads the tool-id identifier SYSTEM off the
                         # NamingSystem that publishes it, never a retyped copy:
                         # a stale copy here AND in tools.ts would agree with each
                         # other and pass while the app decatalogued all 43 tools.
                         # Its load-bearing rule is the MULTI_AD_TOOLS allowlist —
                         # one tool id on several ADs is legitimate (the CAMS SSF-5
                         # is one tool, four session forms) and INDISTINGUISHABLE
                         # from a pasted-in duplicate, and the catalog merges the
                         # group either way, so the second tool does not go missing
                         # loudly — it goes missing inside the first one
npm run check:stages     # stage ids in population data vs canonical FSH stage list
npm run check:pathway    # the Suicide Safer Care Pathway PlanDefinition is almost
                         # entirely REFERENCES — tier codes, stage codes, and
                         # definitionCanonicals — and none of them is a conformance
                         # error when wrong, so SUSHI and the validator both pass a
                         # step pointing at nothing. This resolves all three against
                         # the generated artifacts, reading the stage list through
                         # the same `scripts/lib/stage-codes.mjs` that `check:stages`
                         # uses rather than a second copy.
                         # ⚠️ Its load-bearing rule is that the pathway carries NO
                         # `timing[x]` at all: the reassessment cadence has exactly
                         # one home (SPiERReassessmentSchedule) and three statements
                         # already, held in agreement by `check:reassessment`. A
                         # fourth here is what "reference, don't restate" prevents,
                         # and SUSHI reports 0 errors on it — proved by planting one
npm run check:readers    # every observation mapper's answer READS vs the Questionnaire's
                         # declared item `type` — see fhir-conformance.md
npm run check:careplan-readers # the SIBLING rule for carePlanMappers, and a different
                         # question: does the NESTING each reader walks match what the
                         # Questionnaire declares? `extractPairs` must name a `type: group`
                         # and `extractAnswer(s)` must name a leaf. #420 — `check:readers`
                         # scans only observationMappers, so #327's family recurred one
                         # directory over with no gate able to see it (#418/#419).
                         # ⚠️ It does NOT check that the readers still handle both response
                         # nestings: a static reader cannot tell a live branch from a dead
                         # one, and two planted defects proved it. That property is covered
                         # by the both-shapes cases in the mapper tests instead
npm run check:patients   # the 14 demo patients' demographics agree across all THREE
                         # sites: demo-population/src/patients/*.json (canonical), patients.json
                         # (display copies), and populationToFhir's MRN system in
                         # PatientProvider.tsx — which is SCRAPED, not restated
npm run check:scenarios  # BOTH halves of the population-scenario gate:
                         #  check-scenario-responses.mjs — QuestionnaireResponses vs their
                         #    Questionnaire (linkIds, nesting, answer options, ranges)
                         #  ⚠️ the `responses` bucket is ALSO walked by
                         #    check-scenario-resources.mjs, but for exactly two rules:
                         #    the patient link and `authored` (#364). It was owned by
                         #    NEITHER script before — the responses half checks the
                         #    Questionnaire, which says nothing about `subject`, and the
                         #    resources half skipped the bucket — so all 20 QRs carried
                         #    neither field and a patient-scoped search matched none
                         #  check-scenario-resources.mjs — every OTHER bucket (Observation,
                         #    CarePlan, Communication, EpisodeOfCare, Appointment,
                         #    ServiceRequest, Procedure, DocumentReference, Consent, Flag,
                         #    Task) — see fhir-conformance.md for what it does NOT do
                         #  ⚠️ it also relates two resources no other gate relates: a
                         #    DocumentReference claiming `safety-plan-copy` may not point at
                         #    a CarePlan with zero `activity` (#303). Scoped to the
                         #    CONTRADICTED case — a claim with NO related CarePlan is
                         #    unverifiable, not false (the copy may be in the attachment),
                         #    and p009 is deliberately left green
npm run check:dates      # the scenario fixtures' clinical dates are still coherent
                         # RELATIVE TO their anchor — a `fulfilled` appointment dated
                         # next week, a reassessment overdue by months. Default is
                         # --check (validates what is on disk and writes nothing);
                         # `--apply` is the separate re-dating command, so the script's
                         # name says "shift" while the gate only reads
npm run check:measures   # Stage-8 Measure criteria vs the measures.ts engine
npm run check:reassessment # the per-tier reassessment cadence agrees across all THREE
                         # places it is stated: the PlanDefinition (FHIRPath condition
                         # *and* action.code), the app, and the CQL's
                         # ReassessmentIntervalDays. Also that the tiers deliberately
                         # left out (imminent, no-risk) stay out — an interval
                         # appearing for `imminent` would answer an open clinical
                         # question by accident
npm test                 # vitest
npm run check:outputs    # ⚠️ LAST, and after `npm test` on purpose — see below
npm run check:published-profiles  # ⚠️ same, and the complement — see below
```

## `check:outputs` — the producing half of a tool's contract

The only gate in `verify` that runs **after** the tests, because the tests are
what produce its input.

SPiER declares both halves of what a tool does, in FHIR:
`ActivityDefinition.relatedArtifact` names the Questionnaire it **consumes**,
and `PlanDefinition.action.output` names the type + profile it **produces** —
40 entries across the stage PlanDefinitions, 39 with a profile. `check:catalog`
has resolved the consuming half both ways since 2026-08-20. The producing half
was related to nothing at all until 2026-09-17, and **three tools were wrong as
a direct result**: #211 (TL-010 caring contacts), TL-009 and TL-013. All three
emitted a Communication with no `meta.profile`, so the measures that filter on
those profiles matched none of it.

⚠️ **TL-009 is the one to keep in mind, because it failed QUIETLY.** Its profile
is the index event for every post-transition measure, but `transitionDates` also
counts the TL-030 packet — which *does* claim its profile — so the measure family
stayed computable for any patient who had one, and three demo scenarios carry a
hand-authored handoff with the profile stamped on it. Half-blind is much harder
to notice than blind, and every gate was green throughout.

Four rules:

1. **DECLARED** — every tool the app can launch a recorder for (its launch path
   lands on a `TOOL_VIEWS` slug) declares at least one output profile. Its
   allowlist is **empty**, which is the only kind that cannot go stale. Its first
   run found TL-005: the BSSA action's own description named
   `SPiERBSSADispositionResult`, the comment above it called BSSA "fully
   FHIR-modelled", `bssa.fsh` had published the profile — and the `output` block
   was never written. Prose and structure disagreed and nothing compared them.
2. **CLAIMED** — every declared output profile appears as `meta.profile` on a
   resource in `.runtime-fhir`.
3. **TYPED** — and on a resource of the declared `type`. Zero violations today;
   it exists because `Condition/spier-cams-suicide-driver` is the one non-
   Observation instrument output, and a mapper returning it as an Observation
   would satisfy rule 2 while producing something no consumer expects.
4. **The allowlist expires** — an `UNCLAIMED` entry naming a profile nothing
   declares any more, or one the app has started claiming, or one whose reason is
   too short to be a reason, all fail.

⚠️ **Its load-bearing rule is that rule 2 reads the EMITTED CORPUS, not the
source.** `.runtime-fhir` is what `runtimeFhir.emit.test.ts` produces by
running every production builder — the same tree `validate-fhir.mjs --also`
checks. **A lexical scan would have passed the TL-009 defect**:
`spier-safety-handoff` appeared in `packages/core/src` the entire time it was
broken, in `measures.ts`, as the constant a filter *read*. "The canonical appears
in the source" and "something writes it" are different questions and only the
second is the invariant. The failure message still consults the source, but only
to tell the reader *which* of the two shapes they have.

That choice is also why the gate runs last, and why it fails rather than skips
when `.runtime-fhir` is missing or **older than the newest file under
`packages/core/src/lib` or either app's `src/lib`**. A stale emitted tree is the false
green it is most exposed to: the directory exists, the read succeeds, and every
answer describes a build nobody has. (The staleness test is an mtime comparison,
so it is a heuristic — it catches the developer who edits a builder and re-runs
the gate alone, which is the realistic case.)

⚠️ **Its `UNCLAIMED` allowlist is empty, and that is a result rather than a
starting condition.** It held twelve entries for about an hour on its first day:
every instrument Observation profile plus the CAMS suicide-driver Condition,
under one shared reason — `makeObservation` stamped no `meta.profile` on
anything, so ~80 of the Observations the app emits validated against base
`Observation` while twelve published profiles asserted constraints nothing
checked. **Writing the exemptions down is what made the size of the hole
legible**; the factory was threaded with a `profile` param the same day, which
turned the validator on over 28 more resources and immediately found two real
defects in `camsSectionB` (an id containing `#`, and a `Condition.derivedFrom`
R4 does not define) on a code path that had shipped unvalidated for months. So
before adding an entry, check that it is not simply a builder nobody has asked
to stamp.

**What it cannot see**, in rough order of how much it matters:

- **Only what the emitter exercises.** A builder `runtimeFhir.emit.test.ts` does
  not call looks unclaimed. That is deliberate — such an output is unvalidated
  too — but it means the gate's reach is the emitter's reach. Two things hold
  that reach open: the emitter's families list is an exact `toEqual`, and its
  **`covers every mapper in the registry`** test names every canonical in
  `MAPPED_QUESTIONNAIRE_URLS` rather than counting resources. The second was
  added when this gate showed that the demo scenarios covered nine of fourteen
  mapped instruments — a count would not have noticed, since there were 116
  Observations either way. The emitter now also derives from the IG's own
  example QuestionnaireResponses, which are hand-authored but validated by the
  IG build, which is exactly the property #263's bad fixture lacked.
- **The profile canonical, not conformance.** A resource can claim a profile it
  violates; `validate-fhir.mjs --also .runtime-fhir` is what catches that,
  and only if the claim is there to validate against.
- **Right profile, wrong content.** A handoff with an empty content checklist is
  conformant, countable, and says nothing travelled with the patient.
- **Tools whose output is not written by a recorder** — a CDS service or a
  background job is out of scope, because scope is "has a `TOOL_VIEWS` slug".


## `check:published-profiles` — the complement, from the other end

`check:outputs` starts from what a tool **declares** — a
`PlanDefinition.action.output` — and asks whether the app emits a resource
claiming it. That is the right question for a tool whose recorder drifted from
its own IG page, and it is structurally blind to a profile **no tool declares**.
The IG can publish one, the app can never write one, and there is nothing to
compare.

⚠️ **The gap was real when this gate was written.**
`spier-suicide-risk-concept` is published, is read by a Stage-8 measure
(`measures.ts`: `conformsTo(o, RISK_CONCEPT_PROFILE)`), and is claimed by
**nothing the app emits** — the only two instances anywhere in the repo are
hand-authored entries in the demo scenarios. So the measure computes a number
off seeded fixtures and would report **zero** in a real deployment. TL-009's
shape one layer up.

⚠️ **`validate-fhir.mjs` cannot cover this either**, for the reason
[`fhir-conformance.md`](fhir-conformance.md) gives: a validator checks a
resource against the profiles it CLAIMS, so a profile nothing claims is never
the subject of a check. Publishing more profiles can never fail that gate.

So this gate starts from the published set: every `kind: resource`,
`derivation: constraint` StructureDefinition is claimed by something in
`.runtime-fhir`, or is named in `EXEMPT` with a reason. It runs after
`npm test` for the same reason `check:outputs` does — the tests produce the
corpus.

**`EXEMPT` expires.** An entry whose profile turns up in the corpus fails, so a
fixed gap deletes its own exemption instead of leaving a stale claim that the
app does not write something it now does. An entry naming a profile the IG no
longer publishes fails too.

Two entries at the time of writing, and they are different kinds of thing:

| Entry | Kind |
|---|---|
| `spier-suicide-related-condition` | a **decision** — writeback Tier 3, default off; SPiER proposes the problem-list entry through a CDS card and a clinician asserts it |
| `spier-suicide-risk-concept` | a **debt**, written down so it is legible rather than silent |

⚠️ **What it cannot see.** It checks a profile is claimed *at all*, not that
every builder which ought to claim it does. Four C-SSRS variants sit behind one
profile, and it would notice nothing if three stopped stamping —
`check:outputs` has the same blind spot from the other direction. Neither is a
substitute for the validator.

⚠️ **It does not re-check corpus freshness.** `check:outputs` already asserts
`.runtime-fhir` is newer than the builders that produce it, runs in the same
`verify`, and fails the run first. A second copy of that logic would drift from
the first.

## The clinical surface (in the CI build job, not in `verify`)

```
npm run build:clinical   # VITE_SURFACE=clinical → dist-clinical/ (src/lib/surface.ts)
npm run check:surface    # both bundles exist; every derived marker — the guide pages' chunks,
                         # the "/guide" and "/overview" route literals, the demo patients'
                         # display names — is ABSENT from the clinical bundle AND PRESENT in
                         # the demo bundle
```

⚠️ It reads build output, so it cannot live in `verify`, and it FAILS rather than
skipping when a bundle is missing. The both-ways check is the load-bearing half:
a marker the demo bundle lacks has stopped matching, and a clean clinical bundle
over it proves nothing. Two things its plants taught (2026-09-15): its first
markers — the guide section segments and the patient ids — were things the app
spells elsewhere (`pathway` is a route under `/patient`; `patient-001` is a
localStorage migration key), so the markers are names and route roots; and its
first page list came from the `IS_DEMO ? lazy(` guards, so a page that LOST its
guard dropped out of the list it was checked against and the planted defect
passed. The list now comes from the guide sections and the route table — from
something the defect cannot change — with a source-level check that names the
line. See `docs/plans/surfaces-and-distribution.md` §3.

## Per-source liveness floors

`scripts/lib/floors.mjs` — `reportFloors(entries, fail)`. Nine gates call it, and
each prints `scanned <source>: <dimension> N (floor M)` on every run.

**Why, in one sentence:** #500 proved that a gate whose tree is *gone* goes red
(after three fixes), and nothing was watching for a tree that is merely
*smaller* — which is the likelier accident and reads identically in the output.
`validate-fhir` printed `0 unwrapped from the population scenarios` and passed;
it would equally have printed `3` and passed.

The convention is `check-codings.mjs`'s, copied rather than re-derived, and the
reasoning for each rule is in that file and in `floors.mjs`:

1. **Per source AND per dimension — never a single total.** A global floor was
   check-codings' first attempt and testing found the hole in it. #236 then found
   the same hole one level down. A guard with a blind spot shaped like the thing
   it guards is the recurring failure here.
2. **Roughly half the real count, rounded down.** A floor proves *liveness*, not
   completeness: deleting things is allowed to lower the count.
3. **Floors go stale upward and nothing re-checks them** (#43/#232). `reportFloors`
   prints a `⚠ floor is now under 1/4 of the real count` note when it detects
   this. Deliberately a note, not a failure — a stale floor is weak, not wrong,
   and failing a green build over one teaches people to raise floors without
   thinking.

⚠️ **A floor's `source` label must name the directory the gate actually reads.**
`check:crosswalk`'s was first written as `fhir-artifacts/generated` — the tree the
other artifact gates read — when it in fact reads `ig/fsh-generated/resources`.
Thinning the labelled tree to one file left the gate reporting six and passing.
A floor whose label names the wrong tree is worse than no floor, because the next
person reads the label rather than the `genDir` twenty lines above it.

⚠️ **A floor is the last line, not the first.** Shrinking `observationMappers`
trips `check:readers`' own "mapper serves no Questionnaire" error before the floor
is reached, and that is the better outcome — a named error beats a count. Floors
catch what the specific checks cannot see.

## App source roots — the `apps/` split's tripwire

`scripts/lib/app-roots.mjs` — `appRoot(source)`, `appRootFloors()`. Six
gates in `verify` call the second; ten call the first.

It is [`style-roots.mjs`](../../scripts/lib/style-roots.mjs)'s rule applied
to the `.ts`/`.tsx` trees, and written **before** the accident rather than after
it. That module exists because `packages/ui` was carved out of `web/src` and
four CSS gates went green while dropping a quarter of their input. The `apps/`
split (`docs/plans/repo-and-package-boundaries.md`) is the same move an order of
magnitude larger: `web/src` becomes `apps/guide/src` and `apps/clinical/src`,
and **ten gates named `web/src` by path**, every one of which would then read one
tree of two — or none — and print ✓.

Two parts, and they answer different questions:

1. **A per-root floor**, `scripts/lib/floors.mjs`'s convention unchanged. It
   answers *is this declared root still producing files*.
2. **A filesystem scan that hard-fails**, not a floor. It answers *is a root
   missing* — which part 1 structurally cannot, because it would be asking the
   very list the defect edited. `style-roots.mjs` records planting exactly that
   (dropping `packages/ui` from `STYLE_ROOTS`) and watching two gates stay green.

⚠️ **The discovery key is an entry module — `src/main.tsx` or `src/App.tsx` —
and not a `src` glob.** `packages/core/src` and `packages/ui/src` hold plenty of
`.ts` and `.tsx` and are legitimately not app trees, so a glob would either drag
them in or need an exclusion list, and an exclusion list is one more thing a
move can quietly edit. An application cannot avoid having an entry module, which
is the property the check needs: *the list must come from something the defect
cannot change.*

**Proven red on 2026-09-19**, each plant alone, before the gate was trusted:

| Plant | Result |
|---|---|
| `apps/guide/src/App.tsx` exists, undeclared | all five wired gates RED, naming the tree |
| same, via `main.tsx` instead | RED |
| same tree with no entry module (`helper.ts` only) | PASS — correctly not an app tree |
| the root declared in `APP_ROOTS` | PASS, and the new root's count printed |
| `floorSrc` raised above the real count (a partial move) | RED on the floor |
| the guide's import-graph walk narrowed to nothing | RED — 47 modules → 9, which previously printed ✓ |
| `check:surface-links`' `resolveSpec` narrowed | RED — 89 modules → 1 |
| `APP_ROOTS` renamed without updating callers | `appRoot()` THROWS, naming the declared set |

⚠️ **What it did not do at first.** The gates were wired to *a* declared root
(`appRoot('web/src')`) and did not yet walk *every* root; since the `apps/`
split (#552) they iterate `APP_ROOTS` with a per-root floor. That staging was
deliberate —
today there is one tree, so walking it is identical behaviour, and the hard
failure above guarantees the generalization cannot be skipped: the moment a
second app tree exists, six gates go red until someone deals with them. The
per-gate walk is generalized when there is a second tree to walk, not before.

⚠️ **`check-fhir-render.mjs`'s `NOT_A_RESOURCE_VIEW` keys are root-relative**
(`pages/CdsServiceGuide.tsx`), as are `check-page-template.mjs`'s. Two roots
means two files can share a key. Make those keys repo-relative in the same
change that adds the second root, or an exemption written for one app will
silently exempt the other's file of the same name.

## `check:tool-view-routes` — one definition, now checked across every app

The 18 instrument fillers and 11 workflow recorders are ONE element definition
rendered by two route families. CLAUDE.md has always stated the rule and the
reason — *"two copies drift on a `persistName` and the guide then documents a
resource the app does not write."*

⚠️ **It used to be a test, and the test's shape was about to become wrong.**
`toolViews.test.ts` sat beside the map and read `../App.tsx` by relative path.
Both premises died with `packages/tool-views`: the map is no longer beside the
route table, and the `apps/` split turns one route table into one per app. A
relative `../App.tsx` is not merely a stale path — it is a check that **can only
ever see one table**, while the invariant is *every* table. A second app could
route to a key that does not exist and the suite would stay green.

So it became a gate, reading the app roots from
[`lib/app-roots.mjs`](../../scripts/lib/app-roots.mjs). It walks every
declared root's `App.tsx`, so the second app is checked the day it is declared —
and that declaration cannot be quiet, because an undeclared app tree is already a
hard failure.

Five rules: a route's key is defined; the key equals the route's last segment (or
the guide's tool page resolves a launch path to no form while the clinician's
form works); no view goes unrouted by *every* app; no key defined twice; and
`isToolViewSlug` uses `hasOwnProperty` rather than `in`, which answers yes for
`toString` and hands the tool page a function to render.

It reads both files as TEXT, for the reason `lib/route-table.mjs` documents:
importing `toolViews.tsx` pulls in the questionnaire registry, the care-plan
mappers and the whole tool catalog — a 30-second SUSHI compile before the gate
could answer a purely structural question.

**Proven red, each plant alone:**

| Plant | Result |
|---|---|
| a route looks up a key the map does not define | RED, naming the blank page |
| a key that is not its route's last segment | RED, naming the launch-path segment the tool page cannot resolve |
| a view no route renders | RED |
| `hasOwnProperty` replaced by a bare `in` | RED |
| the map reformatted so the key reader matches nothing | RED (29 keys "undefined") |
| the anchor the slice ends at renamed | RED — *"fix the reader, not the callers"* |
| **a SECOND app root whose table has a typo'd key** | RED, having read 31 lookups across 2 tables |

⚠️ **What it cannot see: whether the view is the RIGHT one.** A route may look up
a key that exists and render a recorder for a different instrument; the strings
agree and this says nothing. `check:outputs` is what ties a slug to what it
actually emits.

⚠️ **An app that renders no tool views is skipped, not failed** — the population
dashboard is a legitimate example. The per-app lookup counts are printed so a
table that silently stopped matching is visible, and the floor is on the total.

## What the `packages/tool-views` extraction cost, and what caught it

The move was run against captured `main` baselines, per this file's own rule.
**Four gates lost coverage. Two failed loudly; two passed.**

| Gate | On `main` | After the move | Caught by |
|---|---|---|---|
| `check:fhir-render` | 11 recorders, 149 JSX runs | **threw** | its own `recorders.length === 0` guard |
| `check:template` | 2 form views, 11 recorders | **3 failures** | its two `length === 0` guards |
| `check:fhir-r5` | 1 `fhirVersion` prop | **failed** | its `versionProps === 0` guard |
| `check:guide-boundary` | 47 modules reached | **20** | ✓ **passed** — floor 20, by equality |
| `check:surface-links` | 89 modules reached | **61** | ✓ **passed** |

The three that failed were built with a "found nothing" guard and it worked
exactly as designed. The two that passed are the lesson:

⚠️ **Both carried their own relative-only `resolveSpec`.** An `@spier/…` import
was not followed, so each walk simply stopped at the new package boundary. For
`check:guide-boundary` that is the whole claim — *"holds no patient data, checked
TRANSITIVELY"* — and a `@spier/…` import is exactly how a guide page would reach
a fixture now. It would have reported a clean guide having never opened the tool
views. The floor caught it only by **equality**, which is luck, not design.

The resolver is now declared once in
[`lib/module-graph.mjs`](../../scripts/lib/module-graph.mjs) and understands
`@spier/<pkg>/…`, derived from the filesystem rather than typed.

⚠️ **And it turned out both gates had been under-reading all along.** With
`@spier/…` followed, the graphs went to **150** and **210** — they had never
walked into `packages/core` either, since the day it was extracted. A
pre-existing hole that only became visible because something else broke next to
it.

⚠️ **`check:surface` reported a clean surface over builds that had just
failed.** It asserts both `dist` directories exist, not that they are fresh, so
it read output from the previous run. `check:outputs` guards its corpus with an
mtime comparison for exactly this reason; `check:surface` does not, and that gap
is unclosed.


## Notes moved from `CLAUDE.md`'s verify list (2026-09-20)

`CLAUDE.md` keeps one line per command. These are the paragraphs that used to
sit beside those lines.

### `npm run lint` — type-aware, and `--max-warnings 0`

⚠️ `recommendedTypeChecked`, not `recommended`: the untyped set has no types,
so it cannot see an `any` at all — `qr.item[0].answer` on an untyped value is
three member accesses it has nothing to say about. The `no-unsafe-*` family,
`no-floating-promises` and `no-misused-promises` all need the checker, and
those are the ones that catch a FHIR payload reaching a writer unchecked.

⚠️ **`project:` globs, NOT `projectService: true`.** The service form resolves
the closest `tsconfig.json`, which at the root is the SOLUTION file
(`files: []` + references) — so files fell back to an inferred program with no
`types`, and the linter saw ERROR TYPES. That is worse than not running:
`no-unsafe-*` fires spuriously on them, and `no-unnecessary-type-assertion`
AUTOFIXED AWAY a needed assertion in
`tests/patientPathway.stageResolution.test.ts`, which only `tsc` then caught.
The globs name the six real projects, so every file lints against its own
`tsconfig.json`.

⚠️ `--max-warnings 0` because eslint EXITS ZERO on warnings, so a rule
configured as a warning never failed `verify` or CI — it printed.
`react-hooks/exhaustive-deps` is a warning in the preset, and it had been
printing.

⚠️ Tests turn OFF three rules, and each is a judgement rather than an exemption
taken to reach green: `no-non-null-assertion` (in a test `x!` against a fixture
IS the assertion), `require-await` (an `async` test body with no `await` is a
common and harmless shape), `unbound-method` (`expect(mock.fn)` is how vitest
is used). A fourth would want a reason of the same kind.

### `npm run check:favicons`

⚠️ A favicon is its own document and cannot read a `var()`, so its six colours
are necessarily a hand-duplicated copy of the palette — which is exactly why it
is gated. The icons in `public/` are GENERATED from `--brand-primary` and
`--brand-gradient-1…5` by `scripts/build-favicons.mjs` (`npm run
build:favicons` rewrites them). The 2026 redesign would otherwise have left a
raspberry icon nobody looks at.

### `npm run check:extract` — the third rule

⚠️ Every mapper's Questionnaire must be classified — in `EXPECTED`, or in
`NO_LITERAL_EXTRACTS` with the reason. Absence from the hand list used to mean
"checked and empty" and "never opened" indistinguishably, and four of fourteen
mappers were in the second state.

### The app roots (`scripts/lib/app-roots.mjs`)

⚠️ `check:guide-boundary`, `check:surface-links`, `check:fhir-render`,
`check:template`, `check:fhir-r5` and `check:outputs` no longer name an app
tree themselves — the root comes from `scripts/lib/app-roots.mjs`, the
`.ts`/`.tsx` twin of `style-roots.mjs`. Ten gates hardcoded `web/src`, and the
`apps/` split turned one tree into two. Same two-part rule as the style roots:
a PER-ROOT floor, plus a filesystem scan that HARD-FAILS on an app tree no root
declares — keyed on `src/main.tsx` or `src/App.tsx`, because an app has an entry
module by construction and a bare `src` glob would drag in `packages/core` and
`packages/ui`. The floor cannot see a root deleted from the list; the
filesystem can.

### `npm run check:tool-view-routes`

⚠️ Replaced the `App.tsx` half of `toolViews.test.ts`, which read `../App.tsx`
by relative path — a shape that can only ever check ONE table, while the
invariant is every table. Iterates the roots in `lib/app-roots.mjs` instead.

### `npm run check:eager-forms`

⚠️ Every tool view was already `lazy()` when the 18 Questionnaires were IN the
entry chunk — laziness of the component is not the property that matters,
because `App.tsx` imports `TOOL_VIEWS` statically and an eagerly-imported map's
CONTENTS are eager whatever they render. So this walks STATIC imports only (not
`module-graph.mjs`'s reader, whose pattern also matches `import(`) from every
declared app entry. Worth ~23.8 KB gzip off first paint on both surfaces.

⚠️ Its first version stripped block comments before line comments, and
`/patient/*` in `App.tsx`'s own prose opened a fake block comment that
swallowed the one import it polices — it walked 104 modules and said ✓.

### `npm run check:surface-links`

⚠️ A different question from `check:surface`, which reads the two BUNDLES and
asserts what is compiled in. A component that ships on both surfaces can still
link into a demo-only route: `PatientPathway` did, twice, one of them the
embedded panel's only navigation. It does not 404 — the `*` catch-all returns
the clinician to the patient record, silently. `check:catalog` resolves paths
against the WHOLE route table, so it passed this and always would have.

⚠️ **It walked only the clinical app until 2026-09-20, and the same defect
shipped from the other direction.** The apps split (2026-09-19) took every
`/patient/*`, `/population/*` and `/settings` route out of the guide, and every
link into them — 33 launch buttons on Tools, 34 rows on Adoption Readiness,
"View in chart" after every submit, the recorders' cross-links, the try page's
up-link, seven redirects — fell to the guide's catch-all and landed on the
Overview. The gate printed ✓ because the guide was not its subject. It now
walks BOTH apps from their own `App.tsx` against their own tables, and reads a
fourth literal form, any object property ending in `href`/`Href`. That form
exists because of the fix: the 29 shared tool views hold no route literal any
more — each app declares its routes for them in a `SurfaceLinks` object
(`packages/tool-views/src/context/SurfaceLinksContext.ts`;
`apps/clinical/src/surfaceLinks.ts`, `apps/guide/src/data/surfaceLinks.ts`),
whose `href:`/`chartHref:`/`registryHref:` literals are what the gate checks on
that app. A redirect into the other app is a cross-origin hop
(`apps/guide/src/components/ClinicalRedirect.tsx`), not a `<Navigate>`. Proved
red three ways before trusting: a guide page linking `/settings`, a guide
`<Navigate>` into `/population/measures`, and a clinical `chartHref` pointing at
`/guide/tools` ([`docs/plans/adoption-guide-ux-audit-2026-09-20.md`](../plans/adoption-guide-ux-audit-2026-09-20.md) §1.1).

### A green `check:*` is not proof of coverage

⚠️ Each gate has a rule it cannot see, and several were shipped in a form that
passed a planted defect. Read the gate's own section here before adding one,
changing one, or concluding that something is covered — and plant a defect
before trusting a new rule ([`README.md`](README.md) § *The rule that produced
all of it*).

## `check:dupes` — no function is defined twice (2026-09-20)

The 2026-09-20 audit found `displayFor` byte-identical in four modules,
`stageTag` in five (four identical, one drifted to a hand-typed display),
`effectiveOf` in two that disagreed about `effectivePeriod.start`, `toggle` in
two views and `InclusionBadge` in both apps — none of it found by a tool,
because each stage's builders were written in their own PR and copied the
neighbour's helpers. `scripts/check-duplicate-code.mjs` parses every top-level
`function` and `const f = (…) => {…}` in non-test source under `apps/`,
`packages/` and `services/` and holds four rules: the same NAME with the same
normalized body in two files fails; the same body of five or more lines under
DIFFERENT names fails; a deliberate same-name pair is listed in `ALLOWED` with
its reason (the two `describeError`s, which differ on purpose; the per-app
`Sidebar`, `AppRoutes` and `RouteFallback`), and an entry whose pair has
merged or vanished fails as stale; and a floor of functions, files and areas
parsed, so a broken parser cannot report ✓.

⚠️ **Two parser defects were caught by the gate's own liveness rules before it
was trusted.** The first version matched the body brace as "the first `{` after
the function head", which for `Sidebar({ isOpen, onClose }: Props)` is the
destructuring pattern — so both apps' Sidebars (239 and 73 lines) compared
"identical", and the stale-`ALLOWED` rule fired on a pair it thought had
merged. The second treated every quote as a string delimiter, so an apostrophe
in JSX prose (`SPiER's`) swallowed the rest of `App.tsx` and both route tables
left the scan; the stale-`ALLOWED` rule fired again, this time on pairs it
could no longer see. A quote after a word character is not a delimiter now.

⚠️ **Its first green run was not its first finding.** The moment both
`App.tsx` files parsed, it reported `RouteFallback` byte-identical in the two
apps — a component the audit had listed as a deliberate per-app pair, and which
turned out to be a plain copy whose one stylesheet rule already lived in
`packages/app-shell`. It lives there now. The two `AppRoutes` and the two
`Sidebar`s remain deliberately separate, and their bodies differ, which is what
the `ALLOWED` liveness rule checks.

What it cannot see: a copy edited after copying (a fork — only a reader can
tell a fork from a variant), a duplicated fragment inside a larger function,
and an arrow assigned to an object property rather than a top-level binding.
