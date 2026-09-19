# The `web/` verification gates

What `npm run verify` runs, what each gate's load-bearing rule is, and what it
cannot see.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

In `web/`, the one-shot entry point is **`npm run verify`** — it runs copy-fhir (forced), typecheck, both linters, every `check:*` drift gate listed below, and the unit tests in sequence. (**Deliberately not a count.** This line said "eleven" while `verify` ran fourteen, because a pinned number goes stale silently on every gate added — the same failure as a stale `check:codings` floor in #232. If you add a gate, add it to this list; there is no number to bump.)

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
                       # `docs/plans/production-clinical-surface.md`, which was built by
                       # listing the viewer's call sites. This derives the list instead: a
                       # non-test `.tsx` under `web/src` that serializes to JSON or renders a
                       # `<pre>` must call `useInspect()`, or carry an entry in
                       # NOT_A_RESOURCE_VIEW saying why it is not one.
                       # ⚠️ **The rule is FILE-LOCAL, and the reachability version does not
                       # work.** Walking the non-guide routes the way `check:guide-boundary`
                       # walks the guide's reaches `QuestionnaireView`, `WorkflowForm`,
                       # `CarePlanDisplay` and `FhirJsonViewer` itself — all four are ONE
                       # implementation rendered by both `/patient/assessments/*` and
                       # `/guide/tools/:slug/try`. The audience is a property of the render,
                       # not of the module graph, which is the same reason `InspectContext` is
                       # a context and not a prop.
                       # ⚠️ Three things it cannot see, one of them proved by planting:
                       # a file that calls `useInspect()` and ignores the answer PASSES
                       # (disconnecting CarePlanDisplay's three `inspect &&` guards while
                       # leaving the hook call was green); a dump assembled in a `.ts` helper
                       # and rendered by a `.tsx` that never writes `JSON.stringify`; and a
                       # resource rendered without being serialized at all — a table over
                       # `Object.entries(resource)`, a `<code>` holding a coding; and an
                       # UNGUARDED WRAPPER around FhirJsonViewer, which has a live instance:
                       # ToolDetail wraps its examples in a <section> with a heading and calls
                       # no useInspect(), so outside the guide it would render a heading over
                       # nothing. Safe only because its one caller is a guide page (#527).
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
                         # layer down — a Questionnaire in FHIR-Resources/ that
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
                         # the same `web/scripts/lib/stage-codes.mjs` that `check:stages`
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
   resource in `web/.runtime-fhir`.
3. **TYPED** — and on a resource of the declared `type`. Zero violations today;
   it exists because `Condition/spier-cams-suicide-driver` is the one non-
   Observation instrument output, and a mapper returning it as an Observation
   would satisfy rule 2 while producing something no consumer expects.
4. **The allowlist expires** — an `UNCLAIMED` entry naming a profile nothing
   declares any more, or one the app has started claiming, or one whose reason is
   too short to be a reason, all fail.

⚠️ **Its load-bearing rule is that rule 2 reads the EMITTED CORPUS, not the
source.** `web/.runtime-fhir` is what `runtimeFhir.emit.test.ts` produces by
running every production builder — the same tree `validate-fhir.mjs --also`
checks. **A lexical scan would have passed the TL-009 defect**:
`spier-safety-handoff` appeared in `packages/core/src` the entire time it was
broken, in `measures.ts`, as the constant a filter *read*. "The canonical appears
in the source" and "something writes it" are different questions and only the
second is the invariant. The failure message still consults the source, but only
to tell the reader *which* of the two shapes they have.

That choice is also why the gate runs last, and why it fails rather than skips
when `web/.runtime-fhir` is missing or **older than the newest file under
`packages/core/src/lib` or `web/src/lib`**. A stale emitted tree is the false
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
  violates; `validate-fhir.mjs --also web/.runtime-fhir` is what catches that,
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
`web/.runtime-fhir`, or is named in `EXEMPT` with a reason. It runs after
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
npm run build:clinical   # VITE_SURFACE=clinical → web/dist-clinical/ (src/lib/surface.ts)
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

`web/scripts/lib/app-roots.mjs` — `appRoot(source)`, `appRootFloors()`. Six
gates in `verify` call the second; ten call the first.

It is [`style-roots.mjs`](../../web/scripts/lib/style-roots.mjs)'s rule applied
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

⚠️ **What it does not do yet.** The gates are wired to *a* declared root
(`appRoot('web/src')`); they do not yet walk *every* root. That is deliberate —
today there is one tree, so walking it is identical behaviour, and the hard
failure above guarantees the generalization cannot be skipped: the moment a
second app tree exists, six gates go red until someone deals with them. The
per-gate walk is generalized when there is a second tree to walk, not before.

⚠️ **`check-fhir-render.mjs`'s `NOT_A_RESOURCE_VIEW` keys are root-relative**
(`pages/CdsServiceGuide.tsx`), as are `check-page-template.mjs`'s. Two roots
means two files can share a key. Make those keys repo-relative in the same
change that adds the second root, or an exemption written for one app will
silently exempt the other's file of the same name.
