# Zero Suicide ↔ SPiER mapping

[Zero Suicide](https://zerosuicide.edc.org/) is a framework for systematic
suicide-safer care organized around seven elements. SPiER is a FHIR
implementation of the framework's **clinical workflow layers** — the ones an
EHR can execute, store and exchange. This page states which elements SPiER
models and which are organizational concerns it deliberately does not encode.

> **Draft for Zero Suicide Institute review.** This is SPiER's interpretation
> from publicly available Zero Suicide materials; the Institute has not yet
> reviewed it.

## The seven elements

| # | Element | What it means | SPiER scope |
|---|---|---|---|
| 1 | **Lead** | A leadership-driven, safety-oriented culture committed to reducing suicide | Out of scope — organizational, above the EHR |
| 2 | **Train** | A competent, confident and caring workforce | Out of scope — organizational, above the EHR |
| 3 | **Identify** | Systematically identify and assess suicide risk among all people receiving care | In scope |
| 4 | **Engage** | Ensure every individual has a timely, adequate pathway to care | In scope |
| 5 | **Treat** | Use effective, evidence-based treatments that target suicidality directly | In scope (the pathway view of treatment) |
| 6 | **Transition** | Continuous contact and support, especially after acute care | In scope |
| 7 | **Improve** | A data-driven quality-improvement approach | In scope (measures and population views) |

## SPiER stages ↔ Zero Suicide elements

SPiER's eight technical stages decompose *Identify*, *Engage*, *Treat*,
*Transition* and *Improve* into EHR workflow steps, each published as a
PlanDefinition (the [pathway group](artifacts.html#6) on the Artifacts page):

| SPiER stage | Zero Suicide element | What the EHR does at this stage |
|---|---|---|
| 1. **Identify Possible Risk** | Identify | Capture a suicide-related signal (positive screen, behavioral cue) and indicate that further review is needed |
| 2. **Clarify Risk** | Identify | Capture the nature, severity and context of risk via structured assessment |
| 3. **Define the Risk Picture** | Identify | Document the current risk status and the clinical reasoning that determines next steps |
| 4. **Document Safety Actions** | Engage | Document concrete safety-promoting actions: safety planning, means counseling, lethal-means restriction |
| 5. **Coordinate Handoffs** | Transition | Transfer suicide-safety information, responsibility and follow-up across people, settings and time |
| 6. **Track Follow-Up** | Transition | Track whether outreach (caring contacts, scheduled follow-ups) actually occurs after the encounter |
| 7. **Track Risk Over Time** | Treat | Keep active suicide-safer care episodes visible, trackable and escalated when needed |
| 8. **Measure and Share the Data** | Improve | Make pathway activity usable for reporting, QI, accountability and information sharing |

*Identify* spans three stages because signal, structured assessment and
clinical disposition each produce distinct FHIR resources with a workflow
trigger between them; *Transition* spans two because handing off and
confirming the receiving side picked up are temporally distinct and produce
different resources. The other decompositions, and what SPiER leaves to the
framework, are recorded with the artifacts' design decisions.
