# SPiER StructureMaps (FHIR Mapping Language)

The `.fml` files here are compiled to `StructureMap` resources by the HL7 IG
Publisher and published as IG artifacts. They were promoted out of `ig/drafts/`
by issues [#92](https://github.com/SPiER-Project/adoption-guide/issues/92) and
[#229](https://github.com/SPiER-Project/adoption-guide/issues/229).

| Map | Job |
|---|---|
| `ASQResultToSuicideRiskConcept` | ASQ disposition → harmonized suicide-risk tier (via ConceptMap) |
| `CSSRSRiskLevelToSuicideRiskConcept` | C-SSRS risk level → harmonized tier (via ConceptMap) |
| `PHQ9Item9ToSuicideRiskConcept` | PHQ-9 Item 9 ordinal 0–3 → harmonized tier (thresholds) |
| `SBQRTotalScoreToSuicideRiskConcept` | SBQ-R total 3–18 → harmonized tier (validated cutoffs) |
| `StanleyBrownQRToCarePlan` | Safety-plan QuestionnaireResponse → safety-plan CarePlan |

The first four are instrument→concept crosswalks. The fifth has a different
job — questionnaire→CarePlan — and is the map referenced by
`PlanDefinition.action.transform` on the Document Safety Actions stage.

## How these get into the build

SUSHI does not compile `.fml`. The IG Publisher does, but only for folders it
is told to scan, and its default scan of `input/resources` **does not recurse**.
The wiring is one line in `ig/sushi-config.yaml`:

```yaml
parameters:
  path-resource:
    - input/resources/maps
```

Remove that and the maps silently stop being published — SUSHI stays green,
because SUSHI never sees them.

## Authoring rules

- **Line 1 must be `map "<url>" = "<name>"`.** The R5 `/// url = "…"` metadata
  block does not parse under the R4 parser, and a file that fails to parse
  contributes *zero* resources rather than an error — which is how four maps sat
  in `ig/drafts/` for two months with a green CI job that had never compiled
  one. `scripts/check-fml.mjs` now rejects the R5 form by name.
- **`<name>` must equal the filename.** The publisher derives the StructureMap
  id from the file name; a mismatch publishes an artifact whose id and name
  disagree.
- **The leading comment block becomes `StructureMap.description`** in the
  published IG — everything between the `map` line and the first `uses`. Write
  it for an implementer reading the IG. Repo mechanics go in an
  "Implementation notes" block *after* the `uses` lines, which is not published.
- **Do not `imports` a ConceptMap.** `StructureMap.import` is
  `canonical(StructureMap)`; `translate()` resolves the ConceptMap from its own
  argument.
- **Parenthesise `where` clauses** — `where (v = 0)`, not `where v = 0`.
- **Use FHIRPath names, not JSON names**: `answer.value.ofType(string)`, never
  `answer.valueString`.
- **A repeating `type: group` item arrives as repeated `item`, not as `answer`.**
  Reading a `repeats: true` group through `.answer.select(item.where(…))` looks
  right and is wrong: the HL7 validator rejects that shape with *"Items of type
  question should not have answers"*. `StanleyBrownQRToCarePlan.fml` read it that
  way for its whole life and a conforming safety plan lost all three contact
  sections (#419). It now branches on both, with a nested `iif` rather than a
  `|` union — union dedups and does not guarantee order, which would silently
  merge two contacts sharing a name and number.
- **Give a parity fixture per shape you accept.** One fixture in the readable
  shape is indistinguishable from a map that works; #419 was green for months on
  exactly that.

## Gates, and what each one actually covers

Run locally with `node scripts/check-fml.mjs --tx https://tx.fhir.org`
(needs Java 17+ and `ig/fsh-generated/resources/` populated by
`npx fsh-sushi .`). CI runs it in `.github/workflows/fml-validate.yml`.

| Gate | Catches | Misses |
|---|---|---|
| `check-fml.mjs` compile phase | FML syntax, unparseable header, name/filename mismatch, unresolvable imports | misspelled target elements, untypeable FHIRPath, wrong `import` type |
| `check-fml.mjs` parity phase | the Stanley-Brown map drifting from the CarePlan the runtime produces, run over **both** QuestionnaireResponse shapes against one golden (#419) | anything about the other four maps |
| `stanleyBrown.parity.test.ts` | the *runtime* drifting from the declared map — offline, in `npm run verify` | the map itself |
| IG Publisher (`ig-publish.yml`) | element and FHIRPath conformance: wrong `import` target type, untypeable expressions, invalid element names | — this is the strict one |

The compile phase is a parser, not a profile checker: `tgt.interpretaton = …`
compiles clean. Every conformance defect found while promoting these maps —
seven `evaluate` errors, two wrong-typed `import`s, seven untypeable FHIRPath
expressions — was invisible to it and visible to the IG Publisher. If you change
an `.fml`, a green `check-fml.mjs` is necessary and not sufficient; let
`ig-publish.yml` run.

## Clinical status

Compiling is not ratifying. The tier assignments these maps encode are
illustrative reference logic pending sign-off by suicide-prevention
subject-matter experts — epic
[#77](https://github.com/SPiER-Project/adoption-guide/issues/77) /
[#93](https://github.com/SPiER-Project/adoption-guide/issues/93). See
`ig/input/pagecontent/conformance.md` for the per-instrument status table.
