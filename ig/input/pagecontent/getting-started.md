# Getting Started

This page gets a developer from zero to validating their own resources against SPiER.

## 1. Get the artifacts

Three ways, depending on your tooling:

- **Browse** — the [Artifacts](artifacts.html) page lists every profile, value set, code system, ConceptMap, and example. Each example is downloadable as JSON.
- **IG package** — the IG publishes a FHIR NPM package, `spier.ig` (canonical `http://spier.org`). Point your FHIR tooling (Sushi, the HL7 validator, a Firely/HAPI server) at it to load all definitions at once.
- **Build locally** — clone [the repo](https://github.com/bbthorson/SPiER), then from `ig/` run [SUSHI](https://fshschool.org/docs/sushi/) to compile the FSH sources to FHIR JSON (`fsh-generated/`), and the HL7 IG Publisher to render this site.

## 2. Validate a resource against a SPiER profile

Use the official HL7 validator. Download `validator_cli.jar` from the [validator releases](https://github.com/hapifhir/org.hl7.fhir.core/releases), then validate an instance against a SPiER profile — loading the SPiER IG so the profile resolves:

```bash
java -jar validator_cli.jar my-observation.json \
  -version 4.0.1 \
  -ig spier.ig \
  -profile http://spier.org/StructureDefinition/spier-suicide-risk-concept
```

Or use a **public FHIR R4 test server** that supports `$validate` (see HL7's [public test servers list](https://confluence.hl7.org/spaces/FHIR/pages/35718859/Public+Test+Servers)). Note: a server can only validate against SPiER profiles once the SPiER IG package has been loaded into it — many public servers only carry the base spec and US Core, so the local `validator_cli.jar` route is the most reliable for custom profiles today.

A good first instance to validate is one of the published [examples](artifacts.html) (e.g. the ASQ result Observation), edited to your own data.

## 3. See it working

The **[interactive companion app](https://bbthorson.github.io/SPiER/)** is a runnable reference implementation: it captures each instrument, persists `QuestionnaireResponse`s, derives the Observations (including the harmonized suicide-risk concept), and walks the 8-stage pathway in a simulated chart. Use it to see the expected shapes end-to-end before you build.

## 4. Give feedback / track progress

- File questions and issues on [GitHub Issues](https://github.com/bbthorson/SPiER/issues).
- Track build status on the [Roadmap](https://bbthorson.github.io/SPiER/#/implementation-guide/roadmap).

> SPiER is **draft / FMM 0–1**. Definitions may change before Trial-Use. If you're implementing against it now, pin to version `0.1.0` and watch the repo for updates.
