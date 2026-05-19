# SPiER — Suicide Prevention in Electronic Records

A FHIR-native reference implementation of the suicide-safer care pathway,
developed in alignment with the **[Zero Suicide framework](https://zerosuicide.edc.org/)**.

SPiER models the **eight technical stages** of suicide-safer care as FHIR
PlanDefinitions, ActivityDefinitions, and supporting resources — giving EHR
vendors and health systems lift-able artifacts that demonstrate what
suicide-prevention pathway conformance looks like in practice.

## Audience

This IG is primarily authored for:

- **EHR vendors** evaluating how to support suicide-safer care workflows in
  their products.
- **Health-system clinical informatics teams** specifying what their EHR
  vendor needs to support.
- **HL7 work groups** evaluating SPiER as a basis for standardized
  suicide-prevention FHIR artifacts.

## Companion resources

- **[Interactive companion app](https://bbthorson.github.io/SPiER/)** — a
  React application demonstrating the pathway in a simulated EHR
  environment, including an 8-stage Patient Chart, a 10-patient Population
  View, a configurable Tool Configuration page, and a Roadmap of planned
  work.
- **[GitHub repository](https://github.com/bbthorson/SPiER)** — source for
  both this IG and the companion app.

## Status

**Draft / continuous build.** This IG is being authored iteratively
beginning with the ASQ (Ask Suicide-Screening Questions) screener as the
flagship tool. Subsequent tools will follow a templated artifact pattern
once ASQ has been validated end-to-end with the Zero Suicide Institute.

See the [Zero Suicide ↔ SPiER mapping](zero-suicide-mapping.html) for how
the pathway stages relate to the broader Zero Suicide framework, and the
[Roadmap](https://bbthorson.github.io/SPiER/#/implementation-guide/roadmap)
in the companion app for build status across all 25 catalogued tools.
