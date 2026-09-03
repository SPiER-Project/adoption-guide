// Pathway Tool Placeholders — minimal ActivityDefinitions
//
// Pathway steps catalogued but not yet fully FHIR-modelled: structural
// metadata only, and deliberately NO LOINC/SNOMED code, NO sdc-questionnaire
// binding and NO derived-Observation profile — each needs verified terminology
// and an authored Questionnaire. design-decisions.md says what a consumer
// should read into that, and why plausible placeholder values are the thing not
// to do. Once a tool has both, move it to its own <instrument>.fsh and enrich
// it there (the `assessment-to-ig` skill drives that).
//
// Every AD here still owes two things, both machine-checked: a stage, from
// exactly one PlanDefinition action in pathway-stages.fsh, and a tool-id
// identifier (tool-id-identifier.fsh) — without the latter the catalog silently
// does not list it. `kind` is how the catalog derives the tool's type.

// ─── Identify Possible Risk ──────────────────────────────────


Instance: TriggerSuicideRiskWorkflow
InstanceOf: ActivityDefinition
Title: "Positive Screen Flag / Suicide-Risk Workflow Trigger"
Description: "Create a suicide-risk flag or start the suicide-risk workflow after a positive screen (any enabled tool or clinical judgment)."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/TriggerSuicideRiskWorkflow"
* identifier[+].system = "http://thespierproject.org/fhir/identifier/tool-id"
* identifier[=].value = "TL-026"
* name = "TriggerSuicideRiskWorkflow"
* version = "0.1.0"
* title = "Positive Screen Flag / Suicide-Risk Workflow Trigger"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Create a suicide-risk flag or start the suicide-risk workflow after a positive screen. Placeholder ActivityDefinition — the ASQ and PHQ-9 Item 9 cases are already FHIR-encoded as Clarify Risk stage triggers; this placeholder catalogues the generalized flag/workflow capability."
* purpose = "Make positive screens actionable: chart flag, work-queue entry, notification, and next-step routing."
* kind = #Task
// Licensing — see instrument-licensing.fsh
* insert LicensingSpiERAuthored


// ─── Clarify Risk ────────────────────────────────────────────


Instance: AdministerCARSS
InstanceOf: ActivityDefinition
Title: "Administer Cultural Assessment of Risk for Suicide (CARS-S)"
Description: "Administer the Cultural Assessment of Risk for Suicide (CARS-S), a culturally informed assessment of risk and protective factors."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCARSS"
* identifier[+].system = "http://thespierproject.org/fhir/identifier/tool-id"
* identifier[=].value = "TL-028"
* name = "AdministerCARSS"
* version = "0.1.0"
* title = "Administer Cultural Assessment of Risk for Suicide (CARS-S)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the Cultural Assessment of Risk for Suicide (CARS-S). Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Capture cultural risk and protective factors, identity/community context, and barriers to disclosure that inform suicide-risk formulation."
* kind = #ServiceRequest
// Licensing — see instrument-licensing.fsh
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #commercial
* copyright = "NO-GO — permission not obtained. The Cultural Assessment of Risk for Suicide (CARS/CARS-S, Chu et al., 2013, *Psychological Assessment*) is a copyrighted research measure held by the authors and/or the American Psychological Association. It is neither public domain nor a free-registration instrument: reproducing its items requires written permission from the authors/publisher, or purchase of the measure. No permission grant is on file, so this ActivityDefinition is a catalogued placeholder that deliberately reproduces NO CARS item content, and SPiER publishes no CARS Questionnaire. Attribution, modification and commercial-use conditions would all have to be captured from a future permission grant. Basis: FHIR-Resources/CARS-S/licensing/MEMO.md (issue #64)."


Instance: AdministerLocalRiskAssessment
InstanceOf: ActivityDefinition
Title: "Administer Full Suicide-Risk Assessment / Local Assessment Tool"
Description: "Administer a site-defined full suicide-risk assessment for EHRs that do not use one of the named assessment tools."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerLocalRiskAssessment"
* identifier[+].system = "http://thespierproject.org/fhir/identifier/tool-id"
* identifier[=].value = "TL-029"
* name = "AdministerLocalRiskAssessment"
* version = "0.1.0"
* title = "Administer Full Suicide-Risk Assessment / Local Assessment Tool"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer a site-defined full suicide-risk assessment. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Capture thoughts, plan, intent, behavior history, access to means, and risk/protective factors where a local assessment form is used instead of a named tool."
* kind = #ServiceRequest
// Licensing — see instrument-licensing.fsh
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #spier-authored
* copyright = "SPiER-authored placeholder for a site's own locally-defined risk assessment. SPiER supplies only the workflow slot — no items, no scoring, no third-party content — published with the SPiER Implementation Guide under the guide's own license (CC0-1.0). Whatever instrument a site plugs into this step carries ITS licensing, which the site must establish itself; this ActivityDefinition makes no claim about it."
