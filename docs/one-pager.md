# SPiER — Suicide Prevention in Electronic Health Records

**A non-profit standards effort making suicide-safer-care data portable across every system a patient touches.**

---

## What SPiER is

SPiER is translating the research-validated suicide prevention tools clinicians already trust — the **ASQ** screener, the **Columbia (C-SSRS)**, the **Stanley-Brown Safety Plan**, **CAMS**, and others — out of paper and PDF and into structured, machine-readable **HL7 FHIR** resources that any EHR or health information exchange can implement the same way.

We organize this work around an **8-stage Suicide Safer Care Pathway** — from flagging risk through safety planning, care transitions, follow-up, and population measurement — so that an implementation supports the whole longitudinal journey of a patient at risk, not just a single screen.

**We're not selling any of it.** SPiER gives the field open Implementation Guides, FHIR profiles, value sets, and reference examples — and vendors adopt these standards for free. There's no product to buy and no service to subscribe to.

## Who's behind it — and why that matters

SPiER is a **non-profit standards effort, not a market participant.** We don't sell an EHR, an integration engine, or a screening product — so we have no stake in any one vendor winning. That independence is what lets us define a *neutral* canonical shape for suicide-care data: one no vendor owns and every vendor can adopt for free.

SPiER is built by a team with deep roots in the **Zero Suicide** movement, and works as its technology-enablement counterpart: where Zero Suicide defines the clinical and organizational framework for suicide-safer care, SPiER builds the data-standards layer that lets that model actually travel between systems.

## Why interoperability is a blocker to care

A patient at risk moves through many hands — emergency department, inpatient, outpatient, primary care, crisis line, community provider. Today the safety plan and risk assessment too often stay behind in the chart that created them.

National standards like **US Core** and **USCDI** cover demographics, diagnoses, and medications — but they don't yet specify *how* a suicide screener, risk formulation, or safety plan should be captured. So every EHR records them a little differently: same questions, different shapes. The result is data that can't be shared, can't be measured, and can't be acted on downstream.

> A patient screened with the ASQ in an ED, assessed with the Columbia, and discharged with a Stanley-Brown Safety Plan is too often re-screened from scratch at an outpatient clinic 48 hours later. The next clinician should be able to see what's already been done — and pick up where the ED left off.

## What we provide — two layers

1. **Implementation Guides for specific tools.** A canonical FHIR shape for each validated instrument, so the ASQ (or Columbia, or Stanley-Brown) is captured and exchanged identically everywhere it's used.

2. **A normalization layer *between* tools.** Partners don't all use the same instruments — one site screens with the ASQ, another with the Columbia, another with PHQ-9 Item 9. SPiER defines a harmonized, instrument-agnostic **concept layer** — a common suicide-risk representation that every tool maps *into* — so a receiving system can act on a result **without having to run the same tool that produced it.** This mirrors the approach HL7's Gravity Project took for social-determinants screening.

## What turns this into standard practice

SPiER is building these artifacts to a "show up done" standard — proving them in a live health-information-exchange pilot, then bringing them to the relevant HL7 work groups. The lever that turns a strong reference implementation into standard practice nationwide is a clear signal that **discrete suicide-care data elements are expected — not optional — in certified EHRs and interoperability datasets.**

We'd welcome the chance to walk any partner — regulator, EHR vendor, health information exchange, or health system — through the work and where it fits existing interoperability priorities.

---

*theSPiERproject.org · Kelly Samuelson, MSW, LADC — Project Director*
