// =============================================================
// Setting pathways: the suicide-safer care pathway in a specific care setting
// =============================================================
//
// ─── What these are, and how they nest ───────────────────────
//
// SPiERSuicideSaferCarePathway (suicide-safer-care-pathway.fsh) is the CORE
// protocol: screen, gate, assess, tier, act — written for ongoing care, and
// deliberately setting-free. A care setting changes WHO does each step, WHEN,
// and what surrounds it (precautions, observation, admission, discharge), but
// not what a positive screen or a risk tier means. So each setting is its own
// `#clinical-protocol` PlanDefinition that:
//
//   - declares its setting as `useContext` VENUE (v3 ServiceDeliveryLocationRoleType,
//     each code verified against tx.fhir.org 2026-10-09 — ER "Emergency room",
//     PHU "Psychiatric hospital unit", PSYCHF "Psychatric Care Facility" [sic,
//     HL7's own spelling of the display]). ⚠️ NOT `focus`: the tool catalogue
//     derives each tool's pathway stage from PlanDefinitions carrying a stage
//     `focus` (packages/core/src/data/catalog/tools.ts), and a setting pathway
//     referencing a tool must not move that tool's stage. `PSI` looks like
//     "psychiatric inpatient" and is "Psychology clinic" — the reason for the
//     verification;
//   - names the core protocol as `relatedArtifact #derived-from`;
//   - is named by the core protocol as `relatedArtifact #composed-of`, which is
//     what the guide reads to list the settings. `npm run check:pathway` holds
//     the two directions in agreement.
//
// The ED pathway reaches the inpatient pathway as a STEP: its admission action's
// `definitionCanonical` is the inpatient PlanDefinition, which R4 allows
// (`action.definition[x]` may be a PlanDefinition) and which is how a CPG engine
// would apply one protocol from inside another.
//
// ─── What goes in: settled content only ──────────────────────
//
// The same discipline as the core protocol's header, applied to two sources:
//
//   ED        — docs/use-cases/ed-scenario-11.json, the HL7 Behavioral Health
//               working group's Scenario 11. Only the steps the working group
//               circulated; SPiER's own proposed additions are NOT encoded here
//               (they are proposals to the working group, not agreed steps),
//               with one exception, the admission step — see that action.
//   Inpatient — docs/use-cases/inpatient-scenario-12.json, drafted from ONE
//               subject-matter walkthrough (2026-05-29) and NOT YET REVIEWED by
//               that expert. Everything the walkthrough left open is absent:
//               the reassessment frequency below high risk, post-discharge
//               contact (described as wanted but not in practice), and decision
//               support on discharge prescription quantity (asked, unanswered).
//               The guide lists those as pending, from page copy.
//
// ─── What stays out: cadence, tiers, instruments as requirements ─
//
//   - No `timing[x]`, by the same rule as the core protocol (check:pathway
//     rule c). The inpatient pathway's "every shift while high risk" is prose on
//     the step: it is a different cadence from the published per-tier schedule
//     (days, for ongoing care), and publishing it as data is open profile work
//     the inpatient workbook records as a gap, not something to slip in here.
//   - No tier branch. The tier obligations live in the core protocol; a setting
//     pathway that restated them would be a second statement of the same rule.
//     The guide renders a setting pathway as a spine with no tier table.
//   - Instruments are realizations, as in the core protocol: a step names what
//     it accomplishes, and `definitionCanonical` children name what SPiER ships.
//
// ⚠️ `documentation[=].display`, `title` and `description` are PUBLISHED prose —
// both the IG and the guide render them, and `npm run check:jargon` reads the
// displays. Name the clinical claim and nothing about this repo: no gate,
// script, file or document path, no issue number. The `//` comments are the
// place for those.
// =============================================================


RuleSet: SettingPathwayHeader
* version = "0.1.0"
* status = #draft
* experimental = true
* publisher = "SPiER"
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#clinical-protocol
* relatedArtifact[+].type = #derived-from
* relatedArtifact[=].label = "Core protocol"
* relatedArtifact[=].display = "The suicide-safer care pathway this setting pathway applies. Risk tiers, and what each tier is owed, are defined there and not restated here."
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway"


// ─── Emergency department ────────────────────────────────────

Instance: SPiEREDSuicideCarePathway
InstanceOf: PlanDefinition
Title: "SPiER Suicide Safer Care Pathway — Emergency Department"
Description: "The suicide-safer care pathway as applied in an emergency department: screening at triage, immediate safety for a positive screen, a clarifying assessment, care while the patient remains in the department, discharge with a safety plan and lethal-means counseling, and follow-up after discharge."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiEREDSuicideCarePathway"
* name = "SPiEREDSuicideCarePathway"
* title = "SPiER Suicide Safer Care Pathway — Emergency Department"
* insert SettingPathwayHeader
* description = "The suicide-safer care pathway as applied in an emergency department, following the HL7 Behavioral Health working group's emergency department scenario: every patient is screened at triage; a positive screen starts immediate safety measures and a clarifying assessment; risk and precautions are revisited while the patient remains in the department; a patient who cannot safely go home is admitted or transferred; and a patient who is discharged leaves with a safety plan, lethal-means counseling and follow-up."
* purpose = "Make the emergency department's suicide-safer care workflow machine-readable in the same terms as the core protocol, so that one risk concept and one set of tier obligations carry from the emergency department into admission, discharge and follow-up."
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#venue
* useContext[=].valueCodeableConcept = http://terminology.hl7.org/CodeSystem/v3-RoleCode#ER "Emergency room"

* action[+]
  * id = "ed-screen-at-triage"
  * title = "Screen every patient at triage"
  * description = "Administer an emergency-department-appropriate suicide risk screener at triage, staff-administered or by patient self-report, and keep the result as structured data."
  * code[+] = SPiERPathwayStage#identify-possible-risk "Identify Possible Risk"
  * documentation[+].type = #documentation
  * documentation[=].label = "Three outcomes"
  * documentation[=].display = "The screen is classified as negative, non-acute positive or acute positive by configurable rules. The status is shown to the whole care team, separately from the tasks it creates, so every role can see it at a glance."
  * documentation[=].extension[ClinicianFacing].valueBoolean = true
  * documentation[+].type = #documentation
  * documentation[=].label = "Transportability"
  * documentation[=].display = "Any screener whose result feeds the shared suicide-risk concept satisfies this step. The ASQ and the C-SSRS Screener below are the realizations SPiER ships."
  * action[+]
    * id = "ed-administer-asq"
    * title = "Administer the ASQ"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerASQ"
  * action[+]
    * id = "ed-administer-cssrs-screener"
    * title = "Administer the C-SSRS Screener"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSScreener"

* action[+]
  * id = "ed-immediate-safety"
  * title = "Start immediate safety measures on a positive screen"
  * description = "For an acute positive or otherwise high-risk presentation: keep the patient in sight, move them to a safe room, and start the mitigation checklist."
  * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
  * action[+]
    * id = "ed-precaution-orders"
    * title = "Authorize suicide precaution and observation orders"
    * description = "A provider authorizes and tailors the precaution and observation orders, with the signature or countersignature local policy requires."
  * action[+]
    * id = "ed-room-clearance"
    * title = "Clear the room and secure belongings"
    * description = "Complete and document the environmental safety checklist and secure the patient's belongings."
  * action[+]
    * id = "ed-continuous-observation"
    * title = "Begin continuous observation when indicated"
    * description = "An assigned observer documents observations and safety checks; the active precautions, observation level and observer stay visible to the care team."

* action[+]
  * id = "ed-assess"
  * title = "Clarify the risk after a positive screen"
  * description = "Complete a brief suicide safety assessment after a positive screen and, when indicated, a structured suicide risk assessment; record the resulting risk level for the department and the longitudinal record."
  * code[+] = SPiERPathwayStage#clarify-risk "Clarify Risk"
  * action[+]
    * id = "ed-administer-bssa"
    * title = "Brief Suicide Safety Assessment (after a positive ASQ)"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerBSSA"
  * action[+]
    * id = "ed-administer-safet"
    * title = "SAFE-T, with the C-SSRS, when indicated"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerSAFET"

* action[+]
  * id = "ed-while-in-department"
  * title = "Revisit risk while the patient remains in the department"
  * description = "While the patient boards or awaits placement, reassess risk and update precautions as clinically indicated, and re-check the room and the observer assignment at every shift change or room move."
  * code[+] = SPiERPathwayStage#track-risk-over-time "Track Risk Over Time"
  // The one step encoded from outside the working group's circulated rows. Their
  // section 11.5 preamble describes patients "awaiting psychiatric placement or
  // transfer", but no circulated row models the admission; SPiER proposed one
  // (11.5-1D). The CLINICAL fact — some patients are admitted rather than sent
  // home — is in their narrative, and it is the join to the inpatient pathway,
  // so it is encoded; the proposed step's DATA (a per-attempt placement log) is
  // not.
  * action[+]
    * id = "ed-admit-or-transfer"
    * title = "Admit or transfer when discharge home is not appropriate"
    * description = "When the patient cannot safely be discharged, arrange psychiatric admission or transfer and keep precautions in place until the receiving unit takes over. Inpatient care then follows the inpatient setting pathway."
    * definitionCanonical = "http://thespierproject.org/fhir/PlanDefinition/SPiERInpatientSuicideCarePathway"

* action[+]
  * id = "ed-discharge"
  * title = "Discharge with a safety plan and lethal-means counseling"
  * description = "Before discharge, develop a safety plan with the patient, provide lethal-means counseling as a stand-alone intervention, and give the patient the safety plan and suicide-specific discharge instructions."
  * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
  * action[+]
    * id = "ed-safety-plan"
    * title = "Develop a structured safety plan"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown"
  * action[+]
    * id = "ed-lethal-means"
    * title = "Provide lethal-means counseling"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ProvideMeansSafetyCounseling"
  * action[+]
    * id = "ed-discharge-packet"
    * title = "Provide the safety plan and suicide-specific discharge instructions"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/GenerateDischargeSafetyPacket"

* action[+]
  * id = "ed-follow-up"
  * title = "Arrange follow-up and reach out after discharge"
  * description = "Place an urgent outpatient referral, send the transition-of-care information to the receiving provider, and start the post-discharge follow-up protocol."
  * code[+] = SPiERPathwayStage#coordinate-handoffs "Coordinate Handoffs"
  * action[+]
    * id = "ed-rapid-referral"
    * title = "Place an urgent outpatient referral"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/SendRapidReferral"
  * action[+]
    * id = "ed-caring-contacts"
    * title = "Follow up after discharge with caring contacts and calls"
    * code[+] = SPiERPathwayStage#track-follow-up "Track Follow-Up"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/SendCaringContact"


// ─── Inpatient psychiatric care ──────────────────────────────

Instance: SPiERInpatientSuicideCarePathway
InstanceOf: PlanDefinition
Title: "SPiER Suicide Safer Care Pathway — Inpatient Psychiatric Care"
Description: "The suicide-safer care pathway as applied during an inpatient psychiatric stay: universal screening on admission, a full assessment after a positive screen, per-shift reassessment for high-risk patients, safety planning from admission, a co-signed safety plan and third-party confirmation of means safety at discharge, and a confirmed follow-up appointment. A draft awaiting clinical review."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERInpatientSuicideCarePathway"
* name = "SPiERInpatientSuicideCarePathway"
* title = "SPiER Suicide Safer Care Pathway — Inpatient Psychiatric Care"
* insert SettingPathwayHeader
* description = "The suicide-safer care pathway as applied during an inpatient psychiatric stay. Every admitted patient is screened; a positive screen leads to a full assessment; high-risk patients are reassessed every nursing shift; safety planning starts on admission with lethal means; and at discharge every patient is reassessed, the safety plan is reviewed and signed by the patient and each discipline, someone other than the patient confirms that the agreed means are secured, and a follow-up appointment is confirmed. This is a draft, written from one inpatient subject-matter walkthrough and awaiting clinical review; what that walkthrough left open is not encoded."
* purpose = "Make the inpatient suicide-safer care workflow machine-readable in the same terms as the core protocol, so that the risk concept a patient arrives with from an emergency department carries through the stay to discharge and follow-up."
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#venue
* useContext[=].valueCodeableConcept = http://terminology.hl7.org/CodeSystem/v3-RoleCode#PHU "Psychiatric hospital unit"
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#venue
* useContext[=].valueCodeableConcept = http://terminology.hl7.org/CodeSystem/v3-RoleCode#PSYCHF "Psychatric Care Facility"

* action[+]
  * id = "inpatient-admission-screen"
  * title = "Screen every admitted patient"
  * description = "On admission, a master's-prepared clinician administers a suicide risk screener to every patient, whatever the reason for admission."
  * code[+] = SPiERPathwayStage#identify-possible-risk "Identify Possible Risk"
  * documentation[+].type = #documentation
  * documentation[=].label = "How patients arrive"
  * documentation[=].display = "From an emergency department (the hospital's own or another), by transfer from another unit, or from the community through the hospital's admissions department, where a level-of-care assessment decides between inpatient, partial hospitalization and outpatient care. The outside record, including any emergency department record, is requested on admission."
  * documentation[=].extension[ClinicianFacing].valueBoolean = true
  * documentation[+].type = #documentation
  * documentation[=].label = "Transportability"
  * documentation[=].display = "Any screener whose result feeds the shared suicide-risk concept satisfies this step. The C-SSRS Screener below is the realization SPiER ships."
  * action[+]
    * id = "inpatient-administer-cssrs-screener"
    * title = "Administer the C-SSRS Screener"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSScreener"

* action[+]
  * id = "inpatient-admission-assessment"
  * title = "Complete a full assessment after a positive screen"
  * description = "A positive screen leads to a full suicide risk assessment and a recorded risk level. A negative screen does not, and no lifetime assessment is done for a patient who did not screen positive."
  * code[+] = SPiERPathwayStage#clarify-risk "Clarify Risk"
  * action[+]
    * id = "inpatient-administer-cssrs-full"
    * title = "Administer the full C-SSRS"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSFull"
  * action[+]
    * id = "inpatient-local-assessment"
    * title = "Or a site's own full assessment (for example, an AMSR-based formulation)"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerLocalRiskAssessment"

* action[+]
  * id = "inpatient-during-stay"
  * title = "Keep the patient safe and reassess through the stay"
  * description = "The unit's universal precautions apply to every patient, and suicide risk is reassessed on a schedule set by the patient's risk level."
  * code[+] = SPiERPathwayStage#track-risk-over-time "Track Risk Over Time"
  * action[+]
    * id = "inpatient-universal-precautions"
    * title = "Apply the unit's universal precautions"
    * description = "Search belongings, secure the patient's own medications or send them home with the person who came, complete admission lab testing, keep the environment ligature resistant, and check on every patient every 15 minutes."
  * action[+]
    * id = "inpatient-per-shift-reassessment"
    * title = "Reassess a high-risk patient every nursing shift"
    * description = "While the patient is high risk, nursing reassesses suicide risk every shift. A patient's denial is documented as an answer, not left blank."
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSSinceLastContact"
    * documentation[+].type = #documentation
    * documentation[=].label = "Below high risk"
    * documentation[=].display = "How often a patient who is not high risk is reassessed during the stay is not yet defined by this pathway."
  * action[+]
    * id = "inpatient-physician-evaluation"
    * title = "Physicians ask about risk too"
    * description = "The attending physician asks about suicide risk independently of the nursing reassessments."

* action[+]
  * id = "inpatient-safety-planning"
  * title = "Start the safety plan on admission, beginning with lethal means"
  * description = "Safety planning starts on admission, not at discharge. Lethal-means work is about the patient's home: whatever the patient's plan involves is identified, and a storage or removal plan is agreed with the patient and family. Over the stay the patient adds triggers, warning signs and protective factors."
  * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
  * action[+]
    * id = "inpatient-lethal-means"
    * title = "Plan lethal-means safety for the home"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ProvideMeansSafetyCounseling"
  * action[+]
    * id = "inpatient-safety-plan"
    * title = "Build the safety plan through the stay"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown"

// No stage coding, deliberately: the eight stages catalogue what an EHR must
// support for suicide-safer care, and day-to-day therapeutic programming is not
// one of them. Recording WHICH interventions were delivered is the walkthrough's
// central data gap (inpatient-scenario-12, section 12.6), not a step to invent
// a stage for.
* action[+]
  * id = "inpatient-active-treatment"
  * title = "Deliver active treatment every day"
  * description = "Patients attend active treatment from morning through night: check-in and goal-setting groups, mindfulness, activity and music therapy, psychotherapy including CBT, DBT skills, and suicide-specific interventions. Symptom measures are taken on admission and again at discharge."
  * action[+]
    * id = "inpatient-cams"
    * title = "Suicide-specific intervention (for example, CAMS)"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSSectionA"
  * action[+]
    * id = "inpatient-phq9"
    * title = "Symptom measure on admission and at discharge (for example, the PHQ-9)"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerPHQ9"

* action[+]
  * id = "inpatient-discharge"
  * title = "Discharge with a reviewed, co-signed safety plan"
  * description = "Every patient is reassessed for suicide risk before discharge, whatever they were admitted for. The physician, nurse and social worker assemble the discharge instructions, one part of which is the crisis safety plan."
  * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
  * action[+]
    * id = "inpatient-discharge-reassessment"
    * title = "Reassess suicide risk before discharge"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSSinceLastContact"
  * action[+]
    * id = "inpatient-cosigned-plan"
    * title = "Review the safety plan with the patient, then sign it"
    * description = "Walk through the plan with the patient against what they said during the stay and revise it. The patient, each discipline and, where the patient agrees, family sign it, on paper or electronically."
  * action[+]
    * id = "inpatient-means-confirmation"
    * title = "Confirm, through someone other than the patient, that means are secured"
    * description = "Before the patient goes home, a family member or other support person confirms that each agreed means-safety action has been taken."
  * action[+]
    * id = "inpatient-discharge-quantity"
    * title = "Limit the quantity of discharge prescriptions"
    * description = "Write discharge prescriptions for a limited supply, per facility policy (for example, no more than a 15- to 30-day supply)."
  * action[+]
    * id = "inpatient-discharge-packet"
    * title = "Provide the safety plan with the discharge instructions"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/GenerateDischargeSafetyPacket"

* action[+]
  * id = "inpatient-transition"
  * title = "Confirm follow-up and hand off"
  * description = "A patient who came from a provider goes back to that provider, with a handoff; a patient going to a new program is given an appointment with it and taught how to get there."
  * code[+] = SPiERPathwayStage#coordinate-handoffs "Coordinate Handoffs"
  * action[+]
    * id = "inpatient-follow-up-appointment"
    * title = "Confirm or schedule the follow-up appointment"
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ScheduleFollowUpAppointment"
