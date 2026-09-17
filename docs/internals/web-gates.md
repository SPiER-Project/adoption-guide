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
npm run check:extract    # observation-extract validation
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
```


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
