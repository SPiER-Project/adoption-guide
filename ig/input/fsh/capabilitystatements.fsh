// =============================================================
// CapabilityStatements — role-segmented conformance
// =============================================================
// SPiER defines conformance per system ROLE (the HL7 Gravity Project
// pattern) rather than as one monolithic spec. Three actors map onto
// SPiER's audiences and the cross-EHR portability pilot:
//   - Screening-source EHR  — produces the screening data
//   - HIE intermediary      — moves it across organizations
//   - Risk consumer/client  — reads the harmonized risk concept
//
// kind = #requirements: these describe the capabilities a conforming
// system of each role must support (not a specific instance/software).
// Referenced from pagecontent/conformance.html.
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
    * documentation = "Stanley-Brown and CAMS safety / stabilization plans."
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cams-stabilization-plan"
    * supportedProfile[+] = "http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet"
    * interaction[+].code = #create
    * interaction[+].code = #read


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
