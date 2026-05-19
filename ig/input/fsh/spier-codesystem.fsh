// SPiER local CodeSystems
//
// These code systems cover concepts where no published LOINC or SNOMED CT
// code exists. Each entry includes a note about whether a published code
// is anticipated (which would let us deprecate the local entry).

CodeSystem: SPiERPathwayStage
Id: spier-pathway-stage
Title: "SPiER Pathway Stage"
Description: "The eight technical stages of the SPiER suicide-safer care pathway. These align with the technical layers of the Zero Suicide framework (Identify, Engage, Treat, Transition, Improve). Organizational layers of the Zero Suicide framework (Lead, Train) are out of scope for SPiER."
* ^url = "http://htdhealth.com/fhir/spier/CodeSystem/spier-pathway-stage"
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #flag-risk "Flag Risk" "The EHR captures a suicide-related signal and indicates whether further suicide-risk review is needed."
* #clarify-risk "Clarify Risk" "The EHR captures the details needed to understand the nature, severity, and context of suicide risk."
* #set-risk-status "Set Risk Status" "The EHR supports documenting the current risk status and the clinical reasoning that guides next steps."
* #document-safety-actions "Document Safety Actions" "The EHR supports documenting and updating the concrete actions used to reduce risk and support safety."
* #coordinate-handoffs "Coordinate Handoffs" "The EHR supports the transfer of essential suicide-safety information, responsibility, and follow-up details across people, settings, and time points."
* #track-follow-up "Track Follow-Up" "The EHR tracks whether outreach and follow-up steps occur after the immediate encounter."
* #manage-active-risk "Manage Active Risk" "The EHR keeps active suicide-safer care episodes visible, trackable, and escalated when needed."
* #measure-and-share "Measure and Share" "The EHR makes pathway activity usable for reporting, quality improvement, accountability, and information sharing."
