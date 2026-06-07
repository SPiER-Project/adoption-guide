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
//   http://spier.org/Questionnaire/CAMS-SSF5-SectionA|1.0.0
//   http://spier.org/Questionnaire/CAMS-SSF5-SectionB|1.0.0
//   http://spier.org/Questionnaire/CAMS-Therapeutic-Worksheet|1.0.0
//   http://spier.org/Questionnaire/CAMS-Stabilization-Plan|1.0.0
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
Description: "Marker category used on Condition resources that represent CAMS-identified suicide drivers. Mirrors http://cams-care.com/driver-category for SPiER artifacts that need to surface drivers on the FHIR problem list."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #suicide-driver "Suicide Driver" "Condition is a CAMS-identified driver of the patient's suicidality. Surface on the problem list and track until resolved at CAMS disposition."


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


// ─── Condition profile: Suicide Driver ───────────────────────

Profile: SPiERCAMSSuicideDriver
Parent: Condition
Id: spier-cams-suicide-driver
Title: "SPiER CAMS Suicide Driver Condition"
Description: "A Condition representing a CAMS-identified driver of suicidality. Surfaces on the patient's problem list (active until resolved at CAMS disposition). The driver's narrative description is captured in Condition.code.text; the marker category http://spier.org/CodeSystem/cams-driver-category#suicide-driver identifies the resource as a CAMS driver."
* ^status = #draft
* ^experimental = true
* clinicalStatus 1..1
* category 1..*
* category.coding 1..*
* code 1..1
* code.text 1..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* clinicalStatus MS
* subject MS
* category MS
* code MS
* subject 1..1
* subject only Reference(Patient)


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
* activity 1..*
* activity.detail.code 1..1
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* category MS
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
* activity 1..*
* activity.detail.code 1..1
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* category MS
* activity MS
* activity.detail.code MS


// ─── ActivityDefinitions ─────────────────────────────────────

Instance: AdministerCAMSSectionA
InstanceOf: ActivityDefinition
Title: "Administer CAMS SSF-5 Section A (Patient Vitals)"
Description: "Patient-completed Suicide Status Form Section A. Produces six SSF Vital Observations conformant to SPiERCAMSSSFVital — one each for psychological pain, stress, agitation, hopelessness, self-hate, and overall risk. The 'overall risk' measure carries the patient's self-rated suicide risk on the same 1–5 scale and serves as the activity's risk-level component."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCAMSSectionA"
* name = "AdministerCAMSSectionA"
* title = "Administer CAMS SSF-5 Section A (Patient Vitals)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Patient-completed Suicide Status Form Section A. Produces six SSF Vital Observations covering psychological pain, stress, agitation, hopelessness, self-hate, and overall risk. The 'overall risk' measure functions as the risk-level component of the assessment."
* purpose = "Capture the patient's self-rated CAMS SSF Core Assessment at the Clarify Risk stage. Repeated for longitudinal tracking during CAMS treatment episodes."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Section A questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/CAMS-SSF5-SectionA|1.0.0"


Instance: AdministerCAMSSectionB
InstanceOf: ActivityDefinition
Title: "Administer CAMS SSF-5 Section B (Clinician Drivers)"
Description: "Clinician-completed Suicide Status Form Section B. Identifies up to three suicide drivers, each materialized as a SPiERCAMSSuicideDriver Condition on the patient's problem list. Ideation and plan presence are recorded clinically within the QuestionnaireResponse but are not yet materialized as separate FHIR resources (future work — see Roadmap)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCAMSSectionB"
* name = "AdministerCAMSSectionB"
* title = "Administer CAMS SSF-5 Section B (Clinician Drivers)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Clinician-completed Suicide Status Form Section B. Captures up to three CAMS-identified drivers of suicidality, each materialized as a Condition resource on the patient's problem list. Ideation and plan presence are captured in the QuestionnaireResponse but are not currently emitted as separate FHIR resources."
* purpose = "Capture the clinician's CAMS driver assessment at the Clarify Risk stage. Drivers surface on the problem list and guide treatment until resolution."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Section B questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/CAMS-SSF5-SectionB|1.0.0"


Instance: AdministerCAMSTherapeuticWorksheet
InstanceOf: ActivityDefinition
Title: "Author CAMS Therapeutic Worksheet"
Description: "Collaboratively complete a CAMS Therapeutic Worksheet capturing the patient's personal narrative, direct and indirect suicide drivers, and crisis working model."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCAMSTherapeuticWorksheet"
* name = "AdministerCAMSTherapeuticWorksheet"
* title = "Author CAMS Therapeutic Worksheet"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Author a CAMS Therapeutic Worksheet CarePlan capturing the patient's personal narrative, direct/indirect suicide drivers, and crisis working model."
* purpose = "Document the CAMS clinical formulation that guides ongoing treatment. Belongs to the Set Risk Status stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS Therapeutic Worksheet"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/CAMS-Therapeutic-Worksheet|1.0.0"


Instance: AdministerCAMSStabilizationPlan
InstanceOf: ActivityDefinition
Title: "Author CAMS Stabilization Plan"
Description: "Collaboratively complete a CAMS Stabilization Plan CarePlan — the CAMS-framework safety plan covering lethal-means reduction, coping strategies, emergency contact, support network, and treatment-adherence plan."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCAMSStabilizationPlan"
* name = "AdministerCAMSStabilizationPlan"
* title = "Author CAMS Stabilization Plan"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Author a CAMS Stabilization Plan CarePlan covering lethal-means reduction, coping strategies, emergency contact, support network, and treatment-adherence plan."
* purpose = "Document concrete safety actions in the CAMS framework. Reviewed and updated at the start of every CAMS session. Belongs to the Document Safety Actions stage as an alternative or complement to Stanley-Brown."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS Stabilization Plan template"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/CAMS-Stabilization-Plan|1.0.0"


Instance: AdministerCAMSInterimSession
InstanceOf: ActivityDefinition
Title: "Administer CAMS Interim Session (SSF Re-Rating)"
Description: "Repeat the CAMS Section A SSF Core Assessment at the start of each CAMS interim session. Same Questionnaire as Section A, but distinct activity because it belongs to the Manage Active Risk stage rather than initial Clarify Risk."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCAMSInterimSession"
* name = "AdministerCAMSInterimSession"
* title = "Administer CAMS Interim Session (SSF Re-Rating)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Repeat the CAMS Section A SSF Core Assessment at the start of each interim CAMS session. Produces a fresh set of six SSF Vital Observations for longitudinal trend analysis."
* purpose = "Track SSF vitals across active-risk care episodes. Resolution criteria are met when three consecutive interim sessions show low overall risk."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "CAMS SSF-5 Section A questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/CAMS-SSF5-SectionA|1.0.0"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleCAMSSSFPsychologicalPain
InstanceOf: SPiERCAMSSSFVital
Title: "Example — CAMS SSF: Psychological Pain 4/5"
Description: "Sample SSF Vital Observation showing elevated psychological pain reported during a CAMS Section A assessment."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
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
* category[+] = CAMSDriverCategoryCodes#suicide-driver "Suicide Driver"
* code.text = "Relationship conflict with spouse — feeling trapped and hopeless"
* subject = Reference(Patient/example)
* note[+].text = "Identified during CAMS Section B assessment. Track on problem list until resolved at CAMS disposition."


Instance: ExampleCAMSStabilizationPlan
InstanceOf: SPiERCAMSStabilizationPlan
Title: "Example — Completed CAMS Stabilization Plan"
Description: "Sample CAMS Stabilization Plan CarePlan with all five sections populated. Each activity names its section in detail.code.text (no validated LOINC panel applies to these safety-plan sections)."
Usage: #example
* status = #active
* intent = #plan
* category[+] = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* subject = Reference(Patient/example)
* activity[+].detail
  * code.text = "Lethal Means Reduction"
  * status = #in-progress
  * description = "Locked medication box; firearm transferred to trusted family member; clinic gun-lock voucher accepted"
* activity[+].detail
  * code.text = "Coping Strategies"
  * status = #in-progress
  * description = "Mindfulness breathing; grounding 5-4-3-2-1; calling crisis line BEFORE pain peaks"
* activity[+].detail
  * code.text = "Emergency Contact"
  * status = #in-progress
  * description = "Dr. Chen (555-0200), pager 555-0299; 988 Suicide & Crisis Lifeline"
* activity[+].detail
  * code.text = "Support Network"
  * status = #in-progress
  * description = "Sister Maria (555-0143); best friend Joe (555-0188); NAMI peer support group Thursdays"
* activity[+].detail
  * code.text = "Treatment Adherence Plan"
  * status = #in-progress
  * description = "Barrier: transportation → Solution: ride-share voucher from clinic. Barrier: medication cost → Solution: patient-assistance program."
