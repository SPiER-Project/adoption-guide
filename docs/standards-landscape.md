# SPiER Standards Landscape

A curated map of the U.S. federal and HL7 standards ecosystem SPiER operates in: what each
body/artifact is, how SPiER's coded suicide-prevention artifacts reach recognition and adoption,
and the prioritized next moves. It doubles as the team's reference index for the external links
that otherwise live scattered across emails.

Grounded in a verified research pass (June 2026). Inline links are the primary sources; the
[Reference index](#reference-index) at the bottom collects them with one-line descriptions.

> **Status note.** This is a strategy/orientation doc, not a normative spec. Federal and HL7
> processes move on annual cycles; dates below are a 2026 snapshot. Items flagged
> **⚠ confirm** were not fully settled by the research and need a primary check before you act.

---

## The three pathways — and how they sequence

SPiER's artifacts reach recognition through three interrelated tracks. They are **not** parallel
equals — there's a dependency order:

```
  (1) Terminology coding  ──gates──▶  (2) USCDI+ Behavioral Health  ──drives──▶  vendor adoption
        LOINC / SNOMED                    (ASTP/ONC + SAMHSA)
              │                                                    
              └──────────── feeds ────────────▶  (3) HL7 BHFP R2 (functional profile)
                                                     ──certified by──▶  Drummond Group
```

- **Coding gates everything downstream.** USCDI+ explicitly evaluates "level of standards
  maturity"; an instrument with no LOINC/SNOMED code can't mature into USCDI+ or be cleanly
  exchanged in FHIR.
- **USCDI+ inclusion is the strongest vendor-adoption driver** (it shapes what certified EHRs
  must support).
- **A FHIR IG and a functional profile carry different weight:** the FHIR IG (what SPiER mostly
  is) defines the *data shape*; the functional profile (BHFP R2) defines *certifiable system
  behavior*. They're complementary on-ramps, and SPiER can feed both.
- **Pilots and HL7 Connectathons supply the real-world maturity evidence** all three tracks ask for.

---

## 1. Terminology coding — the foundational gate

Every SPiER instrument needs LOINC (for the instrument/items/answers/score) and, where relevant,
SNOMED CT (for clinical concepts like risk level). Today C-SSRS variants are LOINC-coded; **ASQ,
SAFE-T, the SBQ-R total score, and the CAMS SSF measures are not** — closing that is the gating
work.

**LOINC (governed by the Regenstrief Institute).**
- Submit new content via the [LOINC online request form or downloadable templates](https://loinc.org/submissions/new-terms/);
  screening instruments use the **Form / surveys-instruments-datasets** template. The old
  RELMA-based submission method was retired Dec 31, 2023.
- Model to follow: the **PHQ-9 panel `44249-1`** — nine symptom items + functional-impairment item
  + total-score `44261-6`, each with answer lists. SPiER's uncoded instruments would mirror this
  panel + item + answer-list + score structure. See [submission policy](https://loinc.org/submissions/policy/)
  and the [PHQ-9 panel](https://loinc.org/44249-1/).

**SNOMED CT (US Edition produced by NLM; international content by SNOMED International).**
- **US-realm concepts** → NLM's [US SNOMED CT Content Request System (USCRS)](https://www.nlm.nih.gov/pubs/techbull/so11/so11_snomed_crs.html),
  which supports ten request types (New concept, Add Parent, New Synonym, New Relationship, …).
  NLM produces the [SNOMED CT US Edition](https://www.nlm.nih.gov/healthit/snomedct/us_edition.html).
  ⚠ confirm — the USCRS reference is from 2011; verify current tooling against NLM/UMLS guidance.
- **Universal-realm concepts** → the [HL7 Terminology Authority new-concept request process](https://confluence.hl7.org/spaces/TA/pages/11042920/SNOMED+CT+New+Concept+Request+Process),
  respecting HTA deadlines for the upcoming SNOMED release cycle.

**⚠ Open item — proprietary instruments.** The research could **not** confirm how LOINC/SNOMED
handle coding (and answer-list publication) for *copyrighted* instruments (**CAMS, C-SSRS**) versus
*public-domain* ones (**PHQ-9, ASQ**). SPiER may need instrument-owner permission before requesting
codes, and copyright may constrain publishing answer lists. **Resolve this before investing in
coding requests for the proprietary tools.**

---

## 2. USCDI+ Behavioral Health — the federal adoption lever

USCDI+ creates "domain or program-specific data element lists that operate as extensions to the
existing USCDI," built from the same core USCDI foundation
([USCDI+ overview](https://healthit.gov/standards-and-technology/uscdi-plus/)). It maintains a
dedicated **Behavioral Health** domain, co-managed by **ASTP/ONC with SAMHSA** (alongside CMS, CDC,
NCI, FDA, HRSA, NIH, ASPR).

- **How to submit:** through the **ONDEC** system — a three-step Submit / Evaluate / Post process
  requiring use case(s), applicable standards/specs, evidence of existing use and exchange, and
  potential challenges
  ([ONDEC announcement](https://healthit.gov/blog/interoperability/uscdi-onc-new-data-element-and-class-submission-system-now-available/)).
- **Evaluation criteria:** industry priority and readiness, **level of standards maturity**, and
  identified agency need — see [ONDEC leveling criteria](https://www.healthit.gov/isp/ondec-leveling-criteria).
  (A leveling system exists; the strict "exactly three levels per element" framing did **not**
  survive verification — treat leveling as a spectrum, not a fixed 3-bucket rule.)
- **Cadence (core USCDI):** Level-2 elements are considered ~**October** each year for the next
  draft USCDI, reviewed by HITAC and the public, then published ~**July**. ⚠ confirm — the
  **USCDI+ BH** dataset refresh cadence is less formally fixed than the core USCDI cycle.
- **The existing USCDI+ BH list already enumerates a "Suicide Risk Assessment" grouping** — C-SSRS
  variants are LOINC-coded; ASQ, SAFE-T and others are not
  ([USCDI+ BH elements, US Behavioral Health Profiles IG](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/uscdi_bh_elements.html)).
  SPiER's contribution is *refining/extending* an existing grouping, not creating a domain from scratch.

**How the layers relate:** **USCDI** = the core required data set; **USCDI+** = program/domain
extensions on that core; **US Core** = the FHIR IG that makes USCDI exchangeable; **ISP**
(`isp.healthit.gov`) = ONC's standards-representation hub. ISP today has topics for depression and
SDOH screening but **no dedicated suicide-risk topic** — a visible gap SPiER is positioned to fill.
⚠ confirm whether ISP accepts a new suicide-risk topic and what sponsorship it takes.

---

## 3. HL7 functional profiles — the BHFP R2 / certification route

- **Base model:** the **EHR-S Functional Model Release 2.1** = **ISO/HL7 10781:2023**
  (published Nov 2023), a user-perspective list of EHR *functions* and *conformance criteria*
  ([ISO 10781:2023](https://www.iso.org/standard/84722.html),
  [EHR-S FM IG](https://build.fhir.org/ig/HL7/ehrsfm-ig/)).
- **What a functional profile is:** a selected subset of / modifications + additions to those
  functions and conformance criteria, scoped to a setting or domain; an EHR can **claim conformance**
  to it ([what is a functional profile](https://build.fhir.org/ig/HL7/dhfp-ig/en/whatis.html)).
  This is distinct from a FHIR IG: functional profile = *system behavior*; FHIR IG = *data shape*.
- **BHFP Release 2** is actively under development by the HL7 **EHR Work Group Behavioral Health
  Project Team**, extending the 2008 BHFP R1 on top of EHR-S FM R2.1. Status: Method 1 / Pass 1
  analysis complete (Oct 11, 2024), Pass 2 underway (Mar 31, 2026), then formal consensus ballot
  ([HL7 EHR WG Behavioral Health](https://confluence.hl7.org/spaces/EHR/pages/208471919/Behavioral+Health)).
  ⚠ confirm — the ballot timeline (NIB, STU vs normative) is not yet published, so any 6–18 month
  completion projection is uncertain.
- **The adoption lever:** completion ties to an EHR/HIT certification program led by **Drummond
  Group** (an ONC-Authorized Certification Body). The BH Project Team is co-led by **Tim Bennett
  (Drummond)** and **Gary Dickinson (HL7 EHR WG Co-Chair)**.
- **The EHR WG runs three layers deliberately together:** BHFP R2 (functions), a Behavioral Health
  FHIR IG R1 (data, building on the US Behavioral Health Profiles IG + US Core), and the USCDI+ BH
  dataset — with datasets/elements considered for incorporation into USCDI+ BH and into LOINC/SNOMED.

---

## Where SPiER stands today

SPiER is **already a feeder into the HL7 EHR WG Behavioral Health project** — verified verbatim on
the [Behavioral Health Confluence page](https://confluence.hl7.org/spaces/EHR/pages/208471919/Behavioral+Health)
(last updated May 26, 2026):

1. A SPiER-derived presentation, *"Improving Suicide-Safe Care through Gen AI-Driven Recommendations
   for Tool Standardization in LOINC"* (May 19, 2026), under the section that explicitly considers
   datasets/elements for USCDI+ BH and LOINC/SNOMED.
2. **Contributed Use Case Scenario 10** (a SPiER patient journey) feeding the BHFP R2 worksheet that
   maps to EHR-S FM R2.1 functions/conformance and FHIR resources.
3. A SPiER project presentation (Kelly Samuelson, ZeroOverdose, Aug 13, 2025) with a downloadable deck.

So the strategic question is **formalizing and advancing an existing position**, not opening a new door.

> **Leadership.** SPiER is led by **Kelly Samuelson** (affiliated with **ZeroOverdose, ZeroSuicide,
> and SPiER**); the WG page's attribution to ZeroOverdose / Kelly Samuelson is correct. **HTD Health
> is a supporting contributor, not the project owner.** The IG's `publisher` is set to **SPiER**
> accordingly, with HTD Health as the technical contact. The project is still *seeking a Clinical
> Co-Lead*.

---

## Prioritized next actions (6–18 months)

1. **Resolve the proprietary-instrument coding question first** (⚠ open item) — confirm whether
   ASQ/PHQ-9 (public domain) can proceed immediately and what permissions CAMS/C-SSRS require. This
   unblocks track 1.
2. **File LOINC requests for the public-domain uncoded instruments** (ASQ; SAFE-T if public domain),
   using the PHQ-9 panel as the template. This is the gating work for everything else.
3. **Convert SPiER's existing EHR WG presence into a formal USCDI+ BH submission** — propose a
   refined "Suicide Risk Assessment" element (e.g., the harmonized risk-tier concept) via ONDEC,
   with the cross-EHR pilot as the "existing use and exchange" evidence.
4. **Advance Use Case Scenario 10 into BHFP R2 Pass 2/3 analysis** — get SPiER's ED/inpatient
   workflow and adoption-readiness rubric formally incorporated, not just referenced.
5. **Use a pilot + HL7 Connectathon track as the maturity evidence** all three tracks require —
   the cross-EHR ASQ portability pilot is the natural candidate.
6. **Formalize SPiER's standing in the BH Project Team** — fill the open Clinical Co-Lead seat and
   confirm public attribution reflects Kelly Samuelson's leadership (ZeroSuicide / ZeroOverdose /
   SPiER), with HTD Health credited as a supporter.

---

## Open questions to confirm

1. **Proprietary-instrument coding:** how LOINC/SNOMED handle copyrighted instruments (CAMS, C-SSRS)
   vs public-domain (PHQ-9, ASQ); what owner permissions SPiER needs before requesting codes.
2. **USCDI+ BH cadence & owners:** the actual BH submission/refresh cadence (vs core USCDI's
   Oct/July cycle) and who at ASTP/ONC + SAMHSA owns the decision to add/refine a BH element.
3. **BHFP R2 ballot timeline:** the concrete NIB/ballot schedule (STU vs normative) and the exact
   Pass/worksheet stage at which Scenario 10 + the rubric can be formally incorporated.
4. **ISP suicide-risk topic:** whether `isp.healthit.gov` would stand up a dedicated suicide-risk
   topic, what sponsorship/evidence it needs, and whether that accelerates adoption relative to
   USCDI+ inclusion.

---

## Reference index

External sources from the BH Work Group materials and the research pass, with SPiER relevance.

| Source | What it is | SPiER relevance |
|---|---|---|
| [USCDI+ overview](https://healthit.gov/standards-and-technology/uscdi-plus/) | ASTP/ONC program for domain extensions to USCDI | The federal adoption lever; defines the BH domain |
| [ONDEC submission announcement](https://healthit.gov/blog/interoperability/uscdi-onc-new-data-element-and-class-submission-system-now-available/) | The data-element submission system + process | How SPiER submits a suicide-risk element |
| [ONDEC leveling criteria](https://www.healthit.gov/isp/ondec-leveling-criteria) | How submissions are evaluated/leveled | The maturity bar SPiER must clear |
| [USCDI+ BH elements (US BH Profiles IG)](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/uscdi_bh_elements.html) | The current USCDI+ BH data-element list | Shows the existing "Suicide Risk Assessment" grouping + coding gaps |
| [ISP: Social, Psychological & Behavioral Data](https://isp.healthit.gov/section/social-psychological-and-behavioral-data) | ONC standards-representation hub | No suicide-risk topic yet — a gap SPiER can fill |
| [LOINC new-term submission](https://loinc.org/submissions/new-terms/) | Regenstrief's new-content request process | How to code ASQ/SAFE-T/SBQ-R/CAMS SSF |
| [LOINC PHQ-9 panel 44249-1](https://loinc.org/44249-1/) | A fully-coded screening panel | The template for SPiER's uncoded instruments |
| [NLM USCRS (SNOMED US content requests)](https://www.nlm.nih.gov/pubs/techbull/so11/so11_snomed_crs.html) | US-realm SNOMED concept requests | For SNOMED concepts (risk level, etc.) |
| [HL7 Terminology Authority SNOMED request](https://confluence.hl7.org/spaces/TA/pages/11042920/SNOMED+CT+New+Concept+Request+Process) | Universal-realm SNOMED requests | Alternate SNOMED route for international concepts |
| [ISO 10781:2023 (EHR-S FM R2.1)](https://www.iso.org/standard/84722.html) | The base EHR functional model | The foundation BHFP R2 builds on |
| [HL7 product brief 14 — BH Functional Profile R1](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=14) | The 2008 BHFP | The predecessor BHFP R2 updates |
| [HL7 product brief 528 — EHR-S FM R2.1](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=528) | The HL7 view of EHR-S FM R2.1 | Same base model, HL7 product page |
| [HL7 EHR WG Behavioral Health](https://confluence.hl7.org/spaces/EHR/pages/208471919/Behavioral+Health) | The WG's home page | Where SPiER already appears as a feeder; BHFP R2 status |
| [What is a functional profile](https://build.fhir.org/ig/HL7/dhfp-ig/en/whatis.html) | Functional-profile concept (DHFP example) | Explains FP vs FHIR IG distinction |
| [HL7 balloting](https://confluence.hl7.org/display/HL7/HL7+Balloting) | HL7 consensus ballot process | The path BHFP R2 / any SPiER IG follows |

_Last updated: June 2026. Maintained as part of the SPiER engagement strategy; see also
[engagement-strategy.md](engagement-strategy.md)._
