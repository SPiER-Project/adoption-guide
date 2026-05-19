# SPiER FHIR Implementation Guide

This directory contains the FSH (FHIR Shorthand) source for the **SPiER FHIR
Implementation Guide**. The IG is compiled with [Sushi](https://fshschool.org/docs/sushi/)
and rendered with the [HL7 IG Publisher](https://github.com/HL7/fhir-ig-publisher).

## Layout

```
ig/
├── sushi-config.yaml           # IG metadata (id, canonical URL, dependencies)
├── input/
│   ├── fsh/                    # FSH sources for profiles, ValueSets, CodeSystems, instances
│   └── pagecontent/            # Narrative IG pages (Markdown)
└── README.md                   # This file
```

## Local compile

```bash
# Install Sushi (one-time)
npm install -g fsh-sushi

# Compile FSH → FHIR JSON resources (output: ig/fsh-generated/)
cd ig && sushi .

# (Optional) Run the full IG Publisher to produce a hostable site
# Requires Java 11+; first run downloads ~500MB of dependencies.
./_genonce.sh    # macOS/Linux
_genonce.bat     # Windows
# Output: ig/output/index.html
```

## Validation

Sushi alone catches FSH-level errors. For full FHIR conformance validation,
use the [HL7 FHIR Validator](https://github.com/hapifhir/org.hl7.fhir.core)
against `ig/fsh-generated/resources/`:

```bash
java -jar validator_cli.jar ig/fsh-generated/resources/*.json \
  -version 4.0.1 \
  -ig hl7.fhir.us.core#6.1.0
```

## Authoring rules

- **FSH-first.** New artifacts are written in FSH, not raw JSON.
- **Reference, don't duplicate.** When an existing Questionnaire lives under
  `FHIR-Resources/<stage>/<tool>/...`, the IG's ActivityDefinition references
  it via canonical URL rather than re-defining it.
- **LOINC/SNOMED where published.** Use local CodeSystems only when no
  authoritative code exists. Note the substitution intent in the FSH source.
- **Profile thoughtfully.** Tight profiles for SPiER-specific Observations
  (e.g. ASQ result); use US Core as the baseline for patient demographics
  and generic encounter data.

## Status

**Draft / continuous build.** The first conformant artifact set targets the
**ASQ (Ask Suicide-Screening Questions)** screener. Subsequent tools follow
the same artifact template once ASQ ships and is signed off by the Zero
Suicide Institute.
