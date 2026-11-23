// =============================================================
// CapabilityStatements — role-segmented conformance
// =============================================================
// SPiER defines conformance per system ROLE (the HL7 Gravity Project
// pattern) rather than as one monolithic spec. Four actors map onto
// SPiER's audiences and the cross-EHR portability pilot:
//   - Screening-source EHR  — produces the pathway data
//   - HIE intermediary      — moves it across organizations
//   - Risk consumer/client  — reads the harmonized risk concept
//   - Quality reporter      — measures over it and extracts it (Stage 8)
//
// kind = #requirements: these describe the capabilities a conforming
// system of each role must support (not a specific instance/software).
// Referenced from pagecontent/conformance.html.
//
// STAGE 8 NOTE. TL-044 (Data Export) and TL-045 (Data Sharing) define no
// artifact of their own — what they need is that the workflow resources
// stages 4–7 produce are actually readable, searchable, and movable. That
// requirement belongs here rather than in a profile, which is why the three
// original roles below were extended with those resource types when Stage 8
// landed, and why the fourth role exists at all.
// =============================================================


// Expectations (decided 2026-11-23): one instrument plus the risk concept is
// enough to claim this role. "At least one instrument result profile" cannot
// be said with the expectation extension, which marks one element at a time,
// so each instrument profile is MAY and the rule is in the Observation
// documentation and on the Conformance page. Only this role is marked so far.
Instance: SPiERScreeningSourceEHR
InstanceOf: CapabilityStatement
Title: "SPiER Screening-Source EHR"
Description: "Capabilities of a system that CAPTURES a suicide-risk screening or assessment and PRODUCES the SPiER artifacts: it persists the QuestionnaireResponse and creates the derived instrument Observations, the harmonized suicide-risk concept Observation, and (for safety-planning tools) CarePlan / Condition resources."
Usage: #definition
* id = "screening-source-ehr"
* url = "http://thespierproject.org/fhir/CapabilityStatement/screening-source-ehr"
* name = "SPiERScreeningSourceEHR"
* title = "SPiER Screening-Source EHR"
* status = #draft
* experimental = true
* date = "2026-06-07"
* kind = #requirements
* fhirVersion = #4.0.1
* format[+] = #json
* format[+] = #xml
* rest[+]
  * mode = #server
  * documentation = "Captures screening data and writes the SPiER resources as discrete data. The minimum is one screening or assessment instrument: its QuestionnaireResponse, its result, and the suicide-risk concept derived from it. Every other resource type is optional; a source that supports one SHALL write it to the profile listed and support the interactions listed."
  * resource[+]
    * type = #QuestionnaireResponse
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #SHALL
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
  * resource[+]
    * type = #Observation
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #SHALL
    * documentation = "Derived instrument results, the harmonized suicide-risk concept, and means-safety actions (Stage 4). A source SHALL support the suicide-risk concept and at least one instrument result profile whose result maps into it; each further profile is optional."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-asq-result"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-bssa-disposition-result"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-total-score"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-item9"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss3-result"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss-full-risk-level"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-sbqr-total-score"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-outcome-disposition"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-concept"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #SHALL
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-means-safety-action"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Condition
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "Clinician-asserted suicide-related problems and CAMS-identified suicide drivers on the problem list. Never derived from a screening or assessment result."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-related-condition"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-suicide-driver"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
  * resource[+]
    * type = #CarePlan
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "Stanley-Brown and CAMS safety / stabilization plans, plus the Crisis Response Plan."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-stabilization-plan"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-therapeutic-worksheet"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
  // ─── Stage 4–7 workflow resources ───
  // Required for TL-044/TL-045: an extract or a shared bundle is only as
  // complete as the resource types the source system will hand over.
  * resource[+]
    * type = #Procedure
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "Lethal-means safety counseling delivered (Stage 4)."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-lethal-means-counseling"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Communication
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "Crisis resources shared (Stage 4), the suicide-safety handoff (Stage 5), and follow-up outreach attempts and caring contacts (Stage 6)."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-crisis-resources-shared"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-handoff"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-outreach-attempt"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-caring-contact"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #DocumentReference
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "The discharge safety packet (Stage 5)."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-discharge-safety-packet"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #ServiceRequest
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "The suicide-safety referral (Stage 5). SHALL support update — tracking a referral past `sent` through to `completed` is the whole reason this is a ServiceRequest, and is what makes referral loop closure measurable."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-referral"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Appointment
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "The follow-up appointment (Stage 5). SHALL support update: the 7- and 30-day follow-up measures read `status = fulfilled`, so a system that can book but never records attendance cannot produce them."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-follow-up-appointment"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Consent
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "Information-sharing consent (Stage 5). Governs what the Share Data activity (TL-045) may share and with whom."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-information-sharing-consent"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Encounter
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "The contact during which suicide-safer care happened. Every other resource names its encounter and the encounter names the episode, so one episode's record cannot be assembled without it. SHALL support update so an encounter can be linked to an episode opened after it began and its status advanced."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-encounter"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #EpisodeOfCare
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "The suicide-safer care episode (Stage 7) — the cohort anchor for every Stage-8 measure. SHALL support update so the episode can be closed with a reason."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-episode"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Flag
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "The active-episode chart banner (Stage 7)."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-flag"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
  * resource[+]
    * type = #Task
    * extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * extension[=].valueCode = #MAY
    * documentation = "Open safety work — reassessment, care gaps, escalation (Stage 7)."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-task"
    * supportedProfile[=].extension[+].url = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation"
    * supportedProfile[=].extension[=].valueCode = #MAY
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type


Instance: SPiERHIEIntermediary
InstanceOf: CapabilityStatement
Title: "SPiER HIE Intermediary"
Description: "Capabilities of a Health Information Exchange or interoperability platform that STORES and FORWARDS SPiER resources across organizations without losing fidelity or provenance. It accepts the resources from a screening-source EHR and makes them available to risk consumers."
Usage: #definition
* id = "hie-intermediary"
* url = "http://thespierproject.org/fhir/CapabilityStatement/hie-intermediary"
* name = "SPiERHIEIntermediary"
* title = "SPiER HIE Intermediary"
* status = #draft
* experimental = true
* date = "2026-06-07"
* kind = #requirements
* fhirVersion = #4.0.1
* format[+] = #json
* format[+] = #xml
* rest[+]
  * mode = #server
  * documentation = "Ingests, stores, and serves SPiER resources for cross-organization exchange."
  * resource[+]
    * type = #QuestionnaireResponse
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Observation
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-asq-result"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-bssa-disposition-result"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-outcome-disposition"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-means-safety-action"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-item9"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-total-score"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss-full-risk-level"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss3-result"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-sbqr-total-score"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-concept"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Condition
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-suicide-driver"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-related-condition"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #CarePlan
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-stabilization-plan"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-therapeutic-worksheet"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  // The Stage 4–7 workflow resources move across organizations too — a
  // transition bundle that drops the referral, the appointment, or the
  // episode loses exactly the context the receiving site needs.
  * resource[+]
    * type = #Procedure
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-lethal-means-counseling"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Communication
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-caring-contact"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-crisis-resources-shared"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-outreach-attempt"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-handoff"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #DocumentReference
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-discharge-safety-packet"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #ServiceRequest
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-referral"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Appointment
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-follow-up-appointment"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Consent
    * documentation = "SHALL be moved with the rest: an intermediary that forwards suicide-safety data without the consent governing it cannot honor a deny provision."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-information-sharing-consent"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #EpisodeOfCare
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-episode"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Encounter
    * documentation = "The contact each resource names and the link to its episode. An intermediary that drops it leaves one episode's record impossible to assemble."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-encounter"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Flag
    * documentation = "The active-episode chart banner."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-flag"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Task
    * documentation = "Open safety work: reassessment, care gaps and escalation."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-task"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  // Optional. The pilot's second phase surfaces results through an HIE's
  // existing bulk infrastructure, and the definition is the one the Quality
  // Reporter names.
  * operation[+]
    * name = "export"
    * definition = "http://hl7.org/fhir/uv/bulkdata/OperationDefinition/group-export"
    * documentation = "MAY be supported, so a receiving organization can take a cohort's suicide-safer care record in one request. An intermediary that supports it SHALL apply the same consent restrictions it applies to a single read."


Instance: SPiERRiskConsumer
InstanceOf: CapabilityStatement
Title: "SPiER Risk Consumer"
Description: "Capabilities of a CLIENT that READS suicide-risk information to surface it at the point of care. The minimal requirement is the harmonized suicide-risk concept Observation (generic LOINC 93374-7, category suicide-risk); the instrument-specific Observations and safety plans are optional higher-fidelity reads."
Usage: #definition
* id = "risk-consumer"
* url = "http://thespierproject.org/fhir/CapabilityStatement/risk-consumer"
* name = "SPiERRiskConsumer"
* title = "SPiER Risk Consumer"
* status = #draft
* experimental = true
* date = "2026-06-07"
* kind = #requirements
* fhirVersion = #4.0.1
* format[+] = #json
* format[+] = #xml
* rest[+]
  * mode = #client
  * documentation = "Reads the harmonized suicide-risk concept and, optionally, the underlying capture data."
  * resource[+]
    * type = #Observation
    * documentation = "SHALL read the harmonized concept (code 93374-7, category suicide-risk); MAY read the instrument Observations."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-concept"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-asq-result"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-bssa-disposition-result"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-total-score"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-item9"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss3-result"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss-full-risk-level"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-sbqr-total-score"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital"
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-outcome-disposition"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #QuestionnaireResponse
    * interaction[+].code = #read
  * resource[+]
    * type = #Condition
    * interaction[+].code = #read
  * resource[+]
    * type = #CarePlan
    * interaction[+].code = #read
  // Optional higher-fidelity reads of the shared safety context (TL-045).
  // A consumer that surfaces risk at the point of care is usually also the
  // system that needs to know an episode is open and who owns follow-up.
  * resource[+]
    * type = #EpisodeOfCare
    * documentation = "MAY read the open suicide-safer care episode to show that the patient is in active suicide-safer care."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-episode"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Encounter
    * documentation = "MAY read the encounters of an episode. Episode membership runs through the encounter, so a consumer assembling one episode's record needs it."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-encounter"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Flag
    * documentation = "MAY read the chart banner. Note it deliberately carries no clinical detail — a consumer needing tier must read the episode or the concept Observation."
    * interaction[+].code = #read
  * resource[+]
    * type = #Communication
    * documentation = "MAY read the suicide-safety handoff and follow-up contacts."
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Appointment
    * documentation = "MAY read the follow-up appointment and its status."
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Consent
    * documentation = "SHALL read the information-sharing consent before re-disclosing anything received. A deny provision naming a recipient is what withholds data from that recipient."
    * supportedProfile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-information-sharing-consent"
    * interaction[+].code = #read
    * interaction[+].code = #search-type


// ─── Stage 8: the quality-reporting role ─────────────────────
// TL-042 (measures), TL-043 (dashboard), and TL-044 (export) are all the same
// actor wearing three hats: something that READS the pathway data in bulk and
// computes over it. It is a distinct role from the three above because its
// access pattern is population-wide rather than per-patient, which is a
// different privacy and performance conversation for an adopting site.

Instance: SPiERQualityReporter
InstanceOf: CapabilityStatement
Title: "SPiER Quality Reporter"
Description: "Capabilities of a system that COMPUTES the SPiER suicide-safer care measures and extracts the underlying pathway data for quality improvement. Reads population-wide rather than per-patient; produces MeasureReports."
Usage: #definition
* id = "quality-reporter"
* url = "http://thespierproject.org/fhir/CapabilityStatement/quality-reporter"
* name = "SPiERQualityReporter"
* title = "SPiER Quality Reporter"
* status = #draft
* experimental = true
* date = "2026-07-29"
* kind = #requirements
* fhirVersion = #4.0.1
* format[+] = #json
* format[+] = #xml
* rest[+]
  * mode = #server
  * documentation = "Computes the SPiER measures over the pathway data and makes both the measure results and the source data available for analysis. Every numerator and denominator reads resource types the Screening-Source EHR role already produces — this role adds no new capture requirement, only the ability to read across patients."
  * resource[+]
    * type = #Measure
    * documentation = "The eight SPiER suicide-safer care measures — screen-to-assessment, risk status documented, safety plan before discharge, lethal means counseling, follow-up timeliness, caring-contact adherence, referral loop closure, reassessment on time. A reporter SHALL be able to resolve the Measure and its referenced Library in order to know what it is computing. (No supportedProfile is listed: SPiER constrains no Measure profile, it publishes Measure instances.)"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  // No #Library requirement entry of its own. SPiER DOES publish the measure
  // logic Library (Library/SPiERSuicideSaferCareMeasures, compiled from
  // ig/input/cql/ by the IG Publisher since #212), and the documentation above
  // already obliges a reporter to resolve it from Measure.library. A reporter
  // reimplementing the criteria in its own reporting stack — the common case —
  // reads the Library rather than serving it.
  * resource[+]
    * type = #MeasureReport
    * documentation = "Summary reports answer 'how is the program doing'. Individual reports SHALL populate `evaluatedResource` so a result can be traced back to the artifacts that produced it — an unauditable quality measure does not survive contact with a QI committee."
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  // TL-044. Named as an operation rather than a profile because an export is
  // a serialization of resources that already exist — see the
  // ExportSuicideSaferCareData ActivityDefinition.
  * operation[+]
    * name = "evaluate-measure"
    * definition = "http://hl7.org/fhir/OperationDefinition/Measure-evaluate-measure"
    * documentation = "SHOULD be supported so a measure can be computed on demand for a period and subject. A reporter that computes in an external warehouse instead is conformant provided it publishes MeasureReports."
  * operation[+]
    * name = "export"
    * definition = "http://hl7.org/fhir/uv/bulkdata/OperationDefinition/group-export"
    * documentation = "The Export Data activity (TL-044). The conforming analytics extract is a Bulk Data export of the SPiER resource types. The SSC's requirement that an extract carry structured fields AND the timestamps needed for measurement is already met by the profiles: every one mandates a discrete date (Observation.effective, Procedure.performed, Communication.sent, Appointment.start, ServiceRequest.authoredOn, EpisodeOfCare.period, Task.authoredOn). CSV and warehouse extracts are flattenings of the same set."
