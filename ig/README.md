# SPiER FHIR Implementation Guide

FSH (FHIR Shorthand) source for the **SPiER FHIR Implementation Guide**, compiled
with [SUSHI](https://fshschool.org/docs/sushi/) and rendered with the [HL7 IG Publisher](https://github.com/HL7/fhir-ig-publisher).

## Layout

```
ig/
├── sushi-config.yaml           # IG metadata (id, canonical URL, dependencies)
├── input/
│   ├── fsh/                    # FSH sources for profiles, ValueSets, CodeSystems, instances
│   ├── cql/                    # CQL, compiled to ELM by the IG Publisher
│   ├── resources/maps/         # FHIR Mapping Language (.fml) → published StructureMaps
│   └── pagecontent/            # Narrative IG pages (Markdown)
├── drafts/                     # NOT in the build — see that folder's README
└── README.md                   # This file
```

`input/resources/maps/` is scanned only because `sushi-config.yaml` declares
`path-resource: input/resources/maps` (the publisher's default scan of
`input/resources` does not recurse); see that folder's README for authoring
rules and gate coverage. `input/cql/` is compiled to ELM and attached to
`Library/SPiERSuicideSaferCareMeasures` only because `sushi-config.yaml` sets
`path-binary: input/cql`, the CQL loader's activation switch. Both folders are
one config line away from silently not being built.

## Local compile

```bash
# Install SUSHI (one-time)
npm install -g fsh-sushi

# Compile FSH → FHIR JSON resources (output: fsh-generated/)
# The package is fsh-sushi, so a bare `sushi .` fetches the wrong package.
npx fsh-sushi .
```

Rendering a hostable site needs the full IG Publisher: Java 17+ and a
`publisher.jar` from the [HL7/fhir-ig-publisher releases](https://github.com/HL7/fhir-ig-publisher/releases),
run as `java -jar publisher.jar -ig .` from this directory. It refuses any
path containing a space and needs Jekyll installed — see the IG section of
`CLAUDE.md` at the repo root for both traps.

## Verification

Run before committing an IG change; a clean SUSHI run does not imply the
others passed. Rationale for each gate is in `CLAUDE.md` at the repo root.

| Command | Run from | What it catches |
|---|---|---|
| `npx fsh-sushi .` | `ig/` | FSH syntax, unresolved FSH references |
| `node scripts/check-sushi-output.mjs` | repo root | SUSHI warnings beyond the expected advisories |
| `node scripts/validate-fhir.mjs` | repo root | resource-level conformance: cardinality, extension context, required items |
| `node scripts/check-fml.mjs` | repo root | FML syntax and StructureMap parity — a parser, not a profile checker |
| IG Publisher (`ig-publish.yml`, or locally) | `ig/` | FHIRPath invariants, narrative link integrity, CQL→ELM translation |

## Authoring rules

- **FSH-first.** New artifacts are written in FSH, not raw JSON.
- **Reference, don't duplicate.** When a Questionnaire already lives under
  `FHIR-Resources/<stage>/<tool>/...`, the IG's ActivityDefinition references
  it via canonical URL rather than re-defining it.
- **LOINC/SNOMED where published.** Use local CodeSystems only when no
  authoritative code exists. Note the substitution intent in the FSH source.
- **Profile thoughtfully.** Tight profiles for SPiER-specific Observations
  (e.g. ASQ result); use US Core as the baseline for demographics and generic
  encounter data.
- **Don't set `^url`** on CodeSystems, ValueSets, or Profiles — SUSHI derives
  it from the canonical plus the declared `Id`, and setting it explicitly is
  drift risk (PR #4). `Instance:` declarations (e.g. ActivityDefinition) do
  set `* url = "..."` directly, since that's a resource field, not metadata.

## Status

**Draft / continuous build.** Per-tool state (build status, recommendation
tier, target integration depth) is tracked in the companion app's
[Adoption Readiness page](https://spier-project.github.io/adoption-guide/#/guide/adoption-readiness),
not here.
