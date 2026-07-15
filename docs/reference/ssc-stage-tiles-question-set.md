# Simplified Salesforce EHR Stage Tiles — SSC-Mapped Question Set

> **Status in this repo:** This document is the source spec for the pathway
> stage/tool structure adopted in July 2026 (stage codes
> `identify-possible-risk`, `clarify-risk`, `define-risk-picture`,
> `document-safety-actions`, `coordinate-handoffs`, `track-follow-up`,
> `track-risk-over-time`, `measure-and-share`). The stage PlanDefinitions in
> `ig/input/fsh/pathway-stages.fsh` and the tool catalog in
> `web/src/data/catalog/` mirror its eight tiles and per-tile tool lists.
> The per-question SSC mappings and scores below are reference only — they
> are not (yet) encoded as machine-readable data in this repo.

Purpose: This document adds SSC minimum dataset mappings and numerical adoption/maturity values to the EHR-specific questions in the simplified Salesforce stage tiles. Partner, evidence, build-plan, date, implementation-status, and notes fields are retained but intentionally not SSC-mapped unless they directly represent an EHR capability.

Source: Simplified Salesforce stage-tile document and SPiER Suicide Safer Care Vendor Data Dictionary v1.12.

## Scoring legend

| Score | Meaning |
| :---- | :---- |
| -1 | Not assessed, unknown, or not applicable |
| 0 | No support / not available |
| 1 | Manual, narrative, PDF, note-only, or weak/non-discrete support |
| 2 | Partial support, in build, or limited/custom support |
| 3 | Available and usable / electronic / structured or reportable support |
| 4 | Verified or mature support; native/standard/full structured/reporting capability |
| Multi-select coverage value 1 | For multi-select content coverage questions, each selected clinical data element is scored 1; Other is 0; Unknown/Not applicable is -1. |

## Mapping flags and assumptions

- Only EHR-functionality questions are SSC-mapped. Evidence, PDF/source links, build-plan fields, start/finish dates, implementation-status fields, ownership, marketing, evaluation, and general notes are intentionally not mapped to SSCs.
- SSC-004 Screening setting is not mapped inside each tool because setting is captured at the EHR/product level, not repeated under each tool. If Salesforce needs SSC-004 reporting, add/map a product/encounter setting field outside the tool question list.
- The uploaded v1.12 data dictionary includes SSC-049–SSC-052 for SCS-R treatment-response monitoring. The simplified Salesforce stage-tile document does not currently include an SCS-R tool. No false tool mapping was created; add SCS-R under Track Risk Over Time to capture those SSCs directly.
- Stage 8 uses the corrected structure: KPI / Measure Reporting, Reporting Dashboard / Aggregate View, Data Export / Analytics Extract, and Data Sharing / Interoperability Output. Gap/exception logic remains in Stage 7, and build/version status remains in implementation fields.
- Broad export/interoperability questions map to ranges such as SSC-001–SSC-052 only when the export/share can actually include those structured SSC fields. The spreadsheet flags these as broad mappings rather than assuming every field is present.
- Multi-select option scores are coverage indicators, not maturity scores. A selected clinical data element is scored 1; Other is 0; Unknown/Not applicable are -1. Maturity picklists use -1/0/1/2/3/4.

# Stage Tile 1: Identify Possible Risk

**Purpose:** Find a suicide-risk signal and determine whether more review is needed.

Tools/functionality included under this tile:

1. Ask Suicide-Screening Questions (ASQ)
2. PHQ-9 / PHQ-A Item 9 Trigger
3. C-SSRS Screener / Triage Points
4. C-SSRS Pediatric / Adolescent Version
5. PSS-3 / Patient Safety Screener-3
6. Suicide Behaviors Questionnaire–Revised (SBQ-R)
7. Positive Screen Flag / Suicide-Risk Workflow Trigger

## 1. Ask Suicide-Screening Questions (ASQ)

**1. Is ASQ available in the EHR today?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-006
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is ASQ available?** SSC-001, SSC-002
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete ASQ electronically in the EHR?** SSC-001, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the ASQ answers/results saved as structured data?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR automatically identify the ASQ result?** SSC-005, SSC-006
**Picklist options:** No (0); Yes — negative/positive only (3); Yes — negative/positive/acute positive (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when ASQ is positive?** SSC-005, SSC-006
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, assessment prompt, safety plan prompt, risk flag, or other next step.

**7. Can ASQ completion/results be reported on?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8. Evidence upload or link** — File / URL. Screenshot, demo recording, build guide, report sample, or vendor documentation.

**9. Link for PDF or source tool** — URL

**10. If ASQ is not available or only partial, what is the build plan?**
**Picklist options:** No plan; Planned/roadmap; Build started; Pilot/beta; Need vendor follow-up; Unknown; Not applicable because already live

**11. Planned start date** — Date
**12. Actual build start date** — Date
**13. Executed finish date** — Date

**14. Implementation status**
**Picklist options:** Not started; Requirements gathered; Build in progress; Testing/UAT; Live; Paused; Blocked; Not applicable

**15. Notes** — Long text

## 2. PHQ-9 / PHQ-A Item 9 Trigger

**1. Is PHQ-9 / PHQ-A Item 9 available in the EHR today?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-007
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is PHQ-9 / PHQ-A Item 9 available?** SSC-001, SSC-002, SSC-007
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete PHQ-9 / PHQ-A electronically in the EHR?** SSC-001, SSC-003, SSC-007
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Is Item 9 saved as structured data?** SSC-007
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR calculate the PHQ total score and separately flag Item 9 when it is positive?** SSC-005, SSC-007
**Picklist options:** No (0); Yes — Item 9 positive only (3); Yes — PHQ total score only (2); Yes — PHQ total score plus Item 9 flag (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when Item 9 is positive?** SSC-005, SSC-007
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, C-SSRS prompt, suicide-risk assessment prompt, safety plan prompt, risk flag, or other next step.

**7. Can PHQ-9 / PHQ-A Item 9 results be reported on?** SSC-001, SSC-003, SSC-005, SSC-007
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–15.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. C-SSRS Screener / Triage Points

**1. Is the C-SSRS Screener available in the EHR today?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-006, SSC-010, SSC-011, SSC-014, SSC-015, SSC-020
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is C-SSRS available?** SSC-001, SSC-002
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the C-SSRS electronically in the EHR?** SSC-001, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the C-SSRS answers saved as structured data?** SSC-001, SSC-005, SSC-006, SSC-010, SSC-011, SSC-014, SSC-015
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR automatically identify a positive screen, high-risk response, or triage tier from C-SSRS responses?** SSC-005, SSC-006, SSC-020
**Picklist options:** No (0); Yes — positive/negative only (3); Yes — high-risk responses (3); Yes — triage/risk tier (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. Does the EHR support C-SSRS triage/risk-tier logic?** SSC-005, SSC-006, SSC-020
**Picklist options:** No (0); Yes, built in/native (4); Yes, configured/custom (3); Partial (2); Unknown (-1); Not applicable (-1)

**7. Which risk pathways can the EHR support?** SSC-020
**MultiSelect options:** No pathway (0); Historical risk (1); Low risk (1); Moderate risk (1); High risk (1); Local/custom tier only (1); Unknown (-1); Not applicable (-1)

**8. Can the EHR tell the difference between lifetime history and current/recent risk?** SSC-011, SSC-014, SSC-015, SSC-020
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**9. What happens after each C-SSRS risk tier?** SSC-020
**Response type:** Long text
**Prompt:** Describe what happens for Historical, Low, Moderate, and High risk.

**10. Can high risk trigger urgent action?** SSC-006, SSC-020, SSC-045
**Picklist options:** No (0); Alert only (2); Task/work queue (3); STAT safety evaluation workflow (4); Consult/referral/escalation workflow (4); Unknown (-1); Not applicable (-1)

**11. Can the risk tier trigger a reassessment schedule?** SSC-020, SSC-045
**Picklist options:** No (0); Manual only (1); Yes, reminder/task (3); Yes, tier-specific schedule (4); Unknown (-1); Not applicable (-1)

**12. Can C-SSRS completion, risk tier, and next steps be reported on?** SSC-001, SSC-003, SSC-005, SSC-006, SSC-020
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**13.–20.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. C-SSRS Pediatric / Adolescent Version

**1. Is the C-SSRS Pediatric / Adolescent Version available in the EHR today?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-006, SSC-010, SSC-011, SSC-014, SSC-015, SSC-020
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the C-SSRS Pediatric / Adolescent Version available?** SSC-001, SSC-002
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the C-SSRS Pediatric / Adolescent Version electronically in the EHR?** SSC-001, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the answers/results saved as structured data?** SSC-001, SSC-005, SSC-006, SSC-010, SSC-011, SSC-014, SSC-015
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR automatically identify positive or high-risk responses from the pediatric/adolescent version?** SSC-005, SSC-006, SSC-020
**Picklist options:** No (0); Yes — positive/negative only (3); Yes — high-risk responses (3); Yes — triage/risk tier (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when the result is positive?** SSC-005, SSC-006
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, assessment prompt, safety plan prompt, risk flag, or other next step.

**7. Can completion/results be reported on?** SSC-001, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–15.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 5. PSS-3 / Patient Safety Screener-3

**1. Is PSS-3 available in the EHR today?** SSC-001, SSC-002, SSC-003, SSC-005, SSC-006
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is PSS-3 available?** SSC-001, SSC-002
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete PSS-3 electronically in the EHR?** SSC-001, SSC-003, SSC-005
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the PSS-3 answers/results saved as structured data?** SSC-001, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR automatically identify whether the PSS-3 screen is positive and trigger the next step?** SSC-005, SSC-006
**Picklist options:** No (0); Yes — positive/negative only (3); Yes — high-risk responses (3); Yes — positive result plus next-step trigger (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when PSS-3 is positive?** SSC-005, SSC-006
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, assessment prompt, safety plan prompt, risk flag, or other next step.

**7. Can PSS-3 completion/results be reported on?** SSC-001, SSC-003, SSC-005, SSC-006
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–15.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 6. Suicide Behaviors Questionnaire–Revised (SBQ-R)

**1. Is SBQ-R available in the EHR today?** SSC-001, SSC-002, SSC-003, SSC-005
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is SBQ-R available?** SSC-001, SSC-002
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete SBQ-R electronically in the EHR?** SSC-001, SSC-003, SSC-005
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the SBQ-R answers/results saved as structured data?** SSC-001, SSC-002, SSC-003, SSC-005
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR automatically calculate the SBQ-R total score and identify whether it meets the risk cutoff?** SSC-005
**Picklist options:** No (0); Yes — score only (2); Yes — cutoff/risk flag only (3); Yes — score plus cutoff/risk flag (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when SBQ-R is positive?** SSC-005
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, assessment prompt, safety plan prompt, risk flag, or other next step.

**7. Can SBQ-R completion/results be reported on?** SSC-001, SSC-002, SSC-003, SSC-005
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–15.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 7. Positive Screen Flag / Suicide-Risk Workflow Trigger

**1. Does the EHR currently create a suicide-risk flag or start a suicide-risk workflow after a positive screen?** SSC-005, SSC-006, SSC-020, SSC-043
**Picklist options:** Not assessed (-1); No (0); Partial (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. What positive results can start the flag/workflow?** SSC-005, SSC-006, SSC-007
**Multiselect options:** PHQ-9 item 9 (1); ASQ (1); C-SSRS (1); PSS-3 (1); SBQ-R (1); Manual clinical judgment (1); Other (0); Unknown (-1)

**3. Does the EHR use positive results automatically, or does staff have to start the flag/workflow manually?** SSC-005, SSC-006, SSC-020, SSC-043
**Picklist options:** Manual only (1); Automatic from one tool (3); Automatic from multiple tools (4); Both manual and automatic (4); Partial (2); Unknown (-1); Not applicable (-1)

**4. Where does the flag or workflow show up?** SSC-020, SSC-043
**Multiselect options:** Chart banner (1); Problem list (1); Work queue (1); Task list (1); Assessment section (1); Care plan (1); Report/dashboard (1); Other (0); Unknown (-1)

**5. Who is notified or assigned follow-up?** SSC-039, SSC-040, SSC-045
**Multiselect options:** Primary care provider (1); Behavioral health provider (1); Care manager (1); Crisis team (1); Supervisor (1); No one (0); Other (0); Unknown (-1)

**6. What action does the EHR trigger?** SSC-005, SSC-006, SSC-025, SSC-032, SSC-034, SSC-039, SSC-045
**Multiselect options:** No action (0); Alert only (1); Task (2); Suicide-risk assessment (3); Safety plan (3); Lethal means counseling (3); Referral (3); Follow-up outreach (3); Escalation (4); Other (0); Unknown (-1)

**7. Can staff document that the next step was completed?** SSC-040, SSC-041, SSC-042, SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1)

**8. Can the flag/workflow be cleared, closed, or resolved?** SSC-043, SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1)

**9. Can this flag/workflow be reported on?** SSC-005, SSC-006, SSC-020, SSC-043, SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1)

**10.–16.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 2: Clarify Risk

**Purpose:** After a suicide-risk signal is identified, determine what is going on clinically: suicidal thoughts, plan, intent, behavior history, access to means, risk factors, protective factors, and whether further action is needed.

Tools/functionality included under this tile:

1. NIMH Brief Suicide Safety Assessment / BSSA
2. C-SSRS Full Scale / Lifetime + Recent
3. C-SSRS Since Last Visit / Since Last Contact
4. Patient Safety Screener / Suicide Risk Screener Full
5. Cultural Assessment of Risk for Suicide / CARS-S
6. CAMS SSF-5
7. Full Suicide-Risk Assessment / Local Assessment Tool

## 1. NIMH Brief Suicide Safety Assessment / BSSA

**1. Is BSSA available in the EHR today?** SSC-008, SSC-009, SSC-010, SSC-012, SSC-013, SSC-014, SSC-017, SSC-018, SSC-019, SSC-022
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is BSSA available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete BSSA electronically in the EHR?** SSC-008, SSC-009, SSC-010, SSC-012, SSC-013, SSC-014, SSC-017, SSC-018, SSC-019
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the BSSA answers/results saved as structured data?** SSC-008, SSC-009, SSC-010, SSC-012, SSC-013, SSC-014, SSC-017, SSC-018, SSC-019, SSC-022
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR capture the BSSA assessment result/recommendation and route the next step?** SSC-022
**Picklist options:** No (0); Yes — result/recommendation only (3); Yes — result/recommendation plus next-step routing (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What clinical details does BSSA capture?** SSC-008, SSC-009, SSC-010, SSC-012, SSC-013, SSC-014, SSC-017, SSC-018, SSC-019, SSC-022
**Multiselect options:** Suicidal thoughts (1); Suicide plan (1); Intent (1); Past suicidal behavior (1); Access to means (1); Risk factors (1); Protective factors (1); Disposition/recommendation (1); Other (0); Unknown (-1)

**7. What happens after BSSA is completed?** SSC-022, SSC-025, SSC-032, SSC-034, SSC-039
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, safety plan prompt, lethal means counseling prompt, disposition recommendation, risk flag, or other next step.

**8. Can BSSA completion/results be reported on?** SSC-008, SSC-009, SSC-010, SSC-012, SSC-013, SSC-014, SSC-017, SSC-018, SSC-019, SSC-022
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 2. C-SSRS Full Scale / Lifetime + Recent

**1. Is the C-SSRS Full Scale / Lifetime + Recent version available in the EHR today?** SSC-008, SSC-009, SSC-010, SSC-011, SSC-012, SSC-013, SSC-014, SSC-015, SSC-016, SSC-017, SSC-018, SSC-019
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is this C-SSRS version available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete this C-SSRS version electronically in the EHR?** SSC-008–SSC-019 (as q1)
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the C-SSRS answers/results saved as structured data?** SSC-008–SSC-019 (as q1)
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR identify key positive or high-risk findings from the structured C-SSRS responses?** SSC-010, SSC-011, SSC-012, SSC-013, SSC-014, SSC-015, SSC-017, SSC-020
**Picklist options:** No (0); Yes — positive findings only (3); Yes — high-risk findings (3); Yes — positive/high-risk findings plus workflow flag (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What clinical details does this C-SSRS version capture?** SSC-008–SSC-019 (as q1)
**Multiselect options:** Suicidal thoughts (1); Suicide plan (1); Intent (1); Past suicidal behavior (1); Interrupted attempt (1); Aborted attempt (1); Preparatory behavior (1); Recency/timeframe (1); Access to means (1); Risk/protective details (1); Other (0); Unknown (-1)

**7. What happens after this C-SSRS assessment is completed?** SSC-020, SSC-022, SSC-025, SSC-032, SSC-034, SSC-039
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, safety plan prompt, lethal means counseling prompt, disposition recommendation, risk flag, or other next step.

**8. Can C-SSRS Full Scale completion/results be reported on?** SSC-008–SSC-019 (as q1)
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. C-SSRS Since Last Visit / Since Last Contact

**1. Is the C-SSRS Since Last Visit / Since Last Contact version available in the EHR today?** SSC-008–SSC-020, SSC-043
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is this C-SSRS version available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete this C-SSRS version electronically in the EHR?** SSC-008–SSC-019
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the C-SSRS answers/results saved as structured data?** SSC-008–SSC-019
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR identify whether risk has changed since last contact and update the current risk workflow?** SSC-010, SSC-011, SSC-014, SSC-015, SSC-020, SSC-043, SSC-045
**Picklist options:** No (0); Yes — identifies change only (3); Yes — updates current risk workflow (3); Yes — identifies change plus updates workflow (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What clinical details does this C-SSRS version capture?** SSC-010–SSC-019
**Multiselect options:** New suicidal thoughts since last contact (1); New suicidal behavior since last contact (1); Change in plan/intent (1); Change in access to means (1); Recency/timeframe (1); Risk/protective updates (1); Other (0); Unknown (-1)

**7. What happens after this reassessment is completed?** SSC-020, SSC-025, SSC-039, SSC-043, SSC-045
**Response type:** Long text
**Prompt:** Describe whether the result updates the current risk status, creates an alert, task, referral, safety plan prompt, reassessment schedule, risk flag, or other next step.

**8. Can C-SSRS Since Last Visit / Since Last Contact completion/results be reported on?** SSC-008–SSC-020, SSC-043
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. Patient Safety Screener / Suicide Risk Screener Full

**1. Is the full Patient Safety Screener / Suicide Risk Screener available in the EHR today?** SSC-008, SSC-009, SSC-010, SSC-012, SSC-013, SSC-014, SSC-017, SSC-018, SSC-019, SSC-022
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the full Patient Safety Screener / Suicide Risk Screener available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the full screener electronically in the EHR?** SSC-008–SSC-019
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the answers/results saved as structured data?** SSC-008–SSC-022 (as q1)
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR calculate the result or triage level from the full screener?** SSC-020, SSC-022
**Picklist options:** No (0); Yes — result only (3); Yes — triage level only (3); Yes — result plus triage level (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What clinical details does the full screener capture?** SSC-008–SSC-022 (as q1)
**Multiselect options:** Suicidal thoughts (1); Suicide plan (1); Intent (1); Past suicidal behavior (1); Recent behavior (1); Access to means (1); Risk factors (1); Protective factors (1); Disposition/recommendation (1); Other (0); Unknown (-1)

**7. What happens after the full screener is completed?** SSC-020, SSC-022, SSC-025, SSC-032, SSC-034, SSC-039
**Response type:** Long text
**Prompt:** Describe whether the result creates an alert, task, referral, safety plan prompt, lethal means counseling prompt, disposition recommendation, risk flag, or other next step.

**8. Can full screener completion/results be reported on?** SSC-008–SSC-022 (as q1)
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 5. Cultural Assessment of Risk for Suicide / CARS-S

**1. Is CARS-S available in the EHR today?** SSC-008, SSC-009, SSC-010, SSC-014, SSC-018, SSC-019
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is CARS-S available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete CARS-S electronically in the EHR?** SSC-008, SSC-010, SSC-014, SSC-018, SSC-019
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the CARS-S answers/results saved as structured data?** SSC-008, SSC-009, SSC-010, SSC-014, SSC-018, SSC-019
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can the EHR calculate the CARS-S score/result and show relevant domains or flags?** SSC-018, SSC-019
**Picklist options:** No (0); Yes — score/result only (3); Yes — domains only (3); Yes — score/result plus domains/flags (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What clinical details does CARS-S capture?** SSC-010, SSC-014, SSC-018, SSC-019
**Multiselect options:** Cultural risk factors (1); Cultural protective factors (1); Suicidal thoughts (1); Suicide history (1); Stressors (1); Identity/community factors (1); Barriers to disclosure (1); Follow-up needs (1); Other (0); Unknown (-1)

**7. What happens after CARS-S is completed?** SSC-018, SSC-019, SSC-021, SSC-025, SSC-034
**Response type:** Long text
**Prompt:** Describe whether the result informs formulation, safety planning, care planning, referral, risk flagging, or another next step.

**8. Can CARS-S completion/results be reported on?** SSC-008, SSC-010, SSC-014, SSC-018, SSC-019
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 6. CAMS SSF-5

**Note:** This is one CAMS tool. Do not split it into First Session, Interim Session, and Outcome/Disposition as separate tools. Session-specific details are captured inside the SSF-5 row.

**1. Has the CAMS/Guilford content distribution agreement been completed for this vendor/product?**
**Picklist options:** Not assessed; No; In progress; Yes; Yes + verified; Unknown; Not applicable
*Note: Licensing/partner process; not an SSC data element.*

**2. Is CAMS SSF-5 available in the EHR today?** SSC-008–SSC-022, SSC-025
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**3. How is CAMS SSF-5 available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**4. Can staff complete CAMS SSF-5 electronically in the EHR?** SSC-008–SSC-022, SSC-025
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**5. Are the CAMS SSF-5 answers/results saved as structured data?** SSC-008–SSC-022, SSC-025
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**6. Does the EHR preserve CAMS ratings and session information without creating an unapproved automated risk score?** SSC-010–SSC-022
**Picklist options:** No (0); Yes (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. Which SSF-5 session-specific forms are supported inside the CAMS SSF-5 build?** SSC-008, SSC-009
**Picklist options:** First Session (1); Interim Sessions (1); Outcome/Disposition Final Session (1); All three (3); Partial (2); Unknown (-1); Not applicable (-1)

**8. Does the build keep the session-specific logic clear?** SSC-008, SSC-009, SSC-020, SSC-022
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**9. What happens after CAMS SSF-5 is completed?** SSC-020, SSC-021, SSC-022, SSC-025, SSC-039
**Response type:** Long text
**Prompt:** Describe whether the result updates the treatment plan, prompts stabilization planning, supports reassessment, creates a follow-up task, documents outcome/disposition, or routes to another next step.

**10. Can CAMS SSF-5 completion/results be reported on?** SSC-008–SSC-022, SSC-025
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**11.–17.** Evidence upload or link (screenshot, demo recording, build guide, report sample, completed agreement, or vendor documentation); Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 7. Full Suicide-Risk Assessment / Local Assessment Tool

**Note:** For EHRs that do not use one of the named assessment tools but have their own suicide-risk assessment form or workflow.

**1. Is a full suicide-risk assessment or local assessment tool available in the EHR today?** SSC-008–SSC-019, SSC-022
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the local assessment available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the local assessment electronically in the EHR?** SSC-008–SSC-019
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the answers/results saved as structured data?** SSC-008–SSC-019, SSC-022
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Does this local tool have scoring or result logic, and does the EHR calculate it automatically?** SSC-010–SSC-014, SSC-017, SSC-020, SSC-022
**Picklist options:** No scoring/result logic (1); Scoring/result exists but is manual (2); Yes — EHR calculates score/result (3); Yes — EHR calculates score/result and triggers workflow (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What clinical details does the local assessment capture?** SSC-008–SSC-019, SSC-022
**Multiselect options:** Suicidal thoughts (1); Suicide plan (1); Intent (1); Past suicidal behavior (1); Access to means (1); Risk factors (1); Protective factors (1); Disposition/recommendation (1); Other (0); Unknown (-1)

**7. What happens after the local assessment is completed?** SSC-020, SSC-022, SSC-025, SSC-032, SSC-034, SSC-039
**Response type:** Long text

**8. Can local assessment completion/results be reported on?** SSC-008–SSC-019, SSC-022
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 3: Define the Risk Picture

**Purpose:** The EHR supports documenting the current risk status and the clinical reasoning that guides next steps.

Tools/functionality included under this tile:

1. SAFE-T
2. CAMS Therapeutic Worksheet

## 1. SAFE-T

**1. Is SAFE-T available in the EHR today?** SSC-008, SSC-009, SSC-018, SSC-019, SSC-020, SSC-021, SSC-022, SSC-023, SSC-024
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is SAFE-T available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete SAFE-T electronically in the EHR?** SSC-018–SSC-024
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the SAFE-T answers/results saved as structured data?** SSC-018–SSC-024
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some answers structured (2); All answers structured (4); Unknown (-1); Not applicable (-1)

**5. Can SAFE-T capture the current suicide risk level and clinical rationale?** SSC-020, SSC-021
**Picklist options:** No (0); Yes — risk level only (3); Yes — rationale only (3); Yes — risk level plus rationale (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. Can SAFE-T capture the disposition or next-step decision?** SSC-022
**Picklist options:** No (0); Yes — disposition only (3); Yes — next-step recommendation only (3); Yes — disposition plus next-step workflow (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. Can staff override or change the risk level and document why?** SSC-023, SSC-024
**Picklist options:** No (0); Yes — free-text reason only (2); Yes — structured reason only (3); Yes — structured reason plus note (4); Partial (2); Unknown (-1); Not applicable (-1)

**8. Can the SAFE-T result update or connect to a suicide-risk flag, chart banner, or problem list?** SSC-020, SSC-043
**Picklist options:** No (0); Manual only (1); Yes — chart flag/banner (3); Yes — problem list (3); Yes — risk pathway/status field (4); Partial (2); Unknown (-1); Not applicable (-1)

**9. What happens after SAFE-T is completed?** SSC-020, SSC-021, SSC-022, SSC-025, SSC-032, SSC-034, SSC-039, SSC-045
**Response type:** Long text

**10. Can SAFE-T completion/results be reported on?** SSC-018–SSC-024
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**11.–18.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 2. CAMS Therapeutic Worksheet

**1. Has the CAMS/Guilford content distribution agreement been completed for this vendor/product?**
**Picklist options:** Not assessed; No; In progress; Yes; Yes + verified; Unknown; Not applicable
*Note: Licensing/partner process; not an SSC data element.*

**2. Is the CAMS Therapeutic Worksheet available in the EHR today?** SSC-018, SSC-019, SSC-021, SSC-025
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**3. How is the CAMS Therapeutic Worksheet available?** SSC-008, SSC-009
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**4. Can staff complete the CAMS Therapeutic Worksheet electronically in the EHR?** SSC-018, SSC-019, SSC-021, SSC-025
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**5. Are the CAMS Therapeutic Worksheet answers/results saved as structured data?** SSC-018, SSC-019, SSC-021
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some structured fields plus narrative (3); Fully structured (4); Unknown (-1); Not applicable (-1)

**6. Does the EHR capture the patient's direct and indirect drivers of suicidality?** SSC-018, SSC-019, SSC-021
**Picklist options:** No (0); Yes — direct drivers only (3); Yes — indirect drivers only (3); Yes — direct and indirect drivers (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. Does the EHR capture the suicide crisis working model?** SSC-021
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**8. Can the worksheet connect to the CAMS SSF-5, treatment plan, or stabilization plan?** SSC-021, SSC-025
**Picklist options:** No (0); Yes — SSF-5 only (2); Yes — treatment plan only (2); Yes — stabilization plan only (2); Yes — multiple CAMS forms/plans (4); Partial (2); Unknown (-1); Not applicable (-1)

**9. Does the EHR preserve the CAMS Therapeutic Worksheet without creating an unapproved automated risk score?** SSC-021
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**10. What happens after the CAMS Therapeutic Worksheet is completed?** SSC-021, SSC-025
**Response type:** Long text

**11. Can CAMS Therapeutic Worksheet completion/results be reported on?** SSC-018, SSC-019, SSC-021, SSC-025
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**12.–19.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 4: Document Safety Actions

**Purpose:** The EHR supports documenting and updating the concrete actions used to reduce risk and support safety.

Tools/functionality included under this tile:

1. Stanley-Brown Safety Plan / Safety Planning Intervention
2. Lethal Means Safety Counseling / Means Safety Actions
3. Crisis Response Plan / Crisis Planning
4. CAMS Stabilization Support Plan
5. Patient-Facing Crisis Resources / Coping Supports

## 1. Stanley-Brown Safety Plan / Safety Planning Intervention

**Note:** If Stanley-Brown approval is Yes or Yes + verified, the approved language, six steps, sequence, field structure, labels, attribution/copyright language, and patient-facing version are treated as acceptable.

**1. Is the Stanley-Brown Safety Plan available in the EHR today?** SSC-025–SSC-033
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. Has the Stanley-Brown team reviewed and approved this EHR build?**
**Picklist options:** Not assessed; No; Not submitted yet; Submitted for review; Changes requested; Yes; Yes + verified; Not applicable
*Note: Approval is a fidelity/permission gate, not a minimum dataset element. If yes/verified, fidelity items are assumed.*

**3. What evidence or approval documentation do we have?**
**Multiselect options:** None yet; Screenshot/build documentation; Approval email; Demo observed; Print/PDF output; Patient-facing output; Multiple evidence types; Unknown

**4. Evidence upload or link** — File / URL. Screenshots, build documentation, print/PDF output, patient-facing output, approval email, or vendor documentation.

**5. Can staff complete the safety plan electronically in the EHR?** SSC-025, SSC-026, SSC-028–SSC-033
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**6. Are the safety plan responses captured as separate, repeatable fields rather than one general text box?** SSC-028–SSC-033
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**7. Can the safety plan be printed, shared, or provided to the patient?** SSC-027
**Picklist options:** No (0); Printed only (2); Patient portal (3); PDF/download (3); Sent by message/email (3); Multiple options (4); Unknown (-1); Not applicable (-1)

**8. What happens after the Stanley-Brown Safety Plan is completed?** SSC-025, SSC-026, SSC-027
**Response type:** Long text

**9. Can Stanley-Brown Safety Plan completion/results be reported on?** SSC-025–SSC-033
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**10. If the Stanley-Brown Safety Plan is not available, not approved, or only partial, what is the build/review plan?**
**Picklist options:** No plan; Planned/roadmap; Build started; Awaiting screenshots/build documentation; Submitted for Stanley-Brown review; Changes requested; Pilot/beta; Need vendor follow-up; Unknown; Not applicable because already live and approved

**11.–13.** Planned start date; Actual build start date; Executed finish date — Dates

**14. Implementation status**
**Picklist options:** Not started; Requirements gathered; Build in progress; Submitted for Stanley-Brown review; Changes requested; Testing/UAT; Live; Paused; Blocked; Not applicable

**15. Notes** — Long text

## 2. Lethal Means Safety Counseling / Means Safety Actions

**1. Is lethal means safety counseling available to document in the EHR today?** SSC-032, SSC-033
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is lethal means safety counseling available?** SSC-032, SSC-033
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff document lethal means safety counseling electronically in the EHR?** SSC-032, SSC-033
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are lethal means safety counseling/actions saved as structured data?** SSC-032, SSC-033
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some actions structured (2); All actions structured (4); Unknown (-1); Not applicable (-1)

**5. What means safety actions can the EHR capture?** SSC-017, SSC-032, SSC-033
**Multiselect options:** Firearms (1); Medications (1); Sharps/blades (1); Ligature/hanging risk (1); Vehicle/car access (1); Other identified method (1); Storage plan (1); Removal plan (1); Support person responsible (1); Other (0); Unknown (-1); Not applicable (-1)

**6. Can staff document whether the agreed means safety action was completed?** SSC-033
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**7. Can the EHR assign someone responsible for the means safety action?** SSC-033
**Picklist options:** No (0); Yes — patient only (2); Yes — clinician only (2); Yes — support person/caregiver (3); Yes — multiple responsible parties (4); Partial (2); Unknown (-1); Not applicable (-1)

**8. What happens after lethal means safety counseling is documented?** SSC-032, SSC-033
**Response type:** Long text

**9. Can lethal means counseling/actions be reported on?** SSC-032, SSC-033
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**10.–17.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. Crisis Response Plan / Crisis Planning

**1. Is a crisis response plan or crisis planning tool available in the EHR today?** SSC-025–SSC-033
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the crisis response plan available?** SSC-025, SSC-026
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the crisis response plan electronically in the EHR?** SSC-025, SSC-026, SSC-028–SSC-033
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are the crisis response plan sections saved as structured data?** SSC-028–SSC-033
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some sections structured (2); All sections structured (4); Unknown (-1); Not applicable (-1)

**5. What crisis response content can the EHR capture?** SSC-028–SSC-033
**Multiselect options:** Crisis warning signs (1); Coping steps (1); Support contacts (1); Crisis line/988 (1); Emergency instructions (1); Reasons for living (1); Means safety actions (1); Other (0); Unknown (-1)

**6. Can the crisis response plan be shared with the patient?** SSC-027
**Picklist options:** No (0); Print only (2); PDF only (3); Portal only (3); Text/email/shareable link (3); Multiple options (4); Unknown (-1); Not applicable (-1)

**7. What happens after the crisis response plan is completed?** SSC-025, SSC-026, SSC-027, SSC-034, SSC-039
**Response type:** Long text

**8. Can crisis response plan completion/results be reported on?** SSC-025–SSC-033
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–16.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. CAMS Stabilization Support Plan

**1. Has the CAMS/Guilford content distribution agreement been completed for this vendor/product?**
**Picklist options:** Not assessed; No; In progress; Yes; Yes + verified; Unknown; Not applicable
*Note: Licensing/partner process; not an SSC data element.*

**2. Is the CAMS Stabilization Support Plan available in the EHR today?** SSC-025–SSC-033
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**3. How is the CAMS Stabilization Support Plan available?** SSC-025, SSC-026
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**4. Can staff complete the CAMS Stabilization Support Plan electronically in the EHR?** SSC-025–SSC-033
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**5. Are the CAMS Stabilization Support Plan answers/actions saved as structured data?** SSC-028–SSC-033
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some actions structured (2); All actions structured (4); Unknown (-1); Not applicable (-1)

**6. What support plan content can the EHR capture?** SSC-027, SSC-029–SSC-033
**Multiselect options:** Firearm safety actions (1); Medication safety actions (1); Other means safety actions (1); Coping supports (1); Supportive words/actions (1); Support people (1); People who increase risk (1); Life-affirming activities (1); Emergency steps (1); Signatures (1); Other (0); Unknown (-1)

**7. Can support people/caregivers be included in the plan?** SSC-030, SSC-033
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**8. Can the plan be shared with the patient and/or support people?** SSC-027
**Picklist options:** No (0); Print only (2); PDF only (3); Portal only (3); Text/email/shareable link (3); Multiple options (4); Unknown (-1); Not applicable (-1)

**9. What happens after the CAMS Stabilization Support Plan is completed?** SSC-025, SSC-026, SSC-027, SSC-033, SSC-039
**Response type:** Long text

**10. Can CAMS Stabilization Support Plan completion/results be reported on?** SSC-025–SSC-033
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**11.–18.** Evidence upload or link; Link for PDF or source tool; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 5. Patient-Facing Crisis Resources / Coping Supports

**1. Can the EHR document that patient-facing crisis resources or coping supports were provided?** SSC-027, SSC-029, SSC-030, SSC-031
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How are patient-facing crisis resources documented or shared?** SSC-027, SSC-031
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); External link/resource only (2); Unknown (-1); Not applicable (-1)

**3. Can staff share crisis resources electronically from the EHR?** SSC-027, SSC-031
**Picklist options:** No (0); Print only (2); PDF only (3); Portal only (3); Text/email/shareable link (3); Multiple options (4); Unknown (-1); Not applicable (-1)

**4. Are the shared resources saved as structured data?** SSC-027, SSC-031
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Resource shared flag only (2); Resource type plus date/time (3); Fully structured (4); Unknown (-1); Not applicable (-1)

**5. What resources can be documented or shared?** SSC-027, SSC-029, SSC-030, SSC-031
**Multiselect options:** 988 (1); Crisis Text Line (1); Now Matters Now (1); Safety plan copy (1); Coping skills resource (1); Local crisis line (1); Emergency instructions (1); Other (0); Unknown (-1)

**6. What happens after crisis resources are shared?** SSC-027, SSC-031, SSC-039
**Response type:** Long text

**7. Can resource-sharing be reported on?** SSC-027, SSC-031
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–15.** Evidence upload or link; Link for PDF or source resource; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 5: Coordinate Handoffs

**Purpose:** The EHR supports the transfer of essential suicide-safety information, responsibility, and follow-up details across people, settings, and time points.

Tools/functionality included under this tile:

1. Suicide-Safety Handoff / Transition Checklist
2. Discharge Safety Packet / Transition Bundle
3. Referral or Next Provider Handoff
4. Next Appointment / Follow-Up Visit Scheduling
5. Consent / Information-Sharing Status

## 1. Suicide-Safety Handoff / Transition Checklist

**1. Is there a suicide-safety handoff or transition checklist available in the EHR today?** SSC-034–SSC-038
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the handoff/checklist available?** SSC-034–SSC-038
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the handoff/checklist electronically in the EHR?** SSC-034–SSC-038
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are handoff details saved as structured data?** SSC-034–SSC-038
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**5. What suicide-safety information can be included in the handoff?** SSC-020, SSC-025, SSC-032, SSC-033, SSC-034–SSC-039
**Multiselect options:** Current risk status (1); Most recent suicide-risk assessment (1); Safety plan status (1); Lethal means safety actions (1); Crisis contacts/resources (1); Follow-up plan (1); Next provider/team (1); Appointment details (1); Pending tasks (1); Other (0); Unknown (-1)

**6. Can the handoff identify who is responsible for the next step?** SSC-034, SSC-035
**Picklist options:** No (0); Yes — person only (3); Yes — team/role only (3); Yes — person/team plus due date (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens after the handoff/checklist is completed?** SSC-034–SSC-038
**Response type:** Long text

**8. Can handoff/checklist completion be reported on?** SSC-034–SSC-038
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 2. Discharge Safety Packet / Transition Bundle

**1. Is there a discharge safety packet or transition bundle available in the EHR today?** SSC-025, SSC-027, SSC-031, SSC-032, SSC-033, SSC-034–SSC-038
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the discharge packet/transition bundle available?** SSC-036, SSC-037, SSC-038
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff generate the packet/bundle electronically from the EHR?** SSC-036
**Picklist options:** No (0); Manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. What can be included in the packet/bundle?** SSC-020, SSC-025, SSC-027, SSC-031–SSC-036, SSC-038
**Multiselect options:** Safety plan (1); Crisis resources (1); Current risk status (1); Most recent assessment (1); Lethal means safety actions (1); Follow-up appointment (1); Referral details (1); Care team contact (1); Patient instructions (1); Other (0); Unknown (-1)

**5. Can the packet/bundle be shared with the patient or receiving provider?** SSC-027, SSC-036, SSC-037, SSC-038
**Picklist options:** No (0); Printed only (2); Patient portal (3); Fax (2); Direct message / electronic exchange (4); PDF/download (3); Multiple options (4); Unknown (-1); Not applicable (-1)

**6. Can staff document that the packet/bundle was sent or given?** SSC-027, SSC-036, SSC-037
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens after the packet/bundle is generated or sent?** SSC-027, SSC-036, SSC-037, SSC-038
**Response type:** Long text

**8. Can packet/bundle completion or transmission be reported on?** SSC-027, SSC-036, SSC-037, SSC-038
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. Referral or Next Provider Handoff

**1. Can the EHR document a referral or handoff to the next provider/team?** SSC-034–SSC-038
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the referral/handoff available?** SSC-034, SSC-036, SSC-037, SSC-038
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff complete the referral/handoff electronically in the EHR?** SSC-034, SSC-036, SSC-037, SSC-038
**Picklist options:** No (0); Paper/PDF/manual only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. What referral/handoff details can be captured?** SSC-034–SSC-038
**Multiselect options:** Receiving provider/team (1); Organization/clinic (1); Reason for referral (1); Suicide-risk concern (1); Safety plan status (1); Follow-up need (1); Appointment details (1); Contact information (1); Status of referral (1); Other (0); Unknown (-1)

**5. Can the EHR track whether the referral/handoff was accepted or completed?** SSC-037
**Picklist options:** No (0); Sent only (2); Accepted/received only (3); Completed only (3); Full status tracking (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens after the referral/handoff is entered?** SSC-034, SSC-036, SSC-037, SSC-038
**Response type:** Long text

**7. Can referral/handoff status be reported on?** SSC-034, SSC-036, SSC-037, SSC-038
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. Next Appointment / Follow-Up Visit Scheduling

**1. Can the EHR document or schedule the next follow-up visit before transition/discharge?** SSC-035
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is next appointment/follow-up scheduling available?** SSC-035
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Unknown (-1); Not applicable (-1)

**3. Can the next appointment/follow-up date be saved as structured data?** SSC-035
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**4. What scheduling details can be captured?** SSC-035
**Multiselect options:** Appointment date/time (1); Appointment type (1); Receiving provider/team (1); Location (1); Telehealth/link (1); Follow-up timeframe (1); Appointment status (1); Patient notified (1); Other (0); Unknown (-1)

**5. Can the EHR alert staff if the follow-up appointment is missing?** SSC-035, SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens after the follow-up appointment is scheduled or documented?** SSC-035, SSC-039, SSC-042
**Response type:** Long text

**7. Can follow-up appointment scheduling be reported on?** SSC-035, SSC-042
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 5. Consent / Information-Sharing Status

**1. Can the EHR document whether suicide-safety information can be shared with another provider, team, or support person?** SSC-038
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is consent/information-sharing status available?** SSC-038
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); PDF or note only (1); Unknown (-1); Not applicable (-1)

**3. Is consent/information-sharing status saved as structured data?** SSC-038
**Picklist options:** No (0); Narrative only (1); PDF/scanned only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**4. What sharing details can be captured?** SSC-038
**Multiselect options:** Consent status (1); Sharing restriction (1); Receiving provider/team (1); Support person/caregiver (1); Type of information allowed (1); Expiration/date range (1); Patient declined (1); Other (0); Unknown (-1)

**5. Can the EHR use consent/sharing status to guide what is sent or withheld?** SSC-038
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens after consent/sharing status is documented?** SSC-038
**Response type:** Long text

**7. Can consent/sharing status be reported on?** SSC-038
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 6: Track Follow-Up

**Purpose:** The EHR tracks whether outreach and follow-up steps occur after the immediate encounter.

Tools/functionality included under this tile:

1. Follow-Up Outreach / Contact Attempts
2. Caring Contacts
3. Follow-Up Appointment Tracking
4. Missed Appointment / No-Show Follow-Up
5. Follow-Up Escalation Workflow

## 1. Follow-Up Outreach / Contact Attempts

**1. Is there a follow-up outreach/contact-attempt workflow available in the EHR today?** SSC-039, SSC-040, SSC-041
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is follow-up outreach available?** SSC-039, SSC-040, SSC-041
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Unknown (-1); Not applicable (-1)

**3. Can staff document outreach attempts electronically in the EHR?** SSC-039, SSC-040, SSC-041
**Picklist options:** No (0); Paper/manual only (1); Free-text note only (1); Partly electronic (2); Fully electronic (3); Unknown (-1); Not applicable (-1)

**4. Are outreach details saved as structured data?** SSC-039, SSC-040, SSC-041
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**5. What follow-up outreach details can the EHR capture?** SSC-039, SSC-040, SSC-041
**Multiselect options:** Outreach due date (1); Outreach attempt date/time (1); Method of contact (1); Outcome of attempt (1); Unable to reach (1); Patient reached (1); Message left (1); Safety concern identified (1); Next attempt needed (1); Other (0); Unknown (-1)

**6. Can the EHR assign outreach to a person, team, or work queue?** SSC-039, SSC-041
**Picklist options:** No (0); Yes — person only (3); Yes — team/work queue only (3); Yes — person/team plus due date (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens after an outreach attempt is documented?** SSC-040, SSC-041, SSC-045
**Response type:** Long text

**8. Can follow-up outreach be reported on?** SSC-039, SSC-040, SSC-041, SSC-047, SSC-048
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 2. Caring Contacts

**1. Is a caring contacts workflow available in the EHR today?** SSC-039, SSC-040, SSC-041
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How are caring contacts available?** SSC-039, SSC-040, SSC-041
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Partner outreach platform (2); Unknown (-1); Not applicable (-1)

**3. Can the EHR create or track caring contacts electronically?** SSC-039, SSC-040, SSC-041
**Picklist options:** No (0); Manual only (1); Partly electronic (2); Fully electronic (3); Partner/app workflow (2); Unknown (-1); Not applicable (-1)

**4. Are caring contact details saved as structured data?** SSC-039, SSC-040, SSC-041
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**5. What caring contact details can the EHR capture?** SSC-039, SSC-040, SSC-041
**Multiselect options:** Enrollment status (1); Contact schedule (1); Contact due date (1); Contact sent date (1); Contact method (1); Contact content/template (1); Patient response (1); Contact outcome (1); Opt-out status (1); Other (0); Unknown (-1)

**6. Can caring contacts be scheduled automatically or in a sequence?** SSC-039, SSC-041
**Picklist options:** No (0); Manual only (1); Yes — one-time contact (3); Yes — contact sequence (4); Yes — partner/app automation (3); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens after a caring contact is sent or documented?** SSC-040, SSC-041
**Response type:** Long text

**8. Can caring contacts be reported on?** SSC-039, SSC-040, SSC-041
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link (including message templates); Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. Follow-Up Appointment Tracking

**1. Can the EHR track whether a follow-up appointment occurred?** SSC-042, SSC-047, SSC-048
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is follow-up appointment tracking available?** SSC-042, SSC-047, SSC-048
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Unknown (-1); Not applicable (-1)

**3. Is follow-up appointment status saved as structured data?** SSC-042, SSC-047, SSC-048
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**4. What follow-up appointment details can the EHR capture?** SSC-042, SSC-047, SSC-048
**Multiselect options:** Appointment scheduled (1); Appointment date/time (1); Appointment type (1); Attended (1); Cancelled (1); No-show (1); Rescheduled (1); Completed within 7 days (1); Completed within 30 days (1); Other (0); Unknown (-1)

**5. Can the EHR identify when follow-up is overdue or missing?** SSC-042, SSC-045, SSC-047, SSC-048
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when follow-up is completed, missed, or overdue?** SSC-040, SSC-041, SSC-042, SSC-045
**Response type:** Long text

**7. Can follow-up appointment status be reported on?** SSC-042, SSC-047, SSC-048
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. Missed Appointment / No-Show Follow-Up

**1. Can the EHR identify missed appointments or no-shows for patients with suicide risk?** SSC-042, SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is missed appointment/no-show follow-up available?** SSC-042, SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Unknown (-1); Not applicable (-1)

**3. Can the EHR connect missed appointments/no-shows to suicide-risk status or workflow?** SSC-020, SSC-042, SSC-043, SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**4. What missed-appointment details can the EHR capture?** SSC-040, SSC-042, SSC-045
**Multiselect options:** No-show date/time (1); Cancelled appointment (1); Patient contacted (1); Unable to reach (1); Outreach attempt (1); Follow-up rescheduled (1); Safety concern identified (1); Escalation needed (1); Other (0); Unknown (-1)

**5. What happens when a high-risk patient misses or no-shows an appointment?** SSC-040, SSC-042, SSC-045
**Response type:** Long text

**6. Can missed appointment/no-show follow-up be reported on?** SSC-042, SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**7.–13.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 5. Follow-Up Escalation Workflow

**1. Is there a follow-up escalation workflow available in the EHR today?** SSC-040, SSC-041, SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is follow-up escalation available?** SSC-040, SSC-041, SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Unknown (-1); Not applicable (-1)

**3. What can trigger escalation?** SSC-040, SSC-041, SSC-042, SSC-045
**Multiselect options:** Missed follow-up (1); No-show (1); Unable to reach patient (1); New safety concern (1); High-risk status (1); Missed outreach window (1); Failed contact sequence (1); Staff manually escalates (1); Other (0); Unknown (-1)

**4. Who can escalation be routed to?** SSC-045
**Multiselect options:** Primary care provider (1); Behavioral health provider (1); Care manager (1); Crisis team (1); Supervisor (1); On-call clinician (1); External emergency contact (1); Other (0); Unknown (-1)

**5. Can staff document the escalation outcome?** SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens after escalation is triggered?** SSC-045
**Response type:** Long text

**7. Can follow-up escalation be reported on?** SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 7: Track Risk Over Time

**Purpose:** The EHR keeps active suicide-safer care episodes visible, trackable, and escalated when needed.

Tools/functionality included under this tile:

1. Active Suicide-Safer Care Registry / Work Queue
2. Suicide-Risk Episode / Pathway Status
3. Reassessment / Risk Review Schedule
4. Open Safety Actions / Care Gap Tracking
5. Risk Escalation / Overdue Workflow

## 1. Active Suicide-Safer Care Registry / Work Queue

**1. Is there an active suicide-risk registry or work queue available in the EHR today?** SSC-043, SSC-044, SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is the registry/work queue available?** SSC-043, SSC-044, SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual list/report only (1); Unknown (-1); Not applicable (-1)

**3. Can staff view active suicide-risk patients in one place?** SSC-043
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**4. What patients can be included in the registry/work queue?** SSC-043, SSC-044, SSC-045
**Picklist options:** Positive screen (1); Current suicide risk status (1); High-risk tier (1); Safety plan needed (1); Follow-up needed (1); Missed follow-up (1); Open safety task (1); Manual add only (1); Other (0); Unknown (-1)

**5. What information is visible in the registry/work queue?** SSC-043, SSC-044, SSC-045
**Multiselect options:** Patient name (1); Current risk status (1); Last assessment date (1); Next reassessment due date (1); Safety plan status (1); Follow-up status (1); Open tasks (1); Assigned owner/team (1); Escalation status (1); Other (0); Unknown (-1)

**6. Can the registry/work queue assign responsibility to a person or team?** SSC-043, SSC-045
**Picklist options:** No (0); Yes — person only (3); Yes — team/work queue only (3); Yes — person/team plus due date (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens when a patient is added to the registry/work queue?** SSC-043, SSC-044, SSC-045
**Response type:** Long text

**8. Can registry/work queue activity be reported on?** SSC-043, SSC-044, SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 2. Suicide-Risk Episode / Pathway Status

**1. Can the EHR track an active suicide-risk episode or pathway status over time?** SSC-020, SSC-043, SSC-044, SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is episode/pathway tracking available?** SSC-020, SSC-043, SSC-044, SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual note only (1); Unknown (-1); Not applicable (-1)

**3. Is the episode/pathway status saved as structured data?** SSC-020, SSC-043, SSC-044, SSC-045
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**4. What episode/pathway details can the EHR capture?** SSC-020, SSC-043, SSC-044, SSC-045
**Multiselect options:** Episode start date (1); Reason for entry (1); Current risk status (1); Current pathway tier (1); Assigned owner/team (1); Active/open status (1); Closed/resolved status (1); Reason for closure (1); Other (0); Unknown (-1)

**5. Can staff close or resolve the suicide-risk episode/pathway?** SSC-043, SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6. Does closure require a reason or final status?** SSC-043, SSC-044, SSC-045
**Picklist options:** No (0); Yes — reason only (3); Yes — final status only (3); Yes — reason plus final status (4); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens when the episode/pathway status changes?** SSC-020, SSC-043, SSC-044, SSC-045
**Response type:** Long text

**8. Can episode/pathway status be reported on?** SSC-020, SSC-043, SSC-044, SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. Reassessment / Risk Review Schedule

**1. Can the EHR track when suicide-risk reassessment or review is due?** SSC-020, SSC-043, SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is reassessment/review tracking available?** SSC-020, SSC-043, SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual reminder only (1); Unknown (-1); Not applicable (-1)

**3. Can the reassessment/review due date be saved as structured data?** SSC-043, SSC-045
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**4. What can determine the reassessment/review schedule?** SSC-020, SSC-043, SSC-045
**Multiselect options:** Current risk status (1); Risk tier/pathway (1); Date of last assessment (1); Missed appointment (1); Discharge/transition (1); Clinician judgment (1); Manual date only (1); Other (0); Unknown (-1)

**5. Can the EHR alert staff when reassessment/review is due or overdue?** SSC-045
**Picklist options:** No (0); Yes — due only (3); Yes — overdue only (3); Yes — due and overdue (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens when reassessment/review is due or overdue?** SSC-045
**Response type:** Long text

**7. Can reassessment/review status be reported on?** SSC-043, SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. Open Safety Actions / Care Gap Tracking

**1. Can the EHR track open suicide-safety actions or care gaps over time?** SSC-025, SSC-032, SSC-033, SSC-039, SSC-042, SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is open safety action/care gap tracking available?** SSC-025, SSC-032, SSC-033, SSC-039, SSC-042, SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual list/report only (1); Unknown (-1); Not applicable (-1)

**3. Are open safety actions/care gaps saved as structured data?** SSC-025, SSC-032, SSC-033, SSC-039, SSC-042, SSC-045
**Picklist options:** No (0); Narrative only (1); Some details structured (2); Fully structured (4); Unknown (-1); Not applicable (-1)

**4. What open safety actions or gaps can the EHR track?** SSC-025, SSC-032, SSC-033, SSC-039, SSC-042, SSC-045
**Multiselect options:** Assessment needed (1); Safety plan needed (1); Safety plan update needed (1); Lethal means action open (1); Follow-up outreach due (1); Reassessment due (1); Referral/handoff incomplete (1); Appointment missing (1); Other (0); Unknown (-1)

**5. Can each open action/gap have an owner and due date?** SSC-039, SSC-045
**Picklist options:** No (0); Owner only (2); Due date only (2); Owner plus due date (4); Partial (2); Unknown (-1); Not applicable (-1)

**6. Can staff mark the safety action/gap as completed?** SSC-033, SSC-040, SSC-042, SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**7. What happens when a safety action/gap is open or overdue?** SSC-045
**Response type:** Long text

**8. Can open safety actions/care gaps be reported on?** SSC-025, SSC-032, SSC-033, SSC-039, SSC-042, SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**9.–15.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 5. Risk Escalation / Overdue Workflow

**1. Can the EHR escalate active suicide-risk cases when key steps are overdue or risk worsens?** SSC-045
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. How is risk escalation available?** SSC-045
**Picklist options:** Built in/native (4); Configured by customer (3); Custom build (2); Partner/app (2); Manual only (1); Unknown (-1); Not applicable (-1)

**3. What can trigger risk escalation?** SSC-040, SSC-041, SSC-042, SSC-043, SSC-045
**Multiselect options:** High-risk status (1); Worsening reassessment (1); Missed reassessment (1); Missed follow-up (1); Open safety action overdue (1); Missed appointment/no-show (1); Unable to reach patient (1); Clinician manually escalates (1); Other (0); Unknown (-1)

**4. Who can escalation be routed to?** SSC-045
**Multiselect options:** Primary care provider (1); Behavioral health provider (1); Care manager (1); Crisis team (1); Supervisor (1); On-call clinician (1); Administrator/work queue (1); Other (0); Unknown (-1)

**5. Can staff document the escalation outcome?** SSC-045
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6. What happens after escalation is triggered?** SSC-045
**Response type:** Long text

**7. Can escalation activity be reported on?** SSC-045
**Picklist options:** No (0); Manual only (1); Partial (2); Yes, standard report/dashboard (4); Yes, custom report needed (3); Unknown (-1); Not applicable (-1)

**8.–14.** Evidence upload or link; Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

# Stage Tile 8: Measure and Share the Data

**Purpose:** The EHR makes pathway activity usable for reporting, quality improvement, accountability, and information sharing.

Tools/functionality included under this tile:

1. Suicide-Safer Care KPI / Measure Reporting
2. Reporting Dashboard / Aggregate View
3. Data Export / Analytics Extract
4. Data Sharing / Interoperability Output

## 1. Suicide-Safer Care KPI / Measure Reporting

**1. Can the EHR report on suicide-safer care measures or KPIs today?** SSC-046, SSC-047, SSC-048
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. Which suicide-safer care measures can the EHR support?** SSC-046, SSC-047, SSC-048
**Multiselect options:** Positive screen followed by suicide-risk assessment (1); Current risk level documented (1); Safety plan completed before discharge (1); Patient copy of safety plan documented (1); Lethal means counseling completed (1); Follow-up outreach within 24–48 hours (1); Follow-up within 7 days (1); Follow-up within 30 days (1); Caring contacts/contact adherence (1); CAMS outcomes or monitoring (1); CARS-S/CARS assessment completion (1); SCS-R treatment-response monitoring (1); Other (0); Unknown (-1)

**3. Can the EHR calculate measure numerators and denominators?** SSC-046, SSC-047, SSC-048
**Picklist options:** No (0); Manual only (1); Partial (2); Yes (4); Unknown (-1); Not applicable (-1)

**4. Can measure results be viewed over time?** SSC-046, SSC-047, SSC-048
**Picklist options:** No (0); Yes — monthly (3); Yes — quarterly (3); Yes — custom date range (4); Partial (2); Unknown (-1); Not applicable (-1)

**5. Can measure results be filtered by site, setting, team, provider, or patient population?** SSC-046, SSC-047, SSC-048
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6.–12.** Evidence upload or link (measure definitions, report samples, dashboard examples); Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 2. Reporting Dashboard / Aggregate View

**1. Is there a dashboard or aggregate reporting view for suicide-safer care activity?** SSC-046, SSC-047, SSC-048
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. What pathway activity can the dashboard show?** SSC-001, SSC-005, SSC-008, SSC-020, SSC-025, SSC-032, SSC-034, SSC-039, SSC-042, SSC-043, SSC-045, SSC-046, SSC-047, SSC-048
**Multiselect options:** Screening volume (1); Positive screens (1); Suicide-risk assessments completed (1); Current risk status documented (1); Safety plans completed (1); Lethal means counseling completed (1); Handoffs completed (1); Follow-up completed (1); Missed follow-up (1); Active episodes (1); Overdue items (1); Other (0); Unknown (-1)

**3. Who can use or view the dashboard?** SSC-046, SSC-047, SSC-048
**Multiselect options:** Clinicians (1); Supervisors (1); Care managers (1); Quality improvement team (1); Administrators (1); Vendor/customer success team (1); Other (0); Unknown (-1)

**4. Can dashboard results be filtered?** SSC-046, SSC-047, SSC-048
**Multiselect options:** Date range (1); Site/location (1); Setting (1); Provider/team (1); Tool used (1); Risk level/pathway (1); Completion status (1); Patient population (1); Other (0); Unknown (-1)

**5. Can dashboard data be refreshed routinely?** SSC-046, SSC-047, SSC-048
**Picklist options:** No (0); Manual only (1); Scheduled refresh (3); Real-time/near real-time (4); Unknown (-1); Not applicable (-1)

**6.–12.** Evidence upload or link (dashboard screenshots, sample reports, report logic); Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 3. Data Export / Analytics Extract

**1. Can suicide-safer care data be exported for analysis or quality improvement?** SSC-001–SSC-052
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)
*Note: Broad export capability maps to whichever SSC fields are included in the extract; SSC-049–SSC-052 are retained because the data dictionary contains SCS-R fields.*

**2. What suicide-safer care data can be exported?** SSC-001–SSC-052
**Multiselect options:** Screening results (1); Assessment results (1); Risk level/pathway (1); Safety plan status (1); Lethal means counseling status (1); Handoff/transition status (1); Follow-up status (1); Active episode status (1); Measure results (1); Timestamps (1); Other (0); Unknown (-1)

**3. Does the export include structured fields rather than only narrative notes?** SSC-001–SSC-052
**Picklist options:** No (0); Narrative only (1); Partial (2); Yes (4); Unknown (-1); Not applicable (-1)

**4. What export formats are supported?** SSC-001–SSC-052
**Picklist options:** CSV (1); Excel (1); PDF report (1); Dashboard download (1); API (1); FHIR/API (1); Database/reporting warehouse (1); Manual extract (1); Other (0); Unknown (-1)

**5. Can exported data include the timestamps needed for measurement?** SSC-003, SSC-036, SSC-039, SSC-040, SSC-047, SSC-048
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6.–12.** Evidence upload or link (export samples, data dictionaries, API documentation); Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.

## 4. Data Sharing / Interoperability Output

**1. Can suicide-safer care data be shared outside the EHR?** SSC-034–SSC-038
**Picklist options:** Not assessed (-1); No (0); Partially available (2); Yes (3); Yes + verified (4); Unknown (-1)

**2. What information can be shared?** SSC-020, SSC-025, SSC-027, SSC-032–SSC-042
**Multiselect options:** Current risk status (1); Assessment summary (1); Safety plan status (1); Safety plan document (1); Lethal means safety status (1); Handoff/transition bundle (1); Follow-up plan (1); Follow-up completion status (1); Quality measure results (1); Other (0); Unknown (-1)

**3. What sharing methods are supported?** SSC-036, SSC-037, SSC-038
**Multiselect options:** HIE/interface (1); FHIR/API (1); Direct message (1); Referral platform (1); PDF/document exchange (1); Patient portal (1); Manual export (1); Other (0); Unknown (-1)

**4. Can the shared data preserve structured fields and source/provenance?** SSC-001–SSC-052
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**5. Can the EHR limit what is shared based on consent or sharing restrictions?** SSC-038
**Picklist options:** No (0); Yes (3); Partial (2); Unknown (-1); Not applicable (-1)

**6.–12.** Evidence upload or link (interface documentation, FHIR/API documentation, HIE examples, sample transition bundles); Build plan; Planned start date; Actual build start date; Executed finish date; Implementation status; Notes — same options as ASQ items 8–15.
