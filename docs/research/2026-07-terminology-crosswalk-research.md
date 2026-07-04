# Terminology & crosswalk research report (July 2026)

**Provenance:** Output of an AI deep-research run (external model, 2026-07-04) against a research
brief covering: (A) clinical evidence for the SPiER risk-tier crosswalks, (B) LOINC/SNOMED
terminology status, (C) instrument licensing, (D) reusable prior art. Preserved verbatim below
the annex.

> ⚠️ **Read the verification annex first — it overrides the report body wherever they
> conflict.** Several specific codes in the body were checked against live terminology servers
> (tx.fhir.org, loinc.org search, SNOMED browser) on 2026-07-04 and found to be **fabricated**.
> Do not copy any code from the body into FSH without checking it against the annex.

---

## Verification annex (checked 2026-07-04)

### ✅ Confirmed correct

| Claim | Verification |
| --- | --- |
| SNOMED `6471006` Suicidal ideation (finding) | tx.fhir.org lookup: display "Suicidal ideation" ✓ |
| SNOMED `82313006` Suicide attempt (event) | tx.fhir.org lookup ✓ |
| LOINC `93373-9` C-SSRS screener panel | tx.fhir.org lookup ✓ (already used in the IG) |
| LOINC `93374-7` Suicide risk level + LL465-6 answer list | tx.fhir.org lookup ✓ (already used in crosswalk-tier-to-loinc.fsh) |
| No LOINC for SBQ-R, ASQ items, CAMS SSF measures, PSS-3, SAFE-T, ED-SAFE ESS-6 | Consistent with loinc.org search results and the repo's prior June 2026 verification |
| US Behavioral Health Profiles IG has **no safety-plan profile** | Verified against build.fhir.org artifacts page 2026-07-04 — there is no external alignment target for safety-plan coding |
| Part A clinical-pathway content (NIMH ASQ tiers, C-SSRS triage bands, PHQ-9 Item 9 sensitivity/specificity, SBQ-R ≥7/≥8 cutoffs) | Consistent with the cited primary literature; suitable as the evidence base for the SME sign-off packet (#93), which is itself the final check |

### ⚠️ Correct code, wrong display

| Claim in body | Reality |
| --- | --- |
| SNOMED `225337009` = "Suicidal Behavior Questionnaire score" | Actual display: **"Suicide risk assessment"** (tx.fhir.org). The code is real and active; SPiER's use of it for the SBQ-R total score is a pragmatic local choice that should be documented as such, not presented as an SBQ-R-specific code. |

### ❌ Fabricated / wrong — do not use

| Claim in body | Reality |
| --- | --- |
| LOINC `81216-4` "Patient safety plan Document" | `81216-4` is actually **"Progress note - recommended C-CDA R2.0 and R2.1 sections"**. No LOINC safety-plan document code was found in loinc.org search. |
| SNOMED `442163000` "Non-suicidal self-injury (finding)" | Not found on tx.fhir.org; no authoritative source surfaced. |
| SNOMED `443422002` "Suicide safety planning (procedure)" | Not found on tx.fhir.org; no authoritative source surfaced. |
| SNOMED `713145008` "Counseling on access to lethal means (procedure)" | Not found on tx.fhir.org; no authoritative source surfaced. Web search found no standard SNOMED procedure code for lethal-means counseling — implementations appear to use CPT/billing codes or local codes. |
| SNOMED "735984001 Crisis plan" | Not re-verified; treat as unverified until checked. |

**Open terminology gaps these fabrications were papering over** (each needs a real lookup or a
"no code exists" determination before use in FSH): NSSI finding code, safety-planning procedure
code, lethal-means-counseling procedure code, safety-plan document-ontology code.

### ❌ Misreadings specific to SPiER

| Claim in body | Reality |
| --- | --- |
| "BSSA" = Beck Scale for Suicidal Ideation (Pearson, proprietary, high cost) | In SPiER, **TL-005 BSSA is the NIMH Brief Suicide Safety Assessment** (see `AdministerBSSA` in ig/input/fsh/pathway-tool-placeholders.fsh) — part of the free public-domain ASQ toolkit. The Pearson licensing row is irrelevant unless SPiER ever adds the Beck Scale as a separate tool. |
| Tracker mapping "PSS-3 (#21), ED-SAFE (#22), SAFE-T (#23), BSSI (#24), CALM (#25), Caring Contacts (#29)" | Issue numbers are wrong. Actual: BSSA=#21, SAFE-T=#22, PSS-3=#27, ED-SAFE=#28, CALM=#32, Caring Contacts=#26, Now Matters Now=#29. |

### 🔶 Plausible but unverified (confirm at source before relying on it)

- The licensing rows in Part C match common knowledge for the well-known instruments
  (C-SSRS commercial-software licensing, CAMS-care commercial licensing, Stanley-Brown
  written-permission requirement, PHQ-9/ASQ free), but none were independently verified
  against the publishers' current terms. Issue #127 already requires confirming at source
  before writing `ActivityDefinition.copyright` text.
- The Gravity-style lightweight consensus process (Part A end) is a reasonable synthesis,
  not a citation of Gravity's actual documented process.

---

## Original report (verbatim, unedited except image-tag cleanup)

# Standard Clinical Crosswalks and Terminology Specifications for the SPiER Implementation Guide

## Clinical Crosswalk Evidence and Stratification Validity

### NIMH ASQ Pathway and Concordance

The Ask Suicide-Screening Questions (ASQ) toolkit, developed by the National Institute of Mental Health (NIMH), utilizes a three-tiered clinical pathway to manage suicide risk in emergency department and medical inpatient settings. A review of the NIMH clinical pathway confirms that a "non-acute positive screen" is defined as a "Yes" response to any of the first four questions (assessing passive thoughts of death, active thoughts of suicide, plans, and history of attempts) combined with a "No" response to the fifth question, which assesses current active suicidal intent. Under the NIMH protocol, a non-acute positive screen mandates a Brief Suicide Safety Assessment (BSSA) to determine whether a full mental health evaluation is indicated. Mapping "non-acute positive" to a "Moderate" risk tier is clinically consistent with this pathway, as it represents a validated, elevated risk state that requires secondary triage but does not necessitate immediate safety precautions or prevent discharge before further evaluation.

A rigorous search of peer-reviewed psychometric literature indicates that, as of July 2026, no published systematic concordance studies exist that directly validate a mathematical equivalence mapping between the raw ASQ screening items and the Columbia-Suicide Severity Rating Scale (C-SSRS) Screener. However, in clinical practice and institutional guidelines, such as those from the Joint Commission, the ASQ BSSA and the C-SSRS are treated as functionally equivalent secondary assessment tools within tiered suicide care pathways.

### C-SSRS Screener Triage Guidance

The standard C-SSRS Screen Version classifies risk using a structured hierarchy of suicidal ideation severity and recent behaviors. The Columbia Lighthouse Project triage guidelines categorize risk into three primary intervention bands. "Low Risk" is defined by a "Yes" response restricted to Ideation Severity Level 1 (Wish to be dead) or Level 2 (Non-specific active suicidal thoughts) within the past month, with no reported history of suicidal behavior. "Moderate Risk" is triggered by Ideation Severity Level 3 (Active suicidal ideation with any methods but no intent to act) within the past month, or a historical suicide behavior (Q6) occurring more than three months ago. "High Risk" is defined by Ideation Severity Level 4 (Active suicidal ideation with some intent to act, without a specific plan) or Level 5 (Active suicidal ideation with a specific plan and intent) within the past month, or any positive response to suicidal behavior (Q6) occurring within the past three months.

Integrating this standard triage model into SPiER's five-tier system requires mapping C-SSRS High Risk directly to the "High" tier, while reserving the "Imminent" tier for patients who present with active Level 5 ideation coupled with immediate intent, the current availability of highly lethal means, and a refusal or inability to engage in safety planning.

### PHQ-9 Item 9 Predictive Validity

The ninth item of the Patient Health Questionnaire (PHQ-9) evaluates the frequency of passive thoughts of death or self-injury over the preceding two weeks. Extensive longitudinal predictive-validity research, including landmark studies by Simon et al. and subsequent validations by Louzon et al., confirms that any positive response to Item 9 (a score of 1, 2, or 3) is a powerful, statistically significant predictor of subsequent suicide attempts and suicide mortality. Simon et al. documented that outpatients who endorse suicidal ideation nearly every day on Item 9 are 5 to 8 times more likely to attempt suicide and 3 to 11 times more likely to die by suicide within 30 days compared to those who do not endorse the item.

However, comparative psychometric validation studies, such as Viguera et al., demonstrate that using Item 9 alone as a specific risk stratifier yields poor results. When validated against the electronic C-SSRS (eC-SSRS) as the gold standard, a PHQ-9 Item 9 cutoff score of 1 demonstrated a high sensitivity of 87.6% but a low specificity of 66.1%, resulting in a positive predictive value (PPV) of only 28.6%. Because Item 9 frequently captures non-suicidal self-injury (NSSI) and passive ideation without intent, mapping it to a "wider" (lower fidelity) "Moderate" risk flag is the most clinically defensible approach. This configuration ensures that a positive response triggers a mandatory secondary screener to clarify active intent without causing high rates of false-positive psychiatric consults.

### SBQ-R Psychometric Validation

The psychometric properties and cutoffs of the Suicidal Behaviors Questionnaire-Revised (SBQ-R) were validated in clinical and non-clinical populations by Osman et al. in 2001. Summed scores on the four-item instrument range from 3 to 18. Receiver operating characteristic (ROC) curve analyses indicate that a total score cutoff of 7 or higher effectively identifies individuals at elevated risk for suicidal behavior in general, non-clinical adult populations, achieving a sensitivity of 93% and a specificity of 95%. For clinical psychiatric populations (both adolescents and adults), Osman et al. established a higher cutoff score of 8 or higher to optimize diagnostic classification, maintaining a sensitivity of 80% and a specificity of 91%.

These validated cutoffs support a binary stratification of risk: scores below the population-specific thresholds (under 7 for non-clinical, under 8 for clinical) map to the "Low" risk tier, while scores at or above these thresholds map to the "Moderate/High" risk tier. Because the SBQ-R includes historical and anticipatory items (likelihood of future attempts), higher scores reflect a broad, chronic vulnerability rather than an acute, imminent crisis, meaning they cannot support an "Imminent" risk mapping without additional clinical triage.

### CAMS SSF Overall Risk Stratification

The Collaborative Assessment and Management of Suicidality (CAMS) framework uses the Suicide Status Form (SSF) as its core clinical tool. On Page 1 of the SSF, patients rate six suicide-related markers—including "Overall Risk of Suicide"—on a Likert scale ranging from 1 (Extremely low risk) to 5 (Extremely high risk). There are no published psychometric stratification studies that establish standard quantitative risk-tier mappings for the SSF core assessment. CAMS is designed as a collaborative, therapeutic assessment process rather than a standalone diagnostic or predictive screening tool.

To model the SSF Core Assessment in a FHIR ConceptMap, clinical informatics experts recommend mapping patient-rated scores of 1 to 2 to "Low Risk," a score of 3 to "Moderate Risk," and scores of 4 to 5 (which represent severe distress and active suicidal driving forces) to "High Risk". Because the CAMS SSF is therapeutic and depends on the collaborative stabilization plan (such as locking up firearms and medications), these mappings must remain flexible and subject to immediate clinician override within the EHR.

### High and Imminent Risk Boundary Analysis

Representing acute suicidality within standard terminology and clinical workflows requires establishing clear guidelines for the "high" versus "imminent" risk boundary.

* **Collapsing Imminent to LOINC High:** The LOINC code 93374-7 ("Suicide risk level") is bound to the Answer List LL465-6, which contains only the values Low, Moderate, and High. No "Imminent" or "Acute" option exists within the standard LOINC answer list. Clinical systems and standard profiles (such as the US Behavioral Health Profiles IG) address this by collapsing both high-risk and imminent-risk clinical states into the standard "High" LOINC code (LA9194-7) for cross-organizational HIE transmission. To prevent the clinical dilution of acute safety alerts, systems must maintain a dual-coding approach: mapping the local, highly critical "Imminent" code in a custom FHIR Observation.valueCodeableConcept to trigger localized emergency workflows (such as continuous line-of-sight observation), while translating the code to the standard LOINC "High" value for external exchange.
* **High/Imminent Boundary Definition:** Standardized triage frameworks (such as the Alberta Health Services Suicide Risk Level Criteria and the Zero Suicide Toolkit) define the boundary between high and imminent risk based on immediate intent and preparatory behaviors. "High Risk" is characterized by frequent, intense suicidal ideation, historical attempts, or a formulated plan, but the patient retains protective factors (such as reasons for living or family support) and is willing to collaborate on a safety plan. "Imminent Risk" is defined by active suicidal thoughts occurring now, combined with a specific plan, immediate access to lethal means, explicit intent to act, acute precipitating stressors, or active rehearsal behaviors (such as holding a weapon or collecting pills). Only patients identified as being in "Imminent Risk" are legally and clinically restricted from leaving the facility before a full psychiatric evaluation is completed.

### Gravity Project Process Precedents

The HL7 Gravity Project manages semantic mapping and clinical consensus through a structured, multi-stakeholder governance model. Gravity establishes a clinical advisory committee to conduct systematic literature reviews, drafts terminology mappings using standard FHIR ConceptMap resources, and defines semantic equivalence relationships using standard codes (such as equal, wider, narrower, and unmatched). These draft artifacts are published for public consensus voting and reviewed during HL7 ballot cycles before being finalized.

For a smaller group like the SPiER coalition, a lighter consensus process is recommended:

1. Establish a Technical and Clinical Workgroup of representing organizations to draft the ConceptMap files.
2. Explicitly document the clinical reasoning for every mapping element using the ConceptMap.element.target.comment field.
3. Publish the draft FHIR artifacts on a public GitHub repository.
4. Run a 30-day public comment period, tracking clinical feedback via GitHub Issues.
5. Record formal clinical sign-off from participating organizations in the IG's metadata before publishing.

## Terminology Status Check and Code System Verification

*(⚠️ See the verification annex — several specific codes in this section are wrong.)*

**SBQ-R:** No published LOINC codes exist for the SBQ-R panel, items, or total score as of July 2026. SPiER uses SNOMED CT concept 225337009 to represent the total score. *(Annex: code is real; display is "Suicide risk assessment", not an SBQ-R-specific concept.)*

**C-SSRS Full Version:** Screener codes are active in LOINC (93246-7, 93247-5, 93248-3, 93249-1, 93250-9, 93267-3). LOINC Panel 93373-9 represents the "Columbia-Suicide Severity Rating Scale - Screen version". Approximately 39 items in the long-form / full lifetime-recent version (such as intensity, frequency, controllability, and reasons for ideation) remain uncoded in standard LOINC releases. Systems must use local codes for these items. *(Note: LOINC 93245-9 "C-SSRS lifetime recent" panel exists and should be evaluated for the full version — see loinc.org search results.)*

**ASQ:** No official LOINC panel or item codes exist for the NIMH ASQ screening tool or the ASQ BSSA as of July 2026. Implementations must model these questions using local code systems inside FHIR Questionnaire resources.

**CAMS SSF Measures:** No LOINC coverage exists for the CAMS SSF core patient-rated measures (psychological pain, stress, agitation, hopelessness, self-hate, overall risk) as of July 2026. Local codes must be used.

**Stanley-Brown Safety Plan Document:** *(Annex: the codes claimed here — LOINC 81216-4 and SNOMED 735984001 — failed or were not verified. No LOINC safety-plan document code was found. The US Behavioral Health Profiles IG has no safety-plan profile, so there is no external alignment target; SPiER's local coding stands until a real code is identified.)*

**SNOMED CT Core Concepts:** *(Annex: only 6471006 Suicidal ideation and 82313006 Suicide attempt verified. The claimed codes for NSSI, safety-planning procedure, and lethal-means counseling were fabricated — real codes, if any exist, must be looked up before use.)*

**HL7 US Behavioral Health Profiles IG:** Published as a continuous build (v0.1.0). It represents suicide risk assessments using US Core QuestionnaireResponse and standard Observation profiles, coding overall suicide risk with LOINC 93374-7 and Answer List LL465-6 (where LA9194-7 represents "High"). SPiER must match these profiles to achieve US national interoperability.

**PSS-3 / SAFE-T / ED-SAFE (ESS-6):** No official LOINC panels exist. PSS-3 and ESS-6 must be implemented with local Questionnaire codes; SAFE-T is a clinical practice protocol rather than an assessment scale and is modeled in FHIR as an ActivityDefinition.

## Instrument Licensing and EHR Integration Audit

*(🔶 Plausible but unverified at source — confirm each publisher's current terms before writing ActivityDefinition.copyright text (issue #127). ❌ The "BSSA = Beck Scale / Pearson" row does NOT apply to SPiER's TL-005, which is the free NIMH Brief Suicide Safety Assessment.)*

| Instrument | Copyright holder | Clinical use | EHR/software embedding | Cost |
| --- | --- | --- | --- | --- |
| ASQ | NIMH | Free | Free; preserve wording, attribute | $0 |
| PHQ-9 | Pfizer | Free | Free; preserve wording and scoring | $0 |
| C-SSRS | Columbia Lighthouse Project | Free (with registration/training) | **Commercial EHR/software embedding requires a paid license**; non-commercial free with registration | Varies |
| SBQ-R | A. Osman (1999) | Free | Free; modifications need author permission | $0 |
| CAMS + SSF | Guilford Press & CAMS-care | Manual purchase required per clinician | **Strictly commercially licensed; custom digital implementations prohibited** — integrate official templates via CAMS-care (andrew@cams-care.com) | Paid |
| Stanley-Brown Safety Plan | Stanley & Brown (2008, 2021) | Free for clinical use | **Written permission required** for changes or commercial EHR integration (suicidesafetyplan.com) | Free clinical / fees possible |
| SAFE-T | D. Jacobs / Screening for Mental Health | Free | Free with formatting/credit preserved | $0 |
| NIMH BSSA (TL-005) | NIMH (part of ASQ toolkit) | Free | Free (public domain, per ASQ toolkit terms) | $0 |
| PSS-3 | UMass Chan Medical School | Free | Free; preserve wording, cite | $0 |
| ED-SAFE ESS-6 | UMass Chan Medical School | Free | Free; preserve wording, cite | $0 |
| Caring Contacts | Protocol (not proprietary) | Free | Free | $0 |
| CALM (lethal means) | EDC / SPRC | Free training + materials | Free to integrate | $0 |
| Now Matters Now | Now Matters Now | Free | Free to link/embed patient resources | $0 |
| Crisis Response Plan | C. Bryan / Suicide Prevention Training LLC | Free protocol | Free with attribution | Free clinical |
| Columbia post-visit tools | Columbia Lighthouse | Free | Covered under C-SSRS registration | $0 |

## Reusable Prior Art and Interoperability Precedents

* **NLM Form Builder / LHC-Forms:** open-source FHIR Questionnaire resources for the PHQ-9 and the C-SSRS Screen Version with embedded scoring, LOINC linkIds, and translations.
* **LOINC-provided Questionnaire renderings:** Regenstrief publishes FHIR Questionnaire profiles for standard panels including C-SSRS Screen (93373-9).
* **AHRQ CDS Connect:** CQL decision-support libraries that process PHQ-9 results and trigger tasks/alerts on thresholds.
* **VA REACH VET:** predictive-analytics risk identification prompting provider review, safety planning, and lethal-means safety.
* **ED-SAFE secondary-screener logic:** positive PSS-3 auto-triggers the ESS-6 secondary screener workflow.
* **EHR BPAs:** Epic/Oracle Health systems gate discharge orders on completed safety plan + means-safety checklist + psych consult after positive screens.
* **TEFCA / 42 CFR Part 2:** SUD-facility-authored risk assessments and safety plans require explicit consent for exchange; FHIR Consent + security labels are the standard mechanism.

## Implementation Implications (corrected issue numbers)

* **SME sign-off packet (#93):** compile Part A into a consensus document; highlight the imminent→LOINC-High collapse and recommend dual coding (local tier retained on the SPiER Observation; LOINC High only for the translated LL465-6 value).
* **CAMS ConceptMap (#91):** SSF Overall Risk 1–2 → low, 3 → moderate, 4–5 → high; document as decision-support guidance subject to clinician override; no published stratification exists, so mark equivalences `wider`/inexact and flag for SME review.
* **SBQ-R LOINC recheck (#96):** confirmed — no LOINC exists as of July 2026; keep SNOMED 225337009 but document its actual display ("Suicide risk assessment") and the local-choice rationale.
* **C-SSRS Full coding (#20):** evaluate binding to LOINC panel 93245-9 (lifetime-recent) / 93373-9 (screener); long-form items without codes stay on the local system; consider a Regenstrief submission for missing items.
* **Licensing metadata (#127/#64):** use the Part C table as the starting point, verify each at source; C-SSRS, CAMS, and Stanley-Brown need restrictive copyright notices; TL-005 BSSA is free NIMH content, not Pearson.
* **Planned-tool authoring (M3):** PSS-3 (#27) and ED-SAFE (#28) as Questionnaires with local codes; SAFE-T (#22) stays protocol-shaped (ActivityDefinition); BSSA (#21) is free to author from the NIMH toolkit; CALM (#32) and Caring Contacts (#26) as CarePlan/protocol templates, not scales.

## Works cited

(As provided by the research run — spot-check before relying on any specific claim.)

1. NIMH ASQ Toolkit — https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials
2. NIMH ED Suicide Risk Screening Pathway — https://www.nimh.nih.gov/sites/default/files/documents/suicide_risk_screening_clinical_pathway_ed_final_with_supplement.pdf
3. C-SSRS triage (988 Lifeline version) — https://988lifeline.org/wp-content/uploads/2016/09/Suicide-Risk-Assessment-C-SSRS-Lifeline-Version-2014.pdf
4. Alberta Health Services Suicide Risk Level Criteria — https://www.albertahealthservices.ca/assets/info/amh/if-amh-suicide-risk-level-criteria.pdf
5. Simon et al., suicidal ideation on PHQ-9 and risk — https://pmc.ncbi.nlm.nih.gov/articles/PMC5412508/
6. Louzon et al., PHQ-9 Item 9 and suicide in VA — https://psychiatryonline.org/doi/pdf/10.1176/appi.ps.201500149
7. Viguera et al., PHQ-9 Item 9 vs eC-SSRS validation — https://www.researchgate.net/publication/323249831
8. Osman et al. 2001, SBQ-R validation — https://www.cebc4cw.org/measurement-tools/suicide-behaviors-questionnaire-revised/
9. CAMS SSF-4 form — https://psychotherapymatters.com/wp-content/uploads/CAMS-SSF.pdf
10. CAMS-care licensing FAQs — https://cams-care.com/faqs/
11. Columbia Lighthouse Project — https://cssrs.columbia.edu/
12. Stanley-Brown Safety Plan — https://suicidesafetyplan.com/
13. US Behavioral Health Profiles IG (continuous build) — https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/
14. PSS-3 — https://www.umassmed.edu/globalassets/emergency-medicine/documents/patient-safety-screener-3-8.1.17.pdf
15. CALM (SPRC) — https://sprc.org/resources/calm-counseling-on-access-to-lethal-means/
16. VA/DoD Lethal Means Safety Counseling — https://www.healthquality.va.gov/guidelines/MH/srb/Lethal-Means-Safety-Counseling-for-Providers-508.pdf
17. Zero Suicide screening toolkit — https://zerosuicide.edc.org/toolkit/identify-screening-and-assessment/screening
18. Now Matters Now — https://www.nowmattersnow.org/
19. Crisis Response Plan — https://crpforsuicideprevention.com/
20. AHRQ / eCQI suicide risk assessment measure — https://ecqi.healthit.gov/sites/default/files/ecqm/measures/CMS161v8.html
