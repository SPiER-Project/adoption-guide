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
npm run copy-fhir      # compile IG via SUSHI + copy resources into src/data/fhir/ (do this FIRST)
npx tsc -b             # typecheck (project references; needs generated files present)
npm run lint           # eslint
npm run lint:css       # stylelint (design-token enforcement)
npm run check:tokens   # every var(--token) resolves to a real definition
npm run check:template # page template: one header implementation, one owner of the page
                       # inset, one owner of the page width
npm run check:prose    # the reading MEASURE — `--measure-prose`. Its four rules are each
                       # written against a defect that shipped: the token must be in `em`
                       # and in band (it was 760px, a width where a character count was
                       # meant); every other `max-width` must be a page-width token or
                       # classified NON_PROSE with a reason (`.dd-detail` escaped a column
                       # budget to 52rem = 134 cpl under a comment claiming otherwise);
                       # a `max-width: none` must be declared (`.dd-cell-desc` carried a
                       # 46rem cap that a later `none` had always overridden); and an `em`
                       # cap must know what type it resolves against (`.tool-config-effect`
                       # sat at an inherited 16px while its paragraph was 14px).
                       # ⚠️ It CANNOT see a prose run with NO cap — that needs to know
                       # which elements hold long prose, which is content, not CSS. Measure
                       # a wide page's prose by hand after adding it
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

