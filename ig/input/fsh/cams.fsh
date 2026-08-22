// =============================================================
// CAMS — Collaborative Assessment and Management of Suicidality
// =============================================================
// CAMS produces a richer artifact set than the other tools:
//
//   Section A   (Patient SSF Vitals)    -> 6 Observations + risk Obs
//   Section B   (Clinician Drivers)     -> up to 3 Condition resources
//   Therapeutic Worksheet               -> CarePlan (drivers/crisis model)
//   Stabilization Plan                  -> CarePlan (safety plan variant)
//   Interim Session                     -> reuses Section A Questionnaire
//
// Existing Questionnaires (post placeholder-URL cleanup):
//   http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionA|1.0.0
//   http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionB|1.0.0
//   http://thespierproject.org/fhir/Questionnaire/CAMS-Therapeutic-Worksheet|1.0.0
//   http://thespierproject.org/fhir/Questionnaire/CAMS-Stabilization-Plan|1.0.0
// =============================================================


// ─── CodeSystems ─────────────────────────────────────────────

CodeSystem: CAMSSSFMeasureCodes
Id: cams-ssf
Title: "CAMS SSF Measure Codes"
Description: "SPiER-local codes for the six Suicide Status Form (SSF) Core Assessment ratings collected during CAMS Section A. Used because no equivalent LOINC concepts have been published for the CAMS-specific scale. Submission to LOINC is pending."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #psychological-pain "Psychological Pain" "SSF rating 1 — psychological pain (low to high) over the past week. Scale 1–5."
* #stress "Stress" "SSF rating 2 — general stress in life right now. Scale 1–5."
* #agitation "Agitation" "SSF rating 3 — agitation or emotional urgency to do something. Scale 1–5."
* #hopelessness "Hopelessness" "SSF rating 4 — expectation that things will not get better. Scale 1–5."
* #self-hate "Self-Hate" "SSF rating 5 — general negative self-perception or self-loathing. Scale 1–5."
* #overall-risk "Overall Risk of Suicide" "SSF rating 6 — patient's self-rated overall risk of suicide. Scale 1 (extremely low risk, will not kill self) to 5 (extremely high risk, will kill self)."


CodeSystem: CAMSDriverCategoryCodes
Id: cams-driver-category
Title: "CAMS Driver Category Codes"
Description: "Marker category used on Condition resources that represent CAMS-identified suicide drivers, so they surface on the FHIR problem list. The concept originates with CAMS-care, which refers to it as http://cams-care.com/driver-category — a website rather than a resolvable terminology server, so SPiER defines the code here and this system is the canonical one (#265)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #suicide-driver "Suicide Driver" "Condition is a CAMS-identified driver of the patient's suicidality. Surface on the problem list and track until resolved at CAMS disposition."


// ─── CodeSystem / ValueSet: CAMS Driver Type ─────────────────
// Minted under #265. The demo emitted this distinction as
// `http://cams-care.com/driver-type`, a vendor marketing-site URL that is not a
// resolvable terminology server and that no SPiER artifact defined — the only
// vocabulary in the demo with nothing canonical behind it.
//
// Three options were on the table. Reusing the CarePlan section codes
// (`cams-careplan-section#direct-drivers` / `#indirect-drivers`) was rejected:
// those identify a *section of a document*, and overloading them onto
// `Condition.category` is exactly the modelling shortcut safety-plan-section.fsh
// declined when it kept the CAMS and Stanley-Brown section vocabularies apart.
// Dropping the classification entirely would have discarded information the
// clinician actually recorded. Minting is what every other CAMS vocabulary here
// already does.
CodeSystem: CAMSDriverTypeCodes
Id: cams-driver-type
Title: "CAMS Driver Type Codes"
Description: "Whether a CAMS-identified driver of suicidality acts directly or indirectly. Used on Condition.category alongside the cams-driver-category marker."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #direct "Direct Driver" "A problem the patient identifies as directly driving the suicidality — removing or resolving it would reduce suicidal ideation. Section II of the CAMS Therapeutic Worksheet treats these as the primary treatment targets."
* #indirect "Indirect Driver" "An underlying factor that contributes to suicidality without by itself precipitating acute ideation. Addressed in treatment, but not the acute target."


ValueSet: CAMSDriverType
Id: cams-driver-type-vs
Title: "CAMS Driver Type"
Description: "Bindable set of CAMS driver types, for Condition.category on a CAMS suicide-driver Condition and for the driver-type answer options on SSF-5 Section B."
* ^status = #draft
* ^experimental = true
* include codes from system CAMSDriverTypeCodes


// ─── CodeSystem / ValueSet: CAMS Outcome Disposition ─────────
// Final-session (Outcome/Disposition) decision. The derived Observation
// follows the BSSA precedent: code 93374-7 with a SPiER-local disposition
// value. This is a care-disposition decision, not a risk tier, so it is
// NOT crosswalked to the common suicide-risk tier.

CodeSystem: CAMSDispositionCodes
Id: cams-disposition
Title: "CAMS Outcome Disposition Codes"
Description: "SPiER-local codes for the CAMS SSF-5 Outcome/Disposition final-session decision (episode closure and next step)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #continue-cams "Continue CAMS outpatient care" "Resolution criteria not yet met; continue CAMS treatment."
* #resolved "CAMS resolved — episode complete" "Resolution criteria met (three consecutive sessions of overall risk ≤ 2, managing thoughts/feelings, behaviorally stable)."
* #refer-adjunctive "Refer to other / adjunctive treatment" "Refer to or add adjunctive treatment (e.g., group therapy) alongside or after CAMS."
* #higher-level-care "Step up to a higher level of care" "Escalate to a higher level of care (e.g., inpatient) due to increased risk or instability."

// The SSF-5 outcome/disposition Questionnaire carries the worked example into
// the answerOption label. `Coding.display` must match the CodeSystem, so those
// labels are registered here as designations.
* #refer-adjunctive ^designation[+].language = #en
* #refer-adjunctive ^designation[=].value = "Refer to other / adjunctive treatment (e.g., group therapy)"
* #higher-level-care ^designation[+].language = #en
* #higher-level-care ^designation[=].value = "Step up to a higher level of care (e.g., inpatient)"


ValueSet: CAMSDisposition
Id: cams-disposition-vs
Title: "CAMS Outcome Disposition"
Description: "All CAMS SSF-5 Outcome/Disposition final-session decisions."
* ^status = #draft
* ^experimental = true
* include codes from system CAMSDispositionCodes


// ─── Observation profile: SSF Vital ──────────────────────────

Profile: SPiERCAMSSSFVital
Parent: Observation
Id: spier-cams-ssf-vital
Title: "SPiER CAMS SSF Vital Observation"
Description: "Integer rating (1–5) for one of the six Suicide Status Form (SSF) Core Assessment measures collected during CAMS Section A. Each SSF measure (psychological pain, stress, agitation, hopelessness, self-hate, overall risk) produces a separate Observation conformant to this profile so that EHRs can chart them longitudinally across CAMS sessions."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
// Standard `survey` category + the Gravity-pattern domain tag, so this resource
// is retrievable with the rest of the suicide-safer care record by category
// alone (#262) and satisfies us-core-observation-screening-assessment.
* insert SurveyAndSuicideRiskCategory
* code from CAMSSSFMeasure (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only integer


ValueSet: CAMSSSFMeasure
Id: cams-ssf-measure
Title: "CAMS SSF Measure"
Description: "All six CAMS SSF Core Assessment measures."
* ^status = #draft
* ^experimental = true
* include codes from system CAMSSSFMeasureCodes


// ─── CodeSystem: SSF Overall Risk rating (crosswalk source) ──
// CAMS Section A records the self-rated Overall Risk of Suicide (SSF
// rating 6) as a plain integer 1–5 (valueInteger on SPiERCAMSSSFVital);
// no LOINC concept has been published for this measure (verified July
// 2026). This CodeSystem provides the ordinal CODED representation of
// that same 1–5 scale so it can serve as the source of the overall-risk
// → suicide-risk-tier ConceptMap (crosswalk-cams.fsh), mirroring how the
// C-SSRS risk level (cssrs-risk-level) sources its crosswalk. A producer
// maps valueInteger n to the like-numbered code before translating.

CodeSystem: CAMSSSFOverallRiskCodes
Id: cams-ssf-overall-risk
Title: "CAMS SSF Overall Risk Rating Codes"
Description: "SPiER-local ordinal codes (1–5) for the patient's self-rated CAMS SSF Overall Risk of Suicide (SSF rating 6). Coded representation of the 1–5 rating that CAMS Section A stores as a plain integer, used as the source of the overall-risk → suicide-risk-tier ConceptMap. No LOINC concept exists for this SSF measure (verified July 2026)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #1 "1 — Extremely low risk" "Self-rated overall risk of suicide = 1 (extremely low; will not kill self)."
* #2 "2 — Low risk" "Self-rated overall risk of suicide = 2."
* #3 "3 — Moderate risk" "Self-rated overall risk of suicide = 3."
* #4 "4 — High risk" "Self-rated overall risk of suicide = 4."
* #5 "5 — Extremely high risk" "Self-rated overall risk of suicide = 5 (extremely high; will kill self)."


ValueSet: CAMSSSFOverallRisk
Id: cams-ssf-overall-risk
Title: "CAMS SSF Overall Risk Rating"
Description: "All five CAMS SSF self-rated Overall Risk of Suicide ratings (1–5)."
* ^status = #draft
* ^experimental = true
* include codes from system CAMSSSFOverallRiskCodes


// ─── Condition profile: Suicide Driver ───────────────────────

Profile: SPiERCAMSSuicideDriver
Parent: Condition
Id: spier-cams-suicide-driver
Title: "SPiER CAMS Suicide Driver Condition"
Description: "A Condition representing a CAMS-identified driver of suicidality. Surfaces on the patient's problem list (active until resolved at CAMS disposition). The driver's narrative description is captured in Condition.code.text; the marker category http://thespierproject.org/fhir/CodeSystem/cams-driver-category#suicide-driver identifies the resource as a CAMS driver."
* ^status = #draft
* ^experimental = true
* clinicalStatus 1..1
// `category` carries three independent things here, so all three are named
// slices (#265): the CAMS driver marker, the direct/indirect classification the
// clinician recorded, and the Gravity domain tag. Naming them is what lets the
// direct/indirect slot carry a real binding rather than sit as an untyped extra
// repetition — which is how it went unnoticed that the demo was filling it from
// a vendor URL no SPiER artifact defined.
//
// The marker moves to 1..1. The profile's own Description already asserts that
// this category "identifies the resource as a CAMS driver", but nothing enforced
// it: a Condition carrying only the domain tag conformed. The slice makes the
// stated contract true.
//
// `driverType` fixes the system and binds the code, rather than binding alone. A
// `#pattern` discriminator on `$this` cannot tell one repetition from another
// using a two-code binding — the fixed system is what makes the slice
// discriminable, and the required binding is what constrains it to direct or
// indirect.
* insert SuicideRiskDomainSlicing
* category contains driverCategory 1..1 and driverType 0..1
* category[driverCategory] = CAMSDriverCategoryCodes#suicide-driver
* category[driverCategory] ^short = "CAMS suicide-driver marker"
* category[driverType].coding 1..1
* category[driverType].coding.system = "http://thespierproject.org/fhir/CodeSystem/cams-driver-type" (exactly)
* category[driverType] from CAMSDriverType (required)
* category[driverType] ^short = "Direct or indirect driver, when the clinician classified it"
* insert SuicideRiskDomainSlice
* category.coding 1..*
* code 1..1
// The text stays required and the coding stays optional — reviewed under #43
// and deliberately left as it was. A CAMS driver is idiographic: "relationship
// conflict with spouse — feeling trapped and hopeless" is the clinical content,
// and no terminology carries concepts at that granularity. A required coding
// would force clinicians to replace what they and the patient identified with a
// coarser label that means something else.
//
// The binding is `example` rather than `extensible` for the same reason. An
// extensible binding would assert that a driver IS one of these concepts unless
// no suitable one exists; the honest claim is weaker — most drivers are not in
// any code set, and where one happens to align, this is the set to draw from so
// the coded row matches SPiERSuicideRelatedCondition elsewhere on the problem
// list. See suicide-related-conditions.fsh for the scoping rationale in full.
* code from SPiERSuicideRelatedProblem (example)
* code.text 1..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* clinicalStatus MS
* subject MS
* category MS
* code MS
* subject 1..1
* subject only Reference(Patient)


// ─── CarePlan section codes ──────────────────────────────────
// Both CAMS CarePlans are section-structured documents — the Stabilization Plan
// has five fixed sections, the Therapeutic Worksheet four. Until now both
// profiles said only `activity.detail.code 1..1`, which a CodeableConcept
// carrying nothing but free text satisfies. Section identity was therefore
// human-readable only: a consumer could not tell "lethal means" from "coping
// strategies" without string-matching English prose, which is exactly the
// machine-actionability SPiER exists to provide.
//
// All codes here are SPiER-local, deliberately.
//
// The obvious move was to reuse the LOINC codes the Stanley-Brown and Crisis
// Response Plan CarePlans then emitted for the equivalent safety-plan sections
// (76689-1, 76690-9, 76691-7, 76692-5, 76693-3, 76694-1), listed as verified in
// FHIR-Resources/Stanley-Brown/README.md's "Clinical Mapping Audit Table".
// Those six codes DO NOT EXIST in LOINC — confirmed against LOINC 2.82 by both
// the IG Publisher and tx.fhir.org's $validate-code. (81344-4, used for "Reason
// for Living", is a real code meaning "Healthcare agent authority to inspect and
// disclose mental and physical health information" — valid, but not that.)
//
// Reusing them would have published unresolvable codes in a required binding, so
// every section gets a local code instead. Those seven codes have since been
// withdrawn repo-wide and replaced by http://thespierproject.org/fhir/CodeSystem/safety-plan-section
// (issue #220) — see safety-plan-section.fsh, which also records the exhaustive
// LOINC 2.82 search establishing that no published concepts exist at
// safety-plan-section granularity for either template.

CodeSystem: CAMSCarePlanSectionCodes
Id: cams-careplan-section
Title: "CAMS CarePlan Section Codes"
Description: "SPiER-local section codes identifying which section of a CAMS CarePlan an activity represents. Local rather than LOINC because no published LOINC concepts for these safety-plan and CAMS-framework sections could be verified."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #lethal-means-reduction "Lethal Means Reduction" "Steps agreed to reduce the patient's access to lethal means. Section 1 of the CAMS Stabilization Plan."
* #coping-strategies "Coping Strategies" "What the patient can do differently to cope during a suicidal crisis. Section 2 of the CAMS Stabilization Plan."
* #emergency-contact "Emergency Contact" "The life-or-death emergency contact number for this patient. Section 3 of the CAMS Stabilization Plan."
* #support-network "Support Network" "People the patient can call for help or to decrease isolation. Section 4 of the CAMS Stabilization Plan."
* #treatment-adherence "Treatment Adherence Plan" "Barriers to attending treatment as scheduled, each paired with the solution agreed for it. Section 5 of the CAMS Stabilization Plan."
* #personal-narrative "Personal Story of Suicidality" "The patient's own account of how they came to be suicidal. Section I of the CAMS Therapeutic Worksheet."
* #direct-drivers "Direct Drivers of Suicidality" "The problems the patient identifies as directly driving the suicidality. Section II of the CAMS Therapeutic Worksheet."
* #indirect-drivers "Indirect Drivers of Suicidality" "Underlying factors that contribute to, but do not by themselves precipitate, acute suicidal ideation. Section II of the CAMS Therapeutic Worksheet."
* #crisis-working-model "Suicide Crisis Working Model" "The patient's model of what raises and lowers risk at each stage of a suicidal crisis. Section III of the CAMS Therapeutic Worksheet."


ValueSet: CAMSStabilizationPlanSection
Id: cams-stabilization-plan-section
Title: "CAMS Stabilization Plan Section"
Description: "The five sections of a CAMS Stabilization Plan, as used in CarePlan.activity.detail.code."
* ^status = #draft
* ^experimental = true
* CAMSCarePlanSectionCodes#lethal-means-reduction
* CAMSCarePlanSectionCodes#coping-strategies
* CAMSCarePlanSectionCodes#emergency-contact
* CAMSCarePlanSectionCodes#support-network
* CAMSCarePlanSectionCodes#treatment-adherence


ValueSet: CAMSTherapeuticWorksheetSection
Id: cams-therapeutic-worksheet-section
Title: "CAMS Therapeutic Worksheet Section"
Description: "The four content sections of a CAMS Therapeutic Worksheet, as used in CarePlan.activity.detail.code. All SPiER-local — CAMS's narrative and driver constructs have no published LOINC equivalent."
* ^status = #draft
* ^experimental = true
* CAMSCarePlanSectionCodes#personal-narrative
* CAMSCarePlanSectionCodes#direct-drivers
* CAMSCarePlanSectionCodes#indirect-drivers
* CAMSCarePlanSectionCodes#crisis-working-model


// ─── CarePlan profile: CAMS Stabilization Plan ───────────────

Profile: SPiERCAMSStabilizationPlan
Parent: CarePlan
Id: spier-cams-stabilization-plan
Title: "SPiER CAMS Stabilization Plan CarePlan"
Description: "CarePlan capturing a CAMS Stabilization Plan — a CAMS-framework safety plan that should be reviewed and updated at the start of every CAMS session. Five-section structure: lethal-means reduction, coping strategies, emergency contact, support network, and treatment-adherence plan."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #active (exactly)
* intent 1..1
* intent = #plan (exactly)
* category 1..*
* category.coding 1..*
* subject 1..1
* subject only Reference(Patient)
// Every activity IS a named section, so the section code is the discriminator.
// Slicing is declared `open` rather than `closed` as a style choice only: with a
// required binding plus 1..1 on all five slices, the sections are already
// exhaustive. If extra activities ever need to be allowed, relax the binding.
* activity 1..*
* activity ^slicing.discriminator.type = #pattern
* activity ^slicing.discriminator.path = "detail.code"
* activity ^slicing.rules = #open
* activity contains
    lethalMeans 1..1 and
    copingStrategies 1..1 and
    emergencyContact 1..1 and
    supportNetwork 1..1 and
    treatmentAdherence 1..1
* activity[lethalMeans].detail.code = CAMSCarePlanSectionCodes#lethal-means-reduction
* activity[copingStrategies].detail.code = CAMSCarePlanSectionCodes#coping-strategies
* activity[emergencyContact].detail.code = CAMSCarePlanSectionCodes#emergency-contact
* activity[supportNetwork].detail.code = CAMSCarePlanSectionCodes#support-network
* activity[treatmentAdherence].detail.code = CAMSCarePlanSectionCodes#treatment-adherence
* activity.detail.code 1..1
* activity.detail.code from CAMSStabilizationPlanSection (required)
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* category MS
// SNOMED treatment-escalation-plan artifact type + the Gravity-pattern domain
// tag, so this resource is retrievable with the rest of the suicide-safer care
// record by category alone (#262).
* insert SafetyPlanAndSuicideRiskCategory
* activity MS
* activity.detail.code MS


// ─── CarePlan profile: CAMS Therapeutic Worksheet ────────────

Profile: SPiERCAMSTherapeuticWorksheet
Parent: CarePlan
Id: spier-cams-therapeutic-worksheet
Title: "SPiER CAMS Therapeutic Worksheet CarePlan"
Description: "CarePlan capturing a CAMS Therapeutic Worksheet — the personal narrative, direct/indirect suicide drivers, and the patient's working model of their suicidal crisis. Used to guide ongoing CAMS-framework treatment between sessions."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #active (exactly)
* intent 1..1
* intent = #plan (exactly)
* category 1..*
* category.coding 1..*
* subject 1..1
* subject only Reference(Patient)
// Four activities, not three: the Questionnaire's section II
// (`drivers-exploration`) carries both the direct- and indirect-driver
// analyses, and they are separate concepts downstream — so the CarePlan splits
// them rather than collapsing the pair into one activity.
* activity 1..*
* activity ^slicing.discriminator.type = #pattern
* activity ^slicing.discriminator.path = "detail.code"
* activity ^slicing.rules = #open
* activity contains
    personalNarrative 1..1 and
    directDrivers 1..1 and
    indirectDrivers 1..1 and
    crisisWorkingModel 1..1
* activity[personalNarrative].detail.code = CAMSCarePlanSectionCodes#personal-narrative
* activity[directDrivers].detail.code = CAMSCarePlanSectionCodes#direct-drivers
* activity[indirectDrivers].detail.code = CAMSCarePlanSectionCodes#indirect-drivers
* activity[crisisWorkingModel].detail.code = CAMSCarePlanSectionCodes#crisis-working-model
* activity.detail.code 1..1
* activity.detail.code from CAMSTherapeuticWorksheetSection (required)
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* category MS
// SNOMED treatment-escalation-plan artifact type + the Gravity-pattern domain
// tag, so this resource is retrievable with the rest of the suicide-safer care
// record by category alone (#262).
* insert SafetyPlanAndSuicideRiskCategory
* activity MS
* activity.detail.code MS


// ─── ActivityDefinitions ─────────────────────────────────────

// ─── Observation profile: CAMS Outcome Disposition ───────────

Profile: SPiERCAMSOutcomeDisposition
Parent: Observation
Id: spier-cams-outcome-disposition
Title: "SPiER CAMS Outcome Disposition Observation"
Description: "The disposition decision from the CAMS SSF-5 Outcome/Disposition final session. Follows the BSSA precedent: the Observation carries the generic LOINC 93374-7 ('Suicide risk level') and a SPiER-local disposition value (continue-cams / resolved / refer-adjunctive / higher-level-care). A care-disposition decision, not a risk tier."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
// Standard `survey` category + the Gravity-pattern domain tag, so this resource
// is retrievable with the rest of the suicide-safer care record by category
// alone (#262) and satisfies us-core-observation-screening-assessment.
* insert SurveyAndSuicideRiskCategory
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
* valueCodeableConcept from CAMSDisposition (required)
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


Instance: AdministerCAMSSectionA
InstanceOf: ActivityDefinition
Title: "Administer CAMS SSF-5 Section A (Patient Vitals)"
Description: "Patient-completed Suicide Status Form Section A. Produces six SSF Vital Observations conformant to SPiERCAMSSSFVital — one each for psychological pain, stress, agitation, hopelessness, self-hate, and overall risk. The 'overall risk' measure carries the patient's self-rated suicide risk on the same 1–5 scale and serves as the activity's risk-level component."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSSectionA"
* name = "AdministerCAMSSectionA"
* version = "0.1.0"
* title = "Administer CAMS SSF-5 Section A (Patient Vitals)"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Patient-completed Suicide Status Form Section A. Produces six SSF Vital Observations covering psychological pain, stress, agitation, hopelessness, self-hate, and overall risk. The 'overall risk' measure functions as the risk-level component of the assessment."
* purpose = "Capture the patient's self-rated CAMS SSF Core Assessment at the Clarify Risk stage. Repeated for longitudinal tracking during CAMS treatment episodes."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Section A questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionA|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCAMS


Instance: AdministerCAMSSectionB
InstanceOf: ActivityDefinition
Title: "Administer CAMS SSF-5 Section B (Clinician Drivers)"
Description: "Clinician-completed Suicide Status Form Section B. Identifies up to three suicide drivers, each materialized as a SPiERCAMSSuicideDriver Condition on the patient's problem list. Ideation and plan presence are recorded clinically within the QuestionnaireResponse but are not yet materialized as separate FHIR resources (future work — see Roadmap)."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSSectionB"
* name = "AdministerCAMSSectionB"
* version = "0.1.0"
* title = "Administer CAMS SSF-5 Section B (Clinician Drivers)"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Clinician-completed Suicide Status Form Section B. Captures up to three CAMS-identified drivers of suicidality, each materialized as a Condition resource on the patient's problem list. Ideation and plan presence are captured in the QuestionnaireResponse but are not currently emitted as separate FHIR resources."
* purpose = "Capture the clinician's CAMS driver assessment at the Clarify Risk stage. Drivers surface on the problem list and guide treatment until resolution."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Section B questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionB|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCAMS


Instance: AdministerCAMSTherapeuticWorksheet
InstanceOf: ActivityDefinition
Title: "Author CAMS Therapeutic Worksheet"
Description: "Collaboratively complete a CAMS Therapeutic Worksheet capturing the patient's personal narrative, direct and indirect suicide drivers, and crisis working model."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSTherapeuticWorksheet"
* name = "AdministerCAMSTherapeuticWorksheet"
* version = "0.1.0"
* title = "Author CAMS Therapeutic Worksheet"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Author a CAMS Therapeutic Worksheet CarePlan capturing the patient's personal narrative, direct/indirect suicide drivers, and crisis working model."
* purpose = "Document the CAMS clinical formulation that guides ongoing treatment. Belongs to the Define the Risk Picture stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS Therapeutic Worksheet"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CAMS-Therapeutic-Worksheet|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCAMS


Instance: AdministerCAMSStabilizationPlan
InstanceOf: ActivityDefinition
Title: "Author CAMS Stabilization Plan"
Description: "Collaboratively complete a CAMS Stabilization Plan CarePlan — the CAMS-framework safety plan covering lethal-means reduction, coping strategies, emergency contact, support network, and treatment-adherence plan."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSStabilizationPlan"
* name = "AdministerCAMSStabilizationPlan"
* version = "0.1.0"
* title = "Author CAMS Stabilization Plan"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Author a CAMS Stabilization Plan CarePlan covering lethal-means reduction, coping strategies, emergency contact, support network, and treatment-adherence plan."
* purpose = "Document concrete safety actions in the CAMS framework. Reviewed and updated at the start of every CAMS session. Belongs to the Document Safety Actions stage as an alternative or complement to Stanley-Brown."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS Stabilization Plan template"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CAMS-Stabilization-Plan|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCAMS


Instance: AdministerCAMSInterimSession
InstanceOf: ActivityDefinition
Title: "Administer CAMS Interim Session (SSF Re-Rating)"
Description: "Repeat the CAMS Section A SSF Core Assessment at the start of each CAMS interim session. Same Questionnaire as Section A; a distinct session form of the single catalogued CAMS SSF-5 tool (Clarify Risk stage)."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSInterimSession"
* name = "AdministerCAMSInterimSession"
* version = "0.1.0"
* title = "Administer CAMS Interim Session (SSF Re-Rating)"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Repeat the CAMS Section A SSF Core Assessment at the start of each interim CAMS session. Produces a fresh set of six SSF Vital Observations for longitudinal trend analysis."
* purpose = "Track SSF vitals across active-risk care episodes. Resolution criteria are met when three consecutive interim sessions show low overall risk."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Section A questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionA|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCAMS


// Promoted out of pathway-tool-placeholders.fsh. The AD id and canonical URL
// are unchanged so the TL-020 catalog mapping (one CAMS SSF-5 tool) and the
// clarify-risk stage PlanDefinition action stay stable.
Instance: AdministerCAMSOutcomeDisposition
InstanceOf: ActivityDefinition
Title: "Administer CAMS SSF-5 Outcome/Disposition (Final Session)"
Description: "CAMS final-session Outcome/Disposition: re-rate the SSF Core Assessment, confirm whether resolution criteria are met, and record the episode disposition. Produces SSF Vital Observations plus a disposition Observation conformant to SPiERCAMSOutcomeDisposition."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSOutcomeDisposition"
* name = "AdministerCAMSOutcomeDisposition"
* version = "1.0.0"
* title = "Administer CAMS SSF-5 Outcome/Disposition (Final Session)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "CAMS final-session Outcome/Disposition form: re-rate the six SSF Core Assessment vitals, determine whether CAMS resolution criteria are met, capture what made the difference, and record the disposition (continue CAMS, resolved, refer to adjunctive treatment, or higher level of care). A distinct session form of the single catalogued CAMS SSF-5 tool (TL-020)."
* purpose = "Close the CAMS episode with a documented disposition and final SSF vitals. Belongs to the Clarify Risk stage as the final CAMS session form."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Outcome/Disposition questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-OutcomeDisposition|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCAMS


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleCAMSSSFPsychologicalPain
InstanceOf: SPiERCAMSSSFVital
Title: "Example — CAMS SSF: Psychological Pain 4/5"
Description: "Sample SSF Vital Observation showing elevated psychological pain reported during a CAMS Section A assessment."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = CAMSSSFMeasureCodes#psychological-pain "Psychological Pain"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:00:00Z"
* valueInteger = 4
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#H "High"
* interpretation[=].text = "Elevated (4/5)"


Instance: ExampleCAMSSuicideDriver
InstanceOf: SPiERCAMSSuicideDriver
Title: "Example — CAMS Suicide Driver: Relationship Conflict"
Description: "Sample Condition representing a CAMS-identified driver of suicidality. Surfaces on the patient's problem list with the marker category set."
Usage: #example
* clinicalStatus = http://terminology.hl7.org/CodeSystem/condition-clinical#active "Active"
* category[driverCategory] = CAMSDriverCategoryCodes#suicide-driver "Suicide Driver"
* category[driverType] = CAMSDriverTypeCodes#direct "Direct Driver"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code.text = "Relationship conflict with spouse — feeling trapped and hopeless"
* subject = Reference(Patient/example)
* note[+].text = "Identified during CAMS Section B assessment. Track on problem list until resolved at CAMS disposition."


Instance: ExampleCAMSStabilizationPlan
InstanceOf: SPiERCAMSStabilizationPlan
Title: "Example — Completed CAMS Stabilization Plan"
Description: "Sample CAMS Stabilization Plan CarePlan with all five sections populated. Each activity carries its SPiER-local section code, with the human label retained in detail.code.text."
Usage: #example
* status = #active
* intent = #plan
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#lethal-means-reduction "Lethal Means Reduction"
  * code.text = "Lethal Means Reduction"
  * status = #in-progress
  * description = "Locked medication box; firearm transferred to trusted family member; clinic gun-lock voucher accepted"
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#coping-strategies "Coping Strategies"
  * code.text = "Coping Strategies"
  * status = #in-progress
  * description = "Mindfulness breathing; grounding 5-4-3-2-1; calling crisis line BEFORE pain peaks"
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#emergency-contact "Emergency Contact"
  * code.text = "Emergency Contact"
  * status = #in-progress
  * description = "Dr. Chen (555-0200), pager 555-0299; 988 Suicide & Crisis Lifeline"
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#support-network "Support Network"
  * code.text = "Support Network"
  * status = #in-progress
  * description = "Sister Maria (555-0143); best friend Joe (555-0188); NAMI peer support group Thursdays"
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#treatment-adherence "Treatment Adherence Plan"
  * code.text = "Treatment Adherence Plan"
  * status = #in-progress
  * description = "Barrier: transportation → Solution: ride-share voucher from clinic. Barrier: medication cost → Solution: patient-assistance program."


// The Therapeutic Worksheet profile had no example instance at all, so nothing
// exercised its constraints — the gap that made #95's "example CarePlans should
// validate meaningfully" impossible to demonstrate either way.
Instance: ExampleCAMSTherapeuticWorksheet
InstanceOf: SPiERCAMSTherapeuticWorksheet
Title: "Example — Completed CAMS Therapeutic Worksheet"
Description: "Sample CAMS Therapeutic Worksheet CarePlan from an interim session, with all four content sections populated: the personal narrative, the direct and indirect drivers, and the patient's own working model of their suicidal crisis."
Usage: #example
* status = #active
* intent = #plan
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#personal-narrative "Personal Story of Suicidality"
  * status = #in-progress
  * description = "Began after the layoff in November; worsened when the marriage ended. Describes feeling 'replaceable at work and at home'."
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#direct-drivers "Direct Drivers of Suicidality"
  * status = #in-progress
  * description = "Problem #1 — belief of being a burden to family. Problem #2 — unresolved job loss and loss of professional identity."
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#indirect-drivers "Indirect Drivers of Suicidality"
  * status = #in-progress
  * description = "Escalating alcohol use in the evenings; chronic insomnia; untreated PTSD from a 2019 motor-vehicle collision."
* activity[+].detail
  * code = CAMSCarePlanSectionCodes#crisis-working-model "Suicide Crisis Working Model"
  * status = #in-progress
  * description = "Raises risk: drinking alone after 9pm, scrolling former colleagues' posts. Lowers risk: morning gym, calling sister, weekly group."


Instance: ExampleCAMSOutcomeDispositionResolved
InstanceOf: SPiERCAMSOutcomeDisposition
Title: "Example — CAMS Outcome/Disposition: Resolved"
Description: "Sample disposition Observation from a CAMS final session where resolution criteria were met and the episode was closed as resolved."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T16:00:00Z"
* derivedFrom[+] = Reference(ExampleCAMSOutcomeDispositionResponse)
* valueCodeableConcept = CAMSDispositionCodes#resolved "CAMS resolved — episode complete"
* note.text = "Three consecutive sessions with overall risk 2/5, managing thoughts, behaviorally stable. Disposition: resolved."


Instance: ExampleCAMSOutcomeDispositionResponse
InstanceOf: QuestionnaireResponse
Title: "Example — CAMS Outcome/Disposition QuestionnaireResponse (resolved)"
Description: "Source CAMS Outcome/Disposition QuestionnaireResponse: low final SSF vitals, resolution met, disposition resolved. The derived SPiERCAMSOutcomeDisposition references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-OutcomeDisposition"
* subject = Reference(Patient/example)
* authored = "2026-07-15T16:00:00Z"
* item[+].linkId = "core-ratings"
* item[=].item[+].linkId = "6-score"
* item[=].item[=].answer.valueInteger = 2
* item[+].linkId = "disposition"
* item[=].answer.valueCoding = http://thespierproject.org/fhir/CodeSystem/cams-disposition#resolved "CAMS resolved — episode complete"
