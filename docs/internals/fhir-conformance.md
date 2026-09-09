# FHIR conformance: the validator, the FML maps, and the scenarios

The HL7 validator gate, the FML parser's limits, the rules shared with the mock
EHR's write endpoint, and what each half of the scenario gate does and does not
cover.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

At the repo root, resource-level FHIR conformance (needs Java 17+; downloads and
caches the ~190MB HL7 validator jar into `.fhir-validator/` on first run):
```
node scripts/validate-fhir.mjs   # HL7 validator_cli over ig/fsh-generated/, FHIR-Resources/
                                 # and packages/demo-population/src/scenarios/ (unwrapped —
                                 # `responses` included since #414; excluding it left the 20
                                 # scenario QRs the only hand-authored FHIR nothing validated)
```

Also at the repo root, the FHIR Mapping Language gate (same Java + jar; the
`--tx` half needs the network, because the FML transform engine refuses to run
without a terminology server):
```
node scripts/check-fml.mjs --tx https://tx.fhir.org
```

⚠️ **The scenario gate's per-resource rules are SHARED with the mock EHR's write
endpoint, and that is a guardrail rather than a refactor.**
`packages/core/fhir-resource-rules.mjs` holds the base-R4 tables, the
profile-derived checks and the date/binding rules; `check-scenario-resources.mjs`
and `services/mock-ehr/src/validate.ts` both call it. The embedded-panel plan §1
permits a mock we control **only** if it validates writes with these checks
"rather than inventing a second, laxer opinion" — a lenient mock accepts writes a
real EHR rejects, so the demo looks better while proving less. If you change a
rule, you change both callers at once, which is the point. The rule bodies were
moved unchanged into a closure that supplies `fail` and `structureDefs`, so
`git log -p` on that file shows an empty diff for the rules themselves.

Two properties there are load-bearing. `assertUsableIndex` makes an **empty**
conformance index a startup failure in both callers — otherwise every
profile-derived rule reports nothing and the gate (or the write endpoint) green-lights
what it never read. And the rules require an `id`, while a FHIR **create** must
not carry one; `validate.ts` assigns the server's id *before* validating rather
than relaxing the rule, because relaxing it would have loosened the scenario gate
too.

⚠️ **The population scenarios are hand-authored FHIR, and are gated by two
things that cover different amounts.** `packages/demo-population/src/scenarios/patient-*.json`
holds Observations, CarePlans, Communications, EpisodeOfCares, Appointments,
ServiceRequests, Procedures and DocumentReferences that the Stage-8 measure
engine reads directly, so a malformed one produces a *wrong* measure score
rather than an empty one (issue #226). Be precise about which gate sees what:

| | `npm run check:scenarios` (offline, in `verify`) | `node scripts/validate-fhir.mjs` (Java, `ig.yml`) |
|---|---|---|
| Runs | every `web/` verify | PR + push touching `ig/`, `FHIR-Resources/`, or the scenarios |
| QuestionnaireResponses | linkIds, nesting, answerOption, ranges, value[x] type, plus the patient link and `authored` | full conformance, **including the scenario QRs** — `validate-fhir.mjs` unwraps the `responses` bucket since #414. It did not until then, which is how those 20 carried neither `subject` nor `authored` (#364) and hid 4 conformance errors |
| Other buckets | unknown-bucket typos, `resourceType`, unique ids, patient linkage (**presence required, not just correctness** — the old rule only fired on a link pointing at the *wrong* patient, which is how #364's 20 unlinked QRs passed), **the subject Patient actually existing**, base-R4 required elements + status/intent codes, profile canonicals resolving, profile `min`/fixed/required-binding from the generated StructureDefinitions, SPiER extension bindings, date parsing | everything: real cardinality, **slicing**, invariants, extension context, reference targets, unknown elements |
| Misses | cardinality *counts*, slices, invariants, unknown elements, external codes | nothing structural — but runs `-tx n/a`, so LOINC/SNOMED displays wait for the nightly |

The offline half's base-R4 required-element and status-code tables are
hand-maintained (`BASE_REQUIRED` / `STATUS_CODES` in
`check-scenario-resources.mjs`) because the base R4 StructureDefinitions are not
vendored here. An omission there costs offline coverage only — the validator
still catches the underlying defect. Everything profile-derived is read from
`packages/fhir-artifacts/generated/StructureDefinition-*.json`, so changing FSH changes the
check.

`validate-fhir.mjs` unwraps the scenario buckets into a temp directory first
(`collectScenarioResources`), dropping only `_savedAt` — SPiER's client-side
persistence stamp, which `smartDataSource` also strips before writing to a real
server. `riskAlerts` and `walkthrough` are deliberately not fed to the validator:
neither is FHIR (`walkthrough` is `ScenarioEncounter` narration, not a FHIR
Encounter), and the offline half checks both against their TypeScript shapes
instead.

⚠️ **The scenarios' 116 `subject: Patient/patient-0NN` references dangled for
months, and no gate could see it.** A `subject` naming a nonexistent Patient is
not a conformance error, so the HL7 validator passed it; the offline checker
asserted every resource named the *right* id, never that the id resolved. The 14
subjects now exist as hand-authored FHIR in `packages/demo-population/src/patients/`
(they were IG example Instances until #392 moved them out — nothing in the IG
referenced them),
and `check-scenario-resources.mjs`'s check 8 closes the loop — it **exits non-zero
when it finds no Patient resources at all**, rather than passing vacuously when
`copy-fhir` has not run.

Two things there are easy to get wrong. The Patient index is built **before** the
`if (typeof doc?.url !== 'string') continue` guard, because a `Patient` has no
`url` and would otherwise be skipped — folding it into the conformance-resource
branch chain yields an empty set and a green gate. And `* id = "patient-0NN"` in
the FSH is load-bearing: the Instance *name* is CamelCase, but the resource id
must be the exact string the scenarios reference, or they dangle again.

⚠️ **`encounters` used to be that narration bucket and no longer is.** #285 made
it real FHIR `Encounter`s — the correlation hinge every other artifact reaches
the episode through — and moved the walkthrough narration to `walkthrough`. Both
gates now cover it (`encounters: 'Encounter'` in `check-scenario-resources.mjs`
*and* `validate-fhir.mjs`), so an Encounter defect fails offline and in the
validator. If you are reasoning about what SPiER does or does not emit, check the
bucket map in those two scripts rather than trusting a doc — this line was itself
stale for a day, and a plan doc merged on top of the stale version.

⚠️ **A validator warning can mean "nothing was checked".** If the HL7 validator
cannot resolve a QuestionnaireResponse's Questionnaire (or a claimed profile), it
says so as a *warning* and then reports zero errors — a context-loading mistake
degrades to a PASS. Two traps caused this in practice, both now guarded in
`validate-fhir.mjs`: `-ig <folder>` does **not** recurse, so `-ig FHIR-Resources`
loads 0 resources (every file is one level down); and `-output` emits a bare
`OperationOutcome` rather than a `Bundle` when given exactly one source. The
script now treats those warnings as errors and understands both output shapes.
When you touch it, re-run it against a deliberately broken input and confirm it
*fails* — a green gate you have never seen go red is not evidence of anything.

The validator runs without a terminology server (`-tx n/a`) so the gate stays
fast and offline-reproducible. Consequence: codes from **external** systems
(LOINC, SNOMED) are not verified there — the IG Publisher covers those. Codes
from SPiER-local CodeSystems *are* fully checked, including that every
`Coding.display` matches the CodeSystem's display or one of its designations.
Pass `--tx https://tx.fhir.org` to check external terminology locally.

⚠️ **A mapper can read an answer shape its Questionnaire never declares, and
every other gate will call that fine.** For months the whole C-SSRS family and
CAMS Section B read `answer.valueBoolean`, while **not one Questionnaire in this
repo declares a `boolean` item** — every yes/no question is `type: choice` bound
to SNOMED Yes `373066001` / No `373067005`. So a screener filled in through
SPiER's own form read `undefined` for every item, and the risk ladders treat
`undefined` as "not endorsed": a patient endorsing q5, *specific plan and
intent*, derived `tier: none`, "No risk identified" (issue #327). Three blind
spots lined up, and each is worth knowing on its own:

- **A mapper test can encode the wrong shape and then defend it.** Those suites
  hand-built `valueBoolean` responses, so they proved the mappers correct against
  input the app never produces. Tests now build responses with
  `__fixtures__/nativeQr.ts`, which derives item nesting and every `value[x]`
  from the Questionnaire JSON — a fixture that asserts the shape of the app's
  data has to *derive* that shape from the artifact defining it.
- **`check:scenarios:responses` does check `value[x]` against `item.type`** — it
  simply had no C-SSRS or CAMS-B fixture *with items* to look at. `p011-cssrs-full`
  and `p007-cssrs-pediatric` now carry coded answers, so the native shape is
  gated.
- **The #230 fallback normalizes a foreign QR to `valueBoolean` on purpose**, so
  a *foreign* C-SSRS derived the right tier while a *native* one did not. That
  inversion is the tell; `getYesNoBoolean` is now the single yes/no reader and
  accepts both shapes, so booleans stay valid.

`npm run check:readers` is the class-level fix: it parses each mapper with the
TypeScript AST, resolves which linkId every `walkItems` read names and which
reader is applied, and checks that reader against the item's declared `type`.
It needs no test to exist and no fixture to be written. It resolves the linkId
forms this codebase uses (literal, `for…of` over a code table, `.reduce` over a
list, helper parameter fed by literal call sites) and **fails on anything it
cannot follow** rather than skipping it — a silent skip is how a gate reports
green while checking nothing (#232, #261). Its first run found that `getYesNoBoolean`
is deliberately pointed at PSS-3 items offering the SNOMED pair **plus**
`unable-to-complete` / `patient-refused`; the rule is containment, not equality,
because a non-response must stay `undefined` rather than becoming a "No".

