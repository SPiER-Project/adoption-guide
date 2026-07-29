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


Instance: SPiERScreeningSourceEHR
InstanceOf: CapabilityStatement
Title: "SPiER Screening-Source EHR"
Description: "Capabilities of a system that CAPTURES a suicide-risk screening or assessment and PRODUCES the SPiER artifacts: it persists the QuestionnaireResponse and creates the derived instrument Observations, the harmonized suicide-risk concept Observation, and (for safety-planning tools) CarePlan / Condition resources."
Usage: #definition
* id = "screening-source-ehr"
* url = "http://spier.org/CapabilityStatement/screening-source-ehr"
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
  * documentation = "Captures screening data and writes the SPiER resources as discrete data."
  * resource[+]
    * type = #QuestionnaireResponse
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
  * resource[+]
    * type = #Observation
    * documentation = "Derived instrument results and the harmonized suicide-risk concept."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-asq-result"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cssrs-risk-level"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-phq9-total-score"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-phq9-item9"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-sbqr-total-score"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cams-ssf-vital"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-suicide-risk-concept"
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Condition
    * documentation = "CAMS-identified suicide drivers on the problem list."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cams-suicide-driver"
    * interaction[+].code = #create
    * interaction[+].code = #read
  * resource[+]
    * type = #CarePlan
    * documentation = "Stanley-Brown and CAMS safety / stabilization plans, plus the Crisis Response Plan."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cams-stabilization-plan"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-crisis-response-plan"
    * interaction[+].code = #create
    * interaction[+].code = #read
  // ─── Stage 4–7 workflow resources ───
  // Required for TL-044/TL-045: an extract or a shared bundle is only as
  // complete as the resource types the source system will hand over.
  * resource[+]
    * type = #Procedure
    * documentation = "Lethal-means safety counseling delivered (Stage 4)."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-lethal-means-counseling"
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Communication
    * documentation = "Crisis resources shared (Stage 4), the suicide-safety handoff (Stage 5), and follow-up outreach attempts and caring contacts (Stage 6)."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-crisis-resources-shared"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-safety-handoff"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-outreach-attempt"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-caring-contact"
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #DocumentReference
    * documentation = "The discharge safety packet (Stage 5)."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-discharge-safety-packet"
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #ServiceRequest
    * documentation = "The suicide-safety referral (Stage 5). SHALL support update — tracking a referral past `sent` through to `completed` is the whole reason this is a ServiceRequest, and is what makes referral loop closure measurable."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-safety-referral"
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Appointment
    * documentation = "The follow-up appointment (Stage 5). SHALL support update: the 7- and 30-day follow-up measures read `status = fulfilled`, so a system that can book but never records attendance cannot produce them."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-follow-up-appointment"
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Consent
    * documentation = "Information-sharing consent (Stage 5). Governs what TL-045 may share and with whom."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-information-sharing-consent"
    * interaction[+].code = #create
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #EpisodeOfCare
    * documentation = "The suicide-safer care episode (Stage 7) — the cohort anchor for every Stage-8 measure. SHALL support update so the episode can be closed with a reason."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-suicide-risk-episode"
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Flag
    * documentation = "The active-episode chart banner (Stage 7)."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-suicide-risk-flag"
    * interaction[+].code = #create
    * interaction[+].code = #update
    * interaction[+].code = #read
  * resource[+]
    * type = #Task
    * documentation = "Open safety work — reassessment, care gaps, escalation (Stage 7)."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-safety-task"
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
* url = "http://spier.org/CapabilityStatement/hie-intermediary"
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
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Condition
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #CarePlan
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  // The Stage 4–7 workflow resources move across organizations too — a
  // transition bundle that drops the referral, the appointment, or the
  // episode loses exactly the context the receiving site needs.
  * resource[+]
    * type = #Procedure
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Communication
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #DocumentReference
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #ServiceRequest
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Appointment
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #Consent
    * documentation = "SHALL be moved with the rest: an intermediary that forwards suicide-safety data without the consent governing it cannot honor a deny provision."
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create
  * resource[+]
    * type = #EpisodeOfCare
    * interaction[+].code = #read
    * interaction[+].code = #search-type
    * interaction[+].code = #create


Instance: SPiERRiskConsumer
InstanceOf: CapabilityStatement
Title: "SPiER Risk Consumer"
Description: "Capabilities of a CLIENT that READS suicide-risk information to surface it at the point of care. The minimal requirement is the harmonized suicide-risk concept Observation (generic LOINC 93374-7, category suicide-risk); the instrument-specific Observations and safety plans are optional higher-fidelity reads."
Usage: #definition
* id = "risk-consumer"
* url = "http://spier.org/CapabilityStatement/risk-consumer"
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
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-suicide-risk-concept"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-asq-result"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cssrs-risk-level"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-phq9-total-score"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-phq9-item9"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-sbqr-total-score"
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
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-suicide-risk-episode"
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
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-information-sharing-consent"
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
* url = "http://spier.org/CapabilityStatement/quality-reporter"
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
    * documentation = "The seven SPiER suicide-safer care measures — screen-to-assessment, risk status documented, safety plan before discharge, lethal means counseling, follow-up timeliness, caring-contact adherence, referral loop closure. A reporter SHALL be able to resolve the Measure and its referenced Library in order to know what it is computing. (No supportedProfile is listed: SPiER constrains no Measure profile, it publishes Measure instances.)"
    * interaction[+].code = #read
    * interaction[+].code = #search-type
  * resource[+]
    * type = #Library
    * documentation = "The CQL logic library the measures reference. A reporter that reimplements the criteria in its own reporting stack (the common case) SHALL still be able to read the library, since it is the normative statement of what each population means."
    * interaction[+].code = #read
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
    * documentation = "TL-044. The conforming analytics extract is a Bulk Data export of the SPiER resource types. The SSC's requirement that an extract carry structured fields AND the timestamps needed for measurement is already met by the profiles: every one mandates a discrete date (Observation.effective, Procedure.performed, Communication.sent, Appointment.start, ServiceRequest.authoredOn, EpisodeOfCare.period, Task.authoredOn). CSV and warehouse extracts are flattenings of the same set."
