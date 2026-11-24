> **Status: draft** (FMM 0–1). Must-Support flags, the role CapabilityStatements
> and every rule below are the intended conformance contract, not yet balloted.
> Advancing maturity needs independently developed implementations; per-tool
> readiness is tracked in the companion app's
> [Adoption Readiness matrix](https://spier-project.github.io/adoption-guide/#/guide/tools/readiness).

### Actor roles

SPiER defines conformance per **system role**, the approach of the HL7
[Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/). Each role has a
`CapabilityStatement` declaring the resources and interactions it supports:

- [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html) —
  captures an instrument as a `QuestionnaireResponse` and produces the derived
  instrument Observation(s) and the harmonized suicide-risk concept Observation.
- [HIE Intermediary](CapabilityStatement-hie-intermediary.html) — stores and
  forwards those resources across organizations without losing fidelity or
  provenance.
- [Risk Consumer](CapabilityStatement-risk-consumer.html) — reads the
  harmonized concept (and, optionally, the underlying capture data) to surface
  actionable suicide-risk information at the point of care.
- [Quality Reporter](CapabilityStatement-quality-reporter.html) — evaluates the
  Stage-8 Measures over a population; its access pattern is population-wide
  rather than per patient.

### What "Must-Support" means

Following [US Core](https://hl7.org/fhir/us/core/conformance-expectations.html),
Must-Support is defined **operationally, by role**:

- A **Screening-Source EHR** (producer) *SHALL be capable of populating* every
  Must-Support element of each profile it supports;
  [the minimum](#source-minimum) says which profiles those must include.
- An **HIE Intermediary** *SHALL be capable of storing and returning* every
  Must-Support element it receives, unchanged — including `derivedFrom`, every
  `category` and `meta.profile` — so a downstream consumer receives what the
  producer sent. It SHALL NOT drop a coding it does not recognize.
- A **Risk Consumer** *SHALL be capable of processing* instances containing
  those elements *without erroring or failing*.
- A **Quality Reporter** *SHALL be capable of processing* the Must-Support
  elements the [Measures](measurement.html) read — status, code, category, the
  resource's date and its subject — across a population.
- **Missing data:** when an element is optional and its value is unknown, a
  producer SHALL omit it. When the element is required (minimum cardinality 1
  or more) and its value is unknown, the producer SHALL populate it with the
  [Data Absent Reason](https://hl7.org/fhir/R4/extension-data-absent-reason.html)
  extension, or, for a coded element whose value set includes one, an
  `unknown` code. A consumer SHALL interpret a missing element as *data not
  present*, not as an error.

Must-Support says *what must be supported*; it does **not** constrain maximum
cardinality, so a source system is never forced to strip data out.

### The minimum for each role {#source-minimum}

A system can claim the Screening-Source EHR role with **one instrument and
the risk concept**. It SHALL:

1. capture at least one screening or assessment instrument whose result maps
   into the harmonized tier (see [Harmonization status](harmonization-and-limitations.html#harmonization-status)),
   as a `QuestionnaireResponse` to the Questionnaire SPiER publishes for it;
2. write that instrument's result to its profile; and
3. write the [SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html)
   derived from that result.

Every other resource type and profile in the role's
[CapabilityStatement](CapabilityStatement-screening-source-ehr.html) is
optional. A source that supports one SHALL write it to the profile listed and
support the interactions listed for it. The CapabilityStatement marks each
resource type and profile `SHALL` or `MAY` accordingly; "at least one
instrument" is a rule across profiles, so each instrument profile is marked
`MAY` and the rule is stated here. A claim SHOULD name the instruments it
covers.

[Implementing a Screening-Source EHR](implement-screening-source-ehr.html)
walks the minimum and what to add after it.

A **Risk Consumer** SHALL be able to read the
[SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html),
and SHALL read the patient's
[Information-Sharing Consent](StructureDefinition-spier-information-sharing-consent.html)
before re-disclosing anything it received. Every other read in its
[CapabilityStatement](CapabilityStatement-risk-consumer.html) is optional and
marked `MAY`.

An **HIE Intermediary** SHALL accept and return `QuestionnaireResponse`,
`Observation` and `Consent`: what the smallest conforming source produces, and
the consent that governs it. Every other resource type in its
[CapabilityStatement](CapabilityStatement-hie-intermediary.html) is optional,
and one it accepts is stored and returned unchanged like the rest. Each
profile is individually `MAY`, because an intermediary carries whatever its
sources send.

A **Quality Reporter** SHALL resolve each Measure it computes and the Library
it references, and SHALL publish MeasureReports, with `evaluatedResource`
populated on individual reports. `$evaluate-measure` is `SHOULD` and bulk
export is `MAY` in its
[CapabilityStatement](CapabilityStatement-quality-reporter.html). A reporter
claims the role for the measures it computes, not all eight: several read
stages a minimum source does not write. A claim SHOULD name the measures it
covers.

Each minimum is reachable from the role upstream of it: a minimum source feeds
a minimum intermediary, which feeds a minimum consumer.

### The concept layer is screening-level

The harmonized suicide-risk tier (generic LOINC `93374-7`) is a **derived,
unconfirmed** signal: a screen result warranting follow-up, not a confirmed
clinical finding. Consumers SHOULD treat it as a triage/routing signal and
preserve the `derivedFrom` link to the originating `QuestionnaireResponse`.
See [Reading the artifacts](how-to-read.html#two-layer-model).

#### Tier derivation on the Questionnaire {#tier-derivation}

Every instrument's `risk-level` item carries a
[Tier Derivation](StructureDefinition-tier-derivation.html) extension valued
`computed` (the tier is derived from the other answers — the C-SSRS forms) or
`clinician-assigned` (the tier is the clinician's judgment — SAFE-T, PSS-Full).
A `computed` item SHALL be `readOnly` and SHALL NOT be `required`: no filler
produces its value, so a QuestionnaireResponse that omits it is conformant. A
`clinician-assigned` item SHALL be `required`, and a consumer reads the tier
from the response. [Reading the artifacts](how-to-read.html#tier-derivation)
shows the two cases side by side.

#### `Observation.interpretation` differs by layer

The concept-layer Observation carries `POS` / `NEG` (positive or negative for
follow-up); the instrument-layer Observations carry `A`, `H`, `L` (a native
result read against the instrument's own thresholds). Both come from the
standard observation-interpretation value set and the profiles do not choose
between them. A consumer SHOULD NOT assume one interpretation vocabulary across
the two layers, and SHOULD read the `derivedFrom` chain to know which layer an
Observation belongs to.

### The problem list

**A screen never becomes a `Condition`.** A positive ASQ, C-SSRS, PHQ-9 item 9
or SBQ-R produces Observations — the instrument's own result and a
[SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html)
— and never a `Condition`. Systems implementing this guide SHALL NOT derive
a problem-list `Condition` from a screening or assessment result; a problem-list
entry is a clinician's assertion, and a screen is a signal that one may be
warranted.

**A clinician-asserted suicide-related problem is coded** with
[SPiER Suicide-Related Condition](StructureDefinition-spier-suicide-related-condition.html),
which requires `verificationStatus` and binds `code` extensibly to
[SPiER Suicide-Related Problem](ValueSet-spier-suicide-related-problem-vs.html):
nine SNOMED CT concepts, each verified against the publishing authority,
spanning risk status, ideation → plan → intent → behavior → attempt, history of
attempt, and self-harm. Depression (`35489007`) is deliberately **not** a member:
a PHQ-9 score is a severity screen, and a system SHALL NOT assert a depressive
disorder from one.

**A CAMS driver stays narrative.**
[SPiER CAMS Suicide Driver](StructureDefinition-spier-cams-suicide-driver.html)
requires `code.text` and leaves `code.coding` optional, because no terminology
carries concepts at a driver's granularity. `code` keeps US Core's extensible
binding to its Condition codes, so a driver with no suitable code is text-only;
validators report that as a warning, which is expected. A driver is a
clinician-identified problem and carries the `problem-list-item` category.

### Categories and codes every profile carries

- **The domain category is required.** Every SPiER resource with a native
  `category` element carries
  `http://thespierproject.org/fhir/CodeSystem/spier-concept-domain#suicide-risk`
  as a `1..1` slice, *in addition to* its standard clinical category (`survey`,
  `procedure`, `problem-list-item`, …). Slicing is open, so a resource may carry
  further categories. [Quick Starts](quick-starts.html) has the queries this
  enables, including why `Appointment` uses `service-category`.
- **`87626-8` in `CarePlan.category` is not a document claim.** The two
  narrative safety plans —
  [Stanley-Brown](StructureDefinition-spier-stanley-brown-safety-plan.html) and
  [Crisis Response Plan](StructureDefinition-spier-crisis-response-plan.html) —
  carry LOINC `87626-8` "Suicide prevention note" in `category` for
  discoverability. It is a document-type concept placed in an `example`-bound
  element; a consumer SHALL NOT read it as a claim that the CarePlan is a
  document. The two CAMS plans do not carry it.
- **Safety-plan section codes are SPiER-local**
  ([safety-plan-section](CodeSystem-safety-plan-section.html)), because LOINC
  publishes nothing at section granularity, and they are kept separate from the
  [CAMS care-plan sections](CodeSystem-cams-careplan-section.html), which the
  CAMS framework orders and scopes differently. No ConceptMap between the two is
  published.
- **Licensing status is a code, and it may say `unknown`.** Every
  ActivityDefinition carries a `copyright` notice and a coded
  [instrument-licensing-status](StructureDefinition-instrument-licensing-status.html).
  `unknown` is a positive statement that SPiER's audit has not established the
  answer, not a synonym for unrestricted. No status has been checked against
  what the rights holder publishes *today*. Before deploying an instrument, an
  adopter SHALL contact SPiER about licensing and SHALL verify the rights
  holder's current terms; see [Licensing](index.html#licensing).
- **A code-less ActivityDefinition is a catalogue entry, not a modelled
  instrument.** A few pathway steps are published with structural metadata only
  — no LOINC or SNOMED codes, no Questionnaire binding, no derived-Observation
  profile — because inventing those would assert things nothing verified. Each
  is still referenced by exactly one stage PlanDefinition action.

### Status and known limits

Which crosswalks are published, their sign-off status, and the limitations of
the shared result code are on
[Harmonization and Limitations](harmonization-and-limitations.html).
