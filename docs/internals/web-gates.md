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
npm run lint:css       # stylelint (design-token enforcement), via scripts/lint-css.mjs over
                       # every STYLE_ROOTS tree — not a second glob in package.json — and
                       # only foundation.css may disable it beyond one line. Functions are
                       # values (rgb(), max(), clamp() used to pass as tokens); see
                       # css-and-page-template.md § Design tokens only
npm run check:tokens   # every var(--token) resolves to a real definition — in the CSS AND
                       # in TypeScript (inline styles, SVG stopColor) since 2026-10
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
                       # inset, one owner of the page width, and density read from tokens
                       # only (RULE 7: no [data-density] selector outside foundation.css, no
                       # component reading it, every app's <html> setting a defined one).
                       # The header rules sweep EVERY component tree, an inset is padding
                       # or margin on any selector whose subject is the root, and a
                       # page-width token anywhere but a page root fails (RULE 5e) — five
                       # plants passed each of those before 2026-10
npm run check:prose    # the reading MEASURE — `--measure-prose`. Its five rules are each
                       # written against a defect that shipped: the token must be in `em`
                       # and in band (it was 760px, a width where a character count was
                       # meant); every other `max-width` / `max-inline-size` must be exactly the token, a page-width token or
                       # classified NON_PROSE with a reason (`.dd-detail` escaped a column
                       # budget to 52rem = 134 cpl under a comment claiming otherwise);
                       # a `max-width: none` must be declared (`.dd-cell-desc` carried a
                       # 46rem cap that a later `none` had always overridden); and an `em`
                       # cap must know what type it resolves against (`.tool-config-effect`
                       # sat at an inherited 16px while its paragraph was 14px); and RULE 5,
                       # a prose run is set at one of THREE roles — --type-lead, --type-running
                       # (the density's body size), --type-caption. RULE 4 asks whether a capped run declares a size, RULE 5 asks
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
                       # and rendered by a `.tsx` that never writes `JSON.stringify` (the
                       # bracket form `JSON["stringify"](…)` and a destructured `stringify`
                       # ARE matched since 2026-10-06 — the bracket form passed before); and a
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
                       # meanings. So it reads what TypeScript's parser says renders as
                       # WORDS: JSXText, and since 2026-10-07 every string attribute not on
                       # NOT_WORDS_ATTRS (title, label, help, …) — a recorder title, a field
                       # label and a list heading had named Appointment, Task and Consent past
                       # it, and past check:jargon's ALSO_ENGLISH carve-out. The resource-type
                       # match takes a plural (`s?`). The `fhirNote={…}` subtree and
                       # draft/draftTitle — the implementer's half, rendered inside the
                       # useInspect()-gated CodeDrawer — are skipped.
                       # ⚠️ **A word list could not have caught the field help**, so there the
                       # TAG is the rule: `caring-contact-opt-out` is a kebab-case slug and
                       # nothing tells it from "no-show follow-up" by spelling. What does is
                       # the element — a recorder reaching for `<code>` is quoting an
                       # identifier at someone who has no identifier to be shown. So a
                       # recorder view renders no `<code>` outside `fhirNote`.
                       # Six plants, the first two being the ORIGINAL text restored verbatim
                       # rather than a synthetic defect. ⚠️ What RULE 3 still cannot see: a
                       # resource type not on its 18-name list; a recorder built on some other
                       # frame than <WorkflowForm> (the detection THROWS on matching nothing,
                       # which is the half that is covered); the Questionnaire fillers, which
                       # render no lede; and non-FHIR jargon — "denominator", "SHALL", a bare
                       # "TL-032" were all fixed by hand in the same pass and none is gated.
                       # See `docs/internals/tool-views.md` §4
npm run check:ucum     # the UCUM shim is still safe: no quantities in the Questionnaires,
                       # and the shim still covers every method its consumers call.
                       # ⚠️ "No quantities" means EVERY expression in the resource — root
                       # `sdc-questionnaire-variable`, nested toggle expressions, a
                       # `questionnaire-constraint`'s `expression` sub-extension — not just
                       # `item.extension[].valueExpression`, which is all it read until
                       # 2026-10-06 (a root `toQuantity('mg')` passed). The UCUM method list
                       # is READ off the installed `UcumLhcUtils` class; the hand list it
                       # replaced named two methods that do not exist and missed three
npm run check:fhir-r5  # the R5-model shim is still safe: every fhirVersion is "r4",
                       # and the renderer still imports the specifier we alias.
                       # ⚠️ PARSED (2026-10-06): its regex counted QuestionnaireView's doc
                       # comment as a prop, so a spread `{...{ fhirVersion: 'r5' }}` replacing
                       # the real one passed. Every `<Renderer>` must carry one literal
                       # `fhirVersion="r4"` and no spread; Renderer used as a value, or
                       # `fhirVersion` anywhere but that attribute, fails
npm run check:crosswalk  # concept-crosswalk validation. A–C: ConceptMaps vs the tier and
                         # disposition CodeSystems; D/E: the `.fml` maps' tier literals and
                         # ConceptMap references; F: the mappers, RUN over the probe responses in
                         # scripts/lib/mapper-probes.mjs — every code emitted under a map's source
                         # system is in that CodeSystem, and every code the map translates is
                         # emitted by some mapper.
                         # ⚠️ Until 2026-10-06 D/E globbed `ig/drafts/`, emptied when the maps were
                         # promoted to `ig/input/resources/maps/` (a `'severe'` tier passed), and F
                         # grepped the mapper source for each code as a quoted literal (`asq.ts`
                         # emitting `'acute-pos'` passed — the right spelling was still in a
                         # comparison). ig.yml runs it `--static` (A–E): it builds no node_modules
npm run check:extract    # the SDC observationExtract contract, against what each mapper EMITS:
                         # every mapper in `MAPPER_BY_QUESTIONNAIRE_URL` is RUN (load-core) on a
                         # response endorsing every item; a declared extract code must come out of
                         # it, and an Observation it emits under one of the form's item codes must
                         # be declared or listed in COMPUTED with the reason. A Questionnaire-level
                         # observationExtract applies to every coded item, as in SDC.
                         # ⚠️ Rule 2 compared against EXPECTED, a hand copy of "the codes the mapper
                         # emits", until 2026-10-06 — `phq9.ts` emitting `44261-7` passed. That list
                         # is gone; the earlier hole it had (a Questionnaire absent from it was
                         # never opened — four of fourteen) is closed by running the registry.
                         # ⚠️ What it still cannot see: whether a declared extraction is the RIGHT
                         # one. `camsSectionA`'s seventh Observation re-codes the `6-score` answer
                         # under LOINC 93374-7 and is deliberately undeclared, because `$extract`
                         # yields ONE Observation per item; 93374-7 is not that item's code, so
                         # no rule reaches it
npm run check:core-boundary # packages/core stays React-free and DOM-free — the constraint
                         # that makes the boundary worth drawing. A feature-detected
                         # browser API (`typeof BroadcastChannel === 'undefined'`) is
                         # allowed — PER USE, in the same function — an unguarded one is
                         # not. `alert` is deliberately NOT forbidden: `RiskAlert` values
                         # are named `alert`.
                         # ⚠️ 2026-10-06: `globalThis.localStorage` passed (a dotted name
                         # was taken for a property), as did `react/jsx-runtime`, an
                         # `@spier/ui` import, and an unguarded `new BroadcastChannel`
                         # in a file that guarded one elsewhere. It now parses: host-
                         # qualified globals count, every React package and a relative
                         # path into one is forbidden, the guard waives only its own
                         # scope. 2026-10-07: core's tsconfig `lib` is `["ES2022"]` — a
                         # DOM TYPE (`HTMLElement`), `window` and `document` are now compile
                         # errors — and eslint has a core block (`no-restricted-globals` +
                         # `no-restricted-properties` on `globalThis`/`self`/`window`).
                         # ⚠️ @types/node still declares `localStorage` and `navigator`, so
                         # they COMPILE; and `const g = globalThis; g.localStorage` passed
                         # tsc, eslint AND this gate when planted. Closed the same day in
                         # this gate: a host is any name bound to one (to a fixed point),
                         # seen through casts, and destructuring a host is a use — seven
                         # alias forms planted red. Then the four it still missed — a host
                         # reached through a property, a call's return, `Reflect.get`, or a
                         # computed key: a host may not ESCAPE (passed, returned, stored,
                         # exported), a computed key on one fails, and so do `eval` and
                         # `Function(…)`. Still unseen: a global object an app passes INTO
                         # core as a parameter.
npm run check:guide-boundary # the Adoption Guide holds no patient data — it explains and
                         # configures the pathway; the caseload lives on the EHR side
                         # (#391). Walks the WHOLE guide app from main.tsx and fails on
                         # any RESOLVED file under packages/demo-population, however the
                         # import was spelled; its pages must reach no `*DataSource.ts`.
                         # ⚠️ 2026-10-06: it walked the PAGES only and matched specifier
                         # TEXT, so the roster imported in App.tsx and a relative path to
                         # patients.json both passed. ⚠️ The data-source half stays
                         # page-scoped: App.tsx mounts PatientProvider, which builds the
                         # unseeded localDataSource the guide's fillers write into, so the
                         # app reaches both data sources by design
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
                         # loudly — it goes missing inside the first one.
                         # Check C also holds a PINNED reference (`…/PHQ-9|1.0.0`, which every
                         # AD uses) to the Questionnaire's own `version` (2026-10-06): it stripped
                         # the pin, so a version bump left every AD naming a version that exists
                         # nowhere
npm run check:stages     # stage ids in population data vs canonical FSH stage list.
                         # ⚠️ scripts/lib/stage-codes.mjs strips FSH comments first (a
                         # block-commented stage was still "a stage" until 2026-10-06) and, when
                         # the compiled CodeSystem exists, must agree with it exactly
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
                         # and SUSHI reports 0 errors on it — proved by planting one.
                         # Rule (f), 2026-10-06: each tier branch's FHIRPath CONDITION tests its
                         # own tier, through a published extension. SPiER's runtime picks the
                         # branch by `action.code`, so `tier-low`'s condition rewritten to
                         # `= 'moderate'` passed this gate AND all of `npm test`; an engine
                         # running the published expression would have applied it to the wrong
                         # tier. Since 2026-10-07 the FSH writes code and condition from one
                         # parameter (`RuleSet: TierBranch`), so (f) now guards a branch that
                         # bypasses the RuleSet. And a definitionCanonical must resolve to an
                         # ActivityDefinition / PlanDefinition / Questionnaire, not merely exist
                         # Rule (g), 2026-10-09: the SETTING pathways (setting-pathways.fsh —
                         # emergency department, inpatient). The core lists each as
                         # relatedArtifact composed-of and each names the core as derived-from;
                         # the guide draws its list from the first, so the two must agree both
                         # ways. Each is held to (b)-(d) plus three of its own: a useContext
                         # VENUE; NO useContext focus — tools.ts derives a tool's stage from PDs
                         # with a stage focus, last reference winning, so a setting pathway with
                         # one silently moves every tool it names; and NO tier coding, because
                         # what each tier is owed is the core's branch alone. All six planted
                         # (dropped link, focus, tier code, dangling canonical, timing, no venue)
                         # went red. ⚠️ It cannot see whether a setting pathway's CONTENT is
                         # settled — the inpatient one is a draft awaiting clinical review, and
                         # that is page copy and an FSH comment, not anything a gate reads
npm run check:readers    # every observation mapper's answer READS vs the Questionnaire's
                         # declared item `type` — see fhir-conformance.md.
                         # ⚠️ And every `.answer` / `.value<Type>` access in a mapper must be one
                         # it can attribute — rooted at `walkItems(…)` or a const bound to one
                         # (2026-10-06). It only ever started FROM walkItems, so an
                         # `items.find(…)?.answer?.[0]?.valueBoolean` read (#327 again) or an
                         # answer stored in a local and read later was simply not seen
npm run check:careplan-readers # the SIBLING rule for carePlanMappers, and a different
                         # question: does the NESTING each reader walks match what the
                         # Questionnaire declares? `extractPairs` must name a `type: group`
                         # and `extractAnswer(s)` must name a leaf. #420 — `check:readers`
                         # scans only observationMappers, so #327's family recurred one
                         # directory over with no gate able to see it (#418/#419).
                         # ⚠️ It does NOT check that the readers still handle both response
                         # nestings: a static reader cannot tell a live branch from a dead
                         # one, and two planted defects proved it. That property is covered
                         # by the both-shapes cases in the mapper tests instead.
                         # A linkId is resolved against the form the mapper SERVES, from
                         # `CAREPLAN_MAPPER_BY_QUESTIONNAIRE_URL` in core (2026-10-06); resolved
                         # against all eighteen, Stanley-Brown reading CRP's `coping-list` passed
npm run check:patients   # the demo registry DERIVES from demo-population/src/patients/*.json
                         # (loaded through Vite; its ids equal the files' both ways — the
                         # derivation throws on a missing name/dob/gender/MRN or next step),
                         # and PatientProvider.tsx stamps MRNs with core's `MRN_SYSTEM`
                         # import, never a literal. 2026-10-07: the display copies in
                         # patients.json were deleted, and the field-by-field comparison
                         # with them. ⚠️ It was regex-scraped until
                         # 2026-10-06, and the regex fell through to BLANK_PATIENT's literal
                         # when the builder used a (mistyped) local constant
npm run check:scenarios  # BOTH halves of the population-scenario gate:
                         #  check-scenario-responses.mjs — QuestionnaireResponses vs their
                         #    Questionnaire (linkIds, nesting, answer options, ranges)
                         #  ⚠️ it FAILS an entry that is not a QuestionnaireResponse
                         #    (it skipped one until 2026-10-06, so a resourceType typo
                         #    dropped a patient's PHQ-9 from every gate and from the
                         #    emitter); it walks `answer[].item` as well as `item.item`;
                         #    and an item offering answerOptions takes one of them in
                         #    ANY value[x] — a valueString on a coded choice used to pass
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
                         #  ⚠️ and every in-scenario `reference` resolves (check 10):
                         #    any ref to a type the buckets hold must name a resource in
                         #    THIS scenario, any Patient ref this patient. Until
                         #    2026-10-06 only the subject, the encounter, the episode
                         #    trigger and walkthrough refs were resolved, so a dangling
                         #    `derivedFrom` or `context.related` passed — and the second
                         #    also slipped past the #303 rule above. The bucket table
                         #    comes from core (`PATIENT_SLICE_FHIR_BUCKETS`, typed
                         #    against PatientSlice), not a copy
npm run check:dates      # nothing that already happened is dated AFTER the START of
                         # the anchor day — a `fulfilled` appointment next week, a QR
                         # authored or a Procedure performed next month — and no date
                         # is written into prose. The Workers serve the scenarios
                         # `populationScenariosAsOf(today)` (packages/demo-population/
                         # src/scenarioDates.ts): every date moved by the whole UTC
                         # days since the anchor, so the anchor day IS today. Hence
                         # the start-of-day bound — a 09:30 QR on it was served in
                         # the future until 09:30 UTC, and dropped out of the measure
                         # period with it — and the prose rule: the shift moves
                         # strings that ARE dates, so "seen 2026-03-20" goes stale
                         # (three had, unnoticed, since the August re-date).
                         # ⚠️ It cannot see whether a patient still shows the STATE
                         # it was designed for — that is the reassessment math, and
                         # tests/scenarioDates.test.ts pins it for all 14 on any day.
                         # Four already differ from their design (001/003/006/008,
                         # since the row reads the harmonized tier). It reads the
                         # anchor and the shift through load-core, so it checks the
                         # shift the Workers serve with. Until 2026-10-06 it read
                         # the `responses` WRAPPERS rather than the QRs inside them,
                         # and so checked no QR date at all. Default is --check
                         # (writes nothing); `--apply` re-dates the FILES, now only
                         # to change a scenario's designed state
                         # (check:measures was here until 2026-10-07: its rules are
                         # tests in tests/measures.test.ts now — see measures.md)
npm run check:reassessment # the per-tier reassessment cadence agrees across all THREE
                         # places it is stated: the PlanDefinition (FHIRPath condition
                         # *and* action.code), the app, and the CQL's
                         # ReassessmentIntervalDays — compared in DAYS (the
                         # PlanDefinition's unit converted by core's UCUM_DAYS, the
                         # app's REASSESSMENT_INTERVAL_DAYS read directly, CQL
                         # comments stripped). Until 2026-10-06 it compared the raw
                         # value and never read the app, so `7 'wk'` passed and
                         # `1 'wk'` failed. Also that the tiers deliberately
                         # left out (imminent, no-risk) stay out — an interval
                         # appearing for `imminent` would answer an open clinical
                         # question by accident
npm test                 # vitest
npm run check:outputs    # ⚠️ LAST, and after `npm test` on purpose — see below. Both
                         # ends: declared outputs (part A) and published profiles (part B)
```

## `check:outputs` part A — the producing half of a tool's contract

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


## `check:outputs` part B — the complement, from the other end

⚠️ Parts A and B were two gates, `check:outputs` and `check:published-profiles`,
until 2026-10-07: they read the same corpus from opposite ends with two
readers, and only A checked the corpus was fresh. One file now, one read.

Part A starts from what a tool **declares** — a
`PlanDefinition.action.output` — and asks whether the app emits a resource
claiming it. That is the right question for a tool whose recorder drifted from
its own IG page, and it is structurally blind to a profile **no tool declares**.
The IG can publish one, the app can never write one, and there is nothing to
compare.

⚠️ **The gap was real when this gate was written.**
`spier-suicide-risk-concept` was published, was read by a Stage-8 measure
(`measures.ts`: `conformsTo(o, RISK_CONCEPT_PROFILE)`), and was claimed by
**nothing the app emitted** — the only two instances anywhere in the repo were
hand-authored entries in the demo scenarios. So the measure computed a number
off seeded fixtures and would have reported **zero** in a real deployment.
TL-009's shape one layer up. Its exemption expired on 2026-10-06, when
`riskConcept.ts` began deriving the concept from every instrument result.

⚠️ **`validate-fhir.mjs` cannot cover this either**, for the reason
[`fhir-conformance.md`](fhir-conformance.md) gives: a validator checks a
resource against the profiles it CLAIMS, so a profile nothing claims is never
the subject of a check. Publishing more profiles can never fail that gate.

So part B starts from the published set: every `kind: resource`,
`derivation: constraint` StructureDefinition is claimed by something in
`.runtime-fhir`, or is named in `EXEMPT` with a reason. Like part A, it
reads what `npm test` produces.

**`EXEMPT` expires.** An entry whose profile turns up in the corpus fails, so a
fixed gap deletes its own exemption instead of leaving a stale claim that the
app does not write something it now does. An entry naming a profile the IG no
longer publishes fails too.

One entry today, and it is a **decision**, not a debt:
`spier-suicide-related-condition` — SPiER prompts the problem-list entry through
a CDS card and the clinician asserts it; the app writes none (the writeback's
Tier-3 Condition proposal was retired by #639).
(`spier-suicide-risk-concept` sat beside it as a debt until it expired, above.)

⚠️ **What it cannot see.** It checks a profile is claimed *at all*, not that
every builder which ought to claim it does: three C-SSRS mappers sit behind one
profile, and with one of them unstamped both parts stay
green — and so does the validator, which never checks a profile nothing claims.
That case is held by the EMITTER instead: `runtimeFhir.emit.test.ts` asserts,
per response, that the results derived from it claim every Observation/Condition
profile its PlanDefinition action declares (joined per ActivityDefinition, read
off the generated wiring). Planted 2026-10-06: `cssrsFull.ts` unstamped → both
gates green, that test red.

**Corpus freshness is checked once, for both parts.** It used to live in part
A alone, and B relied on running after it in `verify`; run on its own, B read a
stale tree without complaint.

## The clinical surface (in the CI build job, not in `verify`)

```
npm run build:clinical   # VITE_SURFACE=clinical → dist-clinical/ (apps/clinical)
npm run check:surface    # both bundles exist AND are newer than their sources; every derived
                         # marker — the guide pages' chunks, the "/guide" and "/overview" route
                         # literals — is ABSENT from the clinical bundle AND PRESENT in the guide
                         # bundle; no demo patient's display name and no scenario resource id is
                         # in either
```

⚠️ **Names alone missed a whole record (2026-10-06).** The scenario files carry
each patient's resources and no display name, so importing
`scenarios/patient-001.json` into a guide page shipped that record in the guide
bundle with this gate (and `check:guide-boundary`) green. The 190 scenario
resource ids are now markers too.

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

`scripts/lib/floors.mjs` — `reportFloors(entries, fail)`. Most gates call it (not a
count — "nine" went stale at twenty-two), and
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

## Gates read core's values, not its source — `scripts/lib/load-core.mjs` (2026-10-06)

`loadCore(ids)` loads `@spier/*` TypeScript modules into a plain Node gate
through the repo's own `vite.config.ts` — aliases, `import.meta.glob`, JSON
imports — with Vite's SSR loader. No new dependency, and the same resolution the
apps and the tests get.

**Why:** `packages/core` reads the generated artifacts with `import.meta.glob`,
so plain Node could not import it, and every gate that needed a value from core
scraped the `.ts` with a regex or kept a hand copy "in sync". Each scrape then
needed a guard against its own parser — a zero-parse check, a raw-count
cross-check — and the guards caught only the failures someone had already
thought of. Planted against the scrapers they replaced, all four of these went
green on main and red after the change:

| Gate | Planted defect | main | after |
|---|---|---|---|
| `check:measures` | an orphan criterion keyed in double quotes | ✓ pass | ✗ orphan |
| `check:extract` | a mapper registered as `[SPIER_Q + '/PSS-Full']`, unclassified | ✓ pass | ✗ unclassified |
| `check:catalog` | `TOOLS` filing SAFE-T under the wrong tool id | ✓ pass | ✗ pairing |
| `check:catalog` | a dead launch path built from a constant | ✓ pass | ✗ dead route |

Converted: `check:measures` (`implementedCriteria()`), `check:extract`
(`MAPPED_QUESTIONNAIRE_URLS`), `check:scenarios` (`RISK_LEVEL_ORDER`'s keys),
`check:reassessment` (`UCUM_DAYS`, which was a "keep in step" copy),
`check:catalog` (`TOOL_UI_METADATA`, `TOOLS`, the data dictionary — and the
tool-id pairing is now compared as behaviour, the running catalog against the
identifiers, rather than as "tools.ts mentions the system URL"), and
`check:outputs`' launch actions. `check:readers` keeps its static parse, because
which FILE serves a canonical is a question about source, but cross-checks the
parsed registry against the running one.

A second step, the same day: three gates now **run** core rather than read it.
`check:extract` and `check:crosswalk` (rule F) call every registered mapper on
synthetic responses (`scripts/lib/mapper-probes.mjs`, built with core's own
`buildNativeQuestionnaireResponse`) and compare what comes OUT — the hand copy of
"the codes the mapper emits" and the grep for each disposition both passed a
mapper emitting a different code. `check:patients` loads core's `MRN_SYSTEM`,
and `check:careplan-readers` loads `CAREPLAN_MAPPER_BY_QUESTIONNAIRE_URL`.

**The rule.** A gate that needs a VALUE from core — a table, a registry, a set of
keys — loads it. A gate whose subject is the SOURCE — which file a symbol lives
in, what literal a reader passes, whether a string reaches the UI — stays static
(AST or text), because the runtime cannot answer that.

⚠️ **The React packages do not load.** `@spier/tool-views` fails under Vite's
SSR loader on a CommonJS-ambiguous dependency, so `TOOL_VIEWS`' slugs are still
scanned as text (`check:outputs`, `check:tool-view-routes`) with their zero-parse
guards. Keep data a gate needs in `packages/core` where that is a real choice.

⚠️ **A gate that loads core needs the generated tree, so it cannot run in the
fast `lint-css` job.** Core imports `packages/fhir-artifacts/generated/`, which
only `copy-fhir` builds and that job deliberately skips. `check:extract` and
`check:readers` ran there until this change and moved out — they still run in
`verify`; CI's `lint-css` failure on the first push is how that was found.

⚠️ **The server closes before the modules are returned.** Every glob in core is
`eager`, so a module is fully evaluated when it loads; a module that imported
lazily at call time would throw after the close — loudly, the acceptable failure.

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
failed.** It asserted both `dist` directories exist, not that they are fresh, so
it read output from the previous run. Closed 2026-10-06: each build's
`index.html` must be newer than every source that build reads (its app, every
`packages/*/src`, `vite.config.ts`) — the mtime comparison `check:outputs`
makes for its corpus.

⚠️ **The resolver was then rebuilt again (2026-10-06), for the same class of
hole.** "Derived from the filesystem" meant `@spier/<pkg>/` → `packages/<pkg>/src`,
which resolved nothing for the two aliases of a different shape
(`@spier/fhir-artifacts/`, bare `@spier/demo-population`), and every walker
dropped an unresolved import without a word — as it did any specifier with a
query, so `…/asq-questionnaire.json?raw` put a form in the entry chunk with
`check:eager-forms` green. The aliases are now read from Vite's resolved config,
queries are stripped, specifiers come from the TypeScript parser, and an
unresolved relative or `@spier/` import FAILS all three walkers.


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

⚠️ Two inputs it read wrongly until the 2026-10 gate audit: it read the token
sheet with its comments in, so a `/* --brand-primary: #341528; was … */` left
above the real declaration was read instead of it; and it kept the gradient's
stop offsets as a hand copy of `SpierLogo.tsx`'s, so moving a stop in the
wordmark passed. Comments are blanked, and the stops — token and offset — are
read from the wordmark's own `<stop>` elements.

### `npm run check:extract` — run the mapper, do not restate it

⚠️ Every mapper in the registry is RUN (2026-10-06), so no Questionnaire can be
"never opened". The hand lists that used to carry this rule — `EXPECTED`
(codes) and `NO_LITERAL_EXTRACTS` (reasons) — are gone: a hand copy of "the
codes the mapper emits" passed a mapper that emitted a different one. The one
list left, `COMPUTED`, records a judgement (this Observation is derived, not
the answer), and expires both ways.

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
Since 2026-10-06 it reads a lookup in either quote style and any spacing, and
fails when an app uses `TOOL_VIEWS` more times than it read lookups — a route
written `element={TOOL_VIEWS["asq-peds"]}` (a key that does not exist) used to
be invisible to it. Making that a type error instead (`as const satisfies`) is
a follow-up.

### `npm run check:eager-forms`

⚠️ Every tool view was already `lazy()` when the 18 Questionnaires were IN the
entry chunk — laziness of the component is not the property that matters,
because `App.tsx` imports `TOOL_VIEWS` statically and an eagerly-imported map's
CONTENTS are eager whatever they render. So this walks STATIC imports only —
the parser in `module-graph.mjs` tells `import x`, `import type` and `import(…)`
apart, and only the first is followed — from every declared app entry. Worth
~23.8 KB gzip off first paint on both surfaces.

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
`/guide/tools` ([`docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md`](../plans/archive/adoption-guide-ux-audit-2026-09-20.md) §1.1).

⚠️ **2026-10-06: its link and redirect readers were regexes over one spelling,
and both passed planted defects.** `<Link to={'/patient/onfile'}>` and a
template-literal `to` were not targets; `<Navigate replace to="…"/>` and
`element={ <Navigate …/> }` were not redirects. Targets are now read off the
TypeScript AST in any literal form (a computed one is counted, not silently
dropped), `App.tsx` itself is in RULE 1, `route-table.mjs` reads `<Navigate>`
with any prop order and spacing and reports one whose target it cannot read,
a relative target on a non-index route fails, and redirects have a floor. With
that, the per-app RULE 2 is strictly stronger than `check:catalog`'s
redirect-target check over the union of both tables, which was deleted.

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
its reason (the per-app `Sidebar` and `AppRoutes`), and an entry whose pair has
merged or vanished fails as stale; and a floor of functions, files and areas
parsed, so a broken parser cannot report ✓.

⚠️ **Rebuilt on the TypeScript parser (2026-10-06), because three copies
passed.** Renaming a parameter defeated rule 2 (the body was compared as
text), an expression-bodied `const f = (x) => …` was never parsed (the head
regex required `=> {`), and a copy in a file not yet `git add`ed was invisible
locally. Now every name a function binds — parameters and locals — is renamed
to its position before comparing, expression bodies count, and untracked
non-ignored files are read. Its first run on the new parser found two live
copies, both merged: `ms` in `measures.ts` (= `timeOf` in `recordQueries.ts`)
and the mock EHR client's `message` in `home.ts` and `chart.ts` (now
`errorText` in `client/config.ts`). `scripts/` was out of scope until
2026-10-07 (next section but one).

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

⚠️ **Bringing `scripts/` in (2026-10-07) found two tokenizer holes that had
been there since the rebuild, in every tree.** The token scanner has no parse
context. (a) A regex literal was read as code, and the `\//` that ends
`/\/\*…\*\//g` opened a LINE comment, hiding the rest of the line: two
different comment strippers — one blanking, one deleting — compared equal. (b)
After a template literal's first `${…}`, the closing backtick opened a NEW
template that ran past the function into the rest of the file, so two
IDENTICAL functions holding `` `✗ ${msg}` `` compared different — thirteen
byte-identical `fail`s in the gates passed that way. Both planted against
`main`'s gate and this one: (a) red → green, (b) green → red. Literals are now
taken whole from the AST. A recursive call is normalised to `$self` too, so a
renamed copy of a recursive walker (`walkJson` → `listJson`) is rule 2 — it
passed before.

The scan found 14 copied helpers in `scripts/`, now in `scripts/lib/repo.mjs`
(`REPO_ROOT`, `relRepo`, `walkExt`, `walkJson`, `isTest` — `app-roots.mjs` and
`style-roots.mjs` re-export the first three), `lib/text.mjs` (`stripComments`,
`stripTsComments`, `stripVersion`, `shortCanonical`) and `lib/cli.mjs`
(`argValue`, `die`). ⚠️ **And a fifth rule.** About forty gates define a `fail`
that writes their own failure count — many byte-identical once (b) was fixed —
and "define it once and import it" cannot apply to a closure over your own
module. A function in a gate's ENTRY file (`scripts/*.mjs`, not `lib/`) that
writes a top-level binding of that file is skipped and counted. Everywhere else
a stateful copy (a memoised loader, a cache) is importable, so it is still
compared — planted: a memoised loader copied across `scripts/lib` fails.

What it cannot see: a copy edited after copying (a fork — only a reader can
tell a fork from a variant), a duplicated fragment inside a larger function,
a method or an arrow assigned to an object property rather than a top-level
binding, and — by rule 5 — a copied function in a gate's entry file that also
writes that file's state.

## `check:jargon` and the page budgets — the guide's two copy rules (2026-09-20)

The adoption-guide UX audit
([`docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md`](../plans/archive/adoption-guide-ux-audit-2026-09-20.md))
ends in five copy rules, and observes that two of them are cheap to enforce and
*"both would have failed today"*. These are those two. PRs 1-4 fixed the
instances; without these, the class comes back one paragraph at a time.

### `check:jargon` — no repo vocabulary in reader copy

`scripts/check-reader-jargon.mjs` reads what a reader meets, five ways: every
source string under `apps/guide/src` and `packages/app-shell` (which both apps
mount); every `documentation[…].label` / `.display` at any depth in the
GENERATED resources (it scraped FSH lines, and a `"""` multi-line display or a
path-prefixed `* action[0].documentation[…]` line passed); core's catalogue,
LOADED through `lib/load-core.mjs`, with a tool's `copyright` put through
`readerCopyright` first because that is what the guide renders; the rendered
guide pages that show that prose (`apps/guide/src/pages/readerCopy.test.tsx`,
run from the gate, so a page printing a raw value fails it); and, with the
clinician's rules, `apps/clinical`, `packages/tool-views` and
`packages/app-shell`. Seven rules — an npm script, a gate name, a repo path
(`ig/` included), a source file name (`.json`, `.cql`, `.fml`, `.yaml`
included), a repo identifier, an issue number, an ISO date — each written from
a string that shipped, and shared through `scripts/lib/reader-jargon.mjs`. A
string the source spells out in pieces (`"npm run " + "copy-fhir"`, a template
over a `const`) is folded and checked whole.

⚠️ **The source scans alone missed 27 live strings** when the 2026-10 gate
audit ran the rules over what the apps actually render: issue numbers and a
repo date in seven Data Dictionary descriptions and an `ig/` path in a tool's
resource table (core data); a licensing-memo path (`docs/instruments/ASQ/licensing/MEMO.md` and its siblings) or `#64` in
seventeen tools' licensing notices (the published `ActivityDefinition.copyright`,
now rendered through `readerCopyright` — the IG text is unchanged); and, in
app-shell, `npm run copy-fhir` in the pathway's load error and a profile name
in the protocol page's clinician copy.

⚠️ **Three of the strings it was written from were in the ARTIFACT, not the
app.** `documentation[=].display` on the pathway PlanDefinition said "which is
what `npm run check:reassessment` exists to prevent", pointed at the header of a
`.fsh` file, and cited a path under `docs/`. Those render on `/guide/pathway`
*and* ship in the published IG, whose reader is an HL7 reviewer with no
checkout. PR 3 rewrote them; this is what stops the next one.

⚠️ **It parses, because grepping was tried and is wrong in both directions.** A
line scan reads a comment quoting a gate name as reader copy (this repo's
comments are full of them, deliberately), and the obvious way to find JSX text —
blank every `{…}`, take what is between `>` and `<` — blanks every element
returned from a `.map()` callback, which is most of the app. The walk is
`ts.ScriptKind.TSX`, the shape `check:fhir-render` established, and the two
gates are close relatives: that one asks whether a **recorder**'s words name a
**resource type** on the **clinical** surface. Machinery is not the wire format
and the guide is not a recorder, so every string above sat outside it by
construction.

⚠️ **The index excludes `node_modules` and generated trees, and that was a live
defect its own output caught.** Each Worker under `services/` has its own
install, so on a machine where they had been installed the index went from 454
names to 976 — every camelCase export of every dependency, which would have
banned `createRoot` from reader copy and meant nothing when it fired. It was
visible only because the gate prints the count on every run and the floor
flagged it as slack; otherwise the rule's strictness would have depended on
whether someone had run `npm install` in a service.

⚠️ **"A repo identifier" is checked against an index of the repo's own exports,
file names and directory names — not against the camelCase SHAPE.** The shape
rule was written first and was wrong both ways at once: it fired on
`localStorage`, `hookInstance` and `patientId` — a browser API and two CDS Hooks
wire fields, all legitimately shown to an implementer — while proving nothing
about what it did catch. The index makes the rule mean what its name says and
grows with the repo instead of with the gate.

What it cannot see, stated so a green run is not read as more than it is:

- **The 29 shared tool views' SOURCE, under the guide's rules.** They reach a
  guide reader as rendered on a tool page, and the rendered half reads every
  tool's page with drawers included; a string a page does not render on mount
  (a submit's result, an error) gets the clinician's rules only.
- **The published FSH text itself.** `Description` and `copyright` cite the
  licensing memos and `issue #64` — provenance in the IG, where it belongs. The
  guide renders `readerCopyright(copyright)`, and that is what is checked.
- **A computed string.** Folding sees what the source spells out; a value from
  a prop or a call is read in its literal halves.
- **Prose that names no machinery and is still about the build.** "It was called
  the Patient App until 2026-09-17" fails on the date; the same sentence without
  one passes and is just as much about this repo.

### The page budgets — `apps/guide/src/pages/pageLength.test.tsx`

A test rather than a `check:*` script, because the audit's measurements are of
*rendered* pages and the two biggest — Tools and the Data Dictionary — draw most
of their words from the catalog, where a source scan would see almost nothing.
Every section and subsection in `GUIDE_SECTIONS` must carry a budget or a
declared exemption; the page list is derived from that file, so a new page
cannot quietly arrive unmeasured.

⚠️ **It counts the words a reader meets ON ARRIVAL, not `textContent`, and that
is the whole design.** The audit's companion rule is *task first, caveats in a
drawer* — a caveat is DEMOTED into a closed `<details>`, never deleted. A cap
over `textContent` counts a closed drawer's body in full, so it would score
demoting a caveat exactly the same as leaving it in the reader's way and reward
deleting it instead: the opposite of the rule it serves. A closed `<details>`
therefore contributes its `<summary>` and nothing else. A planted 70-word
paragraph fails; the same 70 words inside a closed drawer do not, and that
negative control is part of the proof.

That the jsdom count is allowed to stand in for a browser one — where
`check:prose` had to refuse the same trade — rests on it reproducing the audit's
independent browser numbers: 2,001 words against 1,980 on the Data Dictionary,
457 against 462 on the dashboard, 377 against 368 on the rubric.

⚠️ **The three "see it running" pages share ONE budget**, because PR 5 made
them one pattern — what it is, what you see, the button, two closed drawers —
and brought them from 996 / 460 / 701 words to 268 / 241 / 290 without deleting
a caveat. A number per page would let one of the three drift back into an essay
while the pattern still looked intact, which is how they became 2.9 screens the
first time. Raising a cap to turn a red run green is the one edit that makes
this file decorative.

What it cannot see: **screens**, which is what a reader actually experiences —
words are a proxy, jsdom computes no layout, and a page that doubles its height
with cards and whitespace passes untouched. The audit measured both and they
moved together; if they stop, re-measure heights in a browser. It also cannot
see the layout's own chrome (each page is mounted alone), or whether the words
are in paragraphs a person can follow.
