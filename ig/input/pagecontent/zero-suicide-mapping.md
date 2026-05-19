# Zero Suicide ↔ SPiER mapping

## Why this mapping matters

[Zero Suicide](https://zerosuicide.edc.org/) is a framework for systematic
suicide-safer care, organized around seven foundational elements. SPiER is
a FHIR-native technical implementation of the **clinical workflow layers**
of that framework — the layers that an EHR can actually execute, store,
and exchange.

The mapping below makes the scope split explicit: which Zero Suicide
elements SPiER models, and which are organizational concerns that the
framework addresses but SPiER does not (and should not) try to encode in
FHIR.

> **Status: draft for Zero Suicide Institute review.** This page reflects
> SPiER's interpretation of the mapping based on publicly available Zero
> Suicide materials. It has not yet been reviewed by the Zero Suicide
> Institute.

## The seven elements of Zero Suicide

| # | Element       | What it means                                                                     | SPiER scope?     |
|---|---------------|-----------------------------------------------------------------------------------|------------------|
| 1 | **Lead**      | Create a leadership-driven, safety-oriented culture committed to reducing suicide | Out of scope     |
| 2 | **Train**     | Develop a competent, confident, and caring workforce                              | Out of scope     |
| 3 | **Identify**  | Systematically identify and assess suicide risk among all people receiving care   | In scope         |
| 4 | **Engage**    | Ensure every individual has a pathway to care that is both timely and adequate    | In scope         |
| 5 | **Treat**     | Use effective, evidence-based treatments that target suicidality directly         | In scope         |
| 6 | **Transition**| Provide continuous contact and support, especially after acute care               | In scope         |
| 7 | **Improve**   | Apply a data-driven quality improvement approach to inform system changes         | In scope         |

**Out of scope (organizational, not encoded in FHIR):**
*Lead* and *Train* are essential to a Zero Suicide implementation but live
above the EHR layer. They involve organizational commitment, leadership
buy-in, staff training, and competency assessment. SPiER assumes these are
in place; it does not model them as FHIR resources.

## SPiER stages ↔ Zero Suicide elements

SPiER's eight technical stages decompose Zero Suicide's *Identify*,
*Engage*, *Treat*, *Transition*, and *Improve* elements into actionable
EHR workflow steps:

| SPiER stage                | Maps to Zero Suicide  | What the EHR does at this stage                                                                                  |
|----------------------------|-----------------------|------------------------------------------------------------------------------------------------------------------|
| 1. **Flag Risk**           | Identify              | Capture a suicide-related signal (positive screen, behavioral cue) and indicate that further review is needed.   |
| 2. **Clarify Risk**        | Identify              | Capture the nature, severity, and context of risk via structured assessment.                                     |
| 3. **Set Risk Status**     | Identify              | Document the current risk status and the clinical reasoning that determines next steps.                          |
| 4. **Document Safety Actions** | Engage            | Document concrete safety-promoting actions: safety planning, means counseling, lethal-means restriction.        |
| 5. **Coordinate Handoffs** | Transition            | Transfer suicide-safety information, responsibility, and follow-up across people, settings, and time points.     |
| 6. **Track Follow-Up**     | Transition            | Track whether outreach (caring contacts, scheduled follow-ups) actually occurs after the immediate encounter.    |
| 7. **Manage Active Risk**  | Treat                 | Keep active suicide-safer care episodes visible, trackable, and escalated when needed.                           |
| 8. **Measure and Share**   | Improve               | Make pathway activity usable for reporting, QI, accountability, and information sharing.                         |

### Notes on the mapping

- **Identify decomposes into three SPiER stages**, not one. The framework
  treats *Identify* as a single element; SPiER separates the *signal*
  (Flag Risk), the *structured assessment* (Clarify Risk), and the
  *clinical disposition* (Set Risk Status) because each produces distinct
  FHIR resources with distinct workflow triggers between them.

- **Transition decomposes into Coordinate Handoffs and Track Follow-Up.**
  Coordination is the act of handing off; tracking is the act of confirming
  the receiving side picked up. They are temporally distinct and produce
  different FHIR resources (`ServiceRequest`/`Task` for coordination;
  `Communication`/`Procedure` for follow-up tracking).

- **Treat maps to a single stage (Manage Active Risk).** SPiER's scope here
  is the *pathway view* of treatment — tracking that someone is in an
  active suicide-focused care episode (e.g., CAMS), updating that episode
  with new sessions and SSF measures. Specific therapeutic modalities are
  Zero Suicide's *Treat* element in full but are out of SPiER's
  EHR-pathway scope.

- **Improve is intentionally light.** SPiER's *Measure and Share* stage
  surfaces pathway-completion measures and population-level views (see the
  companion app's [Population View](https://bbthorson.github.io/SPiER/#/population)).
  Full QI methodology — running PDSA cycles, board reporting cadence — is
  Zero Suicide's territory, not SPiER's.

## What this mapping implies for adopters

If your organization is implementing Zero Suicide and looking for the EHR
piece:

- **Adopt SPiER for the *Identify, Engage, Transition, Treat, Improve*
  layers** — the parts that need to live in FHIR resources, workflow
  triggers, and EHR screens.
- **Adopt Zero Suicide directly for *Lead* and *Train*** — leadership
  commitment, workforce competency, organizational change. These are not
  EHR features.
- **The SPiER [Adoption Rubric](https://bbthorson.github.io/SPiER/#/implementation-guide/adoption-rubric)**
  scores your EHR's capability across the eight technical stages. Use it
  alongside the Zero Suicide [Organizational Self-Study](https://zerosuicide.edc.org/toolkit/lead/zero-suicide-organizational-self-study)
  for a full picture.

## Open questions for the Zero Suicide Institute

The following items will be discussed with the Zero Suicide Institute
before this mapping is considered final:

1. Is the decomposition of *Identify* into Flag Risk → Clarify Risk → Set
   Risk Status faithful to the framework's intent, or does it
   over-fragment what Zero Suicide treats as one workflow element?
2. Should SPiER's *Measure and Share* stage explicitly reference the Zero
   Suicide outcome measures (e.g., attempts per 1000 patients, time-to-
   safety-plan), and if so, with what FHIR Measure profiles?
3. Are there Zero Suicide-published code systems (for assessment
   instruments, safety-plan elements, etc.) that SPiER should reference
   directly rather than defining locally?
4. Co-authorship attribution: how should the Zero Suicide Institute
   appear in this IG's `publisher` and `author` metadata?
