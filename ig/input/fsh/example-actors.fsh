// The patient and practitioner every example in this guide points at.
//
// Before this file, 68 example references to `Patient/example` and 16 to
// `Practitioner/practitioner-1` resolved to nothing: the publisher tolerates an
// unresolved example reference, so the build stayed clean while an adopter
// following a link from any example landed nowhere. Both are US Core instances
// because the guide is US-realm and depends on US Core. Synthetic data only.

Instance: example
InstanceOf: USCorePatientProfile
Title: "Example — Synthetic patient"
Description: "The synthetic patient every example in this guide refers to. Not a real person."
Usage: #example
* identifier.system = "http://thespierproject.org/fhir/identifier/mrn"
* identifier.value = "SPIER-EXAMPLE-0001"
* name.family = "Example"
* name.given = "Alex"
* gender = #unknown
* birthDate = "1990-04-12"


Instance: practitioner-1
InstanceOf: USCorePractitionerProfile
Title: "Example — Synthetic practitioner"
Description: "The synthetic clinician every example in this guide refers to as performer or author. Not a real person."
Usage: #example
* identifier.system = "http://thespierproject.org/fhir/identifier/practitioner"
* identifier.value = "SPIER-PRACT-0001"
* name.family = "Chen"
* name.given = "Sam"
