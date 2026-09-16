# Getting Started

From zero to validating your own resources against SPiER.

## 1. Get the artifacts

- **Browse** — the [Artifacts](artifacts.html) page lists everything in eight
  groups. The first, [Screening and assessment instruments](artifacts.html#1),
  holds each instrument's Questionnaire (for example the
  [ASQ](Questionnaire-ASQ-Screening-Tool.html) and the
  [PHQ-9](Questionnaire-PHQ-9.html)), ready to load into an SDC-capable form
  filler, beside the ActivityDefinition that administers it and the profile its
  result lands in. Every artifact is downloadable as JSON.
- **IG package** — the IG publishes a FHIR NPM package, `thespierproject.fhir`
  (canonical `http://thespierproject.org/fhir`). Point your FHIR tooling
  (SUSHI, the HL7 validator, a Firely or HAPI server) at it to load every
  definition at once.
- **Build locally** — clone [the repository](https://github.com/SPiER-Project/adoption-guide),
  then from `ig/` run [SUSHI](https://fshschool.org/docs/sushi/) to compile the
  FSH sources to FHIR JSON and the HL7 IG Publisher to render this site.

## 2. Validate a resource against a SPiER profile

Use the official HL7 validator. Download `validator_cli.jar` from the
[validator releases](https://github.com/hapifhir/org.hl7.fhir.core/releases),
then validate an instance against a SPiER profile, loading the SPiER IG so the
profile resolves:

```bash
java -jar validator_cli.jar my-observation.json \
  -version 4.0.1 \
  -ig thespierproject.fhir \
  -profile http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-concept
```

A public FHIR R4 test server with `$validate` works only once the SPiER
package has been loaded into it; most public servers carry the base spec and
US Core alone, so the local `validator_cli.jar` route is the reliable one. A
good first instance is one of the published examples — the ASQ result
Observation, say — edited to your own data.

## 3. Decide which role you are

SPiER states conformance per system role, each with a CapabilityStatement:

- [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html) —
  captures an instrument and produces the derived Observations.
- [HIE Intermediary](CapabilityStatement-hie-intermediary.html) — stores and
  forwards them across organizations.
- [Risk Consumer](CapabilityStatement-risk-consumer.html) — reads the
  harmonized risk tier at the point of care.
- [Quality Reporter](CapabilityStatement-quality-reporter.html) — evaluates
  the measures over a population.

[Conformance](conformance.html) defines what Must-Support means for each.

## 4. See it working

The **[companion app](https://spier-project.github.io/adoption-guide/)** is a
runnable reference implementation: it captures each instrument, persists the
QuestionnaireResponses, derives the Observations (including the harmonized
suicide-risk concept) and walks the eight-stage pathway in a simulated chart.
Use it to see the expected shapes end to end before you build. Its source, and
this guide's, is the same [repository](https://github.com/SPiER-Project/adoption-guide).

## 5. Give feedback

File questions and issues on
[GitHub Issues](https://github.com/SPiER-Project/adoption-guide/issues); build
status per tool is on the
[milestones](https://github.com/SPiER-Project/adoption-guide/milestones).
